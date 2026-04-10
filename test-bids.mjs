import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

async function test() {
  const uri = process.env.NUXT_MONGODB_URI
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('otobix_auction_app')
    const sample = await db.collection('bids').findOne({})
    console.log(JSON.stringify(sample, null, 2))
  } finally {
    await client.close()
  }
}

test()
