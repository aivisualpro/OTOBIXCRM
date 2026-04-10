import { MongoClient } from 'mongodb'
const uri = process.env.NUXT_MONGODB_URI
const client = new MongoClient(uri)
async function run() {
  await client.connect()
  const db = client.db('otobix_auction_app')
  const start = Date.now()
  const stats = await db.collection('bids').aggregate([
    { $group: { _id: { $toString: "$carId" }, totalBids: { $sum: 1 }, uniqueDealers: { $addToSet: { $toString: "$userId" } } } },
    { $project: { _id: 1, totalBids: 1, uniqueDealerCount: { $size: "$uniqueDealers" } } }
  ]).toArray()
  console.log(`Took ${Date.now() - start}ms, Got ${stats.length} car stats`)
  await client.close()
}
run()
