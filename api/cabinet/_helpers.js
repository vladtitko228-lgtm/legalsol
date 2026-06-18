// Общие хелперы для кабинета клиента: Kommo API, JWT, нормализация телефона, хеш пароля.
const crypto = require('crypto');

const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || 'legalsol';
const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
// Без секрета — НЕ запускаемся: дефолтный секрет позволил бы подделать токен
// любого клиента и слить его персональные данные (паспорт, гражданство и пр.).
const JWT_SECRET = process.env.CABINET_JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error('CABINET_JWT_SECRET is not set or too short (need >=16 chars) — refusing to start cabinet auth');
}
const PASSWORD_FIELD_ID = parseInt(process.env.KOMMO_PASSWORD_FIELD_ID || '2425096', 10);

// Сотрудники (Даша и др.) — могут входить в админ-панель и заводить клиентам доступы.
// env CABINET_STAFF = «phone:scryptHash:Имя» через запятую (телефон не секрет, хеш — секрет).
// Пример: +48884007199:scrypt$...$...:Дарья
function parseStaff() {
  const raw = process.env.CABINET_STAFF || '';
  const out = [];
  for (const part of raw.split(',')) {
    const s = part.trim();
    if (!s) continue;
    // hash содержит «$», поэтому делим аккуратно: phone : scrypt$salt$hash : name
    const m = s.match(/^([^:]+):(scrypt\$[^:]+):(.*)$/);
    if (!m) continue;
    out.push({ phone: m[1].replace(/[^\d]/g, ''), hash: m[2], name: (m[3] || 'Сотрудник').trim() });
  }
  return out;
}
const STAFF = parseStaff();
function findStaffByPhone(normalizedPhone) {
  const p = String(normalizedPhone || '').replace(/[^\d]/g, '');
  return STAFF.find(s => s.phone === p) || null;
}

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

