/**
 * PUT /api/tasks/:id — Update task with activity logging + notifications
 *
 * When status changes, logs the transition and notifies relevant users.
 */
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing task ID' })

  const body = await readBody(event)

  try {
    const db = await getLeadsDb(event)
    const now = new Date()

    // Fetch current task to detect status change
    const existing = await db.collection('otobixCRMTasks').findOne({ _id: new ObjectId(id) })
    if (!existing) {
      throw createError({ statusCode: 404, message: 'Task not found' })
    }

    const { _id, id: _, activityLog: _logIgnored, ...updateFields } = body
    updateFields.updatedAt = now

    // Convert dueDate string to Date object if present
    if (updateFields.dueDate && typeof updateFields.dueDate === 'string') {
      updateFields.dueDate = new Date(updateFields.dueDate)
    }

    // Detect status change for logging
    const statusChanged = body.status && body.status !== existing.status
    const changedBy = body.changedBy || existing.createdBy || 'System'

    const updateQuery: any = { $set: updateFields }

    if (statusChanged) {
      const STATUS_LABELS: Record<string, string> = {
        'todo': 'To Do',
        'in-progress': 'In Progress',
        'in-review': 'In Review',
        'done': 'Done',
      }
      const logEntry = {
        action: 'status_change',
        fromStatus: existing.status,
        toStatus: body.status,
        by: changedBy,
        at: now,
        detail: `Moved from "${STATUS_LABELS[existing.status] || existing.status}" to "${STATUS_LABELS[body.status] || body.status}"`,
      }
      updateQuery.$push = { activityLog: logEntry }

      // Create notifications for assignees + creator
      const recipientEmails = new Set<string>()
      if (existing.createdBy) recipientEmails.add(existing.createdBy)
      for (const a of (existing.assignees || [])) {
        if (a.email) recipientEmails.add(a.email)
      }
      // Don't notify the person who made the change
      recipientEmails.delete(changedBy)

      const notifications = Array.from(recipientEmails).map(email => ({
        userId: email,
        type: 'task',
        title: `Task Updated: ${existing.title}`,
        body: `${changedBy} moved "${existing.title}" from ${STATUS_LABELS[existing.status] || existing.status} → ${STATUS_LABELS[body.status] || body.status}`,
        data: {
          taskId: id,
          carId: existing.carId,
          appointmentId: existing.appointmentId,
          action: 'status_change',
          fromStatus: existing.status,
          toStatus: body.status,
        },
        isRead: false,
        createdAt: now,
      }))

      if (notifications.length) {
        await db.collection('userNotifications').insertMany(notifications)
      }
    }

    await db.collection('otobixCRMTasks').updateOne(
      { _id: new ObjectId(id) },
      updateQuery,
    )

    return { success: true }
  }
  catch (err: any) {
    console.error('[API:tasks] Failed to update task:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
