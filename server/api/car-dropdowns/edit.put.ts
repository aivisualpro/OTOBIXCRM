// PUT /api/car-dropdowns/edit
// Direct MongoDB update on carMakeModelVariant collection

import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { _id, make, model, variant } = body

    if (!_id || !make || !model || !variant) {
      throw createError({ statusCode: 400, message: '_id, make, model, and variant are required' })
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    const result = await collection.updateOne(
      { _id: new ObjectId(_id) },
      {
        $set: {
          make: make.trim(),
          model: model.trim(),
          variant: variant.trim(),
          updatedAt: new Date().toISOString(),
        },
      },
    )

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Record not found' })
    }

    return { success: true, modifiedCount: result.modifiedCount }
  }
  catch (err: any) {
    console.error('[car-dropdowns/edit] Error:', err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || 'Failed to edit' })
  }
})
