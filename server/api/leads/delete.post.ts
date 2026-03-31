import { ObjectId } from 'mongodb'
import { syncLeadToAppSheet } from '../../utils/appsheet'

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

    // Sync deletion to AppSheet (uses Appointment ID as key)
    syncLeadToAppSheet('Delete', result, db)

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
