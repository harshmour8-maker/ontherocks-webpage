// GET /api/invoice?o=<razorpay order id>&s=<signature>  → printable tax invoice (HTML; Print → Save as PDF).
// The signature makes the link private: only links sent by the website/email work.
const crypto = require('crypto');
const { razorpay } = require('./_lib');
const { unpackCart } = require('./_stock');
const { bill, invoiceSig, invoiceHtml } = require('./_bill');

const page = (res, code, msg) => res.status(code).setHeader('Content-Type', 'text/html; charset=utf-8')
  .end(`<!DOCTYPE html><meta name="viewport" content="width=device-width"><body style="font:16px Helvetica,Arial;padding:40px;text-align:center">${msg}</body>`);

module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const o = String(q.o || ''), s = String(q.s || '');
  const good = invoiceSig(o);
  if (!o || s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return page(res, 403, 'This invoice link is not valid.');
  let order;
  try { order = await razorpay('orders/' + encodeURIComponent(o)); } catch (e) { console.error(e); return page(res, 404, 'Invoice not found.'); }
  const n = order.notes || {};
  if (!n.invoice_no) return page(res, 404, 'This order has not been paid yet, so there is no invoice.');
  const date = new Date(n.paid_at || order.created_at * 1000).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(invoiceHtml({
    invoiceNo: n.invoice_no, date, orderRef: order.receipt || o, paymentId: n.payment_id,
    buyer: { name: n.name, phone: n.phone, email: n.email, address: n.address, mapAddress: n.map_address },
    b: bill(unpackCart(n.cart), Number(n.delivery || 0)),
  }));
};
