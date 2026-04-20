<script setup lang="ts">
/* eslint-disable ts/no-use-before-define */
import { toast } from 'vue-sonner'

const props = defineProps<{
  readonly?: boolean
  appointmentId?: string
  headlessPdf?: boolean
}>()

const emit = defineEmits(['pdfBlobReady'])
const route = useRoute()
const router = useRouter()
const carId = computed(() => String(props.appointmentId || route.params.id || '').replace(/\s+/g, '-'))

const { setHeader } = usePageHeader()
// Header is set dynamically based on active tab below

const { carDetails: car, isLoading, error, fetchCarDetails } = useCarDetails()
const { activeWorkspace } = useWorkspace()

function hasAction(actionId: string) {
  if (!activeWorkspace.value?.leadActions)
    return true
  return activeWorkspace.value.leadActions.includes(actionId)
}

const showPDModal = ref(false)
const pdValue = ref<number | ''>('')
const isSavingPD = ref(false)

function openPDModal() {
  pdValue.value = Number(car.value?.priceDiscovery) || ''
  showPDModal.value = true
}

async function savePD() {
  if (!pdValue.value) {
    toast.error('Price Discovery is required')
    return
  }
  isSavingPD.value = true
  try {
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}
    const email = currentUser?.email || ''

    await $fetch('/api/leads/update', {
      method: 'PUT',
      body: {
        telecallingId: car.value?.appointmentId || car.value?._id,
        priceDiscovery: Number(pdValue.value),
        priceDiscoveryBy: email,
        changedBy: currentUser?.userName || currentUser?.email || 'QC',
      },
    })

    toast.success('Price Discovery updated')
    showPDModal.value = false
    await fetchCarDetails(carId.value)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update PD')
  }
  finally {
    isSavingPD.value = false
  }
}

const { fetchDropdowns, getOptions } = useDropdowns()
const { fetchCarDropdowns, makes, getModels, getVariants } = useCarDropdowns()
const { allUsers, fetchAllUsers } = usePeopleApi()
const retailers = computed(() => allUsers.value.filter(u => u.userRole === 'Retailer'))

const allocatedToName = computed(() => {
  const emailOrName = car.value?.allocatedTo
  if (!emailOrName)
    return ''
  const val = String(emailOrName).trim().toLowerCase()
  const found = allUsers.value.find((u: any) =>
    String(u.email || '').toLowerCase() === val
    || String(u.userName || '').toLowerCase() === val
    || String(u.emailAddress || '').toLowerCase() === val,
  )
  if (found) {
    if (found.fullName)
      return found.fullName
    if (found.userName)
      return found.userName
  }
  return emailOrName
})

const qcByName = computed(() => {
  const emailOrName = car.value?.qcBy
  if (!emailOrName)
    return ''
  const val = String(emailOrName).trim().toLowerCase()
  const found = allUsers.value.find((u: any) =>
    String(u.email || '').toLowerCase() === val
    || String(u.userName || '').toLowerCase() === val
    || String(u.emailAddress || '').toLowerCase() === val,
  )
  if (found) {
    if (found.fullName)
      return found.fullName
    if (found.userName)
      return found.userName
  }
  return emailOrName
})

const editForm = ref<Record<string, any>>({})
let _skipAutoSave = false
let _skipCarWatch = false
let _pendingSave = false // gates SSE re-fetches during ANY save (silent or manual)

const makeOptions = computed(() => {
  if (makes.value.length === 0 && editForm.value.make)
    return [{ label: editForm.value.make, value: editForm.value.make }]
  return makes.value.map(m => ({ label: m, value: m }))
})

const modelOptions = computed(() => {
  const selectedMake = editForm.value.make
  const models = selectedMake ? getModels(selectedMake) : []
  if (models.length === 0 && editForm.value.model)
    return [{ label: editForm.value.model, value: editForm.value.model }]
  return models.map(m => ({ label: m, value: m }))
})

const variantOptions = computed(() => {
  const selectedMake = editForm.value.make
  const selectedModel = editForm.value.model
  const variants = (selectedMake && selectedModel) ? getVariants(selectedMake, selectedModel) : []
  if (variants.length === 0 && editForm.value.variant)
    return [{ label: editForm.value.variant, value: editForm.value.variant }]
  return variants.map(v => ({ label: v, value: v }))
})

onMounted(() => {
  if (!props.readonly && !props.headlessPdf) {
    fetchDropdowns()
    fetchCarDropdowns()
  }
  if (carId.value)
    fetchCarDetails(carId.value)
  if (!props.headlessPdf)
    fetchAllUsers()

  // ESC to close attester panel
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape')
      showAttesterModal.value = false
  }
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
})

watch(carId, (newVal) => {
  if (newVal)
    fetchCarDetails(newVal)
})

// ─── Live Sync Interceptor ───
const { lastEvent } = useLiveSync()
watch(lastEvent, (evt) => {
  // Skip SSE re-fetches triggered by our own save to prevent editForm wipe
  if (_pendingSave)
    return
  if (evt && (evt.collection === 'cars' || evt.collection === 'telecallings' || evt.collection === 'leads') && evt.recordId) {
    if (car.value && (car.value.id === evt.recordId || car.value._id === evt.recordId || car.value.appointmentId === evt.recordId)) { // note: update.put.ts fires sync with car _id
      fetchCarDetails(carId.value, true)
    }
  }
})

const isSaving = ref(false)

// ─── Upload Progress Tracking ───
const uploadProgress = ref<Record<string, { progress: number, status: 'uploading' | 'processing' | 'done' | 'error' }>>({})
function setUploadProgress(key: string, progress: number, status: 'uploading' | 'processing' | 'done' | 'error' = 'uploading') {
  uploadProgress.value = { ...uploadProgress.value, [key]: { progress, status } }
}
function clearUploadProgress(key: string) {
  const copy = { ...uploadProgress.value }
  delete copy[key]
  uploadProgress.value = copy
}

// ─── QC Logs Search State ───
const qcLogSearchField = ref('all')

const allQcLogFields = computed(() => {
  if (!car.value?.qcLog)
    return []
  const fields = new Set<string>()
  car.value.qcLog.forEach((log: any) => {
    log.changes.forEach((change: any) => {
      fields.add(change.field)
    })
  })
  return Array.from(fields).sort()
})

const qcLogSearchOptions = computed(() => {
  return [
    { label: 'All Fields', value: 'all' },
    ...allQcLogFields.value.map(cf => ({ label: cf, value: cf })),
  ]
})

const filteredQcLogs = computed(() => {
  if (!car.value?.qcLog)
    return []
  let logs = [...car.value.qcLog].reverse()
  if (qcLogSearchField.value !== 'all') {
    logs = logs.map(log => ({
      ...log,
      changes: log.changes.filter((c: any) => c.field === qcLogSearchField.value),
    })).filter(log => log.changes.length > 0)
  }
  return logs
})
async function saveQC(silent = false) {
  if (!silent)
    isSaving.value = true
  _pendingSave = true
  try {
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

    // ── GENERIC FALLBACK SYNC: forward changes from new keys to fallback (old) keys ──
    // IMPORTANT: Clone to avoid mutating the reactive editForm directly,
    // which would re-trigger the deep watcher and create an infinite save loop.
    const edited = JSON.parse(JSON.stringify(editForm.value || {}))

    const syncFallbacks = (item: any) => {
      if (!item)
        return
      if (item.oldKey && item.oldKey !== 'new' && item.key && item.key in edited) {
        let val = edited[item.key]
        // Ensure dropdown arrays flatten into comma-separated strings for legacy fields
        // IMPORTANT: Skip joining for array fields like videos/images that must remain arrays
        if (Array.isArray(val) && !['engineVideo', 'exhaustSmokeVideo'].includes(item.key)) {
          val = val.join(', ')
        }

        if (JSON.stringify(val) !== JSON.stringify(edited[item.oldKey])) {
          edited[item.oldKey] = val === undefined ? undefined : JSON.parse(JSON.stringify(val))
        }
      }
      if (item.oldImageKey && item.oldImageKey !== 'new' && item.imageKey && item.imageKey in edited) {
        const val = edited[item.imageKey]
        if (JSON.stringify(val) !== JSON.stringify(edited[item.oldImageKey])) {
          edited[item.oldImageKey] = val === undefined ? undefined : JSON.parse(JSON.stringify(val))
        }
      }
      if (item.splitParts)
        item.splitParts.forEach(syncFallbacks)
      if (item.rightParts)
        item.rightParts.forEach(syncFallbacks)
      if (item.imageGroups)
        item.imageGroups.forEach(syncFallbacks)
      if (item.fourPanels)
        item.fourPanels.forEach(syncFallbacks)
      if (item.parts)
        item.parts.forEach(syncFallbacks)
    }

    exteriorSections.forEach((section) => {
      if (section.parts)
        section.parts.forEach(syncFallbacks)
      if (section.imageKeys) {
        section.imageKeys.forEach((entry: any) => {
          if (typeof entry !== 'string' && entry.old && entry.new && entry.new in edited) {
            const val = edited[entry.new]
            if (JSON.stringify(val) !== JSON.stringify(edited[entry.old])) {
              edited[entry.old] = val === undefined ? undefined : JSON.parse(JSON.stringify(val))
            }
          }
        })
      }
    })
    documentDetailFields.forEach(syncFallbacks)
    engineVideoKeys.forEach(syncFallbacks)

    const changedFields: Record<string, any> = {}
    const original = car.value || {}

    // Explicit array merge for Apron fallback
    if (Array.isArray(edited.lhsApronImages) || Array.isArray(edited.rhsApronImages)) {
      const combinedApron = []
      if (Array.isArray(edited.lhsApronImages))
        combinedApron.push(...edited.lhsApronImages)
      if (Array.isArray(edited.rhsApronImages))
        combinedApron.push(...edited.rhsApronImages)

      if (JSON.stringify(combinedApron) !== JSON.stringify(original.apronLhsRhs || [])) {
        edited.apronLhsRhs = combinedApron
      }
    }

    // Build the payload: only send fields that actually changed from the original car data
    // Build the payload: only send fields that actually changed from the original car data
    for (const key of Object.keys(edited)) {
      if (key === '_id' || key === 'id' || key === 'qcLogs' || key === 'logs' || key === 'qcLog')
        continue
      const oldStr = JSON.stringify(original[key])
      const newStr = JSON.stringify(edited[key])
      if (oldStr !== newStr) {
        changedFields[key] = edited[key]
      }
    }

    if (Object.keys(changedFields).length === 0) {
      isSaving.value = false
      return
    }

    // Ensure numeric fields are properly typed when present
    if ('cubicCapacity' in changedFields)
      changedFields.cubicCapacity = Number(changedFields.cubicCapacity) || null
    if ('odometerReadingInKms' in changedFields)
      changedFields.odometerReadingInKms = Number(changedFields.odometerReadingInKms) || null
    if ('ownerSerialNumber' in changedFields)
      changedFields.ownerSerialNumber = Number(changedFields.ownerSerialNumber) || null
    if ('priceDiscovery' in changedFields) {
      changedFields.priceDiscovery = Number(changedFields.priceDiscovery) || null
      changedFields.priceDiscoveryBy = currentUser?.userName || currentUser?.email || 'QC'
    }

    // the telecallingId or appointmentId is needed
    // The get API merges them. We send updates using the appointmentId as telecallingId for the update API fallback in server
    await $fetch('/api/leads/update', {
      method: 'PUT',
      retry: 1,
      timeout: 60000,
      body: {
        telecallingId: editForm.value.appointmentId || editForm.value._id,
        changedBy: currentUser?.userName || currentUser?.email || 'QC',
        ...changedFields,
      },
    })

    if (!silent) {
      toast.success('QC Report Saved Successfully')
      // Refetch to reset
      await fetchCarDetails(carId.value)
    }
    else {
      // Update the baseline so the diff doesn't re-send already-saved fields
      if (car.value && Object.keys(changedFields).length > 0) {
        _skipAutoSave = true
        _skipCarWatch = true // Prevent the car.value watcher from resetting editForm
        for (const k of Object.keys(changedFields)) {
          car.value[k] = JSON.parse(JSON.stringify(changedFields[k]))
        }
        nextTick(() => {
          _skipAutoSave = false
          _skipCarWatch = false
        })
      }
    }
  }
  catch (err: any) {
    if (!silent)
      toast.error(err?.data?.message || err?.message || 'Failed to save')
  }
  finally {
    // Keep _pendingSave active for 3s after save completes to absorb delayed SSE echoes
    setTimeout(() => { _pendingSave = false }, 3000)
    if (!silent)
      isSaving.value = false
  }
}

function getConditionStyle(val: string) {
  const lower = val.toLowerCase().trim()
  const successKeys = ['ok', 'good', 'normal', 'safe', 'satisfactory', 'clean', 'clear']
  const errorKeys = ['major', 'tear', 'missing', 'broken', 'damage', 'dent', 'rust', 'cracked']
  const warningKeys = ['scratch', 'minor', 'fade', 'worn', 'repaint', 'chipped']
  const infoKeys = ['repair', 'replace', 'changed', 'service', 'dry']

  if (successKeys.some(k => lower.includes(k)))
    return { bg: 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400', icon: 'i-lucide-check-circle', emoji: '🟢' }
  if (errorKeys.some(k => lower.includes(k)))
    return { bg: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400', icon: 'i-lucide-alert-triangle', emoji: '🔴' }
  if (warningKeys.some(k => lower.includes(k)))
    return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: 'i-lucide-info', emoji: '🟠' }
  if (infoKeys.some(k => lower.includes(k)))
    return { bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-400', icon: 'i-lucide-wrench', emoji: '🔵' }
  return { bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-400', icon: 'i-lucide-tag', emoji: '🔘' }
}

function getValuesArray(val: string | string[] | number | undefined | null) {
  let v: string[] = []
  if (Array.isArray(val))
    v = val.map(String)
  else if (typeof val === 'number' && !isNaN(val))
    v = [String(val)]
  else if (typeof val === 'string' && val)
    v = [val]
  return v.flatMap(s => typeof s === 'string' ? s.split(',') : [String(s)]).map(s => s.trim()).filter(Boolean)
}

function getDisplayValues(form: any, key: string, oldKey?: string) {
  const primary = getValuesArray(form[key])
  if (primary.length > 0)
    return primary
  if (oldKey) {
    const secondary = getValuesArray(form[oldKey])
    if (secondary.length > 0)
      return secondary
  }
  return []
}

function getSingleDisplayValue(form: any, key: string, oldKey?: string) {
  const val = form[key]
  if (val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0))
    return val
  if (oldKey) {
    const oldVal = form[oldKey]
    if (oldVal !== undefined && oldVal !== null && oldVal !== '' && (!Array.isArray(oldVal) || oldVal.length > 0))
      return oldVal
  }
  return ''
}

function formatDateMMDDYYYY(val: any) {
  if (!val)
    return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime()))
    return String(val)
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit', year: 'numeric' })
  const parts = formatter.formatToParts(d)
  const m = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  const y = parts.find(p => p.type === 'year')?.value
  return `${m}/${day}/${y}`
}

function formatDateYYYYMMDD(val: any) {
  if (!val)
    return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime()))
    return ''
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit', year: 'numeric' })
  const parts = formatter.formatToParts(d)
  const m = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  const y = parts.find(p => p.type === 'year')?.value
  return `${y}-${m}-${day}`
}

async function approveLead() {
  const now = new Date()
  const userCookie = useCookie('userData')
  const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

  editForm.value.approvalStatus = 'Approved'
  editForm.value.approvalDate = now.toISOString()
  editForm.value.approvalTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  editForm.value.approvedBy = currentUser?.userName || currentUser?.fullName || currentUser?.email || 'QC User'
  
  await saveQC()
  // Note: approveLead() without inline usually doesn't prompt for auction, 
  // but if needed we can trigger the modal here too.
  router.push(`/inspection/${carId.value}`)
}

const showQCModal = ref(false)
const showAttesterModal = ref(false)
const qcForm = ref({
  priceDiscovery: '',
  auctionMode: 'makeLiveNow',
  auctionDuration: 24,
  auctionStartTime: '',
  retailAssociate: '',
})

// ─── Pre-Approval Validation ───
interface ValidationWarning {
  field: string
  label: string
  type: 'error' | 'warning'
}

const approvalWarnings = computed<ValidationWarning[]>(() => {
  const warnings: ValidationWarning[] = []
  const data = editForm.value || car.value || {}

  // Helper to check emptiness
  const isEmpty = (val: any) => val === undefined || val === null || val === '' || (Array.isArray(val) && val.filter(Boolean).length === 0)

  // ── Critical fields that MUST exist ──
  const requiredFields: { key: string, label: string, type?: string }[] = [
    { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'variant', label: 'Variant' },
    { key: 'yearMonthOfManufacture', label: 'Year/Month of Manufacture' },
    { key: 'registrationNumber', label: 'Registration Number' },
    { key: 'registrationDate', label: 'Registration Date' },
    { key: 'registrationState', label: 'Registration State' },
    { key: 'registeredRto', label: 'Registered RTO' },
    { key: 'fuelType', label: 'Fuel Type' },
    { key: 'ownerSerialNumber', label: 'Owner Serial Number', type: 'number' },
    { key: 'odometerReadingInKms', label: 'Odometer Reading (KMs)', type: 'number' },
    { key: 'cubicCapacity', label: 'Cubic Capacity', type: 'number' },
    { key: 'city', label: 'City' },
  ]

  for (const f of requiredFields) {
    const val = data[f.key]
    if (f.type === 'number') {
      if (!val && val !== 0)
        warnings.push({ field: f.key, label: f.label, type: 'error' })
    }
    else {
      if (isEmpty(val))
        warnings.push({ field: f.key, label: f.label, type: 'error' })
    }
  }

  // `sendToAuctionApk` is no longer validated here. Auto-stamped on approval.

  // ── frontMain / frontMainImages — at least one image ──
  const frontImgs = data.frontMainImages || data.frontMain || []
  if (isEmpty(frontImgs)) {
    warnings.push({ field: 'frontMain', label: 'Front Main Image', type: 'error' })
  }

  // ── contactNumber from telecalling ──
  const contact = data.customerContactNumber || data.contactNumber || ''
  if (isEmpty(contact)) {
    warnings.push({ field: 'contactNumber', label: 'Contact Number (from Telecalling)', type: 'error' })
  }

  // Optional warnings (non-blocking but informational)
  if (isEmpty(data.roadTaxValidity))
    warnings.push({ field: 'roadTaxValidity', label: 'Road Tax Validity', type: 'warning' })
  if (isEmpty(data.taxValidTill))
    warnings.push({ field: 'taxValidTill', label: 'Tax Valid Till', type: 'warning' })
  if (isEmpty(data.transmissionTypeDropdownList))
    warnings.push({ field: 'transmissionTypeDropdownList', label: 'Transmission Type', type: 'warning' })

  return warnings
})

const hasBlockingWarnings = computed(() => approvalWarnings.value.some(w => w.type === 'error'))
const blockingWarnings = computed(() => approvalWarnings.value.filter(w => w.type === 'error'))
const softWarnings = computed(() => approvalWarnings.value.filter(w => w.type === 'warning'))

function findTabForField(fieldKey: string) {
  const detailsFields = ['make', 'model', 'variant', 'yearMonthOfManufacture', 'registrationNumber', 'registrationDate', 'registrationState', 'registeredRto', 'fuelType', 'ownerSerialNumber', 'odometerReadingInKms', 'cubicCapacity', 'city', 'sendToAuctionApk', 'contactNumber', 'roadTaxValidity', 'taxValidTill']
  if (detailsFields.includes(fieldKey))
    return 'details'

  let foundDoc = false
  const checkDoc = (items: any[]) => items.forEach((i) => {
    if (i.key === fieldKey || i.imageKey === fieldKey)
      foundDoc = true
    if (i.splitParts)
      checkDoc(i.splitParts)
    if (i.rightParts)
      checkDoc(i.rightParts)
    if (i.fourPanels)
      checkDoc(i.fourPanels)
    if (i.parts)
      checkDoc(i.parts)
  })
  checkDoc(documentDetailFields)
  if (foundDoc)
    return 'details'

  for (const g of exteriorSections) {
    let found = false
    const cg = (items: any[]) => items.forEach((i) => {
      if (i.key === fieldKey || i.imageKey === fieldKey)
        found = true
      if (i.splitParts)
        cg(i.splitParts)
      if (i.rightParts)
        cg(i.rightParts)
      if (i.parts)
        cg(i.parts)
      if (i.imageGroups)
        cg(i.imageGroups)
      if (i.fourPanels)
        cg(i.fourPanels)
    })
    if (g.parts)
      cg(g.parts)
    if (g.imageKeys) {
      for (const req of g.imageKeys as any[]) {
        if (typeof req === 'string' && req === fieldKey)
          found = true
        else if (typeof req !== 'string' && req.new === fieldKey)
          found = true
      }
    }
    if (found) {
      if (g.title === 'Front')
        return 'front'
      if (g.title === 'Left (LHS)' || g.title === 'Left')
        return 'left'
      if (g.title === 'Rear')
        return 'rear'
      if (g.title === 'Right (RHS)' || g.title === 'Right')
        return 'right'
      if (g.title === 'Engine Bay')
        return 'engine-bay'
      if (g.title === 'Electricals')
        return 'electricals'
      if (g.title === 'Interior')
        return 'interior'
      if (g.title === 'Steering, Suspension & Brakes' || g.title === 'Steering, Suspension, Brakes')
        return 'steering-suspension-brakes'
    }
  }
  return 'details'
}

function scrollToField(fieldKey: string) {
  const targetTab = findTabForField(fieldKey)
  if (activeTab.value !== targetTab) {
    setTab(targetTab)
  }
  showQCModal.value = false

  setTimeout(() => {
    let el = document.getElementById(`field-${fieldKey}`)
    if (!el && fieldKey === 'frontMain')
      el = document.getElementById('field-frontMainImages')
    if (!el && fieldKey === 'sendToAuctionApk')
      el = document.getElementById('field-sendToAuctionApk')

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-4', 'ring-red-500', 'ring-offset-2', 'ring-offset-background', '!border-red-500', 'shadow-[0_0_20px_rgba(239,68,68,0.4)]', 'scale-[1.02]', 'z-50', 'transition-all', 'duration-500')
      setTimeout(() => {
        el?.classList.remove('ring-4', 'ring-red-500', 'ring-offset-2', 'ring-offset-background', '!border-red-500', 'shadow-[0_0_20px_rgba(239,68,68,0.4)]', 'scale-[1.02]', 'z-50')
      }, 5000)
    }
  }, 250)
}

function openQCModal() {
  qcForm.value.priceDiscovery = editForm.value.priceDiscovery || car.value?.priceDiscovery || ''
  qcForm.value.retailAssociate = editForm.value.retailAssociate || car.value?.retailAssociate || ''
  showQCModal.value = true
}

