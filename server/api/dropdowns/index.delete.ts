import { ObjectId } from 'mongodb'

// DELETE /api/dropdowns — delete a dropdown by _id
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?._id) {
      throw createError({ statusCode: 400, message: '_id is required' })
    }

    const db = await getLeadsDb(event)

    let filter: any
    try {
      filter = { _id: new ObjectId(body._id) }
    }
    catch {
      filter = { _id: body._id }
    }

    const result = await db.collection('dropdowns').deleteOne(filter)

    if (result.deletedCount === 0) {
      throw createError({ statusCode: 404, message: 'Dropdown not found' })
    }

    return {
      success: true,
      message: 'Dropdown deleted successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:dropdowns] DELETE failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete dropdown' })
  }
})
