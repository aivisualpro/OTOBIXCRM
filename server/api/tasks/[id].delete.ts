/**
 * DELETE /api/tasks/:id — Remove a task from otobixCRMTasks collection
 */
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing task ID' })

  try {
    const db = await getLeadsDb(event)
    await db.collection('otobixCRMTasks').deleteOne({ _id: new ObjectId(id) })
    return { success: true }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to delete task:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
