'use strict';
// Gain-boost math for quiet mic input (Bluetooth/bone-conduction earbuds
// deliver much lower levels than a phone's built-in mic) — pure logic,
// loaded straight out of index.html's __TESTABLE__ block.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadTestable() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('/* __TESTABLE_START__');
  const end = html.indexOf('/* __TESTABLE_END__');
  const body = html.slice(start, end);
  const names = ['maxAbs', 'normalizeGain'];
  const wrapped = body + '\n;({' + names.map((n) => n + ':' + n).join(',') + '});';
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(wrapped, sandbox, { filename: 'index.html (testable block)' });
}

const { maxAbs, normalizeGain } = loadTestable();

test('maxAbs finds the peak absolute sample', () => {
  // Float32Array stores approximations (e.g. 0.4 -> 0.4000000059...), so
  // compare with a tolerance rather than strict equality
  assert.ok(Math.abs(maxAbs(new Float32Array([0.1, -0.4, 0.2, -0.05])) - 0.4) < 1e-6);
  assert.equal(maxAbs(new Float32Array([])), 0);
});

test('normalizeGain boosts a quiet (e.g. Bluetooth mic) recording toward full scale', () => {
  // peak (0.3) is comfortably above the 0.92/12 ~= 0.077 cap threshold, so
  // the gain here is the plain 0.92/peak target, not the capped one
  const pcm = new Float32Array([0.12, -0.18, 0.3, -0.06]);
  const peak = maxAbs(pcm);
  normalizeGain(pcm, peak);
  assert.ok(Math.abs(maxAbs(pcm) - 0.92) < 1e-5);
  // shape is preserved: the loudest input sample is still the loudest output sample
  assert.ok(Math.abs(Math.abs(pcm[2]) - maxAbs(pcm)) < 1e-6);
});

test('normalizeGain caps the boost so near-silent noise floor is not blown up into hiss', () => {
  const pcm = new Float32Array([0.006, -0.004, 0.007]);
  const peak = maxAbs(pcm);
  normalizeGain(pcm, peak);
  // gain capped at 12x rather than the ~131x a naive 0.92/peak would apply here
  assert.ok(Math.abs(pcm[2] - 0.007 * 12) < 1e-6);
});

test('normalizeGain never produces a sample outside [-1, 1], regardless of input', () => {
  for (const peak of [0.001, 0.01, 0.05, 0.3, 0.7, 0.95]) {
    const pcm = new Float32Array([peak, -peak, peak * 0.5]);
    normalizeGain(pcm, peak);
    for (const v of pcm) assert.ok(v <= 1 && v >= -1, `sample ${v} out of range for peak ${peak}`);
  }
});

test('an already-loud (built-in mic) recording is gently pulled to the same target, not left alone', () => {
  // this documents the call-site contract in transcribeBlob(): normalizeGain
  // now runs unconditionally, so every take lands at a consistent peak
  // regardless of source — "clear and loud by default", not just for takes
  // already flagged quiet
  const pcm = new Float32Array([0.95, -0.9]);
  normalizeGain(pcm, maxAbs(pcm));
  assert.ok(Math.abs(maxAbs(pcm) - 0.92) < 1e-5);
});
