// Order history, kept in the same Upstash Redis database as the invoice counter.
//   order:<ref>  → the full order (JSON)      orders → every order ref, sorted by time
// Read it on the private admin page: /admin (password = ADMIN_PASSWORD in Vercel).
const { counterReady, redis } = require('./_counter');

const FULFILMENT = ['New', 'Out for delivery', 'Delivered', 'Cancelled'];

async function saveOrder(o) {
  if (!counterReady()) { console.warn('[orders] database not set up – order not saved to history'); return false; }
  try {
    await redis('SET', 'order:' + o.ref, JSON.stringify({ fulfilment: 'New', ...o }));
    await redis('ZADD', 'orders', String(Date.parse(o.date)), o.ref);
    return true;
  } catch (e) {
    console.error('[orders] could not save order', o.ref, e.message);
    return false;
  }
}

// Orders between two times (ms), newest first.
async function listOrders(fromMs, toMs, max = 5000) {
  const refs = await redis('ZRANGE', 'orders', String(toMs), String(fromMs), 'BYSCORE', 'REV', 'LIMIT', '0', String(max));
  if (!refs || !refs.length) return [];
  const out = [];
  for (let i = 0; i < refs.length; i += 200) {           // fetch in batches
    const vals = await redis('MGET', ...refs.slice(i, i + 200).map(r => 'order:' + r));
    vals.forEach(v => { if (v) { try { out.push(JSON.parse(v)); } catch (e) { /* skip damaged entry */ } } });
  }
  return out;
}

async function setFulfilment(ref, value) {
  const v = await redis('GET', 'order:' + ref);
  if (!v) return null;
  const o = JSON.parse(v);
  o.fulfilment = value;
  o.updatedAt = new Date().toISOString();
  await redis('SET', 'order:' + ref, JSON.stringify(o));
  return o;
}

// True the first time it's called for a key, false afterwards (used so a payment confirmed twice
// at the same moment only sends the emails once). Without the database it always returns true.
async function firstTime(key) {
  if (!counterReady()) return true;
  try { return (await redis('SET', 'once:' + key, '1', 'NX', 'EX', String(60 * 60 * 24 * 30))) === 'OK'; }
  catch (e) { return true; }
}

module.exports = { saveOrder, listOrders, setFulfilment, firstTime, FULFILMENT };
