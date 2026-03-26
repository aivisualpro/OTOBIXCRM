export default defineEventHandler(async (event) => {
  const db = await getLeadsDb(event)
  const docs = await db.collection('telecallings').find({ inspectionStatus: { $regex: /Re-Scheduled/i } }).toArray()
  return docs
})
