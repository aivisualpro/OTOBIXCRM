// PATCH /api/self-inspected/:id — update fields on a selfInspectedCar by _id or inspectionId
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing id parameter' })
    }

    let filter: Record<string, any> = {}
    try {
      filter = { _id: new ObjectId(id) }
    }
    catch {
      // If it's not a valid ObjectId, try as inspectionId
      filter = { inspectionId: id }
    }

    const result = await db.collection('selfInspectedCars').updateOne(
      filter,
      { $set: { ...body, updatedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Self-inspected car not found' })
    }

    return { success: true, modified: result.modifiedCount }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API:self-inspected] PATCH failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update self-inspected car' })
  }
})
