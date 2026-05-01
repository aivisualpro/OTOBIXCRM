// POST /api/car-dropdowns/ensure-indexes
// One-time index creation for the carMakeModelVariant collection.
// Call once on deployment to ensure search/sort performance.

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    await Promise.all([
      // Compound index for sorted listing + search
      collection.createIndex({ make: 1, model: 1, variant: 1 }),
      // Text index for search across all fields
      collection.createIndex(
        { make: 'text', model: 'text', variant: 'text' },
        { name: 'search_text_index' },
      ),
      // Partial index for active-only queries
      collection.createIndex(
        { isActive: 1 },
        { name: 'active_status_index', sparse: true },
      ),
    ])

    return { success: true, message: 'Indexes ensured on carMakeModelVariant' }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
