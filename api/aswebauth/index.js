const { renderLandingPage } = require('../../src/aswebauth');

module.exports = function handler(req, res) {
  const host = req.headers.host || 'playground.natum.dev';
  const proto = req.headers['x-forwarded-proto'] || 'https';

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(renderLandingPage({ origin: `${proto}://${host}` }));
};
