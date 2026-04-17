export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
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
    return { success: false, error: err.message }
  }
})
