const assert = require('node:assert/strict');
const test = require('node:test');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = '') {
      this.body = body;
    },
  };
}

test('handoff start handler sets pending cookie and renders app approval link', () => {
  const handler = require('../api/handoff/start');
  const res = createResponse();

  handler(
    {
      headers: { host: 'playground-211p.vercel.app' },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /^handoff_pending=/);
  assert.match(res.body, /Open app to approve/);
  assert.match(res.body, /playgroundauth:\/\/handoff\/approve\?tx=/);
});

test('handoff start handler supports autoOpen mode', () => {
  const handler = require('../api/handoff/start');
  const res = createResponse();

  handler(
    {
      query: { autoOpen: '1' },
      headers: { host: 'playground-211p.vercel.app' },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /^handoff_pending=/);
  assert.match(res.body, /Attempting to open the app automatically/);
  assert.match(res.body, /window.setTimeout/);
});

test('handoff approve handler returns complete URL', () => {
  const handler = require('../api/handoff/approve');
  const res = createResponse();

  handler(
    {
      method: 'POST',
      body: { tx: 'tx-123', nativeUser: 'demo-user' },
      headers: { host: 'playground-211p.vercel.app' },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');

  const body = JSON.parse(res.body);
  assert.match(body.completeUrl, /^https:\/\/playground-211p\.vercel\.app\/handoff\/complete\?approval=/);
});

test('handoff complete handler rejects missing pending cookie', () => {
  const approve = require('../api/handoff/approve');
  const complete = require('../api/handoff/complete');
  const approveRes = createResponse();

  approve(
    {
      method: 'POST',
      body: { tx: 'tx-123', nativeUser: 'demo-user' },
      headers: { host: 'playground-211p.vercel.app' },
    },
    approveRes,
  );

  const approval = JSON.parse(approveRes.body).approval;
  const completeRes = createResponse();

  complete(
    {
      query: { approval },
      headers: {},
    },
    completeRes,
  );

  assert.equal(completeRes.statusCode, 400);
  assert.match(completeRes.body, /HANDOFF_FAILED/);
});
