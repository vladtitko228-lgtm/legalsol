// /api/cabinet/staff?action=data|client|set-password — единая функция панели сотрудника.
// Объединена в один обработчик из-за лимита Vercel Hobby (≤12 serverless-функций).
// Авторизация: staff-сессия (cookie cabinet_token с {staff:true}).
const {
  kommo, getCfValue, hashPassword, verifyJwt, readCookie, readJsonBody, normalizePhone, findContactByPhone,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS, PASSWORD_FIELD_ID, PHONE_FIELD_ID, CF_SERVICE_TYPE,
  isClientNote, stripClientPrefix, isPaymentNote, parsePaymentNote,
  isClientMsgNote, stripClientMsgPrefix,
  chatAppend, chatRead, chatInboxSince, updatesAppend, updatesRead,
  draftSet, draftGet, draftClear, BOT_RELAY_SECRET,
  clientIp, rateLimitBlocked, rateLimitFail
} = require('./_helpers');

function cleanLeadName(name) {
  if (!name) return '';
  return String(name)
    .replace(/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s+/, '')   // дата в начале
    .replace(/\s+\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*$/, '')// дата в конце
    .replace(/^(Facebook|Instagram|TikTok)\s*№?\s*\d+/i, '')
    .replace(/^Lead\s*#\d+/i, '')
    .trim();
}

// Даша опознаёт клиента по дате-«номеру» в имени сделки (начало ИЛИ конец).
// Возвращает её как dd.mm.yyyy (или как есть), либо '' если нет.
function leadCode(name) {
  if (!name) return '';
  const m = String(name).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return '';
  const dd = ('0' + m[1]).slice(-2), mm = ('0' + m[2]).slice(-2);
  let yy = m[3]; if (yy.length === 2) yy = '20' + yy;
  return dd + '.' + mm + '.' + yy;
}

// Многие контакты LS хранят телефон в ИМЕНИ контакта, а не в поле телефона.
function looksLikePhone(s) {
  if (!s) return false;
  const d = String(s).replace(/[^\d]/g, '');
  return d.length >= 9 && /^[\s+()\-\d]+$/.test(String(s).trim());
}
function fmtPhone(s) {
  if (!s) return '';
  let d = String(s).replace(/[^\d]/g, '');
  if (d.length === 9) d = '48' + d;
  return '+' + d;
}

// ── action=data ── список клиентов воронки «Легализация» + аналитика
async function actionData(req, res, payload) {
  const leadsRaw = [];
  for (let page = 1; page <= 6; page++) {
    const r = await kommo('GET', `/leads?filter[pipeline_id]=${PIPELINE_OPS}&with=contacts&limit=50&page=${page}`);
    const arr = r?._embedded?.leads || [];
    leadsRaw.push(...arr);
    if (arr.length < 50) break;
  }
  const contactIds = [];
  for (const ld of leadsRaw) {
    const cid = ld._embedded?.contacts?.[0]?.id;
    if (cid && contactIds.indexOf(cid) < 0) contactIds.push(cid);
  }
  const contactMap = {};
  for (let i = 0; i < contactIds.length; i += 50) {
    const batch = contactIds.slice(i, i + 50);
    const q = batch.map(id => `filter[id][]=${id}`).join('&');
    const r = await kommo('GET', `/contacts?${q}&limit=50`);
    for (const c of (r?._embedded?.contacts || [])) {
      const pf = (c.custom_fields_values || []).find(f => f.field_id === PHONE_FIELD_ID);
      let phone = pf?.values?.[0]?.value || '';
      // fallback: телефон в имени контакта
      if (!phone && looksLikePhone(c.name)) phone = fmtPhone(c.name);
      contactMap[c.id] = { phone, name: c.name || '', hasAccess: !!getCfValue(c, PASSWORD_FIELD_ID) };
    }
  }
  const now = Date.now();
  const list = []; const byStage = {};
  let active = 0, completed = 0, withAccess = 0, contractTotal = 0;
  for (const ld of leadsRaw) {
    const stage = STAGE_NAMES_OPS[ld.status_id] || { ru: 'В работе', step: 2 };
    const cid = ld._embedded?.contacts?.[0]?.id;
    const cm = (cid && contactMap[cid]) || { phone: '', name: '', hasAccess: false };
    // Имя: чистое имя сделки, но если оно похоже на телефон — берём имя контакта (если оно не телефон)
    let nm = cleanLeadName(ld.name) || '';
    if (!nm || looksLikePhone(nm)) {
      nm = (cm.name && !looksLikePhone(cm.name)) ? cm.name : (nm || 'Клиент');
    }
    const isDone = (stage.step || 0) >= TOTAL_STEPS;
    const updatedMs = (ld.updated_at || 0) * 1000;
    const daysIdle = updatedMs ? Math.floor((now - updatedMs) / 86400000) : 0;
    const price = ld.price || 0;
    const stKey = stage.ru || 'В работе';
    byStage[stKey] = (byStage[stKey] || 0) + 1;
    if (isDone) completed++; else active++;
    if (cm.hasAccess) withAccess++;
    contractTotal += price;
    list.push({ leadId: ld.id, code: leadCode(ld.name), name: nm, phone: cm.phone, service: getCfValue(ld, CF_SERVICE_TYPE) || stage.service || '',
      stage: stKey, step: stage.step || 0, totalSteps: TOTAL_STEPS, price, isDone, hasAccess: cm.hasAccess, updatedMs, daysIdle });
  }
  list.sort((a, b) => (a.isDone !== b.isDone) ? (a.isDone ? 1 : -1) : (b.daysIdle - a.daysIdle));
  return res.status(200).json({
    name: payload.name || 'Сотрудник',
    stats: { total: list.length, active, completed, withAccess, noAccess: list.length - withAccess, contractTotal,
      stale48: list.filter(x => !x.isDone && x.daysIdle >= 2).length },
    byStage, clients: list
  });
}

// ── action=client&leadId= ── деталь одного клиента
async function actionClient(req, res) {
  const leadId = String(req.query?.leadId || '').replace(/[^\d]/g, '');
  if (!leadId) return res.status(400).json({ error: 'leadId_required' });
  const lead = await kommo('GET', `/leads/${leadId}?with=contacts`);
  if (!lead || !lead.id) return res.status(404).json({ error: 'lead_not_found' });
  const stage = STAGE_NAMES_OPS[lead.status_id] || { ru: 'В работе', step: 2, whatWeDo: '', clientAction: null, etaText: null, service: '' };
  const cid = lead._embedded?.contacts?.[0]?.id;
  let phone = '', cname = '', hasAccess = false;
  if (cid) {
    const c = await kommo('GET', `/contacts/${cid}`);
    if (c) {
      cname = c.name || '';
      const pf = (c.custom_fields_values || []).find(f => f.field_id === PHONE_FIELD_ID);
      phone = pf?.values?.[0]?.value || '';
      if (!phone && looksLikePhone(c.name)) phone = fmtPhone(c.name);
      hasAccess = !!getCfValue(c, PASSWORD_FIELD_ID);
    }
  }
  // Имя клиента: имя сделки, если оно не телефон; иначе имя контакта
  const leadNm = cleanLeadName(lead.name);
  const displayName = (leadNm && !looksLikePhone(leadNm)) ? leadNm : ((cname && !looksLikePhone(cname)) ? cname : (leadNm || cname || 'Клиент'));
  let updates = [], payments = [], chat = [];
  try {
    const nRes = await kommo('GET', `/leads/${leadId}/notes?limit=100`);
    const all = (nRes?._embedded?.notes || []).map(n => ({ id: n.id, createdAt: (n.created_at || 0) * 1000, text: (n.params?.text || '').trim() })).filter(n => n.text);
    payments = all.filter(n => isPaymentNote(n.text)).map(n => { const p = parsePaymentNote(n.text) || { amount: 0, method: '', dateText: '' }; return { id: n.id, createdAt: n.createdAt, amount: p.amount, method: p.method, dateText: p.dateText }; }).filter(p => p.amount > 0).sort((a, b) => b.createdAt - a.createdAt);
    // Апдейты и чат — ТОЛЬКО из KV (в Kommo не дублируем; карточка Kommo для Даши).
    try { updates = await updatesRead(leadId); } catch (_) { updates = []; }
    try { chat = await chatRead(leadId); } catch (_) { chat = []; }
  } catch (_) {}
  let tasks = [];
  try {
    const tRes = await kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${leadId}&filter[is_completed]=0&limit=20`);
    tasks = (tRes?._embedded?.tasks || []).map(t => ({ id: t.id, completeTill: t.complete_till * 1000, text: t.text || '' })).sort((a, b) => a.completeTill - b.completeTill);
  } catch (_) {}
  const price = lead.price || 0;
  const paidTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);
  let aiDraft = '';
  // ИИ-черновик показываем, только если последнее слово в чате — за клиентом (ждёт ответа)
  const lastMsg = chat.length ? chat[chat.length - 1] : null;
  if (lastMsg && lastMsg.from === 'client') {
    try { const d = await draftGet(leadId); if (d && d.text) aiDraft = d.text; } catch (_) {}
  }
  return res.status(200).json({
    leadId: lead.id, code: leadCode(lead.name), name: displayName, phone, hasAccess,
    service: getCfValue(lead, CF_SERVICE_TYPE) || stage.service || '',
    stage: { ru: stage.ru, step: stage.step || 0, totalSteps: TOTAL_STEPS, whatWeDo: stage.whatWeDo || '', clientAction: stage.clientAction || '', etaText: stage.etaText || '' },
    price, paidTotal, remaining: price > paidTotal ? price - paidTotal : 0, payments, tasks, updates, chat, aiDraft
  });
}

// ── action=set-password ── выдать клиенту доступ
async function actionSetPassword(req, res) {
  const ip = clientIp(req);
  if (await rateLimitBlocked(ip, '__staffpw__')) return res.status(429).json({ error: 'too_many_attempts' });
  const { phone, password } = await readJsonBody(req);
  if (!phone) return res.status(400).json({ error: 'phone_required' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'password_too_short', message: 'Пароль — минимум 6 символов.' });
  const normalized = normalizePhone(phone);
  if (normalized.length < 9) return res.status(400).json({ error: 'invalid_phone' });
  const contact = await findContactByPhone(normalized);
  if (!contact) { await rateLimitFail(ip, '__staffpw__'); return res.status(404).json({ error: 'contact_not_found', message: 'Клиент с таким телефоном не найден в Kommo. Сначала заведите карточку и переведите в воронку «Легализация».' }); }
  let inOps = false;
  try {
    const leadIds = (contact._embedded?.leads || []).map(l => l.id).slice(0, 20);
    for (const lid of leadIds) { const lead = await kommo('GET', `/leads/${lid}`); if (lead && lead.pipeline_id === PIPELINE_OPS) { inOps = true; break; } }
  } catch (_) {}
  const already = !!getCfValue(contact, PASSWORD_FIELD_ID);
  await kommo('PATCH', `/contacts/${contact.id}`, { custom_fields_values: [{ field_id: PASSWORD_FIELD_ID, values: [{ value: hashPassword(String(password)) }] }] });
  return res.status(200).json({ ok: true, contactId: contact.id, name: contact.name || '', login: '+' + normalized, inOps, updated: already });
}

// ── action=inbox ── клиенты, ЖДУЩИЕ ОТВЕТА (очередь cabchat:inbox в KV).
// Лид уходит из очереди, как только менеджер ответил → колокольчик гаснет.
// Панель Даши зовёт без since → все ждущие (свежие сверху).
// Бот зовёт с ?since=<ts> → ждущие новее ts (id = ts, курсор), по возрастанию.
async function actionInbox(req, res) {
  const sinceQ = Number(req.query?.since || 0);
  let raw = [];
  try { raw = await chatInboxSince(sinceQ > 0 ? sinceQ : 0); } catch (_) {}
  const items = raw
    .map(m => ({ leadId: String(m.leadId), noteId: m.ts, text: String(m.text || '').slice(0, 200), createdAt: m.ts }))
    .sort((a, b) => sinceQ > 0 ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  return res.status(200).json({ items });
}

// ── action=reply ── ответ клиенту в кабинет. Пишем в KV (не в карточку Kommo).
async function actionReply(req, res) {
  const body = await readJsonBody(req);
  const lid = String(body.leadId || '').replace(/[^\d]/g, '');
  const msg = String(body.text || '').trim().slice(0, 1500);
  if (!lid) return res.status(400).json({ error: 'leadId_required' });
  if (!msg) return res.status(400).json({ error: 'text_required' });
  await chatAppend(lid, 'manager', msg);
  try { await draftClear(lid); } catch (_) {} // ответили → ИИ-черновик больше не нужен
  return res.status(200).json({ ok: true });
}

// ── action=draft ── бот кладёт ИИ-черновик ответа для панели Даши (KV).
async function actionDraft(req, res) {
  const body = await readJsonBody(req);
  const lid = String(body.leadId || '').replace(/[^\d]/g, '');
  const msg = String(body.text || '').trim().slice(0, 2000);
  if (!lid || !msg) return res.status(400).json({ error: 'bad_request' });
  await draftSet(lid, msg);
  return res.status(200).json({ ok: true });
}

// ── action=update ── статус-апдейт дела (из бота /update) → лента кабинета (KV).
async function actionUpdate(req, res) {
  const body = await readJsonBody(req);
  const lid = String(body.leadId || '').replace(/[^\d]/g, '');
  const msg = String(body.text || '').trim().slice(0, 2000);
  if (!lid) return res.status(400).json({ error: 'leadId_required' });
  if (!msg) return res.status(400).json({ error: 'text_required' });
  await updatesAppend(lid, msg);
  return res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const action = String(req.query?.action || '');
    // Авторизация: либо staff-сессия (Даша), либо машинный токен бота (Bearer) —
    // боту нужны только inbox (читать новые) и reply (отправлять одобренный ответ).
    const authH = String(req.headers['authorization'] || '');
    const relayOk = !!BOT_RELAY_SECRET && authH === 'Bearer ' + BOT_RELAY_SECRET;
    const payload = verifyJwt(readCookie(req, 'cabinet_token'));
    const isStaff = !!(payload && payload.staff);
    if (relayOk && !isStaff) {
      // машинный доступ бота — только inbox / reply
      if (req.method === 'GET' && action === 'inbox') return actionInbox(req, res);
      if (req.method === 'POST' && action === 'reply') return actionReply(req, res);
      if (req.method === 'POST' && action === 'update') return actionUpdate(req, res);
      if (req.method === 'POST' && action === 'draft') return actionDraft(req, res);
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!isStaff) return res.status(401).json({ error: 'unauthorized' });
    if (req.method === 'GET' && action === 'data') return actionData(req, res, payload);
    if (req.method === 'GET' && action === 'client') return actionClient(req, res);
    if (req.method === 'GET' && action === 'inbox') return actionInbox(req, res);
    if (req.method === 'POST' && action === 'set-password') return actionSetPassword(req, res);
    if (req.method === 'POST' && action === 'reply') return actionReply(req, res);
    return res.status(400).json({ error: 'bad_action' });
  } catch (e) {
    console.error('staff err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
