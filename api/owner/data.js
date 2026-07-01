// GET /api/owner/data → агрегат дашборда из KV (только для owner-сессии).
const O = require('./_owner');

module.exports = async function handler(req, res) {
  if (!O.requireOwner(req)) return res.status(401).json({ error: 'unauthorized' });
  const raw = await O.kv('GET', O.KV_KEY);
  res.setHeader('Cache-Control', 'no-store');
  if (!raw) return res.status(200).json({ empty: true });
  try {
    return res.status(200).json(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch (_) {
    return res.status(200).json({ empty: true });
  }
};
