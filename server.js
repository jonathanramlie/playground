const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
  buildStartResponse,
  isSecureRequest,
  renderCheckPage,
  renderLandingPage,
} = require('./src/aswebauth');
const {
  buildApproveResponse,
  buildCheckResponse,
  buildCompleteResponse,
  buildHandoffStartResponse,
  getHandoffSecret,
} = require('./src/handoff');

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');

const routes = new Map([
  ['/', 'index.html'],
  ['/poc-cred-include', 'poc-cred-include.html'],
]);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

function writeHtml(res, body) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function writeResponse(res, response) {
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_error) {
    return {};
  }
}

async function serveStatic(fileName, res) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  const body = await fs.readFile(filePath);
  const ext = path.extname(filePath);

  res.writeHead(200, {
    'content-type': contentTypes.get(ext) || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/aswebauth') {
      writeHtml(res, renderLandingPage({ origin: url.origin }));
      return;
    }

    if (url.pathname === '/aswebauth/start') {
      const response = buildStartResponse({
        secure: isSecureRequest(req),
        delayMs: url.searchParams.get('delayMs'),
        manualOnly: url.searchParams.get('autoRedirect') === '0',
      });
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
      return;
    }

    if (url.pathname === '/aswebauth/check') {
      writeHtml(
        res,
        renderCheckPage({
          expected: url.searchParams.get('expected') || '',
          cookieHeader: req.headers.cookie || '',
        }),
      );
      return;
    }

    if (url.pathname === '/handoff/start') {
      writeResponse(
        res,
        buildHandoffStartResponse({
          secret: getHandoffSecret(),
          secure: isSecureRequest(req),
          origin: url.origin,
          autoOpen: url.searchParams.get('autoOpen') === '1',
        }),
      );
      return;
    }

    if (url.pathname === '/handoff/approve') {
      const body = await readJsonBody(req);
      writeResponse(
        res,
        buildApproveResponse({
          secret: getHandoffSecret(),
          tx: body.tx,
          nativeUser: body.nativeUser || 'demo-native-user',
          origin: url.origin,
        }),
      );
      return;
    }

    if (url.pathname === '/handoff/complete') {
      writeResponse(
        res,
        buildCompleteResponse({
          secret: getHandoffSecret(),
          secure: isSecureRequest(req),
          approval: url.searchParams.get('approval'),
          cookieHeader: req.headers.cookie || '',
        }),
      );
      return;
    }

    if (url.pathname === '/handoff/check') {
      writeResponse(
        res,
        buildCheckResponse({
          secret: getHandoffSecret(),
          cookieHeader: req.headers.cookie || '',
        }),
      );
      return;
    }

    const fileName = routes.get(url.pathname);

    if (!fileName) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    await serveStatic(fileName, res);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(error instanceof Error ? error.message : 'Internal server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`playground-web listening at http://${HOST}:${PORT}`);
  console.log(`Credential include PoC: http://${HOST}:${PORT}/poc-cred-include`);
  console.log(`ASWebAuthenticationSession PoC: http://${HOST}:${PORT}/aswebauth`);
  console.log(`Browser-owned handoff PoC: http://${HOST}:${PORT}/handoff/start`);
});
