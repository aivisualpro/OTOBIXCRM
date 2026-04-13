import { ObjectId } from 'mongodb'

// PUT /api/notifications — mark notification(s) as read
// Body: { _id: string } — mark single as read
// Body: { markAllRead: true } — mark all as read
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)
    const collection = db.collection('userNotifications')

    // Mark all as read
    if (body?.markAllRead) {
      const result = await collection.updateMany(
        { isRead: false },
        { $set: { isRead: true } },
      )
      return {
        success: true,
        modifiedCount: result.modifiedCount,
        message: 'All notifications marked as read',
      }
    }

    // Mark single as read
    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id or markAllRead is required' })
    }

    let filter: any
    try {
      filter = { _id: new ObjectId(body._id) }
    }
    catch {
      filter = { _id: body._id }
    }

    const result = await collection.updateOne(
      filter,
      { $set: { isRead: true } },
    )

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Notification not found' })
    }

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: 'Notification marked as read',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:notifications] PUT failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update notification' })
  }
})
