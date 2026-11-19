// GET /api/order?o=<razorpay order id>&s=<signature>  → order details for the "Thank you" page (/order).
// Same private-link protection as the invoice: only the link the website gives after payment works.
const crypto = require('crypto');
const { razorpay, mapLink } = require('./_lib');
const { unpackCart } = require('./_stock');
const { bill, invoiceSig, invoiceUrl, siteBase } = require('./_bill');

module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const o = String(q.o || ''), s = String(q.s || '');
  const good = invoiceSig(o);
  const send = (code, body) => { res.setHeader('Cache-Control', 'no-store'); res.status(code).json(body); };
  if (!o || s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return send(403, { error: 'This order link is not valid.' });
  let order;
  try { order = await razorpay('orders/' + encodeURIComponent(o)); } catch (e) { return send(404, { error: 'Order not found.' }); }
  const n = order.notes || {};
  if (!n.invoice_no) return send(409, { error: 'We are still confirming this payment.', pending: true });
  const b = bill(unpackCart(n.cart), Number(n.delivery || 0));
  send(200, {
    ok: true,
    invoiceNo: n.invoice_no, ref: order.receipt || o, paymentId: n.payment_id || '', paidAt: n.paid_at || '',
    name: n.name, phone: n.phone, email: n.email !== '-' ? n.email : '',
    address: n.address, mapAddress: n.map_address !== '-' ? n.map_address : '', map: mapLink(n.location),
    slot: String(n.slot || '').split('|')[0],
    items: b.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price, amount: l.incl })),
    iceIncl: b.iceIncl, taxable: b.taxable, cgst: b.cgst, sgst: b.sgst, gstRate: b.rate, delivery: b.delivery, total: b.total,
    invoiceUrl: invoiceUrl(o, siteBase(req)).replace(/^https?:\/\/[^/]+/, ''),
  });
};
