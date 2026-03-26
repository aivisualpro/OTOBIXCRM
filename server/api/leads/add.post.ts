import { syncLeadToAppSheet } from '../../utils/appsheet'

// POST /api/leads/add — create a new lead directly in MongoDB
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const now = new Date().toISOString()

    // Always generate appointmentId server-side at insert time.
    // This guarantees: no duplicates (atomic counter) AND no gaps (counter
    // only increments when a lead is actually being created).
    const yearPrefix = String(new Date().getFullYear()).slice(-2)
    const counterId = `appointmentId_${yearPrefix}`
    const counterResult = await db.collection('counters').findOneAndUpdate(
      { _id: counterId } as any,
      {
        $inc: { seq: 1 },
        $set: { updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    )
    const seq = (counterResult as any)?.seq || 1
    const appointmentId = `${yearPrefix}-${100000 + seq}`

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
      createdByFullName: body.createdByFullName || '',
      source: body.source || 'CRM',
      emailAddress: body.emailAddress || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection('telecallings').insertOne(doc)

    // Sync to AppSheet in background (non-blocking)
    syncLeadToAppSheet('Add', doc, db)

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
