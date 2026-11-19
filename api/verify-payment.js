// POST /api/verify-payment  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// 1. checks the payment is genuine (HMAC signature)
// 2. gives the order the next serial invoice number (OTR/26-27/0001 …) and saves it on the Razorpay order
// 3. emails YOU the order confirmation + receipt, and the CUSTOMER a thank-you note + receipt (via Resend)
// 4. reduces stock  5. saves the order to your order history (see /admin).
// Order details are read back from Razorpay, not from the browser.
// Safe to call twice: the second call changes nothing and sends nothing.
const { handler, HttpError, razorpay, validSignature, notifyOwner, emailCustomer, esc, istNow, mapLink } = require('./_lib');
const { reduceStock, unpackCart } = require('./_stock');
const { bill, money, fyLabel, invoicePrefix, invoiceUrl, siteBase, receiptEmailHtml } = require('./_bill');
const { invoiceNumberFor } = require('./_counter');
const { saveOrder, firstTime } = require('./_orders');

module.exports = handler(async (body, req) => {
  const orderId = String(body.razorpay_order_id || '');
  const paymentId = String(body.razorpay_payment_id || '');
  if (!validSignature(orderId, paymentId, body.razorpay_signature)) {
    throw new HttpError(400, 'We could not verify this payment. If money was deducted, WhatsApp us your payment ID.');
  }

  const order = await razorpay('orders/' + encodeURIComponent(orderId));
  const n = order.notes || {};
  const ref = order.receipt || orderId;
  const link = invoiceUrl(orderId, siteBase(req));
  if (n.invoice_no) return { ok: true, ref, invoiceNo: n.invoice_no, invoiceUrl: link }; // already done

  const when = new Date();
  const invoiceNo = (await invoiceNumberFor(orderId, invoicePrefix(), fyLabel(when))) || ref;
  try {
    await razorpay('orders/' + encodeURIComponent(orderId),
      { notes: { ...n, invoice_no: invoiceNo, payment_id: paymentId, paid_at: when.toISOString() } }, 'PATCH');
  } catch (e) { console.error('[razorpay] could not save the invoice number on the order:', e.message); }
  // If this same payment is being confirmed twice at the same moment, only the first one carries on.
  if (!(await firstTime('paid:' + orderId))) return { ok: true, ref, invoiceNo, invoiceUrl: link };

  const cart = unpackCart(n.cart);
  const b = bill(cart, Number(n.delivery || 0));
  const date = when.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const buyer = { name: n.name, phone: n.phone, email: n.email, address: n.address, mapAddress: n.map_address };
  const receipt = { invoiceNo, date, orderRef: ref, paymentId, buyer, b, link };
  const map = mapLink(n.location);
  const itemsText = b.lines.map(l => `${l.qty} x ${l.name} – ${money(l.incl)}`).join('\n');
  const billText = `${itemsText}\nDelivery (no GST): ${b.delivery ? money(b.delivery) : 'FREE'}\n` +
    `Taxable value: ${money(b.taxable)} | CGST: ${money(b.cgst)} | SGST: ${money(b.sgst)}\nTotal paid: ${money(b.total)}`;

  // ---- to you: order confirmation + receipt ----
  const ownerIntro = `<b style="font-size:18px">New paid order ✅</b><br>Invoice <b>${esc(invoiceNo)}</b> · <b>${money(b.total)}</b> paid online · ${esc(istNow())}<br>
    Deliver to: <b>${esc(n.name)}</b>, ${esc(n.phone)}<br>${esc(n.address)}${n.map_address && n.map_address !== '-' ? ', ' + esc(n.map_address) : ''}
    ${map ? `<br><a href="${esc(map)}" style="color:#000;font-weight:700">📍 Open delivery location in Google Maps</a>` : ''}`;
  const ownerText = `New paid order\nInvoice: ${invoiceNo}\nOrder: ${ref}\nPayment ID: ${paymentId}\n\n${billText}\n\n` +
    `Name: ${n.name}\nPhone: ${n.phone}\nEmail: ${n.email}\nFlat / landmark: ${n.address}\nMap address: ${n.map_address || '-'}\n` +
    `Map pin: ${map || 'Not pinned'}\nInvoice: ${link}\nTime: ${istNow()}`;

  // ---- to the customer: thank-you note + receipt ----
  const thanks = 'Thank you for ordering from On The Rocks 🧊';
  const custIntro = `Hi ${esc(n.name)},<br><br><b style="font-size:18px">${thanks}</b><br>Cheers!!`;
  const custText = `Hi ${n.name},\n\n${thanks}\nCheers!!\n\nInvoice: ${invoiceNo}\nOrder: ${ref}\n\n${billText}\n\n` +
    `Deliver to: ${n.address}${n.map_address && n.map_address !== '-' ? ', ' + n.map_address : ''}\n\nView / download your invoice: ${link}\n\n– On The Rocks`;

  await Promise.all([
    notifyOwner({
      tag: 'ORDER',
      subject: `New paid order ${invoiceNo} – ${money(b.total)}`,
      text: ownerText,
      html: receiptEmailHtml({ ...receipt, intro: ownerIntro }),
      replyTo: n.email && n.email !== '-' ? n.email : undefined,
    }),
    n.email && n.email !== '-' ? emailCustomer(n.email, `${thanks} – Invoice ${invoiceNo}`, custText,
      receiptEmailHtml({ ...receipt, intro: custIntro }), 'ORDER') : null,
    reduceStock(ref, cart.map(i => ({ id: i.id, qty: i.qty }))),
    saveOrder({
      ref, invoiceNo, date: when.toISOString(), status: 'Paid online', paymentId,
      name: n.name, phone: n.phone, email: n.email, address: n.address, mapAddress: n.map_address, map,
      items: b.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price, amount: l.incl })),
      iceIncl: b.iceIncl, taxable: b.taxable, cgst: b.cgst, sgst: b.sgst, delivery: b.delivery, total: b.total, invoiceUrl: link,
    }),
  ]);

  return { ok: true, ref, invoiceNo, invoiceUrl: link };
});
