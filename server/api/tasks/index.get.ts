/**
 * GET /api/tasks — Fetch tasks with role-based visibility
 *
 * Admin: sees all tasks
 * Others: sees tasks where user is in assignees OR is createdBy
 *
 * Query params: ?email=xxx&role=xxx
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const email = String(query.email || '').toLowerCase()
  const role = String(query.role || '').toLowerCase()

  try {
    const db = await getLeadsDb(event)

    let filter: any = {}

    // Admin sees everything
    if (role !== 'admin' && email) {
      filter = {
        $or: [
          { createdBy: email },
          { 'assignees.email': email },
        ],
      }
    }

    const tasks = await db
      .collection('otobixCRMTasks')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()

    return {
      tasks: tasks.map((t: any) => ({
        ...t,
        id: t._id?.toString(),
        _id: t._id?.toString(),
      })),
    }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to fetch tasks:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
