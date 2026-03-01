import { MongoClient, ObjectId } from 'mongodb'

let _client: MongoClient | null = null

async function getDb(event: any) {
  const config = useRuntimeConfig(event)
  const uri = (config.mongodbUri as string) || ''

  if (!uri) {
    throw createError({ statusCode: 500, message: 'MONGODB_URI not configured' })
  }

  const envCookie = getCookie(event, 'apiEnvironment') || 'production'
  const dbName = envCookie === 'development'
    ? ((config.developmentMongodbDbName as string) || 'otobix_auction_app_development')
    : ((config.productionMongodbDbName as string) || 'otobix_auction_app')

  if (!_client) {
    _client = new MongoClient(uri)
    await _client.connect()
  }

  return _client.db(dbName)
}

// PUT /api/workspaces — update a workspace
// Supports: updating fields, toggling menu items
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getDb(event)
    const collection = db.collection('workspaces')

    // ─── Toggle a single menu item ───
    if (body?.action === 'toggleMenu') {
      const { workspaceId, menuId } = body
      if (!workspaceId || !menuId) {
        throw createError({ statusCode: 400, message: 'workspaceId and menuId are required' })
      }

      const ws = await collection.findOne({ workspaceId })
      if (!ws) {
        throw createError({ statusCode: 404, message: 'Workspace not found' })
      }

      const menuIds = ws.menuIds || []
      const idx = menuIds.indexOf(menuId)

      if (idx >= 0) {
        menuIds.splice(idx, 1)
      }
      else {
        menuIds.push(menuId)
      }

      await collection.updateOne(
        { workspaceId },
        { $set: { menuIds, updatedAt: new Date().toISOString() } },
      )

      return { success: true, menuIds, message: `Menu item "${menuId}" toggled` }
    }

    // ─── General workspace update ───
    if (!body?._id && !body?.workspaceId) {
      throw createError({ statusCode: 400, message: '_id or workspaceId is required' })
    }

    let filter: any
    if (body.workspaceId) {
      filter = { workspaceId: body.workspaceId }
    }
    else {
      try {
        filter = { _id: new ObjectId(body._id) }
      }
      catch {
        filter = { _id: body._id }
      }
    }

    const { _id, action, ...updateFields } = body
    delete updateFields.id
    updateFields.updatedAt = new Date().toISOString()

    const result = await collection.updateOne(filter, { $set: updateFields })

    if (result.matchedCount === 0) {
      throw createError({ statusCode: 404, message: 'Workspace not found' })
    }

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: 'Workspace updated successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    _client = null
    console.error('[API:workspaces] PUT failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update workspace' })
  }
})
