'use strict';
// Loads the pure extractor logic straight out of index.html (the block
// between __TESTABLE_START__ / __TESTABLE_END__) and exercises it against
// real dictations that tripped up extractFields. No DOM needed.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadTestable() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('/* __TESTABLE_START__');
  const end = html.indexOf('/* __TESTABLE_END__');
  if (start === -1 || end === -1) {
    throw new Error('__TESTABLE_START__/__TESTABLE_END__ markers not found in index.html');
  }
  const body = html.slice(start, end);
  const names = ['extractFields', 'numWord', 'sentences', 'cleanSent', 'clip', 'fmap',
    'renderTicketParts', 'renderTicketText'];
  const wrapped = body + '\n;({' + names.map((n) => n + ':' + n).join(',') + '});';
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(wrapped, sandbox, { filename: 'index.html (testable block)' });
}

const { extractFields } = loadTestable();

function val(fields, key) {
  const f = fields.find((x) => x.key === key);
  return f ? f.val : undefined;
}

test('VPN symptom with "authentication failed" categorizes as VPN, not MFA; cause strips its lead-in', () => {
  const t = "Okay so this is for Dave Kowalski over in the Akron office, he called in about twenty minutes ago. His laptop won't connect to the VPN, keeps saying authentication failed. I checked and his cert had expired. Renewed it, tested the tunnel, he's good now. Call it a P2, took me maybe twenty five minutes.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), 'Dave Kowalski');
  assert.equal(val(fields, 'office'), 'Akron');
  assert.equal(val(fields, 'category'), 'Network · VPN');
  assert.equal(val(fields, 'cause'), 'His cert had expired');
  assert.equal(val(fields, 'priority'), 'P2');
});

test('sentence-initial name with no cue word ("X can\'t...") is still picked up as requester', () => {
  const t = "Jennifer Ramos can't get into SharePoint, says access denied on the finance site. Turned out she got dropped from the security group during the reorg. Added her back, verified she can open it. P3, ten minutes.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), 'Jennifer Ramos');
  assert.equal(val(fields, 'category'), 'Software');
});

test('"stopped" reads as a symptom so short description is not the bare header sentence', () => {
  const t = "Ticket for Tom Bradley. His docking station stopped charging the laptop. Asset tag DL-88421. Swapped the dock, confirmed charging. Fifteen minutes, priority three.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'short'), 'His docking station stopped charging the laptop');
  assert.equal(val(fields, 'category'), 'Hardware');
});

test('regression: Outlook crash dictation with an explicit root cause still extracts cleanly', () => {
  const t = "This is for Priya Nair at the Denver campus. Outlook kept crashing on launch. I cleared the OST, rebuilt the profile, reinstalled the Office click to run, and confirmed mail flow. Root cause was a corrupt local profile. About an hour. P2.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), 'Priya Nair');
  assert.equal(val(fields, 'office'), 'Denver');
  assert.equal(val(fields, 'category'), 'Email · Exchange');
  assert.equal(val(fields, 'cause'), 'Root cause was a corrupt local profile');
  assert.equal(val(fields, 'priority'), 'P2');
});

test('sentence-initial name ("X reported...") is picked up; "hung" reads as a root cause', () => {
  const t = "Marcus Webb reported the shared printer on floor two is offline. The print spooler had hung. Restarted the spooler service and cleared the queue. Two hours total, priority four.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), 'Marcus Webb');
  assert.equal(val(fields, 'cause'), 'Print spooler had hung');
});

test('sentence-initial name ("X says...") is picked up as requester', () => {
  const t = "Sarah Okonkwo says her monitor flickers whenever she docks. I reseated the cable and updated the display driver. Seems resolved on first contact. Took about eight minutes.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), 'Sarah Okonkwo');
});

test('Request template: category weighs the request/resolution sentence over an incidental "in email" mention; short description is not the header', () => {
  const t = "Request for Alan Chen. He needs access to the Tableau reporting workspace for the quarterly close. His manager approved it in email. I granted the license and confirmed he can sign in. Twenty minutes.";
  const { fields } = extractFields(t, 'Request', 'P3');
  assert.equal(val(fields, 'category'), 'Software');
  assert.equal(val(fields, 'short'), 'He needs access to the Tableau reporting workspace for the quarterly close');
  assert.equal(val(fields, 'requested'), 'He needs access to the Tableau reporting workspace for the quarterly close');
});

test('"corrected" reads as a resolution action; "was wrong" reads as a root cause', () => {
  const t = "I got a call from Nina Patel in the Boston office about her phone not receiving MFA codes. Her number was wrong in the directory. Corrected the number and tested a push. P3, resolved on first contact, twelve minutes.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), 'Nina Patel');
  assert.equal(val(fields, 'resolution'), 'Corrected the number and tested a push');
  assert.equal(val(fields, 'cause'), 'Her number was wrong in the directory');
});

test('extractor never invents a value for a field that was not said', () => {
  const t = "Someone called about something broken. Not sure what office.";
  const { fields } = extractFields(t, 'Incident', 'P3');
  assert.equal(val(fields, 'requester'), '');
  assert.equal(val(fields, 'office'), '');
  assert.equal(val(fields, 'asset'), '');
});
