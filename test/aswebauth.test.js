const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CALLBACK_SCHEME,
  COOKIE_NAME,
  buildNonceCookie,
  buildStartResponse,
  parseCookies,
  readNonceFromCookieHeader,
  renderCheckPage,
} = require('../src/aswebauth');

test('parseCookies decodes multiple cookies', () => {
  assert.deepEqual(parseCookies('theme=dark; nonce=abc%20123; empty='), {
    theme: 'dark',
    nonce: 'abc 123',
    empty: '',
  });
});

test('readNonceFromCookieHeader returns null when nonce is missing', () => {
  assert.equal(readNonceFromCookieHeader('other=value'), null);
});

test('buildNonceCookie creates secure production cookie', () => {
  const cookie = buildNonceCookie('123e4567-e89b-12d3-a456-426614174000', {
    secure: true,
  });

  assert.equal(
    cookie,
    'nonce=123e4567-e89b-12d3-a456-426614174000; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure',
  );
});

test('buildNonceCookie omits Secure for local HTTP', () => {
  const cookie = buildNonceCookie('local-nonce', { secure: false });

  assert.equal(
    cookie,
    'nonce=local-nonce; Path=/; Max-Age=600; HttpOnly; SameSite=Lax',
  );
});

test('buildStartResponse sets nonce cookie and custom-scheme redirect', () => {
  const response = buildStartResponse({ nonce: 'abc-123', secure: true });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, `${CALLBACK_SCHEME}://callback?nonce=abc-123`);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['set-cookie'].startsWith(`${COOKIE_NAME}=abc-123;`), true);
});

test('renderCheckPage reports a nonce match', () => {
  const html = renderCheckPage({
    expected: 'expected-nonce',
    cookieHeader: 'nonce=expected-nonce',
  });

  assert.match(html, /MATCH/);
  assert.match(html, /expected-nonce/);
});

test('renderCheckPage escapes unsafe expected values', () => {
  const html = renderCheckPage({
    expected: '<script>alert(1)</script>',
    cookieHeader: '',
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
});
