'use strict';
// Narrative house-style renderer and share-link payload encoding — pure
// logic, loaded straight out of index.html's __TESTABLE__ block.

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
  const names = ['extractFields', 'renderTicketNarrative', 'renderTicketText',
    'encodeSharePayload', 'decodeSharePayload', 'b64u', 'unb64u', 'publicShareBase'];
  const wrapped = body + '\n;({' + names.map((n) => n + ':' + n).join(',') + '});';
  const sandbox = { btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary') };
  vm.createContext(sandbox);
  return vm.runInContext(wrapped, sandbox, { filename: 'index.html (testable block)' });
}

const { extractFields, renderTicketNarrative, encodeSharePayload, decodeSharePayload,
  publicShareBase } = loadTestable();

const PUBLISHED = 'https://sundaespecial.github.io/say-so/';

test('share links never point at an origin only the sender can reach', () => {
  // The Android app runs on https://localhost (androidScheme "https"), so a
  // link built from the running origin loads the recipient's own machine and
  // fails. This is the bug that made emailed links dead on arrival.
  assert.equal(
    publicShareBase({ hostname: 'localhost', protocol: 'https:', origin: 'https://localhost', pathname: '/' }, PUBLISHED),
    PUBLISHED);
  assert.equal(
    publicShareBase({ hostname: '127.0.0.1', protocol: 'http:', origin: 'http://127.0.0.1:8099', pathname: '/index.html' }, PUBLISHED),
    PUBLISHED);
  assert.equal(
    publicShareBase({ hostname: '', protocol: 'file:', origin: 'null', pathname: '/C:/app/index.html' }, PUBLISHED),
    PUBLISHED);
});

test('share links keep the real origin when the app is served publicly', () => {
  assert.equal(
    publicShareBase({ hostname: 'sundaespecial.github.io', protocol: 'https:', origin: 'https://sundaespecial.github.io', pathname: '/say-so/' }, PUBLISHED),
    'https://sundaespecial.github.io/say-so/');
  // a custom domain must survive without touching the fallback constant
  assert.equal(
    publicShareBase({ hostname: 'sayso.app', protocol: 'https:', origin: 'https://sayso.app', pathname: '/' }, PUBLISHED),
    'https://sayso.app/');
});

test('narrative house style fills only what the transcript actually said', () => {
  const t = "Okay so this is for Dave Kowalski over in the Akron office, he called in about twenty minutes ago. His laptop won't connect to the VPN, keeps saying authentication failed. I checked and his cert had expired. Renewed it, tested the tunnel, he's good now. Priority two.";
  const { fields, desc } = extractFields(t, 'Incident', 'P3');
  const take = { template: 'Incident', fields, desc };
  const text = renderTicketNarrative(take, 'Acme IT', 'Elijah');
  assert.equal(text,
    "Dave Kowalski reached out noting that his laptop won't connect to the VPN, keeps saying authentication failed. " +
    "Elijah connected with Dave Kowalski and renewed it, tested the tunnel, he's good now.");
});

test('narrative includes a verification and result sentence when the dictation gives one', () => {
  const t = "Ticket for Marla Bennett, Cincinnati office. She's getting the Duo push but it times out before she can approve it. I removed the orphaned device, re-enrolled her on the new phone, verified push on the first attempt. Resolved on first contact, about fifteen minutes.";
  const { fields, desc } = extractFields(t, 'Incident', 'P3');
  const take = { template: 'Incident', fields, desc };
  const text = renderTicketNarrative(take, 'Acme IT', 'Elijah');
  assert.match(text, /^Marla Bennett reached out noting that/);
  assert.match(text, /Elijah connected with Marla Bennett and/);
  assert.match(text, /Elijah verified resolved on first contact\.$/);
});

test('narrative refuses to compose when a required fact is missing — caller falls back to structured fields', () => {
  const noResolution = extractFields("Someone called about a printer that is jammed.", 'Incident', 'P3');
  assert.equal(renderTicketNarrative({ template: 'Incident', fields: noResolution.fields }, 'ws', 'Elijah'), null);

  const noName = extractFields("Elijah connected with 'em, works now.", 'Incident', 'P3');
  assert.equal(renderTicketNarrative({ template: 'Incident', fields: noName.fields }, 'ws', 'Elijah'), null);

  const t = "Alan Chen needs access to Tableau. His manager approved it. I granted the license.";
  const req = extractFields(t, 'Request', 'P3');
  assert.equal(renderTicketNarrative({ template: 'Request', fields: req.fields }, 'ws', 'Elijah'), null);

  const t2 = "Dave Kowalski called about his VPN.";
  const noYourName = extractFields(t2, 'Incident', 'P3');
  assert.equal(renderTicketNarrative({ template: 'Incident', fields: noYourName.fields }, 'ws', ''), null);
});

test('share payload round-trips through the URL-fragment encoding, and rejects garbage', () => {
  const obj = { n: 1, ticket: 'hello — "quoted" & <tagged> ünïcödé', fields: [{ key: 'a', val: 1 }] };
  const frag = 'take=' + encodeSharePayload('o1', obj);
  const decoded = decodeSharePayload('#' + frag);
  // decoded objects come from a separate vm realm (different Object
  // prototype), so compare by serialized value rather than deepStrictEqual
  assert.equal(JSON.stringify(decoded), JSON.stringify({ kind: 'o1', obj }));

  assert.equal(decodeSharePayload('#nothing=here'), null);
  assert.equal(decodeSharePayload(''), null);
  assert.equal(decodeSharePayload('#take=p1.not-valid-base64url-json!!!'), null);
});
