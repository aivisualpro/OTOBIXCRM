/**
 * PUT /api/tasks/:id — Update a task in otobixCRMTasks collection
 */
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing task ID' })

  const body = await readBody(event)

  try {
    const db = await getLeadsDb(event)
    const { _id, id: _, ...updateFields } = body
    updateFields.updatedAt = new Date()

    // Convert dueDate string to Date object if present
    if (updateFields.dueDate && typeof updateFields.dueDate === 'string') {
      updateFields.dueDate = new Date(updateFields.dueDate)
    }

    await db.collection('otobixCRMTasks').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields },
    )

    return { success: true }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to update task:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
