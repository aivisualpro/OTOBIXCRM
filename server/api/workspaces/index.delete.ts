import { MongoClient } from 'mongodb'

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

// DELETE /api/workspaces — delete a workspace by workspaceId
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?.workspaceId) {
      throw createError({ statusCode: 400, message: 'workspaceId is required' })
    }

    // Protected workspaces can't be deleted
    if (body.workspaceId === 'admin') {
      throw createError({ statusCode: 403, message: 'Cannot delete the Admin workspace' })
    }

    const db = await getDb(event)
    const collection = db.collection('workspaces')

    const ws = await collection.findOne({ workspaceId: body.workspaceId })
    if (!ws) {
      throw createError({ statusCode: 404, message: 'Workspace not found' })
    }

    if (ws.isProtected) {
      throw createError({ statusCode: 403, message: 'Cannot delete a protected workspace' })
    }

    await collection.deleteOne({ workspaceId: body.workspaceId })

    return {
      success: true,
      message: 'Workspace deleted successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    _client = null
    console.error('[API:workspaces] DELETE failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete workspace' })
  }
})
