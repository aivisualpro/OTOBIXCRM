import { MongoClient } from 'mongodb'

export default defineEventHandler(async (event) => {
  const uri = process.env.NUXT_MONGODB_URI
  if (!uri) return { error: "No Mongo URI" }
  
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('otobix_auction_app')
    const bidsCollection = db.collection('bids')

    // Aggregate total bids and unique dealers across all cars
    const stats = await bidsCollection.aggregate([
      { 
        $group: { 
          _id: { $toString: "$carId" }, 
          totalBids: { $sum: 1 }, 
          uniqueDealers: { $addToSet: { $toString: "$userId" } } 
        } 
      },
      { 
        $project: { 
          _id: 1, 
          totalBids: 1, 
          uniqueDealerCount: { $size: "$uniqueDealers" } 
        } 
      }
    ]).toArray()

    const formattedStats = stats.reduce((acc: any, curr) => {
      if (curr._id) {
         acc[curr._id] = { totalBids: curr.totalBids, uniqueDealers: curr.uniqueDealerCount }
      }
      return acc
    }, {})

    return { success: true, stats: formattedStats }
  } catch (err: any) {
    return { success: false, error: err.message }
  } finally {
    await client.close()
  }
})
