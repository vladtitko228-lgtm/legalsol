// POST /api/owner/ingest  (Bearer OWNER_INGEST_TOKEN) → пишет агрегат в KV.
// Сюда шлёт локальный build_dashboard.py --push. Клиентские ПДн не передаются.
const crypto = require('crypto');
const O = require('./_owner');
const H = O.H;

function tokenOk(got) {
  const want = O.INGEST_TOKEN;
  if (!want || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tokenOk(token)) return res.status(401).json({ error: 'unauthorized' });

  try {
    const body = await H.readJsonBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'bad_body' });
    }
    const str = JSON.stringify(body);
    const ok = await O.kv('SET', O.KV_KEY, str);
    if (ok === null) return res.status(503).json({ error: 'kv_unavailable' });
    return res.status(200).json({ ok: true, bytes: str.length });
  } catch (e) {
    console.error('owner ingest err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
