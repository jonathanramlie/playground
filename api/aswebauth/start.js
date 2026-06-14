const { buildStartResponse } = require('../../src/aswebauth');

function firstQueryValue(query, name) {
  const value = query && query[name];
  return Array.isArray(value) ? value[0] : value;
}

module.exports = function handler(req, res) {
  const response = buildStartResponse({
    secure: true,
    delayMs: firstQueryValue(req.query, 'delayMs'),
    manualOnly: firstQueryValue(req.query, 'autoRedirect') === '0',
  });

  res.statusCode = response.statusCode;
  Object.entries(response.headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });
  res.end(response.body);
};
