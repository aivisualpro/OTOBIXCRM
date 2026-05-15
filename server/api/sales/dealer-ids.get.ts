// GET /api/sales/dealer-ids — Get unique user IDs from bids collection
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const result = await db.collection('bids').aggregate([
      {
        $group: {
          _id: '$userId',
        },
      },
    ]).toArray()

    const userIds = result
      .map(r => r._id)
      .filter(Boolean)
      .map(id => String(id))

    return { success: true, userIds }
  }
  catch (err: any) {
    console.error('[API:sales/dealer-ids] Failed:', err.message)
    return { success: false, userIds: [], error: err.message }
  }
})
