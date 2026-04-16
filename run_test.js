const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'otobix_auction_app');
  
  const appt = '26-101291';
  
  const tele = await db.collection('telecallings').findOne({ appointmentId: appt });
  const car = await db.collection('cars').findOne({ appointmentId: appt });
  
  console.log("TELECALLINGS:", tele ? { policyNumber: tele.policyNumber, oldKey: tele.insurancePolicyNumber } : null);
  console.log("CARS:", car ? { policyNumber: car.policyNumber, oldKey: car.insurancePolicyNumber } : null);
  
  await db.collection('cars').updateOne({ appointmentId: appt }, { $set: { policyNumber: "direct_test_1" } });
  
  const carAfter = await db.collection('cars').findOne({ appointmentId: appt });
  console.log("CARS AFTER DIRECT:", { policyNumber: carAfter.policyNumber });
  
  await client.close();
}
run().catch(console.error);
