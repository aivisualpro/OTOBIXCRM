/**
 * GET /api/cars/sync?since=<epoch_ms>
 *
 * Delta Sync endpoint — returns ONLY car records modified after the
 * given timestamp. This avoids re-fetching all 1700+ records when
 * only 1-2 changed.
 *
 * Returns: { cars: [...], ts: number }
 */
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const since = Number(query.since) || 0

  try {
    const db = await getLeadsDb(event)

    // Build filter: only records updated after 'since'
    const filter: any = {}
    if (since > 0) {
      filter.updatedAt = { $gt: new Date(since) }
    }

    const cars = await db.collection('cars')
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(since > 0 ? 200 : 0) // Cap delta to 200 records
      .toArray()

    // Normalize _id to string
    const normalized = cars.map((car: any) => ({
      ...car,
      _id: car._id.toString(),
      id: car._id.toString(),
    }))

    // Get the latest timestamp
    const latestTs = normalized.length > 0
      ? Math.max(...normalized.map((c: any) => new Date(c.updatedAt || 0).getTime()))
      : since

    return { cars: normalized, ts: latestTs }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
