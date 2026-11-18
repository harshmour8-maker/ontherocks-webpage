// Shared helpers for the On The Rocks API (Vercel serverless functions).
// Files starting with "_" inside /api are NOT exposed as routes by Vercel.
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// PRICE LIST — the server always re-prices the cart from here, so nobody can
// tamper with prices in the browser. Keep in sync with the prices in index.html.
// ---------------------------------------------------------------------------
const CATALOG = {
  otr1kg:  { n: 'On The Rocks 1 kg', p: 80 },
  cube:    { n: 'The Cube',          p: 25 },
  globe:   { n: 'The Globe',         p: 40 },
  pillar:  { n: 'The Pillar',        p: 30 },
  diamond: { n: 'The Diamond',       p: 50 },
  stamp:   { n: 'Branded Ice',       p: 50 },
};

const env = (k, d = '') => (process.env[k] || d).trim();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const clean = (v, max = 300) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanMultiline = (v, max = 1500) =>
  String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupees = n => '₹' + Number(n).toLocaleString('en-IN');
const PHONE_RE = /^[+\d\s-]{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function priceCart(items) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Your cart is empty.');
  let total = 0;
  const lines = [];
  for (const it of items.slice(0, 30)) {
    const prod = CATALOG[it && it.id];
    const qty = Math.floor(Number(it && it.qty));
    if (!prod || !(qty >= 1 && qty <= 1000)) {
      throw new HttpError(400, 'Your cart has an item we could not price. Please refresh the page and try again.');
    }
    total += prod.p * qty;
    lines.push(`${qty} x ${prod.n} (${rupees(prod.p * qty)})`);
  }
  return { total, lines };
}

function checkCustomer(c) {
  c = c || {};
  const out = {
    name: clean(c.name, 80),
    phone: clean(c.phone, 20),
    email: clean(c.email, 120),
    city: clean(c.city, 80),
    address: clean(c.address, 250),
  };
  if (!out.name || !PHONE_RE.test(out.phone) || !out.city || !out.address) {
    throw new HttpError(400, 'Add your name, a valid phone number, city and address.');
  }
  if (out.email && !EMAIL_RE.test(out.email)) out.email = '';
  return out;
}

// ---------------------------------------------------------------------------
// Razorpay REST (no SDK needed)
// ---------------------------------------------------------------------------
async function razorpay(path, body) {
  const id = env('RAZORPAY_KEY_ID'), secret = env('RAZORPAY_KEY_SECRET');
  if (!id || !secret) throw new HttpError(503, 'Online payment is not set up yet. Please order on WhatsApp.');
  const r = await fetch('https://api.razorpay.com/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Razorpay ${r.status}: ${JSON.stringify(j.error || j)}`);
  return j;
}

function validSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', env('RAZORPAY_KEY_SECRET'))
    .update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// Email via Resend (https://resend.com) — a plain HTTPS call, no packages.
async function sendEmail({ to, subject, text, html, replyTo }) {
  const key = env('RESEND_API_KEY');
  const list = (Array.isArray(to) ? to : String(to || '').split(',')).map(s => s.trim()).filter(Boolean);
  if (!key || !list.length) return { skipped: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('MAIL_FROM', 'On The Rocks <onboarding@resend.dev>'),
      to: list, subject, text, html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return { ok: true };
}

// WhatsApp alert to the owner. Two options (set WA_PROVIDER):
//   callmebot – free, 2-minute setup, good for alerts to your own number.
//   cloud     – official Meta WhatsApp Cloud API using an approved template.
async function sendWhatsApp(text) {
  const provider = env('WA_PROVIDER', 'callmebot').toLowerCase();

  if (provider === 'callmebot') {
    // CALLMEBOT_PHONE and CALLMEBOT_APIKEY can be comma-separated lists (same order) to alert several people.
    const phones = env('CALLMEBOT_PHONE').split(',').map(s => s.trim()).filter(Boolean);
    const keys = env('CALLMEBOT_APIKEY').split(',').map(s => s.trim()).filter(Boolean);
    if (!phones.length || phones.length !== keys.length) return { skipped: true };
    for (let i = 0; i < phones.length; i++) {
      const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phones[i]) +
        '&text=' + encodeURIComponent(text.slice(0, 1500)) + '&apikey=' + encodeURIComponent(keys[i]);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`CallMeBot ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    return { ok: true };
  }

  if (provider === 'cloud') {
    const token = env('WA_TOKEN'), phoneId = env('WA_PHONE_NUMBER_ID');
    const recipients = env('WA_NOTIFY_TO').split(',').map(s => s.trim()).filter(Boolean);
    if (!token || !phoneId || !recipients.length) return { skipped: true };
    // Template variables cannot contain new lines, so the alert is flattened with " | ".
    const param = text.replace(/\s*\n+\s*/g, ' | ').replace(/ {4,}/g, '   ').slice(0, 1000);
    for (const to of recipients) {
      const r = await fetch(`https://graph.facebook.com/${env('WA_API_VERSION', 'v23.0')}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to, type: 'template',
          template: {
            name: env('WA_TEMPLATE', 'owner_alert'),
            language: { code: env('WA_TEMPLATE_LANG', 'en') },
            components: [{ type: 'body', parameters: [{ type: 'text', text: param }] }],
          },
        }),
      });
      if (!r.ok) throw new Error(`WhatsApp Cloud API ${r.status}: ${(await r.text()).slice(0, 300)}`);
    }
    return { ok: true };
  }

  return { skipped: true };
}

