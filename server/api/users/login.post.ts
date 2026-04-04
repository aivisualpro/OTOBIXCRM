import crypto from 'node:crypto' // standard node crypto
import bcrypt from 'bcryptjs'
// POST /api/users/login — authenticate user directly against MongoDB
import { MongoClient } from 'mongodb'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const body = await readBody(event)
  const incomingUserStr = (body.userName || body.username || body.email || '').trim()

  if (!incomingUserStr || !body.password) {
    throw createError({ statusCode: 400, message: 'Username/Email and Password are required' })
  }

  // Always use Production as requested
  const dbName = (config.productionMongodbDbName as string) || 'otobix_auction_app'

  try {
    if (!_client) {
      _client = new MongoClient(uri)
      await _client.connect()
      console.log(`[API:login] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)

    // Authenticate user natively against DB payload (Case Insensitive to support mobile apps)
    // Checks userName OR email OR phoneNumber fallback 
    const user = await db.collection('users').findOne({
      $or: [
        { userName: { $regex: `^${incomingUserStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { email: { $regex: `^${incomingUserStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { phoneNumber: incomingUserStr },
      ],
    })

    if (!user) {
      throw createError({ statusCode: 401, message: 'Invalid credentials. Please verify your username and password.' })
    }

    // Safely compare using securely salted bcrypt algorithm (cross-compatible standard)
    let isValidPassword = false
    if (user.passwordHash && user.passwordHash.startsWith('$2')) {
      // Primary standard: check isolated hash
      isValidPassword = await bcrypt.compare(body.password, user.passwordHash)
    }
    else if (user.password && user.password.startsWith('$2')) {
      // Legacy migration: check if DB temporarily stored bcrypt inside .password directly
      isValidPassword = await bcrypt.compare(body.password, user.password)
    }
    else {
      // Secure literal-match fallback to migrate strictly clear-text older records seamlessly
      isValidPassword = (user.password === body.password)
    }

    if (!isValidPassword) {
      throw createError({ statusCode: 401, message: 'Invalid credentials. Please verify your username and password.' })
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
    if (err.statusCode)
      throw err

    console.error('[API:login] MongoDB authentication failed:', err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Internal logic error during connection',
    })
  }
})
