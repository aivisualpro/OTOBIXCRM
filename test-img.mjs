import { MongoClient } from 'mongodb'
const uri = process.env.NUXT_MONGODB_URI
const client = new MongoClient(uri)
async function run() {
  await client.connect()
  const db = client.db('otobix_auction_app')
  const car = await db.collection('cars').findOne({}, { projection: { frontMainImages: 1, frontMain: 1, imageUrl: 1 } })
  console.log("CAR:", car)
  console.log("TYPE frontMainImages:", typeof car.frontMainImages, Array.isArray(car.frontMainImages) ? 'array' : '')
  if (typeof car.frontMainImages === 'string') {
     try {
       const p = JSON.parse(car.frontMainImages)
       console.log("PARSED:", p, Array.isArray(p))
       if(Array.isArray(p)) {
          console.log("FIRST PARSED TYPE:", typeof p[0])
       }
     }catch(e) { console.log(e.message)}
  }
  await client.close()
}
run()
