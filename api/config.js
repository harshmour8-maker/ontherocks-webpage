// GET /api/config → settings the web page needs. Only PUBLIC values belong here.
// GOOGLE_MAPS_KEY is a browser key: protect it in Google Cloud with a website restriction (see the guide).
const { env, deliveryRules, deliveryArea, slotRules } = require('./_lib');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    googleMapsKey: env('GOOGLE_MAPS_KEY') || null,
    delivery: deliveryRules(),
    area: deliveryArea(),
    slots: slotRules(),
  });
};
