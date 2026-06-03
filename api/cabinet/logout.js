// POST /api/cabinet/logout
const { clearAuthCookie } = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
};
