const { MongoClient } = require('mongodb')
require('dotenv').config()

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('No MONGODB_URI in .env')
    return
  }
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db('otobix_auction_app')

  const appt = '26-101291'

  const tele = await db.collection('telecallings').findOne({ appointmentId: appt })
  console.log('Telecalling policyNumber:', tele?.policyNumber)
  console.log('Telecalling insurancePolicyNumber:', tele?.insurancePolicyNumber)

  const car = await db.collection('cars').findOne({ appointmentId: appt })
  console.log('Cars policyNumber:', car?.policyNumber)
  console.log('Cars insurancePolicyNumber:', car?.insurancePolicyNumber)

  await client.close()
}
run().catch(console.error)
