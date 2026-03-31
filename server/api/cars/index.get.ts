import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
    }

    const db = _client.db(dbName)
    // Fetch all cars descending from newest
    const cars = await db.collection('cars').find({}).sort({ createdAt: -1 }).toArray()

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
