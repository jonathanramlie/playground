function getOrigin(req) {
  const host = req.headers.host || 'playground-211p.vercel.app';
  return `https://${host}`;
}

function getBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }

  return req.body;
}

function writeResponse(res, response) {
  res.statusCode = response.statusCode;
  Object.entries(response.headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });
  res.end(response.body);
}

module.exports = {
  getBody,
  getOrigin,
  writeResponse,
};
