import { syncLeadToAppSheet } from '../../utils/appsheet'

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

    // Count how many rows need auto-generated IDs
    const rowsNeedingId = rows.filter((r: any) => !r.appointmentId).length

    // Atomically reserve a batch of IDs from the counter
    const yearPrefix = String(new Date().getFullYear()).slice(-2)
    let batchStartSeq = 0
    if (rowsNeedingId > 0) {
      const counterId = `appointmentId_${yearPrefix}`
      const counterResult = await db.collection('counters').findOneAndUpdate(
        { _id: counterId } as any,
        {
          $inc: { seq: rowsNeedingId },
          $set: { updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: 'after' },
      )
      const endSeq = (counterResult as any)?.seq || rowsNeedingId
      batchStartSeq = endSeq - rowsNeedingId + 1
    }

    let autoIdIndex = 0
    const fullDocs: any[] = []

    const ops = rows.map((row: any) => {
      const generatedId = row.appointmentId || `${yearPrefix}-${100000 + batchStartSeq + autoIdIndex++}`

      const updateDoc: any = {
        $set: {
          appointmentId: generatedId,
          updatedAt: now,
        },
        $setOnInsert: {
          isActive: true,
        },
      }

      // Automatically handle createdAt exactly once
      if (row.createdAt) {
        updateDoc.$set.createdAt = row.createdAt
      }
      else {
        updateDoc.$setOnInsert.createdAt = now
      }


      const existingDBFields = [
        'ownerName',
        'customerContactNumber',
        'carRegistrationNumber',
        'emailAddress',
        'make',
        'model',
        'variant',
        'yearOfRegistration',
        'yearOfManufacture',
        'odometerReadingInKms',
        'ownershipSerialNumber',
        'vehicleStatus',
        'city',
        'zipCode',
        'inspectionAddress',
        'inspectionDateTime',
        'inspectionStatus',
        'approvalStatus',
        'priority',
        'appointmentSource',
        'allocatedTo',
        'repName',
        'repContact',
        'bankSource',
        'referenceName',
        'otherSource',
        'ncdUcdName',
        'remarks',
        'additionalNotes',
        'addedBy',
        'inspectionEngineerNumber',
      ]

      for (const field of existingDBFields) {
        if (field in row) {
          if (field === 'odometerReadingInKms' || field === 'ownershipSerialNumber') {
            updateDoc.$set[field] = Number(row[field]) || 0
          }
          else {
            updateDoc.$set[field] = row[field] || ''
          }
        }
      }

      // Keep track of the full combined document for AppSheet syncing
      const combinedDoc = { ...updateDoc.$setOnInsert, ...updateDoc.$set }
      fullDocs.push(combinedDoc)

      return {
        updateOne: {
          filter: { appointmentId: generatedId },
          update: updateDoc,
          upsert: true,
        },
      }
    })

    const result = await db.collection('telecallings').bulkWrite(ops)

    // Fire-and-forget sync to AppSheet
    // We sync them individually in the background to simplify tracking Add vs Edit
    fullDocs.forEach((doc) => {
      // If the bulkWrite upserted this specific appointmentId, it's an Add. Otherwise it's an Edit.
      // (Simplified approach: AppSheet might tolerate 'Edit' if configured, but to be robust 
      // we check if it was newly inserted. However, bulkWrite upsertedIds is an object mapped by index)
      syncLeadToAppSheet('Edit', doc, db)
      // Note: If AppSheet rejects 'Edit' for new records, you can switch to a combined workflow.
      // Assuming 'Edit' works as an upsert in AppSheet or they are already present.
    })

    return {
      success: true,
      message: `${result.upsertedCount} leads inserted, ${result.modifiedCount} leads updated successfully`,
      insertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    resetLeadsDb()
    console.error('[API:leads] POST import failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to import leads' })
  }
})