async function confirmQCApproval() {
  // ── Block if critical fields are missing ──
  if (hasBlockingWarnings.value) {
    toast.error(`Cannot approve: ${blockingWarnings.value.length} required field(s) are missing. Please fix them first.`)
    return
  }
  if (!qcForm.value.priceDiscovery) {
    toast.error('Price Discovery is required')
    return
  }
  if (qcForm.value.auctionMode === 'scheduledForLater' && !qcForm.value.auctionStartTime) {
    toast.error('Auction Start Time is required for scheduled auction')
    return
  }

  editForm.value.priceDiscovery = qcForm.value.priceDiscovery
  editForm.value.retailAssociate = qcForm.value.retailAssociate

  const now = new Date()
  const userCookie = useCookie('userData')
  const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}
  editForm.value.approvalDate = now.toISOString()
  editForm.value.approvalTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  editForm.value.approvedBy = currentUser?.userName || currentUser?.fullName || currentUser?.email || 'QC User'

  // ── Compute auction lifecycle fields ──
  let startTimeDate: Date
  if (qcForm.value.auctionMode === 'makeLiveNow') {
    startTimeDate = new Date()
  }
  else {
    startTimeDate = new Date(qcForm.value.auctionStartTime)
  }

  const durationMs = Number(qcForm.value.auctionDuration) * 60 * 60 * 1000
  const endTimeDate = new Date(startTimeDate.getTime() + durationMs)
  const auctionStatus = qcForm.value.auctionMode === 'makeLiveNow' ? 'live' : 'upcoming'

  editForm.value.auctionStartTime = startTimeDate.toISOString()
  editForm.value.auctionDuration = Number(qcForm.value.auctionDuration)
  editForm.value.auctionEndTime = endTimeDate.toISOString()
  editForm.value.auctionStatus = auctionStatus
  editForm.value.upcomingUntil = startTimeDate.toISOString()
  editForm.value.liveAt = startTimeDate.toISOString()

  // Auto-stamp the send API timestamp
  editForm.value.sendToAuctionApk = new Date().toISOString()

  // ── Force Sync all 'new' to 'old' keys for legacy compatibility during Approval ──
  const forceSync = (item: any) => {
    if (!item)
      return
    if (item.oldKey && item.oldKey !== 'new' && item.key) {
      let val = editForm.value[item.key] ?? car.value?.[item.key]
      if (val !== undefined && val !== null) {
        if (Array.isArray(val) && !['engineVideo', 'exhaustSmokeVideo'].includes(item.key)) {
          val = val.join(', ')
        }
        if (JSON.stringify(val) !== JSON.stringify(car.value?.[item.oldKey])) {
          editForm.value[item.oldKey] = JSON.parse(JSON.stringify(val))
        }
      }
    }
    if (item.oldImageKey && item.oldImageKey !== 'new' && item.imageKey) {
      const val = editForm.value[item.imageKey] ?? car.value?.[item.imageKey]
      if (val !== undefined && val !== null && JSON.stringify(val) !== JSON.stringify(car.value?.[item.oldImageKey])) {
        editForm.value[item.oldImageKey] = JSON.parse(JSON.stringify(val))
      }
    }
    if (item.splitParts)
      item.splitParts.forEach(forceSync)
    if (item.rightParts)
      item.rightParts.forEach(forceSync)
    if (item.imageGroups)
      item.imageGroups.forEach(forceSync)
    if (item.fourPanels)
      item.fourPanels.forEach(forceSync)
    if (item.parts)
      item.parts.forEach(forceSync)
  }

  exteriorSections.forEach((section) => {
    if (section.parts)
      section.parts.forEach(forceSync)
    if (section.imageKeys) {
      section.imageKeys.forEach((entry: any) => {
        if (typeof entry !== 'string' && entry.old && entry.new) {
          const val = editForm.value[entry.new] ?? car.value?.[entry.new]
          if (val !== undefined && val !== null && JSON.stringify(val) !== JSON.stringify(car.value?.[entry.old])) {
            editForm.value[entry.old] = JSON.parse(JSON.stringify(val))
          }
        }
      })
    }
  })
  if (typeof documentDetailFields !== 'undefined')
    documentDetailFields.forEach(forceSync)
  if (typeof engineVideoKeys !== 'undefined')
    engineVideoKeys.forEach(forceSync)

  // Custom manual fallback for apron which spans lhs and rhs
  const lhsApron = editForm.value.lhsApronImages ?? car.value?.lhsApronImages
  const rhsApron = editForm.value.rhsApronImages ?? car.value?.rhsApronImages
  if (Array.isArray(lhsApron) || Array.isArray(rhsApron)) {
    const combinedApron = []
    if (Array.isArray(lhsApron))
      combinedApron.push(...lhsApron)
    if (Array.isArray(rhsApron))
      combinedApron.push(...rhsApron)
    if (JSON.stringify(combinedApron) !== JSON.stringify(car.value?.apronLhsRhs || [])) {
      editForm.value.apronLhsRhs = combinedApron
    }
  }

  // ── Strip +91 from contactNumber for the cars collection ──
  let rawContact = editForm.value.customerContactNumber || editForm.value.contactNumber || ''
  if (typeof rawContact === 'string') {
    rawContact = rawContact.replace(/^\+91\s*/, '').trim()
  }
  editForm.value.contactNumber = rawContact

  const loadingToast = toast.loading('Scheduling auction and completing QC...')
  try {
    // 1. External Integration - Create/schedule auction
    await scheduleAuctionFromModal()

    // 2. Local State - Only set to 'Approved' IF auction was successful
    editForm.value.approvalStatus = 'Approved'

    // 3. Database DB Save - This will hit /api/leads/update which updates BOTH cars & telecalling collections
    await saveQC(true)

    showQCModal.value = false
    toast.dismiss(loadingToast)
    toast.success('Vehicle successfully marked as QC Approved and Auction Scheduled!')
    router.push(`/inspection/${carId.value}`)
  }
  catch (err: any) {
    toast.dismiss(loadingToast)
    toast.error(err?.message || 'Failed to approve or schedule.')
  }
}

const showRejectModal = ref(false)
const rejectReason = ref('')

function openRejectModal() {
  rejectReason.value = editForm.value.rejectionReason || car.value?.rejectionReason || ''
  showRejectModal.value = true
}

async function confirmReject() {
  if (!rejectReason.value.trim()) {
    toast.error('Rejection reason is required')
    return
  }

  editForm.value.rejectionReason = rejectReason.value
  editForm.value.approvalStatus = 'Rejected'

  const loadingToast = toast.loading('Rejecting inspection...')
  try {
    await saveQC(true)
    showRejectModal.value = false
    toast.dismiss(loadingToast)
    toast.success('Vehicle successfully marked as Rejected!')
    router.push('/leads/rejected')
  }
  catch (err: any) {
    toast.dismiss(loadingToast)
    toast.error(err?.message || 'Failed to reject.')
  }
}

async function revertToUnderReview() {
  const loadingToast = toast.loading('Reverting to Under Review...')
  try {
    editForm.value.approvalStatus = 'Under Review'
    await saveQC(true)
    toast.dismiss(loadingToast)
    toast.success('Status successfully reverted back to Under Review!')
    router.push(`/qc/${carId.value}/${activeTab.value}`)
  }
  catch (err: any) {
    toast.dismiss(loadingToast)
    toast.error(err?.message || 'Failed to revert status.')
  }
}

const UPLOAD_BASE = 'https://ob-dealerapp-kong.onrender.com/api/otobix/car'
const KONG_TOKEN = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

const isGeneratingPdf = ref(false)

function _conditionPdfCss(val: any) {
  if (val === null || val === undefined || val === '')
    return ''
  const v = String(val).toLowerCase()
  if (v.includes('not applicable'))
    return 'bg-[#fde047] text-[#000000]'
  if (v === 'okay' || v === 'working' || v === 'effective' || v === 'no mismatch' || v === 'no blow by' || v === 'yes')
    return 'bg-[#6ee7b7] text-[#000000]'
  if (v.includes('scratched') || v.includes('damaged') || v.includes('broken') || v.includes('rusted') || v.includes('weak') || v.includes('torn') || v.includes('worn') || v.includes('missing') || v.includes('bad') || v.includes('abnormal'))
    return 'bg-[#fca5a5] text-[#000000]'
  if (v.includes('repainted') || v.includes('repaired') || v.includes('changed') || v.includes('low') || v.includes('dirty') || v.includes('leaking') || v.includes('dented'))
    return 'bg-[#fecdd3] text-[#000000]'
  if (v.includes('hazy') || v.includes('fade'))
    return 'bg-[#fed7aa] text-[#000000]'
  return ''
}

function formatPdfValue(val: any): string {
  if (val === null || val === undefined || val === '')
    return '—'
  if (Array.isArray(val))
    return val.join(', ')
  const str = String(val)
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed))
      return parsed.join(', ')
  }
  catch (e) {}
  return str
}

function getPdfFields(partsArray: any[]) {
  if (!partsArray)
    return []
  return partsArray.flatMap((p: any) => p.splitParts ? p.splitParts : [p]).filter((p: any) => !p.isVideoBox && p.label && !p.isImageOnly)
}

async function downloadPDF(action: 'save' | 'blob' = 'save') {
  isGeneratingPdf.value = true
  await nextTick()
  await new Promise(r => setTimeout(r, props.headlessPdf ? 1000 : 200)) // give DOM time to append images structurally

  const element = document.getElementById('pdf-container')
  if (!element) {
    isGeneratingPdf.value = false
    toast.error('Template missing!')
    return
  }

  const loadingToast = toast.loading('Generating PDF Report... Please wait.')

  // MUST INTERCEPT COMPUTED STYLES: 
  // Tailwind v4 uses OKLCH natively, which immediately crashes html2canvas 1.4.1.
  // CRITICAL: Native browser functions MUST be called with their original `this` context
  // (window for getComputedStyle, CSSStyleDeclaration for getPropertyValue) or they throw
  // "Illegal invocation". We use .call() and .bind() to preserve these bindings.
  const originalGetComputedStyle = window.getComputedStyle
  window.getComputedStyle = function (el: Element, pseudoElt?: string | null) {
    const css = originalGetComputedStyle.call(window, el, pseudoElt)
    return new Proxy(css, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          const boundFn = target.getPropertyValue.bind(target)
          return function (key: string) {
            const val = boundFn(key)
            if (typeof val === 'string' && val.includes('oklch'))
              return 'rgb(128, 128, 128)'
            return val
          }
        }
        const raw = (target as any)[prop]
        // Bind native methods to their target to prevent Illegal invocation
        if (typeof raw === 'function') {
          return raw.bind(target)
        }
        if (typeof raw === 'string' && raw.includes('oklch')) {
          return 'rgb(128, 128, 128)'
        }
        return raw
      },
    })
  }

  try {
    if (typeof window !== 'undefined' && !(window as any).html2pdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    const opt = {
      margin: [10, 0, 10, 0],
      filename: `Inspection_Report_${carId.value}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }

    if (action === 'blob') {
      const pdfBlob = await (window as any).html2pdf().set(opt).from(element).output('blob')
      toast.dismiss(loadingToast)
      return URL.createObjectURL(pdfBlob)
    }

    await (window as any).html2pdf().set(opt).from(element).save()
    toast.dismiss(loadingToast)
    if (!props.headlessPdf)
      toast.success('PDF Downloaded successfully!')
  }
  catch (err) {
    console.error('PDF Generation Error: ', err)
    toast.dismiss(loadingToast)
    toast.error('Failed to generate PDF')
  }
  finally {
    isGeneratingPdf.value = false
    window.getComputedStyle = originalGetComputedStyle
  }
}

watch(car, async (newVal) => {
  if (newVal && Object.keys(newVal).length > 0 && props.headlessPdf) {
    const url = await downloadPDF('blob')
    emit('pdfBlobReady', url)
  }
}, { deep: true, immediate: true })

async function scheduleAuctionFromModal() {
  let startTimeDate
  if (qcForm.value.auctionMode === 'makeLiveNow') {
    startTimeDate = new Date()
  }
  else {
    startTimeDate = new Date(qcForm.value.auctionStartTime)
  }

  const durationMs = Number(qcForm.value.auctionDuration) * 60 * 60 * 1000
  const endTimeDate = new Date(startTimeDate.getTime() + durationMs)

  const payload = {
    carId: car.value?.carObjectId, // Accurately identify the mongo document in the remote 'cars' collection
    auctionStartTime: startTimeDate.toISOString().replace('Z', '+00:00'),
    auctionDuration: Number(qcForm.value.auctionDuration),
    auctionEndTime: endTimeDate.toISOString().replace('Z', '+00:00'),
    auctionMode: qcForm.value.auctionMode,
  }

  // Use native browser fetch instead of $fetch to bypass Nuxt's internal interceptors
  // which might override the Authorization header with the app's CRM user token
  const response = await fetch('https://ob-dealerapp-kong.onrender.com/api/otobix/schedule-auction', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KONG_TOKEN}`,
      'token': KONG_TOKEN,
    },
  })

  if (!response.ok) {
    let errMsg = `Failed to schedule auction: ${response.status}`
    try {
      const data = await response.json()
      if (data && data.message)
        errMsg = data.message
    }
    catch {
      // ignore parsing error
    }
    throw new Error(errMsg)
  }
}

async function deleteCloudinaryFile(url: string) {
  if (!url)
    return
  const isVideo = url.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i)
  const endpoint = isVideo ? `${UPLOAD_BASE}/delete-video-from-cloudinary` : `${UPLOAD_BASE}/delete-image-from-cloudinary`

  try {
    await $fetch(endpoint, {
      method: 'DELETE',
      body: { publicId: url },
      headers: { Authorization: `Bearer ${KONG_TOKEN}`, token: KONG_TOKEN },
    })
  }
  catch (e) {
    console.error('Delete failed:', e)
  }
}

async function uploadCloudinaryFile(files: File[], progressKey?: string) {
  if (files.length === 0)
    return []

  const isVideo = files[0]!.type.startsWith('video/') || !!files[0]!.name.match(/\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i)
  const endpoint = isVideo ? `${UPLOAD_BASE}/upload-car-video-to-cloudinary` : `${UPLOAD_BASE}/upload-car-images-to-cloudinary`

  const formData = new FormData()
  formData.append('appointmentId', String(car.value?.appointmentId || ''))

  if (isVideo) {
    formData.append('video', files[0]!)
  }
  else {
    for (const file of files) {
      formData.append('imagesList', file)
    }
  }

  try {
    // Use XMLHttpRequest for real upload progress tracking
    const res: any = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', endpoint)
      xhr.setRequestHeader('token', KONG_TOKEN)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && progressKey) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(progressKey, pct, 'uploading')
        }
      }

      xhr.upload.onload = () => {
        if (progressKey)
          setUploadProgress(progressKey, 100, 'processing')
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data)
        }
        catch {
          reject(new Error('Invalid JSON response'))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.ontimeout = () => reject(new Error('Upload timed out'))
      xhr.timeout = 300000 // 5 min timeout for large videos
      xhr.send(formData)
    })

    // Check server-side success flag first
    if (res?.success === false) {
      throw new Error(res.message || 'Server rejected the upload')
    }

    // Parse defensive multi-format responses (only non-empty arrays)
    if (res?.cloudinaryUrls && Array.isArray(res.cloudinaryUrls) && res.cloudinaryUrls.length > 0)
      return res.cloudinaryUrls
    if (res?.cloudinaryUrl)
      return [res.cloudinaryUrl]
    if (res?.cloudinaryVideoUrl)
      return [res.cloudinaryVideoUrl]
    if (Array.isArray(res) && res.length > 0)
      return res
    if (res?.data && Array.isArray(res.data) && res.data.length > 0)
      return res.data
    if (res?.data?.url)
      return [res.data.url]
    if (res?.data?.videoUrl)
      return [res.data.videoUrl]
    if (res?.data?.imagesList && res.data.imagesList.length > 0)
      return res.data.imagesList
    if (res?.images && Array.isArray(res.images) && res.images.length > 0)
      return res.images
    if (res?.urls && Array.isArray(res.urls) && res.urls.length > 0)
      return res.urls
    if (res?.url)
      return [res.url]
    if (res?.videoUrl)
      return [res.videoUrl]
    if (res?.imagesList && res.imagesList.length > 0)
      return res.imagesList
    // Try to extract a URL from the message field (video upload API embeds it there)
    if (res?.message && typeof res.message === 'string') {
      const urlMatch = res.message.match(/(https?:\/\/[^\s"',]+)/)
      if (urlMatch)
        return [urlMatch[1]]
    }

    // If the upload succeeded but no URL found anywhere, try to deep-scan all response values
    if (res && typeof res === 'object') {
      for (const val of Object.values(res)) {
        if (typeof val === 'string' && val.startsWith('http') && val.includes('cloudinary'))
          return [val]
      }
    }

    // Log full response for debugging if we reach here with success:true but no URL extracted
    if (res?.success === true) {
      console.warn('[UPLOAD] Success but no URL found in response:', JSON.stringify(res))
    }

    return []
  }
  catch (e: any) {
    console.error('Upload failed:', e)
    if (progressKey)
      setUploadProgress(progressKey, 0, 'error')
    throw e
  }
}

async function removeImage(key: string, idx: number, oldKey?: string, imageIndex?: number) {
  toast.warning('Are you sure you want to delete this image? This action cannot be undone.', {
    action: {
      label: 'Delete',
      onClick: async () => {
        let urlToDelete = null
        if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
          const actualIndex = imageIndex !== undefined ? imageIndex : idx
          urlToDelete = editForm.value[key][actualIndex]
          const newArr = [...editForm.value[key]]
          if (imageIndex !== undefined)
            newArr[actualIndex] = ''
          else newArr.splice(idx, 1)
          editForm.value[key] = newArr
        }
        else if (oldKey && Array.isArray(editForm.value[oldKey])) {
          const actualIndex = imageIndex !== undefined ? imageIndex : idx
          urlToDelete = editForm.value[oldKey][actualIndex]
          const newArr = [...editForm.value[oldKey]]
          if (imageIndex !== undefined)
            newArr[actualIndex] = ''
          else newArr.splice(idx, 1)
          editForm.value[oldKey] = newArr
          editForm.value[key] = [...newArr]
        }

        if (urlToDelete) {
          await deleteCloudinaryFile(urlToDelete)
        }
        await saveQC(true)
      },
    },
  })
}

async function addImage(key: string, imageIndex?: number) {
  const progressKey = imageIndex !== undefined ? `${key}__${imageIndex}` : key
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = (imageIndex === undefined)
  input.accept = 'image/*,video/*'
  input.onchange = async (e: any) => {
    isSaving.value = true
    setUploadProgress(progressKey, 0, 'uploading')
    try {
      const files = Array.from(e.target.files) as File[]
      const urls = await uploadCloudinaryFile(files, progressKey)
      setUploadProgress(progressKey, 100, 'done')
      if (urls.length > 0) {
        const currentArr = Array.isArray(editForm.value[key]) ? editForm.value[key] : []
        if (imageIndex !== undefined) {
          const newArr = [...currentArr]
          while (newArr.length <= imageIndex) newArr.push('')
          newArr[imageIndex] = urls[0]
          editForm.value[key] = newArr
        }
        else {
          editForm.value[key] = [...currentArr, ...urls]
        }
        await saveQC(true)
        toast.success('Uploaded successfully')
      }
      else {
        toast.error('Upload rejected: server returned no file URL.')
      }
    }
    catch (e: any) {
      toast.error(`Upload error: ${e.data?.message || e.message || 'Unknown error'}`)
    }
    finally {
      setTimeout(() => clearUploadProgress(progressKey), 800)
      isSaving.value = false
    }
  }
  input.click()
}

async function replaceImage(key: string, idx: number, oldKey?: string, imageIndex?: number) {
  const progressKey = imageIndex !== undefined ? `${key}__${imageIndex}` : `${key}__${idx}`
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file)
      return

    let urlToDelete = null
    let usingOldKey = false
    const actualIndex = imageIndex !== undefined ? imageIndex : idx
    if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
      urlToDelete = editForm.value[key][actualIndex]
    }
    else if (oldKey && Array.isArray(editForm.value[oldKey])) {
      urlToDelete = editForm.value[oldKey][actualIndex]
      usingOldKey = true
    }

    isSaving.value = true
    setUploadProgress(progressKey, 0, 'uploading')
    try {
      const urls = await uploadCloudinaryFile([file], progressKey)
      setUploadProgress(progressKey, 100, 'done')
      if (urls.length > 0) {
        const newUrl = urls[0]
        if (!usingOldKey && Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
          const newArr = [...editForm.value[key]]
          newArr[actualIndex] = newUrl
          editForm.value[key] = newArr
        }
        else if (usingOldKey && oldKey && Array.isArray(editForm.value[oldKey])) {
          const newArr = [...editForm.value[oldKey]]
          newArr[actualIndex] = newUrl
          editForm.value[oldKey] = newArr
          editForm.value[key] = [...newArr]
        }
        else {
          // No pre-existing array — create one with the new URL
          editForm.value[key] = [newUrl]
        }

        if (urlToDelete) {
          await deleteCloudinaryFile(urlToDelete)
        }
        await saveQC(true)
        toast.success('Replaced successfully')
      }
      else {
        toast.error('Upload rejected: server returned no file URL.')
      }
    }
    catch (e: any) {
      toast.error(`Upload error: ${e.data?.message || e.message || 'Unknown error'}`)
    }
    finally {
      setTimeout(() => clearUploadProgress(progressKey), 800)
      isSaving.value = false
    }
  }
  input.click()
}

const tabs = [
  { id: 'details', label: 'Doc & Reg Details', icon: 'i-lucide-file-text' },
  { id: 'front', label: 'Front', icon: 'i-lucide-arrow-up' },
  { id: 'left', label: 'Left', icon: 'i-lucide-arrow-left' },
  { id: 'rear', label: 'Rear', icon: 'i-lucide-arrow-down' },
  { id: 'right', label: 'Right', icon: 'i-lucide-arrow-right' },
  { id: 'engine-bay', label: 'Engine Bay', icon: 'i-lucide-cog' },
  { id: 'electricals', label: 'Electricals', icon: 'i-lucide-zap' },
  { id: 'interior', label: 'Interior', icon: 'i-lucide-armchair' },
  { id: 'steering-suspension-brakes', label: 'Steering, Suspension, Brakes', icon: 'i-lucide-disc' },
  { id: 'qc-logs', label: 'QC Audit Logs', icon: 'i-lucide-history' },
]

// Route-driven tab: read from URL param, default to 'details'
const activeTab = computed(() => {
  const tab = route.params.tab as string
  if (tab && tabs.some(t => t.id === tab))
    return tab
  return 'details'
})

watchEffect(() => {
  const currentTab = tabs.find(t => t.id === activeTab.value)
  if (currentTab && !props.headlessPdf) {
    setHeader({
      title: props.readonly ? `Inspection: ${carId.value} / ${currentTab.label}` : `Quality Control: ${carId.value} / ${currentTab.label}`,
      icon: currentTab.icon || 'i-lucide-scan-eye',
      showBackButton: true,
    })
  }
})

function setTab(tabId: string) {
  const basePath = props.readonly ? '/inspection' : '/qc'
  router.push(`${basePath}/${carId.value}/${tabId}`)
}

// ─── Auto-Scroll on Tab Navigation ───
watch(activeTab, () => {
  if (import.meta.client) {
    // Small delay to ensure the DOM unmount/remount paints the new activeTab first
    setTimeout(() => {
      const el = document.getElementById('app-main-content-scroll')
      if (el)
        el.scrollTop = 0
      window.scrollTo({ top: 0, behavior: 'instant' })
    }, 10)
  }
})

// ─── Helpers ───
function _conditionColor(val: string) {
  if (!val)
    return 'bg-muted text-muted-foreground'
  const v = val.toLowerCase()
  if (v === 'okay' || v === 'working' || v === 'effective' || v === 'no mismatch' || v === 'no blow by')
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  if (v.includes('scratched') && !v.includes('dented') && !v.includes('damaged'))
    return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
  if (v.includes('repainted') || v.includes('repaired') || v.includes('changed'))
    return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20'
  if (v.includes('damaged') || v.includes('broken') || v.includes('rusted') || v.includes('weak'))
    return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
  if (v.includes('not applicable'))
    return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
  return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
}

function downloadImageFile(url: string, label: string) {
  if (!url)
    return
  const isCloudinary = url.includes('res.cloudinary.com')
  const downloadUrl = isCloudinary ? url.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(label).replace(/%20/g, '_')}/`) : url

  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = `${label || 'image'}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
function formatDate(d: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getImages(obj: Record<string, any> | null, key: string, fallbackKey?: string, imageIndex?: number): string[] {
  let val = obj?.[key]
  // If new key is empty, try fallback (old) key
  if ((!val || (Array.isArray(val) && val.length === 0)) && fallbackKey && fallbackKey !== 'new')
    val = obj?.[fallbackKey]
  if (!val)
    return []
  if (Array.isArray(val)) {
    if (imageIndex !== undefined) {
      const u = val[imageIndex]
      if (typeof u === 'string' && u.trim() !== '') {
        return [u.startsWith('http') ? u : `https://res.cloudinary.com/dwunzqigc/image/upload/Otobix%20Auction%20App/Car%20Images/${car.value?.appointmentId}/${u}`]
      }
      return []
    }
    return val.filter((u: string) => u && typeof u === 'string' && u.trim() !== '').map((u: string) => u.startsWith('http') ? u : `https://res.cloudinary.com/dwunzqigc/image/upload/Otobix%20Auction%20App/Car%20Images/${car.value?.appointmentId}/${u}`)
  }
  if (typeof val === 'string' && val.startsWith('http'))
    return [val]
  return []
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/Lhs/g, 'LHS')
    .replace(/Rhs/g, 'RHS')
    .replace(/Orvm/g, 'ORVM')
    .replace(/Images$/, '')
    .replace(/Dropdown List$/, '')
    .trim()
}

// ─── Section data builders ───
const engineParts = [
  { key: 'engineDropdownList', oldKey: 'engine', imageKey: 'engineBayImages', oldImageKey: 'engineBay', label: 'Engine', dropdownName: 'Engine' },
  { key: 'engineVideosBox', label: 'Engine Videos', isVideoBox: true, hasNoImages: true },
  { key: 'split_1', hasNoImages: true, splitParts: [{ key: 'commentsOnEngineDropdownList', oldKey: 'commentsOnEngine', label: 'Comment on Engine', dropdownName: 'Comments On Engine' }, { key: 'engineOilLevelDipstickDropdownList', oldKey: 'engineOilLevelDipstick', label: 'Engine Oil Level Dipstick', dropdownName: 'Engine Oil Level Dipstick' }] },
  { key: 'split_2', hasNoImages: true, splitParts: [{ key: 'engineOilDropdownList', oldKey: 'engineOil', label: 'Engine Oil', dropdownName: 'Engine Oil' }, { key: 'commentsOnEngineOilDropdownList', oldKey: 'commentsOnEngineOil', label: 'Comment on Engine Oil', dropdownName: 'Comments On Engine Oil' }] },
  { key: 'split_3', hasNoImages: true, splitParts: [{ key: 'enginePermisableBlowByDropdownList', oldKey: 'enginePermisableBlowBy', label: 'Engine Permisable Blowby', dropdownName: 'Engine Permisable Blow By' }, { key: 'coolantDropdownList', oldKey: 'coolant', label: 'Coolant', dropdownName: 'Coolant' }] },
  { key: 'cowlTopDropdownList', imageKey: 'cowlTopImages', label: 'Cowl Top', dropdownName: 'Cowl Top' },
  { key: 'firewallDropdownList', imageKey: 'firewallImages', label: 'Firewall', dropdownName: 'Firewall' },
  { key: 'lhsApronDropdownList', oldKey: 'lhsApron', imageKey: 'lhsApronImages', oldImageKey: 'apronLhsRhs', label: 'LHS Apron', dropdownName: 'LHS Apron' },
  { key: 'rhsApronDropdownList', oldKey: 'rhsApron', imageKey: 'rhsApronImages', oldImageKey: 'apronLhsRhs', label: 'RHS Apron', dropdownName: 'RHS Apron' },
  { key: 'batteryDropdownList', oldKey: 'battery', imageKey: 'batteryImages', oldImageKey: 'batteryImages', label: 'Battery', dropdownName: 'Battery' },
  { key: 'split_4', hasNoImages: true, splitParts: [{ key: 'abs', label: 'ABS', dropdownName: 'ABS' }, { key: 'upperCrossMemberDropdownList', oldKey: 'upperCrossMember', label: 'Upper Cross Member', dropdownName: 'Upper Cross Member' }] },
  { key: 'split_5', hasNoImages: true, splitParts: [{ key: 'lhsSideMemberDropdownList', label: 'LHS Side Member', dropdownName: 'LHS Side Member' }, { key: 'rhsSideMemberDropdownList', label: 'RHS Side Member', dropdownName: 'RHS Side Member' }] },
  { key: 'split_6', hasNoImages: true, splitParts: [{ key: 'engineMountDropdownList', oldKey: 'engineMount', label: 'Engine Mount', dropdownName: 'Engine Mount' }, { key: 'headlightSupportDropdownList', oldKey: 'headlightSupport', label: 'Headlamp Support', dropdownName: 'Headlight Support' }] },
  { key: 'split_7', hasNoImages: true, splitParts: [{ key: 'radiatorSupportDropdownList', oldKey: 'radiatorSupport', label: 'Radiator Support', dropdownName: 'Radiator Support' }, { key: 'commentsOnRadiatorDropdownList', oldKey: 'commentsOnRadiator', label: 'Comment on Radiator', dropdownName: 'Comments On Radiator' }] },
  { key: 'split_8', hasNoImages: true, splitParts: [{ key: 'lowerCrossMemberDropdownList', oldKey: 'lowerCrossMember', label: 'Lower Cross Member', dropdownName: 'Lower Cross Member' }, { key: 'exhaustSmokeDropdownList', oldKey: 'exhaustSmoke', label: 'Exhaust Smoke', dropdownName: 'Exhaust Smoke' }] },
  { key: 'split_9', hasNoImages: true, splitParts: [{ key: 'commentsOnTowingDropdownList', oldKey: 'commentsOnTowing', label: 'Comment on Towing', dropdownName: 'Comments On Towing' }, { key: 'commentsOnOthersDropdownList', oldKey: 'commentsOnOthers', label: 'Comment on Others', dropdownName: 'Comments On Others' }] },
]

