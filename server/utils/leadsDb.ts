import type { Db } from 'mongodb'
import { MongoClient } from 'mongodb'

const _clients: Record<string, MongoClient> = {}
const _dbPromises: Record<string, Promise<Db>> = {}

/**
 * Shared MongoDB connection for all server API routes.
 * Solves HMR concurrent overlap bugs by mapping strict localized DB connection promises.
 */
export function getLeadsDb(event: any): Promise<Db> {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const envCookie = getCookie(event, 'apiEnvironment') || 'production'
  const dbName = envCookie === 'development'
    ? ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')
    : ((config.productionMongodbDbName as string) || 'otobix_auction_app')

  // If already connecting or connected, hook the same shared Promise to avoid duplicate pool overlapping!
  if (!_dbPromises[dbName]) {
    _dbPromises[dbName] = (async () => {
      const client = new MongoClient(uri, {
        maxPoolSize: 10, // Restrict to keep Vercel/Nitro safe
        minPoolSize: 1,
      })
      await client.connect()
      _clients[dbName] = client
      console.log(`[API:leads] Connected to MongoDB → DB: ${dbName} (${envCookie})`)
      return client.db(dbName)
    })()
  }

  return _dbPromises[dbName]
}

/** Safely ignored. The native MongoClient topology heals itself automatically. Destroying it actively breaks inflight parallel REST requests. */
export function resetLeadsDb() {
  // Ignored
}
