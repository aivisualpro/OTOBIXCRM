import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

async function getClient(uri: string): Promise<MongoClient> {
  if (_client) {
    try {
      // Ping to verify the connection is still alive (1s timeout)
      await _client.db('admin').command({ ping: 1 })
      return _client
    }
    catch {
      // Connection is stale/dead — tear it down
      try { await _client.close() }
      catch {}
      _client = null
    }
  }

  _client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  })
  await _client.connect()
  return _client
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'

  try {
    const client = await getClient(uri)
    const db = client.db(dbName)
    // Projection: only include fields used by Sales/Retail table views.
    // This avoids pulling large embedded image arrays & inspection data on every load.
    const projection = {
      _id: 1,
      appointmentId: 1,
      make: 1,
      model: 1,
      variant: 1,
      fuelType: 1,
      ownerSerialNumber: 1,
      registrationNumber: 1,
      registrationDate: 1,
      registeredRto: 1,
      registrationState: 1,
      roadTaxValidity: 1,
      taxValidTill: 1,
      inspectionLocation: 1,
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

    // Fetch all cars descending from newest, with slim projection
    const cars = await db.collection('cars').find({}, { projection }).sort({ createdAt: -1 }).toArray()

    const mappedCars = cars.map(car => ({
      ...car,
      id: car._id.toString(),
      _id: car._id.toString(),
    }))

    return mappedCars
  }
  catch (err: any) {
    _client = null
    console.error('[API:cars] Failed to fetch cars:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch cars from database',
    })
  }
})
