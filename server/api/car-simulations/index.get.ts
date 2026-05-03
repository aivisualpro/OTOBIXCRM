export default defineEventHandler(async (event) => {
  try {
    const { userId } = getQuery(event)
    if (!userId) {
      return { success: false, error: 'userId is required' }
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carSimulations')

    // Ensure compound index for fast lookups (idempotent)
    await collection.createIndex({ userId: 1, carId: 1 }, { unique: true, background: true }).catch(() => {})

    const docs = await collection.find({ userId: String(userId) }).toArray()

    // Return as a map keyed by carId for fast client-side lookup
    const simulations: Record<string, any> = {}
    for (const doc of docs) {
      simulations[doc.carId] = {
        marginSimulation: doc.marginSimulation,
        cepSimulation: doc.cepSimulation,
      }
    }

    return { success: true, simulations }
  }
  catch (err: any) {
    return { success: false, error: err.message }
  }
})
