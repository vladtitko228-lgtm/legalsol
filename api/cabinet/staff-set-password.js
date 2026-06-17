// POST /api/cabinet/staff-set-password — Даша (сотрудник) заводит клиенту доступ в кабинет.
// Авторизация: staff-сессия (cookie cabinet_token с {staff:true}). Body: { phone, password }.
// Находит контакт в Kommo по телефону → пишет scrypt-хеш пароля в поле PASSWORD_FIELD_ID.
const {
  kommo, findContactByPhone, getCfValue, hashPassword, readJsonBody, normalizePhone,
  verifyJwt, readCookie,
  PASSWORD_FIELD_ID, PIPELINE_OPS,
  clientIp, rateLimitBlocked, rateLimitFail
} = require('./_helpers');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    // Только вошедший сотрудник
    const payload = verifyJwt(readCookie(req, 'cabinet_token'));
    if (!payload || !payload.staff) return res.status(401).json({ error: 'unauthorized' });

    const ip = clientIp(req);
    if (await rateLimitBlocked(ip, '__staffpw__')) {
      return res.status(429).json({ error: 'too_many_attempts' });
    }

    const { phone, password } = await readJsonBody(req);
    if (!phone) return res.status(400).json({ error: 'phone_required' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'password_too_short', message: 'Пароль — минимум 6 символов.' });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 9) return res.status(400).json({ error: 'invalid_phone' });

    const contact = await findContactByPhone(normalized);
    if (!contact) {
      await rateLimitFail(ip, '__staffpw__');
      return res.status(404).json({ error: 'contact_not_found', message: 'Клиент с таким телефоном не найден в Kommo. Сначала заведите карточку и переведите в воронку «Легализация».' });
    }

    // Проверим, есть ли у контакта сделка в Pipeline 2 (иначе клиент войдёт, но дел не увидит)
    let inOps = false;
    try {
      const leadIds = (contact._embedded?.leads || []).map(l => l.id).slice(0, 20);
      for (const lid of leadIds) {
        const lead = await kommo('GET', `/leads/${lid}`);
        if (lead && lead.pipeline_id === PIPELINE_OPS) { inOps = true; break; }
      }
    } catch (_) {}

    const hash = hashPassword(String(password));
    await kommo('PATCH', `/contacts/${contact.id}`, {
      custom_fields_values: [
        { field_id: PASSWORD_FIELD_ID, values: [{ value: hash }] }
      ]
    });

    const already = !!getCfValue(contact, PASSWORD_FIELD_ID);
    return res.status(200).json({
      ok: true,
      contactId: contact.id,
      name: contact.name || '',
      login: '+' + normalized,
      inOps,                 // false → предупредим: клиент не в воронке Легализации
      updated: already       // true → у клиента уже был пароль (перезаписали)
    });
  } catch (e) {
    console.error('staff-set-password err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
