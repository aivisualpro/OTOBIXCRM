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
    let userEmail = ""
    let userRole = ""
    if (rawUserData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(rawUserData))
        userEmail = decoded.email || ""
        userRole = decoded.userRole || decoded.role || ""
      } catch (e) {
        // Fallback or ignore
      }
    }

    // 1. Build Query Filter based on tab
    const filter: any = {}
    
    // Role-based visibility
    if (userRole === 'Retailer' && userEmail) {
      filter.retailAssociate = userEmail
    }

    // Always exclude blank auction statuses and 'inspected' based on legacy table logic
    filter.auctionStatus = { $exists: true, $nin: ["", " ", "inspected"] }

    if (tab === 'ended') {
      filter.auctionStatus = 'liveAuctionEnded'
    } else if (tab === 'customer-activity') {
      filter.auctionStatus = { $in: ['live', 'otobuy'] }
    } else if (tab === 'dealer-activity') {
      filter.auctionStatus = { $in: ['live', 'otobuy', 'upcoming'] }
    } else if (tab === 'followup') {
      filter.dealStatus = 'Under Negotiation'
    } else if (['upcoming', 'live', 'otobuy', 'sold', 'removed'].includes(tab)) {
      filter.auctionStatus = tab
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
        { appointmentId: searchRegex }
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
    }

    const skip = (page - 1) * limit
    const sortParams: any = { [sortField]: sortDir }
    if (sortField !== '_id') sortParams._id = -1 // secondary sort to stabilize

    const coll = db.collection('cars')
    const [cars, totalCount] = await Promise.all([
      coll.find(filter, { projection }).sort(sortParams).skip(skip).limit(limit).toArray(),
      coll.countDocuments(filter)
    ])

    // Load autobids for these specific chunk of cars only
    const carIds = cars.map(c => c._id.toString())
    let autoBids: any[] = []
    if (carIds.length > 0) {
      autoBids = await db.collection('autoBidsForLiveSection')
        .find({ carId: { $in: carIds } }).toArray()
    }

    const mappedCars = cars.map((car) => {
      const carIdStr = car._id.toString()
      return {
        ...car,
        id: carIdStr,
        _id: carIdStr,
        autoBidsForLiveSection: autoBids.filter(b => String(b.carId) === carIdStr),
      }
    })

    return {
      items: mappedCars,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
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
