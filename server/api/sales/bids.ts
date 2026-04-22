import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const carId = query.carId as string
  if (!carId)
    return { error: 'Missing carId' }

  try {
    const db = await getLeadsDb(event)
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
      {
        $lookup: {
          from: 'kams',
          let: { kamId: '$dealer.assignedKam' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$kamId'] },
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$kamId' }] },
                  ],
                },
              },
            },
          ],
          as: 'kamDetails',
        },
      },
      { $unwind: { path: '$kamDetails', preserveNullAndEmptyArrays: true } },
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
            phone: bid.dealer.primaryContactNumber || bid.dealer.phone || bid.dealer.mobile || null,
            shopName: bid.dealer.shopName || bid.dealer.dealershipName || null,
            assignedKam: bid.dealer.assignedKam || null,
            kamName: bid.kamDetails?.userName || bid.kamDetails?.name || bid.kamDetails?.fullName || bid.kamDetails?.firstName || null,
          }
        : null,
    }))

    return { success: true, bids: cleanBids }
  }
  catch (err: any) {
    return { success: false, error: err.message }
  }
})
