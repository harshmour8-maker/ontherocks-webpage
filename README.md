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
api/stock.js            GET /api/stock – the page uses it to show "Sold out" / "Only N left"
stock/stock-sheet.csv   starter stock sheet to import into Google Sheets
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

## Delivery location pin
At checkout, customers can tap **Pin your delivery location on the map**, then tap **Use my location** or drag the map under the pin, and confirm. If the address box is empty it is filled in for them.
Your [ORDER] email then has a **Map pin** line with a link that opens the exact spot in Google Maps.
The map uses free OpenStreetMap tiles, so there's no API key and no billing. The pin is optional for customers.

## Stock management (Google Sheet)
You manage stock from a Google Sheet, on your phone or laptop. The website:
- shows **Sold out** when the tick box is off or the quantity is 0, and **Only N left** when 10 or fewer are left,
- stops anyone ordering more than what's left (checked again on the server before payment),
- **reduces the quantity automatically after every paid order**, and writes it to a "Sales log" tab.
WhatsApp (unpaid) orders don't reduce stock, so adjust those by hand when they're confirmed.

Columns: **id** (don't change) · **name** · **in_stock** (tick box) · **quantity** (leave empty for "no limit").
If the sheet isn't set up, or can't be reached, everything is treated as in stock, so the shop keeps selling.

Setup steps are in the launch guide, Step 8.
