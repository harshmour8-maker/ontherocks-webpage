// GST bill + tax invoice.
// Ice prices on the website INCLUDE GST (default 5%: CGST 2.5% + SGST 2.5%, as all deliveries are
// inside Assam). The delivery charge has no GST. Seller details can be changed in Vercel (see .env.example).
const crypto = require('crypto');
const { env, esc } = require('./_lib');

const r2 = x => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
const money = x => '₹' + r2(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gstRate() {
  const v = Number(env('GST_RATE', '5'));
  return Number.isFinite(v) && v >= 0 && v <= 28 ? v : 5;
}

function seller() {
  return {
    name: env('SELLER_NAME', 'Frostworks Corporation'),
    brand: 'On The Rocks',
    address: env('SELLER_ADDRESS', '66, Kalipur, Guwahati, Assam – 781009'),
    gstin: env('SELLER_GSTIN', '18ADRPG9635P1ZJ'),
    msme: env('SELLER_MSME', 'UDYAM-AS-03-0046696'),
    state: env('SELLER_STATE', 'Assam'),
    stateCode: env('SELLER_STATE_CODE', '18'),
    fssai: env('SELLER_FSSAI', '20323101002084'),
    phone: env('SELLER_PHONE', '+91 60033 68214, +91 78964 55536'),
    email: env('SELLER_EMAIL', 'info@frostworkscorp.com'),
    hsn: env('ICE_HSN', '2201'),
  };
}

// lines: [{ id, name, qty, price }]  (price per unit, GST included)
function bill(lines, delivery) {
  const rate = gstRate();
  const out = lines.map(l => {
    const incl = r2(l.price * l.qty);
    const taxable = r2(incl * 100 / (100 + rate));
    return { ...l, incl, taxable, gst: r2(incl - taxable) };
  });
  const iceIncl = r2(out.reduce((s, l) => s + l.incl, 0));
  const taxable = r2(out.reduce((s, l) => s + l.taxable, 0));
  const gst = r2(iceIncl - taxable);
  const cgst = r2(gst / 2), sgst = r2(gst - cgst);
  const dl = r2(delivery || 0);
  return { rate, lines: out, iceIncl, taxable, gst, cgst, sgst, delivery: dl, total: r2(iceIncl + dl) };
}

// Indian financial year label for a date, e.g. 26-27 for Apr 2026 – Mar 2027 (IST).
function fyLabel(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  const y = ist.getUTCFullYear(), start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}
const invoicePrefix = () => env('INVOICE_PREFIX', 'OTR').replace(/[^A-Za-z0-9-]/g, '') || 'OTR';

// Private link to an order's invoice: only someone with the link can open it.
function invoiceSig(orderId) {
  return crypto.createHmac('sha256', env('INVOICE_SECRET') || env('RAZORPAY_KEY_SECRET') || 'otr')
    .update('invoice:' + orderId).digest('hex').slice(0, 24);
}
function siteBase(req) {
  const h = req && req.headers ? (req.headers['x-forwarded-host'] || req.headers.host) : '';
  return (env('SITE_URL') || (h ? 'https://' + h : 'https://ontherocks.co.in')).replace(/\/$/, '');
}
const invoiceUrl = (orderId, base) => `${base}/api/invoice?o=${encodeURIComponent(orderId)}&s=${invoiceSig(orderId)}`;

function inWords(amount) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
    'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = n => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
  const three = n => (n >= 100 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '');
  const w = n => {
    if (!n) return 'Zero';
    const cr = Math.floor(n / 1e7); n %= 1e7;
    const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3;
    return [cr ? w(cr) + ' Crore' : '', lk ? two(lk) + ' Lakh' : '', th ? two(th) + ' Thousand' : '', n ? three(n) : ''].filter(Boolean).join(' ');
  };
  const rs = Math.floor(r2(amount)), ps = Math.round((r2(amount) - rs) * 100);
  return `Rupees ${w(rs)}${ps ? ' and ' + two(ps) + ' Paise' : ''} Only`;
}

