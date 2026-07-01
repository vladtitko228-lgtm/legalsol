// Хелперы кабинета ВЛАДЕЛЬЦА. Отдельная роль/кука от клиентского кабинета.
// Переиспользует крипто-примитивы клиентского _helpers.js (JWT, scrypt, rate-limit).
const H = require('../cabinet/_helpers');

// Владелец задаётся через env (не через Kommo — Влад не клиент воронки).
// Телефон(ы): свой OWNER_PHONE ИЛИ переиспользуем уже настроенный CABINET_OWNER_PHONES
// (список через запятую/пробел) — чтобы не плодить переменные. Все нормализуем.
const OWNER_PHONES = new Set(
  (process.env.OWNER_PHONE || process.env.CABINET_OWNER_PHONES || '')
    .split(/[\s,;]+/).map(s => H.normalizePhone(s)).filter(Boolean)
);
function isOwnerPhone(norm) { return OWNER_PHONES.has(norm); }
// OWNER_PASSWORD_HASH — формат scrypt$salt$hash (см. hashPassword в _helpers).
const OWNER_HASH = process.env.OWNER_PASSWORD_HASH || '';
// Токен ingest: свой OWNER_INGEST_TOKEN ИЛИ уже настроенный METRICS_INGEST_TOKEN.
const INGEST_TOKEN = process.env.OWNER_INGEST_TOKEN || process.env.METRICS_INGEST_TOKEN || '';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY = 'owner:dashboard';

async function kv(...cmd) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return null;
    return (await r.json()).result;
  } catch (_) { return null; }
}

const COOKIE = 'owner_token';
function setOwnerCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`);
}
function clearOwnerCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}
// Возвращает payload если валидная owner-сессия, иначе null.
function requireOwner(req) {
  const p = H.verifyJwt(H.readCookie(req, COOKIE));
  return (p && p.role === 'owner') ? p : null;
}

module.exports = {
  H, kv, KV_KEY, OWNER_PHONES, isOwnerPhone, OWNER_HASH, INGEST_TOKEN,
  setOwnerCookie, clearOwnerCookie, requireOwner, COOKIE,
};