// Стадии Pipeline 2 «Легализация» — что видит клиент в кабинете.
// Каждая стадия описана 4-мя ответами на вопросы клиента:
//   ru — короткое название этапа («Где мы сейчас»)
//   whatWeDo — что мы делаем прямо сейчас (1 предложение)
//   clientAction — что от клиента требуется (null = ничего)
//   etaText — типичный срок до перехода к следующему этапу
// step — позиция в прогресс-баре (1..6), service — дефолтный тип услуги
const STAGE_NAMES_OPS = {
  106716263: {
    ru: 'Заявка принята', en: 'Application received', pl: 'Wniosek przyjęty', step: 1, service: 'Карта побыту',
    whatWeDo: 'Менеджер изучает вашу ситуацию и подберёт оптимальный путь.',
    whatWeDo_en: 'Your manager is reviewing your situation and choosing the best path.',
    clientAction: 'Возможно, попросим уточнить детали по WhatsApp.',
    clientAction_en: 'We may ask you to clarify some details via WhatsApp.',
    etaText: '1–2 рабочих дня', etaText_en: '1–2 business days'
  },
  106716267: {
    ru: 'Документы отправлены', en: 'Documents sent', pl: 'Dokumenty wysłane', step: 2, service: 'Карта побыту',
    whatWeDo: 'Ваш пакет документов отправлен в воеводский офис почтой.',
    whatWeDo_en: 'Your document package has been mailed to the voivodeship office.',
    clientAction: null, clientAction_en: null,
    etaText: 'Доставка 3–7 дней', etaText_en: 'Delivery 3–7 days'
  },
  106716271: {
    ru: 'Подано в офис', en: 'Filed at office', pl: 'Złożone w urzędzie', step: 3, service: 'Карта побыту',
    whatWeDo: 'Документы зарегистрированы в воеводстве. Ждём первое решение или запрос дополнительных бумаг.',
    whatWeDo_en: 'Your documents are registered at the voivodeship. We are waiting for the first decision or a request for more papers.',
    clientAction: null, clientAction_en: null,
    etaText: '2–4 недели до первой реакции', etaText_en: '2–4 weeks until first response'
  },
  106716275: {
    ru: 'Ускоренное рассмотрение', en: 'Speed-up review', pl: 'Przyspieszone', step: 4, service: 'Карта побыту',
    whatWeDo: 'Юрист готовит дополнительные документы и работает с воеводством напрямую.',
    whatWeDo_en: 'Our lawyer is preparing additional documents and working with the voivodeship directly.',
    clientAction: null, clientAction_en: null,
    etaText: '7–14 дней', etaText_en: '7–14 days'
  },
  106716319: {
    ru: 'Дело у партнёра-юриста', en: 'With partner lawyer', pl: 'U prawnika-partnera', step: 4, service: 'Карта побыту',
    whatWeDo: 'Дело передано юристу-партнёру (стандартный путь для сложных случаев).',
    whatWeDo_en: 'Your case has been handed to a partner lawyer (the standard path for complex cases).',
    clientAction: null, clientAction_en: null,
    etaText: '14–30 дней', etaText_en: '14–30 days'
  },
  106716323: {
    ru: 'Ждём отпечатки пальцев', en: 'Awaiting fingerprints', pl: 'Czekamy na odciski', step: 5, service: 'Карта побыту',
    whatWeDo: 'Воеводство назначило вам биометрию. Дата и адрес — в апдейте от менеджера.',
    whatWeDo_en: 'The voivodeship has scheduled your biometrics. The date and address are in the manager update.',
    clientAction: 'Прийти в указанный день с паспортом.',
    clientAction_en: 'Come on the scheduled day with your passport.',
    etaText: '7–21 день после биометрии', etaText_en: '7–21 days after biometrics'
  },
  106716347: {
    ru: 'Финальная проверка', en: 'Final review', pl: 'Końcowa weryfikacja', step: 5, service: 'Карта побыту',
    whatWeDo: 'Наш юрист проверяет результат перед выдачей.',
    whatWeDo_en: 'Our lawyer is checking the result before issuance.',
    clientAction: null, clientAction_en: null,
    etaText: '3–7 дней', etaText_en: '3–7 days'
  },
  106716327: {
    ru: 'Подана апелляция', en: 'Appeal filed', pl: 'Złożono odwołanie', step: 4, service: 'Апелляция',
    whatWeDo: 'Апелляция на отказ подана. Решение пересматривает вышестоящая инстанция.',
    whatWeDo_en: 'The appeal against the refusal has been filed. A higher authority is reviewing the decision.',
    clientAction: null, clientAction_en: null,
    etaText: '30–60 дней', etaText_en: '30–60 days'
  },
  106716331: {
    ru: 'Защита от депортации', en: 'Deportation defence', pl: 'Obrona przed deportacją', step: 3, service: 'Защита от депортации',
    whatWeDo: 'Юрист готовит защиту вашего права остаться в Польше.',
    whatWeDo_en: 'Our lawyer is preparing a defence of your right to stay in Poland.',
    clientAction: 'Менеджер может запросить дополнительные доказательства.',
    clientAction_en: 'The manager may request additional evidence.',
    etaText: 'Зависит от ситуации', etaText_en: 'Depends on the case'
  },
  106716335: {
    ru: 'Международная защита', en: 'International protection', pl: 'Ochrona międzynarodowa', step: 3, service: 'Международная защита',
    whatWeDo: 'Ведём процесс международной защиты — собираем доказательства, готовим показания.',
    whatWeDo_en: 'We are handling your international protection case — gathering evidence and preparing testimony.',
    clientAction: 'Возможны встречи и интервью.',
    clientAction_en: 'Meetings and interviews may be required.',
    etaText: 'Несколько месяцев', etaText_en: 'Several months'
  },
  106716339: {
    ru: 'Воссоединение семьи', en: 'Family reunification', pl: 'Łączenie rodzin', step: 3, service: 'Воссоединение семьи',
    whatWeDo: 'Готовим документы для воссоединения с членами семьи в Польше.',
    whatWeDo_en: 'We are preparing documents to reunite you with your family members in Poland.',
    clientAction: 'Менеджер уточнит документы на родственников.',
    clientAction_en: 'The manager will clarify the documents needed for your relatives.',
    etaText: '2–6 месяцев', etaText_en: '2–6 months'
  },
  106716343: {
    ru: 'Замена водительских прав', en: 'Driving licence exchange', pl: 'Wymiana prawa jazdy', step: 3, service: 'Замена прав',
    whatWeDo: 'Документы поданы в Urząd Komunikacji.',
    whatWeDo_en: 'Your documents have been submitted to the Urząd Komunikacji.',
    clientAction: null, clientAction_en: null,
    etaText: '1–2 месяца', etaText_en: '1–2 months'
  },
  142: {
    ru: 'Готово ✓', en: 'Completed ✓', pl: 'Gotowe ✓', step: 6, service: '',
    whatWeDo: 'Услуга оказана. Поздравляем!',
    whatWeDo_en: 'Your service is complete. Congratulations!',
    clientAction: 'Менеджер свяжется по выдаче результата.',
    clientAction_en: 'The manager will contact you about collecting the result.',
    etaText: null, etaText_en: null
  },
  143: {
    ru: 'Дело закрыто', en: 'Case closed', pl: 'Sprawa zamknięta', step: 6, service: '',
    whatWeDo: 'Дело закрыто. Если есть вопросы — пишите менеджеру.',
    whatWeDo_en: 'The case is closed. If you have any questions, message your manager.',
    clientAction: null, clientAction_en: null,
    etaText: null, etaText_en: null
  }
};
const TOTAL_STEPS = 6;

