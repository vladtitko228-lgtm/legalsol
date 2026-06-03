// GET /api/cabinet/me — данные авторизованного клиента из Kommo.
const {
  kommo, getCfValue, getCfAllValues, verifyJwt, readCookie,
  STAGE_NAMES, TOTAL_STEPS,
  PHONE_FIELD_ID, EMAIL_FIELD_ID,
  CF_GRAZHDANSTVO, CF_PASSPORT, CF_DOB, CF_SERVICE_TYPE
} = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const token = readCookie(req, 'cabinet_token');
    const payload = verifyJwt(token);
    if (!payload || !payload.cid) return res.status(401).json({ error: 'unauthorized' });

    // 1) Контакт
    const cRes = await kommo('GET', `/contacts/${payload.cid}?with=leads`);
    if (!cRes || !cRes.id) return res.status(404).json({ error: 'contact_not_found' });

    const phones = getCfAllValues(cRes, PHONE_FIELD_ID);
    const emails = getCfAllValues(cRes, EMAIL_FIELD_ID);

    // 2) Сделки контакта — тянем подробности и заметки
    const leadIds = (cRes._embedded?.leads || []).map(l => l.id).slice(0, 10);
    const leads = [];
    for (const lid of leadIds) {
      try {
        const lead = await kommo('GET', `/leads/${lid}?with=contacts`);
        if (!lead) continue;

        // Заметки
        let notes = [];
        try {
          const nRes = await kommo('GET', `/leads/${lid}/notes?limit=20&filter[note_type][]=common&filter[note_type][]=service_message&filter[note_type][]=invoice_paid`);
          notes = (nRes?._embedded?.notes || []).map(n => ({
            id: n.id,
            createdAt: n.created_at * 1000,
            text: n.params?.text || '',
            type: n.note_type
          })).filter(n => n.text).sort((a, b) => b.createdAt - a.createdAt);
        } catch (_) {}

        // Задачи
        let tasks = [];
        try {
          const tRes = await kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${lid}&filter[is_completed]=0&limit=10`);
          tasks = (tRes?._embedded?.tasks || []).map(t => ({
            id: t.id,
            completeTill: t.complete_till * 1000,
            text: t.text || '',
            taskType: t.task_type_id
          })).sort((a, b) => a.completeTill - b.completeTill);
        } catch (_) {}

        const stage = STAGE_NAMES[lead.status_id] || { ru: 'В работе', en: 'In progress', pl: 'W toku', step: 2 };
        const serviceType = getCfValue(lead, CF_SERVICE_TYPE);
        leads.push({
          id: lead.id,
          name: lead.name || '',
          serviceType: serviceType || '',
          price: lead.price || 0,
          createdAt: lead.created_at * 1000,
          updatedAt: lead.updated_at * 1000,
          pipelineId: lead.pipeline_id,
          statusId: lead.status_id,
          stage,
          totalSteps: TOTAL_STEPS,
          notes,
          tasks
        });
      } catch (e) {
        console.error('lead fetch err:', e.message);
      }
    }

    return res.status(200).json({
      contact: {
        id: cRes.id,
        name: cRes.name || '',
        phone: phones[0] || '',
        email: emails[0] || '',
        citizenship: getCfValue(cRes, CF_GRAZHDANSTVO),
        passport: getCfValue(cRes, CF_PASSPORT),
        birthDate: getCfValue(cRes, CF_DOB)
      },
      leads
    });
  } catch (e) {
    console.error('me err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
