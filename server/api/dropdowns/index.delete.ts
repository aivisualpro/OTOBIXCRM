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

// DELETE /api/dropdowns — delete a dropdown by _id
export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)

        if (!body?._id) {
            throw createError({ statusCode: 400, message: '_id is required' })
        }

        const db = await getDb(event)

        let filter: any
        try {
            filter = { _id: new ObjectId(body._id) }
        }
        catch {
            filter = { _id: body._id }
        }

        const result = await db.collection('dropdowns').deleteOne(filter)

        if (result.deletedCount === 0) {
            throw createError({ statusCode: 404, message: 'Dropdown not found' })
        }

        return {
            success: true,
            message: 'Dropdown deleted successfully',
        }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:dropdowns] DELETE failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to delete dropdown' })
    }
})
