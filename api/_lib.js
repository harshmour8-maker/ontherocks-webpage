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
  // Delivery: free from FREE_DELIVERY_FROM (default ₹299), otherwise DELIVERY_FEE (default ₹99).
  const subtotal = total, d = deliveryRules();
  const delivery = subtotal < d.freeFrom ? d.fee : 0;
  lines.push(delivery ? `Delivery (${rupees(delivery)})` : 'Delivery (FREE)');
  return { total: subtotal + delivery, subtotal, delivery, lines };
}

// Change in Vercel without touching code: FREE_DELIVERY_FROM (default 299), DELIVERY_FEE (default 99).
function deliveryRules() {
  const n = (k, d) => { const v = Number(env(k)); return env(k) !== '' && Number.isFinite(v) && v >= 0 ? v : d; };
  return { freeFrom: n('FREE_DELIVERY_FROM', 299), fee: n('DELIVERY_FEE', 99) };
}

function checkCustomer(c) {
  c = c || {};
  const out = {
    name: clean(c.name, 80),
    phone: clean(c.phone, 20),
    email: clean(c.email, 120),
    city: clean(c.city, 80),
    address: clean(c.address, 250),     // flat / house no., floor, landmark
    mapAddress: clean(c.mapAddress, 250), // address of the pin chosen on the map
  };
  // Optional map pin from the checkout map (decimal degrees). Kept only if it is inside India.
  const lat = Number(c.lat), lng = Number(c.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 5 && lat < 38 && lng > 67 && lng < 99) {
    out.lat = Math.round(lat * 1e6) / 1e6;
    out.lng = Math.round(lng * 1e6) / 1e6;
  }
  // The delivery spot must be chosen on the map (set REQUIRE_MAP_PIN=no in Vercel to turn this off).
  if (out.lat === undefined && env('REQUIRE_MAP_PIN', 'yes') !== 'no') {
    throw new HttpError(400, 'Please select your delivery address on the map.');
  }
  if (out.lat !== undefined) {
    const area = deliveryArea();
    if (distanceKm(out.lat, out.lng, area.lat, area.lng) > area.km) {
      throw new HttpError(400, `Sorry, we currently deliver only within ${area.name}. Please choose an address in ${area.name}, or WhatsApp us for other places.`);
    }
  }
  if (!out.address) throw new HttpError(400, 'Add your flat / house number and a landmark.');
  if (!out.city) out.city = '-';
  if (!out.name || !PHONE_RE.test(out.phone)) throw new HttpError(400, 'Add your name and a valid phone number.');
  if (out.email && !EMAIL_RE.test(out.email)) out.email = '';
  return out;
}

// Where we deliver: a circle around a centre point. Change it in Vercel without touching code:
//   DELIVERY_AREA_NAME (default Guwahati), DELIVERY_LAT / DELIVERY_LNG (centre), DELIVERY_RADIUS_KM (default 20)
function deliveryArea() {
  const n = (k, d) => { const v = Number(env(k)); return Number.isFinite(v) && env(k) !== '' ? v : d; };
  return { name: env('DELIVERY_AREA_NAME', 'Guwahati'), lat: n('DELIVERY_LAT', 26.1445), lng: n('DELIVERY_LNG', 91.7362), km: n('DELIVERY_RADIUS_KM', 20) };
}
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371, r = x => x * Math.PI / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Google Maps link for a pinned location ("lat,lng"), or '' when there is none.
function mapLink(latlng) {
  return /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(String(latlng || '')) ? 'https://www.google.com/maps?q=' + latlng : '';
}

// ---------------------------------------------------------------------------
// Razorpay REST (no SDK needed)
// ---------------------------------------------------------------------------
async function razorpay(path, body, method) {
  const id = env('RAZORPAY_KEY_ID'), secret = env('RAZORPAY_KEY_SECRET');
  if (!id || !secret) throw new HttpError(503, 'Online payment is not set up yet. Please order on WhatsApp.');
  const r = await fetch('https://api.razorpay.com/v1/' + path, {
    method: method || (body ? 'POST' : 'GET'),
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
async function sendEmail({ to, subject, text, html, replyTo, tag }) {
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
      ...(tag ? { tags: [{ name: 'category', value: tag.toLowerCase() }] } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return { ok: true };
}

// Alert the business by email. Returns 1 if the email was sent, 0 if not.
// tag ('ORDER' or 'ENQUIRY') is put at the start of the subject, e.g. "[ORDER] ...", so your
// inbox can filter/label them automatically. It is also sent to Resend as a tag.
// (WhatsApp alerts were removed at the owner's request.)
async function notifyOwner({ subject, text, html, replyTo, tag }) {
  if (tag) subject = `[${tag}] ${subject}`;
  try {
    const r = await sendEmail({ to: env('NOTIFY_EMAIL'), subject, text, html, replyTo, tag });
    if (r && r.ok) return 1;
    console.warn('[notify:email] not configured — skipped (check RESEND_API_KEY and NOTIFY_EMAIL)');
  } catch (e) {
    console.error('[notify:email]', e.message);
  }
  return 0;
}

async function emailCustomer(to, subject, text, html, tag) {
  if (!to) return;
  try { await sendEmail({ to, subject, text, html, tag, replyTo: env('REPLY_TO_EMAIL') || undefined }); }
  catch (e) { console.error('[notify:customer-email]', e.message); }
}

// Simple branded HTML wrapper for emails.
function emailHtml(title, rows, footer = '') {
  const tr = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:pre-line">${/^https:\/\/\S+$/.test(String(v)) ? `<a href="${esc(v)}" style="color:#000;font-weight:700">Open in Google Maps</a>` : esc(v)}</td></tr>`).join('');
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
  priceCart, deliveryRules, checkCustomer, mapLink, deliveryArea, distanceKm, razorpay, validSignature,
  sendEmail, notifyOwner, emailCustomer, emailHtml, handler, istNow,
};
