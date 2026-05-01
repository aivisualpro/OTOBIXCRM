// GET /api/car-dropdowns/variants-by-make-model
// Returns all unique variants for a given make + model.

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const make = String(query.make || '').trim()
    const model = String(query.model || '').trim()

    if (!make || !model) {
      throw createError({ statusCode: 400, message: 'make and model query parameters are required' })
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    const variants = await collection.distinct('variant', { make, model })

    return { success: true, variants: (variants as string[]).sort() }
  }
  catch (err: any) {
    console.error('[car-dropdowns/variants-by-make-model] Error:', err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || 'Failed to fetch variants' })
  }
})
