import { ObjectId } from 'mongodb'

// POST /api/leads/delete — delete a telecalling record
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const { telecallingId } = body

    if (!telecallingId) {
      throw createError({ statusCode: 400, message: 'telecallingId is required' })
    }

    const filter = ObjectId.isValid(telecallingId)
      ? { _id: new ObjectId(telecallingId) }
      : { appointmentId: telecallingId }

    const result = await db.collection('telecallings').findOneAndDelete(filter)

    if (!result) {
      throw createError({ statusCode: 404, message: 'Lead not found' })
    }

    // Broadcast real-time change to all connected clients
    broadcastChange('leads', 'delete', telecallingId)

    return {
      success: true,
      message: 'Lead deleted successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    resetLeadsDb()
    console.error('[API:leads] DELETE failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete lead' })
  }
})
