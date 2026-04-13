import { ObjectId } from 'mongodb'

// PUT /api/car-margins — update a car margin record
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getLeadsDb(event)
    const id = body._id
    const update: Record<string, any> = { updatedAt: new Date() }

    if (body.fixedMargin !== undefined)
      update.fixedMargin = Number(body.fixedMargin)
    if (body.variableRanges !== undefined)
      update.variableRanges = body.variableRanges

    const result = await db.collection('carMargins').updateOne(
      { _id: new ObjectId(id) },
      { $set: update },
    )

    return { success: result.modifiedCount > 0, matchedCount: result.matchedCount }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:car-margins] PUT failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update car margin' })
  }
})
