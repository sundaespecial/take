#!/usr/bin/env node
/* Builds the Google Play variant of SAY SO into www/.
 *
 * The web app (index.html at the repo root) keeps the real trial + license
 * key gate — that's what's sold directly. Google requires apps sold through
 * Play to use Google Play Billing, not an outside key system, so the store
 * build is paid upfront through Play and the key system comes out entirely.
 *
 * "Comes out" means removed, not hidden: a buyer who has already paid should
 * never meet a trial counter, an unlock dialog, or a "Get a key" link. Every
 * cut below is verified against the source first, so if index.html moves on
 * and a pattern stops matching, this fails loudly instead of quietly
 * shipping a half-gated build.
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
// Wiped, not merged: `npx cap sync` bundles everything in www/ into the app,
// so anything left behind from an earlier run ships to users. (The screenshot
// harnesses from tools/make-shots.mjs are the obvious way that happens.)
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* Every edit goes through here so none of them can silently no-op. */
function edit(label, re, replacement) {
  if (!re.test(html)) {
    console.error('build-store: pattern for "' + label + '" not found in index.html.');
    console.error('  index.html has changed — update tools/build-store.mjs to match before shipping.');
    process.exit(1);
  }
  html = html.replace(re, replacement);
}

/* ---- the gate itself ------------------------------------------------- */
edit('gateOK()', /function gateOK\(\)\{return !!licState\(\)\|\|trialUsed\(\)<TRIAL_LIMIT\}/,
  'function gateOK(){return true}');

edit('BUY_URL', /var BUY_URL='[^']*';/, "var BUY_URL='';");

/* ---- markup: chip, unlock dialog, settings section -------------------- */
edit('header license chip',
  /\s*<button class="pill" id="licChip"[^>]*>[\s\S]*?<\/button>/, '');

// the file is CRLF, so newline anchors need \r?\n
edit('unlock dialog',
  /\s*<div class="modal" id="lmodal"[\s\S]*?\r?\n<\/div>/, '');

// anchored past the button so the non-greedy match can't stop at the
// setLicLine div and leave the rest of the group behind
edit('settings license group',
  /\s*<div class="settgroup">\s*<span class="eyebrow">License<\/span>[\s\S]*?id="setLicBtn"[\s\S]*?<\/div>/, '');

/* ---- the JS that reaches for those elements --------------------------- */
// updateLic(), openLicense() and closeLicense() already guard for a missing
// element, so they can stay. These five do not.
edit('settings license line',
  /\s*el\('setLicLine'\)\.textContent=licState\(\)\?'Licensed\.':'Trial · '\+Math\.max\(0,TRIAL_LIMIT-trialUsed\(\)\)\+' takes left\.';/, '');

edit('license chip listener',
  /\s*el\('licChip'\)\.addEventListener\('click',openLicense\);/, '');

edit('manage-license listener',
  /\s*el\('setLicBtn'\)\.addEventListener\('click',function\(\)\{el\('setmodal'\)\.classList\.remove\('up'\);openLicense\(\)\}\);/, '');

edit('unlock dialog wiring',
  /\s*var lb=el\('lBuy'\);[\s\S]*?el\('lmodal'\)\.addEventListener\('click',function\(e\)\{if\(e\.target===el\('lmodal'\)\)closeLicense\(\)\}\);/, '');

fs.writeFileSync(path.join(outDir, 'index.html'), html);

const assets = ['sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
for (const f of assets) fs.copyFileSync(path.join(root, f), path.join(outDir, f));

console.log('Store build written to', outDir, '— license gate, trial counter and unlock UI removed.');
console.log('Everything else (extraction, sharing, Whisper, visuals) is identical to the web app.');
