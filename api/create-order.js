// POST /api/create-order  { items:[{id,qty}], customer:{name,phone,email,city,address} }
// Prices the cart on the server and creates a Razorpay order. Customer and item details are
// saved in the order's notes, so every order is visible in your Razorpay dashboard too.
const { handler, priceCart, checkCustomer, razorpay, env } = require('./_lib');

module.exports = handler(async body => {
  const { total, lines } = priceCart(body.items);
  const c = checkCustomer(body.customer);
  const ref = 'OTR-' + Date.now().toString(36).toUpperCase();

  const order = await razorpay('orders', {
    amount: total * 100, // paise
    currency: 'INR',
    receipt: ref,
    notes: {
      name: c.name, phone: c.phone, email: c.email || '-', city: c.city,
      address: c.address, items: lines.join('; ').slice(0, 255), total: String(total),
    },
  });

  return { orderId: order.id, amount: order.amount, keyId: env('RAZORPAY_KEY_ID'), ref };
});
