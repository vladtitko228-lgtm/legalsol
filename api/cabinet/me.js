// GET /api/cabinet/me — данные авторизованного клиента из Kommo.
// Показываем ТОЛЬКО сделки из Pipeline 2 (Легализация) — это оплаченные клиенты.
const {
  kommo, getCfValue, getCfAllValues, verifyJwt, readCookie, readJsonBody,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS,
  isClientNote, stripClientPrefix,
  isPaymentNote, parsePaymentNote,
  CLIENT_MSG_PREFIX, isClientMsgNote, stripClientMsgPrefix,
  chatAppend, chatRead, updatesRead,
  PHONE_FIELD_ID, EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO, CF_PASSPORT, CF_DOB, CF_SERVICE_TYPE
} = require('./_helpers');

// Чистит имя сделки от служебных суффиксов: «Mohammad Habibur Rahman 08/05/2026» → «Mohammad Habibur Rahman»
function cleanLeadName(name) {
  if (!name) return '';
  let s = String(name)
    .replace(/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s+/, '')    // дата в начале (внутр. номер)
    .replace(/\s+\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*$/, '') // дата в конце
    .replace(/^(Facebook|Instagram|TikTok)\s*№?\s*\d+/i, '')   // тех-имена из ads
    .replace(/^Lead\s*#\d+/i, '')
    .trim();
  return s;
}

function looksLikePhoneOnly(name) {
  if (!name) return false;
  return /^[\s+()\-\d]+$/.test(String(name).trim());
}

// Парсим дату из текста заметки/задачи: dd.mm.yyyy | dd.mm.yy | dd/mm | dd-mm-yyyy.
function parseDateToken(s) {
  const m = String(s).match(/\b([0-3]?\d)[.\/-]([01]?\d)(?:[.\/-](\d{2,4}))?\b/);
  if (!m) return null;
  const d = +m[1], mo = +m[2] - 1; let y = m[3] ? +m[3] : new Date().getUTCFullYear();
  if (d < 1 || d > 31 || mo < 0 || mo > 11) return null;
  if (y < 100) y += 2000;
  const ms = Date.UTC(y, mo, d, 9, 0, 0);
  return isNaN(ms) ? null : ms;
}

// «Реальные» даты дела из заметок/задач (биометрия/отпечатки и решение/дицизия).
// items: [{text, ts}] от новых к старым. Берём дату из самой свежей подходящей записи.
// Возвращаем ТОЛЬКО даты (ms) — текст заметок клиенту не отдаём.
function extractCaseDates(items) {
  const res = { biometrics: null, decision: null };
  // лат. транслит/польский тоже: otpeczatki/otpaczatki/otpechatki, odciski, biometria, wezwanie
  const bioRe = /отпечат|биометр|biometr|odcisk|wezwani|fingerprint|otp\w*atk/i;
  const decRe = /дициз|децизи|decyz|реш(ени|ение|ения)|decision|pozytyw|negatyw/i;
  const sorted = items.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  for (const it of sorted) {
    const t = it.text || ''; if (!t) continue;
    const dt = parseDateToken(t); if (!dt) continue;
    if (!res.biometrics && bioRe.test(t)) res.biometrics = dt;
    if (!res.decision && decRe.test(t)) res.decision = dt;
    if (res.biometrics && res.decision) break;
  }
  return res;
}

module.exports = async function handler(req, res) {
  // Ответ содержит ПДн (паспорт/гражданство/заметки) — запрещаем любое кэширование
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const token = readCookie(req, 'cabinet_token');
    const payload = verifyJwt(token);
    if (!payload) return res.status(401).json({ error: 'unauthorized' });

    // Сотрудник (Даша) — отдаём роль, без клиентских данных. Фронт покажет админ-панель.
    if (payload.staff) {
      return res.status(200).json({ role: 'staff', name: payload.name || 'Сотрудник' });
    }
    if (!payload.cid) return res.status(401).json({ error: 'unauthorized' });

    // ── POST: клиент пишет сообщение менеджеру → заметка «ОТ КЛИЕНТА:» в его сделку ──
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const text = String(body.text || '').trim().slice(0, 1500);
      const leadId = String(body.leadId || '').replace(/[^\d]/g, '');
      if (!text) return res.status(400).json({ error: 'text_required' });
      // Проверяем, что сделка принадлежит этому контакту и она в воронке Легализации
      const cRes2 = await kommo('GET', `/contacts/${payload.cid}?with=leads`);
      const ownLeadIds = (cRes2?._embedded?.leads || []).map(l => String(l.id));
      let targetLead = leadId && ownLeadIds.indexOf(leadId) >= 0 ? leadId : null;
      if (!targetLead) {
        // нет указанной — берём первую сделку клиента в Pipeline 2
        for (const lid of ownLeadIds) {
          const l = await kommo('GET', `/leads/${lid}`);
          if (l && l.pipeline_id === PIPELINE_OPS) { targetLead = String(lid); break; }
        }
      }
      if (!targetLead) return res.status(404).json({ error: 'no_lead' });
      // Переписку пишем в KV, а НЕ заметкой в Kommo — чтобы не мусорить в карточке.
      await chatAppend(targetLead, 'client', text);
      return res.status(200).json({ ok: true });
    }

    // 1) Контакт
    const cRes = await kommo('GET', `/contacts/${payload.cid}?with=leads`);
    if (!cRes || !cRes.id) return res.status(404).json({ error: 'contact_not_found' });

    const phones = getCfAllValues(cRes, PHONE_FIELD_ID);
    const emails = getCfAllValues(cRes, EMAIL_FIELD_ID);

    // 2) Сделки контакта: тянем подробности → фильтруем по Pipeline 2 (Легализация)
    const allLeadIds = (cRes._embedded?.leads || []).map(l => l.id).slice(0, 20);
    const leads = [];
    // Имя клиента: чистим внутренний дата-номер (13/05/2026 …) — клиент его видеть не должен
    let displayName = cleanLeadName(cRes.name || '') || cRes.name || '';

    // ⚡ Параллельно: сделки тянем все сразу, а внутри каждой — заметки/задачи/чат/апдейты
    // одним батчем (Promise.all). Было последовательно (~15 round-trip → 4с), стало ~3 уровня.
    const leadResults = await Promise.all(allLeadIds.map(async (lid) => {
      try {
        const lead = await kommo('GET', `/leads/${lid}?with=contacts`);
        if (!lead || lead.pipeline_id !== PIPELINE_OPS) return null; // кабинет — только Pipeline 2

        const [nRes, tRes, chat, updates] = await Promise.all([
          kommo('GET', `/leads/${lid}/notes?limit=100`).catch(() => null),
          kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${lid}&filter[is_completed]=0&limit=10`).catch(() => null),
          chatRead(lid).catch(() => []),       // KV
          updatesRead(lid).catch(() => []),    // KV
        ]);

        let lastActivityMs = (lead.updated_at || 0) * 1000;
        const _dateTexts = [];
        const all = (nRes?._embedded?.notes || []).map(n => ({
          id: n.id, createdAt: (n.created_at || 0) * 1000, text: (n.params?.text || '').trim(), type: n.note_type, author: n.created_by || null
        })).filter(n => n.text);
        all.forEach(n => { _dateTexts.push({ text: n.text, ts: n.createdAt }); if (n.createdAt > lastActivityMs) lastActivityMs = n.createdAt; });

        const payments = all
          .filter(n => isPaymentNote(n.text))
          .map(n => { const p = parsePaymentNote(n.text) || { amount: 0, method: '', dateText: '', raw: '' }; return { id: n.id, createdAt: n.createdAt, amount: p.amount, method: p.method, dateText: p.dateText }; })
          .filter(p => p.amount > 0).sort((a, b) => b.createdAt - a.createdAt);

        const rawTasks = tRes?._embedded?.tasks || [];
        const tasks = rawTasks.map(t => ({ id: t.id, completeTill: t.complete_till * 1000, taskType: t.task_type_id })).sort((a, b) => a.completeTill - b.completeTill);
        rawTasks.forEach(t => { if (t.text) _dateTexts.push({ text: t.text, ts: (t.created_at || 0) * 1000 }); });

        const realDates = extractCaseDates(_dateTexts);
        const stage = STAGE_NAMES_OPS[lead.status_id] || { ru: 'В работе', en: 'In progress', pl: 'W toku', step: 2, service: '', whatWeDo: '', clientAction: null, etaText: null };
        const serviceType = getCfValue(lead, CF_SERVICE_TYPE) || stage.service || 'Услуга легализации';
        const cleanName = cleanLeadName(lead.name);
        const price = lead.price || 0;
        const paidTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);

        return {
          id: lead.id, name: cleanName || lead.name || '', serviceType, price, paidTotal,
          remaining: price > paidTotal ? price - paidTotal : 0, payments,
          createdAt: lead.created_at * 1000, updatedAt: lead.updated_at * 1000,
          pipelineId: lead.pipeline_id, statusId: lead.status_id, stage,
          etaText: stage.etaText || '', clientAction: stage.clientAction || '', whatWeDo: stage.whatWeDo || '',
          totalSteps: TOTAL_STEPS,
          notes: updates,   // совместимость
          updates, chat, tasks,
          lastActivity: lastActivityMs, realDates,
          _cleanName: cleanName,
        };
      } catch (e) { console.error('lead fetch err:', e.message); return null; }
    }));

    for (const l of leadResults) if (l) leads.push(l);
    // Имя клиента: если в контакте имя = телефон, берём чистое имя из сделки
    if (looksLikePhoneOnly(displayName)) {
      const fromLead = leads.find(l => l._cleanName && !looksLikePhoneOnly(l._cleanName));
      if (fromLead) displayName = fromLead._cleanName;
    }
    leads.forEach(l => { delete l._cleanName; });

    return res.status(200).json({
      contact: {
        id: cRes.id,
        name: displayName,
        phone: phones[0] || (looksLikePhoneOnly(cRes.name) ? cRes.name : ''),
        email: emails[0] || '',
        citizenship: getCfValue(cRes, CF_GRAZHDANSTVO),
        passport: getCfValue(cRes, CF_PASSPORT),
        birthDate: getCfValue(cRes, CF_DOB)
      },
      leads,
      hasActiveCases: leads.length > 0
    });
  } catch (e) {
    console.error('me err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