const electricalParts = [
  { key: 'clusterMeterGroup', imageKey: 'meterConsoleWithEngineOnImages', oldImageKey: 'meterConsoleWithEngineOn', label: 'Cluster Meter', splitParts: [
    { key: 'commentsOnClusterMeterDropdownList', label: 'Cluster Meter', dropdownName: 'Comments on Cluster Meter' },
    { key: 'odometerReadingBeforeTestDrive', label: 'Odometer Reading', dropdownName: 'Odometer Reading', inputType: 'number' },
  ] },
  { key: 'split_e1', hasNoImages: true, splitParts: [
    { key: 'fuelLevel', oldKey: 'fuelLevel', label: 'Fuel Level', dropdownName: 'Fuel Level' },
    { key: 'irvm', label: 'IRVM', dropdownName: 'IRVM' },
  ] },
  { key: 'split_e2', hasNoImages: true, splitParts: [
    { key: 'dashboardDropdownList', label: 'Dashboard', dropdownName: 'Dashboard' },
    { key: 'infotainmentSystemDropdownList', oldKey: 'stereo', label: 'Infotainment System', dropdownName: 'Infotainment System' },
  ] },
  { key: 'split_e3', hasNoImages: true, splitParts: [
    { key: 'inbuiltSpeaker', oldKey: 'inbuiltSpeaker', label: 'Inbuilt Speaker', dropdownName: 'Inbuilt Speaker' },
    { key: 'externalSpeaker', oldKey: 'externalSpeaker', label: 'External Speaker', dropdownName: 'External Speaker' },
  ] },
  { key: 'split_e4', hasNoImages: true, splitParts: [
    { key: 'steeringMountedMediaControls', oldKey: 'steeringMountedAudioControl', label: 'Steering Audio Controls', dropdownName: 'Steering Mounted Media Controls' },
    { key: 'steeringMountedSystemControls', oldKey: 'steeringMountedAudioControl', label: 'Steering System Controls', dropdownName: 'Steering Mounted System Controls' },
  ] },

  { key: 'split_e5', hasNoImages: true, splitParts: [
    { key: 'acTypeDropdownList', oldKey: 'airConditioningManual', label: 'AC Type', dropdownName: 'A/C Type' },
    { key: 'acCoolingDropdownList', oldKey: 'airConditioningClimateControl', label: 'AC Cooling', dropdownName: 'A/C Cooling' },
  ] },
  { key: 'commentsOnAc', imageKey: 'acImages', label: 'Comment on AC', dropdownName: 'Comments On A/C' },
  { key: 'rearWiperWasherDropdownList', imageKey: 'rearWiperAndWasherImages', label: 'Rear Wiper & Washer', dropdownName: 'frontWiperAndWasher' },
  { key: 'reverseCameraDropdownList', imageKey: 'reverseCameraImages', label: 'Reverse Camera', dropdownName: 'Reverse Camera' },
  { key: 'sunroofDropdownList', oldKey: 'sunroof', imageKey: 'sunroofImages', oldImageKey: 'sunroofImages', label: 'Sunroof', dropdownName: 'Sunroof' },
  { key: 'split_e7', hasNoImages: true, splitParts: [
    { key: 'rearDefoggerDropdownList', oldKey: 'rearDefogger', label: 'Rear Defogger', dropdownName: 'Rear Defogger' },
    { key: 'rhsFrontDoorFeaturesDropdownList', oldKey: 'powerWindowConditionRhsFront', label: 'Driver Door Features', dropdownName: 'LHS Front Door Features' },
  ] },
  { key: 'split_e8', hasNoImages: true, splitParts: [
    { key: 'lhsFrontDoorFeaturesDropdownList', oldKey: 'powerWindowConditionLhsFront', label: 'Co-Driver Door Features', dropdownName: 'RHS Front Door Features' },
    { key: 'rhsRearDoorFeaturesDropdownList', oldKey: 'powerWindowConditionRhsRear', label: 'RHS Rear Door Features', dropdownName: 'RHS Rear Door Features' },
  ] },
  { key: 'split_e9', hasNoImages: true, splitParts: [
    { key: 'noOfPowerWindows', oldKey: 'noOfPowerWindows', label: 'Power Windows', dropdownName: 'Number of Power Windows' },
    { key: 'lhsRearDoorFeaturesDropdownList', oldKey: 'powerWindowConditionLhsRear', label: 'LHS Rear Door Features', dropdownName: 'LHS Rear Door Features' },
  ] },
]

const interiorParts = [
  // Airbags — left column: Config (Airbags + Comment)
  {
    key: 'noOfAirBagsBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'noOfAirBags', oldKey: 'noOfAirBags', label: 'Number of Airbags', type: 'dropdown', dropdownName: 'Number of Airbags' },
      { key: 'commentOnInterior', oldKey: 'commentOnInterior', label: 'Comment on Interior', type: 'dropdown', dropdownName: 'Comment on Interior' },
    ],
  },
  // Airbags — right column: 4-panel horizontal grid
  {
    key: 'airbagDetailsBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'driverAirbagDropdownList', oldKey: 'airbagFeaturesDriverSide', label: 'Driver Airbag', type: 'dropdown', dropdownName: 'Driver Airbag' },
      { key: 'airbagImages', oldKey: 'airbags', label: 'Driver Airbag Image', type: 'imageSlot', imageIndex: 0 },
      { key: 'coDriverAirbagDropdownList', oldKey: 'airbagFeaturesCoDriverSide', label: 'Co-Driver Airbag', type: 'dropdown', dropdownName: 'Co-Driver Airbag' },
      { key: 'airbagImages', oldKey: 'airbags', label: 'Co-Driver Airbag Image', type: 'imageSlot', imageIndex: 1 },
    ],
  },
  // Airbags — row 2: left column (seat airbags)
  {
    key: 'seatAirbagDetailsBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'driverSeatAirbagDropdownList', oldKey: 'airbagFeaturesRhsAPillarCurtain', label: 'Driver Seat Airbag', type: 'dropdown', dropdownName: 'Driver Seat Airbag' },
      { key: 'airbagImages', oldKey: 'driverSeatAirbagImages', label: 'Driver Seat Airbag Image', type: 'imageSlot', imageIndex: 2 },
      { key: 'coDriverSeatAirbagDropdownList', oldKey: 'airbagFeaturesLhsAPillarCurtain', label: 'Co-Driver Seat Airbag', type: 'dropdown', dropdownName: 'Co-Driver Seat Airbag' },
      { key: 'airbagImages', oldKey: 'coDriverSeatAirbagImages', label: 'Co-Driver Seat Airbag Image', type: 'imageSlot', imageIndex: 3 },
    ],
  },
  // Airbags — row 2: right column (curtain airbags)
  {
    key: 'curtainAirbagDetailsBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'rhsCurtainAirbagDropdownList', oldKey: 'airbagFeaturesRhsBPillarCurtain', label: 'RHS Curtain Airbag', type: 'dropdown', dropdownName: 'RHS Curtain Airbag' },
      { key: 'airbagImages', oldKey: 'rhsCurtainAirbagImages', label: 'RHS Curtain Airbag Image', type: 'imageSlot', imageIndex: 4 },
      { key: 'lhsCurtainAirbagDropdownList', oldKey: 'airbagFeaturesLhsBPillarCurtain', label: 'LHS Curtain Airbag', type: 'dropdown', dropdownName: 'LHS Curtain Airbag' },
      { key: 'airbagImages', oldKey: 'lhsCurtainAirbagImages', label: 'LHS Curtain Airbag Image', type: 'imageSlot', imageIndex: 5 },
    ],
  },
  // Airbags — row 3: left column (knee airbags)
  {
    key: 'kneeAirbagDetailsBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'driverSideKneeAirbag', label: 'Driver Knee Airbag', type: 'dropdown', dropdownName: 'Driver Knee Airbag' },
      { key: 'airbagImages', label: 'Driver Knee Airbag Image', type: 'imageSlot', imageIndex: 6 },
      { key: 'coDriverKneeSeatAirbag', label: 'Co-Driver Knee Airbag', type: 'dropdown', dropdownName: 'Co-Driver Knee Airbag' },
      { key: 'airbagImages', label: 'Co-Driver Knee Airbag Image', type: 'imageSlot', imageIndex: 7 },
    ],
  },
  // Airbags — row 3: right column (rear side airbags)
  {
    key: 'rearSideAirbagDetailsBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'rhsRearSideAirbag', oldKey: 'airbagFeaturesRhsCPillarCurtain', label: 'RHS Rear Side Airbag', type: 'dropdown', dropdownName: 'RHS Rear Side Airbags' },
      { key: 'airbagImages', oldKey: 'rhsRearSideAirbagImages', label: 'RHS Rear Side Airbag Image', type: 'imageSlot', imageIndex: 8 },
      { key: 'lhsRearSideAirbag', oldKey: 'airbagFeaturesLhsCPillarCurtain', label: 'LHS Rear Side Airbag', type: 'dropdown', dropdownName: 'LHS Rear Side Airbag' },
      { key: 'airbagImages', oldKey: 'lhsRearSideAirbagImages', label: 'LHS Rear Side Airbag Image', type: 'imageSlot', imageIndex: 9 },
    ],
  },

  // Seats & Upholstery — row 4: left column
  {
    key: 'seatsLeftBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'seatsUpholstery', oldKey: 'leatherSeats/fabricSeats', label: 'Seat Upholstery', type: 'dropdown', dropdownName: 'seatsUpholstery' },
      { key: 'driverSeatDropdownList', label: 'Driver Seat', type: 'dropdown', dropdownName: 'Driver Seat' },
    ],
  },
  // Seats & Upholstery — row 4: right column
  {
    key: 'seatsRightBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'coDriverSeatDropdownList', label: 'Co-Driver Seat', type: 'dropdown', dropdownName: 'Co-Driver Seat' },
      { key: 'frontCentreArmRestDropdownList', label: 'Front Centre Arm Rest', type: 'dropdown', dropdownName: 'Front Centre Arm Rest' },
    ],
  },
  // Row 5: left column
  {
    key: 'rearSeatsConfigBox',
    hasNoImages: true,
    isFourPanel: true,
    fourPanels: [
      { key: 'rearSeatsDropdownList', label: 'Rear Seats', type: 'dropdown', dropdownName: 'Rear Seats' },
      { key: 'thirdRowSeatsDropdownList', label: 'Third Row Seats', type: 'dropdown', dropdownName: 'Third Row Seats' },
    ],
  },
  // Standalone Image Boxes (Seats)
  {
    key: 'frontSeatsFromDriverSideImagesBox',
    oldKey: 'frontSeatsFromDriverSideDoor',
    imageKey: 'frontSeatsFromDriverSideImages',
    oldImageKey: 'frontSeatsFromDriverSideDoor',
    label: 'Front Seats (Driver Side)',
    isImageOnly: true,
  },
  {
    key: 'rearSeatsFromRightSideImagesBox',
    oldKey: 'rearSeatsFromRightSideDoor',
    imageKey: 'rearSeatsFromRightSideImages',
    oldImageKey: 'rearSeatsFromRightSideDoor',
    label: 'Rear Seats (Right Side)',
    isImageOnly: true,
  },

  // Row 6: left side (Dashboard Images)
  {
    key: 'dashboardImages',
    oldKey: 'dashboardFromRearSeat',
    imageKey: 'dashboardImages',
    oldImageKey: 'dashboardFromRearSeat',
    label: 'Dashboard from Rear Seat',
    isImageOnly: true,
  },

]

const steeringSuspensionBrakesParts = [
  { key: 'split_ssb1', hasNoImages: true, splitParts: [
    { key: 'steeringDropdownList', oldKey: 'steering', label: 'Steering', dropdownName: 'Steering' },
    { key: 'suspensionDropdownList', oldKey: 'suspension', label: 'Suspension', dropdownName: 'Suspension' },
  ] },
  { key: 'split_ssb2', hasNoImages: true, splitParts: [
    { key: 'brakesDropdownList', oldKey: 'brakes', label: 'Brakes', dropdownName: 'Brakes' },
    { key: 'clutchDropdownList', oldKey: 'clutch', label: 'Clutch', dropdownName: 'Clutch' },
  ] },
  { key: 'split_ssb3', hasNoImages: true, splitParts: [
    { key: 'gearShiftDropdownList', oldKey: 'gearShift', label: 'Gear Shift', dropdownName: 'Gear Shift' },
    { key: 'transmissionTypeDropdownList', label: 'Transmission Type', dropdownName: 'Transmission Type' },
  ] },
  { key: 'split_ssb4', hasNoImages: true, splitParts: [
    { key: 'driveTrainDropdownList', label: 'Drive Train', dropdownName: 'Drive Train' },
    { key: 'commentsOnTransmission', oldKey: 'commentsOnTransmission', label: 'Comment on Transmission', inputType: 'text' },
  ] },

  { key: 'odometerReadingAfterTestDriveInKms', imageKey: 'odometerReadingAfterTestDriveImages', label: 'Odometer Reading after Test Drive', inputType: 'number' },
]

const exteriorSections = [
  {
    title: 'Front',
    icon: 'i-lucide-arrow-up',
    imageKeys: [
      { new: 'frontMainImages', old: 'frontMain' },
      { new: 'bonnetOpenImages', old: 'bonnetImages' },
      { new: 'bonnetClosedImages', old: 'bonnetImages' },
      { new: 'frontWindshieldImages', old: 'frontWindshieldImages' },
      { new: 'frontWiperAndWasherImages' },
      { new: 'roofImages', old: 'roofImages' },
      { new: 'frontBumperImages', old: 'frontBumperImages' },
      { new: 'frontBumperLhs45DegreeImages', old: 'frontBumperImages' },
      { new: 'frontBumperRhs45DegreeImages', old: 'frontBumperImages' },
      { new: 'lhsHeadlampImages', old: 'lhsHeadlampImages' },
      { new: 'lhsFoglampImages', old: 'lhsFoglampImages' },
      { new: 'rhsHeadlampImages', old: 'rhsHeadlampImages' },
      { new: 'rhsFoglampImages', old: 'rhsFoglampImages' },
    ],
    parts: [
      { key: 'frontMainImages', oldKey: 'frontMain', imageKey: 'frontMainImages', oldImageKey: 'frontMain', label: 'Front Main', isImageOnly: true },
      {
        key: 'bonnetDropdownList',
        oldKey: 'bonnet',
        label: 'Bonnet',
        imageGroups: [
          { key: 'bonnetOpenImages', oldKey: 'bonnetImages', label: 'Bonnet Open' },
          { key: 'bonnetClosedImages', oldKey: 'bonnetImages', label: 'Bonnet Closed' },
        ],
      },
      { key: 'frontWindshieldDropdownList', oldKey: 'frontWindshield', imageKey: 'frontWindshieldImages', oldImageKey: 'frontWindshieldImages', label: 'Front Windshield' },
      { key: 'frontWiperAndWasherDropdownList', imageKey: 'frontWiperAndWasherImages', label: 'Front Wiper & Washer', dropdownName: 'frontWiperAndWasher' },
      { key: 'roofDropdownList', oldKey: 'roof', imageKey: 'roofImages', oldImageKey: 'roofImages', label: 'Roof' },
      {
        key: 'frontBumperDropdownList',
        oldKey: 'frontBumper',
        label: 'Front Bumper',
        imageGroups: [
          { key: 'frontBumperImages', oldKey: 'frontBumperImages', label: 'Front Bumper Image' },
          { key: 'frontBumperLhs45DegreeImages', oldKey: 'frontBumperImages', label: 'LHS 45' },
          { key: 'frontBumperRhs45DegreeImages', oldKey: 'frontBumperImages', label: 'RHS 45' },
        ],
      },
      { key: 'lhsHeadlampDropdownList', oldKey: 'lhsHeadlamp', imageKey: 'lhsHeadlampImages', oldImageKey: 'lhsHeadlampImages', label: 'LHS Headlamp' },
      { key: 'lhsFoglampDropdownList', oldKey: 'lhsFoglamp', imageKey: 'lhsFoglampImages', oldImageKey: 'lhsFoglampImages', label: 'LHS Foglamp' },
      { key: 'rhsHeadlampDropdownList', oldKey: 'rhsHeadlamp', imageKey: 'rhsHeadlampImages', oldImageKey: 'rhsHeadlampImages', label: 'RHS Headlamp' },
      { key: 'rhsFoglampDropdownList', oldKey: 'rhsFoglamp', imageKey: 'rhsFoglampImages', oldImageKey: 'rhsFoglampImages', label: 'RHS Foglamp' },
    ],
  },
  {
    title: 'Left (LHS)',
    icon: 'i-lucide-arrow-left',
    imageKeys: [
      { new: 'lhsFullViewImages', old: 'lhsFront45Degree' },
      { new: 'lhsFenderImages', old: 'lhsFenderImages' },
      { new: 'lhsFrontWheelImages', old: 'lhsFrontAlloyImages' },
      { new: 'lhsFrontTyreImages', old: 'lhsFrontTyreImages' },
      { new: 'lhsOrvmImages', old: 'lhsOrvmImages' },
      { new: 'lhsAPillarImages', old: 'lhsAPillarImages' },
      { new: 'lhsFrontDoorImages', old: 'lhsFrontDoorImages' },
      { new: 'lhsBPillarImages', old: 'lhsBPillarImages' },
      { new: 'lhsRearDoorImages', old: 'lhsRearDoorImages' },
      { new: 'lhsCPillarImages', old: 'lhsCPillarImages' },
      { new: 'lhsRunningBorderImages', old: 'lhsRunningBorderImages' },
      { new: 'lhsRearWheelImages', old: 'lhsRearAlloyImages' },
      { new: 'lhsRearTyreImages', old: 'lhsRearTyreImages' },
      { new: 'lhsQuarterPanelWithRearDoorClosedImages', old: 'lhsQuarterPanelImages' },
    ],
    parts: [
      { key: 'lhsFullViewImages', oldKey: 'lhsFront45Degree', imageKey: 'lhsFullViewImages', oldImageKey: 'lhsFront45Degree', label: 'LHS Full View', isImageOnly: true },
      { key: 'lhsFenderDropdownList', oldKey: 'lhsFender', imageKey: 'lhsFenderImages', oldImageKey: 'lhsFenderImages', label: 'LHS Fender' },
      { key: 'lhsFrontWheelDropdownList', oldKey: 'lhsFrontAlloy', imageKey: 'lhsFrontWheelImages', oldImageKey: 'lhsFrontAlloyImages', label: 'LHS Front Wheel' },
      { key: 'lhsFrontTyreDropdownList', oldKey: 'lhsFrontTyre', imageKey: 'lhsFrontTyreImages', oldImageKey: 'lhsFrontTyreImages', label: 'LHS Front Tyre' },
      { key: 'lhsOrvmDropdownList', oldKey: 'lhsOrvm', imageKey: 'lhsOrvmImages', oldImageKey: 'lhsOrvmImages', label: 'LHS ORVM' },
      { key: 'lhsAPillarDropdownList', oldKey: 'lhsAPillar', imageKey: 'lhsAPillarImages', oldImageKey: 'lhsAPillarImages', label: 'LHS A-Pillar', dropdownName: 'LHS A Pillar' },
      { key: 'lhsFrontDoorDropdownList', oldKey: 'lhsFrontDoor', imageKey: 'lhsFrontDoorImages', oldImageKey: 'lhsFrontDoorImages', label: 'LHS Front Door' },
      { key: 'lhsBPillarDropdownList', oldKey: 'lhsBPillar', imageKey: 'lhsBPillarImages', oldImageKey: 'lhsBPillarImages', label: 'LHS B-Pillar', dropdownName: 'LHS B Pillar' },
      { key: 'lhsRearDoorDropdownList', oldKey: 'lhsRearDoor', imageKey: 'lhsRearDoorImages', oldImageKey: 'lhsRearDoorImages', label: 'LHS Rear Door' },
      { key: 'lhsCPillarDropdownList', oldKey: 'lhsCPillar', imageKey: 'lhsCPillarImages', oldImageKey: 'lhsCPillarImages', label: 'LHS C-Pillar', dropdownName: 'LHS C Pillar' },
      { key: 'lhsRunningBorderDropdownList', oldKey: 'lhsRunningBorder', imageKey: 'lhsRunningBorderImages', oldImageKey: 'lhsRunningBorderImages', label: 'LHS Running Border' },
      { key: 'lhsRearWheelDropdownList', oldKey: 'lhsRearAlloy', imageKey: 'lhsRearWheelImages', oldImageKey: 'lhsRearAlloyImages', label: 'LHS Rear Wheel' },
      { key: 'lhsRearTyreDropdownList', oldKey: 'lhsRearTyre', imageKey: 'lhsRearTyreImages', oldImageKey: 'lhsRearTyreImages', label: 'LHS Rear Tyre' },
      {
        key: 'lhsQuarterPanelDropdownList',
        oldKey: 'lhsQuarterPanel',
        label: 'LHS Quarter Panel',
        imageKey: 'lhsQuarterPanelWithRearDoorClosedImages',
        oldImageKey: 'lhsQuarterPanelImages',
      },
    ],
  },
  {
    title: 'Rear',
    icon: 'i-lucide-arrow-down',
    imageKeys: [
      { new: 'rearMainImages', old: 'rearMain' },
      { new: 'rearBumperLhs45DegreeImages', old: 'rearBumperImages' },
      { new: 'rearBumperRhs45DegreeImages', old: 'rearBumperImages' },
      { new: 'rearBumperImages', old: 'rearBumperImages' },
      { new: 'lhsTailLampImages', old: 'lhsTailLampImages' },
      { new: 'lhsRearFogLampImages' },
      { new: 'rhsTailLampImages', old: 'rhsTailLampImages' },
      { new: 'rhsRearFogLampImages' },
      { new: 'rearWindshieldImages', old: 'rearWindshieldImages' },
      { new: 'bootDoorOpenImages', old: 'rearWithBootDoorOpen' },
      { new: 'spareWheelImages' },
      { new: 'spareTyreImages', old: 'spareTyreImages' },
      { new: 'bootFloorImages', old: 'bootFloorImages' },
    ],
    parts: [
      { key: 'rearMainImages', oldKey: 'rearMain', imageKey: 'rearMainImages', oldImageKey: 'rearMain', label: 'Rear Main', isImageOnly: true },
      {
        key: 'rearBumperDropdownList',
        oldKey: 'rearBumper',
        label: 'Rear Bumper',
        imageGroups: [
          { key: 'rearBumperLhs45DegreeImages', oldKey: 'rearBumperImages', label: 'Rear Bumper LHS 45' },
          { key: 'rearBumperRhs45DegreeImages', oldKey: 'rearBumperImages', label: 'Rear Bumper RHS 45' },
          { key: 'rearBumperImages', oldKey: 'rearBumperImages', label: 'Rear Bumper Image' },
        ],
      },
      { key: 'lhsTailLampDropdownList', oldKey: 'lhsTailLamp', imageKey: 'lhsTailLampImages', oldImageKey: 'lhsTailLampImages', label: 'LHS Tail Lamp' },
      { key: 'lhsRearFogLampDropdownList', imageKey: 'lhsRearFogLampImages', label: 'LHS Rear Fog Lamp', dropdownName: 'LHS Rear Foglamp' },
      { key: 'rhsTailLampDropdownList', oldKey: 'rhsTailLamp', imageKey: 'rhsTailLampImages', oldImageKey: 'rhsTailLampImages', label: 'RHS Tail Lamp' },
      { key: 'rhsRearFogLampDropdownList', imageKey: 'rhsRearFogLampImages', label: 'RHS Rear Fog Lamp', dropdownName: 'RHS Rear Foglamp' },
      { key: 'rearWindshieldDropdownList', oldKey: 'rearWindshield', imageKey: 'rearWindshieldImages', oldImageKey: 'rearWindshieldImages', label: 'Rear Windshield' },
      {
        key: 'bootDoorDropdownList',
        oldKey: 'bootDoor',
        label: 'Boot Door',
        imageGroups: [
          { key: 'bootDoorOpenImages', oldKey: 'rearWithBootDoorOpen', label: 'Boot Door Image' },
          { key: 'rearWithBootDoorOpenImages', oldKey: 'rearWithBootDoorOpen', label: 'Rear With Boot Door Open Image' },
        ],
      },
      { key: 'spareWheelDropdownList', imageKey: 'spareWheelImages', label: 'Spare Wheel' },
      { key: 'spareTyreDropdownList', oldKey: 'spareTyre', imageKey: 'spareTyreImages', oldImageKey: 'spareTyreImages', label: 'Spare Tyre' },
      { key: 'bootFloorDropdownList', oldKey: 'bootFloor', imageKey: 'bootFloorImages', oldImageKey: 'bootFloorImages', label: 'Boot Floor' },
    ],
  },
  {
    title: 'Right (RHS)',
    icon: 'i-lucide-arrow-right',
    imageKeys: [
      { new: 'rhsFullViewImages', old: 'rhsRear45Degree' },
      { new: 'rhsQuarterPanelWithRearDoorClosedImages', old: 'rhsQuarterPanelImages' },
      { new: 'rhsRearWheelImages', old: 'rhsRearAlloyImages' },
      { new: 'rhsRearTyreImages', old: 'rhsRearTyreImages' },
      { new: 'rhsRunningBorderImages', old: 'rhsRunningBorderImages' },
      { new: 'rhsCPillarImages', old: 'rhsCPillarImages' },
      { new: 'rhsRearDoorImages', old: 'rhsRearDoorImages' },
      { new: 'rhsBPillarImages', old: 'rhsBPillarImages' },
      { new: 'rhsFrontDoorImages', old: 'rhsFrontDoorImages' },
      { new: 'rhsAPillarImages', old: 'rhsAPillarImages' },
      { new: 'rhsOrvmImages', old: 'rhsOrvmImages' },
      { new: 'rhsFrontWheelImages', old: 'rhsFrontAlloyImages' },
      { new: 'rhsFrontTyreImages', old: 'rhsFrontTyreImages' },
      { new: 'rhsFenderImages', old: 'rhsFenderImages' },
    ],
    parts: [
      { key: 'rhsFullViewImages', oldKey: 'rhsRear45Degree', imageKey: 'rhsFullViewImages', oldImageKey: 'rhsRear45Degree', label: 'RHS Full View', isImageOnly: true },
      {
        key: 'rhsQuarterPanelDropdownList',
        oldKey: 'rhsQuarterPanel',
        label: 'RHS Quarter Panel',
        imageKey: 'rhsQuarterPanelWithRearDoorClosedImages',
        oldImageKey: 'rhsQuarterPanelImages',
      },
      { key: 'rhsRearWheelDropdownList', oldKey: 'rhsRearAlloy', imageKey: 'rhsRearWheelImages', oldImageKey: 'rhsRearAlloyImages', label: 'RHS Rear Wheel' },
      { key: 'rhsRearTyreDropdownList', oldKey: 'rhsRearTyre', imageKey: 'rhsRearTyreImages', oldImageKey: 'rhsRearTyreImages', label: 'RHS Rear Tyre' },
      { key: 'rhsRunningBorderDropdownList', oldKey: 'rhsRunningBorder', imageKey: 'rhsRunningBorderImages', oldImageKey: 'rhsRunningBorderImages', label: 'RHS Running Border' },
      { key: 'rhsCPillarDropdownList', oldKey: 'rhsCPillar', imageKey: 'rhsCPillarImages', oldImageKey: 'rhsCPillarImages', label: 'RHS C Pillar', dropdownName: 'RHS C Pillar' },
      { key: 'rhsRearDoorDropdownList', oldKey: 'rhsRearDoor', imageKey: 'rhsRearDoorImages', oldImageKey: 'rhsRearDoorImages', label: 'RHS Rear Door' },
      { key: 'rhsBPillarDropdownList', oldKey: 'rhsBPillar', imageKey: 'rhsBPillarImages', oldImageKey: 'rhsBPillarImages', label: 'RHS B Pillar', dropdownName: 'RHS B Pillar' },
      { key: 'rhsFrontDoorDropdownList', oldKey: 'rhsFrontDoor', imageKey: 'rhsFrontDoorImages', oldImageKey: 'rhsFrontDoorImages', label: 'RHS Front Door' },
      { key: 'rhsAPillarDropdownList', oldKey: 'rhsAPillar', imageKey: 'rhsAPillarImages', oldImageKey: 'rhsAPillarImages', label: 'RHS A Pillar', dropdownName: 'RHS A Pillar' },
      { key: 'rhsOrvmDropdownList', oldKey: 'rhsOrvm', imageKey: 'rhsOrvmImages', oldImageKey: 'rhsOrvmImages', label: 'RHS ORVM' },
      { key: 'rhsFrontWheelDropdownList', oldKey: 'rhsFrontAlloy', imageKey: 'rhsFrontWheelImages', oldImageKey: 'rhsFrontAlloyImages', label: 'RHS Front Wheel' },
      { key: 'rhsFrontTyreDropdownList', oldKey: 'rhsFrontTyre', imageKey: 'rhsFrontTyreImages', oldImageKey: 'rhsFrontTyreImages', label: 'RHS Front Tyre' },
      { key: 'rhsFenderDropdownList', oldKey: 'rhsFender', imageKey: 'rhsFenderImages', oldImageKey: 'rhsFenderImages', label: 'RHS Fender' },
    ],
  },
  {
    title: 'Engine Bay',
    icon: 'i-lucide-cog',
    imageKeys: [
      { new: 'engineBayImages', old: 'engineBay' },
      { new: 'cowlTopImages' },
      { new: 'firewallImages' },
      { new: 'lhsApronImages', old: 'apronLhsRhs' },
      { new: 'rhsApronImages', old: 'apronLhsRhs' },
      { new: 'batteryImages', old: 'batteryImages' },
    ],
    parts: engineParts,
  },
  {
    id: 'electricals',
    title: 'Electricals',
    icon: 'i-lucide-zap',
    imageKeys: [
      { new: 'meterConsoleWithEngineOnImages', old: 'meterConsoleWithEngineOn' },
      { new: 'acImages' },
      { new: 'rearWiperAndWasherImages' },
      { new: 'reverseCameraImages' },
      { new: 'sunroofImages', old: 'sunroofImages' },
    ],
    parts: electricalParts,
  },
  {
    id: 'interior',
    title: 'Interior',
    icon: 'i-lucide-armchair',
    imageKeys: [
      { new: 'airbagImages', old: 'airbags' },
      { new: 'driverSeatAirbagImages', old: 'airbags' },
      { new: 'coDriverSeatAirbagImages', old: 'airbags' },
      { new: 'rhsCurtainAirbagImages', old: 'airbags' },
      { new: 'lhsCurtainAirbagImages', old: 'airbags' },
      { new: 'driverSideKneeAirbagImages' },
      { new: 'coDriverKneeSeatAirbagImages' },
      { new: 'rhsRearSideAirbagImages', old: 'airbags' },
      { new: 'lhsRearSideAirbagImages', old: 'airbags' },
      { new: 'frontSeatsFromDriverSideImages', old: 'frontSeatsFromDriverSideDoor' },
      { new: 'rearSeatsFromRightSideImages', old: 'rearSeatsFromRightSideDoor' },
      { new: 'dashboardImages', old: 'dashboardFromRearSeat' },
    ],
    parts: interiorParts,
  },
  {
    id: 'steering-suspension-brakes',
    title: 'Steering, Suspension & Brakes',
    icon: 'i-lucide-disc',
    imageKeys: [
      { new: 'odometerReadingAfterTestDriveImages' },
    ],
    parts: steeringSuspensionBrakesParts,
  },
]

