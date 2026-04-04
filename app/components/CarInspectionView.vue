<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  readonly?: boolean
}>()

const route = useRoute()
const router = useRouter()
const carId = route.params.id as string

const { setHeader } = usePageHeader()
// Header is set dynamically based on active tab below

const { carDetails: car, isLoading, error, fetchCarDetails } = useCarDetails()
const { fetchDropdowns, getOptions } = useDropdowns()
const { fetchCarDropdowns, makes, getModels, getVariants } = useCarDropdowns()
const { allUsers, fetchAllUsers } = usePeopleApi()

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

const editForm = ref<Record<string, any>>({})
let _skipAutoSave = false

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
  if (!props.readonly) {
    fetchDropdowns()
    fetchCarDropdowns()
  }
  fetchCarDetails(carId)
  fetchAllUsers()
})
const isSaving = ref(false)

async function saveQC(silent = false) {
  if (!silent)
    isSaving.value = true
  try {
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

    // Build the payload: only send fields that actually changed from the original car data
    // This prevents image uploads from sending ALL car info to telecallings/AppSheet
    const changedFields: Record<string, any> = {}
    const original = car.value || {}
    const edited = editForm.value || {}

    for (const key of Object.keys(edited)) {
      if (key === '_id' || key === 'id' || key === 'qcLogs' || key === 'logs' || key === 'qcLog')
        continue
      const oldStr = JSON.stringify(original[key])
      const newStr = JSON.stringify(edited[key])
      if (oldStr !== newStr) {
        changedFields[key] = edited[key]
      }
    }

    // Ensure numeric fields are properly typed when present
    if ('cubicCapacity' in changedFields)
      changedFields.cubicCapacity = Number(changedFields.cubicCapacity) || null
    if ('odometerReadingInKms' in changedFields)
      changedFields.odometerReadingInKms = Number(changedFields.odometerReadingInKms) || null
    if ('ownerSerialNumber' in changedFields)
      changedFields.ownerSerialNumber = Number(changedFields.ownerSerialNumber) || null
    if ('priceDiscovery' in changedFields)
      changedFields.priceDiscovery = Number(changedFields.priceDiscovery) || null

    // the telecallingId or appointmentId is needed
    // The get API merges them. We send updates using the appointmentId as telecallingId for the update API fallback in server
    await $fetch('/api/leads/update', {
      method: 'PUT',
      retry: 0,
      timeout: 15000,
      body: {
        telecallingId: editForm.value.appointmentId || editForm.value._id,
        changedBy: currentUser?.userName || currentUser?.email || 'QC',
        ...changedFields,
      },
    })

    if (!silent) {
      toast.success('QC Report Saved Successfully')
      // Refetch to reset
      await fetchCarDetails(carId)
    }
    else {
      // Update the baseline so the diff doesn't re-send already-saved fields
      if (car.value && Object.keys(changedFields).length > 0) {
        _skipAutoSave = true
        for (const k of Object.keys(changedFields)) {
          car.value[k] = JSON.parse(JSON.stringify(changedFields[k]))
        }
        nextTick(() => { _skipAutoSave = false })
      }
    }
  }
  catch (err: any) {
    if (!silent)
      toast.error(err?.data?.message || err?.message || 'Failed to save')
  }
  finally {
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
    return { bg: 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400', icon: 'i-lucide-check-circle' }
  if (errorKeys.some(k => lower.includes(k)))
    return { bg: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400', icon: 'i-lucide-alert-triangle' }
  if (warningKeys.some(k => lower.includes(k)))
    return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: 'i-lucide-info' }
  if (infoKeys.some(k => lower.includes(k)))
    return { bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-400', icon: 'i-lucide-wrench' }
  return { bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-400', icon: 'i-lucide-tag' }
}

function getValuesArray(val: string | string[] | undefined | null) {
  let v: string[] = []
  if (Array.isArray(val))
    v = val
  else if (typeof val === 'string' && val)
    v = [val]
  return v.flatMap(s => typeof s === 'string' ? s.split(',') : String(s)).map(s => s.trim()).filter(Boolean)
}

function formatDateMMDDYYYY(val: any) {
  if (!val)
    return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime()))
    return String(val)
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`
}

function formatDateYYYYMMDD(val: any) {
  if (!val)
    return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime()))
    return ''
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

// eslint-disable-next-line unused-imports/no-unused-vars
async function approveLead() {
  editForm.value.approvalStatus = 'Approved'
  await saveQC()
  router.push('/leads/approved')
}

// eslint-disable-next-line unused-imports/no-unused-vars
async function rejectLead() {
  editForm.value.approvalStatus = 'Quality Rejected'
  await saveQC()
  router.push('/leads/rejected')
}

const UPLOAD_BASE = 'https://ob-dealerapp-kong.onrender.com/api/otobix/car'
const KONG_TOKEN = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

function extractPublicId(url: string) {
  try {
    const parts = url.split('/upload/')
    if (parts.length < 2)
      return null
    let afterUpload = parts[1]!.replace(/^v\d+\//, '')
    const hashIndex = afterUpload.indexOf('#')
    if (hashIndex !== -1)
      afterUpload = afterUpload.substring(0, hashIndex)
    const queryIndex = afterUpload.indexOf('?')
    if (queryIndex !== -1)
      afterUpload = afterUpload.substring(0, queryIndex)
    const lastDot = afterUpload.lastIndexOf('.')
    if (lastDot !== -1)
      afterUpload = afterUpload.substring(0, lastDot)
    return afterUpload
  }
  catch {
    return null
  }
}

async function deleteCloudinaryFile(url: string) {
  const publicId = extractPublicId(url)
  if (!publicId)
    return
  const isVideo = url.match(/\.(mp4|webm|ogg)$/i)
  const endpoint = isVideo ? `${UPLOAD_BASE}/delete-video-from-cloudinary` : `${UPLOAD_BASE}/delete-image-from-cloudinary`

  try {
    await $fetch(endpoint, {
      method: 'DELETE',
      body: { publicId },
      headers: { Authorization: `Bearer ${KONG_TOKEN}`, token: KONG_TOKEN },
    })
  }
  catch (e) {
    console.error('Delete failed:', e)
  }
}

async function uploadCloudinaryFile(files: File[]) {
  if (files.length === 0)
    return []

  const isVideo = files[0]!.type.startsWith('video/')
  const endpoint = isVideo ? `${UPLOAD_BASE}/upload-car-video-to-cloudinary` : `${UPLOAD_BASE}/upload-car-images-to-cloudinary`

  const formData = new FormData()
  formData.append('appointmentId', String(car.value?.appointmentId || ''))

  if (isVideo) {
    formData.append('video', files[0]!)
  }
  else {
    for (const file of files) {
      if (!file.type.startsWith('video/')) {
        formData.append('imagesList', file)
      }
    }
  }

  try {
    const res: any = await $fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${KONG_TOKEN}`, token: KONG_TOKEN },
    })

    // Parse defensive multi-format responses
    if (res?.cloudinaryUrls && Array.isArray(res.cloudinaryUrls))
      return res.cloudinaryUrls
    if (res?.cloudinaryUrl)
      return [res.cloudinaryUrl]
    if (res?.cloudinaryVideoUrl)
      return [res.cloudinaryVideoUrl]
    if (Array.isArray(res))
      return res
    if (res?.data && Array.isArray(res.data))
      return res.data
    if (res?.data?.url)
      return [res.data.url]
    if (res?.data?.videoUrl)
      return [res.data.videoUrl]
    if (res?.data?.imagesList)
      return res.data.imagesList
    if (res?.images && Array.isArray(res.images))
      return res.images
    if (res?.urls && Array.isArray(res.urls))
      return res.urls
    if (res?.url)
      return [res.url]
    if (res?.videoUrl)
      return [res.videoUrl]
    if (res?.imagesList)
      return res.imagesList
    if (typeof res === 'string')
      return [res]
    return []
  }
  catch (e) {
    console.error('Upload failed:', e)
    return []
  }
}

