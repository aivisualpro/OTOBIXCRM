export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    // Projection: only include fields used by Sales/Retail table views.
    // This avoids pulling large embedded image arrays & inspection data on every load.
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
      soldAt: 1,
      soldTo: 1,
      soldToName: 1,
      dealStatus: 1,
      remarks: 1,
      followupTimeStamp: 1,
      retailChangeLog: 1,
      retailQuality: 1,
      saleReason: 1,
      tentativeHandoverDate: 1,
      // Only the first/thumbnail image fields — not full arrays
      imageUrl: 1,
      frontMain: 1,
      frontMainImages: { $slice: 1 },
      createdAt: 1,
      updatedAt: 1,
    }

    // Fetch all cars descending from newest leveraging the native _id index to bypass sort memory limits entirely O(1)
    const tId = Math.random().toString(36).substring(7)
    console.time(`[API:cars:${tId}] find() execution`)
    const cars = await db.collection('cars').find({}, { projection }).sort({ _id: -1 }).limit(3000).toArray()
    console.timeEnd(`[API:cars:${tId}] find() execution`)

    // NEW: Fetch all auto-bids to satisfy Sales/Retail auto-bid requirements
    console.time(`[API:cars:${tId}] autoBids fetch execution`)
    const autoBids = await db.collection('autoBidsForLiveSection').find({}).toArray()
    console.timeEnd(`[API:cars:${tId}] autoBids fetch execution`)

    console.time(`[API:cars:${tId}] mappedCars mapping execution`)

    const mappedCars = cars.map((car) => {
      const carIdStr = car._id.toString()
      return {
        ...car,
        id: carIdStr,
        _id: carIdStr,
        // Filter auto-bids matching this specific car
        autoBidsForLiveSection: autoBids.filter(b => String(b.carId) === carIdStr),
      }
    })
    console.timeEnd(`[API:cars:${tId}] mappedCars mapping execution`)

    return mappedCars
  }
  catch (err: any) {
    console.error('[API:cars] Failed to fetch cars:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch cars from database',
    })
  }
})
