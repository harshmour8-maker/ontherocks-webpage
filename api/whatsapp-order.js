// POST /api/whatsapp-order  { items, customer }
// For customers who choose "Order on WhatsApp" (not paid online). Emails you an [ORDER] alert
// so the order is on record even if the customer never presses Send in WhatsApp.
// Stock is checked but NOT reduced (the order isn't paid yet). Also saved to your order history (/admin).
const { handler, priceCart, checkCustomer, notifyOwner, emailHtml, rupees, istNow, mapLink, CATALOG } = require('./_lib');
const { bill } = require('./_bill');
const { saveOrder } = require('./_orders');
const { checkCartStock } = require('./_stock');

module.exports = handler(async body => {
  const { total, delivery, lines } = priceCart(body.items);
  const c = checkCustomer(body.customer);
  await checkCartStock(body.items.map(i => ({ id: i.id, qty: Math.floor(Number(i.qty)) })));
  const ref = 'OTR-W' + Date.now().toString(36).toUpperCase();
  const map = c.lat !== undefined ? mapLink(`${c.lat},${c.lng}`) : '';

  const rows = [
    ['Order', ref], ['Status', `NOT PAID – ordered via WhatsApp (${rupees(total)})`],
    ['Items', lines.join('\n')], ['Name', c.name], ['Phone', c.phone], ['Email', c.email || '-'],
    ['Flat / landmark', c.address], ['Map address', c.mapAddress || '-'], ['City', c.city],
    ['Map pin', map || 'Not pinned'], ['Time', istNow()],
  ];

  const b = bill(body.items.map(i => ({ id: i.id, name: CATALOG[i.id].n, qty: Math.floor(Number(i.qty)), price: CATALOG[i.id].p })), delivery);
  await Promise.all([notifyOwner({
    tag: 'ORDER',
    subject: `New WhatsApp order ${ref} – ${rupees(total)} (NOT PAID)`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: emailHtml(`WhatsApp order ${ref}`, rows),
    replyTo: c.email || undefined,
  }), saveOrder({
    ref, invoiceNo: '', date: new Date().toISOString(), status: 'WhatsApp – not paid', paymentId: '',
    name: c.name, phone: c.phone, email: c.email || '-', address: c.address, mapAddress: c.mapAddress || '-', map,
    items: b.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price, amount: l.incl })),
    iceIncl: b.iceIncl, taxable: b.taxable, cgst: b.cgst, sgst: b.sgst, delivery: b.delivery, total: b.total, invoiceUrl: '',
  })]);

  return { ok: true, ref };
});
