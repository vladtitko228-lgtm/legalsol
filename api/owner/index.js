// Единая функция кабинета владельца: /api/owner?action=login|me|logout|ingest|data
// Всё в одном файле — Hobby-план Vercel ограничен 12 serverless-функциями.
// Крипто/JWT/rate-limit — из api/cabinet/_helpers.js (через _owner.js, файл на "_" не считается функцией).
const crypto = require('crypto');
const O = require('./_owner');
const H = O.H;

const DUMMY = 'scrypt$' + '0'.repeat(32) + '$' + '0'.repeat(64);

function ingestTokenOk(got) {
  const want = O.INGEST_TOKEN;
  if (!want || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function doLogin(req, res) {
  if (!O.OWNER_HASH || O.OWNER_PHONES.size === 0) return res.status(500).json({ error: 'owner_not_configured' });
  const { phone, password } = await H.readJsonBody(req);
  if (!phone || !password) return res.status(400).json({ error: 'phone_and_password_required' });
  const norm = H.normalizePhone(phone);
  const ip = H.clientIp(req);
  if (await H.rateLimitBlocked(ip, norm)) {
    return res.status(429).json({ error: 'too_many_attempts', message: 'Слишком много попыток. Подождите 15 минут.' });
  }
  // Роли: владелец (env) или продавец (SELLERS). Холостой scrypt при промахе —
  // чтобы время ответа не выдавало, чей это номер.
  const seller = O.SELLERS[norm];
  let ok = false, jwtPayload = null;
  if (O.isOwnerPhone(norm)) {
    ok = H.verifyPassword(password, O.OWNER_HASH);
    jwtPayload = { role: 'owner' };
  } else if (seller) {
    ok = H.verifyPassword(password, seller.hash);
    jwtPayload = { role: 'seller', name: seller.name };
  } else {
    H.verifyPassword(password, DUMMY);
  }
  if (!ok) {
    await H.rateLimitFail(ip, norm);
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  await H.rateLimitReset(ip, norm);
  O.setOwnerCookie(res, H.signJwt(jwtPayload));
  return res.status(200).json({ ok: true, role: jwtPayload.role, name: jwtPayload.name || '' });
}

async function doIngest(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!ingestTokenOk(token)) return res.status(401).json({ error: 'unauthorized' });
  const body = await H.readJsonBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'bad_body' });
  const str = JSON.stringify(body);
  const ok = await O.kv('SET', O.KV_KEY, str);
  if (ok === null) return res.status(503).json({ error: 'kv_unavailable' });
  return res.status(200).json({ ok: true, bytes: str.length });
}

// Урезанный вид для продавца: только его метрики + счёт команды. Финансы (PnL),
// учредители, реклама целиком, общая дебиторка — НЕ отдаются с сервера вообще.
function sellerView(d, name) {
  const months = {};
  for (const [k, m] of Object.entries(d.months || {})) {
    const me = (m.bySeller || []).find(s => s.name === name) || null;
    const deals = (m.deals || []).filter(x => x.closer === name);
    months[k] = { key: k, goal: m.goal, closings: m.closings, contracted: m.contracted, me, deals };
  }
  const myItems = ((d.receivables || {}).items || []).filter(i => i.closer === name);
  return {
    role: 'seller', name,
    generatedAt: d.generatedAt, generatedLabel: d.generatedLabel, goal: d.goal,
    curMonthKey: d.curMonthKey, defaultMonth: d.defaultMonth, monthOrder: d.monthOrder,
    trend: d.trend, months,
    receivables: { count: myItems.length,
                   total: Math.round(myItems.reduce((s, i) => s + (i.remain || 0), 0)),
                   items: myItems.slice(0, 20) },
  };
}

async function doData(req, res) {
  const auth = O.requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'unauthorized' });
  const raw = await O.kv('GET', O.KV_KEY);
  res.setHeader('Cache-Control', 'no-store');
  if (!raw) return res.status(200).json({ empty: true });
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (auth.role === 'seller') return res.status(200).json(sellerView(d, auth.name));
    return res.status(200).json(d);
  } catch (_) { return res.status(200).json({ empty: true }); }
}

module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';
  try {
    switch (action) {
      case 'login':
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
        return await doLogin(req, res);
      case 'logout':
        O.clearOwnerCookie(res);
        return res.status(200).json({ ok: true });
      case 'me': {
        const a = O.requireAuth(req);
        if (!a) return res.status(401).json({ error: 'unauthorized' });
        return res.status(200).json({ ok: true, role: a.role, name: a.name || '' });
      }
      case 'ingest':
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
        return await doIngest(req, res);
      case 'data':
        return await doData(req, res);
      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    console.error('owner api err:', action, e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
