import { MongoClient, ObjectId } from 'mongodb'

let _client: MongoClient | null = null

async function getClient(uri: string): Promise<MongoClient> {
  if (_client) {
    try {
      await _client.db('admin').command({ ping: 1 })
      return _client
    }
    catch {
      try { await _client.close() } catch {}
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
  const query = getQuery(event)
  const carId = query.carId as string
  if (!carId)
    return { error: 'Missing carId' }

  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || process.env.NUXT_MONGODB_URI || ''
  if (!uri)
    return { error: 'No Mongo URI' }

  try {
    const client = await getClient(uri)
    const db = client.db('otobix_auction_app')
    const bidsCollection = db.collection('bids')

    const matchCondition = {
      $or: [
        { carId },
        { carId: carId.length === 24 ? new ObjectId(carId) : null },
      ].filter(x => x.carId !== null),
    }

    const bids = await bidsCollection.aggregate([
      { $match: matchCondition },
      { $sort: { bidAmount: -1, createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$uid'] },
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$uid' }] },
                  ],
                },
              },
            },
          ],
          as: 'dealer',
        },
      },
      { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
    ]).toArray()

    // Clean up recursive payload properties to avoid enormous network overhead
    const cleanBids = bids.map(bid => ({
      _id: bid._id,
      bidAmount: bid.bidAmount,
      createdAt: bid.createdAt || bid.time,
      isActive: bid.isActive,
      isSystemBid: bid.isSystemBid ?? false,
      dealer: bid.dealer
        ? {
            fullName: bid.dealer.fullName || [bid.dealer.firstName, bid.dealer.lastName].filter(Boolean).join(' ') || null,
            phone: bid.dealer.phone || bid.dealer.mobile || null,
            shopName: bid.dealer.shopName || bid.dealer.dealershipName || null,
          }
        : null,
    }))

    return { success: true, bids: cleanBids }
  }
  catch (err: any) {
    _client = null
    return { success: false, error: err.message }
  }
})
