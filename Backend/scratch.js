import mongoose from 'mongoose';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function main() {
  const uri = 'mongodb+srv://tuggo:tuggo@tuggo.0kod4zf.mongodb.net/tuggo';
  await mongoose.connect(uri);

  const order = await mongoose.connection.collection('food_orders').findOne({
    order_id: 'FOD-6051837'
  });

  const rest = await mongoose.connection.collection('food_restaurants').findOne({
    _id: new mongoose.Types.ObjectId(order.restaurantId)
  });

  const feeSettings = await mongoose.connection.collection('payment_fee_settings').find({}).toArray();
  console.log('--- FEE SETTINGS in DB ---');
  console.log(JSON.stringify(feeSettings, null, 2));

  const riderCommissionRules = await mongoose.connection.collection('payment_delivery_commission_rules').find({}).toArray();
  console.log('--- RIDER COMMISSION RULES in DB ---');
  console.log(JSON.stringify(riderCommissionRules, null, 2));

  // Coordinates
  const [rLng, rLat] = rest.location.coordinates;
  const [dLng, dLat] = order.deliveryAddress.location.coordinates;

  console.log('--- COORDINATES ---');
  console.log(`Restaurant (${rest.name}): lat=${rLat}, lng=${rLng}, address=${rest.location?.formattedAddress || rest.location?.address}`);
  console.log(`Customer (${order.customerName}): lat=${dLat}, lng=${dLng}, address=${order.deliveryAddress?.street}, ${order.deliveryAddress?.city}`);

  const aerialDistance = haversineKm(rLat, rLng, dLat, dLng);
  console.log(`Aerial / Haversine Distance: ${aerialDistance.toFixed(3)} km`);

  // Test Google Maps Distance Matrix if possible
  const apiKey = 'AIzaSyCf99C2zeIaD6vR8nVsWbHOJONcdy67NAc';
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${rLat},${rLng}&destinations=${dLat},${dLng}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log('Google Distance Matrix Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Google Maps error:', err.message);
  }

  // Check rider assignment details
  const partnerId = order.dispatch?.deliveryPartnerId;
  if (partnerId) {
    const partner = await mongoose.connection.collection('food_delivery_partners').findOne({
      _id: new mongoose.Types.ObjectId(partnerId)
    }) || await mongoose.connection.collection('fooddeliverypartners').findOne({
      _id: new mongoose.Types.ObjectId(partnerId)
    });
    console.log('--- DELIVERY PARTNER ---');
    console.log('Partner:', partner?.name, partner?.phone, partner?.currentLocation || partner?.location);
  }

  // Check any transaction or logs for this order
  const transactions = await mongoose.connection.collection('payment_food_transactions').find({
    orderId: order._id
  }).toArray();
  console.log('--- TRANSACTIONS ---');
  console.log(JSON.stringify(transactions, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