async function removeImage(key: string, idx: number, oldKey?: string) {
  let urlToDelete = null
  if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
    urlToDelete = editForm.value[key][idx]
    editForm.value[key].splice(idx, 1)
  }
  else if (oldKey && Array.isArray(editForm.value[oldKey])) {
    urlToDelete = editForm.value[oldKey][idx]
    editForm.value[oldKey].splice(idx, 1)
  }

  if (urlToDelete) {
    await deleteCloudinaryFile(urlToDelete)
  }
  await saveQC(true)
}

async function addImage(key: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'image/*,video/*'
  input.onchange = async (e: any) => {
    const files = Array.from(e.target.files) as File[]
    const urls = await uploadCloudinaryFile(files)
    if (urls.length > 0) {
      if (!Array.isArray(editForm.value[key]))
        editForm.value[key] = []
      editForm.value[key].push(...urls)
      await saveQC(true)
    }
  }
  input.click()
}

async function replaceImage(key: string, idx: number, oldKey?: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file)
      return

    let urlToDelete = null
    if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
      urlToDelete = editForm.value[key][idx]
    }
    else if (oldKey && Array.isArray(editForm.value[oldKey])) {
      urlToDelete = editForm.value[oldKey][idx]
    }

    const urls = await uploadCloudinaryFile([file])
    if (urls.length > 0) {
      const newUrl = urls[0]
      if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
        editForm.value[key][idx] = newUrl
      }
      else if (oldKey && Array.isArray(editForm.value[oldKey])) {
        editForm.value[oldKey][idx] = newUrl
      }

      if (urlToDelete) {
        await deleteCloudinaryFile(urlToDelete)
      }
      await saveQC(true)
    }
  }
  input.click()
}

const tabs = [
  { id: 'details', label: 'Document & Registration Details', icon: 'i-lucide-file-text' },
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
  if (currentTab) {
    setHeader({
      title: props.readonly ? `Inspection: ${carId} / ${currentTab.label}` : `Quality Control: ${carId} / ${currentTab.label}`,
      description: 'Vehicle inspection details',
      icon: currentTab.icon || 'i-lucide-scan-eye',
      showBackButton: true,
    })
  }
})

