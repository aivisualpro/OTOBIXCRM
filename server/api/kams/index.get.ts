// GET /api/kams — list KAMs from the local kams collection
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const col = db.collection('kams')

    const data = await col.find({}).sort({ name: 1 }).toArray()

    const items = data.map((doc: any) => {
      const id = doc._id?.toString()
      return {
        ...doc,
        _id: id,
        id,
        name: doc.userName || doc.name || doc.fullName || '',
      }
    })

    return { kams: items }
  }
  catch (err: any) {
    console.error('[API:kams] GET list failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch KAMs' })
  }
})
