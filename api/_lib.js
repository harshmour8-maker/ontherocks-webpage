// Shared helpers for the On The Rocks API (Vercel serverless functions).
// Files starting with "_" inside /api are NOT exposed as routes by Vercel.
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// PRICE LIST — the server always re-prices the cart from here, so nobody can
// tamper with prices in the browser. Keep in sync with the prices in index.html.
// ---------------------------------------------------------------------------
const CATALOG = {
  otr1kg:  { n: 'On The Rocks 1 kg', p: 80 },
  cube:    { n: 'The Cube (pack of 10)',   p: 300 },
  globe:   { n: 'The Globe (pack of 10)',  p: 500 },
  pillar:  { n: 'The Pillar (pack of 10)', p: 350 },
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
  // Delivery: free from FREE_DELIVERY_FROM (default ₹500), otherwise a flat DELIVERY_FEE (default ₹99).
  // Discount: DISCOUNT_PCT (default 10%) off the ice on orders above DISCOUNT_ABOVE (default ₹1,200).
  const subtotal = total, d = deliveryRules();
  const delivery = deliveryFee(subtotal, d);
  const discount = discountFor(subtotal, d);
  if (discount) lines.push(`Discount ${d.discountPct}% (-${rupees(discount)})`);
  lines.push(delivery ? `Delivery (${rupees(delivery)})` : 'Delivery (FREE)');
  return { total: subtotal - discount + delivery, subtotal, discount, delivery, lines };
}

// Change in Vercel without touching code: FREE_DELIVERY_FROM (default 500), DELIVERY_FEE (default 99),
// DISCOUNT_ABOVE (default 1200), DISCOUNT_PCT (default 10, set 0 to switch the discount off).
// ---------------------------------------------------------------------------
// Delivery slots (India time). 1-hour slots from DELIVERY_START_HOUR (10 = 10 am) to DELIVERY_END_HOUR
// (22 = last slot 9–10 pm). The earliest slot must start at least SLOT_LEAD_MINUTES (60) from now,
// and customers can book up to SLOT_DAYS (7) days ahead. All can be changed in Vercel.
// ---------------------------------------------------------------------------
const IST_MS = 5.5 * 3600e3;
function slotRules() {
  const n = (k, d, min, max) => { const v = Number(env(k)); return env(k) !== '' && Number.isInteger(v) && v >= min && v <= max ? v : d; };
  const startHour = n('DELIVERY_START_HOUR', 10, 0, 23);
  return { startHour, endHour: Math.max(startHour + 1, n('DELIVERY_END_HOUR', 22, 1, 24)), leadMinutes: n('SLOT_LEAD_MINUTES', 60, 0, 1440), days: n('SLOT_DAYS', 7, 1, 30) };
}
const hourText = h => { const x = h % 24; return `${x % 12 || 12} ${x < 12 ? 'am' : 'pm'}`; };
function slotLabel(startMs, hour) {
  const day = new Date(startMs).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${hourText(hour)} – ${hourText(hour + 1)}`;
}
// slot = { date: 'YYYY-MM-DD', hour: 14 } (India time) → { label, start } or a friendly 400 error.
function checkSlot(slot) {
  const r = slotRules();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String((slot && slot.date) || ''));
  const hour = Number(slot && slot.hour);
  if (!m || !Number.isInteger(hour)) throw new HttpError(400, 'Please choose a delivery date and time.');
  if (hour < r.startHour || hour >= r.endHour) throw new HttpError(400, `We deliver between ${hourText(r.startHour)} and ${hourText(r.endHour)}. Please choose another time.`);
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3], hour) - IST_MS;
  const now = Date.now();
  if (start < now + (r.leadMinutes - 5) * 60e3) throw new HttpError(400, 'That delivery time is no longer available. Please choose a later slot.');
  if (start > now + (r.days + 1) * 86400e3) throw new HttpError(400, `Please choose a delivery date within the next ${r.days} days.`);
  return { label: slotLabel(start, hour), start: new Date(start).toISOString() };
}

function deliveryFee(subtotal, d = deliveryRules()) {
  if (!(subtotal > 0) || subtotal >= d.freeFrom) return 0;
  return d.fee;
}
function deliveryRules() {
  const n = (k, d) => { const v = Number(env(k)); return env(k) !== '' && Number.isFinite(v) && v >= 0 ? v : d; };
  return { freeFrom: n('FREE_DELIVERY_FROM', 500), fee: n('DELIVERY_FEE', 99),
    discountAbove: n('DISCOUNT_ABOVE', 1200), discountPct: Math.min(n('DISCOUNT_PCT', 10), 90) };
}
// Flat % off the ice on orders strictly above discountAbove, rounded to the rupee.
function discountFor(subtotal, d = deliveryRules()) {
  if (!(d.discountPct > 0) || !(subtotal > d.discountAbove)) return 0;
  return Math.round(subtotal * d.discountPct / 100);
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
  // The delivery spot must be pinned on the map, inside the delivery area. Always required.
  const area = deliveryArea();
  const outside = `Sorry, we currently deliver only within ${area.name}. Please choose an address in ${area.name}, or WhatsApp us for other places.`;
  if (out.lat === undefined) throw new HttpError(400, 'Please select your delivery address on the map.');
  if (distanceKm(out.lat, out.lng, area.lat, area.lng) > area.km) throw new HttpError(400, outside);
  if (!out.address) throw new HttpError(400, 'Add your flat / house number and a landmark.');
  // PIN code: must belong to the delivery area (Guwahati PIN codes start with 781).
  const prefixes = pinPrefixes();
  const pin = clean(c.pincode, 6).replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) throw new HttpError(400, 'Add your 6-digit PIN code.');
  if (!prefixes.some(x => pin.startsWith(x))) throw new HttpError(400, outside);
  // A different PIN code typed into the address also means it's outside the area.
  // (No city-name check: Guwahati addresses often mention other cities, e.g. "near Bangalore Bakery".)
  const text = [out.address, c.landmark].join(' ');
  const otherPin = (text.match(/\b\d{3}\s?\d{3}\b/g) || []).map(x => x.replace(/\s/, '')).find(x => !prefixes.some(p => x.startsWith(p)));
  if (otherPin) throw new HttpError(400, outside);
  if (!out.address.includes(pin)) out.address = `${out.address}, PIN ${pin}`;
  out.pincode = pin;
  if (!out.city) out.city = '-';
  if (!out.name || !PHONE_RE.test(out.phone)) throw new HttpError(400, 'Add your name and a valid phone number.');
  if (out.email && !EMAIL_RE.test(out.email)) out.email = '';
  return out;
}

// Where we deliver: a circle around a centre point. Change it in Vercel without touching code:
//   DELIVERY_AREA_NAME (default Guwahati), DELIVERY_LAT / DELIVERY_LNG (centre), DELIVERY_RADIUS_KM (default 20)
// PIN code prefixes we deliver to (comma-separated in Vercel: DELIVERY_PIN_PREFIXES). Default: 781 = Guwahati.
function pinPrefixes() { return env('DELIVERY_PIN_PREFIXES', '781').split(',').map(x => x.trim()).filter(Boolean); }

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
  slotRules, checkSlot, slotLabel,
  CATALOG, env, HttpError, clean, cleanMultiline, esc, rupees, PHONE_RE, EMAIL_RE,
  priceCart, deliveryRules, deliveryFee, discountFor, checkCustomer, mapLink, deliveryArea, distanceKm, razorpay, validSignature,
  sendEmail, notifyOwner, emailCustomer, emailHtml, handler, istNow,
};
