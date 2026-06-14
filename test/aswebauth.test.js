const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CALLBACK_SCHEME,
  COOKIE_NAME,
  buildNonceCookie,
  buildStartResponse,
  normalizeDelayMs,
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

test('buildStartResponse can delay before custom-scheme redirect', () => {
  const response = buildStartResponse({
    nonce: 'abc-123',
    secure: true,
    delayMs: 2000,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.location, undefined);
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['set-cookie'].startsWith(`${COOKIE_NAME}=abc-123;`), true);
  assert.match(response.body, /2000/);
  assert.match(response.body, /Continue to app/);
  assert.match(response.body, new RegExp(`${CALLBACK_SCHEME}://callback\\?nonce=abc-123`));
});

test('buildStartResponse can disable automated redirect', () => {
  const response = buildStartResponse({
    nonce: 'manual-123',
    secure: true,
    manualOnly: true,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.location, undefined);
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(response.body, /Automatic redirect is disabled/);
  assert.match(response.body, /Continue to app/);
  assert.doesNotMatch(response.body, /window.setTimeout/);
  assert.match(response.body, new RegExp(`${CALLBACK_SCHEME}://callback\\?nonce=manual-123`));
});

test('normalizeDelayMs clamps invalid and excessive values', () => {
  assert.equal(normalizeDelayMs(undefined), 0);
  assert.equal(normalizeDelayMs('nope'), 0);
  assert.equal(normalizeDelayMs('-1'), 0);
  assert.equal(normalizeDelayMs('2000'), 2000);
  assert.equal(normalizeDelayMs('99999'), 10000);
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
