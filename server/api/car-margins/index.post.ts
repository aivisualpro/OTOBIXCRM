// POST /api/car-margins — create a new car margin record
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || body.fixedMargin === undefined) {
      throw createError({ statusCode: 400, message: 'fixedMargin is required' })
    }

    const db = await getLeadsDb(event)
    const doc = {
      fixedMargin: Number(body.fixedMargin) || 0,
      variableRanges: body.variableRanges || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection('carMargins').insertOne(doc)
    return { success: true, insertedId: result.insertedId, margin: { ...doc, _id: result.insertedId } }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:car-margins] POST failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to create car margin' })
  }
})
