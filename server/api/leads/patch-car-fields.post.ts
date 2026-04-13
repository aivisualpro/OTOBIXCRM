import { ObjectId } from 'mongodb'

// POST /api/leads/patch-car-fields — One-time utility to seed missing required fields on a car document
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const carId = body.carId
    if (!carId) {
      throw createError({ statusCode: 400, message: 'carId is required' })
    }

    const existingCar = await db.collection('cars').findOne({ _id: new ObjectId(carId) })
    if (!existingCar) {
      throw createError({ statusCode: 404, message: 'Car not found' })
    }

    // Pull contactNumber from telecallings
    let contactNumber = existingCar.customerContactNumber || ''
    if (!contactNumber && existingCar.appointmentId) {
      const teleDoc = await db.collection('telecallings').findOne({ appointmentId: existingCar.appointmentId })
      contactNumber = teleDoc?.customerContactNumber || ''
    }

    const QC_REQUIRED_FIELDS: Record<string, any> = {
      contactNumber,
      customerContactNumber: contactNumber,
      priceDiscoveryBy: body.priceDiscoveryBy || '',
      highestBid: '',
      highestBidder: '',
      auctionStartTime: '',
      auctionDuration: '',
      auctionEndTime: '',
      auctionStatus: '',
      upcomingTime: '',
      upcomingUntil: '',
      liveAt: '',
      movedToOtobuyAt: '',
      oneClickPrice: '',
      otobuyOffer: '',
      soldAt: '',
      soldTo: '',
      reasonOfRemoval: '',
      removedBy: '',
      customerExpectedPrice: '',
      fixedMargin: '',
      variableMargin: '',
      sendToAuctionApk: '',
      appointmentId: existingCar.appointmentId || '',
    }

    // Only set fields that don't already exist
    const $set: Record<string, any> = {}
    const seeded: string[] = []
    const skipped: string[] = []

    for (const [field, defaultVal] of Object.entries(QC_REQUIRED_FIELDS)) {
      if (existingCar[field] === undefined || existingCar[field] === null) {
        $set[field] = defaultVal
        seeded.push(field)
      }
      else {
        skipped.push(field)
      }
    }

    if (Object.keys($set).length > 0) {
      await db.collection('cars').updateOne(
        { _id: new ObjectId(carId) },
        { $set },
      )
    }

    return {
      success: true,
      message: `Patched ${seeded.length} fields, skipped ${skipped.length} existing fields`,
      seeded,
      skipped,
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API:leads] Patch car fields failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to patch' })
  }
})
