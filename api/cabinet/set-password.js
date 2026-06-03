// POST /api/cabinet/set-password — для менеджера. Задаёт/меняет пароль клиента.
// Body: { contactId | phone, password, adminToken }
const {
  kommo, findContactByPhone, hashPassword, readJsonBody,
  PASSWORD_FIELD_ID
} = require('./_helpers');

const ADMIN_TOKEN = process.env.CABINET_ADMIN_TOKEN || '';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const { contactId, phone, password, adminToken } = await readJsonBody(req);

    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!password || password.length < 4) {
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
