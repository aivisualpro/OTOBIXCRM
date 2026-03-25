import { MongoClient, type Db } from 'mongodb'

let _client: MongoClient | null = null
let _currentDbName: string | null = null

/**
 * Shared MongoDB connection for all server API routes.
 * Selects production or development database based on the `apiEnvironment` cookie.
 */
export async function getLeadsDb(event: any): Promise<Db> {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const envCookie = getCookie(event, 'apiEnvironment') || 'production'
  const dbName = envCookie === 'development'
    ? ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')
    : ((config.productionMongodbDbName as string) || 'otobix_auction_app')

  // Reconnect if client is null or database changed
  if (!_client || _currentDbName !== dbName) {
    if (_client) {
      try { await _client.close() } catch {}
    }
    _client = new MongoClient(uri)
    await _client.connect()
    _currentDbName = dbName
    console.info(`[API:leads] Connected to MongoDB → DB: ${dbName} (${envCookie})`)
  }

  return _client.db(dbName)
}

/** Reset connection (call on error to force reconnect) */
export function resetLeadsDb() {
  _client = null
  _currentDbName = null
}
