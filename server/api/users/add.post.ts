import bcrypt from 'bcryptjs'
// POST /api/users/add — create a new user directly in MongoDB

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.userName || !body?.email || (body?.userRole !== 'Telecaller' && !body?.phoneNumber) || !body?.userRole) {
    throw createError({ statusCode: 400, message: 'userName, email, Role and conditionally Phone are strictly required' })
  }

  try {
    const db = await getLeadsDb(event)
    const now = new Date().toISOString()

    // Check for duplicate email
    const existing = await db.collection('users').findOne({ email: body.email })
    if (existing) {
      throw createError({ statusCode: 409, message: `User with email "${body.email}" already exists` })
    }

    // Check for duplicate phone number (only if provided)
    if (body.phoneNumber) {
      const phoneDup = await db.collection('users').findOne({ phoneNumber: body.phoneNumber })
      if (phoneDup) {
        throw createError({ statusCode: 409, message: `Phone number "${body.phoneNumber}" is already registered to another user` })
      }
    }

    const saltRounds = 10
    const rawPassword = body.password || ''
    const hashedPassword = rawPassword ? await bcrypt.hash(rawPassword, saltRounds) : ''

    // Inspection Engineer is always a staff member
    const isStaff = body.userRole === 'Inspection Engineer' ? true : (body.isStaff ?? false)

    const doc = {
      userName: body.userName || '',
      email: body.email || '',
      phoneNumber: body.phoneNumber || '',
      userRole: body.userRole || 'Customer',
      password: rawPassword,
      passwordHash: hashedPassword,
      location: Array.isArray(body.location) ? body.location.join(', ') : (body.location || ''),
      dealershipName: body.dealershipName || '',
      entityType: body.entityType || '',
      image: body.image || '',
      isStaff,
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

    console.warn(`[API:users/add] Created user "${body.userName}" → _id: ${result.insertedId}`)

    // Broadcast: create → full normalized record (strip sensitive fields)
    const { password: _pw, passwordHash: _ph, ...safeDoc } = doc
    const broadcastDoc = { ...safeDoc, id: result.insertedId.toString(), _id: result.insertedId.toString() }
    broadcastChange('users', 'create', result.insertedId.toString(), undefined, broadcastDoc)

    return {
      success: true,
      message: 'User created successfully',
      data: { _id: result.insertedId, ...doc },
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:users/add] MongoDB insert failed:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to create user',
    })
  }
})
