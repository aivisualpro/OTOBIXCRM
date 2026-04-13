// POST /api/dropdowns — create a new dropdown
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?.dropdownName) {
      throw createError({ statusCode: 400, message: 'dropdownName is required' })
    }

    const db = await getLeadsDb(event)

    const doc = {
      dropdownName: body.dropdownName,
      dropdownValues: body.dropdownValues || [],
      isActive: body.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const result = await db.collection('dropdowns').insertOne(doc)

    return {
      success: true,
      insertedId: result.insertedId,
      message: 'Dropdown created successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:dropdowns] POST failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to create dropdown' })
  }
})
