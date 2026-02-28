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

// POST /api/workspaces — create a new workspace
export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)

        if (!body?.name?.trim()) {
            throw createError({ statusCode: 400, message: 'Workspace name is required' })
        }

        const db = await getDb(event)
        const collection = db.collection('workspaces')

        // Generate workspaceId from name
        const workspaceId = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

        // Check for duplicates
        const existing = await collection.findOne({ workspaceId })
        if (existing) {
            throw createError({ statusCode: 409, message: 'A workspace with this name already exists' })
        }

        // Get next sort order
        const lastWorkspace = await collection.find({}).sort({ sortOrder: -1 }).limit(1).toArray()
        const nextSortOrder = (lastWorkspace[0]?.sortOrder ?? -1) + 1

        const workspace = {
            workspaceId,
            name: body.name.trim().toUpperCase(),
            icon: body.icon || 'i-lucide-briefcase',
            description: body.description || '',
            color: body.color || '#6366f1',
            menuIds: body.menuIds || ['dashboard', 'notifications'],
            isDefault: false,
            isProtected: false,
            sortOrder: nextSortOrder,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        await collection.insertOne(workspace)

        return {
            success: true,
            workspace,
            message: 'Workspace created successfully',
        }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:workspaces] POST failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to create workspace' })
    }
})
