// POST /api/create-order  { items:[{id,qty}], customer:{name,phone,email,city,address,lat?,lng?} }
// Prices the cart on the server, checks stock, and creates a Razorpay order. Customer and item
// details are saved in the order's notes, so every order is visible in your Razorpay dashboard too.
const { handler, HttpError, priceCart, checkCustomer, checkSlot, razorpay, env, CATALOG } = require('./_lib');
const { checkCartStock, packCart } = require('./_stock');

module.exports = handler(async body => {
  const { total, delivery, lines } = priceCart(body.items);
  const c = checkCustomer(body.customer);
  if (!c.email) throw new HttpError(400, 'Add your email so we can send your receipt.');
  const slot = checkSlot(body.slot);
  const items = body.items.map(i => ({ id: i.id, qty: Math.floor(Number(i.qty)), price: CATALOG[i.id].p }));
  await checkCartStock(items);
  const ref = 'OTR-' + Date.now().toString(36).toUpperCase();

  const order = await razorpay('orders', {
    amount: Math.round(total * 100), // paise
    currency: 'INR',
    receipt: ref,
    notes: {
      name: c.name, phone: c.phone, email: c.email || '-', city: c.city,
      address: c.address, map_address: c.mapAddress || '-', items: lines.join('; ').slice(0, 255),
      cart: packCart(items), delivery: String(delivery), slot: `${slot.label}|${slot.start}`,
      location: c.lat !== undefined ? `${c.lat},${c.lng}` : '-',
    },
  });

  return { orderId: order.id, amount: order.amount, keyId: env('RAZORPAY_KEY_ID'), ref };
});
