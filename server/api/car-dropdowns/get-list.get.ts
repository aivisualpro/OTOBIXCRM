// GET /api/car-dropdowns/get-list


export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const query = getQuery(event)
    
    // Simplistic fetching of all records for dropdown
    const data = await db.collection('carMakeModelVariant').find({}).toArray()
    
    return { data, totalCount: data.length, total: data.length }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
