// POST /api/cabinet/set-password — для менеджера. Задаёт/меняет пароль клиента.
// Body: { contactId | phone, password, adminToken }
const {
  kommo, findContactByPhone, hashPassword, readJsonBody,
  PASSWORD_FIELD_ID, clientIp, rateLimitBlocked, rateLimitFail
} = require('./_helpers');

const ADMIN_TOKEN = process.env.CABINET_ADMIN_TOKEN || '';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const { contactId, phone, password, adminToken } = await readJsonBody(req);

    // Брутфорс admin-токена: общий per-IP пул с логином (30/15 мин).
    // Раньше эндпоинт был без лимита вовсе — токен можно было перебирать.
    const ip = clientIp(req);
    if (await rateLimitBlocked(ip, '__setpw__')) {
      return res.status(429).json({ error: 'too_many_attempts' });
    }

    // timing-safe сравнение admin-токена (обычное !== уязвимо к timing-атаке)
    const okToken = ADMIN_TOKEN && typeof adminToken === 'string' &&
      adminToken.length === ADMIN_TOKEN.length &&
      require('crypto').timingSafeEqual(Buffer.from(adminToken), Buffer.from(ADMIN_TOKEN));
    if (!okToken) {
      await rateLimitFail(ip, '__setpw__');
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'password_too_short' });
    }

    let cid = contactId;
    if (!cid && phone) {
      const c = await findContactByPhone(phone);
      if (!c) return res.status(404).json({ error: 'contact_not_found' });
      cid = c.id;
    }
    if (!cid) return res.status(400).json({ error: 'contact_id_or_phone_required' });

    const hash = hashPassword(password);
    await kommo('PATCH', `/contacts/${cid}`, {
      custom_fields_values: [
        { field_id: PASSWORD_FIELD_ID, values: [{ value: hash }] }
      ]
    });
    return res.status(200).json({ ok: true, contactId: cid });
  } catch (e) {
    console.error('set-password err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
