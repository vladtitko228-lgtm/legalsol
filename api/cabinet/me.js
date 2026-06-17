// GET /api/cabinet/me — данные авторизованного клиента из Kommo.
// Показываем ТОЛЬКО сделки из Pipeline 2 (Легализация) — это оплаченные клиенты.
const {
  kommo, getCfValue, getCfAllValues, verifyJwt, readCookie,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS,
  isClientNote, stripClientPrefix,
  isPaymentNote, parsePaymentNote,
  PHONE_FIELD_ID, EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO, CF_PASSPORT, CF_DOB, CF_SERVICE_TYPE
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  // Ответ содержит ПДн (паспорт/гражданство/заметки) — запрещаем любое кэширование
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const token = readCookie(req, 'cabinet_token');
    const payload = verifyJwt(token);
    if (!payload || !payload.cid) return res.status(401).json({ error: 'unauthorized' });

    // 1) Контакт
    const cRes = await kommo('GET', `/contacts/${payload.cid}?with=leads`);
    if (!cRes || !cRes.id) return res.status(404).json({ error: 'contact_not_found' });

    const phones = getCfAllValues(cRes, PHONE_FIELD_ID);
    const emails = getCfAllValues(cRes, EMAIL_FIELD_ID);

    // 2) Сделки контакта: тянем подробности → фильтруем по Pipeline 2 (Легализация)
    const allLeadIds = (cRes._embedded?.leads || []).map(l => l.id).slice(0, 20);
    const leads = [];
    let displayName = cRes.name || '';

    for (const lid of allLeadIds) {
      try {
        const lead = await kommo('GET', `/leads/${lid}?with=contacts`);
        if (!lead) continue;

        // Кабинет — только для оплаченных клиентов (Pipeline 2)
        if (lead.pipeline_id !== PIPELINE_OPS) continue;

        // Тянем все заметки → выделяем клиентские (с префиксом 📢) и платёжные (ОПЛАТА:)
        let updates = [];
        let payments = [];
        try {
          const nRes = await kommo('GET', `/leads/${lid}/notes?limit=100`);
          const all = (nRes?._embedded?.notes || []).map(n => ({
            id: n.id,
            createdAt: (n.created_at || 0) * 1000,
            text: (n.params?.text || '').trim(),
            type: n.note_type,
            author: n.created_by || null
          })).filter(n => n.text);
          // Только клиентские текстовые апдейты (префиксы >>>, 📢, [c], [К], [к], КЛИЕНТУ:).
          // Платёжные заметки (ОПЛАТА:) исключаем — они идут отдельным списком payments.
          updates = all
            .filter(n => isClientNote(n.text) && !isPaymentNote(n.text))
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
        } catch (_) {}
        // Для совместимости со старыми именами в JSON-ответе
        const notes = updates;

        // Задачи (ближайшие активные). ТЕКСТ задач — внутренняя кухня («дожать по оплате»),
        // клиенту НЕ отдаём; фронт использует только дату для дедлайнов.
        let tasks = [];
        try {
          const tRes = await kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${lid}&filter[is_completed]=0&limit=10`);
          tasks = (tRes?._embedded?.tasks || []).map(t => ({
            id: t.id,
            completeTill: t.complete_till * 1000,
            taskType: t.task_type_id
          })).sort((a, b) => a.completeTill - b.completeTill);
        } catch (_) {}

        const stage = STAGE_NAMES_OPS[lead.status_id] || { ru: 'В работе', en: 'In progress', pl: 'W toku', step: 2, service: '', whatWeDo: '', clientAction: null, etaText: null };
        const serviceType = getCfValue(lead, CF_SERVICE_TYPE) || stage.service || 'Услуга легализации';
        const cleanName = cleanLeadName(lead.name);

        // Если в контакте имя = «+48...», вытаскиваем из имени сделки
        if (looksLikePhoneOnly(displayName) && cleanName && !looksLikePhoneOnly(cleanName)) {
          displayName = cleanName;
        }

        const price = lead.price || 0;
        const paidTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);

        leads.push({
          id: lead.id,
          name: cleanName || lead.name || '',
          serviceType,
          price,
          paidTotal,
          remaining: price > paidTotal ? price - paidTotal : 0,
          payments,
          createdAt: lead.created_at * 1000,
          updatedAt: lead.updated_at * 1000,
          pipelineId: lead.pipeline_id,
          statusId: lead.status_id,
          stage,
          // Срок/действие текущего этапа — для страницы «Дедлайны» (типовые, не внутренние задачи)
          etaText: stage.etaText || '',
          clientAction: stage.clientAction || '',
          whatWeDo: stage.whatWeDo || '',
          totalSteps: TOTAL_STEPS,
          notes,        // совместимость — здесь только клиентские (с 📢)
          updates,      // тоже клиентские, более явное имя
          tasks
        });
      } catch (e) {
        console.error('lead fetch err:', e.message);
      }
    }

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
