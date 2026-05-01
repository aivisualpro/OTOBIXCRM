// GET /api/car-dropdowns/get-list
// Industry-standard paginated, filtered, projected MongoDB query.
// Supports: page, limit, search (fuzzy across make/model/variant).
// Uses countDocuments for accurate total and $project to minimize payload.

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const query = getQuery(event)

    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
    const search = (query.search as string || '').trim()

    const collection = db.collection('carMakeModelVariant')

    // Build filter with regex search across make/model/variant
    const filter: Record<string, any> = {}
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { make: { $regex: escapedSearch, $options: 'i' } },
        { model: { $regex: escapedSearch, $options: 'i' } },
        { variant: { $regex: escapedSearch, $options: 'i' } },
      ]
    }

    // Projection: only send what the client needs
    const projection = {
      _id: 1,
      make: 1,
      model: 1,
      variant: 1,
      isActive: 1,
    }

    // Run count + paginated fetch in parallel for speed
    const skip = (page - 1) * limit

    const [data, totalCount] = await Promise.all([
      collection
        .find(filter, { projection })
        .sort({ make: 1, model: 1, variant: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ])

    return { data, total: totalCount, totalCount }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
