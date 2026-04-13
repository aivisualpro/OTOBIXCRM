export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)

    const staffUsers = await db
      .collection('users')
      .find({ isStaff: true })
      .project({
        password: 0,
        __v: 0,
      })
      .toArray()

    console.warn(`[API:staff-users] Found ${staffUsers.length} staff users`)
    return { users: staffUsers }
  }
  catch (err: any) {
    console.error('[API:staff-users] MongoDB query failed:', err.message)
    throw createError({
      statusCode: 500,
      message: err.message || 'Failed to fetch staff users from database',
    })
  }
})
