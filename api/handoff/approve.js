const {
  buildApproveResponse,
  getHandoffSecret,
} = require('../../src/handoff');
const { getBody, getOrigin, writeResponse } = require('./_utils');

module.exports = function handler(req, res) {
  const body = getBody(req);

  writeResponse(
    res,
    buildApproveResponse({
      secret: getHandoffSecret(),
      tx: body.tx,
      nativeUser: body.nativeUser || 'demo-native-user',
      origin: getOrigin(req),
    }),
  );
};
