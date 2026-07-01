// GET /api/owner/me → 200 если валидная owner-сессия, иначе 401.
const O = require('./_owner');

module.exports = async function handler(req, res) {
  if (!O.requireOwner(req)) return res.status(401).json({ error: 'unauthorized' });
  return res.status(200).json({ ok: true, role: 'owner' });
};
