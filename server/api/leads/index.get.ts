// GET /api/leads — list telecallings sorted by createdAt desc
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const query = getQuery(event)

    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(1000, Math.max(1, Number(query.limit) || 500))
    const skip = (page - 1) * limit
    const search = (query.search as string || '').trim()

    // Build filter
    const filter: Record<string, any> = {}
    if (search) {
      filter.$or = [
        { ownerName: { $regex: search, $options: 'i' } },
        { customerContactNumber: { $regex: search, $options: 'i' } },
        { appointmentId: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ]
    }

    // Use aggregation to sort by createdAt OR timeStamp (older records may not have createdAt)
    const pipeline: any[] = [
      { $match: filter },
      {
        $addFields: {
          _sortDate: {
            $ifNull: [
              '$createdAt',
              { $ifNull: ['$timeStamp', '$_id'] },
            ],
          },
        },
      },
      { $sort: { _sortDate: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $unset: '_sortDate' },
    ]

    const [data, totalCount] = await Promise.all([
      db.collection('telecallings').aggregate(pipeline).toArray(),
      db.collection('telecallings').countDocuments(filter),
    ])

    return {
      data,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    resetLeadsDb()
    console.error('[API:leads] GET list failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch leads' })
  }
})
