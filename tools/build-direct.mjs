#!/usr/bin/env node
/* Builds the direct-sale variant of SAY SO into www/.
 *
 * The counterpart to tools/build-store.mjs. That one strips the licence
 * system out because Play (and Amazon, and Samsung) take the money at the
 * storefront. This one keeps the trial and the key gate intact, because
 * nobody is taking the money for you — the APK this produces is handed to a
 * customer directly, and without the gate it would simply be free.
 *
 * Shipping the store build through a direct channel is the mistake this
 * script exists to prevent, so it verifies the gate actually survived rather
 * than assuming it did.
 *
 *   node tools/build-direct.mjs                       # keys issued by hand
 *   node tools/build-direct.mjs https://your.store/buy # adds a "Get a key" link
 *
 * Then: npx cap sync android && (cd android && ./gradlew.bat assembleRelease)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'www');
const buyUrl = process.argv[2] || '';

if (buyUrl && !/^https:\/\//.test(buyUrl)) {
  console.error('The storefront URL must start with https:// — got: ' + buyUrl);
  process.exit(1);
}

// same reasoning as build-store: cap sync ships whatever is sitting in www/
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const buyRe = /var BUY_URL='[^']*';/;
if (!buyRe.test(html)) {
  console.error('BUY_URL pattern not found in index.html — update tools/build-direct.mjs to match.');
  process.exit(1);
}
html = html.replace(buyRe, "var BUY_URL='" + buyUrl + "';");

// The whole point of this variant: confirm the gate is still there. If a
// future edit ever removes it from index.html, this build must not ship.
if (!/function gateOK\(\)\{return !!licState\(\)\|\|trialUsed\(\)<TRIAL_LIMIT\}/.test(html)) {
  console.error('The licence gate is missing from index.html — refusing to build a direct-sale APK.');
  console.error('  Without it this build would be free to anyone who receives the file.');
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, 'index.html'), html);

const assets = ['sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
for (const f of assets) fs.copyFileSync(path.join(root, f), path.join(outDir, f));

console.log('Direct-sale build written to', outDir, '— trial + licence key gate INTACT.');
console.log(buyUrl
  ? 'Buy link: ' + buyUrl
  : 'No storefront URL set, so the "Get a key" button stays hidden — issue keys with `node keygen.mjs issue <email>`.');
