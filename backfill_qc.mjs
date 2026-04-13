import { MongoClient } from 'mongodb';

async function run() {
  const uri = 'mongodb+srv://AmitParekh:OtoBixAuctionApp@otobix.hihrzsi.mongodb.net/?retryWrites=true&w=majority&appName=OtoBix';
  const c = new MongoClient(uri);
  await c.connect();
  console.log('Connected.');
  for (const dbName of ['otobix_auction_app_development', 'otobix_auction_app']) {
     const db = c.db(dbName);
     const carsCursor = db.collection('cars').find({ qcBy: { $exists: true, $ne: null, $ne: '' }});
     let count = 0;
     for await (const car of carsCursor) {
        if (!car.appointmentId) continue;
        const res = await db.collection('telecallings').updateOne(
           { appointmentId: car.appointmentId },
           { $set: { qcBy: car.qcBy } }
        );
        if (res.modifiedCount > 0) count++;
     }
     console.log(`Updated ${count} telecallings in ${dbName}`);
  }
  await c.close();
  process.exit(0);
}
run().catch(console.error);
