export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { userId, carId, marginSimulation, cepSimulation } = body || {}

    if (!userId || !carId) {
      return { success: false, error: 'userId and carId are required' }
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('carSimulations')

    // Build the update — only set fields that are provided, unset if explicitly null/undefined
    const $set: any = { userId: String(userId), carId: String(carId), updatedAt: new Date() }
    const $unset: any = {}

    if (marginSimulation !== undefined && marginSimulation !== null && marginSimulation !== '') {
      $set.marginSimulation = String(marginSimulation)
    }
    else {
      $unset.marginSimulation = ''
    }

    if (cepSimulation !== undefined && cepSimulation !== null && cepSimulation !== '') {
      $set.cepSimulation = Number(cepSimulation)
    }
    else {
      $unset.cepSimulation = ''
    }

    const update: any = { $set }
    if (Object.keys($unset).length > 0) {
      update.$unset = $unset
    }

    // Check if both simulations are being cleared — delete the document instead
    const bothCleared = !$set.marginSimulation && !$set.cepSimulation && $unset.marginSimulation !== undefined && $unset.cepSimulation !== undefined
    if (bothCleared) {
      await collection.deleteOne({ userId: String(userId), carId: String(carId) })
      return { success: true, action: 'deleted' }
    }

    await collection.updateOne(
      { userId: String(userId), carId: String(carId) },
      { ...update, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )

    return { success: true, action: 'saved' }
  }
  catch (err: any) {
    return { success: false, error: err.message }
  }
})
