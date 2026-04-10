// GET /api/leads/total — blazing fast O(1) estimation for massive collections
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const col = db.collection('telecallings')
    const count = await col.estimatedDocumentCount()
    
    return {
      total: count
    }
  } catch (err: any) {
    console.error('[API:leads] GET total failed:', err.message)
    return { total: 0 }
  }
})
