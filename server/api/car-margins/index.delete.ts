import { ObjectId } from 'mongodb'

// DELETE /api/car-margins — delete a car margin record
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getLeadsDb(event)
    const result = await db.collection('carMargins').deleteOne({ _id: new ObjectId(body._id) })

    return { success: result.deletedCount > 0 }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:car-margins] DELETE failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete car margin' })
  }
})
