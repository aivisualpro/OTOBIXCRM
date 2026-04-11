import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

async function getClient(uri: string): Promise<MongoClient> {
  if (_client) {
    try {
      await _client.db('admin').command({ ping: 1 })
      return _client
    }
    catch {
      try { await _client.close() }
      catch {}
      _client = null
    }
  }
  _client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  })
  await _client.connect()
  return _client
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || process.env.NUXT_MONGODB_URI || ''
  if (!uri)
    return { error: 'No Mongo URI' }

  try {
    const client = await getClient(uri)
    const db = client.db('otobix_auction_app')
    const bidsCollection = db.collection('bids')

    // Aggregate total bids and unique dealers across all cars
    const stats = await bidsCollection.aggregate([
      {
        $group: {
          _id: { $toString: '$carId' },
          totalBids: { $sum: 1 },
          uniqueDealers: { $addToSet: { $toString: '$userId' } },
          lastBidAt: { $max: '$updatedAt' },
        },
      },
      {
        $project: {
          _id: 1,
          totalBids: 1,
          uniqueDealerCount: { $size: '$uniqueDealers' },
          lastBidAt: 1,
        },
      },
    ]).toArray()

    const formattedStats = stats.reduce((acc: any, curr) => {
      if (curr._id) {
        acc[curr._id] = {
          totalBids: curr.totalBids,
          uniqueDealers: curr.uniqueDealerCount,
          lastBidAt: curr.lastBidAt,
        }
      }
      return acc
    }, {})

    return { success: true, stats: formattedStats }
  }
  catch (err: any) {
    _client = null
    return { success: false, error: err.message }
  }
})
