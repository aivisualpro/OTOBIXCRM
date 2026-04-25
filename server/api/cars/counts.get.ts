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

    // Advanced Filters
    const filterMake = String(queryParams.filter_make || '').trim()
    const filterModel = String(queryParams.filter_model || '').trim()
    const filterCity = String(queryParams.filter_city || '').trim()
    const filterAuctionStatus = String(queryParams.filter_auctionStatus || '').trim()
    const filterDealStatus = String(queryParams.filter_dealStatus || '').trim()
    const filterRA = String(queryParams.filter_ra || '').trim()
    const filterLeadSource = String(queryParams.filter_leadSource || '').trim()
    const filterReferredBy = String(queryParams.filter_referredBy || '').trim()
    const filterIE = String(queryParams.filter_ie || '').trim()

    if (filterMake)
      matchQuery.make = { $regex: new RegExp(filterMake, 'i') }
    if (filterModel)
      matchQuery.model = { $regex: new RegExp(filterModel, 'i') }
    if (filterCity)
      matchQuery.city = { $regex: new RegExp(filterCity, 'i') }
    if (filterAuctionStatus)
      matchQuery.auctionStatus = { $regex: new RegExp(`^${filterAuctionStatus}$`, 'i') }
    if (filterDealStatus)
      matchQuery.dealStatus = { $regex: new RegExp(`^${filterDealStatus}$`, 'i') }
    if (filterRA)
      matchQuery.retailAssociate = { $regex: new RegExp(`^${filterRA}$`, 'i') }

    // If filtering by lead fields, intersect appointmentIds
    if (filterLeadSource || filterReferredBy || filterIE) {
      const leadFilter: Record<string, any> = {}
      if (filterLeadSource)
        leadFilter.appointmentSource = { $regex: new RegExp(filterLeadSource, 'i') }
      if (filterReferredBy)
        leadFilter.referenceName = { $regex: new RegExp(filterReferredBy, 'i') }
      if (filterIE)
        leadFilter.allocatedTo = { $regex: new RegExp(filterIE, 'i') }

      const matchingLeads = await db.collection('telecallings').find(leadFilter, { projection: { appointmentId: 1 } }).toArray()
      const matchingApptIds = matchingLeads.map(l => l.appointmentId).filter(Boolean)

      if (matchQuery.appointmentId) {
        matchQuery.appointmentId = { ...matchQuery.appointmentId, $in: matchingApptIds }
      }
      else {
        matchQuery.appointmentId = { $in: matchingApptIds }
      }
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
