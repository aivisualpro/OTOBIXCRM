/**
 * GET /api/leads/delta
 *
 * Delta Sync endpoint for leads/telecallings.
 * Returns ONLY records modified after the given timestamp.
 *
 * Returns: { leads: [...], ts: number }
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const since = Number(query.since) || 0

  try {
    const db = await getLeadsDb(event)

    const filter: any = {}
    if (since > 0) {
      filter.updatedAt = { $gt: new Date(since).toISOString() }
    }

    const leads = await db.collection('telecallings')
      .aggregate([
        { $match: filter },
        { $sort: { updatedAt: -1 } },
        { $limit: since > 0 ? 200 : 99999999 }
      ], { allowDiskUse: true })
      .toArray()

    const normalized = leads.map((lead: any) => ({
      ...lead,
      _id: lead._id.toString(),
      id: lead._id.toString(),
    }))

    const latestTs = normalized.length > 0
      ? Math.max(...normalized.map((l: any) => new Date(l.updatedAt || 0).getTime()))
      : since

    return { leads: normalized, ts: latestTs }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
