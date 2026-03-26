/**
 * AppSheet Sync Utility
 * Syncs lead data to AppSheet in the background (non-blocking).
 * App: Otobix CRM | Table: LEADS
 */

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
      if (!isNaN(dt.getTime())) {
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
): void {
  // Run entirely in background — do not await
  ;(async () => {
    try {
      let rows: Record<string, any>[]

      if (action === 'Delete') {
        // For delete, only the key field is needed
        rows = [{ 'Appointment ID': String(doc.appointmentId || '') }]
      }
      else {
        rows = [toAppSheetRow(doc)]
      }

      const body = {
        Action: action,
        Properties: {
          Locale: 'en-US',
          RunAsUserEmail: '',
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
      })

      if (!res.ok) {
        const text = await res.text()
        console.warn(`[AppSheet] ${action} sync failed (${res.status}):`, text.slice(0, 300))
      }
      else {
        console.info(`[AppSheet] ${action} synced → Appointment ID: ${doc.appointmentId}`)
      }
    }
    catch (err: any) {
      console.warn('[AppSheet] Sync error (non-fatal):', err?.message)
    }
  })()
}
