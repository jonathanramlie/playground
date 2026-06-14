const crypto = require('node:crypto');

const CALLBACK_SCHEME = 'playgroundauth';
const HANDOFF_PENDING_COOKIE = 'handoff_pending';
const SAFARI_SESSION_COOKIE = 'safari_session';
const DEFAULT_ORIGIN = 'https://playground-211p.vercel.app';
const DEFAULT_TTL_SECONDS = 300;

function createTx() {
  return crypto.randomUUID();
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createSignedToken(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function verifySignedToken(token, secret, { now = Date.now() } = {}) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('missing signed token');
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature || '', 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('invalid signed token signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (typeof payload.exp !== 'number' || payload.exp < now) {
    throw new Error('signed token expired');
  }

  return payload;
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

function buildCookie(name, value, { secure, maxAge = DEFAULT_TTL_SECONDS, sameSite = 'Lax' } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function clearCookie(name, { secure } = {}) {
  const parts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
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
      a[role="button"], button { display: inline-block; margin: 8px 0; padding: 10px 14px; border-radius: 8px; border: 1px solid ButtonBorder; background: ButtonFace; color: ButtonText; text-decoration: none; font: inherit; }
      code, pre { overflow-wrap: anywhere; }
      pre { padding: 16px; border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); border-radius: 8px; background: color-mix(in srgb, CanvasText 5%, transparent); white-space: pre-wrap; }
      .status { display: inline-block; padding: 4px 8px; border-radius: 999px; font-weight: 700; }
      .ok { background: #0a7f4230; color: #0a7f42; }
      .fail { background: #b4231830; color: #b42318; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function tokenExpiry(now, ttlSeconds = DEFAULT_TTL_SECONDS) {
  return now + ttlSeconds * 1000;
}

function buildHandoffStartResponse({
  secret,
  secure = true,
  now = Date.now(),
  tx = createTx(),
  origin = DEFAULT_ORIGIN,
} = {}) {
  const pending = createSignedToken(
    {
      kind: 'handoff_pending',
      tx,
      iat: now,
      exp: tokenExpiry(now),
    },
    secret,
  );
  const appUrl = `${CALLBACK_SCHEME}://handoff/approve?tx=${encodeURIComponent(tx)}&origin=${encodeURIComponent(origin)}`;

  return {
    tx,
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': buildCookie(HANDOFF_PENDING_COOKIE, pending, { secure }),
    },
    body: page(
      'Browser-owned handoff',
      `<h1>Browser-owned handoff</h1>
<p>This Safari/browser page owns a pending transaction. The app can approve it, but the approval can only complete in this browser if the pending cookie matches.</p>
<p><a role="button" href="${escapeHtml(appUrl)}">Open app to approve</a></p>
<h2>Debug</h2>
<pre>browser_tx=${escapeHtml(tx)}</pre>`,
    ),
  };
}

function buildApproveResponse({
  secret,
  now = Date.now(),
  tx,
  nativeUser = 'demo-native-user',
  origin = DEFAULT_ORIGIN,
} = {}) {
  if (!tx) {
    return jsonResponse(400, { error: 'missing tx' });
  }

  const approval = createSignedToken(
    {
      kind: 'handoff_approval',
      tx,
      user: nativeUser,
      iat: now,
      exp: tokenExpiry(now),
    },
    secret,
  );

  return jsonResponse(200, {
    approval,
    completeUrl: `${origin}/handoff/complete?approval=${encodeURIComponent(approval)}`,
  });
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(data),
  };
}

function buildCompleteResponse({
  secret,
  now = Date.now(),
  secure = true,
  approval,
  cookieHeader = '',
} = {}) {
  try {
    const cookies = parseCookies(cookieHeader);
    const pendingToken = cookies[HANDOFF_PENDING_COOKIE];

    if (!pendingToken) {
      throw new Error('missing browser pending cookie');
    }

    const pending = verifySignedToken(pendingToken, secret, { now });
    const approved = verifySignedToken(approval, secret, { now });

    if (pending.kind !== 'handoff_pending') {
      throw new Error('invalid pending token kind');
    }

    if (approved.kind !== 'handoff_approval') {
      throw new Error('invalid approval token kind');
    }

    if (pending.tx !== approved.tx) {
      throw new Error('pending cookie does not match approval');
    }

    const session = createSignedToken(
      {
        kind: 'safari_session',
        tx: approved.tx,
        user: approved.user,
        iat: now,
        exp: tokenExpiry(now, 3600),
      },
      secret,
    );

    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': [
          buildCookie(SAFARI_SESSION_COOKIE, session, { secure, maxAge: 3600 }),
          clearCookie(HANDOFF_PENDING_COOKIE, { secure }),
        ],
      },
      body: page(
        'Handoff complete',
        `<h1>Handoff complete</h1>
<p class="status ok">HANDOFF_COMPLETE</p>
<p>Safari/browser session created for <strong>${escapeHtml(approved.user)}</strong>.</p>
<p><a href="/handoff/check">Check Safari session cookie</a></p>`,
      ),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: page(
        'Handoff failed',
        `<h1>Handoff failed</h1>
<p class="status fail">HANDOFF_FAILED</p>
<pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>
<p><a href="/handoff/start">Start over</a></p>`,
      ),
    };
  }
}

function buildCheckResponse({ secret, now = Date.now(), cookieHeader = '' } = {}) {
  try {
    const cookies = parseCookies(cookieHeader);
    const session = verifySignedToken(cookies[SAFARI_SESSION_COOKIE], secret, { now });

    if (session.kind !== 'safari_session') {
      throw new Error('invalid session token kind');
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: page(
        'Safari session check',
        `<h1>Safari session check</h1>
<p class="status ok">SAFARI_SESSION_PRESENT</p>
<pre>user=${escapeHtml(session.user)}\ntx=${escapeHtml(session.tx)}</pre>`,
      ),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: page(
        'Safari session check',
        `<h1>Safari session check</h1>
<p class="status fail">SAFARI_SESSION_MISSING</p>
<pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>`,
      ),
    };
  }
}

function getHandoffSecret() {
  return process.env.HANDOFF_SECRET || 'playground-dev-only-handoff-secret-change-me';
}

module.exports = {
  CALLBACK_SCHEME,
  HANDOFF_PENDING_COOKIE,
  SAFARI_SESSION_COOKIE,
  buildApproveResponse,
  buildCheckResponse,
  buildCompleteResponse,
  buildHandoffStartResponse,
  createSignedToken,
  getHandoffSecret,
  parseCookies,
  verifySignedToken,
};
