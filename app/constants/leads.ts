export const leadsColumns = [
  { key: 'appointmentId', label: 'Appt. ID' },
  { key: 'ownerName', label: 'Owner' },
  { key: 'customerContactNumber', label: 'Contact' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant' },
  { key: 'yearOfManufacture', label: 'Year of Mfg' },
  { key: 'odometerReadingInKms', label: 'Odometer (KM)', type: 'number' as const },
  { key: 'inspectionStatus', label: 'Inspection', type: 'badge' as const },
  { key: 'priority', label: 'Priority', type: 'badge' as const },
  { key: 'inspectionDateTime', label: 'Inspection Date', type: 'date' as const },
  { key: 'inspectionAddress', label: 'Address' },
  { key: 'addedBy', label: 'Added By' },
  { key: 'createdByFullName', label: 'Created By' },
  { key: 'createdAt', label: 'Created At', type: 'date' as const },
]

/** Columns for /leads/scheduled — shows Allocated To + inspectionStatus */
export const scheduledColumns = [
  { key: 'appointmentId', label: 'Appt. ID' },
  { key: 'ownerName', label: 'Owner' },
  { key: 'customerContactNumber', label: 'Contact' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant' },
  { key: 'yearOfManufacture', label: 'Year of Mfg' },
  { key: 'odometerReadingInKms', label: 'Odometer (KM)', type: 'number' as const },
  { key: 'allocatedTo', label: 'Allocated To' },
  { key: 'inspectionStatus', label: 'Inspection', type: 'badge' as const },
  { key: 'priority', label: 'Priority', type: 'badge' as const },
  { key: 'inspectionDateTime', label: 'Inspection Date', type: 'date' as const },
  { key: 'inspectionAddress', label: 'Address' },
  { key: 'addedBy', label: 'Added By' },
  { key: 'createdByFullName', label: 'Created By' },
  { key: 'createdAt', label: 'Created At', type: 'date' as const },
]

/** Per-route column overrides — if a route key is here, use its columns instead of default */
export const routeColumnsMap: Record<string, typeof leadsColumns> = {
  scheduled: scheduledColumns,
}

export const leadsFormFields = [
  { key: 'ownerName', label: 'Owner Name', placeholder: 'Full Name', required: true },
  { key: 'customerContactNumber', label: 'Contact Number', placeholder: '+91 9999999999', required: true },
  { key: 'carRegistrationNumber', label: 'Car Registration Number', placeholder: 'e.g. WB-26-AB-1234', hideOnCreate: true },
  {
    key: 'vehicleStatus',
    label: 'Vehicle Status',
    type: 'select' as const,
    required: true,
    defaultValue: 'Home Inspection',
    options: [
      { label: 'Home Inspection', value: 'Home Inspection' },
      { label: 'Store Inspection', value: 'Store Inspection' },
      { label: 'NCD / UCD Stocked', value: 'NCD / UCD Stocked' },
      { label: 'Test Drive Vehicle/ Dealer Vehicle', value: 'Test Drive Vehicle/ Dealer Vehicle' },
    ],
  },
  { key: 'make', label: 'Make', type: 'select' as const, placeholder: 'Select Make' },
  { key: 'model', label: 'Model', type: 'select' as const, placeholder: 'Select Model' },
  { key: 'variant', label: 'Variant', type: 'select' as const, placeholder: 'Select Variant' },
  { key: 'yearOfRegistration', label: 'Year of Registration', placeholder: '2024' },
  { key: 'yearOfManufacture', label: 'Year of Manufacture', placeholder: '2023' },
  { key: 'odometerReadingInKms', label: 'Odometer (KM)', type: 'number' as const, placeholder: '15000' },
  { key: 'ownershipSerialNumber', label: 'Ownership Number', type: 'number' as const, placeholder: '1' },
  {
    key: 'city',
    label: 'City',
    type: 'select' as const,
    required: true,
    options: [
      { label: 'Kolkata', value: 'KOLKATA' },
      { label: 'Mumbai', value: 'Mumbai' },
      { label: 'Delhi', value: 'Delhi' },
      { label: 'Bangalore', value: 'Bangalore' },
      { label: 'Chennai', value: 'Chennai' },
      { label: 'Hyderabad', value: 'Hyderabad' },
      { label: 'Pune', value: 'Pune' },
      { label: 'Ahmedabad', value: 'Ahmedabad' },
      { label: 'Jaipur', value: 'Jaipur' },
      { label: 'Lucknow', value: 'Lucknow' },
      { label: 'Chandigarh', value: 'Chandigarh' },
      { label: 'Gurgaon', value: 'Gurgaon' },
      { label: 'Noida', value: 'Noida' },
      { label: 'Indore', value: 'Indore' },
      { label: 'Bhopal', value: 'Bhopal' },
      { label: 'Coimbatore', value: 'Coimbatore' },
      { label: 'Kochi', value: 'Kochi' },
      { label: 'Nagpur', value: 'Nagpur' },
      { label: 'Surat', value: 'Surat' },
      { label: 'Visakhapatnam', value: 'Visakhapatnam' },
    ],
  },
  { key: 'zipCode', label: 'ZIP Code', placeholder: '400001' },
  { key: 'inspectionAddress', label: 'Inspection Address', type: 'textarea' as const, placeholder: 'Full address for inspection', required: true },
  { key: 'inspectionDateTime', label: 'Inspection Date & Time', type: 'datetime-local' as const, required: true },
  {
    key: 'inspectionStatus',
    label: 'Inspection Status',
    type: 'select' as const,
    hideOnCreate: true,
    defaultValue: 'Pending',
    options: [
      { label: 'Pending', value: 'Pending' },
      { label: 'Scheduled', value: 'Scheduled' },
      { label: 'Re-Schedule', value: 'Re-Scheduled' },
      { label: 'Cancelled', value: 'Cancelled' },
    ],
  },
  {
    key: 'approvalStatus',
    label: 'Approval Status',
    type: 'select' as const,
    hideOnCreate: true,
    defaultValue: 'Pending',
    options: [
      { label: 'Pending', value: 'Pending' },
      { label: 'Under Review', value: 'Under Review' },
      { label: 'Approved', value: 'Approved' },
      { label: 'Quality Rejected', value: 'Quality Rejected' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select' as const,
    required: true,
    options: [
      { label: 'High', value: 'High' },
      { label: 'Medium', value: 'Medium' },
      { label: 'Low', value: 'Low' },
    ],
  },
  {
    key: 'appointmentSource',
    label: 'Source',
    type: 'select' as const,
    required: true,
    defaultValue: 'OLX',
    options: [
      { label: 'Reference', value: 'Reference' },
      { label: 'Car Trade', value: 'Car Trade' },
      { label: 'Website', value: 'Website' },
      { label: 'OLX', value: 'OLX' },
      { label: 'FaceBook Marketplace', value: 'FaceBook Marketplace' },
      { label: 'UCD', value: 'UCD' },
      { label: 'NCD', value: 'NCD' },
      { label: 'IE Generated Lead', value: 'IE Generated Lead' },
      { label: 'Data Calling', value: 'Data Calling' },
      { label: 'Social Media Campaign', value: 'Social Media Campaign' },
      { label: 'Bank', value: 'Bank' },
      { label: 'SMS/Whatsapp Blast', value: 'SMS/Whatsapp Blast' },
      { label: 'Other', value: 'Other' },
      { label: 'PDI', value: 'PDI' },
    ],
  },
  { key: 'allocatedTo', label: 'Allocated To', placeholder: 'Team member name', hideOnCreate: true },
  { key: 'repName', label: 'NCD/UCD Representative Name', placeholder: 'Rep name' },
  { key: 'repContact', label: 'NCD/UCD Representative Contact', placeholder: '+91 9999999999' },
  { key: 'otherSource', label: 'Other Source', placeholder: 'Specify other source' },
  { key: 'bankSource', label: 'Bank Source', placeholder: 'Bank name', required: true },
  { key: 'referenceName', label: 'Reference Name / NCD UCD Name', placeholder: 'Reference' },
  { key: 'remarks', label: 'Remarks', type: 'textarea' as const, placeholder: 'Any additional remarks...' },
  { key: 'additionalNotes', label: 'Additional Notes', type: 'textarea' as const, placeholder: 'Notes...', hideOnCreate: true },
]

// No longer needed — data comes from API
export const leadsSeedData: any[] = []

// Compound filter: each route filters by BOTH inspectionStatus AND approvalStatus
export interface LeadRouteFilter {
  inspectionStatus: string
  approvalStatus: string
  label: string
}

export const routeFilters = {
  // /leads (index)
  'leads': {
    inspectionStatus: 'Pending',
    approvalStatus: '*',
    label: 'Leads',
  },
  // /leads/scheduled
  'scheduled': {
    inspectionStatus: 'Scheduled',
    approvalStatus: '*',
    label: 'Scheduled',
  },
  // /leads/re-scheduled
  're-scheduled': {
    inspectionStatus: 'Re-Scheduled',
    approvalStatus: '*',
    label: 'Re-Scheduled',
  },
  // /leads/running
  'running': {
    inspectionStatus: 'Running',
    approvalStatus: '*',
    label: 'Running',
  },
  // /leads/quality-approved
  'quality-approved': {
    inspectionStatus: 'Inspected',
    approvalStatus: 'Approved',
    label: 'Approved',
  },
  // /leads/cancelled
  'cancelled': {
    inspectionStatus: 'Cancelled',
    approvalStatus: '*',
    label: 'Cancelled',
  },
  // /leads/re-inspection
  're-inspection': {
    inspectionStatus: 'Re-Inspected',
    approvalStatus: '*',
    label: 'Re-Inspection',
  },
  // /leads/inspected
  'inspected': {
    inspectionStatus: 'Inspected',
    approvalStatus: 'Pending',
    label: 'Inspected',
  },
  // /leads/under-review
  'under-review': { label: 'Under Review', inspectionStatus: 'Inspected', approvalStatus: 'Under Review' },
  'quality-rejected': { label: 'Quality Rejected', inspectionStatus: 'Inspected', approvalStatus: 'Quality Rejected' },
  'search-results': { label: 'Search Results', inspectionStatus: '*', approvalStatus: '*' },
}
