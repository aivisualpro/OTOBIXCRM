/**
 * AppSheet Sync Utility
 * Syncs lead data to AppSheet in the background (non-blocking).
 * App: Otobix CRM | Table: LEADS
 */
import type { Db } from 'mongodb'

const APPSHEET_APP_ID = '9f2c56c3-a499-441a-b602-514840bc6612'
const APPSHEET_ACCESS_KEY = 'V2-nuIjb-g2V71-tLs6Y-lLJRx-LC476-FwaKk-EePUi-Hjc0b'
const APPSHEET_TABLE = 'LEADS'
const APPSHEET_BASE_URL = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${APPSHEET_TABLE}/Action`

// ─── MongoDB → AppSheet field name mapping ───
const FIELD_MAP: Record<string, string> = {
  appointmentId: 'Appointment ID',
  ownerName: 'Customer Name',
  customerContactNumber: 'Customer Contact Number',
  make: 'Make',
  model: 'Model',
  variant: 'Variant',
  yearOfManufacture: 'Year of Manufacture',
  odometerReadingInKms: 'Odometer Reading',
  ownershipSerialNumber: 'Ownership Serial Number',
  vehicleStatus: 'Vehicle Status',
  city: 'City',
  zipCode: 'Zip Code',
  inspectionAddress: 'Address for Inspection',
  inspectionStatus: 'Inspection Status',
  priority: 'Priority',
  appointmentSource: 'Appointment Source',
  allocatedTo: 'Allocated to',
  repName: 'Reference Name',
  repContact: 'Reference Number',
  bankSource: 'Bank Source',
  ncdUcdName: 'NCD/UCD Name',
  referenceName: 'NCD Representative Name',
  remarks: 'Remarks',
  emailAddress: 'Email Address',
  createdAt: 'Timestamp',
  otherSource: 'Other Source',
}

/**
 * Maps a MongoDB lead doc to an AppSheet row object
 */
function toAppSheetRow(doc: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {}

  for (const [mongoField, appField] of Object.entries(FIELD_MAP)) {
    const val = doc[mongoField]
    if (val !== undefined && val !== null) {
      row[appField] = String(val)
    }
  }

  // Split inspectionDateTime → Date + Time columns
  if (doc.inspectionDateTime) {
    try {
      const dt = new Date(doc.inspectionDateTime)
      if (!Number.isNaN(dt.getTime())) {
        // Date: MM/DD/YYYY format (AppSheet standard)
        const month = String(dt.getMonth() + 1).padStart(2, '0')
        const day = String(dt.getDate()).padStart(2, '0')
        const year = dt.getFullYear()
        row['Requested inspection Date'] = `${month}/${day}/${year}`

        // Time: HH:MM:SS format
        const hours = String(dt.getHours()).padStart(2, '0')
        const mins = String(dt.getMinutes()).padStart(2, '0')
        row['Requested inspection Time'] = `${hours}:${mins}:00`
      }
      else {
        // Raw string fallback
        row['Requested inspection Date'] = doc.inspectionDateTime
        row['Requested inspection Time'] = ''
      }
    }
    catch {
      row['Requested inspection Date'] = doc.inspectionDateTime
      row['Requested inspection Time'] = ''
    }
  }

  return row
}

/**
 * Fire-and-forget: sync a lead to AppSheet.
 * Never throws — errors are logged silently to avoid blocking the CRM response.
 */
export function syncLeadToAppSheet(
  action: 'Add' | 'Edit' | 'Delete',
  doc: Record<string, any>,
  db?: Db,
): void {
  // Run entirely in background — do not await
  ;(async () => {
    try {
      const _doc = { ...doc }

      // Map "allocatedTo" from userName to user email for AppSheet (Legacy fallback)
      if (_doc.allocatedTo && !_doc.allocatedTo.includes('@') && db) {
        try {
          const user = await db.collection('users').findOne({ userName: _doc.allocatedTo })
          if (user && user.email) {
            _doc.allocatedTo = user.email
          }
        }
        catch (err: any) {
          console.warn('[AppSheet] DB lookup failed for allocatedTo email:', err.message)
        }
      }

      const execute = async (currentAction: string) => {
        let rows: Record<string, any>[]

        if (currentAction === 'Delete') {
          // For delete, only the key field is needed
          rows = [{ 'Appointment ID': String(_doc.appointmentId || '') }]
        }
        else {
          rows = [toAppSheetRow(_doc)]
        }

        const body = {
          Action: currentAction,
          Properties: {
            Locale: 'en-US',
            RunAsUserEmail: _doc.emailAddress || 'admin@otobix.in',
          },
          Rows: rows,
        }

        const res = await fetch(APPSHEET_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ApplicationAccessKey': APPSHEET_ACCESS_KEY,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000)
        })

        const text = await res.text()

        let isSuccess = res.ok
        let isNotFound = false
        let isDuplicate = false

        // AppSheet can return 200 OK or 400 Bad Request but flag failures in the JSON body.
        // It often logs "NotFound" or "not found" in the error strings when trying to edit non-existent rows.
        if (text.toLowerCase().includes('not found') || text.includes('"StatusCode":"NotFound"')) {
          isSuccess = false
          isNotFound = true
        }
        else if (text.toLowerCase().includes('already exists') || text.toLowerCase().includes('duplicate')) {
          isSuccess = false
          isDuplicate = true
        }

        return { isSuccess, isNotFound, isDuplicate, text, status: res.status }
      }

      // Initial execution attempt
      let result = await execute(action)

      // ─── Smart Upsert logic ───
      // If we attempt an Edit but AppSheet rejects it because the row doesn't exist, seamlessly create it
      if (!result.isSuccess && result.isNotFound && action === 'Edit') {
        console.warn(`[AppSheet] Row not found. Falling back to ADD action for Appointment ID: ${_doc.appointmentId}`)
        result = await execute('Add')
      }
      // If we attempt to Add but it already exists, seamlessly edit the existing record
      else if (!result.isSuccess && result.isDuplicate && action === 'Add') {
        console.warn(`[AppSheet] Row already exists. Falling back to EDIT action for Appointment ID: ${_doc.appointmentId}`)
        result = await execute('Edit')
      }

      if (!result.isSuccess) {
        console.warn(`[AppSheet] Final sync failed (${result.status}):`, result.text.slice(0, 300))
      }
      else {
        console.warn(`[AppSheet] Successfully synced → Appointment ID: ${_doc.appointmentId}`)
      }
    }
    catch (err: any) {
      console.warn('[AppSheet] Sync error (non-fatal):', err?.message)
    }
  })()
}
