#!/usr/bin/env node
/* SAY SO license tool — ECDSA P-256, WebCrypto, no dependencies.
 *
 *   node keygen.mjs init [--write]     make a fresh keypair
 *                                            (--write also swaps the public key into index.html)
 *   node keygen.mjs issue <email> [days]   sign a license key for a buyer
 *   node keygen.mjs verify <key>           check a key against your public key
 *
 * The private key lands in keys/take-private.jwk — gitignored. Guard it:
 * anyone holding it can mint licenses for your app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { subtle } = globalThis.crypto;
const root = path.dirname(fileURLToPath(import.meta.url));
const keyDir = path.join(root, 'keys');
const privPath = path.join(keyDir, 'take-private.jwk');
const pubPath = path.join(keyDir, 'take-public.jwk');
const indexPath = path.join(root, 'index.html');

const b64u = (u8) => Buffer.from(u8).toString('base64url');
const enc = (s) => new TextEncoder().encode(s);

async function loadPriv() {
  if (!fs.existsSync(privPath)) {
    console.error('No private key yet. Run: node keygen.mjs init');
    process.exit(1);
  }
  const jwk = JSON.parse(fs.readFileSync(privPath, 'utf8'));
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function loadPub() {
  const jwk = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

async function init(write) {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await subtle.exportKey('jwk', kp.privateKey);
  const pub = await subtle.exportKey('jwk', kp.publicKey);
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(privPath, JSON.stringify(priv, null, 2));
  fs.writeFileSync(pubPath, JSON.stringify(pub, null, 2));
  console.log('Private key  ->', privPath, '(keep secret, never commit)');
  console.log('Public key   ->', pubPath);
  if (write) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const re = /var PUBKEY_JWK=\{[^}]*\};/;
    if (!re.test(html)) {
      console.error('Could not find PUBKEY_JWK in index.html — paste it in by hand:');
      console.log('var PUBKEY_JWK=' + JSON.stringify(pub) + ';');
      process.exit(1);
    }
    html = html.replace(re, 'var PUBKEY_JWK=' + JSON.stringify(pub) + ';');
    fs.writeFileSync(indexPath, html);
    console.log('index.html   -> PUBKEY_JWK replaced. Old keys no longer unlock the app.');
  } else {
    console.log('\nPaste this into index.html (or rerun with --write):');
    console.log('var PUBKEY_JWK=' + JSON.stringify(pub) + ';');
  }
}

async function issue(email, days) {
  if (!email) { console.error('Usage: node keygen.mjs issue <email> [days]'); process.exit(1); }
  const key = await loadPriv();
  const payload = { e: email, iat: Date.now() };
  if (days) payload.exp = Date.now() + Number(days) * 86400000;
  const body = b64u(enc(JSON.stringify(payload)));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(body));
  const lic = 'TAKE1.' + body + '.' + b64u(new Uint8Array(sig));
  console.log(lic);
}

async function verify(lic) {
  if (!lic) { console.error('Usage: node keygen.mjs verify <key>'); process.exit(1); }
  const p = lic.trim().split('.');
  if (p.length !== 3 || p[0] !== 'TAKE1') { console.error('not a SAY SO key'); process.exit(1); }
  const key = await loadPub();
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
    Buffer.from(p[2], 'base64url'), enc(p[1]));
  const payload = JSON.parse(Buffer.from(p[1], 'base64url').toString('utf8'));
  console.log(ok ? 'VALID' : 'INVALID', JSON.stringify(payload));
  if (payload.exp && Date.now() > payload.exp) console.log('…but expired', new Date(payload.exp).toISOString());
  process.exit(ok ? 0 : 1);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'init') init(process.argv.includes('--write'));
else if (cmd === 'issue') issue(a, b);
else if (cmd === 'verify') verify(a);
else {
  console.log('Usage:');
  console.log('  node keygen.mjs init [--write]');
  console.log('  node keygen.mjs issue <email> [days]');
  console.log('  node keygen.mjs verify <key>');
}
