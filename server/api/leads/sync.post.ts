import { syncLeadToAppSheet } from '../../utils/appsheet'

// POST /api/leads/sync — force sync a lead to AppSheet
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const { appointmentId } = body
    if (!appointmentId) {
      throw createError({ statusCode: 400, message: 'appointmentId is required' })
    }

    const doc = await db.collection('telecallings').findOne({ appointmentId })
    if (!doc) {
      throw createError({ statusCode: 404, message: 'Lead not found' })
    }

    // Force sync as an "Edit" (upserts in AppSheet safely assuming key exists or acts as add)
    syncLeadToAppSheet('Edit', doc, db)

    return {
      success: true,
      message: 'Sync triggered successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    resetLeadsDb()
    console.error('[API:leads/sync] POST sync failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to trigger sync' })
  }
})
