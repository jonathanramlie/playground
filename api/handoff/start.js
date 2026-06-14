const {
  buildHandoffStartResponse,
  getHandoffSecret,
} = require('../../src/handoff');
const { getOrigin, writeResponse } = require('./_utils');

module.exports = function handler(req, res) {
  writeResponse(
    res,
    buildHandoffStartResponse({
      secret: getHandoffSecret(),
      secure: true,
      origin: getOrigin(req),
    }),
  );
};
