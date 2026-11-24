// GET /api/config → settings the web page needs. Only PUBLIC values belong here.
// GOOGLE_MAPS_KEY is a browser key: protect it in Google Cloud with a website restriction (see the guide).
const { env, deliveryRules, deliveryArea, slotRules } = require('./_lib');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    googleMapsKey: env('GOOGLE_MAPS_KEY') || null,
    // Google reviews on the home page: your Google business. GOOGLE_PLACE_ID is best (map-check shows it);
    // without it the site searches Google for GOOGLE_PLACE_QUERY.
    googlePlaceId: env('GOOGLE_PLACE_ID') || null,
    googlePlaceQuery: env('GOOGLE_PLACE_QUERY') || 'On The Rocks ice cubes Guwahati',
    delivery: deliveryRules(),
    area: deliveryArea(),
    slots: slotRules(),
  });
};
