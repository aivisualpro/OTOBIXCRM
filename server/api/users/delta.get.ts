/**
 * GET /api/users/delta?since=<epoch_ms>
 * Delta Sync for People/Users — returns only records modified after timestamp.
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

    const users = await db.collection('users')
      .aggregate([
        { $match: filter },
        { $sort: { updatedAt: -1 } },
        { $limit: since > 0 ? 200 : 99999999 },
      ], { allowDiskUse: true })
      .toArray()

    const normalized = users.map((u: any) => ({
      ...u,
      _id: u._id.toString(),
      id: u._id.toString(),
    }))

    const latestTs = normalized.length > 0
      ? Math.max(...normalized.map((u: any) => new Date(u.updatedAt || 0).getTime()))
      : since

    return { users: normalized, ts: latestTs }
  }
  catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
