// GET /api/car-margins — list all car margin records
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const margins = await db
      .collection('carMargins')
      .find({})
      .sort({ fixedMargin: 1 })
      .toArray()

    return { margins }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:car-margins] GET failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch car margins' })
  }
})
