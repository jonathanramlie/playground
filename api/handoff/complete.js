const {
  buildCompleteResponse,
  getHandoffSecret,
} = require('../../src/handoff');
const { writeResponse } = require('./_utils');

function firstQueryValue(query, name) {
  const value = query && query[name];
  return Array.isArray(value) ? value[0] : value;
}

module.exports = function handler(req, res) {
  writeResponse(
    res,
    buildCompleteResponse({
      secret: getHandoffSecret(),
      secure: true,
      approval: firstQueryValue(req.query, 'approval'),
      cookieHeader: req.headers.cookie || '',
    }),
  );
};
