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
  }

  return _client.db(dbName)
}

// POST /api/dropdowns — create a new dropdown
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?.dropdownName) {
      throw createError({ statusCode: 400, message: 'dropdownName is required' })
    }

    const db = await getDb(event)

    const doc = {
      dropdownName: body.dropdownName,
      dropdownValues: body.dropdownValues || [],
      isActive: body.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const result = await db.collection('dropdowns').insertOne(doc)

    return {
      success: true,
      insertedId: result.insertedId,
      message: 'Dropdown created successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    _client = null
    console.error('[API:dropdowns] POST failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to create dropdown' })
  }
})