// Префиксы клиентских апдейтов: менеджер ставит ЛЮБОЙ из них в начало заметки.
// Если матчится — заметка летит в кабинет, без префикса остаётся внутренней.
// Основной — «КЛИЕНТУ:» (надёжный текст без спецсимволов).
// Дополнительные — для гибкости (Kommo иногда экранирует > / эмодзи).
const CLIENT_NOTE_PREFIXES = [
  'КЛИЕНТУ:', 'Клиенту:', 'клиенту:',
  '[КЛИЕНТ]', '[Клиент]', '[c]', '[К]', '[к]',
  '>>>', '&gt;&gt;&gt;',
  '📢'
];

// Сообщения, которые пишет САМ клиент из кабинета. Префикс «ОТ КЛИЕНТА:».
// Менеджер/Даша видит их в карточке клиента; в чате кабинета — как реплика клиента справа.
const CLIENT_MSG_PREFIX = 'ОТ КЛИЕНТА:';
const CLIENT_MSG_PREFIXES = ['ОТ КЛИЕНТА:', 'От клиента:', 'от клиента:', '[ОТ КЛИЕНТА]'];
function isClientMsgNote(text) {
  if (!text) return false;
  const t = String(text).trim();
  return CLIENT_MSG_PREFIXES.some(p => t.toUpperCase().startsWith(p.toUpperCase()));
}
function stripClientMsgPrefix(text) {
  let t = String(text || '').trim();
  for (const p of CLIENT_MSG_PREFIXES) {
    if (t.toUpperCase().startsWith(p.toUpperCase())) return t.slice(p.length).trim();
  }
  return t;
}
const CLIENT_NOTE_PREFIX = 'КЛИЕНТУ:'; // дефолтный (для UI и сообщений)

// Платёжные заметки: менеджер (или TG-бот /paid) ставит префикс «ОПЛАТА:».
// Формат тела (любой из): «1500 zł · Visa · 17.06.2026» / «1500 zl Visa» / «1500».
// Клиент видит их в кабинете на странице «Оплаты» отдельно от текстовых апдейтов.
const PAYMENT_NOTE_PREFIXES = ['ОПЛАТА:', 'Оплата:', 'оплата:', '💳'];
const PAYMENT_NOTE_PREFIX = 'ОПЛАТА:';

function decodeHtmlEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function isClientNote(text) {
  if (!text) return false;
  const t = decodeHtmlEntities(text).trim();
  return CLIENT_NOTE_PREFIXES.some(p => t.toUpperCase().startsWith(p.toUpperCase()));
}

function stripClientPrefix(text) {
  if (!text) return '';
  let t = decodeHtmlEntities(text).trim();
  for (const p of CLIENT_NOTE_PREFIXES) {
    if (t.toUpperCase().startsWith(p.toUpperCase())) {
      return t.slice(p.length).trim();
    }
  }
  return t;
}

// === Платёжные заметки ===
function isPaymentNote(text) {
  if (!text) return false;
  const t = decodeHtmlEntities(text).trim();
  return PAYMENT_NOTE_PREFIXES.some(p => t.toUpperCase().startsWith(p.toUpperCase()));
}

