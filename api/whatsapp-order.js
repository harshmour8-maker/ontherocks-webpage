// POST /api/whatsapp-order  { items, customer }
// For customers who choose "Order on WhatsApp" (not paid online). Emails you an [ORDER] alert
// so the order is on record even if the customer never presses Send in WhatsApp.
// Stock is checked but NOT reduced (the order isn't paid yet).
const { handler, priceCart, checkCustomer, notifyOwner, emailHtml, rupees, istNow, mapLink } = require('./_lib');
const { checkCartStock } = require('./_stock');

module.exports = handler(async body => {
  const { total, lines } = priceCart(body.items);
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

  await notifyOwner({
    tag: 'ORDER',
    subject: `New WhatsApp order ${ref} – ${rupees(total)} (NOT PAID)`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: emailHtml(`WhatsApp order ${ref}`, rows),
    replyTo: c.email || undefined,
  });

  return { ok: true, ref };
});
