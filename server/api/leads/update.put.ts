import { ObjectId } from 'mongodb'
import { syncLeadToAppSheet } from '../../utils/appsheet'

// PUT /api/leads/update — update a telecalling record
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const { telecallingId, ...updates } = body

    if (!telecallingId) {
      throw createError({ statusCode: 400, message: 'telecallingId is required' })
    }

    delete updates._id
    delete updates.id

    updates.updatedAt = new Date().toISOString()

    const filter = ObjectId.isValid(telecallingId)
      ? { _id: new ObjectId(telecallingId) }
      : { appointmentId: telecallingId }

    const result = await db.collection('telecallings').findOneAndUpdate(
      filter,
      { $set: updates },
      { returnDocument: 'after' }
    )

    if (!result) {
      throw createError({ statusCode: 404, message: 'Lead not found' })
    }

    // Sync to AppSheet in background (uses Appointment ID as key)
    syncLeadToAppSheet('Edit', result)

    return {
      success: true,
      message: 'Lead updated successfully',
      modifiedCount: 1,
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    resetLeadsDb()
    console.error('[API:leads] PUT update failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update lead' })
  }
})
