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

  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'

  // If already connecting or connected, hook the same shared Promise to avoid duplicate pool overlapping!
  if (!_dbPromises[dbName]) {
    _dbPromises[dbName] = (async () => {
      const client = new MongoClient(uri, {
        maxPoolSize: 20, // Free up parallel loads now that Appsheet webhook polling is deleted!
        minPoolSize: 0,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      })
      await client.connect()
      _clients[dbName] = client
      console.info(`[API:leads] Connected to MongoDB → DB: ${dbName}`)
      return client.db(dbName)
    })()
  }

  return _dbPromises[dbName]
}

/** Safely ignored. The native MongoClient topology heals itself automatically. Destroying it actively breaks inflight parallel REST requests. */
export function resetLeadsDb() {
  // Ignored
}
