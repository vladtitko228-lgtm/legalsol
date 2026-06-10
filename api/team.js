// /api/team — единая функция-роутер для штатной консоли ИИ-апдейтов.
// (Объединено в один эндпоинт: Vercel Hobby = максимум 12 функций на деплой.)
//
//   GET  /api/team?op=list&adminToken=…           → список ИИ-черновиков на проверку
//   POST /api/team  { op:'draft',   leadId, adminToken, lang? }   → ИИ пишет черновик
//   POST /api/team  { op:'approve', leadId, adminToken, text }     → апрув: «КЛИЕНТУ: …»
//   POST /api/team  { op:'reject',  leadId, adminToken }           → отклонить черновик
//
// Всё под CABINET_ADMIN_TOKEN. Черновик клиенту не виден — только после approve.
const {
  kommo, addLeadNote, getCfValue, readJsonBody, decodeHtmlEntities,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS, CF_SERVICE_TYPE,
  isClientNote, isDraftNote, stripDraftPrefix,
  DRAFT_PREFIX, CLIENT_NOTE_PREFIX
} = require('./cabinet/_helpers');

const ADMIN_TOKEN = process.env.CABINET_ADMIN_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const REJECT_MARK = 'ЧЕРНОВИК ОТКЛОНЁН';
const MAX_LEADS = 60;
const LANG_NAME = { ru:'Russian', en:'English', pl:'Polish', uk:'Ukrainian', es:'Spanish', tr:'Turkish', az:'Azerbaijani', hi:'Hindi' };

async function callClaude(system, user) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type':'application/json', 'x-api-key':ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 400, system, messages: [{ role:'user', content:user }] })
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`Anthropic [${resp.status}]: ${t.slice(0,300)}`); }
  const data = await resp.json();
  return (data.content || []).map(b => b.text || '').join('').trim();
}

function cleanName(name, leadId) {
  return (name || '').replace(/\s+\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*$/, '').trim() || name || `Сделка ${leadId}`;
}

// ── op: list ──────────────────────────────────────────────
async function listDrafts(res) {
  const lRes = await kommo('GET', `/leads?filter[pipeline_id]=${PIPELINE_OPS}&order[updated_at]=desc&limit=${MAX_LEADS}`);
  const leads = lRes?._embedded?.leads || [];
  const pending = [];
  for (const lead of leads) {
    try {
      const nRes = await kommo('GET', `/leads/${lead.id}/notes?limit=50`);
      const notes = (nRes?._embedded?.notes || [])
        .map(n => ({ id:n.id, at:(n.created_at||0)*1000, text:decodeHtmlEntities(n.params?.text||'').trim() }))
        .filter(n => n.text).sort((a,b) => b.at - a.at);
      const draft = notes.find(n => isDraftNote(n.text));
      if (!draft) continue;
      const handled = notes.some(n => n.at >= draft.at && (isClientNote(n.text) || n.text.toUpperCase().startsWith(REJECT_MARK.toUpperCase())));
      if (handled) continue;
      const stage = STAGE_NAMES_OPS[lead.status_id] || { ru:'В работе', step:2 };
      pending.push({
        leadId: lead.id, draftNoteId: draft.id, name: cleanName(lead.name, lead.id),
        service: getCfValue(lead, CF_SERVICE_TYPE) || stage.service || '',
        stage: stage.ru, step: stage.step, draftText: stripDraftPrefix(draft.text), draftAt: draft.at
      });
    } catch (e) { console.error('list lead err', lead.id, e.message); }
  }
  pending.sort((a,b) => b.draftAt - a.draftAt);
  return res.status(200).json({ ok:true, count: pending.length, drafts: pending });
}

