# On The Rocks: payments and order alerts setup

## What's in this folder

```
index.html              your website (same design, now with payments, enquiry form, store links)
api/create-order.js     prices the cart on the server and creates a Razorpay order
api/verify-payment.js   checks the payment is genuine, then alerts you and emails the customer
api/whatsapp-order.js   emails you when someone orders on WhatsApp instead of paying online
api/enquiry.js          bulk enquiry form: alerts you, sends an acknowledgement to the customer
api/_lib.js             price list + email/Razorpay helpers
api/_stock.js           reads/updates stock in your Google Sheet
api/config.js           GET /api/config – gives the page your Google Maps key
api/_bill.js            GST calculation, tax invoice page and email receipt layout
api/_counter.js         serial invoice numbers (Upstash Redis)
api/_orders.js          order history, saved in the same database
api/admin-orders.js     data for the admin page (password-protected)
admin.html              the private admin page: ontherocks.co.in/admin
apple-touch-icon.png    OTR logo used when the site is added to an iPhone home screen
icon-*.png, favicon.png, manifest.webmanifest   app icons for Android / browsers
img/                    all website images (product photos, logos, link-preview images og.jpg / og-catalog.jpg)
faq.html, contact.html, delivery.html, refunds.html, privacy.html, terms.html   FAQ, help and policy pages (ontherocks.co.in/refunds etc.)
catalog.html            artisanal ice catalog page: ontherocks.co.in/catalog
catalog-files/          catalog PDF (download) and page images used by catalog.html
order.html              thank-you page with full order details, shown after a successful payment
api/order.js            GET /api/order – order details for the thank-you page (private signed link)
vercel.json             lets /admin open without ".html"
api/invoice.js          GET /api/invoice – the customer's printable tax invoice (private link)
api/stock.js            GET /api/stock – the page uses it to show "Sold out" / "Only N left"
stock/stock-script.gs   script to paste into the sheet (Extensions → Apps Script)
.env.example            every setting you need to fill in
```

No npm packages are needed.

## What happens on each action

| Customer does | You get | Customer gets |
|---|---|---|
| Pays online | Email: "[ORDER] New paid order" with items, address, payment ID | Order confirmed screen + email receipt (if they gave an email) |
| Orders on WhatsApp | Email: "[ORDER] New WhatsApp order … (NOT PAID)" + their WhatsApp chat opens to you | WhatsApp chat pre-filled with the order |
| Sends bulk enquiry | Email: "[ENQUIRY] Bulk enquiry …" with all details (reply to the email to answer them) | "Enquiry received" email |

Every online order is also saved in your **Razorpay Dashboard → Orders**, with name, phone, address and items stored in the order's notes, so you have a record even if an alert fails.

---

## Setup (about 30 minutes)

### 1. Razorpay (payments)
1. Sign up at **razorpay.com** using Frostworks Corporation's details. Complete KYC (PAN, GST, bank account). Approval usually takes a few working days.
2. While you wait, use **Test mode**: Dashboard → Account & Settings → API Keys → Generate Test Key.
3. Copy the **Key ID** (`rzp_test_…`) and **Key Secret**.
4. After KYC is approved, generate **Live** keys and replace the test keys in Vercel.

Test payments: use UPI ID `success@razorpay`, or any test card from Razorpay's docs.

### 2. Email alerts (Resend, free for up to 3,000 emails a month)
1. Sign up at **resend.com** → API Keys → Create → copy the key (`re_…`).
2. Domains → Add `frostworkscorp.com` → add the DNS records it shows at your domain provider. Once verified, set `MAIL_FROM=On The Rocks <orders@frostworkscorp.com>`.
3. Until the domain is verified, keep `MAIL_FROM=On The Rocks <onboarding@resend.dev>`. In that mode, Resend only delivers to the email you signed up with, so customer receipts won't go out yet.

### 3. WhatsApp alerts
Removed. All alerts now come by email only, tagged [ORDER] or [ENQUIRY] in the subject.

### 4. Store logo links
Open `index.html`, search for `STORES:` near the start of the `<script>` section, and paste your product page links:

