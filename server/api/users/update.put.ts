import { MongoClient, ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const body = await readBody(event)

  if (!body?.userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  // Determine which DB to use based on the environment cookie
  const envCookie = getCookie(event, 'apiEnvironment') || 'production'
  const dbName = envCookie === 'development'
    ? ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')
    : ((config.productionMongodbDbName as string) || 'otobix_auction_app')

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
      console.info(`[API:users/update] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)

    // Extract userId and build update fields
    const { userId, ...updateFields } = body

    // Remove metadata fields that shouldn't be overridden
    delete updateFields._id
    delete updateFields.id
    delete updateFields.__v

    // Only update password if explicitly provided with actual content
    if (!updateFields.password || String(updateFields.password).trim() === '') {
      delete updateFields.password
      delete updateFields.passwordHash
    }
    else {
      // Secure the new active password standardizing 10 bcrypt salt rounds natively alongside the plain-text retention
      const rawPassword = String(updateFields.password)
      updateFields.password = rawPassword
      updateFields.passwordHash = await bcrypt.hash(rawPassword, 10)
    }

    // Add updatedAt timestamp
    updateFields.updatedAt = new Date().toISOString()

    // Try matching by ObjectId first, then fall back to string match
    let filter: any
    try {
      filter = { _id: new ObjectId(userId) }
    }
    catch {
      filter = { _id: userId }
    }

    const result = await db
      .collection('users')
      .updateOne(filter, { $set: updateFields })

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: `User not found with id: ${userId}` })
    }

    console.info(`[API:users/update] Updated user ${userId} in "${dbName}" — modified: ${result.modifiedCount}`)

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: 'User updated successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err // re-throw createError
    _client = null
    console.error('[API:users/update] MongoDB update failed:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to update user in database',
    })
  }
})
