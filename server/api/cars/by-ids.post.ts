// POST /api/cars/by-ids — resolve car ObjectIds to car summary data
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const body = await readBody(event)
    const ids: string[] = body?.ids || []

    if (!ids.length) return { cars: [] }

    // Build ObjectId filters, skip invalid ones
    const objectIds = ids
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id))

    if (objectIds.length === 0) return { cars: [] }

    const cars = await db.collection('cars').find(
      { _id: { $in: objectIds } },
      {
        projection: {
          appointmentId: 1,
          make: 1,
          model: 1,
          variant: 1,
          registrationNumber: 1,
          mfgYear: 1,
          fuelType: 1,
          transmissionType: 1,
          odometerReadingInKms: 1,
          ownerSerialNumber: 1,
          bodyType: 1,
          city: 1,
          frontMainImage: 1,
          frontMainImages: 1,
          approvalStatus: 1,
          inspectionStatus: 1,
          priceDiscovery: 1,
          oneClickPrice: 1,
          createdAt: 1,
        },
      },
    ).toArray()

    const mapped = cars.map((doc: any) => {
      const id = doc._id?.toString()
      return { ...doc, _id: id, id }
    })

    return { cars: mapped }
  }
  catch (err: any) {
    console.error('[API:cars/by-ids] POST failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to resolve car IDs' })
  }
})
