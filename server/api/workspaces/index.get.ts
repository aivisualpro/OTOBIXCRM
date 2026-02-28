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
        console.warn(`[API:workspaces] Connected to MongoDB → DB: ${dbName}`)
    }

    return _client.db(dbName)
}

// Default workspaces — seeded if collection is empty
const DEFAULT_WORKSPACES = [
    {
        workspaceId: 'admin',
        name: 'OTOBIX ADMIN',
        icon: 'i-lucide-shield-check',
        description: 'Full access to all menus and features',
        color: '#6366f1',
        menuIds: [
            'dashboard', 'leads', 'people', 'auctions', 'notifications', 'dropdowns', 'banners',
            'tasks', 'timeline',
            'purchase-requests', 'pickup-requests',
            'customer-payments', 'dealer-payments',
            'expenses', 'tax-management', 'balance-sheet', 'income-statement', 'financial-ratios',
            'sales-reports', 'financial-reports', 'business-health',
            'tickets',
        ],
        isDefault: true,
        isProtected: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        workspaceId: 'inspection',
        name: 'OTOBIX INSPECTION',
        icon: 'i-lucide-scan-search',
        description: 'Inspection team workspace',
        color: '#3b82f6',
        menuIds: ['dashboard', 'leads', 'people', 'notifications', 'dropdowns', 'banners', 'tasks'],
        isDefault: true,
        isProtected: false,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        workspaceId: 'dealers',
        name: 'OTOBIX DEALERS',
        icon: 'i-lucide-handshake',
        description: 'Dealers workspace for auctions and bidding',
        color: '#f59e0b',
        menuIds: ['dashboard', 'auctions', 'people', 'notifications', 'dropdowns', 'banners'],
        isDefault: true,
        isProtected: false,
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
]

// GET /api/workspaces — list all workspaces (sorted by sortOrder)
export default defineEventHandler(async (event) => {
    try {
        const db = await getDb(event)
        const collection = db.collection('workspaces')

        let workspaces = await collection.find({}).sort({ sortOrder: 1 }).toArray()

        // Seed defaults if collection is empty
        if (workspaces.length === 0) {
            await collection.insertMany(DEFAULT_WORKSPACES)
            workspaces = await collection.find({}).sort({ sortOrder: 1 }).toArray()
            console.warn('[API:workspaces] Seeded default workspaces')
        }

        return { workspaces }
    }
    catch (err: any) {
        if (err.statusCode) throw err
        _client = null
        console.error('[API:workspaces] GET failed:', err.message)
        throw createError({ statusCode: 500, message: err.message || 'Failed to fetch workspaces' })
    }
})
