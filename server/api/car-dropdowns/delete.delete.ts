// DELETE /api/car-dropdowns/delete
// Direct MongoDB remove from carMakeModelVariant collection

import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { _id } = body

    if (!_id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    const result = await collection.deleteOne({ _id: new ObjectId(_id) })

    if (result.deletedCount === 0) {
      throw createError({ statusCode: 404, message: 'Record not found' })
    }

    return { success: true, deletedCount: result.deletedCount }
  }
  catch (err: any) {
    console.error('[car-dropdowns/delete] Error:', err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || 'Failed to delete' })
  }
})
