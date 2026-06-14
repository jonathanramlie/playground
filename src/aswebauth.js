const crypto = require('node:crypto');

const CALLBACK_SCHEME = 'playgroundauth';
const COOKIE_NAME = 'nonce';
const COOKIE_MAX_AGE_SECONDS = 600;

function createNonce() {
  return crypto.randomUUID();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const equalsIndex = part.indexOf('=');
      const rawName = equalsIndex === -1 ? part : part.slice(0, equalsIndex);
      const rawValue = equalsIndex === -1 ? '' : part.slice(equalsIndex + 1);

      if (!rawName) {
        return cookies;
      }

      try {
        cookies[decodeURIComponent(rawName)] = decodeURIComponent(rawValue);
      } catch (_error) {
        cookies[rawName] = rawValue;
      }

      return cookies;
    }, {});
}

function readNonceFromCookieHeader(cookieHeader = '') {
  return parseCookies(cookieHeader)[COOKIE_NAME] || null;
}

function buildNonceCookie(nonce, { secure } = { secure: true }) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(nonce)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function buildStartResponse({ nonce = createNonce(), secure = true } = {}) {
  return {
    nonce,
    statusCode: 302,
    headers: {
      location: `${CALLBACK_SCHEME}://callback?nonce=${encodeURIComponent(nonce)}`,
      'set-cookie': buildNonceCookie(nonce, { secure }),
      'cache-control': 'no-store',
    },
  };
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: Canvas; color: CanvasText; }
      main { box-sizing: border-box; width: min(920px, 100%); margin: 0 auto; padding: 32px 20px; }
      code, pre { overflow-wrap: anywhere; }
      pre { padding: 16px; border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); border-radius: 8px; background: color-mix(in srgb, CanvasText 5%, transparent); white-space: pre-wrap; }
      .status { display: inline-block; padding: 4px 8px; border-radius: 999px; font-weight: 700; }
      .match { background: #0a7f4230; color: #0a7f42; }
      .miss { background: #b4231830; color: #b42318; }
      dl { display: grid; grid-template-columns: 170px 1fr; gap: 8px 16px; }
      dt { font-weight: 700; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function renderLandingPage({ origin = 'https://playground.natum.dev' } = {}) {
  return page(
    'ASWebAuthenticationSession Cookie POC',
    `<h1>ASWebAuthenticationSession Cookie POC</h1>
<p>This page starts a flow that sets a server-side <code>${COOKIE_NAME}=&lt;uuid&gt;</code> cookie, redirects to <code>${CALLBACK_SCHEME}://callback</code>, and lets the iOS app open the check page in the external browser.</p>
<p><a href="/aswebauth/start">Start auth-cookie flow</a></p>
<p>Check endpoint format: <code>${escapeHtml(origin)}/aswebauth/check?expected=&lt;nonce&gt;</code></p>`,
  );
}

function renderCheckPage({ expected = '', cookieHeader = '' } = {}) {
  const cookieNonce = readNonceFromCookieHeader(cookieHeader);
  const hasExpected = expected.length > 0;
  const matched = hasExpected && cookieNonce === expected;
  const statusText = matched ? 'MATCH' : 'MISSING_OR_MISMATCH';

  return page(
    'ASWebAuthenticationSession Cookie Check',
    `<h1>ASWebAuthenticationSession Cookie Check</h1>
<p class="status ${matched ? 'match' : 'miss'}">${statusText}</p>
<dl>
  <dt>Expected nonce</dt>
  <dd><code>${escapeHtml(expected || '(missing expected query)')}</code></dd>
  <dt>Cookie nonce</dt>
  <dd><code>${escapeHtml(cookieNonce || '(nonce cookie not received)')}</code></dd>
  <dt>Cookie matches</dt>
  <dd>${matched ? 'Yes' : 'No'}</dd>
</dl>
<h2>Raw Cookie header</h2>
<pre>${escapeHtml(cookieHeader || '(empty Cookie header)')}</pre>
<p><a href="/aswebauth">Back to POC landing page</a></p>`,
  );
}

function isSecureRequest(req) {
  return req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket && req.socket.encrypted);
}

module.exports = {
  CALLBACK_SCHEME,
  COOKIE_NAME,
  buildNonceCookie,
  buildStartResponse,
  createNonce,
  isSecureRequest,
  parseCookies,
  readNonceFromCookieHeader,
  renderCheckPage,
  renderLandingPage,
};
