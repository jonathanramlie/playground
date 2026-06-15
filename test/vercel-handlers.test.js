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

test('landing handler renders https check URL for Vercel host', () => {
  const handler = require('../api/aswebauth');
  const res = createResponse();

  handler(
    {
      headers: {
        host: 'playground-beige-ten.vercel.app',
        'x-forwarded-proto': 'http',
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /https:\/\/playground-beige-ten\.vercel\.app\/aswebauth\/check\?expected=/);
  assert.doesNotMatch(res.body, /http:\/\/playground-beige-ten\.vercel\.app\/aswebauth\/check\?expected=/);
});

test('start handler redirects to callback and sets nonce cookie', () => {
  const handler = require('../api/aswebauth/start');
  const res = createResponse();

  handler(
    {
      headers: {
        'x-forwarded-proto': 'https',
      },
    },
    res,
  );

  assert.equal(res.statusCode, 302);
  assert.match(res.headers.location, /^playgroundauth:\/\/callback\?nonce=/);
  assert.match(res.headers['set-cookie'], /^nonce=/);
  assert.match(res.headers['set-cookie'], /Secure/);
});

test('start handler renders delayed page when delayMs query is provided', () => {
  const handler = require('../api/aswebauth/start');
  const res = createResponse();

  handler(
    {
      query: { delayMs: '2000' },
      headers: {},
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(res.headers['set-cookie'], /^nonce=/);
  assert.match(res.body, /Continue to app/);
  assert.match(res.body, /2000/);
});

test('start handler renders manual-only page when autoRedirect is disabled', () => {
  const handler = require('../api/aswebauth/start');
  const res = createResponse();

  handler(
    {
      query: { autoRedirect: '0' },
      headers: {},
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(res.headers['set-cookie'], /^nonce=/);
  assert.match(res.body, /Automatic redirect is disabled/);
  assert.match(res.body, /Continue to app/);
  assert.doesNotMatch(res.body, /window.setTimeout/);
});

test('check handler renders missing cookie state', () => {
  const handler = require('../api/aswebauth/check');
  const res = createResponse();

  handler(
    {
      query: { expected: 'abc' },
      headers: {},
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /MISSING_OR_MISMATCH/);
  assert.match(res.body, /abc/);
});
