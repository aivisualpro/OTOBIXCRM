// GET /api/leads — list telecallings sorted by _id desc (newest first)
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const query = getQuery(event)

    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(2000, Math.max(1, Number(query.limit) || 1000))
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

    // Status filters (server-side mapping based on tab)
    const tab = (query.tab as string || 'all').trim().toLowerCase()

    // Internal MongoDB filter combination per tab (matches existing routeFilters)
    const tabFilters: Record<string, { inspectionStatus: string, approvalStatus: string }> = {
      'all': { inspectionStatus: '*', approvalStatus: '*' },
      'pending': { inspectionStatus: 'Pending', approvalStatus: '*' },
      'scheduled': { inspectionStatus: 'Scheduled', approvalStatus: '*' },
      're-scheduled': { inspectionStatus: 'Re-Scheduled', approvalStatus: '*' },
      'running': { inspectionStatus: 'Running', approvalStatus: '*' },
      'cancelled': { inspectionStatus: 'Cancelled', approvalStatus: '*' },
      're-inspection': { inspectionStatus: 'Re-Inspection', approvalStatus: '*' },
      'inspected': { inspectionStatus: 'Inspected', approvalStatus: 'Pending' },
      'under-review': { inspectionStatus: 'Inspected', approvalStatus: 'Under Review' },
      'quality-approved': { inspectionStatus: 'Inspected', approvalStatus: 'Approved' },
      'quality-rejected': { inspectionStatus: 'Inspected', approvalStatus: 'Quality Rejected' },
      'search-results': { inspectionStatus: '*', approvalStatus: '*' },
    }

    const { inspectionStatus, approvalStatus } = tabFilters[tab] || tabFilters.all!

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

    // Determine sort
    const sortField = (query.sort as string || '_id').trim()
    const sortDir = (query.sortDir as string || 'desc').trim().toLowerCase()
    const sortParams: Record<string, 1 | -1> = {
      [sortField]: sortDir === 'asc' ? 1 : -1,
    }

    // Projection to keep API lightweight (Lightweight list API)
    const projection = {
      _id: 1,
      appointmentId: 1,
      ownerName: 1,
      customerContactNumber: 1,
      make: 1,
      model: 1,
      variant: 1,
      yearOfManufacture: 1,
      yearOfRegistration: 1,
      odometerReadingInKms: 1,
      appointmentSource: 1,
      inspectionStatus: 1,
      priority: 1,
      inspectionDateTime: 1,
      inspectionAddress: 1,
      addedBy: 1,
      createdByFullName: 1,
      createdAt: 1,
      timeStamp: 1,
      allocatedTo: 1,
      qcBy: 1,
      approvalStatus: 1,
    }

    // Use find() with dynamic sort and projection
    const [data, totalCount] = await Promise.all([
      db.collection('telecallings')
        .find(filter)
        .project(projection)
        .sort(sortParams)
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('telecallings').countDocuments(filter),
    ])

    // Map _id to string id for frontend hydration
    const finalData = data.map((doc) => {
      const docId = doc._id?.toString()
      return { ...doc, _id: docId, id: docId }
    })

    return {
      items: finalData,
      total: totalCount,
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
