import { MongoClient } from 'mongodb'

async function run() {
  const uri = 'mongodb+srv://danish1:Amit_P1974%2A@otobix.hihrzsi.mongodb.net/otobix_auction_app?retryWrites=true&w=majority'
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db('otobix_auction_app')

  const collections = ['cars', 'telecallings']
  const dateFieldsToFix = [
    'auctionStartTime',
    'auctionEndTime',
    'upcomingUntil',
    'liveAt',
    'movedToOtobuyAt',
    'sendToAuctionApk',
    'yearMonthOfManufacture',
    'roadTaxValidity',
    'taxValidTill',
    'registrationDate',
  ]

  for (const collName of collections) {
    console.log(`Processing collection: ${collName}`)
    const coll = db.collection(collName)

    // Find all documents
    const cursor = coll.find({})
    let count = 0

    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      const updates = {}

      for (const field of dateFieldsToFix) {
        if (typeof doc[field] === 'string') {
          if (doc[field] === '') {
            updates[field] = null // convert empty string to null
          }
          else {
            const parsed = new Date(doc[field])
            if (!isNaN(parsed.getTime())) {
              updates[field] = parsed
            }
            else {
              updates[field] = null // invalid date string
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await coll.updateOne({ _id: doc._id }, { $set: updates })
        count++
      }
    }
    console.log(`Fixed ${count} documents in ${collName}`)
  }

  await client.close()
}

run().catch(console.error)
