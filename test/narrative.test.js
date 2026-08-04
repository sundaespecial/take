'use strict';
// Narrative house-style renderer and clipboard formatting — pure logic,
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
  const names = ['extractFields', 'renderTicketNarrative', 'renderTicketText',
    'renderTicketHTML', 'renderTicketParts'];
  const wrapped = body + '\n;({' + names.map((n) => n + ':' + n).join(',') + '});';
  const sandbox = { btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary') };
  vm.createContext(sandbox);
  return vm.runInContext(wrapped, sandbox, { filename: 'index.html (testable block)' });
}

const { extractFields, renderTicketNarrative, renderTicketText, renderTicketHTML } = loadTestable();

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


test('clipboard HTML keeps the ticket structured and escapes what users typed', () => {
  const t = "Ticket for Marla Bennett, Cincinnati office. She's getting the Duo push but it times out before she can approve it. I removed the orphaned device, re-enrolled her on the new phone, verified push on the first attempt. Resolved on first contact, about fifteen minutes.";
  const { fields, desc } = extractFields(t, 'Incident', 'P3');
  const take = { n: 1, template: 'Incident', priority: 'P3', fields, desc };

  const html = renderTicketHTML(take, 'Acme IT', 'Elijah');
  // headings survive so a paste into Google Docs is not one flat block
  assert.match(html, /<b>Acme IT · INCIDENT · P3<\/b>/);
  assert.match(html, /<p style=/);
  // plain-text flavour must stay available and carry the same facts
  const text = renderTicketText(take, 'Acme IT');
  assert.match(text, /Marla Bennett/);
  assert.match(html, /Marla Bennett/);
});

test('clipboard HTML cannot be broken by markup typed into a field', () => {
  const { fields, desc } = extractFields("Someone called about a printer.", 'Incident', 'P3');
  const hostile = fields.map((f) =>
    f.key === 'requester' ? Object.assign({}, f, { val: '<script>alert(1)</script> & "quoted"' }) : f);
  const html = renderTicketHTML({ n: 1, template: 'Incident', priority: 'P3', fields: hostile, desc }, 'ws', 'Elijah');
  assert.ok(!html.includes('<script>'), 'raw script tag must not reach the clipboard');
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});
