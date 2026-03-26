// POST /api/leads/import — bulk-import leads from CSV data
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const rows: Record<string, any>[] = body.rows

    if (!Array.isArray(rows) || rows.length === 0) {
      throw createError({ statusCode: 400, message: 'No rows to import' })
    }

    const db = await getLeadsDb(event)
    const now = new Date().toISOString()

    // Generate base appointment ID
    const yearPrefix = String(new Date().getFullYear()).slice(-2)
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

    const docs = rows.map((row, idx) => ({
      appointmentId: row.appointmentId || `${yearPrefix}-${nextNum + idx}`,
      ownerName: row.ownerName || '',
      customerContactNumber: row.customerContactNumber || '',
      carRegistrationNumber: row.carRegistrationNumber || '',
      emailAddress: row.emailAddress || '',
      make: row.make || '',
      model: row.model || '',
      variant: row.variant || '',
      yearOfRegistration: row.yearOfRegistration || '',
      yearOfManufacture: row.yearOfManufacture || '',
      odometerReadingInKms: Number(row.odometerReadingInKms) || 0,
      ownershipSerialNumber: Number(row.ownershipSerialNumber) || 1,
      vehicleStatus: row.vehicleStatus || '',
      city: row.city || '',
      zipCode: row.zipCode || '',
      inspectionAddress: row.inspectionAddress || '',
      inspectionDateTime: row.inspectionDateTime || '',
      inspectionStatus: row.inspectionStatus || 'Pending',
      approvalStatus: row.approvalStatus || 'Pending',
      priority: row.priority || 'Medium',
      appointmentSource: row.appointmentSource || '',
      allocatedTo: row.allocatedTo || '',
      repName: row.repName || '',
      repContact: row.repContact || '',
      bankSource: row.bankSource || '',
      referenceName: row.referenceName || '',
      otherSource: row.otherSource || '',
      remarks: row.remarks || '',
      additionalNotes: row.additionalNotes || '',
      addedBy: row.addedBy || 'CSV Import',
      changedBy: 'CSV Import',
      source: 'CSV Import',
      isActive: true,
      createdAt: row.createdAt || now,
      updatedAt: now,
    }))

    const result = await db.collection('telecallings').insertMany(docs)

    return {
      success: true,
      message: `${result.insertedCount} leads imported successfully`,
      insertedCount: result.insertedCount,
    }
  }
  catch (err: any) {
    if (err.statusCode) throw err
    resetLeadsDb()
    console.error('[API:leads] POST import failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to import leads' })
  }
})
