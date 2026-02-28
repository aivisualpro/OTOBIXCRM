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
        console.warn(`[API:dropdowns] Connected to MongoDB → DB: ${dbName}`)
    }

    return _client.db(dbName)
}

// GET /api/dropdowns — list all dropdowns
export default defineEventHandler(async (event) => {
    try {
        const db = await getDb(event)
        const dropdowns = await db
            .collection('dropdowns')
            .find({})
            .sort({ dropdownName: 1 })
            .toArray()

        return { dropdowns }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:dropdowns] GET failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to fetch dropdowns' })
    }
})
