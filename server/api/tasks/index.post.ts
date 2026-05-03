/**
 * POST /api/tasks — Create a new task in otobixCRMTasks collection
 *
 * Body: {
 *   title, description, priority, dueDate, status,
 *   assignees: [{ email, name, role }],
 *   carId, appointmentId, carImage, carInfo: { make, model, year, city },
 *   createdBy, labels
 * }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.title?.trim()) {
    throw createError({ statusCode: 400, message: 'Task title is required' })
  }

  try {
    const db = await getLeadsDb(event)

    const task = {
      title: body.title.trim(),
      description: body.description?.trim() || '',
      priority: body.priority || 'medium',
      status: body.status || 'todo',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assignees: body.assignees || [],
      carId: body.carId || null,
      appointmentId: body.appointmentId || null,
      carImage: body.carImage || null,
      carInfo: body.carInfo || null,
      createdBy: body.createdBy || '',
      labels: body.labels || [],
      subtasks: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection('otobixCRMTasks').insertOne(task)

    return {
      success: true,
      task: {
        ...task,
        id: result.insertedId.toString(),
        _id: result.insertedId.toString(),
      },
    }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to create task:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
