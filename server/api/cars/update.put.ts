import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body._id && !body.id) {
    throw createError({ statusCode: 400, message: 'Missing car ID' })
  }

  try {
    const db = await getLeadsDb(event)
    const { _id, id, _push, ...updateFields } = body
    const objectId = new ObjectId(_id || id)

    const updateQuery: any = { $set: updateFields }
    if (_push) {
      updateQuery.$push = _push
    }

    await db.collection('cars').updateOne(
      { _id: objectId },
      updateQuery,
    )

    // Trigger SSE Live Sync for all connected browsers
    broadcastChange('cars', 'update', objectId.toString())

    return { success: true }
  }
  catch (err: any) {
    console.error('[API:cars] Failed to update car:', err.message)
    throw createError({ statusCode: 500, message: err.message })
  }
})
