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

    // Base filter
    const matchQuery: any = { auctionStatus: { $exists: true, $nin: ['', ' ', 'inspected'] } }

    // Tab filtering from query params
    const tab = (queryParams.tab || '').toLowerCase()
    if (tab && tab !== 'all' && tab !== 'followup' && tab !== 'customer-activity') {
      if (tab === 'ended')
        matchQuery.auctionStatus = 'liveAuctionEnded'
      else matchQuery.auctionStatus = tab
    }
    else if (tab === 'followup') {
      matchQuery.dealStatus = 'Under Negotiation'
    }
    else if (tab === 'customer-activity') {
      matchQuery.auctionStatus = { $in: ['live', 'otobuy'] }
    }

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
        $lookup: {
          from: 'telecallings',
          localField: 'appointmentId',
          foreignField: 'appointmentId',
          as: 'lead',
        },
      },
      {
        $unwind: {
          path: '$lead',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $facet: {
          makes: [{ $group: { _id: { $toUpper: '$make' } } }],
          models: [{ $group: { _id: { $toUpper: '$model' } } }],
          cities: [{ $group: { _id: { $toUpper: '$city' } } }],
          auctionStatuses: [{ $group: { _id: { $toUpper: '$auctionStatus' } } }],
          dealStatuses: [{ $group: { _id: { $toUpper: '$dealStatus' } } }],
          ras: [{ $group: { _id: { $toLower: '$retailAssociate' } } }],
          leadSources: [{ $group: { _id: { $toUpper: '$lead.appointmentSource' } } }],
          referredBys: [{ $group: { _id: { $toUpper: '$lead.referenceName' } } }],
          ies: [{ $group: { _id: { $toLower: '$lead.allocatedTo' } } }],
        },
      },
    ]

    const result = await coll.aggregate(aggregationPipeline).toArray()
    const facets = result[0] || {}

    const formatFacet = (facetArr: any[]) => {
      if (!facetArr)
        return []
      const items = facetArr
        .map(item => typeof item._id === 'string' ? item._id.trim() : item._id)
        .filter(id => id !== null && id !== undefined && id !== '')
      return Array.from(new Set(items)).sort()
    }

    return {
      makes: formatFacet(facets.makes),
      models: formatFacet(facets.models),
      cities: formatFacet(facets.cities),
      auctionStatuses: formatFacet(facets.auctionStatuses),
      dealStatuses: formatFacet(facets.dealStatuses),
      ras: formatFacet(facets.ras),
      leadSources: formatFacet(facets.leadSources),
      referredBys: formatFacet(facets.referredBys),
      ies: formatFacet(facets.ies),
    }
  }
  catch (error: any) {
    console.error('API Error in /cars/facets:', error)
    return createError({
      statusCode: 500,
      message: error.message || 'Internal Server Error',
    })
  }
})