const pdfSections = exteriorSections
const activeExteriorSection = computed(() => exteriorSections.find(s => s.title.toLowerCase().replace(/[^a-z]+/g, '').startsWith(activeTab.value.toLowerCase().replace(/[^a-z]+/g, ''))))

// ─── Auto-save: debounced deep watch on editForm ───
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// Watch blocks moved below documentDetailFields definition to allow reference

const _exteriorImageKeys = [
  'frontMain',
  'bonnetImages',
  'frontWindshieldImages',
  'roofImages',
  'frontBumperImages',
  'lhsHeadlampImages',
  'lhsFoglampImages',
  'rhsHeadlampImages',
  'rhsFoglampImages',
  'lhsFront45Degree',
  'lhsFenderImages',
  'lhsFrontAlloyImages',
  'lhsFrontTyreImages',
  'lhsRunningBorderImages',
  'lhsOrvmImages',
  'lhsFrontDoorImages',
  'lhsRearDoorImages',
  'lhsRearTyreImages',
  'lhsQuarterPanelWithRearDoorClosedImages',
  'rearMain',
  'rearWithBootDoorOpen',
  'rearBumperImages',
  'lhsTailLampImages',
  'rhsTailLampImages',
  'spareTyreImages',
  'bootFloorImages',
  'rhsRear45Degree',
  'rhsQuarterPanelWithRearDoorClosedImages',
  'rhsRearDoorImages',
  'rhsFrontDoorImages',
  'rhsRunningBorderImages',
  'rhsFrontTyreImages',
  'rhsOrvmImages',
  'rhsFenderImages',
]

const engineVideoKeys = [
  { key: 'engineVideo', oldKey: 'engineSound', label: 'Engine Sound Video' },
  { key: 'exhaustSmokeVideo', oldKey: 'exhaustSmokeImages', label: 'Exhaust Smoke Video' },
]

function getVideos(obj: Record<string, any> | null, key: string): string[] {
  const val = obj?.[key]
  if (!val)
    return []
  if (Array.isArray(val))
    return val.filter((u: string) => u && typeof u === 'string')
  if (typeof val === 'string' && val.startsWith('http'))
    return [val]
  return []
}

function getEmbedUrl(url: string): { type: 'iframe' | 'video', src: string } {
  if (!url)
    return { type: 'video', src: '' }
  try {
    if (url.includes('drive.google.com')) {
      let id = ''
      if (url.includes('uc?id=')) {
        id = new URL(url).searchParams.get('id') || ''
      }
      else if (url.includes('open?id=')) {
        id = new URL(url).searchParams.get('id') || ''
      }
      else {
        const m = url.match(/\/file\/d\/([^/]+)/)
        if (m)
          id = m[1] || ''
      }
      if (id) {
        return { type: 'iframe', src: `https://drive.google.com/file/d/${id}/preview` }
      }
    }
  }
  catch {
    // Return default below
  }
  return { type: 'video', src: url }
}

const documentImageKeys = [
  { new: 'rcTokenImages', old: 'rcTaxToken' },
  { new: 'insuranceImages', old: 'insuranceImages' },
  { new: 'duplicateKeyImages', old: 'duplicateKey' },
  { new: 'chassisEmbossmentImages' },
  { new: 'vinPlateImages' },
  { new: 'pucImages' },
  { new: 'roadTaxImages' },
]

const allPdfImages = computed(() => {
  const imgs: { url: string, label: string }[] = []
  // 1. Documents
  imgs.push(...sectionImages(documentImageKeys))
  // 2. All Exterior/Technical sections
  for (const sec of pdfSections) {
    if (sec.imageKeys) {
      imgs.push(...sectionImages(sec.imageKeys))
    }
  }
  // Deduplicate by URL
  return imgs.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i)
})

// ─── Document Details field mapping (spreadsheet-driven) ───
const documentDetailFields: any[] = [
  // Core Identity
  { key: 'chassisEmbossmentImages', type: 'combinedBox', label: 'Chassis Embossment', splitParts: [
    { label: 'To Be Scrapped', key: 'toBeScrapped', oldKey: 'toBeScrapped', type: 'dropdown', dropdownName: 'To Be Scrapped' },
    { label: 'Chassis Details', key: 'chassisDetails', type: 'dropdown', dropdownName: 'Chassis Details' },
  ] },
  { key: 'vinPlateImages', type: 'combinedBox', label: 'Vin Plate', splitParts: [
    { label: 'Vin Plate Details', key: 'vinPlateDetails', type: 'dropdown', dropdownName: 'Vin Plate Details' },
  ] },
  { key: 'rcTokenImages', type: 'combinedBox', oldKey: 'rcTaxToken', label: 'RC Token', splitParts: [
    { label: 'RC Book Availability', key: 'rcBookAvailabilityDropdownList', oldKey: 'rcBookAvailability', type: 'dropdown', dropdownName: 'RC Book Availability' },
    { label: 'RC Condition', key: 'rcCondition', oldKey: 'rcCondition', type: 'dropdown', dropdownName: 'RC Condition' },
    { label: 'Mismatch in RC', key: 'mismatchInRcDropdownList', oldKey: 'mismatchInRc', type: 'dropdown', dropdownName: 'Mismatch in RC' },
  ] },
  { key: 'technicalSpecs', type: 'combinedBox', label: 'Technical Specs', hideImages: true, splitParts: [
    { label: 'Fuel Type', key: 'fuelType', oldKey: 'fuelType', type: 'single', dropdownName: undefined },
    { label: 'Seating Capacity', key: 'seatingCapacity', type: 'single', dropdownName: undefined },
    { label: 'Color', key: 'color', type: 'single', dropdownName: undefined },
  ], rightParts: [
    { label: 'Fitness Validity', key: 'fitnessValidity', oldKey: 'fitnessTill', type: 'date', dropdownName: undefined },
    { label: 'Engine Number', key: 'engineNumber', oldKey: 'engineNumber', type: 'single', dropdownName: undefined },
    { label: 'Chassis Number', key: 'chassisNumber', oldKey: 'chassisNumber', type: 'single', dropdownName: undefined },
  ] },
  { key: 'registrationDetails', type: 'combinedBox', label: 'Registration Details', hideImages: true, splitParts: [
    { label: 'Cubic Capacity', key: 'cubicCapacity', oldKey: 'cubicCapacity', type: 'single', dropdownName: undefined },
    { label: 'Norms', key: 'norms', type: 'single', dropdownName: undefined },
    { label: 'Registration State', key: 'registrationState', oldKey: 'registrationState', type: 'single', dropdownName: undefined },
  ], rightParts: [
    { label: 'Registered RTO', key: 'registeredRto', oldKey: 'registeredRto', type: 'single', dropdownName: undefined },
    { label: 'Registered Address as per RC', key: 'registeredAddressAsPerRc', oldKey: 'registeredAddressAsPerRc', type: 'single', dropdownName: undefined },
  ] },
  // Tax & Validity
  { key: 'roadTaxImages', type: 'combinedBox', label: 'Road Tax', splitParts: [
    { label: 'Road Tax Validity', key: 'roadTaxValidity', oldKey: 'roadTaxValidity', type: 'multiselect', dropdownName: 'Road Tax Validity' },
    { label: 'Tax Valid Till', key: 'taxValidTill', oldKey: 'taxValidTill', type: 'date', dropdownName: undefined },
  ] },
  // Hypothecation
  // Hypothecation & Insurance
  { key: 'hypothecationInsurance', type: 'combinedBox', label: 'Hypo & Insurance', hideImages: true, splitParts: [
    { label: 'Hypothecation Details', key: 'hypothecationDetails', type: 'dropdown', dropdownName: 'Hypothecation Details' },
    { label: 'Hypothecated To', key: 'hypothecatedTo', type: 'single', dropdownName: undefined },
  ], rightParts: [
    { label: 'Insurance Type', key: 'insuranceDropdownList', oldKey: 'insurance', type: 'dropdown', dropdownName: 'Insurance' },
    { label: 'Insurance Validity', key: 'insuranceValidity', oldKey: 'insuranceValidity', type: 'date', dropdownName: undefined },
  ] },
  { key: 'insuranceImages', type: 'combinedBox', label: 'Insurance Policy', splitParts: [
    { label: 'Insured By', key: 'insurer', type: 'single', dropdownName: undefined },
    { label: 'Policy Number', key: 'policyNumber', oldKey: 'insurancePolicyNumber', type: 'single', dropdownName: undefined },
  ] },
  // PUC
  { key: 'pucImages', type: 'combinedBox', label: 'PUC Details', splitParts: [
    { label: 'PUC Validity', key: 'pucValidity', type: 'date', dropdownName: undefined },
    { label: 'PUC Number', key: 'pucNumber', type: 'single', dropdownName: undefined },
  ] },
  // Status & Compliance
  { key: 'statusCompliance', type: 'combinedBox', label: 'Status & Compliance', hideImages: true, splitParts: [
    { label: 'RC Status', key: 'rcStatus', type: 'dropdown', dropdownName: 'RC Status' },
    { label: 'Blacklist Status', key: 'blacklistStatus', type: 'dropdown', staticOptions: [{ label: 'YES', value: 'YES' }, { label: 'NO', value: 'NO' }, { label: 'fetching data', value: 'fetching data' }] },
    { label: 'RTO NOC Details', key: 'rtoNoc', oldKey: 'rtoNoc', type: 'multiselect', dropdownName: 'RTO NOC' },
  ], rightParts: [
    { label: 'RTO Form 28 (2 Copies)', key: 'rtoForm28', oldKey: 'rtoForm28', type: 'multiselect', dropdownName: 'RTO Form 28 (2 copies)' },
    { label: 'Party Peshi', key: 'partyPeshi', oldKey: 'partyPeshi', type: 'multiselect', dropdownName: 'Party Peshi' },
  ] },
  { key: 'duplicateKeyImages', type: 'combinedBox', label: 'Key Details', splitParts: [
    { label: 'Duplicate Key', key: 'duplicateKey', oldKey: 'duplicateKey', type: 'dropdown', dropdownName: 'Duplicate Key' },
  ] },
  { key: 'additionalDetails', type: 'combinedBox', label: 'Miscellaneous', hideImages: true, splitParts: [
    { label: 'Additional Details', key: 'additionalDetailsDropdownList', oldKey: 'additionalDetails', type: 'dropdown', dropdownName: 'Additional Details' },
  ] },
]

// Lightbox / Gallery
const lightboxImages = ref<{ url: string, label: string }[]>([])
const lightboxIndex = ref(0)
const showLightbox = ref(false)

// ── QC Audit Log Value Formatting Helpers ──
function qcLogIsImageField(field: string, value: any): boolean {
  if (!value)
    return false
  const f = String(field).toUpperCase()
  if (f.includes('IMAGE'))
    return true
  const v = String(value)
  if (v.includes('cloudinary.com') || v.includes('/image/upload/'))
    return true
  if (/\.(?:jpg|jpeg|png|webp|gif|svg|avif)/i.test(v))
    return true
  return false
}

