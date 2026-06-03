// Общие хелперы для кабинета клиента: Kommo API, JWT, нормализация телефона, хеш пароля.
const crypto = require('crypto');

const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || 'legalsol';
const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
const JWT_SECRET = process.env.CABINET_JWT_SECRET || 'change-me';
const PASSWORD_FIELD_ID = parseInt(process.env.KOMMO_PASSWORD_FIELD_ID || '2425096', 10);
const PHONE_FIELD_ID = 2103374;
const EMAIL_FIELD_ID = 2103376;
const CF_GRAZHDANSTVO = 2422198;
const CF_PASSPORT = 2422204;
const CF_DOB = 2422206;
const CF_ISTOCHNIK = 2422208;
const CF_SERVICE_TYPE = 2425468; // Тип услуги (на сделке)

// Этапы в продажной воронке (Pipeline 1) — id → human-readable
const PIPELINE_SALES = 13830355;
const STAGE_NAMES = {
  106715415: { ru: 'Заявка получена', en: 'Application received', pl: 'Wniosek otrzymany', step: 1 },
  106715423: { ru: 'Менеджер связался', en: 'Manager contacted', pl: 'Konsultant się skontaktował', step: 2 },
  106715427: { ru: 'Ожидаем ответ',    en: 'Awaiting response',  pl: 'Czekamy na odpowiedź', step: 2 },
  106715431: { ru: 'Ожидаем ответ',    en: 'Awaiting response',  pl: 'Czekamy na odpowiedź', step: 2 },
  106715687: { ru: 'Ожидаем ответ',    en: 'Awaiting response',  pl: 'Czekamy na odpowiedź', step: 2 },
  106890935: { ru: 'Ожидаем ответ',    en: 'Awaiting response',  pl: 'Czekamy na odpowiedź', step: 2 },
  106890939: { ru: 'Консультация',     en: 'Consultation',       pl: 'Konsultacja',          step: 3 },
  107002483: { ru: 'Записаны на встречу', en: 'Meeting scheduled', pl: 'Spotkanie zaplanowane', step: 3 },
  106890943: { ru: 'Готовим документы', en: 'Preparing documents', pl: 'Przygotowanie dokumentów', step: 4 },
  106890947: { ru: 'Документы поданы', en: 'Documents submitted', pl: 'Dokumenty złożone',    step: 5 },
  106890951: { ru: 'Готово',           en: 'Completed',          pl: 'Zakończone',           step: 6 },
  106890955: { ru: 'Закрыто',          en: 'Closed',             pl: 'Zamknięte',            step: 6 },
  142:       { ru: 'Успешно завершено', en: 'Successfully completed', pl: 'Pomyślnie zakończone', step: 6 },
  143:       { ru: 'Закрыто',          en: 'Closed',             pl: 'Zamknięte',            step: 6 }
};
const TOTAL_STEPS = 6;

// === Kommo HTTP wrapper ===
async function kommo(method, path, body) {
  const url = `https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4${path}`;
  const opts = { method, headers: { Authorization: `Bearer ${KOMMO_TOKEN}` } };
  if (body != null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Kommo ${method} ${path} [${resp.status}]: ${txt.slice(0, 200)}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// Нормализуем телефон: только цифры, добавляем 48 для польских 9-значных.
function normalizePhone(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/[^\d]/g, '');
  if (d.length === 9) d = '48' + d;
  return d;
}

// === Поиск контакта по телефону ===
async function findContactByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  // Kommo accepts "+48..." for query
  const q = encodeURIComponent('+' + normalized);
  const r = await kommo('GET', `/contacts?query=${q}&with=leads&limit=10`);
  const contacts = r?._embedded?.contacts || [];
  if (!contacts.length) return null;
  // Берём первый, у которого совпал телефон точно
  for (const c of contacts) {
    const phones = (c.custom_fields_values || [])
      .find(f => f.field_id === PHONE_FIELD_ID)?.values || [];
    if (phones.some(v => normalizePhone(v.value) === normalized)) return c;
  }
  return contacts[0];
}

// === Парсинг custom_fields_values ===
function getCfValue(contact, fieldId) {
  const f = (contact?.custom_fields_values || []).find(x => x.field_id === fieldId);
  if (!f) return '';
  const v = f.values?.[0];
  if (!v) return '';
  return v.value || '';
}

function getCfAllValues(contact, fieldId) {
  const f = (contact?.custom_fields_values || []).find(x => x.field_id === fieldId);
  return f ? (f.values || []).map(v => v.value).filter(Boolean) : [];
}

// === JWT (HS256) — без зависимостей ===
function b64u(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString();
}
function signJwt(payload, ttlSec = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64u(sig)}`;
}
function verifyJwt(token) {
  if (!token) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest();
  const got = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '==', 'base64');
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  try {
    const payload = JSON.parse(b64uDecode(p));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}

// === Password hashing (scrypt) ===
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const got = crypto.scryptSync(password, salt, 32);
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

// === Cookie helpers ===
function readCookie(req, name) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie',
    `cabinet_token=${token}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`);
}
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'cabinet_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

// === Тело запроса (raw, без bodyParser) ===
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = {
  kommo,
  normalizePhone,
  findContactByPhone,
  getCfValue,
  getCfAllValues,
  signJwt,
  verifyJwt,
  hashPassword,
  verifyPassword,
  readCookie,
  setAuthCookie,
  clearAuthCookie,
  readJsonBody,
  STAGE_NAMES,
  TOTAL_STEPS,
  PIPELINE_SALES,
  PASSWORD_FIELD_ID,
  PHONE_FIELD_ID,
  EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO,
  CF_PASSPORT,
  CF_DOB,
  CF_ISTOCHNIK,
  CF_SERVICE_TYPE
};