function setTab(tabId: string) {
  const basePath = props.readonly ? '/inspection' : '/qc'
  router.push(`${basePath}/${carId}/${tabId}`)
}

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
function formatDate(d: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getImages(obj: Record<string, any> | null, key: string, fallbackKey?: string): string[] {
  let val = obj?.[key]
  // If new key is empty, try fallback (old) key
  if ((!val || (Array.isArray(val) && val.length === 0)) && fallbackKey)
    val = obj?.[fallbackKey]
  if (!val)
    return []
  if (Array.isArray(val))
    return val.filter((u: string) => u && typeof u === 'string').map(u => u.startsWith('http') ? u : `https://res.cloudinary.com/dwunzqigc/image/upload/Otobix%20Auction%20App/Car%20Images/${car.value?.appointmentId}/${u}`)
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
  { key: 'cowlTopDropdownList', oldKey: 'cowlTop', imageKey: 'cowlTopImages', oldImageKey: 'new', label: 'Cowl Top', dropdownName: 'Cowl Top' },
  { key: 'firewallDropdownList', oldKey: 'firewall', imageKey: 'firewallImages', oldImageKey: 'new', label: 'Firewall', dropdownName: 'Firewall' },
  { key: 'lhsApronDropdownList', oldKey: 'lhsApron', imageKey: 'lhsApronImages', oldImageKey: 'apronLhsRhs', label: 'LHS Apron', dropdownName: 'LHS Apron' },
  { key: 'rhsApronDropdownList', oldKey: 'rhsApron', imageKey: 'rhsApronImages', oldImageKey: 'apronLhsRhs', label: 'RHS Apron', dropdownName: 'RHS Apron' },
  { key: 'batteryDropdownList', oldKey: 'battery', imageKey: 'batteryImages', oldImageKey: 'batteryImages', label: 'Battery', dropdownName: 'Battery' },
  { key: 'split_4', hasNoImages: true, splitParts: [{ key: 'abs', label: 'ABS', dropdownName: 'ABS' }, { key: 'upperCrossMemberDropdownList', oldKey: 'upperCrossMember', label: 'Upper Cross Member', dropdownName: 'Upper Cross Member' }] },
  { key: 'split_5', hasNoImages: true, splitParts: [{ key: 'lhsSideMemberDropdownList', oldKey: 'new', label: 'LHS Side Member', dropdownName: 'LHS Side Member' }, { key: 'rhsSideMemberDropdownList', oldKey: 'new', label: 'RHS Side Member', dropdownName: 'RHS Side Member' }] },
  { key: 'split_6', hasNoImages: true, splitParts: [{ key: 'engineMountDropdownList', oldKey: 'engineMount', label: 'Engine Mount', dropdownName: 'Engine Mount' }, { key: 'headlightSupportDropdownList', oldKey: 'headlightSupport', label: 'Headlamp Support', dropdownName: 'Headlight Support' }] },
  { key: 'split_7', hasNoImages: true, splitParts: [{ key: 'radiatorSupportDropdownList', oldKey: 'radiatorSupport', label: 'Radiator Support', dropdownName: 'Radiator Support' }, { key: 'commentsOnRadiatorDropdownList', oldKey: 'commentsOnRadiator', label: 'Comment on Radiator', dropdownName: 'Comments On Radiator' }] },
  { key: 'split_8', hasNoImages: true, splitParts: [{ key: 'lowerCrossMemberDropdownList', oldKey: 'lowerCrossMember', label: 'Lower Cross Member', dropdownName: 'Lower Cross Member' }, { key: 'exhaustSmokeDropdownList', oldKey: 'exhaustSmoke', label: 'Exhaust Smoke', dropdownName: 'Exhaust Smoke' }] },
  { key: 'split_9', hasNoImages: true, splitParts: [{ key: 'commentsOnTowingDropdownList', oldKey: 'commentsOnTowing', label: 'Comment on Towing', dropdownName: 'Comments On Towing' }, { key: 'commentsOnOthersDropdownList', oldKey: 'commentsOnOthers', label: 'Comment on Others', dropdownName: 'Comments On Others' }] },
]

const electricalParts = [
  { key: 'clusterMeterGroup', imageKey: 'meterConsoleWithEngineOnImages', oldImageKey: 'meterConsoleWithEngineOn', label: 'Cluster Meter', isVerticalSplit: true, splitParts: [
    { key: 'commentsOnClusterMeterDropdownList', label: 'Cluster Meter', dropdownName: 'Comments on Cluster Meter' },
    { key: 'odometerReadingBeforeTestDrive', label: 'Odometer Reading', dropdownName: 'Odometer Reading', inputType: 'number' },
  ] },
  { key: 'split_e1', hasNoImages: true, splitParts: [
    { key: 'fuelLevel', oldKey: 'fuelLevel', label: 'Fuel Level', dropdownName: 'Fuel Level' },
    { key: 'irvm', oldKey: 'new', label: 'IRVM', dropdownName: 'IRVM' },
  ] },
  { key: 'split_e2', hasNoImages: true, splitParts: [
    { key: 'dashboardDropdownList', oldKey: 'new', label: 'Dashboard', dropdownName: 'Dashboard' },
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
  { key: 'commentsOnAc', oldKey: 'commentsOnAc', imageKey: 'acImages', oldImageKey: 'new', label: 'Comment on AC', dropdownName: 'Comments On A/C' },
  { key: 'rearWiperWasherDropdownList', oldKey: 'rearWiperWasher', imageKey: 'rearWiperAndWasherImages', oldImageKey: 'new', label: 'Rear Wiper & Washer', dropdownName: 'frontWiperAndWasher' },
  { key: 'reverseCameraDropdownList', oldKey: 'reverseCamera', imageKey: 'reverseCameraImages', oldImageKey: 'new', label: 'Reverse Camera', dropdownName: 'Reverse Camera' },
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
  // Airbags
  { key: 'noOfAirBags', oldKey: 'noOfAirBags', label: 'Number of Airbags', dropdownName: 'Number of Airbags', hasNoImages: true },
  { key: 'driverAirbagDropdownList', oldKey: 'airbagFeaturesDriverSide', imageKey: 'driverAirbagImages', oldImageKey: 'airbags', label: 'Driver Airbag', dropdownName: 'Driver Airbag' },
  { key: 'coDriverAirbagDropdownList', oldKey: 'airbagFeaturesCoDriverSide', imageKey: 'coDriverAirbagImages', oldImageKey: 'airbags', label: 'Co-Driver Airbag', dropdownName: 'Co-Driver Airbag' },
  { key: 'driverSeatAirbagDropdownList', oldKey: 'airbagFeaturesRhsAPillarCurtain', imageKey: 'driverSeatAirbagImages', oldImageKey: 'airbags', label: 'Driver Seat Airbag', dropdownName: 'Driver Seat Airbag' },
  { key: 'coDriverSeatAirbagDropdownList', oldKey: 'airbagFeaturesLhsAPillarCurtain', imageKey: 'coDriverSeatAirbagImages', oldImageKey: 'airbags', label: 'Co-Driver Seat Airbag', dropdownName: 'Co-Driver Seat Airbag' },
  { key: 'rhsCurtainAirbagDropdownList', oldKey: 'airbagFeaturesRhsBPillarCurtain', imageKey: 'rhsCurtainAirbagImages', oldImageKey: 'airbags', label: 'RHS Curtain Airbag', dropdownName: 'RHS Curtain Airbag' },
  { key: 'lhsCurtainAirbagDropdownList', oldKey: 'airbagFeaturesLhsBPillarCurtain', imageKey: 'lhsCurtainAirbagImages', oldImageKey: 'airbags', label: 'LHS Curtain Airbag', dropdownName: 'LHS Curtain Airbag' },
  { key: 'driverSideKneeAirbagDropdownList', oldKey: 'new', imageKey: 'driverSideKneeAirbagImages', oldImageKey: 'airbags', label: 'Driver Knee Airbag', dropdownName: 'Driver Knee Airbag' },
  { key: 'coDriverKneeSeatAirbagDropdownList', oldKey: 'new', imageKey: 'coDriverKneeSeatAirbagImages', oldImageKey: 'airbags', label: 'Co-Driver Knee Airbag', dropdownName: 'Co-Driver Knee Airbag' },
  { key: 'rhsRearSideAirbagDropdownList', oldKey: 'airbagFeaturesRhsCPillarCurtain', imageKey: 'rhsRearSideAirbagImages', oldImageKey: 'airbags', label: 'RHS Rear Side Airbag', dropdownName: 'RHS Rear Side Airbags' },
  { key: 'lhsRearSideAirbagDropdownList', oldKey: 'airbagFeaturesLhsCPillarCurtain', imageKey: 'lhsRearSideAirbagImages', oldImageKey: 'airbags', label: 'LHS Rear Side Airbag', dropdownName: 'LHS Rear Side Airbag' },

  // Seats & Upholstery
  { key: 'split_i1', hasNoImages: true, splitParts: [
    { key: 'seatsUpholstery', oldKey: 'leatherSeats/fabricSeats', label: 'Seat Upholsry', dropdownName: 'seatsUpholstery' },
    { key: 'driverSeatDropdownList', oldKey: 'new', label: 'Driver Seat', dropdownName: 'Driver Seat' },
  ] },
  { key: 'split_i2', hasNoImages: true, splitParts: [
    { key: 'coDriverSeatDropdownList', oldKey: 'new', label: 'Co-Driver Seat', dropdownName: 'Co-Driver Seat' },
    { key: 'frontCentreArmRestDropdownList', oldKey: 'new', label: 'Front Centre Arm Rest', dropdownName: 'Front Centre Arm Rest' },
  ] },
  { key: 'split_i3', hasNoImages: true, splitParts: [
    { key: 'rearSeatsDropdownList', oldKey: 'new', label: 'Rear Seats', dropdownName: 'Rear Seats' },
    { key: 'thirdRowSeatsDropdownList', oldKey: 'new', label: 'Third Row Seats', dropdownName: 'Third Row Seats' },
  ] },

  // Image-only parts
  {
    key: 'doorOpenSeatsImagesBox',
    label: 'Seats (Door Open)',
    isImageOnly: true,
    imageGroups: [
      { key: 'frontSeatsFromDriverSideImages', oldKey: 'frontSeatsFromDriverSideDoor', label: 'Front Seat from Driver Side (Door Open)' },
      { key: 'rearSeatsFromRightSideImages', oldKey: 'rearSeatsFromRightSideDoor', label: 'Rear Seat from Right Side (Door Open)' },
    ],
  },
  { key: 'dashboardImages', oldKey: 'dashboardFromRearSeat', imageKey: 'dashboardImages', oldImageKey: 'dashboardFromRearSeat', label: 'Dashboard from Rear Seat', isImageOnly: true },

  // Additional
  { key: 'commentOnInteriorDropdownList', oldKey: 'commentOnInterior', label: 'Comment on Interior', dropdownName: 'Comment on Interior', hasNoImages: true },
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
    { key: 'transmissionTypeDropdownList', oldKey: 'new', label: 'Transmission Type', dropdownName: 'Transmission Type' },
  ] },
  { key: 'split_ssb4', hasNoImages: true, splitParts: [
    { key: 'driveTrainDropdownList', oldKey: 'new', label: 'Drive Train', dropdownName: 'Drive Train' },
    { key: 'commentsOnTransmissionDropdownList', oldKey: 'commentsOnTransmission', label: 'Comment on Transmission', dropdownName: 'Comments On Transmission' },
  ] },

  { key: 'odometerReadingAfterTestDriveInKms', oldKey: 'new', imageKey: 'odometerReadingAfterTestDriveImages', oldImageKey: 'new', label: 'Odometer Reading after Test Drive', inputType: 'number' },
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
      { new: 'frontWiperAndWasherImages', old: 'frontWiperAndWasherImages' },
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
      { key: 'frontWiperAndWasherDropdownList', oldKey: undefined, imageKey: 'frontWiperAndWasherImages', oldImageKey: undefined, label: 'Front Wiper & Washer', dropdownName: 'frontWiperAndWasher' },
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
      { new: 'lhsQuarterPanelImages', old: 'lhsQuarterPanelImages' },
      { new: 'lhsQuarterPanelWithRearDoorOpenImages', old: 'lhsQuarterPanelImages' },
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
        imageGroups: [
          { key: 'lhsQuarterPanelImages', oldKey: 'lhsQuarterPanelImages', label: 'LHS Quarter Panel Image' },
          { key: 'lhsQuarterPanelWithRearDoorOpenImages', oldKey: 'lhsQuarterPanelImages', label: 'LHS Qtr Panel W/ Boot Open' },
        ],
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
      { new: 'lhsRearFogLampImages', old: undefined },
      { new: 'rhsTailLampImages', old: 'rhsTailLampImages' },
      { new: 'rhsRearFogLampImages', old: undefined },
      { new: 'rearWindshieldImages', old: 'rearWindshieldImages' },
      { new: 'bootDoorOpenImages', old: 'rearWithBootDoorOpen' },
      { new: 'spareWheelImages', old: undefined },
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
      { key: 'lhsRearFogLampDropdownList', oldKey: undefined, imageKey: 'lhsRearFogLampImages', oldImageKey: undefined, label: 'LHS Rear Fog Lamp', dropdownName: 'LHS Rear Foglamp' },
      { key: 'rhsTailLampDropdownList', oldKey: 'rhsTailLamp', imageKey: 'rhsTailLampImages', oldImageKey: 'rhsTailLampImages', label: 'RHS Tail Lamp' },
      { key: 'rhsRearFogLampDropdownList', oldKey: undefined, imageKey: 'rhsRearFogLampImages', oldImageKey: undefined, label: 'RHS Rear Fog Lamp', dropdownName: 'RHS Rear Foglamp' },
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
      { key: 'spareWheelDropdownList', oldKey: undefined, imageKey: 'spareWheelImages', oldImageKey: undefined, label: 'Spare Wheel' },
      { key: 'spareTyreDropdownList', oldKey: 'spareTyre', imageKey: 'spareTyreImages', oldImageKey: 'spareTyreImages', label: 'Spare Tyre' },
      { key: 'bootFloorDropdownList', oldKey: 'bootFloor', imageKey: 'bootFloorImages', oldImageKey: 'bootFloorImages', label: 'Boot Floor' },
    ],
  },
  {
    title: 'Right (RHS)',
    icon: 'i-lucide-arrow-right',
    imageKeys: [
      { new: 'rhsFullViewImages', old: 'rhsRear45Degree' },
      { new: 'rhsQuarterPanelWithRearDoorOpenImages', old: 'rhsQuarterPanelImages' },
      { new: 'rhsQuarterPanelImages', old: 'rhsQuarterPanelImages' },
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
        imageGroups: [
          { key: 'rhsQuarterPanelWithRearDoorOpenImages', oldKey: 'rhsQuarterPanelImages', label: 'RHS Quarter Panel With Boot Door Open' },
          { key: 'rhsQuarterPanelImages', oldKey: 'rhsQuarterPanelImages', label: 'RHS Quarter Panel Image' },
        ],
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
      { new: 'cowlTopImages', old: 'new' },
      { new: 'firewallImages', old: 'new' },
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
      { new: 'acImages', old: 'new' },
      { new: 'rearWiperAndWasherImages', old: 'new' },
      { new: 'reverseCameraImages', old: 'new' },
      { new: 'sunroofImages', old: 'sunroofImages' },
    ],
    parts: electricalParts,
  },
  {
    id: 'interior',
    title: 'Interior',
    icon: 'i-lucide-armchair',
    imageKeys: [
      { new: 'driverAirbagImages', old: 'airbags' },
      { new: 'coDriverAirbagImages', old: 'airbags' },
      { new: 'driverSeatAirbagImages', old: 'airbags' },
      { new: 'coDriverSeatAirbagImages', old: 'airbags' },
      { new: 'rhsCurtainAirbagImages', old: 'airbags' },
      { new: 'lhsCurtainAirbagImages', old: 'airbags' },
      { new: 'driverSideKneeAirbagImages', old: 'airbags' },
      { new: 'coDriverKneeSeatAirbagImages', old: 'airbags' },
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
      { new: 'odometerReadingAfterTestDriveImages', old: 'new' },
    ],
    parts: steeringSuspensionBrakesParts,
  },
]