// ── op: draft ─────────────────────────────────────────────
async function makeDraft(res, leadId, lang) {
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error:'no_anthropic_key', message:'Не задан ANTHROPIC_API_KEY.' });
  const language = LANG_NAME[lang] ? lang : 'ru';
  const lead = await kommo('GET', `/leads/${leadId}`);
  if (!lead || !lead.id) return res.status(404).json({ error:'lead_not_found' });
  if (lead.pipeline_id !== PIPELINE_OPS) return res.status(400).json({ error:'not_ops_pipeline', message:'Сделка не в воронке Легализация.' });

  const stage = STAGE_NAMES_OPS[lead.status_id] || { ru:'В работе', step:2, whatWeDo:'', clientAction:null, etaText:null, service:'' };
  const serviceType = getCfValue(lead, CF_SERVICE_TYPE) || stage.service || 'Услуга легализации';

  let internalNotes = [], lastClientUpdate = '';
  try {
    const nRes = await kommo('GET', `/leads/${leadId}/notes?limit=100`);
    const all = (nRes?._embedded?.notes || [])
      .map(n => ({ at:(n.created_at||0)*1000, text:decodeHtmlEntities(n.params?.text||'').trim() }))
      .filter(n => n.text).sort((a,b) => b.at - a.at);
    internalNotes = all.filter(n => !isClientNote(n.text) && !isDraftNote(n.text)).slice(0, 8);
    const lc = all.find(n => isClientNote(n.text));
    if (lc) lastClientUpdate = lc.text;
  } catch (_) {}

  let nextTask = '';
  try {
    const tRes = await kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${leadId}&filter[is_completed]=0&limit=5`);
    const tasks = (tRes?._embedded?.tasks || []).map(t => ({ till:(t.complete_till||0)*1000, text:t.text||'' })).sort((a,b) => a.till - b.till);
    if (tasks[0]) nextTask = tasks[0].text;
  } catch (_) {}

  const system = [
    'You write short status updates for immigration-law clients of LegalSol (Warsaw).',
    `Write in ${LANG_NAME[language]}. Plain text only — no markdown, no headings, no emoji.`,
    'Audience: a non-lawyer foreigner waiting on their residence case. Tone: warm, calm, reassuring, professional.',
    'Length: 2–4 sentences, max ~50 words.',
    'STRICT RULES:',
    '- State ONLY what the inputs support. NEVER invent dates, decisions, outcomes, or amounts.',
    '- Do not promise approval or a specific finish date. If a timeframe is given, paraphrase as "typically".',
    '- Avoid legal jargon; a Polish office term is fine if unavoidable.',
    '- If internal notes have nothing client-relevant, summarise the current stage and that the team is actively working.',
    '- Do not repeat the previous client update verbatim — add only what is new.',
    'Output: just the message text the client will read. Nothing else.'
  ].join('\n');
  const user = [
    `SERVICE: ${serviceType}`,
    `CURRENT STAGE (step ${stage.step}/${TOTAL_STEPS}): ${stage.ru}`,
    stage.whatWeDo ? `WHAT WE DO NOW: ${stage.whatWeDo}` : '',
    `CLIENT ACTION NEEDED: ${stage.clientAction || 'none'}`,
    stage.etaText ? `TYPICAL TIMEFRAME: ${stage.etaText}` : '',
    nextTask ? `NEXT INTERNAL TASK: ${nextTask}` : '',
    lastClientUpdate ? `PREVIOUS UPDATE ALREADY SENT: ${lastClientUpdate}` : '',
    internalNotes.length ? 'INTERNAL TEAM NOTES (newest first, raw):\n' + internalNotes.map((n,i) => `${i+1}. ${n.text}`).join('\n') : 'INTERNAL TEAM NOTES: none',
    '', `Write the next client update in ${LANG_NAME[language]}.`
  ].filter(Boolean).join('\n');

  const draft = await callClaude(system, user);
  if (!draft) return res.status(502).json({ error:'empty_draft' });
  await addLeadNote(leadId, `${DRAFT_PREFIX} ${draft}`);
  return res.status(200).json({ ok:true, leadId, lang:language, draft });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const adminToken = req.query?.adminToken || '';
      if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) return res.status(401).json({ error:'unauthorized' });
      if ((req.query?.op || 'list') === 'list') return await listDrafts(res);
      return res.status(400).json({ error:'unknown_op' });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const { op, leadId, adminToken, text, lang } = body || {};
      if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) return res.status(401).json({ error:'unauthorized' });
      if (!leadId) return res.status(400).json({ error:'lead_id_required' });
      if (op === 'draft')  return await makeDraft(res, leadId, lang);
      if (op === 'reject') { await addLeadNote(leadId, REJECT_MARK); return res.status(200).json({ ok:true, action:'reject', leadId }); }
      if (op === 'approve') {
        const finalText = String(text || '').trim();
        if (!finalText) return res.status(400).json({ error:'text_required' });
        await addLeadNote(leadId, `${CLIENT_NOTE_PREFIX} ${finalText}`);
        return res.status(200).json({ ok:true, action:'approve', leadId });
      }
      return res.status(400).json({ error:'unknown_op' });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error:'method_not_allowed' });
  } catch (e) {
    console.error('team err:', e.message);
    return res.status(500).json({ error:'server_error', message:e.message });
  }
};
