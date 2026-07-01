// POST /api/owner/login  body: { phone, password } → owner-кука.
// Владелец из env (OWNER_PHONE + OWNER_PASSWORD_HASH), не из Kommo.
const O = require('./_owner');
const H = O.H;

const DUMMY = 'scrypt$' + '0'.repeat(32) + '$' + '0'.repeat(64);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    if (!O.OWNER_HASH || !O.OWNER_PHONE) {
      return res.status(500).json({ error: 'owner_not_configured' });
    }
    const { phone, password } = await H.readJsonBody(req);
    if (!phone || !password) return res.status(400).json({ error: 'phone_and_password_required' });

    const norm = H.normalizePhone(phone);
    const ip = H.clientIp(req);
    if (await H.rateLimitBlocked(ip, norm)) {
      return res.status(429).json({ error: 'too_many_attempts', message: 'Слишком много попыток. Подождите 15 минут.' });
    }

    // Холостой scrypt при промахе телефона — чтобы время ответа не выдавало номер владельца.
    const phoneOk = norm === O.OWNER_PHONE;
    const pwOk = H.verifyPassword(password, phoneOk ? O.OWNER_HASH : DUMMY);
    if (!phoneOk || !pwOk) {
      await H.rateLimitFail(ip, norm);
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    await H.rateLimitReset(ip, norm);
    O.setOwnerCookie(res, H.signJwt({ role: 'owner' }));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('owner login err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
