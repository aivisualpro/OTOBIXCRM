import { MongoClient, ObjectId } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''
  if (!uri) throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })

  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'
  const body = await readBody(event)
  
  if (!body._id && !body.id) {
    throw createError({ statusCode: 400, message: 'Missing car ID' })
  }

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
    }
    const db = _client.db(dbName)
    const { _id, id, _push, ...updateFields } = body
    const objectId = new ObjectId(_id || id)
    
    const updateQuery: any = { $set: updateFields }
    if (_push) {
      updateQuery.$push = _push
    }
    
    await db.collection('cars').updateOne(
      { _id: objectId },
      updateQuery
    )
    
    return { success: true }
  } catch (err: any) {
    console.error('[API:cars] Failed to update car:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