```js
STORES:{
  blinkit:'https://blinkit.com/prn/.../prid/...',
  bigbasket:'https://www.bigbasket.com/pd/.../',
  flipkart:'https://www.flipkart.com/...'
}
```

To get each link, open your product in the app or website → Share → Copy link. Until you paste a link, that logo opens a search for "On The Rocks ice cubes" in that app, so the logos work from day one.

### 5. Put it online (Vercel, free)
1. Create an account at **vercel.com** (sign in with GitHub, or use the Vercel CLI).
2. **Add New → Project** → upload or import this folder. There's no build step, so Framework = "Other".
3. **Settings → Environment Variables** → add every value from `.env.example` → **Redeploy**.
4. **Settings → Domains** → add your domain (e.g. `ontherocks.in`) and update the DNS records Vercel shows.

Already hosting the site elsewhere? Deploy this folder to Vercel just for the API, set `ALLOWED_ORIGIN=https://your-site.com` there, and in `index.html` set `API:'https://your-project.vercel.app'`.

### 6. Test before going live
1. With test keys, add items → fill in the form → **Pay** → use `success@razorpay`. You should get the email and WhatsApp alert, and the order shows in Razorpay (Test mode).
2. Submit the bulk enquiry form → check email + WhatsApp.
3. Click each store logo.
4. Swap in the live Razorpay keys → Redeploy → do one real ₹80 order and refund it from the Razorpay dashboard.

---

## Changing prices or adding products
Prices live in **two places** and must match:
- `index.html` → the `P=[…]` list and `HERO` (what customers see)
- `api/_lib.js` → `CATALOG` (what is actually charged)

The server always charges the `CATALOG` price, so nobody can change a price in their browser and pay less. Products with "On request" pricing (Infused Ice, Punch Block) open the enquiry form instead of the cart.

## Before you take live payments
Razorpay requires these pages on your site during activation: **Terms & Conditions, Privacy Policy, Refund/Cancellation Policy, Shipping/Delivery Policy, Contact Us**. Add them as simple pages and link them in the footer.

---

## Delivery address from the map (required)
At checkout the customer must pick their delivery spot on the map: search their area/building (Google search box), or tap **Use my location**, then drag the map so the pin is on their gate and tap **Confirm**. They then type their flat / house no. and a landmark.
Payment and WhatsApp orders are blocked until a location is chosen (checked on the server too).
Your [ORDER] email shows **Flat / landmark**, **Map address** and a **Map pin** link that opens in Google Maps.
- With `GOOGLE_MAPS_KEY` set in Vercel → Google Maps + Google address search (setup: guide Step 9).
- Without it, or if Google fails to load → a free OpenStreetMap backup map, so orders never get stuck.

## Delivery charge and delivery area
- Orders **below ₹299** pay **₹99 delivery**; ₹299 and above get **free delivery**. The cart shows Subtotal, Delivery and Total, plus "Add ₹X more for FREE delivery".
- Customers can only pick a delivery spot **within 20 km of central Guwahati** (covers the city, Amingaon/North Guwahati and the airport). Search results are limited to that area too.
- Both are checked again on the server, so they can't be bypassed. Change them any time in Vercel (FREE_DELIVERY_FROM, DELIVERY_FEE, DELIVERY_RADIUS_KM, etc. — see .env.example) and Redeploy.

## Stock management (Google Sheet)
You manage stock from a Google Sheet, on your phone or laptop. The website:
- shows **Sold out** when the tick box is off or the quantity is 0, and **Only N left** when 10 or fewer are left,
- stops anyone ordering more than what's left (checked again on the server before payment),
- **reduces the quantity automatically after every paid order**, and writes it to a "Sales log" tab.
WhatsApp (unpaid) orders don't reduce stock, so adjust those by hand when they're confirmed.