// Разбор «ОПЛАТА: 1500 zł · Visa · 17.06.2026» → { amount, method, dateText, raw }
// amount — число (zł), method — способ (если есть), dateText — дата как написана (если есть).
function parsePaymentNote(text) {
  if (!text) return null;
  let t = decodeHtmlEntities(text).trim();
  for (const p of PAYMENT_NOTE_PREFIXES) {
    if (t.toUpperCase().startsWith(p.toUpperCase())) { t = t.slice(p.length).trim(); break; }
  }
  // Платёжная инфа всегда на первой строке; после \n — служебный план рассрочки, его игнорим.
  t = t.split('\n')[0].trim();
  // Сумма — первое число (допускаем пробелы-разделители тысяч: «1 500»)
  const amtMatch = t.replace(/(\d)[  ](?=\d{3}\b)/g, '$1').match(/(\d[\d.,]*)/);
  const amount = amtMatch ? parseInt(amtMatch[1].replace(/[.,]/g, ''), 10) : null;
  // Дата dd.mm.yyyy / dd.mm если есть
  const dateMatch = t.match(/\b(\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?)\b/);
  const dateText = dateMatch ? dateMatch[1] : '';
  // Способ — слово вроде Visa/перевод/blik/наличные между разделителями
  const methodMatch = t.match(/(?:·|\||-|,)\s*([A-Za-zА-Яа-я][A-Za-zА-Яа-я ]{1,18})/);
  let method = methodMatch ? methodMatch[1].trim() : '';
  if (/^\d/.test(method)) method = '';
  return { amount: amount || 0, method, dateText, raw: t };
}

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

// === Rate limiting (Upstash KV via REST) ===
// Защита входа от перебора паролей. Fail-open: если KV не настроен/недоступен —
// НЕ блокируем (доступность важнее; KV-сбой не должен запирать всех клиентов).
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RL_WINDOW = 900;     // окно 15 минут
const RL_MAX_CRED = 5;     // попыток на (ip+телефон)
const RL_MAX_IP = 30;      // попыток на IP (защита от password spray по многим телефонам)

async function kvCmd(...cmd) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.result;
  } catch (e) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────
// ЧАТ КАБИНЕТА в Vercel KV (Upstash). Раньше переписка писалась заметками в
// карточку Kommo и мусорила её — теперь живёт здесь. Kommo остаётся только под
// «дело» (этапы, оплаты, статус-апдейты), переписку туда больше НЕ дублируем.
//   cabchat:<leadId>   — LIST из JSON {from:'client'|'manager', text, ts}
//   cabchat:inbox      — ZSET «ждут ответа»: member=leadId, score=ts последнего
//                        НЕОТВЕЧЕННОГО сообщения клиента. Ответ менеджера удаляет
//                        лид отсюда → колокольчик у Даши гаснет.
//   cabchat:inbox:txt  — HASH leadId→превью последнего сообщения (для баннера/бота)
const BOT_RELAY_SECRET = process.env.BOT_RELAY_SECRET || '';
const CHAT_KEY = id => `cabchat:${String(id).replace(/[^\d]/g, '')}`;
const CHAT_INBOX = 'cabchat:inbox';
const CHAT_INBOX_TXT = 'cabchat:inbox:txt';

// Добавить сообщение в переписку сделки. from = 'client' | 'manager'.
async function chatAppend(leadId, from, text) {
  const id = String(leadId || '').replace(/[^\d]/g, '');
  const t = String(text || '').trim().slice(0, 2000);
  if (!id || !t) return null;
  const ts = Date.now();
  const role = from === 'client' ? 'client' : 'manager';
  const msg = JSON.stringify({ from: role, text: t, ts });
  await kvCmd('RPUSH', CHAT_KEY(id), msg);
  await kvCmd('LTRIM', CHAT_KEY(id), -500, -1);           // храним последние 500 сообщений
  if (role === 'client') {
    // клиент ждёт ответа → в очередь (по leadId; повторное сообщение обновит ts)
    await kvCmd('ZADD', CHAT_INBOX, ts, id);
    await kvCmd('HSET', CHAT_INBOX_TXT, id, t.slice(0, 300));
  } else {
    // менеджер ответил → клиент больше не ждёт → убираем из очереди (колокольчик гаснет)
    await kvCmd('ZREM', CHAT_INBOX, id);
    await kvCmd('HDEL', CHAT_INBOX_TXT, id);
  }
  return ts;
}

