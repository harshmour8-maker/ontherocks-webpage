// POST /api/verify-payment  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Confirms the payment is genuine (HMAC signature), sends the [ORDER] email, emails the customer
// a receipt and reduces stock. Order details are read back from Razorpay, not from the browser.
const { handler, HttpError, razorpay, validSignature, notifyOwner, emailCustomer, emailHtml, rupees, istNow, mapLink } = require('./_lib');
const { reduceStock, unpackCart } = require('./_stock');

module.exports = handler(async body => {
  const orderId = String(body.razorpay_order_id || '');
  const paymentId = String(body.razorpay_payment_id || '');
  if (!validSignature(orderId, paymentId, body.razorpay_signature)) {
    throw new HttpError(400, 'We could not verify this payment. If money was deducted, WhatsApp us your payment ID.');
  }

  const order = await razorpay('orders/' + encodeURIComponent(orderId));
  const n = order.notes || {};
  const ref = order.receipt || orderId;
  const amount = rupees(order.amount / 100);
  const items = String(n.items || '').split('; ').join('\n');
  const map = mapLink(n.location);

  const rows = [
    ['Order', ref], ['Status', `PAID ${amount} online`], ['Payment ID', paymentId],
    ['Items', items], ['Name', n.name], ['Phone', n.phone], ['Email', n.email],
    ['Flat / landmark', n.address], ['Map address', n.map_address || '-'], ['City', n.city],
    ['Map pin', map || 'Not pinned'], ['Time', istNow()],
  ];

  await Promise.all([
    notifyOwner({
      tag: 'ORDER',
      subject: `New paid order ${ref} – ${amount}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
      html: emailHtml(`Paid order ${ref}`, rows),
      replyTo: n.email && n.email !== '-' ? n.email : undefined,
    }),
    reduceStock(ref, unpackCart(n.cart)),
  ]);

  if (n.email && n.email !== '-') {
    const cRows = [['Order', ref], ['Paid', amount], ['Items', items], ['Deliver to', `${n.address}, ${n.map_address && n.map_address !== '-' ? n.map_address : n.city}`]];
    await emailCustomer(
      n.email,
      `Your On The Rocks order ${ref} is confirmed`,
      `Hi ${n.name},\n\nThanks for your order! We've received your payment.\n\n` +
        cRows.map(([k, v]) => `${k}: ${v}`).join('\n') +
        `\n\nWe'll confirm your delivery time on WhatsApp shortly.\n\n– On The Rocks`,
      emailHtml('Order confirmed', cRows, `Hi ${n.name}, thanks for your order! We'll confirm your delivery time on WhatsApp shortly.`),
      'ORDER'
    );
  }

  return { ok: true, ref };
});
