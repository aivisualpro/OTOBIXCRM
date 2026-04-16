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

    // Pull contactNumber from telecallings, strip +91 prefix
    let contactNumber = existingCar.customerContactNumber || ''
    if (!contactNumber && existingCar.appointmentId) {
      const teleDoc = await db.collection('telecallings').findOne({ appointmentId: existingCar.appointmentId })
      contactNumber = teleDoc?.customerContactNumber || ''
    }
    if (typeof contactNumber === 'string') {
      contactNumber = contactNumber.replace(/^\+91\s*/, '').trim()
    }

    // ── Calculate margins from carMargins collection ──
    const priceDiscovery = Number(existingCar.priceDiscovery) || 0
    const priceInLacs = priceDiscovery / 100000

    let calculatedFixedMargin = 0
    let calculatedVariableMargin = 0

    try {
      const marginSchemes = await db.collection('carMargins').find({}).sort({ fixedMargin: 1 }).toArray()
      if (marginSchemes.length > 0) {
        const scheme = marginSchemes[0]
        calculatedFixedMargin = Number(scheme?.fixedMargin) || 0

        const ranges = scheme?.variableRanges || []
        for (const range of ranges) {
          const min = Number(range.min) || 0
          const max = Number(range.max) || Infinity
          if (priceInLacs >= min && priceInLacs <= max) {
            calculatedVariableMargin = Number(range.margin) || 0
            break
          }
        }
      }
    }
    catch (marginErr: any) {
      console.warn('[API:leads] Margin calc failed, using 0:', marginErr.message)
    }

    // ── frontMain: sync from frontMainImages ──
    const frontMainImages = existingCar.frontMainImages || []
    const frontMain = Array.isArray(frontMainImages) ? [...frontMainImages] : []

    const QC_REQUIRED_FIELDS: Record<string, any> = {
      contactNumber,
      priceDiscoveryBy: body.priceDiscoveryBy || '',
      highestBid: 0,
      highestBidder: '',
      auctionStartTime: '',
      auctionDuration: 0,
      auctionEndTime: '',
      auctionStatus: '',
      upcomingTime: '',
      upcomingUntil: '',
      liveAt: '',
      movedToOtobuyAt: '',
      oneClickPrice: 0,
      otobuyOffer: 0,
      soldAt: 0,
      soldTo: '',
      reasonOfRemoval: '',
      removedBy: '',
      customerExpectedPrice: 0,
      fixedMargin: calculatedFixedMargin,
      variableMargin: calculatedVariableMargin,
      sendToAuctionApk: '',
      appointmentId: existingCar.appointmentId || '',
      frontMain,
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

    // Always overwrite margins with calculated values (as numbers)
    $set.fixedMargin = calculatedFixedMargin
    $set.variableMargin = calculatedVariableMargin
    if (!seeded.includes('fixedMargin')) seeded.push('fixedMargin (overwrite)')
    if (!seeded.includes('variableMargin')) seeded.push('variableMargin (overwrite)')

    if (Object.keys($set).length > 0) {
      await db.collection('cars').updateOne(
        { _id: new ObjectId(carId) },
        { $set },
      )
    }

    return {
      success: true,
      message: `Patched ${seeded.length} fields, skipped ${skipped.length} existing fields`,
      priceDiscovery,
      priceInLacs,
      calculatedFixedMargin,
      calculatedVariableMargin,
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
