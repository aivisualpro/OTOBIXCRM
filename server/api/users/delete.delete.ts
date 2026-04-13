// DELETE /api/users/delete — remove a user by ID directly from MongoDB
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = body?.userId

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  // Validate it's a valid ObjectId
  if (!ObjectId.isValid(userId)) {
    throw createError({ statusCode: 400, message: `Invalid userId: "${userId}"` })
  }

  try {
    const db = await getLeadsDb(event)
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) })

    if (result.deletedCount === 0) {
      throw createError({ statusCode: 404, message: `User not found with id "${userId}"` })
    }

    console.warn(`[API:users/delete] Deleted user ${userId}`)

    return {
      success: true,
      message: 'User deleted successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:users/delete] Failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete user' })
  }
})
