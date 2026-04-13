import { ObjectId } from 'mongodb'

// DELETE /api/notifications — dismiss (delete) a notification by _id
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getLeadsDb(event)

    let filter: any
    try {
      filter = { _id: new ObjectId(body._id) }
    }
    catch {
      filter = { _id: body._id }
    }

    const result = await db.collection('userNotifications').deleteOne(filter)

    if (result.deletedCount === 0) {
      throw createError({ statusCode: 404, message: 'Notification not found' })
    }

    return {
      success: true,
      message: 'Notification dismissed',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:notifications] DELETE failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete notification' })
  }
})
