// GET /api/self-inspected/:id — get single selfInspectedCar by _id
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const id = getRouterParam(event, 'id')

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

    const doc = await db.collection('selfInspectedCars').findOne(filter)

    if (!doc) {
      throw createError({ statusCode: 404, message: 'Self-inspected car not found' })
    }

    const docId = doc._id?.toString()
    return { ...doc, _id: docId, id: docId }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API:self-inspected] GET detail failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch self-inspected car' })
  }
})
