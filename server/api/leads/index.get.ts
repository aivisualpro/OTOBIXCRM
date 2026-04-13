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

    // Security scope filtering for constrained roles
    const userCookieStr = getCookie(event, 'userData')
    let _currentUser: Record<string, any> | null = null
    try {
      if (userCookieStr)
        _currentUser = JSON.parse(userCookieStr)
    }
    catch {}

    const isAdmin = _currentUser?.userType?.toLowerCase() === 'admin' || _currentUser?.userRole?.toLowerCase() === 'admin' || _currentUser?.role?.toLowerCase() === 'admin'
    const currentUserEmail = _currentUser?.email || ''

    // Status filters (server-side filtering for paginated status tabs)
    const inspectionStatus = (query.inspectionStatus as string || '').trim()
    const approvalStatus = (query.approvalStatus as string || '').trim()
    if (inspectionStatus && inspectionStatus !== '*') {
      filter.inspectionStatus = { $regex: `^\\s*${inspectionStatus}\\s*$`, $options: 'i' }
    }
    if (approvalStatus && approvalStatus !== '*') {
      filter.approvalStatus = { $regex: `^\\s*${approvalStatus}\\s*$`, $options: 'i' }

      // Strict isolation for "Under Review" records
      if (approvalStatus.toLowerCase() === 'under review' && !isAdmin && currentUserEmail) {
        filter.qcBy = currentUserEmail
      }
    }

    // Advanced Filters
    const startDate = (query.startDate as string || '').trim()
    const endDate = (query.endDate as string || '').trim()
    const dateField = (query.dateField as string || 'inspectionDateTime').trim()

    if (startDate || endDate) {
      const gteDate = startDate ? new Date(startDate) : null
      let lteDate: Date | null = null

      if (endDate) {
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        const endStr = isDateOnly ? `${endDate}T23:59:59.999Z` : endDate
        lteDate = new Date(endStr)
      }

      // Evaluates generic erratic strings like "03/27/2026 10:00 AM" uniformly as verifiable timestamps dynamically at runtime without crashing limits
      const buildDateExpr = (fieldKey: string) => {
        const fieldSelector = `$${fieldKey}`
        const dateParserObj = { $convert: { input: fieldSelector, to: 'date', onError: null, onNull: null } }

        const conditions = []
        if (gteDate)
          conditions.push({ $gte: [dateParserObj, gteDate] })
        if (lteDate)
          conditions.push({ $lte: [dateParserObj, lteDate] })
        return { $and: conditions }
      }

      filter.$and = filter.$and || []

      if (dateField === 'createdAt') {
        filter.$and.push({
          $expr: {
            $or: [buildDateExpr('createdAt'), buildDateExpr('timeStamp')],
          },
        })
      }
      else {
        filter.$and.push({
          $expr: buildDateExpr(dateField),
        })
      }
    }

    const filterMake = (query.make as string || '').trim()
    if (filterMake)
      filter.make = filterMake

    const filterCity = (query.city as string || '').trim()
    if (filterCity)
      filter.city = filterCity

    const filterPriority = (query.priority as string || '').trim()
    if (filterPriority)
      filter.priority = filterPriority

    const filterAllocatedTo = (query.allocatedTo as string || '').trim()
    if (filterAllocatedTo)
      filter.allocatedTo = filterAllocatedTo

    const filterCreatedBy = (query.createdBy as string || '').trim()
    if (filterCreatedBy)
      filter.emailAddress = filterCreatedBy

    const filterAddedBy = (query.addedBy as string || '').trim()
    if (filterAddedBy) {
      filter.$and = filter.$and || []
      filter.$and.push({ addedBy: { $regex: filterAddedBy, $options: 'i' } })
    }

    if (search) {
      filter.$and = filter.$and || []
      filter.$and.push({
        $or: [
          { ownerName: { $regex: search, $options: 'i' } },
          { customerContactNumber: { $regex: search, $options: 'i' } },
          { appointmentId: { $regex: search, $options: 'i' } },
          { make: { $regex: search, $options: 'i' } },
          { model: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
        ],
      })
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
      // Fetch fallback qcBy from cars if missing natively on telecallings
      {
        $lookup: {
          from: 'cars',
          localField: 'appointmentId',
          foreignField: 'appointmentId',
          as: 'carDoc',
        },
      },
      {
        $addFields: {
          qcBy: {
            $ifNull: ['$qcBy', { $arrayElemAt: ['$carDoc.qcBy', 0] }],
          },
        },
      },
      { $unset: 'carDoc' },
      // Lookup the creator name inside strictly linked `users` instance
      {
        $lookup: {
          from: 'users',
          localField: 'emailAddress',
          foreignField: 'email',
          as: 'creatorPopulated',
        },
      },
      {
        $addFields: {
          createdByFullName: {
            $ifNull: [
              { $arrayElemAt: ['$creatorPopulated.userName', 0] },
              '$emailAddress', // fallback correctly naturally to strictly raw email if not fully found matching legacy behavior requested
            ],
          },
        },
      },
      { $unset: 'creatorPopulated' },
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
    if (err.statusCode)
      throw err
    resetLeadsDb()
    console.error('[API:leads] GET list failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch leads' })
  }
})
