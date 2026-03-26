// Generate appointment ID like "26-100XXX"
async function generateAppointmentId(db: any): Promise<string> {
  const now = new Date()
  const yearPrefix = String(now.getFullYear()).slice(-2)

  const latest = await db
    .collection('telecallings')
    .find({ appointmentId: { $regex: `^${yearPrefix}-` } })
    .sort({ appointmentId: -1 })
    .limit(1)
    .toArray()

  let nextNum = 100001
  if (latest.length > 0) {
    const match = latest[0].appointmentId?.match(/\d+-(\d+)/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }

  return `${yearPrefix}-${nextNum}`
}

// POST /api/leads/add — create a new lead directly in MongoDB
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const now = new Date().toISOString()
    const appointmentId = await generateAppointmentId(db)

    const doc = {
      appointmentId,
      ownerName: body.ownerName || '',
      customerContactNumber: body.customerContactNumber || '',
      carRegistrationNumber: body.carRegistrationNumber || '',
      make: body.make || '',
      model: body.model || '',
      variant: body.variant || '',
      yearOfRegistration: body.yearOfRegistration || '',
      yearOfManufacture: body.yearOfManufacture || '',
      odometerReadingInKms: Number(body.odometerReadingInKms) || 0,
      ownershipSerialNumber: Number(body.ownershipSerialNumber) || 1,
      vehicleStatus: body.vehicleStatus || 'Home Inspection',
      city: body.city || '',
      zipCode: body.zipCode || '',
      inspectionAddress: body.inspectionAddress || '',
      inspectionDateTime: body.inspectionDateTime || '',
      inspectionStatus: body.inspectionStatus || 'Pending',
      approvalStatus: body.approvalStatus || 'Pending',
      priority: body.priority || 'Medium',
      appointmentSource: body.appointmentSource || 'OLX',
      allocatedTo: body.allocatedTo || '',
      repName: body.repName || '',
      repContact: body.repContact || '',
      bankSource: body.bankSource || '',
      referenceName: body.referenceName || '',
      remarks: body.remarks || '',
      additionalNotes: body.additionalNotes || '',
      addedBy: body.addedBy || 'Admin',
      changedBy: body.changedBy || 'Admin',
      source: body.source || 'CRM',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection('telecallings').insertOne(doc)

    return {
      success: true,
      message: 'Lead created successfully',
      data: { _id: result.insertedId, ...doc },
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    resetLeadsDb()
    console.error('[API:leads] POST add failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to create lead' })
  }
})
