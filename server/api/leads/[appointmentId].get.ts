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

    // Merge them if necessary to provide full API parity, prioritizing the cars details since it matches the rich UI.
    const record = { ...(teleRecord || {}), ...(carRecord || {}) }

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
