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

function buildCallbackUrl(nonce) {
  return `${CALLBACK_SCHEME}://callback?nonce=${encodeURIComponent(nonce)}`;
}

function normalizeDelayMs(value) {
  const delayMs = Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return 0;
  }

  return Math.min(delayMs, 10000);
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function buildStartResponse({ nonce = createNonce(), secure = true, delayMs = 0 } = {}) {
  const normalizedDelayMs = normalizeDelayMs(delayMs);
  const callbackUrl = buildCallbackUrl(nonce);
  const baseHeaders = {
    'set-cookie': buildNonceCookie(nonce, { secure }),
    'cache-control': 'no-store',
  };

  if (normalizedDelayMs > 0) {
    return {
      nonce,
      statusCode: 200,
      headers: {
        ...baseHeaders,
        'content-type': 'text/html; charset=utf-8',
      },
      body: renderDelayedStartPage({ callbackUrl, delayMs: normalizedDelayMs }),
    };
  }

  return {
    nonce,
    statusCode: 302,
    headers: {
      ...baseHeaders,
      location: callbackUrl,
    },
    body: 'Redirecting to app callback.',
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

function renderLandingPage({ origin = 'https://playground-211p.vercel.app' } = {}) {
  return page(
    'ASWebAuthenticationSession Cookie POC',
    `<h1>ASWebAuthenticationSession Cookie POC</h1>
<p>This page starts a flow that sets a server-side <code>${COOKIE_NAME}=&lt;uuid&gt;</code> cookie, redirects to <code>${CALLBACK_SCHEME}://callback</code>, and lets the iOS app open the check page in the external browser.</p>
<p><a href="/aswebauth/start?delayMs=2000">Start auth-cookie flow with 2s delay</a></p>
<p><a href="/aswebauth/start">Start auth-cookie flow without delay</a></p>
<p>Check endpoint format: <code>${escapeHtml(origin)}/aswebauth/check?expected=&lt;nonce&gt;</code></p>`,
  );
}

function renderDelayedStartPage({ callbackUrl, delayMs }) {
  return page(
    'Returning to app',
    `<h1>Cookie set</h1>
<p>The <code>${COOKIE_NAME}</code> cookie has been set. This page will return to the app after <strong>${delayMs}ms</strong>.</p>
<p>You can also tap the button below to return immediately. Tapping may help test whether first-party user interaction changes browser cookie behavior.</p>
<p><a id="continueLink" href="${escapeHtml(callbackUrl)}" role="button">Continue to app</a></p>
<script>
  const callbackUrl = ${scriptJson(callbackUrl)};
  window.setTimeout(() => {
    window.location.href = callbackUrl;
  }, ${delayMs});
</script>`,
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
  normalizeDelayMs,
  parseCookies,
  readNonceFromCookieHeader,
  renderCheckPage,
  renderLandingPage,
};
