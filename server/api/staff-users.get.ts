import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // NUXT_MONGODB_URI  → config.mongodbUri
  // NODE_ENV is injected by Nuxt at build/runtime automatically
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    console.error('[API:staff-users] mongodbUri is not configured. Check NUXT_MONGODB_URI in .env')
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  // Pick DB name: use productionMongodbDbName when the production URL is set,
  // otherwise fall back to developmentMongodbDbName
  const prodUrl = (config.public.apiBaseUrlProduction as string) || ''
  const isProd = prodUrl.length > 0 && !prodUrl.includes('development')
  const dbName = isProd
    ? ((config.productionMongodbDbName as string) || 'otobix_auction_app')
    : ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
      console.warn(`[API:staff-users] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)

    const staffUsers = await db
      .collection('users')
      .find({ isStaff: true })
      .project({
        password: 0,
        __v: 0,
      })
      .toArray()

    console.warn(`[API:staff-users] Found ${staffUsers.length} staff users in "${dbName}"`)
    return { users: staffUsers }
  }
  catch (err: any) {
    // If the connection dropped, reset so the next request reconnects
    _client = null
    console.error('[API:staff-users] MongoDB query failed:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch staff users from database',
    })
  }
})
