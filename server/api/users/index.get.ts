// GET /api/users — list all users directly from MongoDB
import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  // Always Production as requested
  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
      console.info(`[API:users] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)
    const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray()

    // Map `_id` to `id` for frontend consistency, keeping all fields including password
    const mappedUsers = users.map((user) => {
      const u = { ...user, id: user._id.toString(), _id: user._id.toString() }
      return u
    })

    return mappedUsers
  }
  catch (err: any) {
    _client = null
    console.error('[API:users] Failed to fetch users:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch users from database',
    })
  }
})
