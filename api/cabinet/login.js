// POST /api/cabinet/login  body: { phone, password }
// Найти контакт в Kommo по телефону, проверить пароль из кастомного поля → выдать cookie.
const {
  findContactByPhone, getCfValue, verifyPassword, signJwt, setAuthCookie,
  readJsonBody, normalizePhone, PASSWORD_FIELD_ID,
  clientIp, rateLimitBlocked, rateLimitFail, rateLimitReset,
  findStaffByPhone, kommo, PIPELINE_OPS
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

    // Защита от перебора: ≥5 неудач на (IP+телефон) или ≥30 на IP за 15 мин → блок.
    const ip = clientIp(req);
    if (await rateLimitBlocked(ip, normalized)) {
      return res.status(429).json({ error: 'too_many_attempts', message: 'Слишком много попыток входа. Попробуйте через 15 минут или напишите менеджеру в WhatsApp.' });
    }

    // ── СОТРУДНИК (Даша и др.) — вход в админ-панель ──
    const staff = findStaffByPhone(normalized);
    if (staff) {
      if (!verifyPassword(password, staff.hash)) {
        await rateLimitFail(ip, normalized);
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      await rateLimitReset(ip, normalized);
      const stoken = signJwt({ staff: true, name: staff.name });
      setAuthCookie(res, stoken);
      return res.status(200).json({ ok: true, staff: true, name: staff.name });
    }

    const contact = await findContactByPhone(normalized);
    const storedHash = contact ? getCfValue(contact, PASSWORD_FIELD_ID) : null;

    // ЕДИНЫЙ ответ для всех неудач (нет контакта / нет пароля / неверный пароль),
    // иначе перебором телефонов можно вычислить, кто из них клиент LS (база ПДн).
    // Подсказку «менеджер ещё не задал пароль» показывает страница логина статически.
    // Холостой scrypt при промахе — чтобы время ответа не выдавало существование контакта.
    const ok = storedHash
      ? verifyPassword(password, storedHash)
      : (verifyPassword(password, 'scrypt$' + '0'.repeat(32) + '$' + '0'.repeat(64)), false);
    if (!ok) {
      await rateLimitFail(ip, normalized);
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    await rateLimitReset(ip, normalized);
    // След входа: заметка «🔑 Вход в кабинет» в деле производства — владелец видит
    // в табло, что доступ дошёл (клиент вошёл = рассылка сработала). Не критично — в try.
    try {
      const leadIds = ((contact._embedded && contact._embedded.leads) || []).map(l => l.id).slice(0, 5);
      for (const lid of leadIds) {
        const l = await kommo('GET', `/leads/${lid}`);
        if (l && l.pipeline_id === PIPELINE_OPS) {
          await kommo('POST', `/leads/${lid}/notes`, [
            { note_type: 'common', params: { text: '🔑 Вход в кабинет' } }
          ]);
          break;
        }
      }
    } catch (_) {}
    const token = signJwt({ cid: contact.id });
    setAuthCookie(res, token);
    return res.status(200).json({ ok: true, name: contact.name || '' });
  } catch (e) {
    console.error('login err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
