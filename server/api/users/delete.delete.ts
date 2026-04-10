// DELETE /api/users/delete — remove a user by ID directly from MongoDB
import { MongoClient, ObjectId } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const body = await readBody(event)
  const userId = body?.userId

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  // Validate it's a valid ObjectId
  if (!ObjectId.isValid(userId)) {
    throw createError({ statusCode: 400, message: `Invalid userId: "${userId}"` })
  }

  const dbName = String(config.productionMongodbDbName || 'otobix_auction_app')

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
      console.info(`[API:users/delete] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) })

    if (result.deletedCount === 0) {
      throw createError({ statusCode: 404, message: `User not found with id "${userId}"` })
    }

    console.warn(`[API:users/delete] Deleted user ${userId} from "${dbName}"`)

    return {
      success: true,
      message: 'User deleted successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    _client = null
    console.error('[API:users/delete] Failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete user' })
  }
})
