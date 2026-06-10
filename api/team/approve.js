// POST /api/team/approve  — сотрудник аппрувит/отклоняет ИИ-черновик.
// Body: { leadId, adminToken, action: 'approve'|'reject', text? }
//   approve → постит «КЛИЕНТУ: <text>» (клиент увидит в кабинете)
//   reject  → постит внутреннюю отметку «ЧЕРНОВИК ОТКЛОНЁН» (черновик уходит из списка)
// text при approve — финальный текст (сотрудник мог отредактировать черновик).
const { addLeadNote, readJsonBody, CLIENT_NOTE_PREFIX } = require('../cabinet/_helpers');

const ADMIN_TOKEN = process.env.CABINET_ADMIN_TOKEN || '';
const REJECT_MARK = 'ЧЕРНОВИК ОТКЛОНЁН';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const { leadId, adminToken, action, text } = await readJsonBody(req);
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!leadId) return res.status(400).json({ error: 'lead_id_required' });

    if (action === 'reject') {
      await addLeadNote(leadId, `${REJECT_MARK}`);
      return res.status(200).json({ ok: true, action: 'reject', leadId });
    }

    // approve
    const finalText = String(text || '').trim();
    if (!finalText) return res.status(400).json({ error: 'text_required' });
    await addLeadNote(leadId, `${CLIENT_NOTE_PREFIX} ${finalText}`);
    return res.status(200).json({ ok: true, action: 'approve', leadId });
  } catch (e) {
    console.error('approve err:', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
