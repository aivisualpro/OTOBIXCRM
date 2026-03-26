// GET /api/leads/counts — returns status group counts across the ENTIRE database
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const col = db.collection('telecallings')

    // Parse session identity tightly mapping active roles securely
    const userCookieStr = getCookie(event, 'userData')
    let currentUser: Record<string, any> | null = null
    try { if (userCookieStr) currentUser = JSON.parse(userCookieStr) } catch (e) {}

    const filter: Record<string, any> = {}
    if (currentUser && String(currentUser.userRole || currentUser.userType || currentUser.role) === 'Telecaller') {
      filter.emailAddress = currentUser.email || ''
    }

    // Single aggregate pipeline to count by compound (inspectionStatus + approvalStatus)
    const pipeline: any[] = [
      { $match: filter },
      {
        $group: {
          _id: {
            inspectionStatus: { $ifNull: ['$inspectionStatus', 'Pending'] },
            approvalStatus: { $ifNull: ['$approvalStatus', 'Pending'] },
          },
          count: { $sum: 1 },
        },
      },
    ]

    const buckets = await col.aggregate(pipeline).toArray()
    const totalCount = await col.countDocuments(filter)

    // Build a flat map: "inspectionStatus::approvalStatus" → count
    const map: Record<string, number> = {}
    for (const b of buckets) {
      const key = `${b._id.inspectionStatus}::${b._id.approvalStatus}`
      map[key] = b.count
    }

    // Helper: sum counts matching a compound filter (* = any)
    function countFor(inspStatus: string, appStatus: string): number {
      if (inspStatus === '*' && appStatus === '*') return totalCount
      let total = 0
      for (const [k, v] of Object.entries(map)) {
        const [is, as_] = k.split('::')
        if ((inspStatus === '*' || is === inspStatus) && (appStatus === '*' || as_ === appStatus)) {
          total += v
        }
      }
      return total
    }

    return {
      totalCount,
      counts: {
        'leads': countFor('Pending', 'Pending'),
        'scheduled': countFor('Scheduled', 'Pending'),
        're-scheduled': countFor('Rescheduled', 'Pending'),
        'cancelled': countFor('Cancelled', 'Pending'),
        're-inspection': countFor('Re-Inspected', '*'),
        'inspected': countFor('Inspected', 'Pending'),
        'under-review': countFor('Inspected', 'Under Review'),
        'quality-approved': countFor('Running', 'Approved'),
        'quality-rejected': countFor('Inspected', 'Rejected'),
      },
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    resetLeadsDb()
    console.error('[API:leads] GET counts failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch counts' })
  }
})