const activeExteriorSection = computed(() => exteriorSections.find(s => s.title.toLowerCase().replace(/[^a-z]+/g, '').startsWith(activeTab.value.toLowerCase().replace(/[^a-z]+/g, ''))))

// ─── Auto-save: debounced deep watch on editForm ───
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null

watch(() => car.value, (newVal) => {
  if (newVal) {
    _skipAutoSave = true // Guard: don't trigger auto-save when resetting editForm from fetched data
    const clone = JSON.parse(JSON.stringify(newVal))
    // Automatically map old keys to new keys based on exteriorSections config
    exteriorSections.forEach((section) => {
      section.parts.forEach((part: any) => {
        if (part.oldKey && !clone[part.key] && clone[part.oldKey]) {
          clone[part.key] = clone[part.oldKey]
        }
      })
    })
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
  // Debounce: wait 1.5s after last change before saving
  if (_autoSaveTimer)
    clearTimeout(_autoSaveTimer)
  _autoSaveTimer = setTimeout(() => {
    saveQC(true)
  }, 1500)
}, { deep: true })

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
  'lhsQuarterPanelImages',
  'rearMain',
  'rearWithBootDoorOpen',
  'rearBumperImages',
  'lhsTailLampImages',
  'rhsTailLampImages',
  'spareTyreImages',
  'bootFloorImages',
  'rhsRear45Degree',
  'rhsQuarterPanelImages',
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
  'rcTokenImages',
  'insuranceImages',
  'duplicateKeyImages',
  'chassisEmbossmentImages',
  'vinPlateImages',
  'pucImages',
  'roadTaxImages',
]

