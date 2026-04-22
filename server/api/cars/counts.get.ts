export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const queryParams: Record<string, string> = getQuery(event)
    const search = (queryParams.search || '').trim()

    // Parse userData cookie to enforce Role Base Access Control (RBAC)
    const rawUserData = getCookie(event, 'userData')
    let userEmail = ''
    let userRole = ''
    if (rawUserData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(rawUserData))
        userEmail = decoded.email || ''
        userRole = decoded.userRole || decoded.role || ''
      }
      catch (e) {}
    }

    // Base filter excludes completely blank auction statuses and 'inspected' based on legacy table logic
    const matchQuery: any = { auctionStatus: { $exists: true, $nin: ['', ' ', 'inspected'] } }

    // Role-based visibility
    if (userRole === 'Retailer' && userEmail && queryParams.module === 'retail') {
      matchQuery.retailAssociate = userEmail
    }

    if (search) {
      const regex = { $regex: new RegExp(search, 'i') }
      matchQuery.$or = [
        { make: regex },
        { model: regex },
        { variant: regex },
        { registrationNumber: regex },
        { city: regex },
        { fuelType: regex },
        { appointmentId: regex },
        { retailAssociate: regex },
      ]
    }

    const coll = db.collection('cars')

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: '$auctionStatus',
          count: { $sum: 1 },
        },
      },
    ]

    // For 'followup' tab we need to count cars where dealStatus is Under Negotiation
    const followupCountPipeline = [
      { $match: { ...matchQuery, dealStatus: 'Under Negotiation' } },
      { $count: 'count' },
    ]
    const followupRes = await coll.aggregate(followupCountPipeline).toArray()
    const followupCount = followupRes[0]?.count || 0

    const result = await coll.aggregate(aggregationPipeline).toArray()

    // Map backend statuses to simple count mapping
    const rawCounts = result.reduce((acc, stage) => {
      acc[stage._id] = stage.count
      return acc
    }, {} as Record<string, number>)

    const counts: Record<string, number> = {
      upcoming: rawCounts.upcoming || 0,
      live: rawCounts.live || 0,
      otobuy: rawCounts.otobuy || 0,
      ended: rawCounts.liveAuctionEnded || 0,
      sold: rawCounts.sold || 0,
      removed: rawCounts.removed || 0,
    }

    // Aggregate complex tabs
    counts['customer-activity'] = (counts.live || 0) + (counts.otobuy || 0)
    counts['dealer-activity'] = (counts.live || 0) + (counts.otobuy || 0) + (counts.upcoming || 0)
    counts.followup = followupCount
    counts.all = Object.values(rawCounts).reduce((a, b) => a + b, 0)

    return counts
  }
  catch (err: any) {
    console.error('Failed to fetch car counts:', err)
    return {}
  }
})
