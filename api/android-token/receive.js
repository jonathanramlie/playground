const {
  buildMethodNotAllowedResponse,
  buildReceiveResponse,
  parseRequestBody,
} = require('../../src/android-token');

function writeResponse(res, response) {
  res.statusCode = response.statusCode;
  Object.entries(response.headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });
  res.end(response.body);
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    writeResponse(res, buildMethodNotAllowedResponse());
    return;
  }

  const body = parseRequestBody(req.body);
  writeResponse(
    res,
    buildReceiveResponse({
      nonce: body.nonce,
      secure: true,
    }),
  );
};
