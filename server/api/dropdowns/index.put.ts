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

// PUT /api/dropdowns — update an existing dropdown
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getDb(event)

    const { _id, ...updateFields } = body
    delete updateFields.id
    updateFields.updatedAt = new Date().toISOString()

    let filter: any
    try {
      filter = { _id: new ObjectId(_id) }
    }
    catch {
      filter = { _id }
    }

    const result = await db
      .collection('dropdowns')
      .updateOne(filter, { $set: updateFields })

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Dropdown not found' })
    }

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: 'Dropdown updated successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    _client = null
    console.error('[API:dropdowns] PUT failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update dropdown' })
  }
})
