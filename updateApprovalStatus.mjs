import { MongoClient } from 'mongodb'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8')
const envConfig = envFile.split('\n').reduce((acc, line) => {
  const idx = line.indexOf('=')
  if (idx > -1) {
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    acc[key] = value
  }
  return acc
}, {})

const uri = envConfig.NUXT_MONGODB_URI;
if (!uri) throw new Error('No MongoDB URI found in .env');

const dbs = [
  envConfig.DEVELOPMENT_MONGODB_DB_NAME || 'otobix_auction_app_development',
  envConfig.PRODUCTION_MONGODB_DB_NAME || 'otobix_auction_app'
]

async function updateDb(dbName) {
  const client = new MongoClient(uri)
  try {
    await client.connect()
    console.log(`\nConnected to DB: ${dbName}`)
    const db = client.db(dbName)

    // Using exactly "Approved" as requested
    const result = await db.collection('telecallings').updateMany(
      {},
      { $set: { approvalStatus: "Approved" } }
    )
    console.log(`Matched ${result.matchedCount} documents.`)
    console.log(`Updated ${result.modifiedCount} documents to "Approved".`)
  } catch (err) {
    console.error(`Error updating DB: ${dbName}`, err)
  } finally {
    await client.close()
  }
}

async function main() {
  console.log('Starting bulk update of approvalStatus...')
  for (const dbName of new Set(dbs)) {
    await updateDb(dbName)
  }
  console.log('\nFinished updates.')
}

main().catch(console.error)
