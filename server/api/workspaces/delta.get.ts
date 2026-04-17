/**
 * GET /api/workspaces/delta?since=<epoch_ms>
 * Delta Sync for Workspaces — returns only records modified after timestamp.
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

    const workspaces = await db.collection('workspaces')
      .aggregate([
        { $match: filter },
        { $sort: { updatedAt: -1 } },
        { $limit: since > 0 ? 100 : 99999999 },
      ], { allowDiskUse: true })
      .toArray()

    const normalized = workspaces.map((w: any) => ({
      ...w,
      _id: w._id.toString(),
      id: w._id.toString(),
    }))

    const latestTs = normalized.length > 0
      ? Math.max(...normalized.map((w: any) => new Date(w.updatedAt || 0).getTime()))
      : since

    return { workspaces: normalized, ts: latestTs }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
