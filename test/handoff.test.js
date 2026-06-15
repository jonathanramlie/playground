const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildApproveResponse,
  buildCompleteResponse,
  buildHandoffStartResponse,
  parseCookies,
  verifySignedToken,
} = require('../src/handoff');

const secret = 'test-secret';
const now = 1_800_000_000_000;

test('buildHandoffStartResponse creates browser-owned pending cookie and app approval link', () => {
  const response = buildHandoffStartResponse({
    secret,
    secure: true,
    now,
    tx: 'tx-123',
    origin: 'https://playground-beige-ten.vercel.app',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(response.headers['set-cookie'], /^handoff_pending=/);
  assert.match(response.headers['set-cookie'], /HttpOnly/);
  assert.match(response.headers['set-cookie'], /SameSite=Lax/);
  assert.match(response.headers['set-cookie'], /Secure/);
  assert.match(response.body, /Open app to approve/);
  assert.match(response.body, /playgroundauth:\/\/handoff\/approve\?tx=tx-123/);

  const cookies = parseCookies(response.headers['set-cookie']);
  const pending = verifySignedToken(cookies.handoff_pending, secret);
  assert.equal(pending.tx, 'tx-123');
  assert.equal(pending.kind, 'handoff_pending');
});

test('buildHandoffStartResponse can auto-open the app with fallback button', () => {
  const response = buildHandoffStartResponse({
    secret,
    secure: true,
    now,
    tx: 'tx-auto',
    origin: 'https://playground-beige-ten.vercel.app',
    autoOpen: true,
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Attempting to open the app automatically/);
  assert.match(response.body, /Open app to approve/);
  assert.match(response.body, /window.setTimeout/);
  assert.match(response.body, /playgroundauth:\/\/handoff\/approve\?tx=tx-auto/);
});

test('buildApproveResponse returns an approval-bound complete URL', () => {
  const response = buildApproveResponse({
    secret,
    now,
    tx: 'tx-123',
    nativeUser: 'demo-user',
    origin: 'https://playground-beige-ten.vercel.app',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');

  const body = JSON.parse(response.body);
  assert.match(body.completeUrl, /^https:\/\/playground-beige-ten\.vercel\.app\/handoff\/complete\?approval=/);

  const approval = new URL(body.completeUrl).searchParams.get('approval');
  const payload = verifySignedToken(approval, secret);
  assert.equal(payload.tx, 'tx-123');
  assert.equal(payload.user, 'demo-user');
  assert.equal(payload.kind, 'handoff_approval');
});

test('buildCompleteResponse sets safari session when pending cookie matches approval', () => {
  const start = buildHandoffStartResponse({ secret, secure: true, now, tx: 'tx-123' });
  const pendingCookie = start.headers['set-cookie'].split(';')[0];
  const approval = JSON.parse(
    buildApproveResponse({ secret, now, tx: 'tx-123', nativeUser: 'demo-user' }).body,
  ).approval;

  const response = buildCompleteResponse({
    secret,
    now,
    secure: true,
    approval,
    cookieHeader: pendingCookie,
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.headers['set-cookie']));
  assert.match(response.headers['set-cookie'][0], /^safari_session=/);
  assert.match(response.headers['set-cookie'][1], /^handoff_pending=;/);
  assert.match(response.body, /HANDOFF_COMPLETE/);
  assert.match(response.body, /demo-user/);
});

test('buildCompleteResponse rejects approval without matching browser pending cookie', () => {
  const approval = JSON.parse(
    buildApproveResponse({ secret, now, tx: 'attacker-tx', nativeUser: 'attacker' }).body,
  ).approval;

  const response = buildCompleteResponse({
    secret,
    now,
    secure: true,
    approval,
    cookieHeader: '',
  });

  assert.equal(response.statusCode, 400);
  assert.doesNotMatch(String(response.headers['set-cookie'] || ''), /^safari_session=/);
  assert.match(response.body, /HANDOFF_FAILED/);
});

test('buildCompleteResponse rejects mismatched pending cookie and approval tx', () => {
  const start = buildHandoffStartResponse({ secret, secure: true, now, tx: 'victim-browser-tx' });
  const pendingCookie = start.headers['set-cookie'].split(';')[0];
  const approval = JSON.parse(
    buildApproveResponse({ secret, now, tx: 'attacker-tx', nativeUser: 'attacker' }).body,
  ).approval;

  const response = buildCompleteResponse({
    secret,
    now,
    secure: true,
    approval,
    cookieHeader: pendingCookie,
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /pending cookie does not match approval/);
});
