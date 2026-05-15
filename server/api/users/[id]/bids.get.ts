// GET /api/users/[id]/bids — Fetch all bids placed by a specific dealer
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: 'User ID is required' })

  try {
    const db = await getLeadsDb(event)

    // Build userId match (both string and ObjectId forms)
    const userMatch = ObjectId.isValid(userId)
      ? {
          $or: [
            { userId },
            { userId: new ObjectId(userId) },
            { userId: userId.toString() },
          ],
        }
      : { userId }

    const bids = await db.collection('bids').aggregate([
      { $match: userMatch },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'cars',
          let: { cid: '$carId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$cid' }] },
                    { $eq: ['$appointmentId', '$$cid'] },
                  ],
                },
              },
            },
            { $project: { appointmentId: 1, make: 1, model: 1, variant: 1, frontMainImage: 1, frontMainImages: 1 } },
          ],
          as: 'carRef',
        },
      },
      { $unwind: { path: '$carRef', preserveNullAndEmptyArrays: true } },
      { $limit: 200 },
    ]).toArray()

    const result = bids.map(b => ({
      _id: b._id?.toString(),
      carId: b.carId?.toString?.() || b.carId,
      appointmentId: b.carRef?.appointmentId || null,
      make: b.carRef?.make || null,
      model: b.carRef?.model || null,
      variant: b.carRef?.variant || null,
      frontMainImage: b.carRef?.frontMainImage || b.carRef?.frontMainImages || null,
      bidAmount: b.bidAmount,
      time: b.createdAt || b.time || b.updatedAt,
    }))

    return { bids: result }
  }
  catch (err: any) {
    console.error('[API:users/bids] Failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch user bids' })
  }
})
