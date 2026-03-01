import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

async function getDb(event: any) {
    const config = useRuntimeConfig(event)
    const uri = (config.mongodbUri as string) || ''
    if (!uri) throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })

    const envCookie = getCookie(event, 'apiEnvironment') || 'production'
    const dbName = envCookie === 'development'
        ? ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')
        : ((config.productionMongodbDbName as string) || 'otobix_auction_app')

    if (!_client) {
        _client = new MongoClient(uri)
        await _client.connect()
    }
    return _client.db(dbName)
}

// POST /api/car-margins — create a new car margin record
export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        if (!body || body.fixedMargin === undefined) {
            throw createError({ statusCode: 400, message: 'fixedMargin is required' })
        }

        const db = await getDb(event)
        const doc = {
            fixedMargin: Number(body.fixedMargin) || 0,
            variableRanges: body.variableRanges || [],
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        const result = await db.collection('carMargins').insertOne(doc)
        return { success: true, insertedId: result.insertedId, margin: { ...doc, _id: result.insertedId } }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:car-margins] POST failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to create car margin' })
    }
})
