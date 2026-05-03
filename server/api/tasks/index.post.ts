/**
 * POST /api/tasks — Create a new task with activity log + notification
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.title?.trim()) {
    throw createError({ statusCode: 400, message: 'Task title is required' })
  }

  try {
    const db = await getLeadsDb(event)
    const now = new Date()

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
      activityLog: [{
        action: 'created',
        status: body.status || 'todo',
        by: body.createdBy || 'System',
        at: now,
        detail: `Task created in "${body.status || 'todo'}"`,
      }],
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection('otobixCRMTasks').insertOne(task)
    const taskId = result.insertedId.toString()

    // Create notifications for all assignees
    const notifications = (body.assignees || []).map((a: any) => ({
      userId: a.email,
      type: 'task',
      title: `New Task Assigned: ${task.title}`,
      body: `You've been assigned to "${task.title}"${task.appointmentId ? ` (${task.appointmentId})` : ''}. Priority: ${task.priority}. ${task.description ? `Description: ${task.description.slice(0, 100)}` : ''}`,
      data: {
        taskId,
        carId: task.carId,
        appointmentId: task.appointmentId,
        action: 'created',
        status: task.status,
      },
      isRead: false,
      createdAt: now,
    }))

    if (notifications.length) {
      await db.collection('userNotifications').insertMany(notifications)
    }

    return {
      success: true,
      task: { ...task, id: taskId, _id: taskId },
    }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to create task:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
