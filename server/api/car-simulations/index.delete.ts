export default defineEventHandler(async (event) => {
  try {
    const { userId, carId } = getQuery(event)
    if (!userId || !carId) {
      return { success: false, error: 'userId and carId are required' }
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carSimulations')

    await collection.deleteOne({ userId: String(userId), carId: String(carId) })

    return { success: true }
  }
  catch (err: any) {
    return { success: false, error: err.message }
  }
})
