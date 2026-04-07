export default defineEventHandler(async (event) => {
  const appointmentId = getRouterParam(event, 'appointmentId')
  if (!appointmentId) {
    throw createError({ statusCode: 400, message: 'Missing appointmentId parameter' })
  }

  try {
    const db = await getLeadsDb(event)
    const colTelecallings = db.collection('telecallings')
    const colCars = db.collection('cars')

    // The previous external API aggregated or pulled mainly from `cars`
    const carRecord = await colCars.findOne({ appointmentId })
    const teleRecord = await colTelecallings.findOne({ appointmentId })

    // The FIELD_MAP in appsheet.ts defines which fields matter to telecalling
    const APPSHEET_FIELDS = new Set([
      'appointmentId', 'ownerName', 'customerContactNumber', 'make', 'model',
      'variant', 'yearOfManufacture', 'odometerReadingInKms', 'ownershipSerialNumber',
      'vehicleStatus', 'city', 'zipCode', 'inspectionAddress', 'inspectionStatus',
      'priority', 'appointmentSource', 'allocatedTo', 'repName', 'repContact',
      'bankSource', 'ncdUcdName', 'referenceName', 'remarks', 'emailAddress',
      'createdAt', 'otherSource', 'inspectionDateTime', 'approvalStatus', 'updatedAt'
    ])

    // Merge them, prioritizing the CRM (telecalling) edits ONLY for core telecalling fields.
    // This prevents historical garbage (like inspection images accidentally saved to telecallings)
    // from overriding the true source of truth in the 'cars' collection.
    const record = { ...(carRecord || {}) }
    
    // Explicitly retain the native 'cars' collection ObjectId for third-party operations like auction scheduling
    if (carRecord && carRecord._id) {
      record.carObjectId = carRecord._id
    }

    if (teleRecord) {
      for (const key of Object.keys(teleRecord)) {
        if (key === '_id' || APPSHEET_FIELDS.has(key) || key === 'logs') {
          record[key] = teleRecord[key]
        }
      }
    }

    if (!record || Object.keys(record).length === 0) {
      throw createError({ statusCode: 404, message: 'Inspection details not found for this appointment ID' })
    }

    // The UI expects nested arrays or particular names.
    return { carDetails: record }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:leads] Failed to fetch car details by appointmentId:', err.message)
    throw createError({ statusCode: 500, message: `Database error fetching details. ${err.message}` })
  }
})
