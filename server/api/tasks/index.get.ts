/**
 * GET /api/tasks — Fetch all tasks from otobixCRMTasks collection
 */
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const tasks = await db
      .collection('otobixCRMTasks')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    return { tasks: tasks.map((t: any) => ({ ...t, id: t._id?.toString(), _id: t._id?.toString() })) }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to fetch tasks:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
