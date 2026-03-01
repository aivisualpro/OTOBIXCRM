import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

async function getDb(event: any) {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const envCookie = getCookie(event, 'apiEnvironment') || 'production'
  const dbName = envCookie === 'development'
    ? ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')
    : ((config.productionMongodbDbName as string) || 'otobix_auction_app')

  if (!_client) {
    _client = new MongoClient(uri)
    await _client.connect()
    console.warn(`[API:notifications] Connected to MongoDB → DB: ${dbName}`)
  }

  return _client.db(dbName)
}

// GET /api/notifications — list notifications (newest first)
export default defineEventHandler(async (event) => {
  try {
    const db = await getDb(event)
    const query = getQuery(event)

    // Optional filters
    const filter: Record<string, any> = {}

    // Filter by type (inspection, auction, system, user)
    if (query.type && query.type !== 'all') {
      filter.type = query.type
    }

    // Filter by read status
    if (query.isRead !== undefined && query.isRead !== '') {
      filter.isRead = query.isRead === 'true'
    }

    // Pagination
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
    const skip = (page - 1) * limit

    const collection = db.collection('userNotifications')

    const [notifications, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ])

    // Also get unread counts per type for tab badges
    const [totalUnread, inspectionUnread, auctionUnread, systemUnread] = await Promise.all([
      collection.countDocuments({ isRead: false }),
      collection.countDocuments({ isRead: false, type: 'inspection' }),
      collection.countDocuments({ isRead: false, type: 'auction' }),
      collection.countDocuments({ isRead: false, type: 'system' }),
    ])

    return {
      notifications,
      total,
      page,
      limit,
      unreadCounts: {
        all: totalUnread,
        inspections: inspectionUnread,
        auctions: auctionUnread,
        system: systemUnread,
      },
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    _client = null
    console.error('[API:notifications] GET failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch notifications' })
  }
})
