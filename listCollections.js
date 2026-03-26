const { MongoClient } = require('mongodb')
async function run() {
  const uri = 'mongodb+srv://danish1:Amit_P1974%2A@otobix.hihrzsi.mongodb.net/otobix_auction_app?retryWrites=true&w=majority'
  const client = new MongoClient(uri)
  await client.connect()
  const cols = await client.db('otobix_auction_app').collections()
  console.log(cols.map(c => c.collectionName))
  await client.close()
}
run()
