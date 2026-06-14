const {
  buildCheckResponse,
  getHandoffSecret,
} = require('../../src/handoff');
const { writeResponse } = require('./_utils');

module.exports = function handler(req, res) {
  writeResponse(
    res,
    buildCheckResponse({
      secret: getHandoffSecret(),
      cookieHeader: req.headers.cookie || '',
    }),
  );
};
