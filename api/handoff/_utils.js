function getOrigin(req) {
  const host = req.headers.host || 'playground-beige-ten.vercel.app';
  return `https://${host}`;
}

function firstQueryValue(query, name) {
  const value = query && query[name];
  return Array.isArray(value) ? value[0] : value;
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
  firstQueryValue,
  getBody,
  getOrigin,
  writeResponse,
};
