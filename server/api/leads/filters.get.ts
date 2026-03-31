// GET /api/leads/filters
// Returns dynamically populated distinct value lists for tracking strict frontend dropdowns cleanly bypassing raw raw user collections.
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const col = db.collection('telecallings')

    const [emails, addedBys, cities] = await Promise.all([
      col.distinct('emailAddress', { emailAddress: { $nin: [null, ''] } }),
      col.distinct('addedBy', { addedBy: { $nin: [null, ''] } }),
      col.distinct('city', { city: { $nin: [null, ''] } }),
    ])

    // Optional: Fetch matching full names from users collection strictly for the active distinct emails
    const userCol = db.collection('users')
    const activeUsers = await userCol.find(
      { email: { $in: emails } },
      { projection: { email: 1, userName: 1, fullName: 1 } },
    ).toArray()

    const usersMap: Record<string, string> = {}
    for (const u of activeUsers) {
      usersMap[u.email] = u.fullName || u.userName || u.email
    }

    return {
      success: true,
      emails: emails.map((email: string) => ({
        email,
        name: usersMap[email] || email,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
      addedBys: addedBys.sort(),
      cities: cities.sort((a, b) => a.localeCompare(b)),
    }
  }
  catch (err: any) {
    console.error('[API:leads:filters] Failed:', err.message)
    return { success: false, emails: [], addedBys: [], cities: [] }
  }
})
