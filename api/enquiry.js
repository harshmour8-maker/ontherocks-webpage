// POST /api/enquiry  { name, company, phone, email, city, type, product, quantity, date, message, website }
// Bulk / custom-ice enquiries → email + WhatsApp alert to you, acknowledgement email to the customer.
const { handler, HttpError, clean, cleanMultiline, PHONE_RE, EMAIL_RE, notifyOwner, emailCustomer, emailHtml, istNow } = require('./_lib');

module.exports = handler(async b => {
  if (b.website) return { ok: true }; // honeypot field filled → spam bot; pretend success

  const e = {
    name: clean(b.name, 80), company: clean(b.company, 120), phone: clean(b.phone, 20),
    email: clean(b.email, 120), city: clean(b.city, 80), type: clean(b.type, 40),
    product: clean(b.product, 120), quantity: clean(b.quantity, 80), date: clean(b.date, 20),
    message: cleanMultiline(b.message, 1500),
  };
  if (!e.name || !PHONE_RE.test(e.phone) || !e.city || !e.quantity) {
    throw new HttpError(400, 'Add your name, a valid phone number, city and quantity.');
  }
  if (e.email && !EMAIL_RE.test(e.email)) throw new HttpError(400, "That email address doesn't look right.");

  const ref = 'ENQ-' + Date.now().toString(36).toUpperCase();
  const rows = [
    ['Enquiry', ref], ['Name', e.name], ['Business / event', e.company || '-'], ['Phone', e.phone],
    ['Email', e.email || '-'], ['City', e.city], ['For', e.type || '-'], ['Product', e.product || '-'],
    ['Quantity', e.quantity], ['Needed by', e.date || '-'], ['Message', e.message || '-'], ['Time', istNow()],
  ];

  const delivered = await notifyOwner({
    tag: 'ENQUIRY',
    subject: `Bulk enquiry ${ref} – ${e.company || e.name}, ${e.city}`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: emailHtml(`Bulk enquiry ${ref}`, rows),
    replyTo: e.email || undefined,
    tag: 'ENQUIRY',
  });
  if (!delivered) {
    // Nothing reached you, so tell the visitor rather than silently losing the lead.
    throw new HttpError(502, "We couldn't send your enquiry right now.");
  }

  if (e.email) {
    await emailCustomer(
      e.email,
      'We got your enquiry – On The Rocks',
      `Hi ${e.name},\n\nThanks for reaching out about ${e.product || 'bulk ice'} (${e.quantity}). ` +
        `Our team will get back to you shortly with a quote.\n\nReference: ${ref}\n\n– On The Rocks`,
      emailHtml('Enquiry received', [['Reference', ref], ['Product', e.product || 'Bulk ice'], ['Quantity', e.quantity], ['City', e.city]],
        `Hi ${e.name}, thanks for reaching out! Our team will get back to you shortly with a quote.`),
      'ENQUIRY'
    );
  }

  return { ok: true, ref };
});
