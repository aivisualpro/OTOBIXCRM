import { MongoClient, ObjectId } from 'mongodb'

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
    }

    return _client.db(dbName)
}

// PUT /api/notifications — mark notification(s) as read
// Body: { _id: string } — mark single as read
// Body: { markAllRead: true } — mark all as read
export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        const db = await getDb(event)
        const collection = db.collection('userNotifications')

        // Mark all as read
        if (body?.markAllRead) {
            const result = await collection.updateMany(
                { isRead: false },
                { $set: { isRead: true } },
            )
            return {
                success: true,
                modifiedCount: result.modifiedCount,
                message: 'All notifications marked as read',
            }
        }

        // Mark single as read
        if (!body?._id) {
            throw createError({ statusCode: 400, message: '_id or markAllRead is required' })
        }

        let filter: any
        try {
            filter = { _id: new ObjectId(body._id) }
        }
        catch {
            filter = { _id: body._id }
        }

        const result = await collection.updateOne(
            filter,
            { $set: { isRead: true } },
        )

        if (result.matchedCount === 0) {
            throw createError({ statusCode: 404, message: 'Notification not found' })
        }

        return {
            success: true,
            modifiedCount: result.modifiedCount,
            message: 'Notification marked as read',
        }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:notifications] PUT failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to update notification' })
    }
})
