import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const queryParams = getQuery(event)

    const page = Math.max(1, parseInt(String(queryParams.page)) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(String(queryParams.limit)) || 30))
    const search = String(queryParams.search || '').trim()
    const tab = String(queryParams.tab || 'all')

    // For 'live' tab, always sort by soonest-ending first (auctionEndTime ascending)
    const sortField = tab === 'live' ? 'auctionEndTime' : String(queryParams.sort || '_id')
    const sortDir = tab === 'live' ? 1 : (String(queryParams.sortDir) === 'asc' ? 1 : -1)

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
      catch (e) {
        // Fallback or ignore
      }
    }

    // 1. Build Query Filter based on tab
    const filter: any = {}

    // Role-based visibility
    if (userRole === 'Retailer' && userEmail && queryParams.module === 'retail') {
      filter.retailAssociate = userEmail
    }

    // Always exclude blank auction statuses and 'inspected' based on legacy table logic
    filter.auctionStatus = { $exists: true, $nin: ['', ' ', 'inspected'] }

    if (tab === 'ended') {
      filter.auctionStatus = 'liveAuctionEnded'
    }
    else if (tab === 'customer-activity') {
      filter.auctionStatus = { $in: ['live', 'otobuy'] }
    }
    else if (tab === 'dealer-activity') {
      filter.auctionStatus = { $in: ['live', 'otobuy', 'upcoming'] }
    }
    else if (tab === 'followup') {
      filter.dealStatus = 'Under Negotiation'
    }
    else if (['upcoming', 'live', 'otobuy', 'sold', 'removed'].includes(tab)) {
      filter.auctionStatus = tab
    }
    else if (tab.startsWith('similar-search')) {
      const sMake = queryParams.similarMake ? String(queryParams.similarMake) : ''
      const sModel = queryParams.similarModel ? String(queryParams.similarModel) : ''
      const sYearStr = queryParams.similarYear ? String(queryParams.similarYear) : ''

      if (sMake)
        filter.make = sMake
      if (sModel)
        filter.model = sModel

      let baseYear = parseInt(sYearStr)
      if (isNaN(baseYear) && sYearStr) {
        const d = new Date(sYearStr)
        if (!isNaN(d.getTime())) {
          baseYear = d.getFullYear()
        }
        else {
          const yMatch = sYearStr.match(/\d{4}/)
          if (yMatch)
            baseYear = parseInt(yMatch[0])
        }
      }
      if (!isNaN(baseYear) && baseYear > 1900) {
        // yearMonthOfManufacture is a MongoDB Date field.
        // We match between Jan 1 of (baseYear - 1) and Dec 31 of (baseYear + 1)
        const startYear = baseYear - 1
        const endYear = baseYear + 1
        filter.yearMonthOfManufacture = {
          $gte: new Date(`${startYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${endYear}-12-31T23:59:59.999Z`),
        }
      }
    } // 'all' requires no additional filter

    console.log('[API:cars] tab:', tab, 'limit:', limit, 'filter:', JSON.stringify(filter))

    // 2. Add Search matches
    if (search) {
      // The search logic in UI matched these fields:
      // 'make', 'model', 'variant', 'registrationNumber', 'city', 'fuelType', 'appointmentId'
      const searchRegex = { $regex: new RegExp(search, 'i') }
      filter.$or = [
        { make: searchRegex },
        { model: searchRegex },
        { variant: searchRegex },
        { registrationNumber: searchRegex },
        { city: searchRegex },
        { fuelType: searchRegex },
        { appointmentId: searchRegex },
        { retailAssociate: searchRegex },
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
      filter.make = { $regex: new RegExp(filterMake, 'i') }
    if (filterModel)
      filter.model = { $regex: new RegExp(filterModel, 'i') }
    if (filterCity)
      filter.city = { $regex: new RegExp(filterCity, 'i') }
    if (filterAuctionStatus)
      filter.auctionStatus = { $regex: new RegExp(`^${filterAuctionStatus}$`, 'i') }
    if (filterDealStatus)
      filter.dealStatus = { $regex: new RegExp(`^${filterDealStatus}$`, 'i') }
    if (filterRA)
      filter.retailAssociate = { $regex: new RegExp(`^${filterRA}$`, 'i') }

    const filterStartDate = String(queryParams.filter_startDate || '').trim()
    const filterEndDate = String(queryParams.filter_endDate || '').trim()

    if (filterStartDate || filterEndDate) {
      const gteDate = filterStartDate ? new Date(filterStartDate) : null
      let lteDate: Date | null = null

      if (filterEndDate) {
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(filterEndDate)
        const endStr = isDateOnly ? `${filterEndDate}T23:59:59.999Z` : filterEndDate
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
      filter.$and.push({
        $expr: {
          $or: [buildDateExpr('createdAt'), buildDateExpr('timestamp')],
        },
      })
    }

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

      if (filter.appointmentId) {
        filter.appointmentId = { ...filter.appointmentId, $in: matchingApptIds }
      }
      else {
        filter.appointmentId = { $in: matchingApptIds }
      }
    }

    // 3. Document Projection
    const projection = {
      _id: 1,
      appointmentId: 1,
      make: 1,
      model: 1,
      variant: 1,
      yearMonthOfManufacture: 1,
      odometerReadingInKms: 1,
      fuelType: 1,
      ownerSerialNumber: 1,
      registrationNumber: 1,
      registrationDate: 1,
      registeredRto: 1,
      registrationState: 1,
      roadTaxValidity: 1,
      taxValidTill: 1,
      city: 1,
      auctionStatus: 1,
      auctionStartTime: 1,
      auctionEndTime: 1,
      priceDiscovery: 1,
      customerExpectedPrice: 1,
      cep: 1,
      fixedMargin: 1,
      variableMargin: 1,

      oneClickPrice: 1,
      otobuyOffer: 1,
      highestBid: 1,
      highestBidder: 1,
      biddersCount: 1, // Need this too
      soldAt: 1,
      soldTo: 1,
      soldToName: 1,
      dealStatus: 1,
      remarks: 1,
      followupTimeStamp: 1,
      retailChangeLog: 1,
      retailQuality: 1,
      retailAssociate: 1,
      saleReason: 1,
      tentativeHandoverDate: 1,
      imageUrl: 1,
      frontMain: 1,
      frontMainImages: { $slice: 1 },
      createdAt: 1,
      updatedAt: 1,
      approvalDate: 1,
      offeredPrice: 1,
    }

    const skip = (page - 1) * limit
    const coll = db.collection('cars')
    let cars: any[] = []
    let totalCount = 0

    if (sortField === 'approvalDate') {
      const currentModule = String(queryParams.module || '')
      const applyLivePriority = currentModule === 'auctions'

      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            effectiveSortDate: {
              $let: {
                vars: {
                  parsedApp: { $convert: { input: '$approvalDate', to: 'date', onError: null, onNull: null } },
                  parsedAuc: { $convert: { input: '$auctionStartTime', to: 'date', onError: null, onNull: null } },
                  parsedCre: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } },
                  fallbackId: { $convert: { input: '$_id', to: 'date', onError: null, onNull: null } },
                },
                in: {
                  $cond: {
                    if: { $ne: ['$$parsedApp', null] },
                    then: '$$parsedApp',
                    else: {
                      $cond: {
                        if: { $ne: ['$$parsedAuc', null] },
                        then: '$$parsedAuc',
                        else: {
                          $cond: {
                            if: { $ne: ['$$parsedCre', null] },
                            then: '$$parsedCre',
                            else: '$$fallbackId',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            // Live cars get priority 0 (top) ONLY in auctions module, everything else gets 1
            ...(applyLivePriority ? {
              _sortPriority: { $cond: { if: { $eq: ['$auctionStatus', 'live'] }, then: 0, else: 1 } },
              _parsedEndTime: { $convert: { input: '$auctionEndTime', to: 'date', onError: new Date('2099-01-01'), onNull: new Date('2099-01-01') } },
            } : {}),
          },
        },
        // For auctions: live-first, then by date. For retail/sales: pure date sort.
        { $sort: applyLivePriority
          ? { _sortPriority: 1, _parsedEndTime: 1, effectiveSortDate: sortDir, _id: -1 }
          : { effectiveSortDate: sortDir, _id: -1 },
        },
        { $skip: skip },
        { $limit: limit },
        { $project: { ...projection, frontMainImages: { $cond: { if: { $isArray: '$frontMainImages' }, then: { $slice: ['$frontMainImages', 1] }, else: '$frontMainImages' } } } },
      ]

      const [aggResult, count] = await Promise.all([
        coll.aggregate(pipeline).toArray(),
        coll.countDocuments(filter),
      ])
      cars = aggResult
      totalCount = count
    }
    else {
      const sortParams: any = { [sortField]: sortDir }
      if (sortField !== '_id')
        sortParams._id = -1 // secondary sort to stabilize

      const [findResult, count] = await Promise.all([
        coll.find(filter, { projection }).sort(sortParams).skip(skip).limit(limit).toArray(),
        coll.countDocuments(filter),
      ])
      cars = findResult
      totalCount = count
    }

    // Load autobids for these specific chunk of cars only
    const carIds = cars.map(c => c._id.toString())
    let autoBids: any[] = []
    if (carIds.length > 0) {
      autoBids = await db.collection('autoBidsForLiveSection')
        .find({ carId: { $in: carIds } })
        .toArray()

      if (autoBids.length > 0) {
        const userIds = [...new Set(autoBids.map(b => b.userId).filter(Boolean))]
        const queryUserIds = userIds.flatMap(id => [id, String(id).length === 24 ? new ObjectId(String(id)) : null]).filter(Boolean)

        const autoBidUsers = await db.collection('users')
          .find({ _id: { $in: queryUserIds } })
          .project({ shopName: 1, dealershipName: 1, fullName: 1, firstName: 1, lastName: 1, assignedKam: 1 })
          .toArray()

        const kamIds = [...new Set(autoBidUsers.map(u => u.assignedKam).filter(Boolean))]
        const queryKamIds = kamIds.flatMap(id => [id, String(id).length === 24 ? new ObjectId(String(id)) : null]).filter(Boolean)

        let autoBidKams: any[] = []
        if (queryKamIds.length > 0) {
          autoBidKams = await db.collection('kams')
            .find({ _id: { $in: queryKamIds } })
            .project({ userName: 1, name: 1, fullName: 1 })
            .toArray()
        }

        autoBids = autoBids.map((bid) => {
          const user = autoBidUsers.find(u => String(u._id) === String(bid.userId))
          if (user) {
            const kam = autoBidKams.find(k => String(k._id) === String(user.assignedKam))
            return {
              ...bid,
              dealerName: user.shopName || user.dealershipName || user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown Dealer',
              kamName: kam ? (kam.userName || kam.name || kam.fullName) : user.assignedKam,
            }
          }
          return bid
        })
      }
    }

    // Enrich highestBidder (userId) → dealer name + KAM name
    const bidderIds = [...new Set(cars.map(c => c.highestBidder).filter(Boolean))]
    let bidderMap: Record<string, { dealerName: string, kamName: string }> = {}
    if (bidderIds.length > 0) {
      const queryBidderIds = bidderIds.flatMap(id => [id, String(id).length === 24 ? new ObjectId(String(id)) : null]).filter(Boolean)
      const bidderUsers = await db.collection('users')
        .find({ _id: { $in: queryBidderIds } })
        .project({ shopName: 1, dealershipName: 1, fullName: 1, firstName: 1, lastName: 1, assignedKam: 1 })
        .toArray()

      const bidderKamIds = [...new Set(bidderUsers.map(u => u.assignedKam).filter(Boolean))]
      const queryBidderKamIds = bidderKamIds.flatMap(id => [id, String(id).length === 24 ? new ObjectId(String(id)) : null]).filter(Boolean)

      let bidderKams: any[] = []
      if (queryBidderKamIds.length > 0) {
        bidderKams = await db.collection('kams')
          .find({ _id: { $in: queryBidderKamIds } })
          .project({ userName: 1, name: 1, fullName: 1 })
          .toArray()
      }

      for (const user of bidderUsers) {
        const kam = bidderKams.find(k => String(k._id) === String(user.assignedKam))
        bidderMap[String(user._id)] = {
          dealerName: user.shopName || user.dealershipName || user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || '',
          kamName: kam ? (kam.userName || kam.name || kam.fullName || '') : (user.assignedKam || ''),
        }
      }
    }

    // Load related telecallings for lead data
    const apptIds = cars.map(c => c.appointmentId).filter(Boolean)
    let relatedLeads: any[] = []
    if (apptIds.length > 0) {
      relatedLeads = await db.collection('telecallings')
        .find(
          { appointmentId: { $in: apptIds } },
          { projection: { appointmentId: 1, appointmentSource: 1, referenceName: 1, allocatedTo: 1 } },
        )
        .toArray()
    }

    const mappedCars = cars.map((car) => {
      const carIdStr = car._id.toString()
      const lead = relatedLeads.find(l => l.appointmentId === car.appointmentId) || {}
      const bidderInfo = car.highestBidder ? bidderMap[String(car.highestBidder)] : null
      return {
        ...car,
        id: carIdStr,
        _id: carIdStr,
        autoBidsForLiveSection: autoBids.filter(b => String(b.carId) === carIdStr),
        highestBidderDealerName: bidderInfo?.dealerName || '',
        highestBidderKamName: bidderInfo?.kamName || '',
        leadSource: lead.appointmentSource || '',
        referredBy: lead.referenceName || '',
        inspectionEngineer: lead.allocatedTo || '',
      }
    })

    return {
      items: mappedCars,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    }
  }
  catch (err: any) {
    console.error('[API:cars] Failed to fetch cars:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch cars from database',
    })
  }
})
