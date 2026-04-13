// GET /api/users — list all users directly from MongoDB

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray()

    // Map `_id` to `id` for frontend consistency, keeping all fields including password
    const mappedUsers = users.map((user) => {
      const u = { ...user, id: user._id.toString(), _id: user._id.toString() }
      return u
    })

    return mappedUsers
  }
  catch (err: any) {
    console.error('[API:users] Failed to fetch users:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch users from database',
    })
  }
})
