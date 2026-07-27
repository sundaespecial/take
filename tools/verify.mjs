#!/usr/bin/env node
// Dependency-light structural checks for TAKE. Complements test/*.test.js
// (which cover the pure extraction/rendering logic) by checking the shape
// of the shipped app: nav surface, engine, waveform presets, PWA files,
// service worker cache bump, and plain JS syntax validity.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ok = (msg) => console.log('  ok   ' + msg);
const fail = (msg) => { failures.push(msg); console.log('  FAIL ' + msg); };
const warn = (msg) => console.log('  warn ' + msg);

const html = readFileSync(path.join(root, 'index.html'), 'utf8');

// 1. customer navigation exposes only Capture and Ticket
{
  const transportMatch = html.match(/<div class="transport"[\s\S]*?<\/div>/);
  const tbtns = transportMatch ? [...transportMatch[0].matchAll(/<button class="tbtn"[^>]*>([^<]+)</g)].map((m) => m[1].trim()) : [];
  if (tbtns.length === 2 && tbtns[0] === 'Capture' && tbtns[1] === 'Ticket') {
    ok('primary navigation is exactly Capture, Ticket');
  } else {
    fail('primary navigation is ' + JSON.stringify(tbtns) + ', expected exactly ["Capture","Ticket"]');
  }
}

// 2. SpeechRecognition must not return
{
  const hits = (html.match(/\bSpeechRecognition\b|\bwebkitSpeechRecognition\b/g) || []);
  if (hits.length === 0) ok('no SpeechRecognition / webkitSpeechRecognition references');
  else fail('found ' + hits.length + ' SpeechRecognition/webkitSpeechRecognition reference(s) — Whisper must be the only engine');
}

// 3. all three waveform presets present
{
  const required = ['rainbow', 'mono', 'amber'];
  const missing = required.filter((w) => !html.includes('data-wave="' + w + '"'));
  if (!missing.length) ok('all three waveform presets present (rainbow, mono, amber)');
  else fail('missing waveform preset(s): ' + missing.join(', '));
}

// 4. required PWA files present
{
  const required = ['index.html', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
  const missing = required.filter((f) => !existsSync(path.join(root, f)));
  if (!missing.length) ok('all required PWA files present');
  else fail('missing PWA file(s): ' + missing.join(', '));
}

// 5. service worker cache version was bumped (vs. the last commit, if any)
{
  const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
  const cur = (sw.match(/CACHE\s*=\s*'([^']+)'/) || [])[1];
  if (!cur) {
    fail('could not find CACHE = \'...\' in sw.js');
  } else {
    let prevSw = null;
    try {
      prevSw = execFileSync('git', ['show', 'HEAD:sw.js'], { cwd: root, encoding: 'utf8' });
    } catch (e) {
      warn('no committed sw.js to diff against yet (first commit?) — skipping cache-bump check');
    }
    if (prevSw != null) {
      const prev = (prevSw.match(/CACHE\s*=\s*'([^']+)'/) || [])[1];
      if (prev && prev === cur) fail('sw.js CACHE version (' + cur + ') was not bumped from the last commit');
      else ok('sw.js CACHE version bumped (' + prev + ' -> ' + cur + ')');
    }
  }
}

// 6. inline JS syntax is valid
{
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) {
    fail('could not find the inline <script> block to syntax-check');
  } else {
    try {
      new Script(m[1], { filename: 'index.html (inline script)' });
      ok('inline script syntax is valid');
    } catch (e) {
      fail('inline script has a syntax error: ' + (e && e.message || e));
    }
  }
}

console.log('');
if (failures.length) {
  console.log(failures.length + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('All structural checks passed.');
}
