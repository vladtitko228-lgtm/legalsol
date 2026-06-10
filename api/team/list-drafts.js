// GET /api/team/list-drafts?adminToken=...  — список НЕобработанных ИИ-черновиков.
// Сканирует сделки воронки «Легализация», для каждой смотрит заметки:
// черновик «ЧЕРНОВИК ИИ:» считается ожидающим, если после него НЕТ ни
// клиентского апдейта («КЛИЕНТУ:»), ни отклонения («ЧЕРНОВИК ОТКЛОНЁН»).
const {
  kommo, getCfValue, decodeHtmlEntities,
  STAGE_NAMES_OPS, PIPELINE_OPS, CF_SERVICE_TYPE,
  isClientNote, isDraftNote, stripDraftPrefix
} = require('../cabinet/_helpers');

const ADMIN_TOKEN = process.env.CABINET_ADMIN_TOKEN || '';
const REJECT_MARK = 'ЧЕРНОВИК ОТКЛОНЁН';
const MAX_LEADS = 60;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const adminToken = req.query?.adminToken || '';
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Активные сделки воронки Легализация (свежие сверху)
    const lRes = await kommo('GET', `/leads?filter[pipeline_id]=${PIPELINE_OPS}&order[updated_at]=desc&limit=${MAX_LEADS}`);
    const leads = lRes?._embedded?.leads || [];
    const pending = [];

    for (const lead of leads) {
      try {
        const nRes = await kommo('GET', `/leads/${lead.id}/notes?limit=50`);
        const notes = (nRes?._embedded?.notes || [])
          .map(n => ({ id: n.id, at: (n.created_at || 0) * 1000, text: decodeHtmlEntities(n.params?.text || '').trim() }))
          .filter(n => n.text)
          .sort((a, b) => b.at - a.at);

        const draft = notes.find(n => isDraftNote(n.text));
        if (!draft) continue;
        // обработан, если после черновика есть клиентский апдейт или отметка отклонения
        const handled = notes.some(n => n.at >= draft.at &&
          (isClientNote(n.text) || n.text.toUpperCase().startsWith(REJECT_MARK.toUpperCase())));
        if (handled) continue;

        const stage = STAGE_NAMES_OPS[lead.status_id] || { ru: 'В работе', step: 2 };
        pending.push({
          leadId: lead.id,
          draftNoteId: draft.id,
          name: (lead.name || '').replace(/\s+\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*$/, '').trim() || lead.name || `Сделка ${lead.id}`,
          service: getCfValue(lead, CF_SERVICE_TYPE) || stage.service || '',
          stage: stage.ru,
          step: stage.step,
          draftText: stripDraftPrefix(draft.text),
          draftAt: draft.at
        });
      } catch (e) {
        console.error('list-drafts lead err', lead.id, e.message);
      }
    }

    pending.sort((a, b) => b.draftAt - a.draftAt);
    return res.status(200).json({ ok: true, count: pending.length, drafts: pending });
  } catch (e) {
    console.error('list-drafts err:', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
