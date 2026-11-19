// POST /api/admin-orders  — used only by the private /admin page.
//   { key, action:'list', from, to }            → orders between two dates (ms), newest first
//   { key, action:'fulfilment', ref, value }    → set New / Out for delivery / Delivered / Cancelled
// key must equal ADMIN_PASSWORD (set it in Vercel). Wrong keys are slowed down to stop guessing.
const crypto = require('crypto');
const { handler, HttpError, env } = require('./_lib');
const { counterReady } = require('./_counter');
const { listOrders, setFulfilment, FULFILMENT } = require('./_orders');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function sameText(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = handler(async body => {
  const pass = env('ADMIN_PASSWORD');
  if (!pass) throw new HttpError(503, 'Set ADMIN_PASSWORD in Vercel (Settings → Environment Variables), then Redeploy.');
  if (!body.key || !sameText(body.key, pass)) { await sleep(1200); throw new HttpError(401, 'Wrong password.'); }
  if (!counterReady()) throw new HttpError(503, 'The order database is not connected yet. Add Upstash Redis in Vercel (guide Step 11), then Redeploy.');

  if (body.action === 'fulfilment') {
    if (!FULFILMENT.includes(body.value)) throw new HttpError(400, 'Unknown status.');
    const o = await setFulfilment(String(body.ref || ''), body.value);
    if (!o) throw new HttpError(404, 'Order not found.');
    return { ok: true, order: o };
  }

  const to = Number(body.to) || Date.now();
  const from = Number(body.from) || 0;
  return { ok: true, orders: await listOrders(from, to), fulfilmentOptions: FULFILMENT };
});
