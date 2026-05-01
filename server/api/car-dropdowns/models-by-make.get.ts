// GET /api/car-dropdowns/models-by-make
// Returns all unique models for a given make from the carMakeModelVariant collection.

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const make = String(query.make || '').trim()

    if (!make) {
      throw createError({ statusCode: 400, message: 'make query parameter is required' })
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    const models = await collection.distinct('model', { make })

    return { success: true, models: (models as string[]).sort() }
  }
  catch (err: any) {
    console.error('[car-dropdowns/models-by-make] Error:', err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || 'Failed to fetch models' })
  }
})