function qcLogExtractUrls(value: any): string[] {
  if (!value)
    return []
  let arr: string[] = []
  if (Array.isArray(value)) {
    arr = value
  }
  else {
    const v = String(value).trim()
    if (v.startsWith('[')) {
      try { arr = JSON.parse(v.replace(/'/g, '"')) }
      catch { /* ignore */ }
    }
    else {
      arr = [v]
    }
  }

  if (!Array.isArray(arr))
    return []

  return arr
    .filter((u: any) => u && typeof u === 'string' && u.trim() !== '')
    .map((u: string) => {
      if (u.startsWith('http'))
        return u
      return `https://res.cloudinary.com/dwunzqigc/image/upload/Otobix%20Auction%20App/Car%20Images/${car.value?.appointmentId}/${u}`
    })
}

function qcLogIsDate(value: any): boolean {
  if (!value)
    return false
  const v = String(value).trim()
  // ISO 8601 format: 2021-09-01T00:00:00.0002 or 2024-12-14
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/.test(v)
}

function qcLogFormatDate(value: any): string {
  try {
    const d = new Date(String(value))
    if (Number.isNaN(d.getTime()))
      return String(value)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  catch { return String(value) }
}

function qcLogIsNumber(field: string, value: any): boolean {
  if (value === null || value === undefined || value === '')
    return false
  const f = String(field).toUpperCase()
  if (f.includes('PRICE') || f.includes('KMS') || f.includes('ODOMETER') || f.includes('READING') || f.includes('NUMBER') || f.includes('NOOFAIRBAGS') || f.includes('SEATS') || f.includes('COST'))
    return true
  return !Number.isNaN(Number(value)) && String(value).trim() !== '' && /^\d+(?:\.\d+)?$/.test(String(value).trim())
}

function openLightbox(images: { url: string, label: string }[], index: number) {
  lightboxImages.value = images
  lightboxIndex.value = index
  showLightbox.value = true
}

function openLightboxUrls(urls: string[], index: number, label?: string) {
  lightboxImages.value = urls.map((u, i) => ({ url: u, label: label ? `${label} (${i + 1})` : `Image ${i + 1}` }))
  lightboxIndex.value = index
  showLightbox.value = true
}

function closeLightbox() {
  showLightbox.value = false
}

function prevImage() {
  lightboxIndex.value = (lightboxIndex.value - 1 + lightboxImages.value.length) % lightboxImages.value.length
  scrollThumbIntoView()
}

function nextImage() {
  lightboxIndex.value = (lightboxIndex.value + 1) % lightboxImages.value.length
  scrollThumbIntoView()
}

function goToImage(idx: number) {
  lightboxIndex.value = idx
  scrollThumbIntoView()
}

function scrollThumbIntoView() {
  nextTick(() => {
    const el = document.querySelector(`[data-thumb-idx="${lightboxIndex.value}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

// Keyboard navigation
function onLightboxKeydown(e: KeyboardEvent) {
  if (!showLightbox.value)
    return
  if (e.key === 'ArrowLeft')
    prevImage()
  else if (e.key === 'ArrowRight')
    nextImage()
  else if (e.key === 'Escape')
    closeLightbox()
}

onMounted(() => window.addEventListener('keydown', onLightboxKeydown))
onUnmounted(() => window.removeEventListener('keydown', onLightboxKeydown))

// Collect all images for a section — supports both string keys and { new, old } fallback objects
function sectionImages(keys: (string | { new: string, old?: string })[]) {
  const obj = editForm.value && Object.keys(editForm.value).length ? editForm.value : car.value
  if (!obj)
    return []
  const imgs: { url: string, label: string }[] = []
  const seenUrls = new Set<string>()
  for (const entry of keys) {
    const newKey = typeof entry === 'string' ? entry : entry.new
    const oldKey = typeof entry === 'string' ? undefined : entry.old
    const urls = getImages(obj, newKey, oldKey)
    for (let i = 0; i < urls.length; i++) {
      const urlObject = urls[i] as string
      if (!seenUrls.has(urlObject)) {
        seenUrls.add(urlObject)
        imgs.push({ url: urlObject, label: `${humanize(newKey)} Image ${i + 1}` })
      }
    }
  }
  return imgs
}

watch(() => car.value, (newVal) => {
  if (_skipCarWatch)
    return // Skip when baseline was just updated by saveQC
  if (newVal) {
    _skipAutoSave = true // Guard: don't trigger auto-save when resetting editForm from fetched data
    const clone = JSON.parse(JSON.stringify(newVal))

    const isFieldEmpty = (val: any) => val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)

    // Automatically map old keys to new keys based on exteriorSections config & documentDetailFields
    const applyFallback = (item: any) => {
      if (!item)
        return
      if (item.oldKey && item.oldKey !== 'new' && isFieldEmpty(clone[item.key]) && clone[item.oldKey]) {
        clone[item.key] = clone[item.oldKey]
      }
      if (item.splitParts)
        item.splitParts.forEach(applyFallback)
      if (item.rightParts)
        item.rightParts.forEach(applyFallback)
      if (item.imageGroups)
        item.imageGroups.forEach(applyFallback)
      if (item.fourPanels)
        item.fourPanels.forEach(applyFallback)
      if (item.parts)
        item.parts.forEach(applyFallback)
    }

    exteriorSections.forEach(section => section.parts.forEach(applyFallback))
    documentDetailFields.forEach(applyFallback)
    engineVideoKeys.forEach(applyFallback)

    // Extract year from yearMonthOfManufacture for editing
    if (clone.yearMonthOfManufacture && !clone.yearOfManufacture) {
      try { clone.yearOfManufacture = new Date(clone.yearMonthOfManufacture).getFullYear() }
      catch {}
    }

    editForm.value = clone
    nextTick(() => { _skipAutoSave = false })
  }
}, { immediate: true })

watch(editForm, () => {
  if (_skipAutoSave || props.readonly)
    return

  // Block SSE re-fetches while user has unsaved edits
  _pendingSave = true

  // Debounce: wait 1.5s after last change before saving
  if (_autoSaveTimer)
    clearTimeout(_autoSaveTimer)
  _autoSaveTimer = setTimeout(() => {
    saveQC(true)
  }, 1500)
}, { deep: true })
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden -m-4 lg:-m-6">
    <!-- PD Modal -->
    <Dialog :open="showPDModal" @update:open="showPDModal = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <div class="size-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Icon name="i-lucide-indian-rupee" class="size-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Update Price Discovery
          </DialogTitle>
          <DialogDescription>
            Modify the base price discovery. This will be tracked under your email.
          </DialogDescription>
        </DialogHeader>
        <div class="py-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price Discovery (PD) *</label>
            <Input v-model="pdValue" type="number" placeholder="Enter new PD value" class="font-bold text-lg h-11" autofocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPDModal = false">
            Cancel
          </Button>
          <Button class="bg-indigo-600 hover:bg-indigo-700 text-white" :disabled="isSavingPD" @click="savePD">
            <Icon v-if="isSavingPD" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="i-lucide-save" class="mr-2 size-4" />
            Save PD
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- QC Approval Modal -->
    <Dialog :open="showQCModal" @update:open="showQCModal = $event">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2.5">
            <div class="size-9 rounded-xl flex items-center justify-center" :class="hasBlockingWarnings ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'">
              <Icon :name="hasBlockingWarnings ? 'i-lucide-shield-alert' : 'i-lucide-shield-check'" class="size-5" :class="hasBlockingWarnings ? 'text-red-500' : 'text-emerald-500'" />
            </div>
            <div>
              <span>Approve & Schedule Auction</span>
              <p class="text-xs font-normal text-muted-foreground mt-0.5">
                {{ hasBlockingWarnings ? `${blockingWarnings.length} issue(s) must be resolved before approval` : 'All checks passed — ready to approve' }}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 py-4">
          <!-- LEFT COLUMN: Form Fields -->
          <div class="space-y-4">
            <!-- Price Discovery -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price Discovery *</label>
              <Input v-model="qcForm.priceDiscovery" type="number" placeholder="Enter Price Amount" class="font-bold text-lg h-11" required />
            </div>

            <!-- Retail Associate Dropdown -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Retail Associate</label>
              <select v-model="qcForm.retailAssociate" class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="">
                  Select Associate
                </option>
                <option v-for="r in retailers" :key="r.email" :value="r.email">
                  {{ r.userName }}
                </option>
              </select>
            </div>

            <!-- Auction Mode -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auction Mode</label>
              <select v-model="qcForm.auctionMode" class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="makeLiveNow">
                  Make Live Now
                </option>
                <option value="scheduledForLater">
                  Scheduled For Later
                </option>
              </select>
            </div>

            <!-- Auction Start Time (If scheduled) -->
            <div v-if="qcForm.auctionMode === 'scheduledForLater'" class="space-y-1.5">
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Date & Time *</label>
              <Input v-model="qcForm.auctionStartTime" type="datetime-local" class="font-medium h-10" required />
            </div>

            <!-- Auction Duration -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auction Duration (Hours)</label>
              <Input v-model="qcForm.auctionDuration" type="number" min="1" placeholder="Duration in hours" class="font-medium h-10" />
            </div>
          </div>

          <!-- RIGHT COLUMN: Validation Checklist -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Icon name="i-lucide-clipboard-check" class="size-3.5" />
              Pre-Flight Checklist
            </h4>

            <!-- Blocking Warnings (Red) -->
            <div v-if="blockingWarnings.length > 0" class="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
              <div class="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-2">
                <Icon name="i-lucide-x-circle" class="size-3.5 shrink-0" />
                <span class="text-[11px] font-bold uppercase tracking-widest">Missing Required ({{ blockingWarnings.length }})</span>
              </div>
              <div
                v-for="w in blockingWarnings"
                :key="w.field"
                class="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md bg-red-500/10 text-red-700 dark:text-red-300 cursor-pointer hover:bg-red-500/20 active:scale-95 transition-all group border border-transparent hover:border-red-500/30 shadow-sm"
                @click="scrollToField(w.field)"
              >
                <Icon name="i-lucide-alert-triangle" class="size-3.5 shrink-0 text-red-500 group-hover:scale-110 transition-transform" />
                <span class="font-bold truncate">{{ w.label }}</span>
                <Icon name="i-lucide-arrow-right" class="size-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-red-500" />
              </div>
            </div>

            <!-- All Clear -->
            <div v-if="blockingWarnings.length === 0" class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2.5">
              <div class="size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-check-circle-2" class="size-4 text-emerald-500" />
              </div>
              <div>
                <p class="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  All Checks Passed
                </p>
                <p class="text-[11px] text-emerald-600/80 dark:text-emerald-400/70">
                  Required fields verified. Ready to approve.
                </p>
              </div>
            </div>

            <!-- Soft Warnings (Amber) -->
            <div v-if="softWarnings.length > 0" class="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3 space-y-1.5">
              <div class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-2">
                <Icon name="i-lucide-info" class="size-3.5 shrink-0" />
                <span class="text-[11px] font-bold uppercase tracking-widest">Optional ({{ softWarnings.length }})</span>
              </div>
              <div
                v-for="w in softWarnings"
                :key="w.field"
                class="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-500/10 active:scale-95 transition-all group border border-transparent hover:border-amber-500/30 shadow-sm"
                @click="scrollToField(w.field)"
              >
                <Icon name="i-lucide-minus-circle" class="size-3 shrink-0 text-amber-500 group-hover:scale-110 transition-transform" />
                <span class="font-bold truncate">{{ w.label }}</span>
                <Icon name="i-lucide-arrow-right" class="size-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
              </div>
            </div>

            <!-- Computed Preview -->
            <div v-if="qcForm.priceDiscovery" class="rounded-xl border bg-muted/30 p-3 space-y-2 mt-2">
              <h4 class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Computed Preview
              </h4>
              <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <span class="text-muted-foreground">Auction Status</span>
                <span class="font-bold" :class="qcForm.auctionMode === 'makeLiveNow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'">
                  {{ qcForm.auctionMode === 'makeLiveNow' ? 'LIVE' : 'UPCOMING' }}
                </span>
                <span class="text-muted-foreground">Duration</span>
                <span class="font-semibold">{{ qcForm.auctionDuration }}h</span>
                <span class="text-muted-foreground">Contact #</span>
                <span class="font-mono font-semibold text-[11px]">{{ (editForm?.customerContactNumber || editForm?.contactNumber || '—').replace(/^\+91\s*/, '') }}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="sm:justify-end border-t pt-4">
          <Button variant="outline" @click="showQCModal = false">
            Cancel
          </Button>
          <Button
            :disabled="hasBlockingWarnings"
            :class="hasBlockingWarnings
              ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              : 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500 text-white font-bold shadow-md'"
            @click="confirmQCApproval"
          >
            <Icon :name="hasBlockingWarnings ? 'i-lucide-shield-alert' : 'i-lucide-check-circle-2'" class="mr-1.5 size-4" />
            {{ hasBlockingWarnings ? `Fix ${blockingWarnings.length} Issue(s)` : 'Confirm & Approve' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Reject Modal -->
    <Dialog :open="showRejectModal" @update:open="showRejectModal = $event">
      <DialogContent class="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reject Inspection</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this vehicle.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Rejection Reason</label>
            <textarea v-model="rejectReason" placeholder="Enter reason here..." class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" rows="3" required />
          </div>
        </div>

        <DialogFooter class="sm:justify-end">
          <Button variant="outline" @click="showRejectModal = false">
            Cancel
          </Button>
          <Button class="bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white font-bold" @click="confirmReject">
            Reject Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-10 animate-spin" />
        <p class="text-sm">
          Loading inspection details...
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-4 text-center max-w-md">
        <div class="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon name="i-lucide-alert-triangle" class="size-8 text-destructive" />
        </div>
        <h2 class="text-lg font-semibold">
          Failed to Load Details
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ error }}
        </p>
        <div class="flex gap-2">
          <Button variant="outline" @click="router.back()">
            <Icon name="i-lucide-arrow-left" class="mr-1 size-4" /> Go Back
          </Button>
          <Button @click="fetchCarDetails(carId)">
            <Icon name="i-lucide-refresh-cw" class="mr-1 size-4" /> Retry
          </Button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="car">
      <!-- Tab Bar (Moved to top) -->
      <div class="shrink-0 border-b bg-background/80 backdrop-blur-sm relative z-10 w-full overflow-hidden">
        <div class="flex gap-2 px-4 lg:px-6 py-2 overflow-x-auto no-scrollbar items-center">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap"
            :class="activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'"
            @click="setTab(tab.id)"
          >
            <Icon :name="tab.icon" class="size-4" />
            {{ tab.label }}
          </button>

          <div class="ml-auto flex items-center shrink-0 gap-2">
            <Button
              v-if="car.attesterRawCarDetails"
              class="h-8 w-8 p-0 shrink-0 border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20 shadow-sm"
              variant="outline"
              title="Attester Raw Car Details"
              @click="showAttesterModal = true"
            >
              <Icon name="i-lucide-scan-text" class="size-4" />
            </Button>
            <Button
              v-if="car.approvalStatus === 'Approved'"
              class="mr-2 h-8 text-xs font-bold shrink-0 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm"
              variant="outline"
              @click="downloadPDF"
            >
              <Icon :name="isGeneratingPdf ? 'i-lucide-loader-2' : 'i-lucide-file-down'" :class="{ 'animate-spin': isGeneratingPdf }" class="mr-1.5 size-4" />
              Inspection Report
            </Button>
            <Button
              v-if="!props.readonly && car.approvalStatus !== 'Approved'"
              class="mr-2 bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white font-bold shadow-sm h-8 text-xs shrink-0 px-4"
              @click="openRejectModal"
            >
              <Icon name="i-lucide-x-circle" class="mr-1.5 size-4" />
              Reject
            </Button>
            <Button
              v-if="!props.readonly && car.approvalStatus !== 'Approved'"
              class="bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500 text-white font-bold shadow-sm h-8 text-xs shrink-0 px-4"
              @click="openQCModal"
            >
              <Icon name="i-lucide-check-circle-2" class="mr-1.5 size-4" />
              Approve
            </Button>
            <template v-else-if="car.approvalStatus === 'Approved'">
              <Button
                v-if="hasAction('re-qc-button')"
                class="mr-2 h-8 text-xs font-bold shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20 shadow-sm"
                variant="outline"
                @click="revertToUnderReview"
              >
                <Icon name="i-lucide-refresh-ccw" class="mr-1.5 size-4" />
                Re-QC
              </Button>
              <Button
                v-if="hasAction('pd-button')"
                class="mr-2 h-8 text-xs font-bold shrink-0 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm"
                variant="outline"
                @click="openPDModal"
              >
                <Icon name="i-lucide-indian-rupee" class="mr-1.5 size-4" />
                PD
              </Button>
              <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-lg flex items-center justify-center font-bold px-3 h-8 text-xs shrink-0">
                <Icon name="i-lucide-shield-check" class="mr-1.5 size-4" />
                Approve
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Tab Content (scrollable) -->
      <div id="app-main-content-scroll" class="flex-1 min-h-0 overflow-auto bg-muted/10 auto-scroll-container">
        <div class="p-4 lg:p-6">
          <div v-if="activeTab === 'details'" class="animate-in fade-in duration-300 space-y-6">
            <!-- Hero Section — Card Architecture -->
            <div class="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col lg:flex-row">
              <!-- FAR LEFT: Vertical Status Strip -->
              <div class="hidden lg:flex flex-col w-12 shrink-0">
                <!-- Inspection Status Block -->
                <div class="flex-1 flex items-center justify-center text-white" :class="car.inspectionStatus === 'Inspected' ? 'bg-[#4285F4]' : 'bg-slate-400 dark:bg-slate-600'">
                  <span class="transform -rotate-180" style="writing-mode: vertical-rl; text-orientation: mixed;">
                    <span class="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] uppercase whitespace-nowrap">
                      <Icon :name="car.inspectionStatus === 'Inspected' ? 'i-lucide-scan-eye' : 'i-lucide-clock'" class="size-3.5 rounded-full bg-white/20 p-0.5" />
                      {{ car.inspectionStatus || 'Pending' }}
                    </span>
                  </span>
                </div>
                <!-- Approval Status Block -->
                <div class="flex-1 flex items-center justify-center text-white" :class="(car.approvalStatus || '').toLowerCase().includes('approved') ? 'bg-emerald-500' : (car.approvalStatus || '').toLowerCase().includes('reject') ? 'bg-red-500' : 'bg-[#FBBC05] text-amber-950'">
                  <span class="transform -rotate-180" style="writing-mode: vertical-rl; text-orientation: mixed;">
                    <span class="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] uppercase whitespace-nowrap">
                      <Icon :name="(car.approvalStatus || '').toLowerCase().includes('approved') ? 'i-lucide-check-circle' : (car.approvalStatus || '').toLowerCase().includes('reject') ? 'i-lucide-x-circle' : 'i-lucide-clock'" class="size-3.5 rounded-full bg-black/10 p-0.5" />
                      {{ car.approvalStatus || 'Under Review' }}
                    </span>
                  </span>
                </div>
              </div>

              <!-- LEFT: Image Area -->
              <div class="relative w-full lg:w-[320px] shrink-0 h-64 lg:h-auto overflow-hidden bg-muted group/item cursor-pointer" @click="getImages(editForm, 'frontMainImages', 'frontMain').length && openLightboxUrls(getImages(editForm, 'frontMainImages', 'frontMain'), 0, `${car.make} ${car.model}`)">
                <img
                  v-if="getImages(editForm, 'frontMainImages', 'frontMain').length"
                  :src="getImages(editForm, 'frontMainImages', 'frontMain')[0]"
                  :alt="`${car.make} ${car.model}`"
                  class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-105"
                >
                <div v-else class="absolute inset-0 w-full h-full flex items-center justify-center">
                  <Icon name="i-lucide-car" class="size-20 text-muted-foreground/30" />
                </div>

                <div v-if="getImages(editForm, 'frontMainImages', 'frontMain').length" class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none z-10">
                  Front Main Image 1
                </div>

                <div v-if="!props.readonly && getImages(editForm, 'frontMainImages', 'frontMain').length" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-opacity z-20">
                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage('frontMainImages', 0, 'frontMain')">
                    <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                  </Button>
                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-blue-500/90 hover:bg-blue-600 focus:outline-none" @click.stop="downloadImageFile(getImages(editForm, 'frontMainImages', 'frontMain')[0] || '', 'Front Main')">
                    <Icon name="i-lucide-download" class="size-3.5 text-white" />
                  </Button>
                  <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage('frontMainImages', 0, 'frontMain')">
                    <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                  </Button>
                </div>
              </div>

              <!-- MIDDLE: Data Grid -->
              <div class="flex-1 min-w-0 p-2 flex flex-col gap-6 z-10 relative">
                <!-- Stats Grid Layout -->
                <div class="flex flex-col gap-3 m-auto w-full">
                  <!-- Row 1: Make, Model, Variant, MFG Year -->
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <!-- Make -->
                    <div id="field-make" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden md:col-span-3">
                      <p class="text-xs text-muted-foreground mb-2 font-medium">
                        Make
                      </p>
                      <div class="mt-auto relative z-10 w-full">
                        <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.make">
                          {{ car.make || '—' }}
                        </div>
                        <SearchableSelect v-else v-model="editForm.make" :options="makeOptions" placeholder="Make" class-name="h-8 text-sm font-bold shadow-none w-full border-b border-t-0 border-x-0 rounded-none px-0" />
                      </div>
                    </div>

                    <!-- Model -->
                    <div id="field-model" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden md:col-span-4">
                      <p class="text-xs text-muted-foreground mb-2 font-medium">
                        Model
                      </p>
                      <div class="mt-auto relative z-10 w-full">
                        <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.model">
                          {{ car.model || '—' }}
                        </div>
                        <SearchableSelect v-else v-model="editForm.model" :options="modelOptions" placeholder="Model" class-name="h-8 text-sm font-bold shadow-none w-full border-b border-t-0 border-x-0 rounded-none px-0" />
                      </div>
                    </div>

                    <!-- Variant -->
                    <div id="field-variant" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden md:col-span-3">
                      <p class="text-xs text-muted-foreground mb-2 font-medium">
                        Variant
                      </p>
                      <div class="mt-auto relative z-10 w-full">
                        <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.variant">
                          {{ car.variant || '—' }}
                        </div>
                        <SearchableSelect v-else v-model="editForm.variant" :options="variantOptions" placeholder="Variant" class-name="h-8 w-full text-sm font-black shadow-none border-b border-t-0 border-x-0 rounded-none px-0" />
                      </div>
                    </div>
                    <!-- MFG Year -->
                    <div id="field-yearMonthOfManufacture" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden md:col-span-2">
                      <p class="text-xs text-muted-foreground mb-1 font-medium">
                        MFG Year
                      </p>
                      <div v-if="props.readonly" class="text-2xl font-black text-foreground mt-auto tracking-tight break-words">
                        {{ car.yearMonthOfManufacture ? `${String(new Date(car.yearMonthOfManufacture).getMonth() + 1).padStart(2, '0')} / ${new Date(car.yearMonthOfManufacture).getFullYear()}` : '—' }}
                      </div>
                      <Input v-else :model-value="editForm.yearMonthOfManufacture ? new Date(editForm.yearMonthOfManufacture).toISOString().slice(0, 7) : ''" type="month" class="h-8 mt-auto text-lg font-black border-none bg-transparent p-0 focus-visible:ring-0 shadow-none w-full text-foreground" @update:model-value="editForm.yearMonthOfManufacture = $event ? new Date($event).toISOString() : ''" />
                    </div>
                  </div>

                  <!-- Bottom Row: Registration, Ownership & City -->
                  <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <!-- Registration Number & Source -->
                    <div id="field-registrationNumber" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 py-3 px-4 flex flex-col justify-center relative overflow-hidden gap-2">
                      <div class="flex flex-col">
                        <p class="text-[11px] text-muted-foreground font-medium uppercase tracking-wider leading-tight">
                          Registration
                        </p>
                        <div v-if="props.readonly" class="text-lg md:text-xl font-black text-foreground break-all uppercase leading-tight mt-0.5" :title="car.registrationNumber">
                          {{ car.registrationNumber || '—' }}
                        </div>
                        <Input v-else v-model="editForm.registrationNumber" class="h-7 text-lg font-black uppercase border-none bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground w-full" placeholder="MH01..." />
                      </div>
                      <div class="w-full h-px bg-border/50" />
                      <div class="flex flex-col">
                        <p class="text-[11px] text-muted-foreground font-medium uppercase tracking-wider leading-tight">
                          Source
                        </p>
                        <div class="text-sm font-bold text-violet-600 dark:text-violet-400 truncate mt-0.5" :title="car.appointmentSource">
                          {{ car.appointmentSource || '—' }}
                        </div>
                      </div>
                    </div>

                    <!-- Registration Date -->
                    <div id="field-registrationDate" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-1 font-medium">
                        Reg. Date
                      </p>
                      <div class="mt-auto relative z-10 w-full">
                        <div v-if="props.readonly" class="text-xl font-black text-foreground truncate" :title="formatDateMMDDYYYY(car.registrationDate)">
                          {{ formatDateMMDDYYYY(car.registrationDate) || '—' }}
                        </div>
                        <Input v-else :model-value="formatDateYYYYMMDD(editForm.registrationDate)" type="date" class="h-8 max-w-[140px] text-[15px] font-black border-none bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground" @update:model-value="editForm.registrationDate = $event" />
                      </div>
                    </div>

                    <!-- Ownership & Registered Owner -->
                    <div id="field-ownerSerialNumber" class="transition-all duration-500 md:col-span-2 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between overflow-hidden relative group">
                      <p class="text-[11px] text-muted-foreground mb-1.5 font-bold uppercase tracking-widest leading-none">
                        Ownership
                      </p>

                      <!-- Owner Name -->
                      <div class="relative z-10 w-full mb-3 flex-1 min-h-0 flex flex-col justify-center">
                        <div v-if="props.readonly" class="text-xl font-black text-foreground truncate uppercase tracking-tight" :title="car.registeredOwner">
                          {{ car.registeredOwner || '—' }}
                        </div>
                        <Input v-else v-model="editForm.registeredOwner" class="h-8 w-full text-lg uppercase font-black tracking-tight border-none bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground/30" placeholder="ENTER OWNER NAME" />
                      </div>

                      <!-- Serial Number Ribbon -->
                      <div class="flex gap-1.5 h-8 mt-auto w-full z-10 relative">
                        <!-- If readonly -->
                        <template v-if="props.readonly">
                          <div class="bg-blue-600 text-white rounded px-5 flex items-center justify-center font-black text-[13px] shadow-md ring-1 ring-blue-600">
                            {{ Number(car.ownerSerialNumber || 1) }}{{ Number(car.ownerSerialNumber || 1) === 1 ? 'st' : Number(car.ownerSerialNumber || 1) === 2 ? 'nd' : Number(car.ownerSerialNumber || 1) === 3 ? 'rd' : 'th' }}
                          </div>
                          <div class="flex gap-1.5 opacity-40">
                            <div v-for="n in 5" v-show="n !== Number(car.ownerSerialNumber || 1)" :key="n" class="w-10 rounded border border-border/60 bg-muted/30 flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                              {{ n }}{{ n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th' }}
                            </div>
                          </div>
                        </template>
                        <!-- If editable -->
                        <template v-else>
                          <button
                            v-for="n in 5"
                            :key="n"
                            type="button"
                            class="flex-1 rounded text-[13px] font-black transition-all duration-200 border flex items-center justify-center"
                            :class="Number(editForm.ownerSerialNumber) === n
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-1 ring-blue-600/50 scale-[1.02] z-10'
                              : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'"
                            @click="editForm.ownerSerialNumber = n"
                          >
                            {{ n }}{{ n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th' }}
                          </button>
                        </template>
                      </div>

                      <!-- Decorative background icon -->
                      <div class="absolute right-0 bottom-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none translate-x-3 translate-y-4">
                        <Icon name="i-lucide-users" class="size-24" />
                      </div>
                    </div>

                    <!-- City -->
                    <div id="field-city" class="transition-all duration-500 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-1 font-medium">
                        City
                      </p>
                      <h3 class="text-xl font-black text-foreground tracking-tight mt-auto relative z-10">
                        {{ car.city || '—' }}
                      </h3>
                      <!-- Map pin -->
                      <Icon name="i-lucide-map-pin" class="absolute top-4 right-4 size-5 text-muted-foreground/30" />
                      <!-- City skyline graphic placeholder -->
                      <div class="absolute -bottom-2 -right-2 opacity-10">
                        <Icon name="i-lucide-building-2" class="size-16" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- RIGHT IMAGE AREA -->
              <div class="relative w-full lg:w-[320px] shrink-0 h-64 lg:h-auto overflow-hidden bg-muted group/item cursor-pointer lg:border-l border-border/60" @click="getImages(editForm, 'rearMainImages', 'rearMain').length && openLightboxUrls(getImages(editForm, 'rearMainImages', 'rearMain'), 0, `${car.make} ${car.model}`)">
                <img
                  v-if="getImages(editForm, 'rearMainImages', 'rearMain').length"
                  :src="getImages(editForm, 'rearMainImages', 'rearMain')[0]"
                  :alt="`${car.make} ${car.model}`"
                  class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-105"
                >
                <div v-else class="absolute inset-0 w-full h-full flex items-center justify-center">
                  <Icon name="i-lucide-car" class="size-20 text-muted-foreground/30" />
                </div>

                <div v-if="getImages(editForm, 'rearMainImages', 'rearMain').length" class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none z-10">
                  Rear Main Image 1
                </div>

                <div v-if="!props.readonly && getImages(editForm, 'rearMainImages', 'rearMain').length" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-opacity z-20">
                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage('rearMainImages', 0, 'rearMain')">
                    <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                  </Button>
                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-blue-500/90 hover:bg-blue-600 focus:outline-none" @click.stop="downloadImageFile(getImages(editForm, 'rearMainImages', 'rearMain')[0] || '', 'Rear Main')">
                    <Icon name="i-lucide-download" class="size-3.5 text-white" />
                  </Button>
                  <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage('rearMainImages', 0, 'rearMain')">
                    <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                  </Button>
                </div>
              </div>

              <!-- FAR RIGHT: Vertical User Strip -->
              <div class="hidden lg:flex flex-col w-12 shrink-0 border-l border-border/60">
                <!-- Inspected By Block -->
                <div class="flex-1 flex items-center justify-center border-b border-white/10" :class="car.inspectionStatus === 'Inspected' ? 'bg-[#4285F4] text-white' : 'bg-slate-400 dark:bg-slate-600 text-white'">
                  <span class="transform -rotate-180" style="writing-mode: vertical-rl; text-orientation: mixed;">
                    <span class="flex items-center gap-2 text-[11px] font-black tracking-[0.15em] uppercase whitespace-nowrap">
                      <span class="text-[9px] opacity-70 tracking-widest mt-1">BY</span>
                      <span>{{ (allocatedToName || 'UA').split(/[\s_]+/)[0] }}</span>
                    </span>
                  </span>
                </div>
                <!-- Reviewing By Block -->
                <div class="flex-1 flex items-center justify-center" :class="(car.approvalStatus || '').toLowerCase().includes('approved') ? 'bg-emerald-500 text-white' : (car.approvalStatus || '').toLowerCase().includes('reject') ? 'bg-red-500 text-white' : 'bg-[#FBBC05] text-amber-950'">
                  <span class="transform -rotate-180" style="writing-mode: vertical-rl; text-orientation: mixed;">
                    <span class="flex items-center gap-2 text-[11px] font-black tracking-[0.15em] uppercase whitespace-nowrap">
                      <span class="text-[9px] opacity-70 tracking-widest mt-1">{{ car.approvalStatus === 'Approved' ? 'QC BY' : 'BY' }}</span>
                      <span>{{ (qcByName || 'QC').split(/[\s_]+/)[0] }}</span>
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Attester Raw Car Details Inline Panel -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="opacity-0 -translate-y-3 max-h-0"
              enter-to-class="opacity-100 translate-y-0 max-h-[600px]"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="opacity-100 translate-y-0 max-h-[600px]"
              leave-to-class="opacity-0 -translate-y-3 max-h-0"
            >
              <div
                v-if="showAttesterModal && car.attesterRawCarDetails"
                class="overflow-hidden rounded-xl border border-violet-500/30 bg-violet-50/40 dark:bg-violet-950/20 shadow-sm"
              >
                <!-- Panel Header -->
                <div class="flex items-center gap-2.5 px-4 py-3 border-b border-violet-500/20 bg-violet-500/5">
                  <div class="size-7 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                    <Icon name="i-lucide-scan-text" class="size-3.5 text-violet-500" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                      Attester Raw Car Details
                    </p>
                    <p class="text-[10px] text-muted-foreground">
                      {{ car.appointmentId }} · Press <kbd class="px-1 py-0.5 rounded border border-border text-[9px] font-mono">Esc</kbd> to close
                    </p>
                  </div>
                  <button
                    class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-violet-500/10 hover:text-violet-600 transition-colors"
                    @click="showAttesterModal = false"
                  >
                    <Icon name="i-lucide-x" class="size-3.5" />
                  </button>
                </div>
                <!-- Panel Body -->
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0 divide-x divide-y divide-violet-500/10 max-h-[300px] overflow-y-auto">
                  <div
                    v-for="(value, key) in car.attesterRawCarDetails"
                    :key="key"
                    class="px-3 py-2 flex flex-col gap-0.5"
                  >
                    <span class="text-[9px] font-bold text-violet-500/70 uppercase tracking-widest truncate">
                      {{ String(key).replace(/([A-Z])/g, ' $1').trim() }}
                    </span>
                    <span
                      v-if="value === null || value === undefined"
                      class="text-[11px] text-muted-foreground/50 italic"
                    >—</span>
                    <span
                      v-else-if="typeof value === 'boolean'"
                      class="text-[11px] font-bold"
                      :class="value ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
                    >{{ value ? 'Yes' : 'No' }}</span>
                    <span
                      v-else
                      class="text-[11px] text-foreground font-medium leading-tight break-all"
                    >{{ value }}</span>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- All Document Details (spreadsheet-driven new→old field mapping) -->
            <Card class="!py-0 !gap-0 overflow-hidden">
              <CardContent class="pt-4 pb-5">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
                  <template v-for="field in documentDetailFields" :key="field.key">
                    <!-- IMAGE / COMBINED Box field — same card style as exterior tabs -->
                    <div v-if="field.type === 'multiple' || field.type === 'combinedBox'">
                      <div class="rounded-xl border bg-card shadow-sm flex flex-row overflow-hidden min-h-[160px] h-[160px]">
                        <!-- Left Panel -->
                        <div class="flex flex-col shrink-0 border-r border-border/50 bg-muted/10" :class="field.hideImages ? 'flex-1' : (field.type === 'combinedBox' ? 'w-[280px] xl:w-[320px]' : 'w-[200px] xl:w-[240px]')">
                          <!-- Default multiple UI -->
                          <!-- Default multiple UI -->
                          <div v-if="field.type === 'multiple'" class="h-full w-full flex flex-col bg-white/50 dark:bg-black/20">
                            <div class="px-3 py-2 border-b border-border/50 flex items-center justify-center bg-muted/30 h-10 shrink-0">
                              <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{{ field.label }}</span>
                            </div>
                            <div class="p-4 flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-60">
                              <Icon name="i-lucide-camera" class="size-5 text-muted-foreground" />
                              <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-tight">Images<br>Section</span>
                            </div>
                          </div>
                          <!-- Combined Box UI -->
                          <div v-else-if="field.type === 'combinedBox'" class="flex h-full w-full flex-col overflow-hidden leading-snug">
                            <div class="flex-1 w-full flex flex-col overflow-y-auto">
                              <template v-for="partItem in field.splitParts" :key="partItem.key">
                                <div class="flex-1 px-3 py-2 border-b border-border/50 last:border-b-0 flex flex-col justify-center gap-1.5 overflow-hidden bg-white/40 dark:bg-black/20">
                                  <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 truncate w-full" :title="partItem.label">{{ partItem.label }}</span>
                                  <div class="w-full min-w-0 pointer-events-auto flex items-center">
                                    <template v-if="props.readonly">
                                      <div v-if="['dropdown', 'multiselect'].includes(partItem.type) && getDisplayValues(editForm, partItem.key, partItem.oldKey).length" class="flex flex-wrap gap-1.5 w-full">
                                        <div
                                          v-for="val in getDisplayValues(editForm, partItem.key, partItem.oldKey)"
                                          :key="val"
                                          class="px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-border/50 truncate w-max"
                                          :class="getConditionStyle(val).bg"
                                        >
                                          <Icon :name="getConditionStyle(val).icon" class="size-3 shrink-0" />
                                          <span class="truncate max-w-[180px]">{{ val }}</span>
                                        </div>
                                      </div>
                                      <p v-else class="text-xs font-medium px-2 py-1.5 bg-muted/50 rounded border border-border/50 truncate w-full" :class="!getDisplayValues(editForm, partItem.key, partItem.oldKey).length ? 'text-muted-foreground' : ''">
                                        {{ partItem.type === 'date' ? (formatDateMMDDYYYY(getSingleDisplayValue(editForm, partItem.key, partItem.oldKey)) || '—') : (getDisplayValues(editForm, partItem.key, partItem.oldKey).join(', ') || '—') }}
                                      </p>
                                    </template>
                                    <template v-else>
                                      <Input v-if="partItem.type === 'date'" :model-value="formatDateYYYYMMDD(editForm[partItem.key])" type="date" class="h-8 text-xs font-medium w-full bg-background" @update:model-value="editForm[partItem.key] = $event" />
                                      <Input v-else-if="partItem.type === 'single'" v-model="editForm[partItem.key]" class="h-8 text-xs font-medium w-full bg-background" />
                                      <SearchableSelect v-else v-model="editForm[partItem.key]" :options="partItem.staticOptions || getOptions(partItem.dropdownName || '')" class-name="h-8 shadow-sm text-xs font-medium w-full bg-background mt-0 border-border/80" />
                                    </template>
                                  </div>
                                </div>
                              </template>
                            </div>
                          </div>
                        </div>
                        <!-- Right: Image Strip OR Alternate Config -->
                        <div v-if="field.hideImages" class="flex-1 flex flex-col overflow-y-auto bg-muted/5 dark:bg-muted/10">
                          <template v-for="partItem in (field.rightParts || [])" :key="partItem.key + (partItem.imageIndex ?? '')">
                            <!-- IMAGE SLOT type: inline image thumbnail for indexed arrays -->
                            <div v-if="partItem.type === 'imageSlot'" class="flex-1 px-2 py-1.5 border-b border-border/50 last:border-b-0 flex items-center gap-2 overflow-hidden bg-zinc-950/5 dark:bg-black/30 min-h-[48px]">
                              <template v-if="getImages(editForm, partItem.key, partItem.oldKey, partItem.imageIndex).length">
                                <div
                                  class="relative shrink-0 h-10 w-14 rounded overflow-hidden cursor-pointer group/imgslot border border-border/50 shadow-sm"
                                  @click="openLightboxUrls(getImages(editForm, partItem.key, partItem.oldKey, partItem.imageIndex), 0, partItem.label)"
                                >
                                  <img :src="getImages(editForm, partItem.key, partItem.oldKey, partItem.imageIndex)[0]" :alt="partItem.label" class="w-full h-full object-cover select-none" loading="lazy">
                                </div>
                                <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate flex-1">{{ partItem.label }}</span>
                                <div v-if="!props.readonly" class="flex items-center gap-1 shrink-0">
                                  <Button variant="secondary" size="icon" class="size-6 rounded-full bg-white/80 hover:bg-white shadow-sm" @click.stop="replaceImage(partItem.key, 0, partItem.oldKey, partItem.imageIndex)">
                                    <Icon name="i-lucide-refresh-cw" class="size-3 text-primary" />
                                  </Button>
                                  <Button variant="destructive" size="icon" class="size-6 rounded-full bg-red-500/80 hover:bg-red-600 shadow-sm" @click.stop="removeImage(partItem.key, 0, partItem.oldKey, partItem.imageIndex)">
                                    <Icon name="i-lucide-trash" class="size-3 text-white" />
                                  </Button>
                                </div>
                              </template>
                              <template v-else>
                                <div v-if="!props.readonly" class="flex items-center gap-2 w-full cursor-pointer hover:bg-muted/20 rounded px-1 py-1 transition-colors" @click.stop="addImage(partItem.key, partItem.imageIndex)">
                                  <div class="size-10 w-14 rounded border-2 border-dashed border-border/60 flex items-center justify-center shrink-0 bg-muted/20">
                                    <Icon name="i-lucide-image-plus" class="size-4 text-muted-foreground/50" />
                                  </div>
                                  <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 truncate">Add {{ partItem.label }}</span>
                                </div>
                                <div v-else class="flex items-center gap-2 w-full px-1 py-1">
                                  <div class="size-10 w-14 rounded border border-border/30 flex items-center justify-center shrink-0 bg-muted/10">
                                    <Icon name="i-lucide-image-off" class="size-4 text-muted-foreground/30" />
                                  </div>
                                  <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 truncate">{{ partItem.label }}</span>
                                </div>
                              </template>
                            </div>
                            <!-- Standard form field (dropdown/text/date) -->
                            <div v-else class="flex-1 px-3 py-2 border-b border-border/50 last:border-b-0 flex flex-col justify-center gap-1.5 overflow-hidden bg-white/40 dark:bg-black/20">
                              <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 truncate w-full" :title="partItem.label">{{ partItem.label }}</span>
                              <div class="w-full min-w-0 pointer-events-auto flex items-center">
                                <template v-if="props.readonly">
                                  <div v-if="['dropdown', 'multiselect'].includes(partItem.type) && getDisplayValues(editForm, partItem.key, partItem.oldKey).length" class="flex flex-wrap gap-1.5 w-full">
                                    <div
                                      v-for="val in getDisplayValues(editForm, partItem.key, partItem.oldKey)"
                                      :key="val"
                                      class="px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-border/50 truncate w-max"
                                      :class="getConditionStyle(val).bg"
                                    >
                                      <Icon :name="getConditionStyle(val).icon" class="size-3 shrink-0" />
                                      <span class="truncate max-w-[180px]">{{ val }}</span>
                                    </div>
                                  </div>
                                  <p v-else class="text-xs font-medium px-2 py-1.5 bg-muted/50 rounded border border-border/50 truncate w-full" :class="!getDisplayValues(editForm, partItem.key, partItem.oldKey).length ? 'text-muted-foreground' : ''">
                                    {{ partItem.type === 'date' ? (formatDateMMDDYYYY(getSingleDisplayValue(editForm, partItem.key, partItem.oldKey)) || '—') : (getDisplayValues(editForm, partItem.key, partItem.oldKey).join(', ') || '—') }}
                                  </p>
                                </template>
                                <template v-else>
                                  <Input v-if="partItem.type === 'date'" :model-value="formatDateYYYYMMDD(editForm[partItem.key])" type="date" class="h-8 text-xs font-medium w-full bg-background" @update:model-value="editForm[partItem.key] = $event" />
                                  <Input v-else-if="partItem.type === 'single'" v-model="editForm[partItem.key]" class="h-8 text-xs font-medium w-full bg-background" />
                                  <SearchableSelect v-else v-model="editForm[partItem.key]" :options="partItem.staticOptions || getOptions(partItem.dropdownName || '')" class-name="h-8 shadow-sm text-xs font-medium w-full bg-background mt-0 border-border/80" />
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>
                        <div v-else class="flex-1 relative group bg-zinc-950/5 dark:bg-black/50 overflow-hidden flex flex-col">
                          <!-- Upload Progress Overlay -->
                          <Transition name="fade">
                            <div v-if="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]" class="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md">
                              <div class="flex flex-col items-center gap-3">
                                <div class="relative size-16">
                                  <svg class="size-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3" class="text-white/10" />
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="url(#uploadGrad)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="175.93" :stroke-dashoffset="175.93 - (175.93 * (uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.progress || 0) / 100)" class="transition-all duration-300 ease-out" />
                                    <defs><linearGradient id="uploadGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#818cf8" /><stop offset="100%" stop-color="#6366f1" /></linearGradient></defs>
                                  </svg>
                                  <div class="absolute inset-0 flex items-center justify-center">
                                    <Icon v-if="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'processing'" name="i-lucide-loader-2" class="size-5 text-indigo-300 animate-spin" />
                                    <Icon v-else-if="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'done'" name="i-lucide-check" class="size-5 text-emerald-400" />
                                    <span v-else class="text-sm font-black text-white tabular-nums">{{ uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.progress || 0 }}%</span>
                                  </div>
                                </div>
                                <span class="text-[10px] font-bold uppercase tracking-widest" :class="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'done' ? 'text-emerald-400' : uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'processing' ? 'text-indigo-300' : 'text-white/60'">
                                  {{ uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'done' ? 'Complete' : uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'processing' ? 'Processing...' : 'Uploading...' }}
                                </span>
                              </div>
                            </div>
                          </Transition>
                          <div v-if="getImages(editForm, field.imageKey || field.key, field.oldImageKey || field.oldKey, field.imageIndex).length" class="flex-1 h-full w-full">
                            <div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-stretch">
                              <div
                                v-for="(imgUrl, idx) in getImages(editForm, field.imageKey || field.key, field.oldImageKey || field.oldKey, field.imageIndex)"
                                :key="idx"
                                class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer group/item transition-all duration-300 border-r border-border/20 last:border-r-0"
                                @click="openLightboxUrls(getImages(editForm, field.imageKey || field.key, field.oldImageKey || field.oldKey, field.imageIndex), idx, field.label)"
                              >
                                <img :src="imgUrl" :alt="field.label" class="w-full h-full object-cover select-none" loading="lazy">
                                <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none">
                                  {{ field.label }} Image {{ field.imageIndex !== undefined ? field.imageIndex + 1 : idx + 1 }}
                                </div>
                                <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-opacity z-10">
                                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(field.imageKey || field.key, idx, field.oldImageKey || field.oldKey, field.imageIndex)">
                                    <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                                  </Button>
                                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-blue-500/90 hover:bg-blue-600 focus:outline-none" @click.stop="downloadImageFile(imgUrl, field.label || '')">
                                    <Icon name="i-lucide-download" class="size-3.5 text-white" />
                                  </Button>
                                  <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage(field.imageKey || field.key, idx, field.oldImageKey || field.oldKey, field.imageIndex)">
                                    <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                                  </Button>
                                </div>
                              </div>
                              <!-- Add Photo Endcap -->
                              <div
                                v-if="!props.readonly"
                                class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer bg-muted/30 border-r border-border/20 last:border-r-0 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors group/add p-3 text-center"
                                @click.stop="addImage(field.imageKey || field.key, field.imageIndex)"
                              >
                                <div class="size-10 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-2 group-hover/add:scale-110 transition-transform">
                                  <Icon name="i-lucide-plus" class="size-5 text-primary" />
                                </div>
                                <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                                  Add<br>
                                  <span v-if="field.type === 'combinedBox' || field.type === 'multiple'" class="text-[9px] font-black text-primary/70">
                                    {{ field.label }}<br>Image {{ field.imageIndex !== undefined ? field.imageIndex + 1 : getImages(editForm, field.imageKey || field.key, field.oldImageKey || field.oldKey).length + 1 }}
                                  </span>
                                  <span v-else>Photo</span>
                                </span>
                              </div>
                            </div>
                            <div v-if="getImages(editForm, field.imageKey || field.key, field.oldImageKey || field.oldKey, field.imageIndex).length > 1" class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[8px] text-white font-medium tracking-wider pointer-events-none">
                              SWIPE
                            </div>
                          </div>
                          <!-- Empty State -->
                          <div v-else-if="!props.readonly" class="flex h-full w-full flex-col items-center justify-center bg-transparent gap-3 relative cursor-pointer hover:bg-muted/10 transition-colors" @click.stop="addImage(field.imageKey || field.key, field.imageIndex)">
                            <!-- Upload Progress in Empty State -->
                            <Transition name="fade">
                              <div v-if="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]" class="absolute inset-0 z-30 flex items-center justify-center bg-background/90 dark:bg-black/80 backdrop-blur-sm">
                                <div class="flex flex-col items-center gap-3">
                                  <div class="relative size-16">
                                    <svg class="size-16 -rotate-90" viewBox="0 0 64 64">
                                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3" class="text-muted/30" />
                                      <circle cx="32" cy="32" r="28" fill="none" stroke="url(#uploadGradEmpty)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="175.93" :stroke-dashoffset="175.93 - (175.93 * (uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.progress || 0) / 100)" class="transition-all duration-300 ease-out" />
                                      <defs><linearGradient id="uploadGradEmpty" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#818cf8" /><stop offset="100%" stop-color="#6366f1" /></linearGradient></defs>
                                    </svg>
                                    <div class="absolute inset-0 flex items-center justify-center">
                                      <Icon v-if="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'processing'" name="i-lucide-loader-2" class="size-5 text-indigo-500 animate-spin" />
                                      <Icon v-else-if="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'done'" name="i-lucide-check" class="size-5 text-emerald-500" />
                                      <span v-else class="text-sm font-black text-foreground tabular-nums">{{ uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.progress || 0 }}%</span>
                                    </div>
                                  </div>
                                  <span class="text-[10px] font-bold uppercase tracking-widest" :class="uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground'">
                                    {{ uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'done' ? 'Complete' : uploadProgress[field.imageIndex !== undefined ? `${field.imageKey || field.key}__${field.imageIndex}` : (field.imageKey || field.key)]?.status === 'processing' ? 'Processing...' : 'Uploading...' }}
                                  </span>
                                </div>
                              </div>
                            </Transition>
                            <div class="size-12 rounded-full bg-muted/30 flex items-center justify-center">
                              <Icon name="i-lucide-image-plus" class="size-5 text-muted-foreground/50" />
                            </div>
                            <span class="text-[11px] text-muted-foreground/60 font-bold tracking-widest uppercase text-center leading-relaxed">
                              Click to add
                              <template v-if="field.type === 'combinedBox' || field.type === 'multiple'">
                                <br><span class="text-primary/70">{{ field.label }} Image {{ field.imageIndex !== undefined ? field.imageIndex + 1 : 1 }}</span>
                              </template>
                              <template v-else>Photo</template>
                            </span>
                          </div>
                          <div v-else class="flex h-full w-full flex-col items-center justify-center bg-transparent gap-3 relative">
                            <div class="size-12 rounded-full bg-muted/30 flex items-center justify-center">
                              <Icon name="i-lucide-image-off" class="size-5 text-muted-foreground/50" />
                            </div>
                            <span class="text-[11px] text-muted-foreground/60 font-bold tracking-widest uppercase">No Photos</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- DROPDOWN field -->
                    <div v-else-if="field.type === 'dropdown'" :id="`field-${field.key}`" class="transition-all duration-500 rounded-lg -mx-2 px-2 flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <template v-if="props.readonly">
                        <div v-if="getDisplayValues(editForm, field.key, field.oldKey).length" class="flex flex-wrap justify-end gap-1.5 w-2/3">
                          <div
                            v-for="val in getDisplayValues(editForm, field.key, field.oldKey)"
                            :key="val"
                            class="px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-border/50 truncate w-max"
                            :class="getConditionStyle(val).bg"
                          >
                            <Icon :name="getConditionStyle(val).icon" class="size-3 shrink-0" />
                            <span class="truncate max-w-[180px]">{{ val }}</span>
                          </div>
                        </div>
                        <p v-else class="text-sm font-medium text-right w-2/3 text-muted-foreground">
                          —
                        </p>
                      </template>
                      <SearchableSelect v-else v-model="editForm[field.key]" :options="field.staticOptions || getOptions(field.dropdownName || '')" class-name="w-2/3 h-8 shadow-sm text-sm" />
                    </div>
                    <!-- MULTISELECT field -->
                    <div v-else-if="field.type === 'multiselect'" :id="`field-${field.key}`" class="transition-all duration-500 rounded-lg -mx-2 px-2 flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <template v-if="props.readonly">
                        <div v-if="getDisplayValues(editForm, field.key, field.oldKey).length" class="flex flex-wrap justify-end gap-1.5 w-2/3">
                          <div
                            v-for="val in getDisplayValues(editForm, field.key, field.oldKey)"
                            :key="val"
                            class="px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-border/50 truncate w-max"
                            :class="getConditionStyle(val).bg"
                          >
                            <Icon :name="getConditionStyle(val).icon" class="size-3 shrink-0" />
                            <span class="truncate max-w-[180px]">{{ val }}</span>
                          </div>
                        </div>
                        <p v-else class="text-sm font-medium text-right w-2/3 text-muted-foreground">
                          —
                        </p>
                      </template>
                      <div v-else class="w-2/3">
                        <MultiSelect :model-value="editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : '')" :options="getOptions(field.dropdownName || '')" class="w-full" @update:model-value="editForm[field.key] = $event">
                          <template #trigger>
                            <Button variant="outline" class="w-full h-8 flex justify-between items-center text-sm px-3 shadow-sm bg-transparent border-input text-foreground font-normal overflow-hidden group">
                              <span class="truncate pr-2 w-full text-left font-medium group-hover:text-primary transition-colors">
                                {{ getValuesArray(editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : '')).length ? getValuesArray(editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : '')).join(', ') : 'Select...' }}
                              </span>
                              <Icon name="i-lucide-chevron-down" class="size-3.5 opacity-50 shrink-0 group-hover:text-primary transition-colors" />
                            </Button>
                          </template>
                          <template #option="{ option, selected }">
                            <div
                              class="flex-1 flex items-center gap-2 px-2 py-1.5 rounded shadow-sm w-full transition-all duration-200"
                              :class="[
                                getConditionStyle(option.label).bg,
                                selected ? '!border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-background font-black scale-[1.02] z-10' : 'opacity-85 hover:opacity-100',
                              ]"
                            >
                              <Icon :name="getConditionStyle(option.label).icon" class="size-4 shrink-0" />
                              <span class="text-[13px]" :class="selected ? 'font-black' : 'font-bold'">{{ option.label }}</span>
                            </div>
                          </template>
                        </MultiSelect>
                      </div>
                    </div>
                    <!-- DATE field -->
                    <div v-else-if="field.type === 'date'" :id="`field-${field.key}`" class="transition-all duration-500 rounded-lg -mx-2 px-2 flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <p v-if="props.readonly" class="text-sm font-medium text-right w-2/3">
                        {{ formatDateMMDDYYYY(getSingleDisplayValue(editForm, field.key, field.oldKey)) }}
                      </p>
                      <Input
                        v-else
                        :model-value="formatDateYYYYMMDD(getSingleDisplayValue(editForm, field.key, field.oldKey))"
                        type="date"
                        class="h-8 text-sm font-medium w-2/3 shadow-sm bg-transparent !border-0 focus-visible:ring-0 px-0 [&::-webkit-calendar-picker-indicator]:opacity-50"
                        @update:model-value="editForm[field.key] = $event"
                      />
                    </div>
                    <!-- SINGLE (text) field -->
                    <div v-else :id="`field-${field.key}`" class="transition-all duration-500 rounded-lg -mx-2 px-2 flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <p v-if="props.readonly" class="text-sm font-medium text-right w-2/3" :class="!getDisplayValues(editForm, field.key, field.oldKey).length ? 'text-muted-foreground' : ''">
                        {{ getDisplayValues(editForm, field.key, field.oldKey).join(', ') || '—' }}
                      </p>
                      <Input v-else v-model="editForm[field.key]" class="h-8 text-sm font-medium w-2/3" />
                    </div>
                  </template>
                </div>
              </CardContent>
            </Card>

            <!-- Document Details Overall Photos -->
            <div v-if="sectionImages(documentImageKeys).length" class="mt-8 mb-4">
              <div class="flex items-center gap-2 mb-4 px-2">
                <Icon name="i-lucide-images" class="size-5 text-primary" />
                <h3 class="text-base font-semibold tracking-tight">
                  Document Details Overall Photos
                </h3>
                <Separator class="flex-1 ml-2" />
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                <div
                  v-for="(img, idx) in sectionImages(documentImageKeys)"
                  :key="idx"
                  class="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md"
                  @click="openLightbox(sectionImages(documentImageKeys), idx)"
                >
                  <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy">
                  <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none truncate max-w-[90%]">
                    {{ img.label }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ═══════ EXTERIOR TABS AND ENGINE BAY ═══════ -->
          <div v-else-if="['front', 'left', 'rear', 'right', 'engine-bay', 'electricals', 'interior', 'steering-suspension-brakes'].includes(activeTab)" class="space-y-6">
            <!-- Condition Grid -->
            <Card class="!p-0 !py-0 overflow-hidden" style="padding: 0px !important;">
              <CardContent class="p-0 sm:p-0">
                <div v-if="activeExteriorSection" :key="activeExteriorSection.title" class="mb-0">
                  <!-- Parts grid -->
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
                    <div
                      v-for="part in activeExteriorSection.parts"
                      v-show="!(part as any).isLegacyFallback || getImages(editForm, (part as any).imageGroups?.[0]?.key || (part as any).imageKey, (part as any).imageGroups?.[0]?.oldKey || (part as any).oldImageKey).length > 0"
                      :id="`field-${part.key}`"
                      :key="part.key"
                      class="transition-all duration-500 rounded-xl border bg-card shadow-sm flex flex-col md:flex-row overflow-hidden"
                      :class="[
                        (part as any).hasNoImages && !(part as any).isVideoBox && !(part as any).rightParts && !(part as any).isFourPanel ? 'min-h-[100px]' : 'min-h-[160px]',
                        (part as any).isVideoBox ? 'row-span-2 h-auto min-h-[336px]' : 'h-auto md:h-[160px]',
                      ]"
                    >
                      <!-- ─── FOUR-PANEL horizontal layout ─── -->
                      <template v-if="(part as any).isFourPanel">
                        <div class="w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/50 overflow-hidden">
                          <template v-for="panel in ((part as any).fourPanels || [])" :key="panel.key + (panel.imageIndex ?? '')">
                            <!-- Image slot panel -->
                            <div v-if="panel.type === 'imageSlot'" class="flex-1 flex flex-col min-w-0 min-h-[160px]">
                              <div class="px-2 py-1.5 bg-muted/30 border-b border-border/50 shrink-0">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate block">{{ panel.label }}</span>
                              </div>
                              <div class="flex-1 relative overflow-hidden flex flex-col items-center justify-center bg-zinc-950/5 dark:bg-black/30 p-1.5 gap-1.5 min-w-0 min-h-0">
                                <template v-if="getImages(editForm, panel.key, panel.oldKey, panel.imageIndex).length">
                                  <div
                                    class="relative w-full flex-1 rounded overflow-hidden cursor-pointer border border-border/50 shadow-sm group/imgpanel min-h-0"
                                    @click="openLightboxUrls(getImages(editForm, panel.key, panel.oldKey, panel.imageIndex), 0, panel.label)"
                                  >
                                    <img :src="getImages(editForm, panel.key, panel.oldKey, panel.imageIndex)[0]" :alt="panel.label" class="w-full h-full object-cover select-none" loading="lazy">
                                    <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover/imgpanel:opacity-100 transition-opacity z-10">
                                      <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(panel.key, 0, panel.oldKey, panel.imageIndex)">
                                        <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                                      </Button>
                                      <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-blue-500/90 hover:bg-blue-600 focus:outline-none" @click.stop="downloadImageFile(getImages(editForm, panel.key, panel.oldKey, panel.imageIndex)[0] || '', panel.label || '')">
                                        <Icon name="i-lucide-download" class="size-3.5 text-white" />
                                      </Button>
                                      <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage(panel.key, 0, panel.oldKey, panel.imageIndex)">
                                        <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                                      </Button>
                                    </div>
                                  </div>
                                </template>
                                <template v-else>
                                  <div v-if="!props.readonly" class="flex flex-col items-center justify-center gap-1.5 cursor-pointer w-full h-full hover:bg-muted/20 rounded transition-colors p-2" @click.stop="addImage(panel.key, panel.imageIndex)">
                                    <div class="size-8 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center bg-muted/20">
                                      <Icon name="i-lucide-image-plus" class="size-4 text-muted-foreground/50" />
                                    </div>
                                    <span class="text-[9px] text-muted-foreground/50 uppercase tracking-wider text-center">Add</span>
                                  </div>
                                  <div v-else class="flex flex-col items-center justify-center gap-1 w-full h-full p-2">
                                    <Icon name="i-lucide-image-off" class="size-5 text-muted-foreground/30" />
                                  </div>
                                </template>
                              </div>
                            </div>
                            <!-- Dropdown panel -->
                            <div v-else class="flex-1 flex flex-col min-w-0 min-h-[160px]">
                              <div class="px-2 py-1.5 bg-muted/30 border-b border-border/50 shrink-0">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate block">{{ panel.label }}</span>
                              </div>
                              <div class="flex-1 p-2 flex flex-col justify-center bg-white/40 dark:bg-black/20">
                                <template v-if="props.readonly">
                                  <div v-if="getDisplayValues(editForm, panel.key, panel.oldKey).length" class="flex flex-col gap-1">
                                    <div v-for="val in getDisplayValues(editForm, panel.key, panel.oldKey)" :key="val" class="px-1.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm border border-border/50 truncate" :class="getConditionStyle(val).bg">
                                      <Icon :name="getConditionStyle(val).icon" class="size-3 shrink-0" />
                                      <span class="truncate">{{ val }}</span>
                                    </div>
                                  </div>
                                  <p v-else class="text-[10px] text-muted-foreground/50 px-1">
                                    —
                                  </p>
                                </template>
                                <template v-else>
                                  <SearchableSelect v-model="editForm[panel.key]" :options="getOptions(panel.dropdownName || '')" class-name="h-8 shadow-sm text-xs font-medium w-full bg-background border-border/80" />
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>
                      </template>
                      <template v-else-if="(part as any).isVideoBox">
                        <div class="w-full h-full flex flex-col p-3 bg-muted/5 relative overflow-hidden">
                          <div class="grid grid-cols-2 gap-3 flex-1 h-full w-full">
                            <template v-for="vk in engineVideoKeys" :key="vk.key">
                              <div class="flex flex-col gap-1.5 h-full relative">
                                <template v-if="getVideos(editForm, vk.key).length || (vk.oldKey && getVideos(editForm, vk.oldKey).length)">
                                  <div v-for="(videoUrl, vIdx) in (getVideos(editForm, vk.key).length ? getVideos(editForm, vk.key) : getVideos(editForm, vk.oldKey!))" :key="`${vk.key}-${vIdx}`" class="rounded-lg overflow-hidden border bg-black relative h-full flex-1 group">
                                    <!-- Label chip -->
                                    <div class="flex items-center gap-1.5 px-2 py-1 bg-black/70 rounded absolute top-2 left-2 z-20 pointer-events-none backdrop-blur-md">
                                      <Icon name="i-lucide-video" class="size-3 text-white/80" />
                                      <span class="text-[8px] font-bold uppercase tracking-wider text-white/90">{{ vk.label }}</span>
                                    </div>
                                    <!-- Loading spinner behind iframe -->
                                    <div class="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none z-0">
                                      <Icon name="i-lucide-loader-2" class="size-6 text-white/30 animate-spin" />
                                    </div>
                                    <template v-if="getEmbedUrl(videoUrl).type === 'iframe'">
                                      <iframe
                                        :src="getEmbedUrl(videoUrl).src"
                                        allow="autoplay; encrypted-media; fullscreen"
                                        allowfullscreen
                                        class="absolute inset-0 w-full h-full border-0 z-10"
                                      />
                                    </template>
                                    <template v-else>
                                      <video
                                        :src="getEmbedUrl(videoUrl).src"
                                        controls
                                        playsinline
                                        crossorigin="anonymous"
                                        preload="auto"
                                        class="absolute inset-0 w-full h-full object-cover z-10"
                                      >
                                        Your browser does not support the video tag.
                                      </video>
                                    </template>
                                    <!-- External open button — always visible -->
                                    <a
                                      :href="videoUrl"
                                      target="_blank"
                                      rel="noopener"
                                      class="absolute top-2 right-2 z-20 size-7 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-sm flex items-center justify-center transition-colors"
                                      title="Open in new tab"
                                      @click.stop
                                    >
                                      <Icon name="i-lucide-external-link" class="size-3.5 text-white" />
                                    </a>
                                    <!-- Edit overlay (non-readonly) -->
                                    <div v-if="!props.readonly" class="absolute top-2 right-10 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                      <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(vk.key, vIdx, vk.oldKey)">
                                        <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                                      </Button>
                                      <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-blue-500/90 hover:bg-blue-600 focus:outline-none" @click.stop="downloadImageFile(videoUrl, vk.label || '')">
                                        <Icon name="i-lucide-download" class="size-3.5 text-white" />
                                      </Button>
                                      <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage(vk.key, vIdx, vk.oldKey)">
                                        <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                                      </Button>
                                    </div>
                                  </div>
                                </template>
                                <template v-else>
                                  <div
                                    class="rounded-lg border border-dashed border-border flex flex-col items-center justify-center transition-colors relative h-full flex-1 min-h-[80px] overflow-hidden"
                                    :class="!props.readonly ? 'cursor-pointer bg-muted/20 hover:bg-muted/50 group/add' : 'bg-muted/10'"
                                    @click="!props.readonly && addImage(vk.key)"
                                  >
                                    <!-- Video Upload Progress Overlay -->
                                    <Transition name="fade">
                                      <div v-if="uploadProgress[vk.key]" class="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md rounded-lg">
                                        <div class="flex flex-col items-center gap-2">
                                          <div class="relative size-14">
                                            <svg class="size-14 -rotate-90" viewBox="0 0 64 64">
                                              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3" class="text-white/10" />
                                              <circle cx="32" cy="32" r="28" fill="none" stroke="url(#uploadGradVid)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="175.93" :stroke-dashoffset="175.93 - (175.93 * (uploadProgress[vk.key]?.progress || 0) / 100)" class="transition-all duration-300 ease-out" />
                                              <defs><linearGradient id="uploadGradVid" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#818cf8" /><stop offset="100%" stop-color="#6366f1" /></linearGradient></defs>
                                            </svg>
                                            <div class="absolute inset-0 flex items-center justify-center">
                                              <Icon v-if="uploadProgress[vk.key]?.status === 'processing'" name="i-lucide-loader-2" class="size-4 text-indigo-300 animate-spin" />
                                              <Icon v-else-if="uploadProgress[vk.key]?.status === 'done'" name="i-lucide-check" class="size-4 text-emerald-400" />
                                              <span v-else class="text-xs font-black text-white tabular-nums">{{ uploadProgress[vk.key]?.progress || 0 }}%</span>
                                            </div>
                                          </div>
                                          <span class="text-[8px] font-bold uppercase tracking-widest" :class="uploadProgress[vk.key]?.status === 'done' ? 'text-emerald-400' : 'text-white/60'">
                                            {{ uploadProgress[vk.key]?.status === 'done' ? 'Done' : uploadProgress[vk.key]?.status === 'processing' ? 'Processing...' : 'Uploading...' }}
                                          </span>
                                        </div>
                                      </div>
                                    </Transition>
                                    <div v-if="!props.readonly" class="size-10 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-2 group-hover/add:scale-110 transition-transform">
                                      <Icon name="i-lucide-plus" class="size-5 text-primary" />
                                    </div>
                                    <Icon v-else name="i-lucide-video-off" class="size-6 text-muted-foreground/30 mb-1" />
                                    <span class="text-[9px] font-bold uppercase text-muted-foreground/50 tracking-wider">
                                      {{ !props.readonly ? 'Add Video' : `No ${vk.label}` }}
                                    </span>
                                  </div>
                                </template>
                              </div>
                            </template>
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <!-- Left Side: Controls & Condition (hidden when rightParts-only) -->
                        <div v-if="(part as any).splitParts || !(part as any).rightParts" class="flex overflow-hidden h-full min-h-0 min-w-0" :class="[(part as any).isVerticalSplit ? 'flex-col' : 'flex-row', ((part as any).hasNoImages && !(part as any).rightParts) ? 'flex-1' : 'shrink-0']">
                          <template v-for="(renderPart, rIdx) in ((part as any).splitParts || [part])" :key="renderPart.key">
                            <div
                              class="flex flex-col shrink-0 bg-muted/10 relative min-h-0 min-w-0"
                              :class="[
                                (part as any).isVerticalSplit ? 'h-1/2 w-[200px] xl:w-[240px]' : (part as any).splitParts ? (((part as any).hasNoImages && !(part as any).rightParts) ? ((part as any).splitParts.length === 1 ? 'h-full w-full' : 'h-full w-1/2') : 'h-full w-[240px] xl:w-[280px]') : (renderPart as any).hasNoImages ? 'h-full w-full' : 'h-full w-[200px] xl:w-[240px]',
                                rIdx === 0 && (part as any).splitParts && !(part as any).isVerticalSplit && (part as any).splitParts.length > 1 ? 'border-r border-border/50' : '',
                                rIdx === 0 && (part as any).isVerticalSplit ? 'border-b border-border/50' : '',
                                !((part as any).splitParts) && !(renderPart as any).hasNoImages ? 'border-r border-border/50' : '',
                              ]"
                            >
                              <template v-if="(renderPart as any).isImageOnly">
                                <div class="h-full w-full flex flex-col bg-white/50 dark:bg-black/20">
                                  <div class="px-3 py-2 border-b border-border/50 flex items-center justify-center bg-muted/30 h-10 shrink-0">
                                    <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{{ renderPart.label }}</span>
                                  </div>
                                  <div class="p-4 flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-60">
                                    <Icon name="i-lucide-camera" class="size-5 text-muted-foreground" />
                                    <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-tight">Images Only<br>Section</span>
                                  </div>
                                </div>
                              </template>
                              <template v-else-if="!props.readonly && getOptions((renderPart as any).dropdownName || renderPart.label).length">
                                <MultiSelect
                                  v-model="editForm[renderPart.key]"
                                  :options="getOptions((renderPart as any).dropdownName || renderPart.label)"
                                  class="h-full border-none shadow-none bg-transparent"
                                >
                                  <template #trigger>
                                    <div class="cursor-pointer h-full w-full flex flex-col hover:bg-muted/20 transition-colors group relative">
                                      <!-- Header Label -->
                                      <div class="px-3 py-2 border-b border-border/50 flex items-center justify-between bg-muted/30 h-10 shrink-0">
                                        <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate group-hover:text-primary transition-colors">{{ renderPart.label }}</span>
                                        <Icon name="i-lucide-chevron-down" class="size-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                                      </div>

                                      <!-- Selected Badges Render -->
                                      <div class="p-3 flex-1 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white/50 dark:bg-black/20" :class="(renderPart as any).hasNoImages ? 'max-h-[120px]' : ''">
                                        <div v-if="getValuesArray(editForm[renderPart.key]).length" class="flex flex-wrap gap-2">
                                          <div
                                            v-for="val in getValuesArray(editForm[renderPart.key])"
                                            :key="val"
                                            class="border px-2 py-1.5 rounded flex items-center gap-1.5 shadow-sm"
                                            :class="[(renderPart as any).hasNoImages ? 'w-auto' : 'w-full', getConditionStyle(val).bg]"
                                          >
                                            <Icon :name="getConditionStyle(val).icon" class="size-4 shrink-0" />
                                            <span class="text-[13px] font-bold leading-tight">{{ val }}</span>
                                          </div>
                                        </div>
                                        <div v-else class="text-[12px] text-muted-foreground font-medium flex items-center justify-center gap-1.5 opacity-50 my-auto pb-4">
                                          <Icon name="i-lucide-list-plus" class="size-4" /> Click to add conds..
                                        </div>
                                      </div>
                                    </div>
                                  </template>

                                  <template #option="{ option, selected }">
                                    <Icon
                                      name="i-lucide-check"
                                      class="size-4 shrink-0 transition-opacity mr-2"
                                      :class="selected ? 'opacity-100 text-foreground' : 'opacity-0'"
                                    />
                                    <div
                                      class="flex-1 flex items-center gap-1.5 px-2 py-1 rounded shadow-sm w-full transition-all duration-200"
                                      :class="[
                                        getConditionStyle(option.label).bg,
                                        selected ? '!border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-background font-black scale-[1.02] z-10' : 'opacity-85 hover:opacity-100',
                                      ]"
                                    >
                                      <Icon :name="getConditionStyle(option.label).icon" class="size-4 shrink-0" />
                                      <span class="text-[13px] leading-tight" :class="selected ? 'font-black' : 'font-bold'">{{ option.label }}</span>
                                    </div>
                                  </template>
                                </MultiSelect>
                              </template>
                              <!-- Readonly: show badges without dropdown -->
                              <template v-else-if="props.readonly">
                                <div class="h-full w-full flex flex-col">
                                  <div class="px-3 py-2 border-b border-border/50 flex items-center bg-muted/30 h-10 shrink-0">
                                    <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate">{{ renderPart.label }}</span>
                                  </div>
                                  <div class="p-3 flex-1 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white/50 dark:bg-black/20" :class="(renderPart as any).hasNoImages ? 'max-h-[120px]' : ''">
                                    <div v-if="getValuesArray(editForm[renderPart.key]).length" class="flex flex-wrap gap-2">
                                      <div
                                        v-for="val in getValuesArray(editForm[renderPart.key])"
                                        :key="val"
                                        class="border px-2 py-1.5 rounded flex items-center gap-1.5 shadow-sm"
                                        :class="[(renderPart as any).hasNoImages ? 'w-auto' : 'w-full', getConditionStyle(val).bg]"
                                      >
                                        <Icon :name="getConditionStyle(val).icon" class="size-4 shrink-0" />
                                        <span class="text-[13px] font-bold leading-tight">{{ val }}</span>
                                      </div>
                                    </div>
                                    <div v-else class="text-[12px] text-muted-foreground font-medium flex items-center justify-center gap-1.5 opacity-50 my-auto pb-4">
                                      <Icon name="i-lucide-minus-circle" class="size-4" /> No conditions
                                    </div>
                                  </div>
                                </div>
                              </template>
                              <template v-else>
                                <!-- Native input fallback -->
                                <div class="px-3 py-2 border-b border-border/50 flex items-center bg-muted/30 h-10 shrink-0">
                                  <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-full truncate">{{ renderPart.label }}</span>
                                </div>
                                <div class="p-3 flex-1 flex flex-col justify-center bg-white/50 dark:bg-black/20">
                                  <p v-if="props.readonly" class="text-sm font-medium">
                                    {{ editForm[renderPart.key] || '—' }}
                                  </p>
                                  <Input v-else v-model="editForm[renderPart.key]" :type="(renderPart as any).inputType || 'text'" class="shadow-sm border-border text-sm focus-visible:ring-1 bg-white dark:bg-zinc-900" placeholder="e.g. Scratched, Rust" />
                                </div>
                              </template>
                            </div>
                          </template>
                        </div>

                        <!-- Right Side: hideImages rightParts panel (form fields + imageSlots) -->
                        <div v-if="(part as any).hideImages && (part as any).rightParts" class="flex-1 flex flex-col overflow-y-auto bg-muted/5 dark:bg-muted/10 min-w-0 min-h-0">
                          <template v-for="partItem in ((part as any).rightParts || [])" :key="partItem.key + (partItem.imageIndex ?? '')">
                            <!-- IMAGE SLOT type -->
                            <div v-if="partItem.type === 'imageSlot'" class="flex-1 px-2 py-1.5 border-b border-border/50 last:border-b-0 flex items-center gap-2 overflow-hidden bg-zinc-950/5 dark:bg-black/30 min-h-[48px]">
                              <template v-if="getImages(editForm, partItem.key, partItem.oldKey, partItem.imageIndex).length">
                                <div
                                  class="relative shrink-0 h-10 w-14 rounded overflow-hidden cursor-pointer group/imgslot border border-border/50 shadow-sm"
                                  @click="openLightboxUrls(getImages(editForm, partItem.key, partItem.oldKey, partItem.imageIndex), 0, partItem.label)"
                                >
                                  <img :src="getImages(editForm, partItem.key, partItem.oldKey, partItem.imageIndex)[0]" :alt="partItem.label" class="w-full h-full object-cover select-none" loading="lazy">
                                </div>
                                <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate flex-1">{{ partItem.label }}</span>
                                <div v-if="!props.readonly" class="flex items-center gap-1 shrink-0">
                                  <Button variant="secondary" size="icon" class="size-6 rounded-full bg-white/80 hover:bg-white shadow-sm" @click.stop="replaceImage(partItem.key, 0, partItem.oldKey, partItem.imageIndex)">
                                    <Icon name="i-lucide-refresh-cw" class="size-3 text-primary" />
                                  </Button>
                                  <Button variant="destructive" size="icon" class="size-6 rounded-full bg-red-500/80 hover:bg-red-600 shadow-sm" @click.stop="removeImage(partItem.key, 0, partItem.oldKey, partItem.imageIndex)">
                                    <Icon name="i-lucide-trash" class="size-3 text-white" />
                                  </Button>
                                </div>
                              </template>
                              <template v-else>
                                <div v-if="!props.readonly" class="flex items-center gap-2 w-full cursor-pointer hover:bg-muted/20 rounded px-1 py-1 transition-colors" @click.stop="addImage(partItem.key, partItem.imageIndex)">
                                  <div class="size-10 w-14 rounded border-2 border-dashed border-border/60 flex items-center justify-center shrink-0 bg-muted/20">
                                    <Icon name="i-lucide-image-plus" class="size-4 text-muted-foreground/50" />
                                  </div>
                                  <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 truncate">Add {{ partItem.label }}</span>
                                </div>
                                <div v-else class="flex items-center gap-2 w-full px-1 py-1">
                                  <div class="size-10 w-14 rounded border border-border/30 flex items-center justify-center shrink-0 bg-muted/10">
                                    <Icon name="i-lucide-image-off" class="size-4 text-muted-foreground/30" />
                                  </div>
                                  <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 truncate">{{ partItem.label }}</span>
                                </div>
                              </template>
                            </div>
                            <!-- Standard form field -->
                            <div v-else class="flex-1 px-3 py-2 border-b border-border/50 last:border-b-0 flex flex-col justify-center gap-1.5 overflow-hidden bg-white/40 dark:bg-black/20">
                              <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 truncate w-full" :title="partItem.label">{{ partItem.label }}</span>
                              <div class="w-full min-w-0 pointer-events-auto flex items-center">
                                <template v-if="props.readonly">
                                  <div v-if="getDisplayValues(editForm, partItem.key, partItem.oldKey).length" class="flex flex-wrap gap-1.5 w-full">
                                    <div
                                      v-for="val in getDisplayValues(editForm, partItem.key, partItem.oldKey)"
                                      :key="val"
                                      class="px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-border/50 truncate w-max"
                                      :class="getConditionStyle(val).bg"
                                    >
                                      <Icon :name="getConditionStyle(val).icon" class="size-3 shrink-0" />
                                      <span class="truncate max-w-[180px]">{{ val }}</span>
                                    </div>
                                  </div>
                                  <p v-else class="text-xs font-medium px-2 py-1.5 bg-muted/50 rounded border border-border/50 truncate w-full text-muted-foreground">
                                    —
                                  </p>
                                </template>
                                <template v-else>
                                  <SearchableSelect v-model="editForm[partItem.key]" :options="partItem.staticOptions || getOptions(partItem.dropdownName || '')" class-name="h-8 shadow-sm text-xs font-medium w-full bg-background mt-0 border-border/80" />
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>

                        <!-- Right Side: Horizontal Image Strip -->
                        <div v-if="!(part as any).hasNoImages" class="flex-1 relative group bg-zinc-950/5 dark:bg-black/50 overflow-hidden flex flex-col min-w-0 min-h-0">
                          <div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-stretch min-w-0 min-h-0">
                            <template v-for="group in ((part as any).imageGroups || [{ key: (part as any).imageKey || `${part.key}Images`, oldKey: (part as any).oldImageKey, label: part.label }])" :key="group.key">
                              <!-- Filled Images for this group -->
                              <div
                                v-for="(imgUrl, idx) in getImages(editForm, group.key, group.oldKey)"
                                :key="`${group.key}-${idx}`"
                                class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer group/item transition-all duration-300 border-r border-border/20"
                                @click="openLightboxUrls(getImages(editForm, group.key, group.oldKey), idx, group.label)"
                              >
                                <img :src="imgUrl" :alt="group.label" class="w-full h-full object-cover select-none" loading="lazy">
                                <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none">
                                  {{ group.label }} Image {{ idx + 1 }}
                                </div>
                                <!-- Overlay Actions -->
                                <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(group.key, idx, group.oldKey)">
                                    <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                                  </Button>
                                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-blue-500/90 hover:bg-blue-600 focus:outline-none" @click.stop="downloadImageFile(imgUrl, group.label || '')">
                                    <Icon name="i-lucide-download" class="size-3.5 text-white" />
                                  </Button>
                                  <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage(group.key, idx, group.oldKey)">
                                    <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                                  </Button>
                                </div>
                              </div>
                              <!-- Add Photo Endcap for this group -->
                              <div
                                v-if="!props.readonly"
                                class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer bg-muted/30 border-r border-border/20 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors group/add p-3 text-center"
                                @click.stop="addImage(group.key)"
                              >
                                <div class="size-10 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-2 group-hover/add:scale-110 transition-transform">
                                  <Icon name="i-lucide-plus" class="size-5 text-primary" />
                                </div>
                                <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                                  Add<br>
                                  <span class="text-[9px] font-black text-primary/70">
                                    {{ group.label }}<br>Image {{ getImages(editForm, group.key, group.oldKey).length + 1 }}
                                  </span>
                                </span>
                              </div>
                            </template>
                          </div>
                          <!-- Swipe Indicator hint -->
                          <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[8px] text-white font-medium tracking-wider pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                            SWIPE
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
                <div v-if="activeExteriorSection && sectionImages(activeExteriorSection.imageKeys as any).length" class="mt-8 mb-4">
                  <div class="flex items-center gap-2 mb-4 px-2">
                    <Icon name="i-lucide-images" class="size-5 text-primary" />
                    <h3 class="text-base font-semibold tracking-tight">
                      {{ activeExteriorSection.title }} Overall Photos
                    </h3>
                    <Separator class="flex-1 ml-2" />
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    <div
                      v-for="(img, idx) in sectionImages(activeExteriorSection.imageKeys as any)"
                      :key="idx"
                      class="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md"
                      @click="openLightbox(sectionImages(activeExteriorSection!.imageKeys as any), idx)"
                    >
                      <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy">
                      <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none truncate max-w-[90%]">
                        {{ img.label }}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- ═══════ QC AUDIT LOGS TAB ═══════ -->
          <div v-else-if="activeTab === 'qc-logs'" class="space-y-6">
            <Card class="!py-0 !gap-0 overflow-hidden">
              <CardHeader class="pt-5 pb-3">
                <CardTitle class="text-base flex items-center justify-between gap-4 w-full">
                  <div class="flex items-center gap-2">
                    <Icon name="i-lucide-history" class="size-4 text-primary" />
                    Modification History Log
                  </div>
                  <div v-if="allQcLogFields.length > 0" class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground whitespace-nowrap">Filter by field:</span>
                    <div class="w-56">
                      <SearchableSelect
                        v-model="qcLogSearchField"
                        :options="qcLogSearchOptions"
                        placeholder="Search field..."
                        class-name="h-8 text-xs font-medium w-full"
                      />
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent class="pt-4 pb-5">
                <div v-if="!car?.qcLog || car.qcLog.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-dashed border-border bg-muted/20">
                  <div class="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Icon name="i-lucide-file-clock" class="size-6 text-muted-foreground" />
                  </div>
                  <h3 class="font-medium text-lg">
                    No modifications tracked
                  </h3>
                  <p class="text-sm text-muted-foreground mt-1 max-w-sm">
                    QC changes made to this vehicle's model will appear here showing before and after comparisons.
                  </p>
                </div>
                <div v-else class="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  <div v-for="(log, idx) in filteredQcLogs" :key="idx" class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <Icon name="i-lucide-user-cog" class="size-4 text-primary" />
                    </div>
                    <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="font-medium bg-primary/5 border-primary/20 text-primary">
                            {{ log.changedBy }}
                          </Badge>
                        </div>
                        <time class="text-xs text-muted-foreground font-mono">{{ new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</time>
                      </div>
                      <div class="space-y-3 mt-3">
                        <div v-for="(change, cIdx) in log.changes" :key="cIdx" class="text-sm border-l-2 border-border pl-3 py-1">
                          <div class="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                            {{ change.field }}
                          </div>
                          <div class="flex flex-col xl:flex-row xl:items-start gap-2 xl:gap-4">
                            <!-- Old Value -->
                            <div class="flex-1 bg-red-500/10 text-red-700 dark:text-red-400 rounded p-1.5 text-xs opacity-80">
                              <template v-if="!change.oldValue && change.oldValue !== 0">
                                <span class="line-through">—</span>
                              </template>
                              <template v-else-if="qcLogIsImageField(change.field, change.oldValue)">
                                <div class="flex flex-wrap gap-1.5">
                                  <img
                                    v-for="(imgUrl, imgIdx) in qcLogExtractUrls(change.oldValue)"
                                    :key="imgIdx"
                                    :src="imgUrl"
                                    class="h-14 w-14 object-cover rounded border border-red-300/40 cursor-pointer hover:opacity-80 transition-opacity"
                                    loading="lazy"
                                    @click="openLightboxUrls(qcLogExtractUrls(change.oldValue), imgIdx, change.field)"
                                  >
                                  <span v-if="qcLogExtractUrls(change.oldValue).length === 0" class="line-through">—</span>
                                </div>
                              </template>
                              <template v-else-if="qcLogIsDate(change.oldValue)">
                                <span class="line-through font-mono">{{ qcLogFormatDate(change.oldValue) }}</span>
                              </template>
                              <template v-else-if="qcLogIsNumber(change.field, change.oldValue)">
                                <span class="line-through font-mono">{{ change.oldValue }}</span>
                              </template>
                              <template v-else>
                                <span class="line-through">{{ change.oldValue }}</span>
                              </template>
                            </div>
                            <Icon name="i-lucide-arrow-right" class="size-3 text-muted-foreground hidden xl:block shrink-0 mt-2" />
                            <Icon name="i-lucide-arrow-down" class="size-3 text-muted-foreground xl:hidden shrink-0 ml-1.5" />
                            <!-- New Value -->
                            <div class="flex-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded p-1.5 text-xs font-medium">
                              <template v-if="!change.newValue && change.newValue !== 0">
                                —
                              </template>
                              <template v-else-if="qcLogIsImageField(change.field, change.newValue)">
                                <div class="flex flex-wrap gap-1.5">
                                  <img
                                    v-for="(imgUrl, imgIdx) in qcLogExtractUrls(change.newValue)"
                                    :key="imgIdx"
                                    :src="imgUrl"
                                    class="h-14 w-14 object-cover rounded border border-emerald-300/40 cursor-pointer hover:opacity-80 transition-opacity"
                                    loading="lazy"
                                    @click="openLightboxUrls(qcLogExtractUrls(change.newValue), imgIdx, change.field)"
                                  >
                                  <span v-if="qcLogExtractUrls(change.newValue).length === 0">—</span>
                                </div>
                              </template>
                              <template v-else-if="qcLogIsDate(change.newValue)">
                                <span class="font-mono">{{ qcLogFormatDate(change.newValue) }}</span>
                              </template>
                              <template v-else-if="qcLogIsNumber(change.field, change.newValue)">
                                <span class="font-mono">{{ change.newValue }}</span>
                              </template>
                              <template v-else>
                                {{ change.newValue }}
                              </template>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- ═══════ DOCUMENTS TAB ═══════ -->
          <div v-else-if="activeTab === 'documents'" class="space-y-6">
            <Card class="!py-0 !gap-0 overflow-hidden">
              <CardHeader class="pt-5 pb-3">
                <CardTitle class="text-base flex items-center gap-2">
                  <Icon name="i-lucide-file-text" class="size-4 text-primary" />
                  Document Images
                  <Badge variant="secondary" class="ml-auto text-xs">
                    {{ sectionImages(documentImageKeys).length }} documents
                  </Badge>
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent class="pt-4 pb-5">
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  <div
                    v-for="(img, idx) in sectionImages(documentImageKeys)"
                    :key="idx"
                    class="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                    @click="openLightbox(sectionImages(documentImageKeys), idx)"
                  >
                    <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge variant="secondary" class="absolute bottom-1.5 left-1.5 text-[10px] max-w-[calc(100%-12px)] truncate">
                      {{ img.label }}
                    </Badge>
                  </div>
                </div>
                <p v-if="sectionImages(documentImageKeys).length === 0" class="text-center text-muted-foreground text-sm py-8">
                  No document images available
                </p>
              </CardContent>
            </Card>

            <!-- Document Text Info -->
            <Card class="!py-0 !gap-0 overflow-hidden">
              <CardHeader class="pt-5 pb-3">
                <CardTitle class="text-base flex items-center gap-2">
                  <Icon name="i-lucide-scan-text" class="size-4 text-primary" />
                  Chassis & VIN
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent class="pt-4 pb-5">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      Chassis Details
                    </p>
                    <p class="text-sm font-medium font-mono text-right">
                      {{ car.chassisDetails || '—' }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      VIN Plate Details
                    </p>
                    <p class="text-sm font-medium font-mono text-right">
                      {{ car.vinPlateDetails || '—' }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      PUC Number
                    </p>
                    <p class="text-sm font-medium text-right">
                      {{ car.pucNumber || '—' }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      PUC Validity
                    </p>
                    <p class="text-sm font-medium text-right">
                      {{ formatDate(car.pucValidity) }}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- ═══════ AUCTION TAB ═══════ -->
          <div v-else-if="activeTab === 'auction'" class="space-y-6">
            <Card class="!py-0 !gap-0 overflow-hidden">
              <CardHeader class="pt-5 pb-3">
                <CardTitle class="text-base flex items-center gap-2">
                  <Icon name="i-lucide-gavel" class="size-4 text-primary" />
                  Auction Details
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent class="pt-4 pb-5">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                  <div
                    v-for="item in [
                      { label: 'Price Discovery', value: editForm.priceDiscovery ? `₹${car.priceDiscovery.toLocaleString()}` : '—' },
                      { label: 'Price Discovery By', value: editForm.priceDiscoveryBy },
                      { label: 'Customer Expected Price', value: editForm.customerExpectedPrice ? `₹${car.customerExpectedPrice.toLocaleString()}` : '—' },
                      { label: 'Auction Status', value: editForm.auctionStatus },
                      { label: 'Auction Start', value: formatDate(car.auctionStartTime) },
                      { label: 'Auction End', value: formatDate(car.auctionEndTime) },
                      { label: 'Auction Duration', value: editForm.auctionDuration ? `${car.auctionDuration} hours` : '—' },
                      { label: 'Highest Bid', value: editForm.highestBid ? `₹${car.highestBid.toLocaleString()}` : '—' },
                      { label: 'Highest Bidder', value: editForm.highestBidder },
                      { label: 'One Click Price', value: editForm.oneClickPrice ? `₹${car.oneClickPrice.toLocaleString()}` : '—' },
                      { label: 'Otobuy Offer', value: editForm.otobuyOffer ? `₹${car.otobuyOffer.toLocaleString()}` : '—' },
                      { label: 'Sold At', value: editForm.soldAt ? `₹${car.soldAt.toLocaleString()}` : '—' },
                      { label: 'Sold To', value: editForm.soldTo },
                      { label: 'Fixed Margin', value: editForm.fixedMargin ? `${car.fixedMargin}%` : '—' },
                      { label: 'Variable Margin', value: editForm.variableMargin ? `${car.variableMargin}%` : '—' },
                      { label: 'Budget Car', value: editForm.budgetCar },
                      { label: 'KM Range Level', value: editForm.kmRangeLevel },
                      { label: 'Retail Associate', value: editForm.retailAssociate },
                    ]" :key="item.label" class="space-y-1"
                  >
                    <p class="text-xs text-muted-foreground">
                      {{ item.label }}
                    </p>
                    <p class="text-sm font-medium">
                      {{ item.value || '—' }}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <!-- Approval -->
            <Card class="!py-0 !gap-0 overflow-hidden">
              <CardHeader class="pt-5 pb-3">
                <CardTitle class="text-base flex items-center gap-2">
                  <Icon name="i-lucide-check-circle" class="size-4 text-primary" />
                  Approval Info
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent class="pt-4 pb-5">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      Approved By
                    </p>
                    <p class="text-sm font-medium text-right">
                      {{ car.approvedBy || '—' }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      Approval Date
                    </p>
                    <p class="text-sm font-medium text-right">
                      {{ formatDate(car.approvalDate) }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      Approval Status
                    </p>
                    <Badge variant="outline" :class="car.approvalStatus === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/15 text-amber-600 border-amber-500/20'">
                      {{ car.approvalStatus || '—' }}
                    </Badge>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      New Arrival Message
                    </p>
                    <p class="text-sm font-medium text-right">
                      {{ formatDate(car.newArrivalMessage) }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      Sent to Auction APK
                    </p>
                    <p class="text-sm font-medium text-right">
                      {{ formatDate(car.sendToAuctionApk) }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                    <p class="text-xs text-muted-foreground whitespace-nowrap">
                      Lat/Long
                    </p>
                    <p class="text-sm font-medium font-mono text-right">
                      {{ car.latlong || '—' }}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </template>

    <!-- Gallery Lightbox -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showLightbox" class="fixed inset-0 z-[100] bg-black/95 flex flex-col" @click.self="closeLightbox">
          <!-- Top bar: title + close -->
          <div class="shrink-0 flex items-center justify-between px-6 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
            <div class="flex items-center gap-3 min-w-0">
              <Badge variant="outline" class="border-white/20 text-white/70 text-xs shrink-0">
                {{ lightboxIndex + 1 }} / {{ lightboxImages.length }}
              </Badge>
              <h3 class="text-white text-sm font-medium truncate">
                {{ lightboxImages[lightboxIndex]?.label || 'Image' }}
              </h3>
            </div>
            <button class="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" @click="closeLightbox">
              <Icon name="i-lucide-x" class="size-5" />
            </button>
          </div>

          <!-- Main image area -->
          <div class="flex-1 min-h-0 flex items-center justify-center relative px-16" @click.self="closeLightbox">
            <!-- Prev -->
            <button
              v-if="lightboxImages.length > 1"
              class="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10 backdrop-blur-sm"
              @click="prevImage"
            >
              <Icon name="i-lucide-chevron-left" class="size-5" />
            </button>

            <!-- Image -->
            <img
              :key="lightboxIndex"
              :src="lightboxImages[lightboxIndex]?.url"
              :alt="lightboxImages[lightboxIndex]?.label"
              class="max-w-full max-h-full object-contain rounded-lg select-none animate-in fade-in duration-200"
            >

            <!-- Next -->
            <button
              v-if="lightboxImages.length > 1"
              class="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10 backdrop-blur-sm"
              @click="nextImage"
            >
              <Icon name="i-lucide-chevron-right" class="size-5" />
            </button>
          </div>

          <!-- Thumbnail strip -->
          <div v-if="lightboxImages.length > 1" class="shrink-0 bg-black/60 backdrop-blur-sm border-t border-white/10 px-6 py-3">
            <div class="flex gap-2 overflow-x-auto no-scrollbar justify-center max-w-full">
              <button
                v-for="(thumb, ti) in lightboxImages"
                :key="ti"
                :data-thumb-idx="ti"
                class="shrink-0 size-14 rounded-lg overflow-hidden border-2 transition-all duration-200"
                :class="ti === lightboxIndex ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'"
                @click="goToImage(ti)"
              >
                <img :src="thumb.url" :alt="thumb.label" class="w-full h-full object-cover" loading="lazy">
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- HIDDEN PDF REPORT CONTAINER -->
    <div v-if="isGeneratingPdf" style="position: absolute; top: -15000px; left: 0; width: 210mm; z-index: -10; pointer-events: none;" class="bg-white text-black">
      <div id="pdf-container" class="w-[210mm] bg-white p-[10mm] font-sans text-gray-900 mx-auto" style="min-height: 297mm; display: flex; flex-direction: column;">
        <!-- HEADER -->
        <div class="flex justify-between items-end border-b-2 border-slate-600 pb-2 mb-4">
          <div>
            <div class="flex items-center">
              <img src="/apple-touch-icon.png" class="h-28 w-auto object-contain">
            </div>
          </div>
          <div class="text-right">
            <h1 class="text-xl font-bold text-blue-700 uppercase tracking-wide">
              Vehicle Inspection Report
            </h1>
            <p class="text-[12px] font-bold text-slate-700 mt-0.5">
              {{ car?.yearMonthOfManufacture ? new Date(car?.yearMonthOfManufacture).getFullYear() : '' }} {{ (car?.make || '').toUpperCase() }}, {{ (car?.model || '').toUpperCase() }}, {{ (car?.variant || '').toUpperCase() }}
            </p>
            <p class="text-[10px] text-slate-500">
              Inspected: {{ formatDateMMDDYYYY(car?.inspectionDate || car?.createdAt) }} {{ car?.city ? `, ${String(car.city).toUpperCase()}` : '' }}
            </p>
          </div>
        </div>

        <!-- CAR MAIN PICS IN HEADER -->
        <div v-if="(getImages(car, 'frontMainImages', 'frontMain').length) || (getImages(car, 'rearMainImages', 'rearMain').length)" class="flex gap-4 mb-6">
          <div v-if="getImages(car, 'frontMainImages', 'frontMain').length" class="flex-1 h-[60mm] bg-[#f9fafb] border border-gray-300 rounded overflow-hidden flex items-center justify-center p-1">
            <img :src="getImages(car, 'frontMainImages', 'frontMain')[0]" class="w-full h-full object-contain" crossorigin="anonymous">
          </div>
          <div v-if="getImages(car, 'rearMainImages', 'rearMain').length" class="flex-1 h-[60mm] bg-[#f9fafb] border border-gray-300 rounded overflow-hidden flex items-center justify-center p-1">
            <img :src="getImages(car, 'rearMainImages', 'rearMain')[0]" class="w-full h-full object-contain" crossorigin="anonymous">
          </div>
        </div>

        <!-- A. GENERAL INFO & DOCS -->
        <div class="mb-6 break-inside-avoid">
          <h2 class="bg-[#1e293b] text-white text-center text-[10px] font-bold py-1.5 mb-2 rounded-t tracking-widest uppercase">
            A. GENERAL INFORMATION & DOCUMENTATION
          </h2>
          <!-- Table -->
          <div class="grid grid-cols-4 border-l border-t border-gray-300">
            <template v-for="fieldItem in documentDetailFields.flatMap(f => [...(f.splitParts || []), ...(f.rightParts || [])]).filter(f => f.label)" :key="fieldItem.key">
              <div class="border-r border-b border-gray-300 p-1.5 text-[9px] bg-[#f8fafc] font-semibold text-[#1e293b]">
                {{ fieldItem.label }}
              </div>
              <div class="border-r border-b border-gray-300 p-1.5 text-[9px] truncate">
                {{ fieldItem.type === 'date' ? (formatDateMMDDYYYY(car?.[fieldItem.key] || car?.[fieldItem.oldKey]) || '—') : formatPdfValue(car?.[fieldItem.dropdownName || fieldItem.key] || car?.[fieldItem.key] || car?.[fieldItem.oldKey] || '') }}
              </div>
            </template>
          </div>
        </div>

        <!-- B. INSPECTION ITEMS & CONDITION -->
        <div class="mb-4">
          <h2 class="bg-[#1e293b] text-white text-center text-[10px] font-bold py-1.5 mb-4 rounded-t tracking-widest uppercase">
            B. VEHICLE CONDITION & IMAGES
          </h2>
          <div class="space-y-4">
            <template v-for="sec in pdfSections" :key="sec.title">
              <div class="break-inside-avoid">
                <h3 class="bg-[#eff6ff] text-[#1d4ed8] font-bold text-[9px] px-2 py-1.5 border border-[#d1d5db] uppercase tracking-widest mb-2 rounded shadow-sm">
                  {{ sec.title }}
                </h3>
                <div class="grid grid-cols-2 gap-2">
                  <template v-for="part in sec.parts" :key="part.key">
                    <!-- Normal parts -->
                    <template v-if="!(part as any).isVideoBox && !(part as any).splitParts">
                      <div class="border border-[#d1d5db] rounded shadow-sm overflow-hidden flex flex-row min-h-[22mm] bg-white break-inside-avoid">
                        <div class="flex-1 flex flex-col">
                          <div class="bg-[#f8fafc] border-b border-[#d1d5db] px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#334155] truncate">
                            {{ part.label }}
                          </div>
                          <div class="p-1 px-1.5 flex flex-wrap gap-1 mt-auto mb-auto">
                            <template v-if="(part as any).isImageOnly">
                              <div class="text-[7.5px] text-[#64748b] italic px-1 py-0.5">
                                Images Only Section
                              </div>
                            </template>
                            <template v-else-if="getDisplayValues(car, (part as any).dropdownName || part.key, (part as any).oldKey).length">
                              <div v-for="val in getDisplayValues(car, (part as any).dropdownName || part.key, (part as any).oldKey)" :key="val" class="border px-1 py-0.5 rounded flex items-center gap-1 shadow-sm" :class="getConditionStyle(val).bg">
                                <span class="text-[8px]">{{ getConditionStyle(val).emoji }}</span>
                                <span class="text-[7.5px] font-bold leading-none">{{ val }}</span>
                              </div>
                            </template>
                            <div v-else class="text-[7.5px] text-[#64748b] italic px-1 py-0.5">
                              Condition Okay
                            </div>
                          </div>
                        </div>
                        <div class="w-[32mm] border-l border-[#d1d5db] bg-[#f9fafb] p-0.5 flex items-center justify-center shrink-0">
                          <img v-if="getImages(car, (part as any).imageKey || part.key, (part as any).oldImageKey || (part as any).oldKey).length && !getImages(car, (part as any).imageKey || part.key, (part as any).oldImageKey || (part as any).oldKey)[0]?.match(/\.(mp4|webm|ogg|mov)$/i)" :src="getImages(car, (part as any).imageKey || part.key, (part as any).oldImageKey || (part as any).oldKey)[0]!" class="max-w-full max-h-full object-contain" crossorigin="anonymous">
                          <div v-else class="text-[6px] text-[#9ca3af] uppercase tracking-widest text-center">
                            No Image
                          </div>
                        </div>
                      </div>
                    </template>
                    <!-- Split Parts -->
                    <template v-else-if="(part as any).splitParts">
                      <template v-for="spart in (part as any).splitParts" :key="spart.key">
                        <div class="border border-[#d1d5db] rounded shadow-sm overflow-hidden flex flex-row min-h-[22mm] bg-white break-inside-avoid">
                          <div class="flex-1 flex flex-col">
                            <div class="bg-[#f8fafc] border-b border-[#d1d5db] px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#334155] truncate">
                              {{ spart.label }}
                            </div>
                            <div class="p-1 px-1.5 flex flex-wrap gap-1 mt-auto mb-auto">
                              <template v-if="(spart as any).isImageOnly">
                                <div class="text-[7.5px] text-[#64748b] italic px-1 py-0.5">
                                  Images Only Section
                                </div>
                              </template>
                              <template v-else-if="getDisplayValues(car, spart.dropdownName || spart.key, spart.oldKey).length">
                                <div v-for="val in getDisplayValues(car, spart.dropdownName || spart.key, spart.oldKey)" :key="val" class="border px-1 py-0.5 rounded flex items-center gap-1 shadow-sm" :class="getConditionStyle(val).bg">
                                  <span class="text-[8px]">{{ getConditionStyle(val).emoji }}</span>
                                  <span class="text-[7.5px] font-bold leading-none">{{ val }}</span>
                                </div>
                              </template>
                              <div v-else class="text-[7.5px] text-[#64748b] italic px-1 py-0.5">
                                Condition Okay
                              </div>
                            </div>
                          </div>
                          <div class="w-[32mm] border-l border-[#d1d5db] bg-[#f9fafb] p-0.5 flex items-center justify-center shrink-0">
                            <img v-if="getImages(car, spart.imageKey || spart.key, spart.oldImageKey || spart.oldKey).length && !getImages(car, spart.imageKey || spart.key, spart.oldImageKey || spart.oldKey)[0]?.match(/\.(mp4|webm|ogg|mov)$/i)" :src="getImages(car, spart.imageKey || spart.key, spart.oldImageKey || spart.oldKey)[0]!" class="max-w-full max-h-full object-contain" crossorigin="anonymous">
                            <div v-else class="text-[6px] text-[#9ca3af] uppercase tracking-widest text-center">
                              No Image
                            </div>
                          </div>
                        </div>
                      </template>
                    </template>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- C. EXTRA IMAGE GALLERY -->
        <div class="html2pdf__page-break" />
        <div class="mt-8 mb-4 break-inside-avoid">
          <h2 class="bg-[#1e293b] text-white text-center text-[10px] font-bold py-1.5 mb-6 rounded-t uppercase tracking-widest">
            C. IMAGE GALLERY (EXTRAS)
          </h2>
          <div class="grid grid-cols-4 gap-2">
            <template v-for="(img, idx) in allPdfImages" :key="idx">
              <div class="flex flex-col border border-[#d1d5db] rounded overflow-hidden break-inside-avoid h-[30mm]">
                <div class="bg-[#f8fafc] text-center text-[6px] font-bold py-1 px-1 uppercase truncate border-b border-[#d1d5db] text-[#1e293b]">
                  {{ img.label }}
                </div>
                <div class="flex-1 bg-[#f9fafb] flex items-center justify-center p-0.5 overflow-hidden">
                  <img :src="img.url" class="max-h-full max-w-full object-contain" crossorigin="anonymous">
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/*
  CRITICAL: OVERRIDE ALL OKLCH TAILWIND COLORS FOR HTML2CANVAS 1.4.1
  Tailwind v4 defaults to `oklch()`, which html2canvas fundamentally cannot parse.
  We are forcefully resetting the background and text color variables
  within the PDF block to standard hexadecimal to prevent rendering crash loops.
*/
#pdf-container, #pdf-container * {
  /* Prevent Tailwind's global * { border-color: var(--border) } from crashing the parser */
  border-color: #e5e7eb !important;
  outline-color: transparent !important;
  text-decoration-color: transparent !important;
  box-shadow: none !important;
}
#pdf-container {
  color: #111827 !important;
  background-color: #ffffff !important;
}

#pdf-container .bg-white { background-color: #ffffff !important; }
#pdf-container .bg-gray-50 { background-color: #f9fafb !important; }
#pdf-container .bg-slate-50 { background-color: #f8fafc !important; }
#pdf-container .bg-gray-100 { background-color: #f3f4f6 !important; }
#pdf-container .bg-gray-200 { background-color: #e5e7eb !important; }
#pdf-container .bg-blue-50 { background-color: #eff6ff !important; }

#pdf-container .text-gray-900 { color: #111827 !important; }
#pdf-container .text-slate-700 { color: #334155 !important; }
#pdf-container .text-slate-500 { color: #64748b !important; }
#pdf-container .text-blue-700 { color: #1d4ed8 !important; }
#pdf-container .text-red-600 { color: #dc2626 !important; }

#pdf-container .border-slate-600 { border-color: #475569 !important; }
#pdf-container .border-gray-300 { border-color: #d1d5db !important; }

/* Dynamic condition colors & badge colors */
#pdf-container .bg-emerald-500\/15 { background-color: rgba(16, 185, 129, 0.15) !important; }
#pdf-container .border-emerald-500\/30 { border-color: rgba(16, 185, 129, 0.3) !important; }
#pdf-container .text-emerald-600 { color: #059669 !important; }

#pdf-container .bg-green-500\/15 { background-color: rgba(34, 197, 94, 0.15) !important; }
#pdf-container .border-green-500\/30 { border-color: rgba(34, 197, 94, 0.3) !important; }
#pdf-container .text-green-700 { color: #15803d !important; }

#pdf-container .bg-red-500\/15 { background-color: rgba(239, 68, 68, 0.15) !important; }
#pdf-container .border-red-500\/30 { border-color: rgba(239, 68, 68, 0.3) !important; }
#pdf-container .text-red-700 { color: #b91c1c !important; }

#pdf-container .bg-amber-500\/15 { background-color: rgba(245, 158, 11, 0.15) !important; }
#pdf-container .border-amber-500\/30 { border-color: rgba(245, 158, 11, 0.3) !important; }
#pdf-container .text-amber-700 { color: #b45309 !important; }

#pdf-container .bg-indigo-500\/15 { background-color: rgba(99, 102, 241, 0.15) !important; }
#pdf-container .border-indigo-500\/30 { border-color: rgba(99, 102, 241, 0.3) !important; }
#pdf-container .text-indigo-700 { color: #4338ca !important; }

#pdf-container .bg-slate-500\/15 { background-color: rgba(100, 116, 139, 0.15) !important; }
#pdf-container .border-slate-500\/30 { border-color: rgba(100, 116, 139, 0.3) !important; }
#pdf-container .text-slate-700 { color: #334155 !important; }

/* Upload progress overlay transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
