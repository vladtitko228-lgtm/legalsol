// POST /api/owner/logout → сброс owner-куки.
const O = require('./_owner');

module.exports = async function handler(req, res) {
  O.clearOwnerCookie(res);
  return res.status(200).json({ ok: true });
};
