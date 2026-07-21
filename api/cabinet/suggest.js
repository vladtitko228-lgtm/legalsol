// ============================================================
// /api/cabinet/suggest — предложения клиентов по кабинету.
//
// POST (публичный, кнопка «Suggest an improvement» в кабинете):
//   body { text, hp?, page? }  →  очередь в KV (list suggest:q)
//   Антиспам: honeypot (hp), ≤600 символов, 1 запрос / 45 сек с IP,
//   очередь ограничена 300 записями. Если клиент залогинен
//   (cookie cabinet_token) — прикладываем его Kommo contact id.
//
// GET (бот кабинета, Bearer BOT_RELAY_SECRET):
//   ?take=N  →  снимает до N записей из очереди: { items:[{t,who,page,at}] }
//   Бот шлёт их команде в Telegram (suggestwatch.js).
// ============================================================
'use strict';
const crypto = require('crypto');
const { verifyJwt, readCookie, readJsonBody, clientIp } = require('./_helpers');

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
// Секрет бота: основной — BOT_RELAY_SECRET; METRICS_INGEST_TOKEN — запасной
// (оба машинные, уже живут в Vercel env; клиентам не выдаются).
const SECRETS = [process.env.BOT_RELAY_SECRET, process.env.METRICS_INGEST_TOKEN].filter(Boolean);

async function kvCmd(...cmd) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return null;
    return (await r.json()).result;
  } catch (e) { return null; }
}

function tokenOk(got) {
  const g = Buffer.from(String(got || ''));
  return SECRETS.some(s => {
    const b = Buffer.from(String(s));
    return g.length === b.length && crypto.timingSafeEqual(g, b);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return res.status(400).json({ error: 'bad_json' }); }
    if (body.hp) return res.status(200).json({ ok: true }); // honeypot — молча «ок»
    const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (text.length < 3) return res.status(400).json({ error: 'empty' });

    const ip = clientIp(req);
    const rl = await kvCmd('SET', `sug:rl:${ip}`, '1', 'EX', '45', 'NX');
    if (rl !== null && rl !== 'OK') return res.status(429).json({ error: 'slow_down' });

    let who = 'demo';
    const tok = readCookie(req, 'cabinet_token');
    if (tok) {
      const p = verifyJwt(tok);
      if (p && p.staff) who = 'staff:' + (p.name || '');
      else if (p && p.cid) who = 'cid:' + p.cid;
    }
    const item = JSON.stringify({ t: text, who, page: String(body.page || '').slice(0, 80), at: Date.now() });
    const pushed = await kvCmd('LPUSH', 'suggest:q', item);
    if (pushed === null) return res.status(503).json({ error: 'storage_unavailable' });
    await kvCmd('LTRIM', 'suggest:q', '0', '299');
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!SECRETS.length || !tokenOk(auth)) return res.status(403).json({ error: 'forbidden' });
    const take = Math.min(50, Math.max(1, parseInt(req.query?.take, 10) || 10));
    const items = [];
    for (let i = 0; i < take; i++) {
      const v = await kvCmd('RPOP', 'suggest:q');
      if (!v) break;
      try { items.push(JSON.parse(v)); } catch (_) {}
    }
    return res.status(200).json({ items });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
