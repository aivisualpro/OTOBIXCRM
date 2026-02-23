import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  try {
    if (!_client) {
      const config = useRuntimeConfig(event)

      // Nuxt auto-maps NUXT_MONGODB_URI → config.mongodbUri
      // Also try direct process.env as fallback
      const uri = (config.mongodbUri as string)
        || process.env.NUXT_MONGODB_URI
        || process.env.MONGODB_URI
        || ''

      if (!uri) {
        console.error('[API:staff-users] Available config keys:', Object.keys(config))
        throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
      }

      _client = new MongoClient(uri)
      await _client.connect()
      console.log('[API:staff-users] Connected to MongoDB successfully')
    }

    const db = _client.db('otobix_auction_app')

    const staffUsers = await db
      .collection('users')
      .find({ isStaff: true })
      .project({
        password: 0,
        __v: 0,
      })
      .toArray()

    console.log(`[API:staff-users] Found ${staffUsers.length} staff users`)
    return { users: staffUsers }
  }
  catch (err: any) {
    console.error('[API:staff-users] MongoDB query failed:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch staff users from database',
    })
  }
})
