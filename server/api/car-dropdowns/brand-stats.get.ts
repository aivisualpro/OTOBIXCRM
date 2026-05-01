// GET /api/car-dropdowns/brand-stats
// Aggregated brand statistics computed server-side.
// Returns total count, per-brand count, total makes, total models, active count.
// Single MongoDB aggregation pipeline — O(n) scan, zero client-side processing.

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const collection = db.collection('carMakeModelVariant')

    const [brandCounts, globalStats] = await Promise.all([
      // Per-brand counts sorted descending
      collection.aggregate([
        { $group: { _id: '$make', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, make: '$_id', count: 1 } },
      ]).toArray(),

      // Global metrics in one pass
      collection.aggregate([
        {
          $group: {
            _id: null,
            totalVariants: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] },
            },
            makes: { $addToSet: '$make' },
            models: { $addToSet: { $concat: ['$make', '-', '$model'] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalVariants: 1,
            activeCount: 1,
            totalMakes: { $size: '$makes' },
            totalModels: { $size: '$models' },
          },
        },
      ]).toArray(),
    ])

    const stats = globalStats[0] || { totalVariants: 0, activeCount: 0, totalMakes: 0, totalModels: 0 }

    return {
      brands: brandCounts,
      ...stats,
    }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
