import { MongoClient, ObjectId } from 'mongodb'

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

// PUT /api/car-margins — update a car margin record
export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        if (!body?._id) {
            throw createError({ statusCode: 400, message: '_id is required' })
        }

        const db = await getDb(event)
        const id = body._id
        const update: Record<string, any> = { updatedAt: new Date() }

        if (body.fixedMargin !== undefined) update.fixedMargin = Number(body.fixedMargin)
        if (body.variableRanges !== undefined) update.variableRanges = body.variableRanges

        const result = await db.collection('carMargins').updateOne(
            { _id: new ObjectId(id) },
            { $set: update },
        )

        return { success: result.modifiedCount > 0, matchedCount: result.matchedCount }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:car-margins] PUT failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to update car margin' })
    }
})