// Alert the business on every configured channel. Returns how many channels delivered.
async function notifyOwner({ subject, text, html, replyTo }) {
  const results = await Promise.allSettled([
    sendEmail({ to: env('NOTIFY_EMAIL'), subject, text, html, replyTo }),
    sendWhatsApp(subject + '\n\n' + text),
  ]);
  let delivered = 0;
  results.forEach((r, i) => {
    const ch = i ? 'whatsapp' : 'email';
    if (r.status === 'rejected') console.error(`[notify:${ch}]`, r.reason && r.reason.message);
    else if (r.value && r.value.ok) delivered++;
    else console.warn(`[notify:${ch}] not configured — skipped`);
  });
  return delivered;
}

async function emailCustomer(to, subject, text, html) {
  if (!to) return;
  try { await sendEmail({ to, subject, text, html, replyTo: env('REPLY_TO_EMAIL') || undefined }); }
  catch (e) { console.error('[notify:customer-email]', e.message); }
}

// Simple branded HTML wrapper for emails.
function emailHtml(title, rows, footer = '') {
  const tr = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:pre-line">${esc(v)}</td></tr>`).join('');
  return `<div style="font-family:Montserrat,Helvetica,Arial,sans-serif;max-width:560px;margin:auto;border:2px solid #000">
  <div style="background:#000;color:#fff;padding:18px 20px;font-weight:900;font-size:20px;letter-spacing:.02em;text-transform:uppercase">${esc(title)}</div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${tr}</table>
  ${footer ? `<p style="padding:14px 20px;margin:0;font-size:13px;color:#555">${footer}</p>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// Request wrapper: POST-only, JSON, optional CORS, uniform errors.
// ---------------------------------------------------------------------------
function handler(fn) {
  return async (req, res) => {
    const allowed = env('ALLOWED_ORIGIN');
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const out = await fn(body || {}, req);
      res.status(200).json(out);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Something went wrong on our side. Please try again or WhatsApp us.' });
    }
  };
}

const istNow = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

module.exports = {
  CATALOG, env, HttpError, clean, cleanMultiline, esc, rupees, PHONE_RE, EMAIL_RE,
  priceCart, checkCustomer, razorpay, validSignature,
  sendEmail, sendWhatsApp, notifyOwner, emailCustomer, emailHtml, handler, istNow,
};
