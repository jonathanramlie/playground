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