Columns: **id** (don't change) · **name** · **in_stock** (tick box) · **quantity** (leave empty for "no limit").
If the sheet isn't set up, or can't be reached, everything is treated as in stock, so the shop keeps selling.

Setup steps are in the launch guide, Step 8.

## Invoices, GST and receipt emails
- **Serial invoice numbers** for paid orders: `OTR/26-27/0001`, `0002`, `0003`… (new series every April). No repeats or gaps, even if two payments arrive at once. Needs the free **Upstash Redis** database connected in Vercel (guide Step 11). Without it, the order ref is used instead.
- **GST:** ice prices include 5% GST → invoice shows taxable value + CGST 2.5% + SGST 2.5% (place of supply Assam 18). Delivery charge: no GST. Seller details (GSTIN 18ADRPG9635P1ZJ, MSME, FSSAI, address, phones) are on every invoice.
- **Your email** (NOTIFY_EMAIL, via Resend): "[ORDER] New paid order OTR/26-27/0001 – ₹379.00" with delivery details, a Google Maps link and the full receipt.
- **Customer email**: "Thank you for ordering from On The Rocks 🧊 … Cheers!!" with the full receipt and a *View / download invoice (PDF)* button. Email is now required to pay online so the receipt can be sent.
- The order-confirmation screen also shows the invoice number and the download button. Every invoice is saved on the Razorpay order (notes → invoice_no), so your Razorpay dashboard is your order history.
- Please confirm the GST rate, HSN 2201 and no-GST-on-delivery with your CA.

## Order history – ontherocks.co.in/admin
- Every order is saved (paid online and WhatsApp) in the Upstash database: invoice no., date, customer, phone, email, address, map link, items, taxable value, CGST, SGST, delivery, total, payment ID.
- Open **ontherocks.co.in/admin** and enter ADMIN_PASSWORD (set it in Vercel). Works on phone and laptop.
- Filter by period (today, this/last month, financial year, custom dates), payment type and delivery status; search by name, phone or invoice no.
- Totals for the period (paid, not cancelled): sales, taxable value, CGST, SGST, delivery – for your GST return.
- Set each order's delivery status: New → Out for delivery → Delivered (or Cancelled). Cancelled orders drop out of the totals.
- **Download Excel (CSV)** of whatever is on screen. Links per order: invoice, Google Maps, WhatsApp the customer.
- Orders placed before this update aren't in the list (they're in your [ORDER] emails and Razorpay).

## Delivery slots (date and 1-hour time)

Customers must pick a delivery day and a 1-hour slot in the cart (step 1) before paying or ordering on WhatsApp.
The slot is checked again on the server, and it appears in your order email, the customer's receipt,
the tax invoice, the thank-you page, the admin page (and CSV) and the WhatsApp message.

Optional settings in Vercel → Settings → Environment Variables (defaults shown):

```
DELIVERY_START_HOUR=10   first slot starts at 10 am
DELIVERY_END_HOUR=22     last slot ends at 10 pm
SLOT_LEAD_MINUTES=60     a slot must start at least this many minutes from now
SLOT_DAYS=7              how many days ahead customers can book
```

## Thank-you page

After a successful payment the customer is taken to ontherocks.co.in/order?o=…&s=… which shows the thank-you
message, invoice number, delivery slot, address, items, GST split and total, with buttons to download the invoice
and to message you on WhatsApp. The link is signed, so nobody can view someone else's order by changing it.

## Delivery fee (since 24 Nov 2026)

Free delivery from FREE_DELIVERY_FROM (default ₹299). Below that, DELIVERY_FEE (default ₹99), but never more than
the amount that brings the order to ₹299 – so 1 pack = ₹179, 2 = ₹259, 3 = ₹299, 4 = ₹320 (free delivery).
The same rule is used on the website, in the server price check, on invoices and in emails.

## Order on WhatsApp

"Order On WhatsApp Instead" checks the slot, map pin, address, PIN code, name and phone, then opens WhatsApp to
+91 60033 68214 with the full order typed out (items, total, slot, address, map link, name, phone). No website
order or email is created; the customer sends the message and pays on delivery.

## Images

Images live in /img as separate files (the homepage used to carry them inside index.html). To change a product
photo, replace the file in /img with one of the same name.
