/**
 * GET /api/notifications — list notifications with permission-based visibility
 *
 * Admin: sees all notifications
 * Others: sees only their own notifications (by userId)
 *
 * Query: ?type=task|inspection|auction|system&email=xxx&role=xxx
 */
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const query = getQuery(event)
    const email = String(query.email || '').toLowerCase()
    const role = String(query.role || '').toLowerCase()

    const filter: Record<string, any> = {}

    // Permission filter: non-admin only sees their own
    if (role !== 'admin' && email) {
      filter.$or = [
        { userId: email },
        { isGlobal: true },
      ]
    }

    // Filter by type (inspection, auction, system, task)
    if (query.type && query.type !== 'all') {
      filter.type = query.type
    }

    // Filter by read status
    if (query.isRead !== undefined && query.isRead !== '') {
      filter.isRead = query.isRead === 'true'
    }

    // Pagination
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
    const skip = (page - 1) * limit

    const collection = db.collection('userNotifications')

    // Build base filter for counts (same permission, no type filter)
    const baseFilter: Record<string, any> = {}
    if (role !== 'admin' && email) {
      baseFilter.$or = [
        { userId: email },
        { isGlobal: true },
      ]
    }

    const [notifications, total] = await Promise.all([
      collection
        .aggregate([
          { $match: filter },
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray(),
      collection.countDocuments(filter),
    ])

    // Unread counts per type (with same permission filter)
    const [totalUnread, inspectionUnread, auctionUnread, systemUnread, taskUnread] = await Promise.all([
      collection.countDocuments({ ...baseFilter, isRead: false }),
      collection.countDocuments({ ...baseFilter, isRead: false, type: 'inspection' }),
      collection.countDocuments({ ...baseFilter, isRead: false, type: 'auction' }),
      collection.countDocuments({ ...baseFilter, isRead: false, type: 'system' }),
      collection.countDocuments({ ...baseFilter, isRead: false, type: 'task' }),
    ])

    return {
      notifications,
      total,
      page,
      limit,
      unreadCounts: {
        all: totalUnread,
        inspections: inspectionUnread,
        auctions: auctionUnread,
        system: systemUnread,
        tasks: taskUnread,
      },
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API:notifications] GET failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch notifications' })
  }
})