// Прочитать всю переписку сделки → [{from, text, createdAt}] по возрастанию времени.
async function chatRead(leadId) {
  const id = String(leadId || '').replace(/[^\d]/g, '');
  if (!id) return [];
  const arr = await kvCmd('LRANGE', CHAT_KEY(id), 0, -1);
  if (!Array.isArray(arr)) return [];
  return arr.map(s => { try { return JSON.parse(s); } catch (_) { return null; } })
    .filter(Boolean)
    .map(m => ({ from: m.from, text: m.text, createdAt: m.ts }));
}

// Неотвеченные входящие с ts > sinceTs → [{leadId, text, ts}] по возрастанию ts.
async function chatInboxSince(sinceTs) {
  const lo = (Number(sinceTs) || 0) + 1;
  const arr = await kvCmd('ZRANGEBYSCORE', CHAT_INBOX, lo, '+inf', 'WITHSCORES');
  if (!Array.isArray(arr) || !arr.length) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += 2) {
    let lead = String(arr[i]);
    if (lead && lead[0] === '{') { try { const o = JSON.parse(lead); if (o && o.leadId) lead = String(o.leadId); } catch (_) {} } // совместимость со старым форматом
    out.push({ leadId: lead, ts: Number(arr[i + 1]) });
  }
  let txts = [];
  try { txts = await kvCmd('HMGET', CHAT_INBOX_TXT, ...out.map(o => o.leadId)); } catch (_) {}
  out.forEach((o, i) => { o.text = (Array.isArray(txts) && txts[i]) || ''; });
  return out;
}

// Снять «ждёт ответа» вручную (на случай если менеджер ответил иным путём).
async function chatInboxClear(leadId) {
  const id = String(leadId || '').replace(/[^\d]/g, '');
  if (!id) return;
  await kvCmd('ZREM', CHAT_INBOX, id);
  await kvCmd('HDEL', CHAT_INBOX_TXT, id);
}

function clientIp(req) {
  // Левый токен XFF контролируется клиентом (Vercel дописывает реальный IP в
  // конец) — брать его значит позволить обходить rate-limit подделкой
  // заголовка. x-real-ip Vercel выставляет сам и перезаписывает входящий.
  const real = (req.headers['x-real-ip'] || '').trim();
  if (real) return real;
  const xff = (req.headers['x-forwarded-for'] || '').split(',');
  const last = xff[xff.length - 1].trim();
  return last || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// true → заблокировать (лимит превышен)
async function rateLimitBlocked(ip, phone) {
  const ck = `rl:l:${ip}:${phone}`, ik = `rl:i:${ip}`;
  const [c, i] = await Promise.all([kvCmd('GET', ck), kvCmd('GET', ik)]);
  return Number(c) >= RL_MAX_CRED || Number(i) >= RL_MAX_IP;
}

// зафиксировать неудачную попытку (INCR + установить TTL при первом)
async function rateLimitFail(ip, phone) {
  const ck = `rl:l:${ip}:${phone}`, ik = `rl:i:${ip}`;
  const c = await kvCmd('INCR', ck); if (c === 1) await kvCmd('EXPIRE', ck, RL_WINDOW);
  const i = await kvCmd('INCR', ik); if (i === 1) await kvCmd('EXPIRE', ik, RL_WINDOW);
}

// сбросить счётчик (ip+телефон) после успешного входа
async function rateLimitReset(ip, phone) {
  await kvCmd('DEL', `rl:l:${ip}:${phone}`);
}

module.exports = {
  kommo,
  kvCmd,
  BOT_RELAY_SECRET,
  chatAppend,
  chatRead,
  chatInboxSince,
  chatInboxClear,
  clientIp,
  rateLimitBlocked,
  rateLimitFail,
  rateLimitReset,
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
  CLIENT_NOTE_PREFIX,
  CLIENT_NOTE_PREFIXES,
  isClientNote,
  stripClientPrefix,
  PAYMENT_NOTE_PREFIX,
  PAYMENT_NOTE_PREFIXES,
  isPaymentNote,
  parsePaymentNote,
  findStaffByPhone,
  CLIENT_MSG_PREFIX,
  isClientMsgNote,
  stripClientMsgPrefix,
  PASSWORD_FIELD_ID,
  PHONE_FIELD_ID,
  EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO,
  CF_PASSPORT,
  CF_DOB,
  CF_ISTOCHNIK,
  CF_SERVICE_TYPE
};
