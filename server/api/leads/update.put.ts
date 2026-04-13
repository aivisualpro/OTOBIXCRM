import { ObjectId } from 'mongodb'
import { syncLeadToAppSheet } from '../../utils/appsheet'

// PUT /api/leads/update — update a telecalling record
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const db = await getLeadsDb(event)

    const { telecallingId, ...updates } = body

    if (!telecallingId) {
      throw createError({ statusCode: 400, message: 'telecallingId is required' })
    }

    delete updates._id
    delete updates.id
    delete updates.qcLogs
    delete updates.logs

    updates.updatedAt = new Date().toISOString()

    const filter = ObjectId.isValid(telecallingId)
      ? { _id: new ObjectId(telecallingId) }
      : { appointmentId: telecallingId }

    // Fetch before updating to compute diffs
    const oldDoc = await db.collection('telecallings').findOne(filter)
    if (!oldDoc) {
      throw createError({ statusCode: 404, message: 'Lead not found' })
    }

    // Identify changes
    const changes: any[] = []
    const changedBy = updates.changedBy || 'System'
    delete updates.changedBy

    for (const key of Object.keys(updates)) {
      if (key === 'updatedAt' || key === 'id' || key === '_id')
        continue

      const oldVal = oldDoc[key]
      const newVal = updates[key]

      const oldStr = JSON.stringify(oldVal) ?? '""'
      const newStr = JSON.stringify(newVal) ?? '""'

      if (oldStr !== newStr) {
        changes.push({
          field: key,
          oldValue: oldVal,
          newValue: newVal,
        })
      }
    }

    // The FIELD_MAP in appsheet.ts defines which fields matter to telecalling
    const APPSHEET_FIELDS = new Set([
      'appointmentId',
      'ownerName',
      'customerContactNumber',
      'make',
      'model',
      'variant',
      'yearOfManufacture',
      'odometerReadingInKms',
      'ownershipSerialNumber',
      'vehicleStatus',
      'city',
      'zipCode',
      'inspectionAddress',
      'inspectionStatus',
      'priority',
      'appointmentSource',
      'allocatedTo',
      'repName',
      'repContact',
      'bankSource',
      'ncdUcdName',
      'referenceName',
      'remarks',
      'emailAddress',
      'createdAt',
      'otherSource',
      'inspectionDateTime',
      'qcBy',
      'approvalStatus',
      'updatedAt',
    ])

    const telecallingUpdates: Record<string, any> = {}
    for (const k of Object.keys(updates)) {
      if (APPSHEET_FIELDS.has(k)) {
        telecallingUpdates[k] = updates[k]
      }
    }

    // Natively cast specific string fields to MongoDB Date format if they are logically dates
    const DATE_FIELDS = new Set([
      'registrationDate',
      'fitnessTill',
      'yearMonthOfManufacture',
      'taxValidTill',
      'insuranceValidity',
      'permitValidity',
      'partyPeshiDate',
      'cngCylinderTestedDate',
      'cngRegistrationDate',
      'batteryReplacedDate',
      'createdAt',
      'updatedAt',
    ])

    for (const k of Object.keys(updates)) {
      if (DATE_FIELDS.has(k) && typeof updates[k] === 'string') {
        const val = updates[k]
        // If it looks like a valid date format and isn't a text placeholder like "Not Applicable"
        if (val && !Number.isNaN(Date.parse(val)) && !val.toLowerCase().includes('applicable')) {
          updates[k] = new Date(val)
        }
      }
    }

    const telecallingUpdateQuery: Record<string, any> = Object.keys(telecallingUpdates).length > 0 ? { $set: telecallingUpdates } : {}
    const carsUpdateQuery: Record<string, any> = { $set: { ...updates } }

    // Add to activity log dynamically
    if (changes.length > 0) {
      telecallingUpdateQuery.$push = {
        logs: { timestamp: updates.updatedAt, changedBy, changes },
      }
      carsUpdateQuery.$push = {
        qcLog: { timestamp: updates.updatedAt, changedBy, changes },
      }
      carsUpdateQuery.$unset = { qcLogs: 1 }
    }

    const hasTelecallingSet = telecallingUpdateQuery.$set && Object.keys(telecallingUpdateQuery.$set).length > 0
    const hasTelecallingPush = !!telecallingUpdateQuery.$push

    let result
    if (hasTelecallingSet || hasTelecallingPush) {
      result = await db.collection('telecallings').findOneAndUpdate(
        filter,
        telecallingUpdateQuery,
        { returnDocument: 'after' },
      )
    }
    else {
      result = await db.collection('telecallings').findOne(filter)
    }

    if (!result && !(hasTelecallingSet || hasTelecallingPush)) {
      // If it didn't update anything and findOne also failed...
      throw createError({ statusCode: 404, message: 'Lead not found' })
    }

    // Keep the core 'cars' collection in lock-step with these updates
    const actualDoc = result?.value || result || oldDoc
    const apptId = actualDoc.appointmentId || oldDoc.appointmentId
    if (apptId) {
      carsUpdateQuery.$set.appointmentId = apptId

      // ── QC Approval: Seed all required fields on the cars document ──
      if (updates.approvalStatus === 'Approved') {
        // Pull contactNumber from telecallings → cars
        const teleDoc = await db.collection('telecallings').findOne({ appointmentId: apptId })
        const contactNumber = teleDoc?.customerContactNumber || ''

        // priceDiscoveryBy = the user who approved the QC
        const priceDiscoveryBy = changedBy || ''

        // ── Calculate margins from carMargins collection ──
        const existingCar = await db.collection('cars').findOne({ appointmentId: apptId })
        const priceDiscovery = Number(updates.priceDiscovery || existingCar?.priceDiscovery) || 0
        const priceInLacs = priceDiscovery / 100000

        let calculatedFixedMargin = 0
        let calculatedVariableMargin = 0

        try {
          const marginSchemes = await db.collection('carMargins').find({}).sort({ fixedMargin: 1 }).toArray()
          if (marginSchemes.length > 0) {
            // Use the first (global) scheme
            const scheme = marginSchemes[0]
            calculatedFixedMargin = Number(scheme.fixedMargin) || 0

            // Find the matching variable range based on priceDiscovery in lacs
            const ranges = scheme.variableRanges || []
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
          console.warn('[API:leads] Failed to fetch margin scheme, using defaults:', marginErr.message)
        }

        // All fields that MUST exist on the car document (even if empty)
        const QC_REQUIRED_FIELDS: Record<string, any> = {
          contactNumber,
          customerContactNumber: contactNumber,
          priceDiscoveryBy,
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
          soldAt: '',
          soldTo: '',
          reasonOfRemoval: '',
          removedBy: '',
          customerExpectedPrice: 0,
          fixedMargin: calculatedFixedMargin,
          variableMargin: calculatedVariableMargin,
          sendToAuctionApk: '',
          appointmentId: apptId,
        }

        // Only set fields that don't already exist on the car document
        for (const [field, defaultVal] of Object.entries(QC_REQUIRED_FIELDS)) {
          if (!existingCar || existingCar[field] === undefined || existingCar[field] === null) {
            carsUpdateQuery.$set[field] = defaultVal
          }
        }
        // Always overwrite these specific fields on approval
        carsUpdateQuery.$set.priceDiscoveryBy = priceDiscoveryBy
        carsUpdateQuery.$set.contactNumber = contactNumber
        carsUpdateQuery.$set.customerContactNumber = contactNumber
        carsUpdateQuery.$set.fixedMargin = calculatedFixedMargin
        carsUpdateQuery.$set.variableMargin = calculatedVariableMargin
      }

      await db.collection('cars').updateOne(
        { appointmentId: apptId },
        carsUpdateQuery,
      )
    }

    const hasAppSheetChange = changes.some((c: any) => APPSHEET_FIELDS.has(c.field))
    if (hasAppSheetChange && result) {
      syncLeadToAppSheet('Edit', result, db)
    }

    // Broadcast real-time change to all connected clients
    broadcastChange('leads', 'update', apptId || telecallingId, changedBy)

    return {
      success: true,
      message: 'Lead updated successfully',
      modifiedCount: 1,
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    resetLeadsDb()
    console.error('[API:leads] PUT update failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to update lead' })
  }
})
