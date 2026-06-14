const { buildStartResponse } = require('../../src/aswebauth');

module.exports = function handler(req, res) {
  const response = buildStartResponse({ secure: true });

  res.statusCode = response.statusCode;
  Object.entries(response.headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });
  res.end('Redirecting to app callback.');
};
