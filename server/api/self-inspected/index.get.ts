// GET /api/self-inspected — list selfInspectedCars sorted by _id desc
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const query = getQuery(event)

    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(2000, Math.max(1, Number(query.limit) || 500))
    const skip = (page - 1) * limit
    const search = (query.search as string || '').trim()
    const statusFilter = (query.auctionStatus as string || '').trim()

    const filter: Record<string, any> = {}

    if (statusFilter) {
      filter.auctionStatus = statusFilter
    }

    if (search) {
      filter.$or = [
        { inspectionId: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { registeredOwner: { $regex: search, $options: 'i' } },
      ]
    }

    const col = db.collection('selfInspectedCars')

    const [data, totalCount] = await Promise.all([
      col.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ])

    const items = data.map((doc: any) => {
      const id = doc._id?.toString()
      return { ...doc, _id: id, id }
    })

    // Compute status counts
    const countPipeline = [
      { $group: { _id: '$auctionStatus', count: { $sum: 1 } } },
    ]
    const countBuckets = await col.aggregate(countPipeline).toArray()
    const statusCounts: Record<string, number> = {}
    let allCount = 0
    for (const b of countBuckets) {
      statusCounts[b._id || 'unknown'] = b.count
      allCount += b.count
    }
    statusCounts.all = allCount

    return {
      items,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      statusCounts,
    }
  }
  catch (err: any) {
    console.error('[API:self-inspected] GET list failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch self-inspected cars' })
  }
})
