// POST /api/team/ai-draft  — ИИ-черновик апдейта клиенту (draft → апрув сотрудника).
// Body: { leadId, adminToken, lang? }   lang ∈ ru|en|pl|uk|es|tr|az|hi (default ru)
//
// Что делает:
//   1) Читает сделку из Kommo (этап Pipeline 2, тип услуги, внутренние заметки, задачи)
//   2) Просит Claude написать КОРОТКИЙ понятный апдейт клиенту на его языке
//      — строго по фактам из этапа/заметок, без выдумок про даты и исход
//   3) Постит черновик в Kommo как заметку с префиксом «ЧЕРНОВИК ИИ:»
//      → клиент его НЕ видит (не клиентский префикс). Сотрудник аппрувит на /team.
//
// Безопасность: вызов только с правильным CABINET_ADMIN_TOKEN.
// Никогда не пишет клиентский апдейт напрямую — только черновик.
const {
  kommo, addLeadNote, getCfValue, readJsonBody,
  STAGE_NAMES_OPS, TOTAL_STEPS, PIPELINE_OPS,
  isClientNote, isDraftNote, decodeHtmlEntities,
  DRAFT_PREFIX, CF_SERVICE_TYPE
} = require('../cabinet/_helpers');

const ADMIN_TOKEN = process.env.CABINET_ADMIN_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const LANG_NAME = {
  ru: 'Russian', en: 'English', pl: 'Polish', uk: 'Ukrainian',
  es: 'Spanish', tr: 'Turkish', az: 'Azerbaijani', hi: 'Hindi'
};

async function callClaude(system, user) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic [${resp.status}]: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.content || []).map(b => b.text || '').join('').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const { leadId, adminToken, lang } = await readJsonBody(req);

    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'no_anthropic_key', message: 'Set ANTHROPIC_API_KEY env var.' });
    }
    if (!leadId) return res.status(400).json({ error: 'lead_id_required' });

    const language = LANG_NAME[lang] ? lang : 'ru';

    // 1) Сделка
    const lead = await kommo('GET', `/leads/${leadId}`);
    if (!lead || !lead.id) return res.status(404).json({ error: 'lead_not_found' });
    if (lead.pipeline_id !== PIPELINE_OPS) {
      return res.status(400).json({ error: 'not_ops_pipeline', message: 'Сделка не в воронке Легализация — кабинет её не показывает.' });
    }

    const stage = STAGE_NAMES_OPS[lead.status_id] || { ru: 'В работе', step: 2, whatWeDo: '', clientAction: null, etaText: null, service: '' };
    const serviceType = getCfValue(lead, CF_SERVICE_TYPE) || stage.service || 'Услуга легализации';

    // 2) Заметки: разделяем внутренние (сырьё для ИИ) и уже показанные клиенту
    let internalNotes = [], lastClientUpdate = '';
    try {
      const nRes = await kommo('GET', `/leads/${leadId}/notes?limit=100`);
      const all = (nRes?._embedded?.notes || [])
        .map(n => ({ createdAt: (n.created_at || 0) * 1000, text: decodeHtmlEntities(n.params?.text || '').trim() }))
        .filter(n => n.text)
        .sort((a, b) => b.createdAt - a.createdAt);
      // Внутренние = НЕ клиентские и НЕ черновики ИИ (это рабочие заметки менеджеров)
      internalNotes = all.filter(n => !isClientNote(n.text) && !isDraftNote(n.text)).slice(0, 8);
      const lastClient = all.find(n => isClientNote(n.text));
      if (lastClient) lastClientUpdate = lastClient.text;
    } catch (_) {}

    // 3) Ближайшая задача
    let nextTask = '';
    try {
      const tRes = await kommo('GET', `/tasks?filter[entity_type]=leads&filter[entity_id]=${leadId}&filter[is_completed]=0&limit=5`);
      const tasks = (tRes?._embedded?.tasks || []).map(t => ({ till: (t.complete_till || 0) * 1000, text: t.text || '' })).sort((a, b) => a.till - b.till);
      if (tasks[0]) nextTask = tasks[0].text;
    } catch (_) {}

    // 4) Промпт
    const system = [
      'You write short status updates for immigration-law clients of LegalSol (Warsaw).',
      `Write in ${LANG_NAME[language]}. Plain text only — no markdown, no headings, no emoji.`,
      'Audience: a non-lawyer foreigner waiting on their residence case. Tone: warm, calm, reassuring, professional.',
      'Length: 2–4 sentences, max ~50 words.',
      'STRICT RULES:',
      '- State ONLY what the inputs support. NEVER invent dates, decisions, outcomes, or amounts.',
      '- Do not promise approval or a specific finish date. If a timeframe is given in inputs, you may paraphrase it as "typically".',
      '- Do not include legal jargon or Polish office-internal terms unless unavoidable; if a Polish term appears, keep it but it is fine.',
      '- If the internal notes contain nothing client-relevant, summarise the current stage and that the team is actively working on it.',
      '- Do not repeat the previous client update verbatim — add only what is new.',
      'Output: just the message text the client will read. Nothing else.'
    ].join('\n');

    const user = [
      `SERVICE: ${serviceType}`,
      `CURRENT STAGE (step ${stage.step}/${TOTAL_STEPS}): ${stage.ru}`,
      stage.whatWeDo ? `WHAT WE DO NOW: ${stage.whatWeDo}` : '',
      stage.clientAction ? `CLIENT ACTION NEEDED: ${stage.clientAction}` : 'CLIENT ACTION NEEDED: none',
      stage.etaText ? `TYPICAL TIMEFRAME: ${stage.etaText}` : '',
      nextTask ? `NEXT INTERNAL TASK: ${nextTask}` : '',
      lastClientUpdate ? `PREVIOUS UPDATE ALREADY SENT TO CLIENT: ${lastClientUpdate}` : '',
      internalNotes.length
        ? 'INTERNAL TEAM NOTES (newest first, raw, may be in Polish/Russian):\n' + internalNotes.map((n, i) => `${i + 1}. ${n.text}`).join('\n')
        : 'INTERNAL TEAM NOTES: none',
      '',
      `Write the next client update in ${LANG_NAME[language]}.`
    ].filter(Boolean).join('\n');

    const draft = await callClaude(system, user);
    if (!draft) return res.status(502).json({ error: 'empty_draft' });

    // 5) Постим как ЧЕРНОВИК (клиент не видит)
    await addLeadNote(leadId, `${DRAFT_PREFIX} ${draft}`);

    return res.status(200).json({ ok: true, leadId, lang: language, draft });
  } catch (e) {
    console.error('ai-draft err:', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
