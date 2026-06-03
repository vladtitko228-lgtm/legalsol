// POST /api/cabinet/login  body: { phone, password }
// Найти контакт в Kommo по телефону, проверить пароль из кастомного поля → выдать cookie.
const {
  findContactByPhone, getCfValue, verifyPassword, signJwt, setAuthCookie,
  readJsonBody, normalizePhone, PASSWORD_FIELD_ID
} = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const { phone, password } = await readJsonBody(req);
    if (!phone || !password) return res.status(400).json({ error: 'phone_and_password_required' });

    const normalized = normalizePhone(phone);
    if (normalized.length < 9) return res.status(400).json({ error: 'invalid_phone' });

    const contact = await findContactByPhone(normalized);
    // Не палим существует ли контакт — обобщённая ошибка
    if (!contact) return res.status(401).json({ error: 'invalid_credentials' });

    const storedHash = getCfValue(contact, PASSWORD_FIELD_ID);
    if (!storedHash) return res.status(401).json({ error: 'no_password_set', message: 'Менеджер ещё не задал вам пароль. Напишите в WhatsApp.' });

    if (!verifyPassword(password, storedHash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = signJwt({ cid: contact.id });
    setAuthCookie(res, token);
    return res.status(200).json({ ok: true, name: contact.name || '' });
  } catch (e) {
    console.error('login err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
