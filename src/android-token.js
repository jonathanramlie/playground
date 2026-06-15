const COOKIE_NAME = 'android_nonce';
const COOKIE_MAX_AGE_SECONDS = 600;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeNonce(value) {
  const nonce = String(firstValue(value) ?? '').trim();

  if (!nonce || nonce.length > 200) {
    return '';
  }

  return nonce;
}

function parseRequestBody(body) {
  if (!body) {
    return {};
  }

  if (Buffer.isBuffer(body)) {
    return parseRequestBody(body.toString('utf8'));
  }

  if (typeof body === 'string') {
    return Object.fromEntries(new URLSearchParams(body));
  }

  if (typeof body === 'object') {
    return body;
  }

  return {};
}

function buildAndroidNonceCookie(nonce, { secure = true } = {}) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(nonce)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
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
      .ok { background: #0a7f4230; color: #0a7f42; }
      .fail { background: #b4231830; color: #b42318; }
      dl { display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; }
      dt { font-weight: 700; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function renderReceivePage({ receivedNonce }) {
  const data = {
    cookieName: COOKIE_NAME,
    receivedNonce,
  };

  return page(
    'Android token received',
    `<h1>Android token received</h1>
<p id="status" class="status">Reading cookie in browser JavaScript…</p>
<p>The server received the POST body and set <code>${COOKIE_NAME}</code>. The cookie value below is rendered by client-side JavaScript from <code>document.cookie</code>.</p>
<dl>
  <dt>POST nonce</dt>
  <dd><code id="receivedNonce">(client render pending)</code></dd>
  <dt>Cookie nonce</dt>
  <dd><code id="cookieNonce">(client render pending)</code></dd>
  <dt>Cookie matches POST</dt>
  <dd id="cookieMatches">(client render pending)</dd>
</dl>
<h2>document.cookie</h2>
<pre id="rawCookie">(client render pending)</pre>
<script id="android-token-data" type="application/json">${scriptJson(data)}</script>
<script>
  (function () {
    function parseCookies(cookieText) {
      return cookieText.split(';').map(function (part) {
        return part.trim();
      }).filter(Boolean).reduce(function (cookies, part) {
        var equalsIndex = part.indexOf('=');
        var name = equalsIndex === -1 ? part : part.slice(0, equalsIndex);
        var value = equalsIndex === -1 ? '' : part.slice(equalsIndex + 1);
        try {
          cookies[decodeURIComponent(name)] = decodeURIComponent(value);
        } catch (error) {
          cookies[name] = value;
        }
        return cookies;
      }, {});
    }

    var data = JSON.parse(document.getElementById('android-token-data').textContent);
    var rawCookie = document.cookie || '';
    var cookies = parseCookies(rawCookie);
    var cookieNonce = cookies[data.cookieName] || '';
    var matches = cookieNonce === data.receivedNonce;

    document.getElementById('receivedNonce').textContent = data.receivedNonce || '(missing)';
    document.getElementById('cookieNonce').textContent = cookieNonce || '(cookie not visible to JavaScript)';
    document.getElementById('cookieMatches').textContent = matches ? 'Yes' : 'No';
    document.getElementById('rawCookie').textContent = rawCookie || '(document.cookie is empty)';

    var status = document.getElementById('status');
    status.textContent = matches ? 'COOKIE_MATCH' : 'COOKIE_MISSING_OR_MISMATCH';
    status.classList.add(matches ? 'ok' : 'fail');
  }());
</script>`,
  );
}

function renderMissingNoncePage() {
  return page(
    'Android token missing',
    `<h1>Android token missing</h1>
<p class="status fail">MISSING_NONCE</p>
<p>Submit this endpoint with a POST form body containing <code>nonce=&lt;uuid&gt;</code>.</p>`,
  );
}

function buildReceiveResponse({ nonce, secure = true } = {}) {
  const receivedNonce = normalizeNonce(nonce);

  if (!receivedNonce) {
    return {
      statusCode: 400,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: renderMissingNoncePage(),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': buildAndroidNonceCookie(receivedNonce, { secure }),
    },
    body: renderReceivePage({ receivedNonce }),
  };
}

function buildMethodNotAllowedResponse() {
  return {
    statusCode: 405,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      allow: 'POST',
    },
    body: 'Method not allowed. Submit nonce with POST.',
  };
}

module.exports = {
  COOKIE_NAME,
  buildAndroidNonceCookie,
  buildMethodNotAllowedResponse,
  buildReceiveResponse,
  parseRequestBody,
};
