import { MongoClient } from 'mongodb'

async function test() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db('otobix_auction_app')

  const countAgg = await db.collection('telecallings').aggregate([
    {
      $group: {
        _id: {
          inspectionStatus: { $ifNull: ['$inspectionStatus', 'Pending'] },
        },
        count: { $sum: 1 },
      },
    },
  ]).toArray()

  console.log('Aggregate counts:', JSON.stringify(countAgg, null, 2))

  const countQuery = await db.collection('telecallings').countDocuments({
    inspectionStatus: { $regex: /^\s*Scheduled\s*$/i },
  })
  console.log('Regex count:', countQuery)

  await client.close()
}
test().catch(console.error)
