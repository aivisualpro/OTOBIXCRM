export default defineEventHandler(async (event) => {
  const db = await getLeadsDb(event)
  const col = db.collection('telecallings')
  
  const countAgg = await col.aggregate([
    {
      $group: {
        _id: {
          inspectionStatus: { $ifNull: ['$inspectionStatus', 'Pending'] },
        },
        count: { $sum: 1 },
      },
    }
  ]).toArray()
  
  const filterExact = { inspectionStatus: "Scheduled" }
  const countExact = await col.countDocuments(filterExact)
  
  const filterRegex = { inspectionStatus: { $regex: /^\s*Scheduled\s*$/i } }
  const countRegex = await col.countDocuments(filterRegex)
  
  const docs = await col.find(filterRegex).limit(0).toArray()
  
  return {
    totalRecords: await col.countDocuments(),
    countAgg,
    countExact,
    countRegex,
    matchDocs: docs.length,
    sampleDocs: docs.slice(0, 2).map(d => ({ _id: d._id, inspectionStatus: d.inspectionStatus }))
  }
})
