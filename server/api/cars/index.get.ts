export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const queryParams = getQuery(event)

    const page = Math.max(1, parseInt(String(queryParams.page)) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(String(queryParams.limit)) || 30))
    const search = String(queryParams.search || '').trim()
    const sortField = String(queryParams.sort || '_id')
    const sortDir = String(queryParams.sortDir) === 'asc' ? 1 : -1
    const tab = String(queryParams.tab || 'all')

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
      
      if (sMake) filter.make = sMake
      if (sModel) filter.model = sModel
      
      let baseYear = parseInt(sYearStr)
      if (isNaN(baseYear) && sYearStr) {
        const d = new Date(sYearStr)
        if (!isNaN(d.getTime())) {
          baseYear = d.getFullYear()
        } else {
          const yMatch = sYearStr.match(/\d{4}/)
          if (yMatch) baseYear = parseInt(yMatch[0])
        }
      }
      if (!isNaN(baseYear) && baseYear > 1900) {
        // yearMonthOfManufacture is a MongoDB Date field.
        // We match between Jan 1 of (baseYear - 1) and Dec 31 of (baseYear + 1)
        const startYear = baseYear - 1
        const endYear = baseYear + 1
        filter.yearMonthOfManufacture = {
          $gte: new Date(`${startYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${endYear}-12-31T23:59:59.999Z`)
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
      marginSimulation: 1,
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
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            effectiveSortDate: {
              $let: {
                vars: {
                  parsedApp: { $convert: { input: "$approvalDate", to: "date", onError: null, onNull: null } },
                  parsedAuc: { $convert: { input: "$auctionStartTime", to: "date", onError: null, onNull: null } },
                  parsedCre: { $convert: { input: "$createdAt", to: "date", onError: null, onNull: null } },
                  fallbackId: { $convert: { input: "$_id", to: "date", onError: null, onNull: null } }
                },
                in: {
                  $cond: {
                    if: { $ne: ["$$parsedApp", null] },
                    then: "$$parsedApp",
                    else: {
                      $cond: {
                        if: { $ne: ["$$parsedAuc", null] },
                        then: "$$parsedAuc",
                        else: {
                          $cond: {
                            if: { $ne: ["$$parsedCre", null] },
                            then: "$$parsedCre",
                            else: "$$fallbackId"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        { $sort: { effectiveSortDate: sortDir, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { ...projection, frontMainImages: { $cond: { if: { $isArray: "$frontMainImages" }, then: { $slice: ["$frontMainImages", 1] }, else: "$frontMainImages" } } } }
      ]

      const [aggResult, count] = await Promise.all([
        coll.aggregate(pipeline).toArray(),
        coll.countDocuments(filter),
      ])
      cars = aggResult
      totalCount = count
    } else {
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
    }

    // Load related telecallings for lead data
    const apptIds = cars.map(c => c.appointmentId).filter(Boolean)
    let relatedLeads: any[] = []
    if (apptIds.length > 0) {
      relatedLeads = await db.collection('telecallings')
        .find(
          { appointmentId: { $in: apptIds } },
          { projection: { appointmentId: 1, appointmentSource: 1, referenceName: 1, allocatedTo: 1 } }
        )
        .toArray()
    }

    const mappedCars = cars.map((car) => {
      const carIdStr = car._id.toString()
      const lead = relatedLeads.find(l => l.appointmentId === car.appointmentId) || {}
      return {
        ...car,
        id: carIdStr,
        _id: carIdStr,
        autoBidsForLiveSection: autoBids.filter(b => String(b.carId) === carIdStr),
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
