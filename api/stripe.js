// /api/stripe?action=checkout|webhook — онлайн-оплата взносов через Stripe Checkout.
//
// checkout (POST, нужна клиентская сессия кабинета):
//   body {leadId} → проверяем, что сделка принадлежит клиенту, СЕРВЕРОМ определяем
//   сумму к оплате (следующий неоплаченный взнос из «ПЛАН ОПЛАТ», иначе остаток
//   price − оплаты) — сумме с фронта не доверяем. Возвращаем {url} Checkout-сессии
//   (BLIK / карта / P24 — что включено в дашборде Stripe).
//
// webhook (POST от Stripe, подпись Stripe-Signature):
//   checkout.session.completed → заметка «ОПЛАТА: N zł · Stripe · дата» в сделку →
//   график в кабинете обновляется сам, продавцы видят оплату в Kommo.
//
// Env (Vercel): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Без npm-зависимостей.
const crypto = require('crypto');
const {
  kommo, verifyJwt, readCookie, readJsonBody,
  isPaymentPlanNote, parsePaymentPlanNote, isPaymentNote, parsePaymentNote,
  PIPELINE_OPS
} = require('./cabinet/_helpers');

const SK = process.env.STRIPE_SECRET_KEY || '';
const WH = process.env.STRIPE_WEBHOOK_SECRET || '';
const SITE = 'https://www.legalsol.pl';

async function stripeApi(path, params) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || ('stripe http ' + r.status));
  return j;
}

// Сумма к оплате по сделке: следующий неоплаченный взнос плана; Stripe-оплаты,
// прошедшие ПОСЛЕ публикации плана, считаем уже покрывшими первые неоплаченные
// взносы (продавец отметит их в таблице позже — до тех пор не даём платить дважды).
async function amountDue(leadId) {
  const nRes = await kommo('GET', `/leads/${leadId}/notes?limit=100`);
  const notes = (nRes?._embedded?.notes || [])
    .filter(n => n.note_type === 'common' && n.params?.text);
  const planNote = notes
    .filter(n => isPaymentPlanNote(n.params.text))
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
  if (planNote) {
    const plan = parsePaymentPlanNote(planNote.params.text);
    if (plan) {
      const unpaid = plan.installments.filter(i => !i.paid);
      const stripeAfterPlan = notes.filter(n =>
        isPaymentNote(n.params.text) &&
        /stripe/i.test(n.params.text) &&
        (n.created_at || 0) > (planNote.created_at || 0)).length;
      const next = unpaid[stripeAfterPlan];
      if (next && next.amount > 0) return next.amount;
      return 0; // всё оплачено (или ждём синка таблицы)
    }
  }
  // Плана нет — остаток: price − все ОПЛАТА-заметки.
  const lead = await kommo('GET', `/leads/${leadId}`);
  const paid = notes.filter(n => isPaymentNote(n.params.text))
    .reduce((s, n) => s + ((parsePaymentNote(n.params.text) || {}).amount || 0), 0);
  return Math.max(0, (lead?.price || 0) - paid);
}

async function actionCheckout(req, res) {
  if (!SK) return res.status(503).json({ error: 'stripe_not_configured' });
  const payload = verifyJwt(readCookie(req, 'cabinet_token'));
  if (!payload || !payload.cid) return res.status(401).json({ error: 'unauthorized' });
  const { leadId } = await readJsonBody(req);
  const lid = String(leadId || '').replace(/[^\d]/g, '');
  if (!lid) return res.status(400).json({ error: 'leadId_required' });

  // Сделка должна принадлежать этому клиенту и быть в воронке «Легализация».
  const lead = await kommo('GET', `/leads/${lid}?with=contacts`);
  const owns = (lead?._embedded?.contacts || []).some(c => c.id === payload.cid);
  if (!owns || lead.pipeline_id !== PIPELINE_OPS) return res.status(403).json({ error: 'forbidden' });

  const amount = await amountDue(lid);
  if (amount <= 0) return res.status(400).json({ error: 'nothing_due' });

  const session = await stripeApi('/checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'pln',
    'line_items[0][price_data][unit_amount]': String(amount * 100),
    'line_items[0][price_data][product_data][name]': `LegalSol — rata (sprawa LS${lid})`,
    client_reference_id: lid,
    'metadata[leadId]': lid,
    success_url: SITE + '/?pay=success',
    cancel_url: SITE + '/?pay=cancel'
  });
  return res.status(200).json({ url: session.url, amount });
}

// Сырое тело — для проверки подписи Stripe.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSig(raw, header) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false; // защита от повтора
  const expected = crypto.createHmac('sha256', WH).update(`${t}.${raw}`).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1)); }
  catch (_) { return false; }
}

async function actionWebhook(req, res) {
  if (!WH) return res.status(503).json({ error: 'stripe_not_configured' });
  const raw = await readRawBody(req);
  if (!verifyStripeSig(raw.toString('utf8'), req.headers['stripe-signature'])) {
    return res.status(400).json({ error: 'bad_signature' });
  }
  let event; try { event = JSON.parse(raw.toString('utf8')); } catch (_) { return res.status(400).json({ error: 'bad_json' }); }
  if (event.type === 'checkout.session.completed') {
    const s = event.data?.object || {};
    const lid = String(s.metadata?.leadId || s.client_reference_id || '').replace(/[^\d]/g, '');
    if (lid && s.payment_status === 'paid') {
      const amount = Math.round((s.amount_total || 0) / 100);
      const date = new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' }).replace(/\//g, '.');
      await kommo('POST', `/leads/${lid}/notes`, [{
        note_type: 'common',
        params: { text: `ОПЛАТА: ${amount} zł · Stripe · ${date}\n(автоматически: Checkout ${s.id || ''})` }
      }]);
    }
  }
  return res.status(200).json({ received: true });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query?.action || '');
  try {
    if (req.method === 'POST' && action === 'checkout') return await actionCheckout(req, res);
    if (req.method === 'POST' && action === 'webhook') return await actionWebhook(req, res);
    return res.status(400).json({ error: 'bad_action' });
  } catch (e) {
    console.error('stripe err:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
