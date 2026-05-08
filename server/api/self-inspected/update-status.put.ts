// PUT /api/self-inspected/update-status — update fields on a selfInspectedCar
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const body = await readBody(event)
    const { id, ...updates } = body

    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing id' })
    }

    const col = db.collection('selfInspectedCars')

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Record not found' })
    }

    return { success: true, modified: result.modifiedCount }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API:self-inspected] PUT update failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update' })
  }
})
