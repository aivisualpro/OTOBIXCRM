export default defineEventHandler(async (event) => {
  const db = await getLeadsDb(event)
  const cols = await db.listCollections().toArray()
  return cols.map(c => c.name)
})
