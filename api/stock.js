// GET /api/stock → { items: { id: { available, stock } } }  (items is null when stock isn't set up)
// The website calls this when it loads to show "Sold out" / "Only N left".
const { getStock } = require('./_stock');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const items = await getStock();
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
  res.status(200).json({ items });
};
