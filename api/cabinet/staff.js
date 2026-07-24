// /api/cabinet/staff?action=data|client|set-password — единая функция панели сотрудника.
// Объединена в один обработчик из-за лимита Vercel Hobby (≤12 serverless-функций).
// Авторизация: staff-сессия (cookie cabinet_token с {staff:true}).
const {
  kommo, getCfValue, hashPassword, verifyJwt, readCookie, readJsonBody, normalizePhone, findContactByPhone,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS, PASSWORD_FIELD_ID, PHONE_FIELD_ID, CF_SERVICE_TYPE,
  isClientNote, stripClientPrefix, isPaymentNote, parsePaymentNote, isChatReplyNote, stripChatReplyPrefix,
  isClientMsgNote, stripClientMsgPrefix, isPaymentPlanNote, parsePaymentPlanNote,
  clientIp, rateLimitBlocked, rateLimitFail
} = require('./_helpers');

function cleanLeadName(name) {
  if (!name) return '';
  return String(name)
    .replace(/^\d{1,3}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s+/, '') // ведущий счётчик закрытий «13/07/2026 Имя»
    .replace(/\s+\d{1,3}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*$/, '')
    .replace(/^(Facebook|Instagram|TikTok)\s*№?\s*\d+/i, '')
    .replace(/^Lead\s*#\d+/i, '')
    .trim();
}

// Счётчик закрытий из имени сделки: «13/07/2026 Имя» или «Имя 12/05/2026».
// Первое число — ПОРЯДКОВЫЙ НОМЕР закрытия в месяце (бывает 31/06, 35/06), второе — месяц.
function parseSeq(name) {
  const s = String(name || '');
  const m = s.match(/^(\d{1,3})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\s+/) || s.match(/\s(\d{1,3})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\s*$/);
  if (!m) return null;
  const seq = +m[1], mo = +m[2]; let yr = +m[3];
  if (yr < 100) yr += 2000;
  if (!seq || mo < 1 || mo > 12 || yr < 2020 || yr > 2100) return null;
  return { seq, monthKey: yr + '-' + String(mo).padStart(2, '0') };
}

const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || 'legalsol';

// ИИ-черновик ответа: внутренняя заметка «ЧЕРНОВИК: …» от cabinet-bot.
// Префикса НЕТ в CLIENT_NOTE_PREFIXES → клиент его не видит (проверено 24.07.2026).
function isDraftNote(text) { return /^ЧЕРНОВИК:/i.test(String(text || '').trim()); }
function stripDraftPrefix(text) { return String(text || '').trim().replace(/^ЧЕРНОВИК:\s*/i, ''); }

// Тестовые/демо-сделки не показываем в панели (Влад, 24.07)
const TEST_LEAD_IDS = { 21119540: 1, 21119588: 1, 21138922: 1, 21208806: 1, 19334410: 1 };
const TEST_LEAD_RE = /(\bTEST\b|\bТЕСТ\b|\bДЕМО\b|демо-портала|тест кабинета)/i;
function isTestLead(ld) { return !!TEST_LEAD_IDS[ld.id] || TEST_LEAD_RE.test(String(ld.name || '')); }

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
  // Тестовые/демо-сделки видит только Влад (для проверки цепочки кабинет→панель); у Даши их нет
  const showTests = /влад/i.test(String(payload?.name || ''));
  const leads = leadsRaw.filter(ld => showTests || !isTestLead(ld));
  const contactIds = [];
  for (const ld of leads) {
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
  // Массовый скан свежих заметок: последние КЛИЕНТУ-апдейты, ответы (ОТВЕТ:),
  // вопросы клиентов (ОТ КЛИЕНТА:) и идеи (ПОЖЕЛАНИЕ:) — для ленты активности
  // и маркера «ждёт ответа».
  const lastUpdateMap = {};
  const lastReplyMap = {};
  const lastMsgMap = {};
  const draftMap = {};
  const actRaw = [];
  const isIdeaNote = t => /^ПОЖЕЛАНИЕ:/i.test(String(t || '').trim());
  const stripIdea = t => String(t || '').trim().replace(/^ПОЖЕЛАНИЕ:\s*/i, '');
  try {
    for (let np = 1; np <= 4; np++) {
      const nr = await kommo('GET', `/leads/notes?filter[note_type]=common&order[updated_at]=desc&limit=250&page=${np}`);
      const notes = nr?._embedded?.notes || [];
      for (const n of notes) {
        const txt = (n.params?.text || '').trim();
        const lid = n.entity_id; const ts = (n.created_at || 0) * 1000;
        if (!txt || !lid || !ts) continue;
        if (isDraftNote(txt)) {
          // ИИ-черновик ответа (пишет cabinet-bot). Клиенту не виден — только Даше в панели.
          if (!draftMap[lid] || ts > draftMap[lid].at) draftMap[lid] = { at: ts, text: stripDraftPrefix(txt) };
        } else if (isClientNote(txt)) {
          if (!lastUpdateMap[lid] || ts > lastUpdateMap[lid]) lastUpdateMap[lid] = ts;
          if (!lastReplyMap[lid] || ts > lastReplyMap[lid]) lastReplyMap[lid] = ts;
        } else if (isChatReplyNote(txt)) {
          if (!lastReplyMap[lid] || ts > lastReplyMap[lid]) lastReplyMap[lid] = ts;
        } else if (isClientMsgNote(txt) || isIdeaNote(txt)) {
          if (!lastMsgMap[lid] || ts > lastMsgMap[lid]) lastMsgMap[lid] = ts;
          if (actRaw.length < 60) actRaw.push({
            leadId: lid, at: ts,
            kind: isIdeaNote(txt) ? 'idea' : 'chat',
            text: (isIdeaNote(txt) ? stripIdea(txt) : stripClientMsgPrefix(txt)).slice(0, 220),
          });
        }
      }
      if (notes.length < 250) break;
    }
  } catch (_) {}
  const list = []; const byStage = {};
  let active = 0, completed = 0, withAccess = 0, contractTotal = 0;
  for (const ld of leads) {
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
    const lastMsgMs = lastMsgMap[ld.id] || 0;
    const waiting = lastMsgMs > (lastReplyMap[ld.id] || 0);
    // Черновик показываем, только если он свежее последнего ответа (иначе он уже отработан)
    const dr = draftMap[ld.id];
    const draft = (dr && dr.at > (lastReplyMap[ld.id] || 0)) ? dr.text : '';
    // Порядковый номер закрытия и месяц — из имени сделки; без счётчика — месяц создания сделки
    const sq = parseSeq(ld.name);
    const monthKey = sq ? sq.monthKey : (ld.created_at ? new Date(ld.created_at * 1000).toISOString().slice(0, 7) : '');
    list.push({ leadId: ld.id, name: nm, phone: cm.phone, service: getCfValue(ld, CF_SERVICE_TYPE) || stage.service || '',
      stage: stKey, step: stage.step || 0, totalSteps: TOTAL_STEPS, price, isDone, hasAccess: cm.hasAccess, updatedMs, daysIdle,
      lastUpdateMs: lastUpdateMap[ld.id] || 0, lastMsgMs, waiting, seq: sq ? sq.seq : 0, monthKey,
      draft, crmUrl: `https://${KOMMO_SUBDOMAIN}.kommo.com/leads/detail/${ld.id}` });
  }
  list.sort((a, b) => (a.isDone !== b.isDone) ? (a.isDone ? 1 : -1) : (b.daysIdle - a.daysIdle));
  // Лента «кто что спрашивает»: свежие вопросы/идеи с именами клиентов
  const byLead = {};
  for (const c of list) byLead[c.leadId] = c;
  // Только сделки из списка панели — тестовые/демо и чужие воронки в ленту не попадают
  const activity = actRaw.filter(a => byLead[a.leadId]).slice(0, 40).map(a => {
    const c = byLead[a.leadId];
    return { ...a, name: c.name || 'Клиент', hasAccess: !!c.hasAccess, waiting: !!c.waiting };
  });
  return res.status(200).json({
    name: payload.name || 'Сотрудник',
    stats: { total: list.length, active, completed, withAccess, noAccess: list.length - withAccess, contractTotal,
      stale48: list.filter(x => !x.isDone && x.daysIdle >= 2).length,
      waiting: list.filter(x => x.waiting).length },
    byStage, clients: list, activity
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
  let updates = [], payments = [], chat = [], plan = null, draft = '', draftAt = 0;
  try {
    const nRes = await kommo('GET', `/leads/${leadId}/notes?limit=100`);
    const all = (nRes?._embedded?.notes || []).map(n => ({ id: n.id, createdAt: (n.created_at || 0) * 1000, text: (n.params?.text || '').trim() })).filter(n => n.text);
    // ИИ-черновик ответа — свежайший «ЧЕРНОВИК:», если он новее последнего нашего ответа
    const dNote = all.filter(n => isDraftNote(n.text)).sort((a, b) => b.createdAt - a.createdAt)[0];
    const lastOut = all.filter(n => isChatReplyNote(n.text) || (isClientNote(n.text) && !isPaymentNote(n.text))).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (dNote && (!lastOut || dNote.createdAt > lastOut.createdAt)) { draft = stripDraftPrefix(dNote.text); draftAt = dNote.createdAt; }
    updates = all.filter(n => isClientNote(n.text) && !isPaymentNote(n.text) && !isClientMsgNote(n.text)).map(n => ({ ...n, text: stripClientPrefix(n.text) })).sort((a, b) => b.createdAt - a.createdAt);
    payments = all.filter(n => isPaymentNote(n.text)).map(n => { const p = parsePaymentNote(n.text) || { amount: 0, method: '', dateText: '' }; return { id: n.id, createdAt: n.createdAt, amount: p.amount, method: p.method, dateText: p.dateText }; }).filter(p => p.amount > 0).sort((a, b) => b.createdAt - a.createdAt);
    // План рассрочки — НОВЕЙШАЯ заметка «ПЛАН ОПЛАТ» (пишет платёжный бот из таблицы закрытий)
    const planNote = all.filter(n => isPaymentPlanNote(n.text)).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (planNote) plan = parsePaymentPlanNote(planNote.text);
    // Чат = ТОЛЬКО живой диалог (как у клиента в me.js): ОТ КЛИЕНТА: + ОТВЕТ:.
    // Вехи «КЛИЕНТУ:» в чат не попадают — они в ленте статусов.
    chat = all.filter(n => (isClientMsgNote(n.text) || isChatReplyNote(n.text)) && !isPaymentNote(n.text))
      .map(n => isClientMsgNote(n.text)
        ? { from: 'client', text: stripClientMsgPrefix(n.text), createdAt: n.createdAt }
        : { from: 'manager', text: stripChatReplyPrefix(n.text), createdAt: n.createdAt })
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch (_) {}
  let tasks = [];
  try {
    const tRes = await kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${leadId}&filter[is_completed]=0&limit=20`);
    tasks = (tRes?._embedded?.tasks || []).map(t => ({ id: t.id, completeTill: t.complete_till * 1000, text: t.text || '' })).sort((a, b) => a.completeTill - b.completeTill);
  } catch (_) {}
  // Оплачено: план рассрочки (источник правды — таблица закрытий) приоритетнее разрозненных «ОПЛАТА:»
  const price = lead.price || (plan ? plan.total : 0) || 0;
  const notesPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const planPaid = plan ? plan.installments.filter(i => i.paid).reduce((s, i) => s + i.amount, 0) : 0;
  const paidTotal = Math.max(planPaid, notesPaid);
  const nextUnpaid = plan ? (plan.installments.find(i => !i.paid) || null) : null;
  return res.status(200).json({
    leadId: lead.id, name: displayName, phone, hasAccess,
    service: getCfValue(lead, CF_SERVICE_TYPE) || stage.service || '',
    stage: { ru: stage.ru, step: stage.step || 0, totalSteps: TOTAL_STEPS, whatWeDo: stage.whatWeDo || '', clientAction: stage.clientAction || '', etaText: stage.etaText || '' },
    price, paidTotal, remaining: price > paidTotal ? price - paidTotal : 0,
    nextDue: nextUnpaid ? { amount: nextUnpaid.amount, dateText: nextUnpaid.dateText } : null,
    payments, tasks, updates, chat, draft, draftAt,
    crmUrl: `https://${KOMMO_SUBDOMAIN}.kommo.com/leads/detail/${lead.id}`
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

// ── action=reply ── Даша отвечает клиенту в кабинет (заметка КЛИЕНТУ:)
async function actionReply(req, res) {
  const { leadId, text } = await readJsonBody(req);
  const lid = String(leadId || '').replace(/[^\d]/g, '');
  const msg = String(text || '').trim().slice(0, 1500);
  if (!lid) return res.status(400).json({ error: 'leadId_required' });
  if (!msg) return res.status(400).json({ error: 'text_required' });
  await kommo('POST', `/leads/${lid}/notes`, [
    { note_type: 'common', params: { text: 'ОТВЕТ: ' + msg } }
  ]);
  return res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const payload = verifyJwt(readCookie(req, 'cabinet_token'));
    if (!payload || !payload.staff) return res.status(401).json({ error: 'unauthorized' });
    const action = String(req.query?.action || '');
    if (req.method === 'GET' && action === 'data') return actionData(req, res, payload);
    if (req.method === 'GET' && action === 'client') return actionClient(req, res);
    if (req.method === 'POST' && action === 'set-password') return actionSetPassword(req, res);
    if (req.method === 'POST' && action === 'reply') return actionReply(req, res);
    return res.status(400).json({ error: 'bad_action' });
  } catch (e) {
    console.error('staff err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
