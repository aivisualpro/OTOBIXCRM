// GET /api/leads/counts — returns status group counts across the ENTIRE database
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const col = db.collection('telecallings')

    // Parse query parameters from frontend Advanced Filters seamlessly
    const query = getQuery(event)
    const filter: Record<string, any> = {}
    const search = String(query.search || '').trim()

    // Security scope parsing
    const userCookieStr = getCookie(event, 'userData')
    let _currentUser: Record<string, any> | null = null
    try {
      if (userCookieStr)
        _currentUser = JSON.parse(userCookieStr)
    }
    catch {}
    const isAdmin = _currentUser?.userType?.toLowerCase() === 'admin' || _currentUser?.userRole?.toLowerCase() === 'admin' || _currentUser?.role?.toLowerCase() === 'admin'
    const currentUserEmail = _currentUser?.email || ''

    // Date Filters dynamically
    const startDate = String(query.startDate || '').trim()
    const endDate = String(query.endDate || '').trim()
    const dateField = String(query.dateField || 'inspectionDateTime').trim()

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

    const filterMake = String(query.make || '').trim()
    if (filterMake)
      filter.make = filterMake

    const filterCity = String(query.city || '').trim()
    if (filterCity)
      filter.city = filterCity

    const filterPriority = String(query.priority || '').trim()
    if (filterPriority)
      filter.priority = filterPriority

    const filterAllocatedTo = String(query.allocatedTo || '').trim()
    if (filterAllocatedTo)
      filter.allocatedTo = filterAllocatedTo

    const filterCreatedBy = String(query.createdBy || '').trim()
    if (filterCreatedBy)
      filter.emailAddress = filterCreatedBy

    const filterAddedBy = String(query.addedBy || '').trim()
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

    // Single aggregate pipeline to count by compound (inspectionStatus + approvalStatus)
    const pipeline: any[] = [
      { $match: filter },
      {
        $group: {
          _id: {
            inspectionStatus: { $ifNull: ['$inspectionStatus', 'Pending'] },
            approvalStatus: { $ifNull: ['$approvalStatus', 'Pending'] },
            qcBy: { $ifNull: ['$qcBy', ''] },
          },
          count: { $sum: 1 },
        },
      },
    ]

    const buckets = await col.aggregate(pipeline).toArray()
    const totalCount = await col.countDocuments(filter)

    // Build a flat map: "inspectionStatus::approvalStatus::qcBy" → count
    const map: Record<string, number> = {}
    for (const b of buckets) {
      const key = `${b._id.inspectionStatus}::${b._id.approvalStatus}::${b._id.qcBy}`
      map[key] = b.count
    }

    // Helper: sum counts matching a compound filter (* = any)
    function countFor(inspStatus: string, appStatus: string): number {
      if (inspStatus === '*' && appStatus === '*')
        return totalCount
      let total = 0
      for (const [k, v] of Object.entries(map)) {
        const [isRaw, asRaw, qcByRaw] = k.split('::')
        const is = String(isRaw || '').trim()
        const as_ = String(asRaw || '').trim()
        if ((inspStatus === '*' || is === inspStatus) && (appStatus === '*' || as_ === appStatus)) {
          // Restrict "Under Review" count to only the current user's leads if not admin
          if (appStatus === 'Under Review' && !isAdmin && currentUserEmail) {
            if (qcByRaw !== currentUserEmail)
              continue
          }
          total += v
        }
      }
      return total
    }

    return {
      totalCount,
      counts: {
        'leads': countFor('Pending', '*'),
        'scheduled': countFor('Scheduled', '*'),
        're-scheduled': countFor('Re-Scheduled', '*'),
        'running': countFor('Running', '*'),
        'cancelled': countFor('Cancelled', '*'),
        're-inspection': countFor('Re-Inspection', '*'),
        'inspected': countFor('Inspected', 'Pending'),
        'under-review': countFor('Inspected', 'Under Review'),
        'quality-approved': countFor('Inspected', 'Approved'),
        'quality-rejected': countFor('Inspected', 'Quality Rejected'),
      },
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    resetLeadsDb()
    console.error('[API:leads] GET counts failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch counts' })
  }
})
