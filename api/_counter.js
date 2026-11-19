// Serial invoice numbers: OTR/26-27/0001, OTR/26-27/0002, … (a new series every financial year).
// The count is kept in a free Upstash Redis database that you add from Vercel (Storage → Upstash Redis).
// Vercel then adds KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + _TOKEN) for you.
const { env } = require('./_lib');

const url = () => (env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL')).replace(/\/$/, '');
const token = () => env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
const counterReady = () => !!(url() && token());

async function redis(...cmd) {
  const r = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Upstash: ' + (j.error || r.status));
  return j.result;
}

// Returns the invoice number for a Razorpay order. Asking again for the same order returns the same number,
// even if two confirmations arrive at the same moment (the first one reserves the order, the other waits),
// so numbers never repeat and never skip.
// Returns null if the counter isn't set up or can't be reached (the caller then falls back to the order ref).
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function invoiceNumberFor(orderId, prefix, fy) {
  if (!counterReady()) { console.warn('[invoice] counter not set up (add Upstash Redis in Vercel) – using order ref'); return null; }
  const key = `invoice-of:${orderId}`;
  try {
    let v = await redis('GET', key);
    if (v && v !== 'pending') return v;
    if ((await redis('SET', key, 'pending', 'NX', 'EX', 60)) === 'OK') {
      const n = await redis('INCR', `invoice-counter:${prefix}:${fy}`);
      const no = `${prefix}/${fy}/${String(n).padStart(4, '0')}`;
      await redis('SET', key, no);
      return no;
    }
    for (let i = 0; i < 20; i++) {           // another request is numbering this order – wait for it
      await sleep(250);
      v = await redis('GET', key);
      if (v && v !== 'pending') return v;
    }
    return null;
  } catch (e) {
    console.error('[invoice] counter failed:', e.message);
    return null;
  }
}

module.exports = { invoiceNumberFor, counterReady, redis };
