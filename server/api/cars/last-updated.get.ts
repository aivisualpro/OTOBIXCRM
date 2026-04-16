/**
 * GET /api/cars/last-updated
 *
 * Lightweight endpoint that returns only the latest `updatedAt` timestamp
 * from the cars collection. Used by the Quick Sync polling engine to detect
 * changes without fetching the full dataset.
 *
 * Returns: { ts: number } — epoch milliseconds of most recent car update
 */
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)

    const latest = await db.collection('cars')
      .aggregate([
        { $sort: { updatedAt: -1 } },
        { $limit: 1 },
        { $project: { updatedAt: 1, _id: 0 } }
      ], { allowDiskUse: true })
      .toArray()

    const ts = latest[0]?.updatedAt
      ? new Date(latest[0].updatedAt).getTime()
      : 0

    return { ts }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
