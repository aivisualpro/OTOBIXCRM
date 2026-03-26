// POST /api/users/login — authenticate user directly against MongoDB
import { MongoClient } from 'mongodb'
import crypto from 'node:crypto' // standard node crypto

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const body = await readBody(event)
  if (!body.userName || !body.phoneNumber || !body.password) {
    throw createError({ statusCode: 400, message: 'Username, Phone number, and Password are required' })
  }

  // Always use Production as requested
  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
      console.info(`[API:login] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)

    // Authenticate user natively against DB payload
    const user = await db.collection('users').findOne({
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      password: body.password // Plain text direct matching logic
    })

    if (!user) {
      throw createError({ statusCode: 401, message: 'Invalid credentials. Please verify your username, phone number, and password.' })
    }

    if (user.approvalStatus !== 'Approved') {
      throw createError({ statusCode: 403, message: 'Your account is not approved yet.' })
    }

    // Generate a secure session token
    const token = crypto.randomUUID()

    // Package the user for frontend session mapping
    const safeUser = { ...user, id: user._id.toString() }

    return { token, user: safeUser, message: 'Login successful' }
  }
  catch (err: any) {
    _client = null
    if (err.statusCode) throw err
    
    console.error('[API:login] MongoDB authentication failed:', err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Internal logic error during connection',
    })
  }
})
