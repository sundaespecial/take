#!/usr/bin/env node
/* Builds the Google Play variant of TAKE into www/.
 *
 * The web app (index.html at the repo root) keeps the real trial + license
 * key gate — that's what's sold directly. Google requires apps sold through
 * Play to use Google Play Billing, not an outside key system, so the store
 * build removes the gate entirely (paid upfront through Play instead) and
 * clears BUY_URL so the external purchase link never renders in the app.
 *
 * Run this before every `npx cap sync` — it always regenerates www/ fresh
 * from the current index.html, so the store build can't drift out of sync
 * with the web app by hand-editing a stale copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'www');
fs.mkdirSync(outDir, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const gateRe = /function gateOK\(\)\{return !!licState\(\)\|\|trialUsed\(\)<TRIAL_LIMIT\}/;
if (!gateRe.test(html)) {
  console.error('gateOK() pattern not found in index.html — update tools/build-store.mjs to match.');
  process.exit(1);
}
html = html.replace(gateRe, 'function gateOK(){return true}');

const buyRe = /var BUY_URL='[^']*';/;
if (!buyRe.test(html)) {
  console.error('BUY_URL pattern not found in index.html — update tools/build-store.mjs to match.');
  process.exit(1);
}
html = html.replace(buyRe, "var BUY_URL='';");

fs.writeFileSync(path.join(outDir, 'index.html'), html);

const assets = ['sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
for (const f of assets) fs.copyFileSync(path.join(root, f), path.join(outDir, f));

console.log('Store build written to', outDir, '— license gate removed, BUY_URL cleared.');
console.log('Everything else (extraction, sharing, Whisper, visuals) is identical to the web app.');