// Printable A4 invoice (customer opens it and uses Print → Save as PDF).
function invoiceHtml({ invoiceNo, date, orderRef, paymentId, buyer, b, slot }) {
  const s = seller();
  const isTax = !!s.gstin;
  const half = r2(b.rate / 2);
  const rows = b.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(s.hsn)}</td><td class="n">${l.qty}</td>
    <td class="n">${money(l.price)}</td><td class="n">${money(l.taxable)}</td><td class="n">${money(l.gst / 2)}</td><td class="n">${money(l.gst - r2(l.gst / 2))}</td><td class="n">${money(l.incl)}</td></tr>`).join('');
  const dRow = `<tr><td>${b.lines.length + 1}</td><td>Delivery charge</td><td>–</td><td class="n">1</td><td class="n">${money(b.delivery)}</td>
    <td class="n">${money(b.delivery)}</td><td class="n">–</td><td class="n">–</td><td class="n">${b.delivery ? money(b.delivery) : 'FREE'}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(invoiceNo)} – On The Rocks</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font:13px/1.45 Helvetica,Arial,sans-serif;color:#000;background:#eee;padding:20px}
.page{max-width:820px;margin:0 auto;background:#fff;padding:32px;border:2px solid #000}
.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #000;padding-bottom:16px}
h1{font-size:26px;letter-spacing:.04em}.brand{font-size:22px;font-weight:900;text-transform:uppercase}.muted{color:#555}
.meta{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:18px 0}
h3{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #000;padding:6px 7px;text-align:left;vertical-align:top}
th{background:#000;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.n{text-align:right;white-space:nowrap}
.sum{margin-left:auto;width:340px;margin-top:12px}.sum td{border:0;border-bottom:1px solid #ddd}.sum tr:last-child td{border-top:2px solid #000;border-bottom:0;font-weight:900;font-size:16px}
.words{margin-top:10px;font-weight:700}.foot{margin-top:24px;border-top:1px solid #000;padding-top:10px;font-size:11px;color:#444}
.btn{display:inline-block;margin:0 auto 14px;padding:12px 22px;background:#000;color:#fff;font:700 13px Helvetica,Arial;letter-spacing:.06em;text-transform:uppercase;border:0;cursor:pointer}
.bar{max-width:820px;margin:0 auto;text-align:right}.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}.items{min-width:640px}
@media(max-width:640px){body{padding:0}.page{padding:16px;border:0}.grid{grid-template-columns:1fr}.top{flex-direction:column}.meta{text-align:left}.sum{width:100%}table{font-size:11px}th,td{padding:4px}}
@media print{.items{min-width:0}body{background:#fff;padding:0}.bar{display:none}.page{border:0;padding:0}@page{size:A4;margin:14mm}}
</style></head><body>
<div class="bar"><button class="btn" onclick="print()">Print / Save as PDF</button></div>
<div class="page">
 <div class="top"><div><div class="brand">${esc(s.brand)}</div><div><b>${esc(s.name)}</b><br>${esc(s.address)}<br>
  ${s.gstin ? 'GSTIN: <b>' + esc(s.gstin) + '</b><br>' : ''}FSSAI: ${esc(s.fssai)}${s.msme ? ' · MSME: ' + esc(s.msme) : ''}<br>State: ${esc(s.state)}, Code: ${esc(s.stateCode)}<br>${esc(s.phone)} · ${esc(s.email)}</div></div>
  <div class="meta"><h1>${isTax ? 'TAX INVOICE' : 'INVOICE'}</h1><div class="muted">Original for recipient</div><br>
  <b>Invoice no:</b> ${esc(invoiceNo)}<br><b>Date:</b> ${esc(date)}<br><b>Order:</b> ${esc(orderRef)}<br><b>Payment ID:</b> ${esc(paymentId || '-')}</div></div>
 <div class="grid"><div><h3>Billed / delivered to</h3><b>${esc(buyer.name)}</b><br>${esc(buyer.address)}${buyer.mapAddress && buyer.mapAddress !== '-' ? '<br>' + esc(buyer.mapAddress) : ''}<br>Phone: ${esc(buyer.phone)}${buyer.email && buyer.email !== '-' ? '<br>' + esc(buyer.email) : ''}</div>
  <div><h3>Place of supply</h3>${esc(s.state)} (${esc(s.stateCode)})<br><br><h3>Payment</h3>Paid online (Razorpay)${slot ? '<br><br><h3>Delivery slot</h3>' + esc(slot) : ''}</div></div>
 <div class="tw"><table class="items"><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="n">Qty</th><th class="n">Rate (incl. GST)</th><th class="n">Taxable value</th>
  <th class="n">CGST ${half}%</th><th class="n">SGST ${half}%</th><th class="n">Amount</th></tr></thead><tbody>${rows}${dRow}</tbody></table></div>
 <table class="sum">
  <tr><td>Taxable value (ice)</td><td class="n">${money(b.taxable)}</td></tr>
  <tr><td>CGST @ ${half}%</td><td class="n">${money(b.cgst)}</td></tr>
  <tr><td>SGST @ ${half}%</td><td class="n">${money(b.sgst)}</td></tr>
  <tr><td>Delivery charge (no GST)</td><td class="n">${b.delivery ? money(b.delivery) : 'FREE'}</td></tr>
  <tr><td>Total paid</td><td class="n">${money(b.total)}</td></tr></table>
 <div class="words">${esc(inWords(b.total))}</div>
 <div class="foot">Ice prices include GST at ${b.rate}% (CGST ${half}% + SGST ${half}%). No GST is charged on delivery.${isTax ? '' : ' GSTIN to be added.'}<br>
 This is a computer-generated invoice and does not need a signature.</div>
</div></body></html>`;
}


// Receipt for EMAILS (inline styles, table layout: looks right in Gmail, Outlook and phone mail apps).
// intro = message shown above the receipt (thank-you note for the customer, order alert for you).
function receiptEmailHtml({ intro, invoiceNo, date, orderRef, paymentId, buyer, b, link, slot }) {
  const s = seller();
  const half = r2(b.rate / 2);
  const td = 'padding:7px 8px;border-bottom:1px solid #e5e5e5;font-size:13px;vertical-align:top';
  const tdr = td + ';text-align:right;white-space:nowrap';
  const items = b.lines.map(l => `<tr><td style="${td}">${esc(l.name)}<br><span style="color:#777;font-size:11px">HSN ${esc(s.hsn)} · ${l.qty} × ${money(l.price)} (incl. GST)</span></td>
    <td style="${tdr}">${money(l.taxable)}</td><td style="${tdr}">${money(l.gst)}</td><td style="${tdr}"><b>${money(l.incl)}</b></td></tr>`).join('');
  const sumRow = (k, v, strong) => `<tr><td style="padding:5px 0;font-size:${strong ? 17 : 13}px;${strong ? 'font-weight:900;border-top:2px solid #000;padding-top:9px' : ''}">${k}</td>
    <td style="padding:5px 0;text-align:right;font-size:${strong ? 17 : 13}px;${strong ? 'font-weight:900;border-top:2px solid #000;padding-top:9px' : ''}">${v}</td></tr>`;
  return `<div style="background:#f2f2f2;padding:20px 10px;font-family:Helvetica,Arial,sans-serif;color:#000">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:2px solid #000;border-collapse:collapse">
<tr><td style="background:#000;color:#fff;padding:22px 24px">
  <div style="font-size:22px;font-weight:900;letter-spacing:.02em;text-transform:uppercase">On The Rocks</div>
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#bbb">Premium ice cubes</div></td></tr>
<tr><td style="padding:24px 24px 6px;font-size:16px;line-height:1.5">${intro}</td></tr>
<tr><td style="padding:14px 24px">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr>
   <td style="font-size:12px;line-height:1.55;vertical-align:top;padding-right:10px"><b style="font-size:13px">${esc(s.name)}</b><br>${esc(s.address)}<br>
    ${s.gstin ? 'GSTIN: <b>' + esc(s.gstin) + '</b><br>' : ''}FSSAI: ${esc(s.fssai)}${s.msme ? '<br>MSME: ' + esc(s.msme) : ''}<br>State: ${esc(s.state)}, Code: ${esc(s.stateCode)}</td>
   <td style="font-size:12px;line-height:1.55;vertical-align:top;text-align:right"><b style="font-size:15px">${s.gstin ? 'TAX INVOICE' : 'INVOICE'}</b><br>
    No: <b>${esc(invoiceNo)}</b><br>Date: ${esc(date)}<br>Order: ${esc(orderRef)}<br>Payment: ${esc(paymentId || '-')}</td></tr></table></td></tr>
<tr><td style="padding:4px 24px 12px;font-size:12px;line-height:1.55"><span style="color:#777;text-transform:uppercase;letter-spacing:.08em;font-size:10px">Billed / delivered to</span><br>
  <b>${esc(buyer.name)}</b> · ${esc(buyer.phone)}<br>${esc(buyer.address)}${buyer.mapAddress && buyer.mapAddress !== '-' ? '<br>' + esc(buyer.mapAddress) : ''}${slot ? '<br>Delivery slot: <b>' + esc(slot) + '</b>' : ''}<br>Place of supply: ${esc(s.state)} (${esc(s.stateCode)})</td></tr>
<tr><td style="padding:0 24px">
  <table role="presentation" width="100%" style="border-collapse:collapse">
   <tr><th style="${td};text-align:left;background:#000;color:#fff;font-size:11px">ITEM</th><th style="${tdr};background:#000;color:#fff;font-size:11px">TAXABLE</th>
    <th style="${tdr};background:#000;color:#fff;font-size:11px">GST ${b.rate}%</th><th style="${tdr};background:#000;color:#fff;font-size:11px">AMOUNT</th></tr>
   ${items}
   <tr><td style="${td}">Delivery charge</td><td style="${tdr}">${b.delivery ? money(b.delivery) : '–'}</td><td style="${tdr}">–</td><td style="${tdr}"><b>${b.delivery ? money(b.delivery) : 'FREE'}</b></td></tr>
  </table></td></tr>
<tr><td style="padding:12px 24px 4px"><table role="presentation" width="100%" style="border-collapse:collapse">
  ${sumRow('Taxable value (ice)', money(b.taxable))}${sumRow(`CGST @ ${half}%`, money(b.cgst))}${sumRow(`SGST @ ${half}%`, money(b.sgst))}
  ${sumRow('Delivery charge (no GST)', b.delivery ? money(b.delivery) : 'FREE')}${sumRow('Total paid', money(b.total), true)}</table>
  <div style="font-size:12px;font-weight:700;padding:6px 0 0">${esc(inWords(b.total))}</div></td></tr>
${link ? `<tr><td style="padding:18px 24px 8px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;padding:13px 22px">View / download invoice (PDF)</a></td></tr>` : ''}
<tr><td style="padding:14px 24px 22px;font-size:11px;color:#666;line-height:1.5">Ice prices include GST at ${b.rate}% (CGST ${half}% + SGST ${half}%). No GST is charged on delivery.
  This is a computer-generated invoice.<br>${esc(s.phone)} · ${esc(s.email)}</td></tr>
</table></div>`;
}

module.exports = { r2, money, receiptEmailHtml, gstRate, seller, bill, fyLabel, invoicePrefix, invoiceSig, invoiceUrl, siteBase, inWords, invoiceHtml };
