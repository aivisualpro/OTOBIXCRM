// POST /api/users/add — create a new user directly in MongoDB
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

let _client: MongoClient | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const body = await readBody(event)

  if (!body?.userName || !body?.email || !body?.phoneNumber || !body?.userRole) {
    throw createError({ statusCode: 400, message: 'userName, email, phoneNumber, and userRole are required' })
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
      console.info(`[API:users/add] Connected to MongoDB → DB: ${dbName}`)
    }

    const db = _client.db(dbName)
    const now = new Date().toISOString()

    // Check for duplicate email
    const existing = await db.collection('users').findOne({ email: body.email })
    if (existing) {
      throw createError({ statusCode: 409, message: `User with email "${body.email}" already exists` })
    }

    // Use bcrypt standard salting for optimal security and interoperability
    const saltRounds = 10
    const rawPassword = body.password || ''
    const hashedPassword = rawPassword ? await bcrypt.hash(rawPassword, saltRounds) : ''

    const doc = {
      userName: body.userName || '',
      email: body.email || '',
      phoneNumber: body.phoneNumber || '',
      userRole: body.userRole || 'Customer',
      password: rawPassword, // Retain human-readable plain text for explicit UI rendering exactly as requested
      passwordHash: hashedPassword, // Store isolated secure Bcrypt instance dynamically for universally compatible auth routing
      location: Array.isArray(body.location) ? body.location.join(', ') : (body.location || ''),
      dealershipName: body.dealershipName || '',
      entityType: body.entityType || '',
      image: body.image || '',
      isStaff: body.isStaff ?? false,
      primaryContactPerson: body.primaryContactPerson || '',
      primaryContactNumber: body.primaryContactNumber || '',
      secondaryContactPerson: body.secondaryContactPerson || '',
      secondaryContactNumber: body.secondaryContactNumber || '',
      addressList: Array.isArray(body.addressList) ? body.addressList.filter((a: string) => a?.trim()) : [],
      workspaces: Array.isArray(body.workspaces) ? body.workspaces : [],
      approvalStatus: body.approvalStatus || 'Approved',
      rejectionComment: '',
      wishlist: [],
      myBids: [],
      purchasedCars: [],
      assignedKam: body.assignedKam || '',
      permissions: [],
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection('users').insertOne(doc)

    console.info(`[API:users/add] Created user "${body.userName}" in "${dbName}" → _id: ${result.insertedId}`)

    return {
      success: true,
      message: 'User created successfully',
      data: { _id: result.insertedId, ...doc },
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    _client = null
    console.error('[API:users/add] MongoDB insert failed:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to create user',
    })
  }
})
