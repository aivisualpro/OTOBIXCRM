// GET /api/dropdowns — list all dropdowns
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const dropdowns = await db
      .collection('dropdowns')
      .find({})
      .sort({ dropdownName: 1 })
      .toArray()

    return { dropdowns }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:dropdowns] GET failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to fetch dropdowns' })
  }
})
