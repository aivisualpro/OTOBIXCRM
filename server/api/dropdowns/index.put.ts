import { ObjectId } from 'mongodb'

// PUT /api/dropdowns — update an existing dropdown
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getLeadsDb(event)

    const { _id, ...updateFields } = body
    delete updateFields.id
    updateFields.updatedAt = new Date().toISOString()

    let filter: any
    try {
      filter = { _id: new ObjectId(_id) }
    }
    catch {
      filter = { _id }
    }

    const result = await db
      .collection('dropdowns')
      .updateOne(filter, { $set: updateFields })

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Dropdown not found' })
    }

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: 'Dropdown updated successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:dropdowns] PUT failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update dropdown' })
  }
})
