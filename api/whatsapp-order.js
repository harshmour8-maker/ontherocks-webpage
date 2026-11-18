// POST /api/whatsapp-order  { items, customer }
// For customers who choose "Order on WhatsApp" (not paid online). Sends you an alert
// so the order is on record even if the customer never presses Send in WhatsApp.
const { handler, priceCart, checkCustomer, notifyOwner, emailHtml, rupees, istNow } = require('./_lib');

module.exports = handler(async body => {
  const { total, lines } = priceCart(body.items);
  const c = checkCustomer(body.customer);
  const ref = 'OTR-W' + Date.now().toString(36).toUpperCase();

  const rows = [
    ['Order', ref], ['Status', `NOT PAID – ordered via WhatsApp (${rupees(total)})`],
    ['Items', lines.join('\n')], ['Name', c.name], ['Phone', c.phone], ['Email', c.email || '-'],
    ['City', c.city], ['Address', c.address], ['Time', istNow()],
  ];

  await notifyOwner({
    tag: 'ORDER',
    subject: `New WhatsApp order ${ref} – ${rupees(total)} (NOT PAID)`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: emailHtml(`WhatsApp order ${ref}`, rows),
    replyTo: c.email || undefined,
    tag: 'ORDER',
  });

  return { ok: true, ref };
});
