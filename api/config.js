// GET /api/config → settings the web page needs. Only PUBLIC values belong here.
// GOOGLE_MAPS_KEY is a browser key: protect it in Google Cloud with a website restriction (see the guide).
const { env } = require('./_lib');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ googleMapsKey: env('GOOGLE_MAPS_KEY') || null });
};
