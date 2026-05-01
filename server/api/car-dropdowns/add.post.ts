// POST /api/car-dropdowns/add
// Direct MongoDB insert into carMakeModelVariant collection

import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { make, model, variant } = body

    if (!make || !model || !variant) {
      throw createError({ statusCode: 400, message: 'make, model, and variant are required' })
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    const doc = {
      make: make.trim(),
      model: model.trim(),
      variant: variant.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    }

    const result = await collection.insertOne(doc)

    return { success: true, _id: result.insertedId.toString(), ...doc }
  }
  catch (err: any) {
    console.error('[car-dropdowns/add] Error:', err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || 'Failed to add' })
  }
})