// ─── Document Details field mapping (spreadsheet-driven) ───
const documentDetailFields: any[] = [
  // Core Identity
  { key: 'chassisEmbossmentImages', type: 'combinedBox', label: 'Chassis Embossment', splitParts: [
    { label: 'To Be Scrapped', key: 'toBeScrapped', oldKey: 'toBeScrapped', type: 'dropdown', dropdownName: 'To Be Scrapped' },
    { label: 'Chassis Details', key: 'chassisDetails', oldKey: undefined, type: 'dropdown', dropdownName: 'Chassis Details' },
  ] },
  { key: 'vinPlateImages', type: 'combinedBox', label: 'Vin Plate', splitParts: [
    { label: 'Vin Plate Details', key: 'vinPlateDetails', oldKey: undefined, type: 'dropdown', dropdownName: 'Vin Plate Details' },
  ] },
  { key: 'rcTokenImages', type: 'combinedBox', label: 'RC Token', splitParts: [
    { label: 'RC Book Availability', key: 'rcBookAvailabilityDropdownList', oldKey: 'rcBookAvailability', type: 'dropdown', dropdownName: 'RC Book Availability' },
    { label: 'RC Condition', key: 'rcCondition', oldKey: 'rcCondition', type: 'dropdown', dropdownName: 'RC Condition' },
    { label: 'Mismatch in RC', key: 'mismatchInRcDropdownList', oldKey: 'mismatchInRc', type: 'dropdown', dropdownName: 'Mismatch in RC' },
  ] },
  { key: 'technicalSpecs', type: 'combinedBox', label: 'Technical Specs', hideImages: true, splitParts: [
    { label: 'Fuel Type', key: 'fuelType', oldKey: 'fuelType', type: 'single', dropdownName: undefined },
    { label: 'Seating Capacity', key: 'seatingCapacity', oldKey: undefined, type: 'single', dropdownName: undefined },
    { label: 'Color', key: 'color', oldKey: undefined, type: 'single', dropdownName: undefined },
  ], rightParts: [
    { label: 'Fitness Validity', key: 'fitnessValidity', oldKey: 'fitnessTill', type: 'date', dropdownName: undefined },
    { label: 'Engine Number', key: 'engineNumber', oldKey: 'engineNumber', type: 'single', dropdownName: undefined },
    { label: 'Chassis Number', key: 'chassisNumber', oldKey: 'chassisNumber', type: 'single', dropdownName: undefined },
  ] },
  { key: 'registrationDetails', type: 'combinedBox', label: 'Registration Details', hideImages: true, splitParts: [
    { label: 'Cubic Capacity', key: 'cubicCapacity', oldKey: 'cubicCapacity', type: 'single', dropdownName: undefined },
    { label: 'Norms', key: 'norms', oldKey: undefined, type: 'single', dropdownName: undefined },
    { label: 'Registration State', key: 'registrationState', oldKey: 'registrationState', type: 'single', dropdownName: undefined },
  ], rightParts: [
    { label: 'Registered RTO', key: 'registeredRto', oldKey: 'registeredRto', type: 'single', dropdownName: undefined },
    { label: 'Registered Address as per RC', key: 'registeredAddressAsPerRc', oldKey: 'registeredAddressAsPerRc', type: 'single', dropdownName: undefined },
  ] },
  // Tax & Validity
  { key: 'roadTaxImages', type: 'combinedBox', label: 'Road Tax', splitParts: [
    { label: 'Road Tax Validity', key: 'roadTaxValidity', oldKey: 'roadTaxValidity', type: 'date', dropdownName: undefined },
    { label: 'Tax Valid Till', key: 'taxValidTill', oldKey: 'taxValidTill', type: 'date', dropdownName: undefined },
  ] },
  // Hypothecation
  // Hypothecation & Insurance
  { key: 'hypothecationInsurance', type: 'combinedBox', label: 'Hypo & Insurance', hideImages: true, splitParts: [
    { label: 'Hypothecation Details', key: 'hypothecationDetails', oldKey: 'hypothecationDetails', type: 'dropdown', dropdownName: 'Hypothecation Details' },
    { label: 'Hypothecated To', key: 'hypothecatedTo', oldKey: undefined, type: 'single', dropdownName: undefined },
  ], rightParts: [
    { label: 'Insurance Type', key: 'insuranceDropdownList', oldKey: 'insurance', type: 'dropdown', dropdownName: 'Insurance' },
    { label: 'Insurance Validity', key: 'insuranceValidity', oldKey: 'insuranceValidity', type: 'date', dropdownName: undefined },
  ] },
  { key: 'insuranceImages', type: 'combinedBox', label: 'Insurance Policy', splitParts: [
    { label: 'Insured By', key: 'insurer', oldKey: undefined, type: 'single', dropdownName: undefined },
    { label: 'Policy Number', key: 'policyNumber', oldKey: 'insurancePolicyNumber', type: 'single', dropdownName: undefined },
  ] },
  // PUC
  { key: 'pucImages', type: 'combinedBox', label: 'PUC Details', splitParts: [
    { label: 'PUC Validity', key: 'pucValidity', oldKey: undefined, type: 'date', dropdownName: undefined },
    { label: 'PUC Number', key: 'pucNumber', oldKey: undefined, type: 'single', dropdownName: undefined },
  ] },
  // Status & Compliance
  { key: 'statusCompliance', type: 'combinedBox', label: 'Status & Compliance', hideImages: true, splitParts: [
    { label: 'RC Status', key: 'rcStatus', oldKey: undefined, type: 'dropdown', dropdownName: 'RC Status' },
    { label: 'Blacklist Status', key: 'blacklistStatus', oldKey: undefined, type: 'dropdown', dropdownName: 'Blacklist Status' },
    { label: 'RTO NOC Details', key: 'rtoNoc', oldKey: 'rtoNoc', type: 'dropdown', dropdownName: 'RTO NOC Details' },
  ], rightParts: [
    { label: 'RTO Form 28 (2 Copies)', key: 'rtoForm28', oldKey: 'rtoForm28', type: 'dropdown', dropdownName: 'RTO Form 28' },
    { label: 'Party Peshi', key: 'partyPeshi', oldKey: 'partyPeshi', type: 'dropdown', dropdownName: 'Party Peshi' },
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
function sectionImages(keys: (string | { new: string, old: string })[]) {
  const obj = editForm.value && Object.keys(editForm.value).length ? editForm.value : car.value
  if (!obj)
    return []
  const imgs: { url: string, label: string }[] = []
  for (const entry of keys) {
    const newKey = typeof entry === 'string' ? entry : entry.new
    const oldKey = typeof entry === 'string' ? undefined : entry.old
    const urls = getImages(obj, newKey, oldKey)
    for (let i = 0; i < urls.length; i++) {
      imgs.push({ url: urls[i] as string, label: `${humanize(newKey)} Image ${i + 1}` })
    }
  }
  return imgs
}
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden -m-4 lg:-m-6">
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
        </div>
      </div>

      <!-- Tab Content (scrollable) -->
      <div class="flex-1 min-h-0 overflow-auto bg-muted/10">
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
              <div class="relative w-full lg:w-[320px] shrink-0 h-64 lg:h-auto overflow-hidden bg-muted group cursor-pointer" @click="getImages(car, 'frontMain').length && openLightboxUrls(getImages(car, 'frontMain'), 0, `${car.make} ${car.model}`)">
                <img
                  v-if="getImages(car, 'frontMain').length"
                  :src="getImages(car, 'frontMain')[0]"
                  :alt="`${car.make} ${car.model}`"
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                >
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Icon name="i-lucide-car" class="size-20 text-muted-foreground/30" />
                </div>
                <!-- Top Left Badge -->
                <div class="absolute top-5 left-5">
                  <Badge class="bg-black/60 hover:bg-black/60 text-white/90 border-transparent backdrop-blur-md rounded-full px-4 py-1.5 font-mono text-sm tracking-widest shadow-none">
                    # {{ car.appointmentId }}
                  </Badge>
                </div>
              </div>

              <!-- MIDDLE: Data Grid -->
              <div class="flex-1 min-w-0 p-5 lg:p-6 lg:px-8 flex flex-col gap-6 lg:border-r border-border/60">
                <!-- Breadcrumbs / Top Info -->
                <!-- Stats Grid Layout -->
                <div class="flex flex-col gap-3 mt-auto w-full">
                  <!-- Row 1: Make, Model, Variant, MFG Year -->
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <!-- Make -->
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-2 font-medium">
                        Make
                      </p>
                      <div class="mt-auto relative z-10 w-full pr-8">
                        <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.make">
                          {{ car.make || '—' }}
                        </div>
                        <SearchableSelect v-else v-model="editForm.make" :options="makeOptions" placeholder="Make" class-name="h-8 text-sm font-bold shadow-none w-full border-b border-t-0 border-x-0 rounded-none px-0" />
                      </div>
                    </div>

                    <!-- Model -->
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-2 font-medium">
                        Model
                      </p>
                      <div class="mt-auto relative z-10 w-full pr-8">
                        <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.model">
                          {{ car.model || '—' }}
                        </div>
                        <SearchableSelect v-else v-model="editForm.model" :options="modelOptions" placeholder="Model" class-name="h-8 text-sm font-bold shadow-none w-full border-b border-t-0 border-x-0 rounded-none px-0" />
                      </div>
                    </div>

                    <!-- Variant -->
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
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
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-1 font-medium">
                        MFG Year
                      </p>
                      <div v-if="props.readonly" class="text-2xl font-black text-foreground mt-auto">
                        {{ car.yearMonthOfManufacture ? new Date(car.yearMonthOfManufacture).getFullYear() : '—' }}
                      </div>
                      <Input v-else v-model="editForm.yearOfManufacture" type="number" class="h-8 mt-auto text-2xl font-black border-none bg-transparent p-0 focus-visible:ring-0 shadow-none w-24 text-foreground" placeholder="e.g. 2019" />
                      <!-- Decorative circle icon -->
                      <div class="absolute right-4 top-1/2 -translate-y-1/2 mt-1 size-12 rounded-full border-[3px] border-slate-200 dark:border-slate-800 flex items-center justify-center bg-background shadow-sm">
                        <Icon name="i-lucide-calendar" class="size-5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <!-- Bottom Row: Registration, Ownership & City -->
                  <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <!-- Registration Number -->
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-1 font-medium">
                        Registration
                      </p>
                      <div class="mt-auto relative z-10 w-full pr-8">
                        <div v-if="props.readonly" class="text-xl font-black text-foreground truncate uppercase" :title="car.registrationNumber">
                          {{ car.registrationNumber || '—' }}
                        </div>
                        <Input v-else v-model="editForm.registrationNumber" class="h-8 max-w-[120px] text-lg font-black uppercase border-none bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground" placeholder="MH01..." />
                      </div>
                      <div class="absolute right-4 top-1/2 -translate-y-1/2 mt-1 size-12 rounded-full border-[3px] border-slate-200 dark:border-slate-800 flex items-center justify-center bg-background shadow-sm">
                        <Icon name="i-lucide-car-front" class="size-5 text-slate-400" />
                      </div>
                    </div>

                    <!-- Registration Date -->
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                      <p class="text-xs text-muted-foreground mb-1 font-medium">
                        Reg. Date
                      </p>
                      <div class="mt-auto relative z-10 w-full pr-8">
                        <div v-if="props.readonly" class="text-xl font-black text-foreground truncate" :title="formatDateMMDDYYYY(car.registrationDate)">
                          {{ formatDateMMDDYYYY(car.registrationDate) || '—' }}
                        </div>
                        <Input v-else :model-value="formatDateYYYYMMDD(editForm.registrationDate)" type="date" class="h-8 max-w-[140px] text-[15px] font-black border-none bg-transparent p-0 focus-visible:ring-0 shadow-none text-foreground" @update:model-value="editForm.registrationDate = $event" />
                      </div>
                      <div class="absolute right-4 top-1/2 -translate-y-1/2 mt-1 size-12 rounded-full border-[3px] border-slate-200 dark:border-slate-800 flex items-center justify-center bg-background shadow-sm">
                        <Icon name="i-lucide-calendar-days" class="size-5 text-slate-400" />
                      </div>
                    </div>

                    <!-- Ownership & Registered Owner -->
                    <div class="md:col-span-2 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between overflow-hidden relative group">
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
                    <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
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

              <!-- RIGHT: Pricing / Offer Action -->
              <div class="w-full lg:w-[280px] bg-card p-6 lg:p-8 flex flex-col justify-center">
                <p class="text-sm text-muted-foreground mb-1 font-medium">
                  Price Discovery
                </p>
                <div class="text-3xl font-black text-foreground tracking-tight mb-8">
                  <span v-if="props.readonly">₹ {{ (car.priceDiscovery || 0).toLocaleString('en-IN') }}</span>
                  <Input v-else v-model="editForm.priceDiscovery" type="number" class="h-12 text-2xl font-black bg-muted/50 mt-2 shadow-inner border-border/60" />
                </div>

                <!-- Inspected By -->
                <div v-if="car.allocatedTo" class="mb-2 w-full">
                  <p class="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-wider">
                    Inspected By
                  </p>
                  <div class="flex items-center gap-3 p-3 rounded-lg border border-border/80 bg-background/50 shadow-sm overflow-hidden">
                    <Avatar class="size-8 shrink-0">
                      <AvatarFallback class="text-xs font-bold bg-primary/10 text-primary">
                        {{ (allocatedToName || 'UA').substring(0, 2).toUpperCase() }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="flex flex-col min-w-0 justify-center">
                      <span class="text-sm font-semibold text-foreground truncate" :title="allocatedToName">{{ allocatedToName }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
                                    <p v-if="props.readonly" class="text-xs font-medium px-2 py-1.5 bg-muted/50 rounded border border-border/50 truncate w-full">
                                      {{ partItem.type === 'date' ? (formatDateMMDDYYYY(editForm[partItem.key] || (partItem.oldKey ? editForm[partItem.oldKey] : '')) || '—') : (editForm[partItem.key] || (partItem.oldKey ? editForm[partItem.oldKey] : '') || '—') }}
                                    </p>
                                    <template v-else>
                                      <Input v-if="partItem.type === 'date'" :model-value="formatDateYYYYMMDD(editForm[partItem.key])" type="date" class="h-8 text-xs font-medium w-full bg-background" @update:model-value="editForm[partItem.key] = $event" />
                                      <Input v-else-if="partItem.type === 'single'" v-model="editForm[partItem.key]" class="h-8 text-xs font-medium w-full bg-background" />
                                      <SearchableSelect v-else v-model="editForm[partItem.key]" :options="getOptions(partItem.dropdownName || '')" class-name="h-8 shadow-sm text-xs font-medium w-full bg-background mt-0 border-border/80" />
                                    </template>
                                  </div>
                                </div>
                              </template>
                            </div>
                          </div>
                        </div>
                        <!-- Right: Image Strip OR Alternate Config -->
                        <div v-if="field.hideImages" class="flex-1 flex flex-col overflow-y-auto bg-muted/5 dark:bg-muted/10">
                          <template v-if="field.rightParts" v-for="partItem in field.rightParts" :key="partItem.key">
                            <div class="flex-1 px-3 py-2 border-b border-border/50 last:border-b-0 flex flex-col justify-center gap-1.5 overflow-hidden bg-white/40 dark:bg-black/20">
                              <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 truncate w-full" :title="partItem.label">{{ partItem.label }}</span>
                              <div class="w-full min-w-0 pointer-events-auto flex items-center">
                                <p v-if="props.readonly" class="text-xs font-medium px-2 py-1.5 bg-muted/50 rounded border border-border/50 truncate w-full">
                                  {{ partItem.type === 'date' ? (formatDateMMDDYYYY(editForm[partItem.key] || (partItem.oldKey ? editForm[partItem.oldKey] : '')) || '—') : (editForm[partItem.key] || (partItem.oldKey ? editForm[partItem.oldKey] : '') || '—') }}
                                </p>
                                <template v-else>
                                  <Input v-if="partItem.type === 'date'" :model-value="formatDateYYYYMMDD(editForm[partItem.key])" type="date" class="h-8 text-xs font-medium w-full bg-background" @update:model-value="editForm[partItem.key] = $event" />
                                  <Input v-else-if="partItem.type === 'single'" v-model="editForm[partItem.key]" class="h-8 text-xs font-medium w-full bg-background" />
                                  <SearchableSelect v-else v-model="editForm[partItem.key]" :options="getOptions(partItem.dropdownName || '')" class-name="h-8 shadow-sm text-xs font-medium w-full bg-background mt-0 border-border/80" />
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>
                        <div v-else class="flex-1 relative group bg-zinc-950/5 dark:bg-black/50 overflow-hidden flex flex-col">
                          <div v-if="getImages(editForm, field.key, field.oldKey).length" class="flex-1 h-full w-full">
                            <div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-stretch">
                              <div
                                v-for="(imgUrl, idx) in getImages(editForm, field.key, field.oldKey)"
                                :key="idx"
                                class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer group/item transition-all duration-300 border-r border-border/20 last:border-r-0"
                                @click="openLightboxUrls(getImages(editForm, field.key, field.oldKey), idx, field.label)"
                              >
                                <img :src="imgUrl" :alt="field.label" class="w-full h-full object-cover select-none" loading="lazy">
                                <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[8px] text-white font-medium tracking-wider uppercase pointer-events-none">
                                  {{ field.label }} Image {{ idx + 1 }}
                                </div>
                                <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity z-10">
                                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(field.key, idx, field.oldKey)">
                                    <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                                  </Button>
                                  <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage(field.key, idx, field.oldKey)">
                                    <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                                  </Button>
                                </div>
                              </div>
                              <!-- Add Photo Endcap -->
                              <div
                                v-if="!props.readonly"
                                class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer bg-muted/30 border-r border-border/20 last:border-r-0 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors group/add p-3 text-center"
                                @click.stop="addImage(field.key)"
                              >
                                <div class="size-10 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-2 group-hover/add:scale-110 transition-transform">
                                  <Icon name="i-lucide-plus" class="size-5 text-primary" />
                                </div>
                                <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                                  Add<br>
                                  <span v-if="field.type === 'combinedBox' || field.type === 'multiple'" class="text-[9px] font-black text-primary/70">
                                    {{ field.label }}<br>Image {{ getImages(editForm, field.key, field.oldKey).length + 1 }}
                                  </span>
                                  <span v-else>Photo</span>
                                </span>
                              </div>
                            </div>
                            <div v-if="getImages(editForm, field.key, field.oldKey).length > 1" class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[8px] text-white font-medium tracking-wider pointer-events-none">
                              SWIPE
                            </div>
                          </div>
                          <!-- Empty State -->
                          <div v-else-if="!props.readonly" class="flex h-full w-full flex-col items-center justify-center bg-transparent gap-3 relative cursor-pointer hover:bg-muted/10 transition-colors" @click.stop="addImage(field.key)">
                            <div class="size-12 rounded-full bg-muted/30 flex items-center justify-center">
                              <Icon name="i-lucide-image-plus" class="size-5 text-muted-foreground/50" />
                            </div>
                            <span class="text-[11px] text-muted-foreground/60 font-bold tracking-widest uppercase text-center leading-relaxed">
                              Click to add
                              <template v-if="field.type === 'combinedBox' || field.type === 'multiple'">
                                <br><span class="text-primary/70">{{ field.label }} Image 1</span>
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
                    <div v-else-if="field.type === 'dropdown'" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <p v-if="props.readonly" class="text-sm font-medium text-right w-2/3">
                        {{ editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : '') || '—' }}
                      </p>
                      <SearchableSelect v-else v-model="editForm[field.key]" :options="getOptions(field.dropdownName || '')" class-name="w-2/3 h-8 shadow-sm text-sm" />
                    </div>
                    <!-- DATE field -->
                    <div v-else-if="field.type === 'date'" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <p v-if="props.readonly" class="text-sm font-medium text-right w-2/3">
                        {{ formatDateMMDDYYYY(editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : '')) }}
                      </p>
                      <Input
                        v-else
                        :model-value="formatDateYYYYMMDD(editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : ''))"
                        type="date"
                        class="h-8 text-sm font-medium w-2/3 shadow-sm bg-transparent !border-0 focus-visible:ring-0 px-0 [&::-webkit-calendar-picker-indicator]:opacity-50"
                        @update:model-value="editForm[field.key] = $event"
                      />
                    </div>
                    <!-- SINGLE (text) field -->
                    <div v-else class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
                      <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                        {{ field.label }}
                      </p>
                      <p v-if="props.readonly" class="text-sm font-medium text-right w-2/3">
                        {{ editForm[field.key] || (field.oldKey ? editForm[field.oldKey] : '') || '—' }}
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
                      :key="part.key"
                      class="rounded-xl border bg-card shadow-sm flex flex-row overflow-hidden"
                      :class="[
                        (part as any).hasNoImages && !(part as any).isVideoBox ? 'min-h-[100px]' : 'min-h-[160px]',
                        (part as any).isVideoBox ? 'row-span-2 h-auto min-h-[336px]' : 'h-[160px]',
                      ]"
                    >
                      <template v-if="(part as any).isVideoBox">
                        <div class="w-full h-full flex flex-col p-3 bg-muted/5 relative overflow-hidden">
                          <div class="grid grid-cols-2 gap-3 flex-1 h-full w-full">
                            <template v-for="vk in engineVideoKeys" :key="vk.key">
                              <div class="flex flex-col gap-1.5 h-full relative">
                                <div class="flex items-center gap-1.5 px-2 py-1 bg-black/50 rounded absolute top-2 left-2 z-10 pointer-events-none backdrop-blur-sm">
                                  <Icon name="i-lucide-video" class="size-3 text-white/80" />
                                  <span class="text-[9px] font-bold uppercase tracking-wider text-white/90">{{ vk.label }}</span>
                                </div>
                                <template v-if="getVideos(editForm, vk.key).length || (vk.oldKey && getVideos(editForm, vk.oldKey).length)">
                                  <div v-for="(videoUrl, vIdx) in (getVideos(editForm, vk.key).length ? getVideos(editForm, vk.key) : getVideos(editForm, vk.oldKey!))" :key="`${vk.key}-${vIdx}`" class="rounded-lg overflow-hidden border bg-black relative h-full flex-1 group">
                                    <template v-if="getEmbedUrl(videoUrl).type === 'iframe'">
                                      <iframe
                                        :src="getEmbedUrl(videoUrl).src"
                                        allow="autoplay"
                                        allowfullscreen
                                        class="absolute inset-0 w-full h-full border-0 object-cover"
                                      />
                                    </template>
                                    <template v-else>
                                      <video
                                        :src="getEmbedUrl(videoUrl).src"
                                        controls
                                        playsinline
                                        crossorigin="anonymous"
                                        preload="auto"
                                        class="absolute inset-0 w-full h-full object-cover"
                                      >
                                        Your browser does not support the video tag.
                                      </video>
                                    </template>
                                    <!-- Overlay Actions -->
                                    <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                      <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(vk.key, vIdx, vk.oldKey)">
                                        <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                                      </Button>
                                      <Button variant="destructive" size="icon" class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" @click.stop="removeImage(vk.key, vIdx, vk.oldKey)">
                                        <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                                      </Button>
                                    </div>
                                  </div>
                                </template>
                                <template v-else>
                                  <div
                                    class="rounded-lg border border-dashed border-border flex flex-col items-center justify-center transition-colors relative h-full flex-1 min-h-[80px]"
                                    :class="!props.readonly ? 'cursor-pointer bg-muted/20 hover:bg-muted/50 group/add' : 'bg-muted/10'"
                                    @click="!props.readonly && addImage(vk.key)"
                                  >
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
                        <!-- Left Side: Controls & Condition -->
                        <div class="flex overflow-hidden h-full" :class="[(part as any).isVerticalSplit ? 'flex-col' : 'flex-row', (part as any).hasNoImages ? 'flex-1' : 'shrink-0']">
                          <template v-for="(renderPart, rIdx) in ((part as any).splitParts || [part])" :key="renderPart.key">
                            <div
                              class="flex flex-col shrink-0 bg-muted/10 relative"
                              :class="[
                                (part as any).isVerticalSplit ? 'h-1/2 w-[200px] xl:w-[240px]' : (part as any).splitParts ? 'h-full w-1/2' : (renderPart as any).hasNoImages ? 'h-full w-full' : 'h-full w-[200px] xl:w-[240px]',
                                rIdx === 0 && (part as any).splitParts && !(part as any).isVerticalSplit ? 'border-r border-border/50' : '',
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

                        <!-- Right Side: Horizontal Image Strip -->
                        <div v-if="!(part as any).hasNoImages" class="flex-1 relative group bg-zinc-950/5 dark:bg-black/50 overflow-hidden flex flex-col">
                          <div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-stretch">
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
                                <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  <Button variant="secondary" size="icon" class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" @click.stop="replaceImage(group.key, idx, group.oldKey)">
                                    <Icon name="i-lucide-refresh-cw" class="size-3.5" />
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
                <CardTitle class="text-base flex items-center gap-2">
                  <Icon name="i-lucide-history" class="size-4 text-primary" />
                  Modification History Log
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
                  <div v-for="(log, idx) in [...(car.qcLog || [])].reverse()" :key="idx" class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
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
                          <div class="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4">
                            <div class="flex-1 bg-red-500/10 text-red-700 dark:text-red-400 rounded p-1.5 line-clamp-3 text-xs opacity-80" :title="String(change.oldValue)">
                              <span class="line-through">{{ change.oldValue || '—' }}</span>
                            </div>
                            <Icon name="i-lucide-arrow-right" class="size-3 text-muted-foreground hidden xl:block shrink-0" />
                            <Icon name="i-lucide-arrow-down" class="size-3 text-muted-foreground xl:hidden shrink-0 ml-1.5" />
                            <div class="flex-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded p-1.5 line-clamp-3 text-xs font-medium" :title="String(change.newValue)">
                              {{ change.newValue || '—' }}
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
                      {{ car.chassisDetails || car.chassisNumber || '—' }}
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
  </div>
</template>
