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

// Воронка 1 (Sales) — это лиды, в кабинет НЕ попадают
const PIPELINE_SALES = 13830355;
// Воронка 2 (Operations / Легализация) — оплаченные клиенты, ИХ показываем в кабинете
const PIPELINE_OPS = 13830463;

// Стадии Pipeline 2 «Легализация» — что видит клиент в кабинете
// step — позиция в прогресс-баре (1..6), service — дефолтный тип услуги, если не задан в кастомном поле
const STAGE_NAMES_OPS = {
  106716263: { ru: 'Заявка принята',      en: 'Application received',  pl: 'Wniosek przyjęty',     step: 1, service: 'Карта побыту' },
  106716267: { ru: 'Документы отправлены', en: 'Documents sent',       pl: 'Dokumenty wysłane',    step: 2, service: 'Карта побыту' },
  106716271: { ru: 'Подано в офис',       en: 'Filed at office',       pl: 'Złożone w urzędzie',   step: 3, service: 'Карта побыту' },
  106716275: { ru: 'Ускоренное рассмотрение', en: 'Speed-up review',   pl: 'Przyspieszone',        step: 4, service: 'Карта побыту' },
  106716319: { ru: 'Дело у юриста',       en: 'With lawyer (Supreme)', pl: 'U prawnika (Supreme)', step: 4, service: 'Карта побыту' },
  106716323: { ru: 'Ждём отпечатки пальцев', en: 'Awaiting fingerprints', pl: 'Czekamy na odciski', step: 5, service: 'Карта побыту' },
  106716347: { ru: 'На финальной проверке', en: 'Final review',        pl: 'Końcowa weryfikacja',  step: 5, service: 'Карта побыту' },
  106716327: { ru: 'Подана апелляция',    en: 'Appeal filed',          pl: 'Złożono odwołanie',    step: 4, service: 'Апелляция' },
  106716331: { ru: 'Защита от депортации', en: 'Deportation defence',  pl: 'Obrona przed deportacją', step: 3, service: 'Защита от депортации' },
  106716335: { ru: 'Международная защита', en: 'International protection', pl: 'Ochrona międzynarodowa', step: 3, service: 'Международная защита' },
  106716339: { ru: 'Воссоединение семьи', en: 'Family reunification',  pl: 'Łączenie rodzin',      step: 3, service: 'Воссоединение семьи' },
  106716343: { ru: 'Замена водительских прав', en: 'Driving licence exchange', pl: 'Wymiana prawa jazdy', step: 3, service: 'Замена прав' },
  142:       { ru: 'Готово ✓',            en: 'Completed ✓',           pl: 'Gotowe ✓',             step: 6, service: '' },
  143:       { ru: 'Дело закрыто',        en: 'Case closed',           pl: 'Sprawa zamknięta',     step: 6, service: '' }
};
const TOTAL_STEPS = 6;

// Старый STAGE_NAMES (Pipeline 1) оставлен только для совместимости — НЕ используется в /me
const STAGE_NAMES = STAGE_NAMES_OPS;

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
// Kommo full-text search строгий: ищет именно по строке.
// Пробуем разные форматы — потому что менеджеры пишут телефон как угодно
// (в поле Phone, в имени контакта, с пробелами, без +, и т.д.)
async function findContactByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  // Польский формат: XXX XXX XXX (9 цифр split 3-3-3)
  const localPart = normalized.length === 11 && normalized.startsWith('48')
    ? normalized.slice(2)
    : normalized;
  const polishSpaced = localPart.length === 9
    ? localPart.slice(0, 3) + ' ' + localPart.slice(3, 6) + ' ' + localPart.slice(6)
    : null;

  const queries = [
    '+' + normalized,                                        // +48792719298
    normalized,                                              // 48792719298
    localPart,                                               // 792719298
    polishSpaced,                                            // 792 719 298  ← ловит имя «+48 792 719 298»
    polishSpaced ? '+48 ' + polishSpaced : null              // +48 792 719 298
  ].filter(Boolean);

  async function search(q) {
    const r = await kommo('GET', `/contacts?query=${encodeURIComponent(q)}&with=leads&limit=20`);
    return r?._embedded?.contacts || [];
  }
  function matches(c) {
    const phones = (c.custom_fields_values || [])
      .find(f => f.field_id === PHONE_FIELD_ID)?.values || [];
    if (phones.some(v => normalizePhone(v.value) === normalized)) return true;
    if (normalizePhone(c.name) === normalized) return true;
    return false;
  }

  const seenIds = new Set();
  for (const q of queries) {
    const contacts = await search(q);
    for (const c of contacts) {
      if (seenIds.has(c.id)) continue;
      seenIds.add(c.id);
      if (matches(c)) return c;
    }
  }
  return null;
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
  PIPELINE_OPS,
  STAGE_NAMES_OPS,
  PASSWORD_FIELD_ID,
  PHONE_FIELD_ID,
  EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO,
  CF_PASSPORT,
  CF_DOB,
  CF_ISTOCHNIK,
  CF_SERVICE_TYPE
};
