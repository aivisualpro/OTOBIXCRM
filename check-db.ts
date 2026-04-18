import path from 'node:path'
import dotenv from 'dotenv'
import { MongoClient } from 'mongodb'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

async function check() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
  if (!uri) {
    console.error('No db uri')
    return
  }
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db()
    const doc = await db.collection('cars').findOne({ appointmentId: '26-101295' })
    console.log('retailAssociate:', doc?.retailAssociate)
    console.log('Keys starting with r:', Object.keys(doc || {}).filter(k => k.startsWith('r')))
  }
  finally {
    await client.close()
  }
}

check()
