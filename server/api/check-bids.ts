import { MongoClient } from 'mongodb'

export default defineEventHandler(async () => {
  const uri = process.env.NUXT_MONGODB_URI
  if (!uri) return { error: "No Mongo URI" }
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('otobix_auction_app')
    const sample = await db.collection('bids').findOne({})
    return sample
  } finally {
    await client.close()
  }
})
