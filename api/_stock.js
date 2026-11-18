// Stock, read from your Google Sheet through a small Google Apps Script web app.
// Setup is in README.md ("Stock management"). If STOCK_URL is not set, every product counts as
// in stock and nothing here does anything, so the site keeps working without it.
const { env, HttpError, CATALOG } = require('./_lib');

let cache = { at: 0, items: null };
const CACHE_MS = 30 * 1000; // re-read the sheet at most every 30 seconds

// Returns { id: { available: bool, stock: number|null } } or null when stock is not set up / unreadable.
async function getStock(fresh = false) {
  const url = env('STOCK_URL');
  if (!url) return null;
  if (!fresh && cache.items && Date.now() - cache.at < CACHE_MS) return cache.items;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const j = await r.json();
    if (!j || typeof j.items !== 'object') throw new Error('unexpected reply: ' + JSON.stringify(j).slice(0, 120));
    const items = {};
    for (const [id, v] of Object.entries(j.items)) {
      const n = v && v.stock !== null && v.stock !== '' && v.stock !== undefined ? Number(v.stock) : null;
      items[id] = { available: !!(v && v.available), stock: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null };
    }
    cache = { at: Date.now(), items };
    return items;
  } catch (e) {
    // If the sheet can't be read, keep selling (using the last good copy if there is one).
    console.error('[stock] could not read the stock sheet:', e.message);
    return cache.items;
  }
}

const inStock = s => !s || (s.available && (s.stock === null || s.stock > 0));

// Throws a friendly 409 error if any cart line is sold out or more than what's left.
async function checkCartStock(items) {
  const stock = await getStock(true);
  if (!stock) return;
  for (const it of items) {
    const s = stock[it.id];
    const name = (CATALOG[it.id] || {}).n || it.id;
    if (!s) continue; // not listed in the sheet = no limit
    if (!inStock(s)) throw new HttpError(409, `Sorry, ${name} is sold out right now. Please remove it from your cart.`);
    if (s.stock !== null && it.qty > s.stock) {
      throw new HttpError(409, `Sorry, only ${s.stock} of ${name} left. Please lower the quantity in your cart.`);
    }
  }
}

// Subtracts a PAID order from the sheet and writes it to the "Sales log" tab.
// The script skips an order number it has already logged, so this is safe to call twice.
async function reduceStock(order, items) {
  const url = env('STOCK_URL'), secret = env('STOCK_SECRET');
  if (!url || !secret || !items.length) return;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, order, items }),
      redirect: 'follow',
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.error('[stock] update failed:', JSON.stringify(j).slice(0, 200));
    cache.at = 0; // force a fresh read next time
  } catch (e) {
    console.error('[stock] update failed:', e.message);
  }
}

// "otr1kg:2,globe:1" <-> [{id,qty}] — compact form stored in the Razorpay order notes.
const packCart = items => items.map(i => `${i.id}:${i.qty}`).join(',').slice(0, 255);
const unpackCart = s => String(s || '').split(',').map(p => p.split(':'))
  .filter(([id, q]) => CATALOG[id] && Number(q) > 0).map(([id, q]) => ({ id, qty: Math.floor(Number(q)) }));

module.exports = { getStock, inStock, checkCartStock, reduceStock, packCart, unpackCart };
