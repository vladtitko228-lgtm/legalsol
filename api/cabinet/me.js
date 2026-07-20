// GET /api/cabinet/me — данные авторизованного клиента из Kommo.
// Показываем ТОЛЬКО сделки из Pipeline 2 (Легализация) — это оплаченные клиенты.
const {
  kommo, getCfValue, getCfAllValues, verifyJwt, readCookie, readJsonBody,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS, serviceNameEn, isChatReplyNote, stripChatReplyPrefix,
  isClientNote, stripClientPrefix,
  isPaymentNote, parsePaymentNote,
  isPaymentPlanNote, parsePaymentPlanNote,
  CLIENT_MSG_PREFIX, isClientMsgNote, stripClientMsgPrefix,
  PHONE_FIELD_ID, EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO, CF_PASSPORT, CF_DOB, CF_SERVICE_TYPE,
  kvCmd
} = require('./_helpers');

// Чистит имя сделки от служебных суффиксов: «Mohammad Habibur Rahman 08/05/2026» → «Mohammad Habibur Rahman»
function cleanLeadName(name) {
  if (!name) return '';
  let s = String(name)
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

    // ── GET ?chat=<leadId>: лёгкий поллинг чата (1–2 запроса Kommo вместо каскада).
    // Владение сделкой проверяем по KV-кэшу списка сделок клиента (TTL 10 мин).
    if (req.method === 'GET' && req.query && req.query.chat) {
      const lid = String(req.query.chat).replace(/[^\d]/g, '');
      if (!lid) return res.status(400).json({ error: 'bad_lead' });
      let own = null;
      try { const c0 = await kvCmd('GET', 'cab:own:' + payload.cid); if (c0) own = JSON.parse(c0); } catch (_) {}
      if (!own) {
        const cR = await kommo('GET', `/contacts/${payload.cid}?with=leads`);
        own = (cR?._embedded?.leads || []).map(l => String(l.id));
        try { await kvCmd('SET', 'cab:own:' + payload.cid, JSON.stringify(own), 'EX', 600); } catch (_) {}
      }
      if (own.indexOf(lid) < 0) return res.status(403).json({ error: 'forbidden' });
      const nR = await kommo('GET', `/leads/${lid}/notes?limit=100`);
      const allN = (nR?._embedded?.notes || [])
        .map(n => ({ createdAt: (n.created_at || 0) * 1000, text: (n.params?.text || '').trim() }))
        .filter(n => n.text);
      const chat = allN
        .filter(n => (isClientNote(n.text) || isClientMsgNote(n.text) || isChatReplyNote(n.text)) && !isPaymentNote(n.text))
        .map(n => isClientMsgNote(n.text)
          ? { from: 'client', text: stripClientMsgPrefix(n.text), createdAt: n.createdAt }
          : { from: 'manager', text: isChatReplyNote(n.text) ? stripChatReplyPrefix(n.text) : stripClientPrefix(n.text), createdAt: n.createdAt })
        .sort((a, b) => a.createdAt - b.createdAt);
      const updates = allN
        .filter(n => isClientNote(n.text) && !isPaymentNote(n.text) && !isClientMsgNote(n.text))
        .map(n => ({ ...n, text: stripClientPrefix(n.text) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      return res.status(200).json({ chat, updates });
    }

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
      await kommo('POST', `/leads/${targetLead}/notes`, [
        { note_type: 'common', params: { text: CLIENT_MSG_PREFIX + ' ' + text } }
      ]);
      try { await kvCmd('DEL', 'cab:me:' + payload.cid); } catch (_) {}
      return res.status(200).json({ ok: true });
    }

    // KV-кэш ответа /me (25с): срезает каскад из десятков Kommo-запросов при
    // повторных заходах/обновлениях. Инвалидация — при POST-сообщении клиента.
    try {
      const cached = await kvCmd('GET', 'cab:me:' + payload.cid);
      if (cached) { res.setHeader('X-Cab-Cache', 'hit'); return res.status(200).json(JSON.parse(cached)); }
    } catch (_) {}

    // 1) Контакт
    const cRes = await kommo('GET', `/contacts/${payload.cid}?with=leads`);
    if (!cRes || !cRes.id) return res.status(404).json({ error: 'contact_not_found' });

    const phones = getCfAllValues(cRes, PHONE_FIELD_ID);
    const emails = getCfAllValues(cRes, EMAIL_FIELD_ID);

    // 2) Сделки контакта: тянем подробности → фильтруем по Pipeline 2 (Легализация)
    const allLeadIds = (cRes._embedded?.leads || []).map(l => l.id).slice(0, 20);
    const leads = [];
    let displayName = cRes.name || '';

    // Префетч параллельными чанками (по 5 — щадим rate-limit Kommo ~7 rps):
    // раньше 1+N+2M запросов шли строго последовательно → 1–3+ сек на /me.
    const leadMap = {}, notesMap = {}, tasksMap = {};
    for (let ci = 0; ci < allLeadIds.length; ci += 5) {
      await Promise.all(allLeadIds.slice(ci, ci + 5).map(async lid => {
        try { leadMap[lid] = await kommo('GET', `/leads/${lid}?with=contacts`); } catch (_) { leadMap[lid] = null; }
      }));
    }
    const opsIds = allLeadIds.filter(lid => leadMap[lid] && leadMap[lid].pipeline_id === PIPELINE_OPS);
    for (let ci = 0; ci < opsIds.length; ci += 5) {
      await Promise.all(opsIds.slice(ci, ci + 5).map(async lid => {
        const [nR, tR] = await Promise.all([
          kommo('GET', `/leads/${lid}/notes?limit=100`).catch(() => null),
          kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${lid}&filter[is_completed]=0&limit=10`).catch(() => null)
        ]);
        notesMap[lid] = nR; tasksMap[lid] = tR;
      }));
    }

    for (const lid of allLeadIds) {
      try {
        const lead = leadMap[lid];
        if (!lead) continue;

        // Кабинет — только для оплаченных клиентов (Pipeline 2)
        if (lead.pipeline_id !== PIPELINE_OPS) continue;

        // Тянем все заметки → выделяем клиентские (с префиксом 📢) и платёжные (ОПЛАТА:)
        let updates = [];
        let payments = [];
        let chat = [];
        let plan = null;
        try {
          const nRes = notesMap[lid];
          const all = (nRes?._embedded?.notes || []).map(n => ({
            id: n.id,
            createdAt: (n.created_at || 0) * 1000,
            text: (n.params?.text || '').trim(),
            type: n.note_type,
            author: n.created_by || null
          })).filter(n => n.text);
          // Только клиентские текстовые апдейты (префиксы >>>, 📢, [c], [К], [к], КЛИЕНТУ:).
          // Платёжные (ОПЛАТА:) и сообщения клиента (ОТ КЛИЕНТА:) исключаем.
          updates = all
            .filter(n => isClientNote(n.text) && !isPaymentNote(n.text) && !isClientMsgNote(n.text))
            .map(n => ({ ...n, text: stripClientPrefix(n.text) }))
            .sort((a, b) => b.createdAt - a.createdAt);

          // Платежи — заметки с префиксом ОПЛАТА: (ставит TG-бот /paid или менеджер вручную)
          payments = all
            .filter(n => isPaymentNote(n.text))
            .map(n => {
              const p = parsePaymentNote(n.text) || { amount: 0, method: '', dateText: '', raw: '' };
              return { id: n.id, createdAt: n.createdAt, amount: p.amount, method: p.method, dateText: p.dateText };
            })
            .filter(p => p.amount > 0)
            .sort((a, b) => b.createdAt - a.createdAt);

          // План рассрочки — последняя заметка «ПЛАН ОПЛАТ» (пишет TG-бот, /plan)
          const planNote = all
            .filter(n => isPaymentPlanNote(n.text))
            .sort((a, b) => b.createdAt - a.createdAt)[0];
          if (planNote) plan = parsePaymentPlanNote(planNote.text);

          // Двусторонний чат: КЛИЕНТУ: → менеджер, ОТ КЛИЕНТА: → клиент. По возрастанию времени.
          chat = all
            .filter(n => (isClientNote(n.text) || isClientMsgNote(n.text) || isChatReplyNote(n.text)) && !isPaymentNote(n.text))
            .map(n => isClientMsgNote(n.text)
              ? { from: 'client', text: stripClientMsgPrefix(n.text), createdAt: n.createdAt }
              : { from: 'manager', text: isChatReplyNote(n.text) ? stripChatReplyPrefix(n.text) : stripClientPrefix(n.text), createdAt: n.createdAt })
            .sort((a, b) => a.createdAt - b.createdAt);
        } catch (_) {}
        // Для совместимости со старыми именами в JSON-ответе
        const notes = updates;

        // Задачи (ближайшие активные). ТЕКСТ задач — внутренняя кухня («дожать по оплате»),
        // клиенту НЕ отдаём; фронт использует только дату для дедлайнов.
        let tasks = [];
        try {
          const tRes = tasksMap[lid];
          tasks = (tRes?._embedded?.tasks || []).map(t => ({
            id: t.id,
            completeTill: t.complete_till * 1000,
            taskType: t.task_type_id
          })).sort((a, b) => a.completeTill - b.completeTill);
        } catch (_) {}

        // История смены этапов (Kommo events) — «роадмап» для ленты дела
        let stageHistory = [];
        try {
          const er = await kommo('GET', `/events?filter[entity]=lead&filter[entity_id]=${lid}&filter[type]=lead_status_changed&limit=30`);
          stageHistory = (er?._embedded?.events || []).map(e => {
            const toId = e.value_after?.[0]?.lead_status?.id;
            if (toId === 142 || toId === 143) return null; // случайные клики в «закрыто» не показываем клиенту
            const st = STAGE_NAMES_OPS[toId];
            return st ? { ts: (e.created_at || 0) * 1000, en: st.en, ru: st.ru, step: st.step } : null;
          }).filter(Boolean).sort((a, b) => a.ts - b.ts);
        } catch (_) {}

        const stage = STAGE_NAMES_OPS[lead.status_id] || { ru: 'В работе', en: 'In progress', pl: 'W toku', step: 2, service: '', whatWeDo: '', clientAction: null, etaText: null };
        const serviceType = getCfValue(lead, CF_SERVICE_TYPE) || stage.service || 'Услуга легализации';
        const serviceTypeEn = serviceNameEn(serviceType) || stage.serviceEn || 'Legalization service';
        const cleanName = cleanLeadName(lead.name);

        // Если в контакте имя = «+48...», вытаскиваем из имени сделки
        if (looksLikePhoneOnly(displayName) && cleanName && !looksLikePhoneOnly(cleanName)) {
          displayName = cleanName;
        }

        const price = lead.price || 0;
        // Оплачено = максимум из заметок «ОПЛАТА:» и оплаченных взносов плана
        // (у клиентов из sheet-синка фактов оплат в заметках нет — только план).
        const paidFromNotes = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const paidFromPlan = plan
          ? plan.installments.filter(i => i.paid).reduce((s, i) => s + (i.amount || 0), 0)
          : 0;
        const paidTotal = Math.max(paidFromNotes, paidFromPlan);

        leads.push({
          id: lead.id,
          name: cleanName || lead.name || '',
          serviceType,
          price,
          paidTotal,
          remaining: price > paidTotal ? price - paidTotal : 0,
          payments,
          plan,
          createdAt: lead.created_at * 1000,
          updatedAt: lead.updated_at * 1000,
          pipelineId: lead.pipeline_id,
          statusId: lead.status_id,
          stage,
          // Срок/действие текущего этапа — для страницы «Дедлайны» (типовые, не внутренние задачи)
          etaText: stage.etaText || '',
          clientAction: stage.clientAction || '',
          whatWeDo: stage.whatWeDo || '',
          etaTextEn: stage.etaTextEn || '',
          clientActionEn: stage.clientActionEn || '',
          whatWeDoEn: stage.whatWeDoEn || '',
          serviceTypeEn,
          stageHistory,
          totalSteps: TOTAL_STEPS,
          notes,        // совместимость — здесь только клиентские (с 📢)
          updates,      // тоже клиентские, более явное имя
          chat,         // двусторонний чат: {from:'client'|'manager', text, createdAt}
          tasks
        });
      } catch (e) {
        console.error('lead fetch err:', e.message);
      }
    }

    // Stripe включён только если на сервере заданы оба ключа — фронт по флагу показывает «Оплатить онлайн»
    const stripeEnabled = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

    const out = {
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
      hasActiveCases: leads.length > 0,
      stripeEnabled
    };
    try { await kvCmd('SET', 'cab:me:' + payload.cid, JSON.stringify(out), 'EX', 25); } catch (_) {}
    return res.status(200).json(out);
  } catch (e) {
    console.error('me err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
