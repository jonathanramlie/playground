const { renderCheckPage } = require('../../src/aswebauth');

module.exports = function handler(req, res) {
  const expected = Array.isArray(req.query && req.query.expected)
    ? req.query.expected[0]
    : (req.query && req.query.expected) || '';

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(
    renderCheckPage({
      expected,
      cookieHeader: req.headers.cookie || '',
    }),
  );
};
