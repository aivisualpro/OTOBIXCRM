<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  readonly?: boolean
}>()

const route = useRoute()
const router = useRouter()
const carId = route.params.id as string

const { setHeader } = usePageHeader()
setHeader({ 
  title: props.readonly ? `Inspection: ${carId}` : `Quality Control: ${carId}`, 
  description: 'Vehicle inspection details', 
  icon: 'i-lucide-scan-eye',
  showBackButton: true
})

const { carDetails: car, isLoading, error, fetchCarDetails } = useCarDetails()
const { fetchDropdowns, getOptions } = useDropdowns()
const { fetchCarDropdowns, makes, getModels, getVariants } = useCarDropdowns()
const { allUsers, fetchAllUsers } = usePeopleApi()

const allocatedToName = computed(() => {
  const emailOrName = car.value?.allocatedTo
  if (!emailOrName) return ''
  const val = String(emailOrName).trim().toLowerCase()
  const found = allUsers.value.find((u: any) =>
    String(u.email || '').toLowerCase() === val
    || String(u.userName || '').toLowerCase() === val
    || String(u.emailAddress || '').toLowerCase() === val
  )
  if (found) {
    if (found.fullName) return found.fullName
    if (found.userName) return found.userName
  }
  return emailOrName
})

const editForm = ref<Record<string, any>>({})

const makeOptions = computed(() => {
  if (makes.value.length === 0 && editForm.value.make) return [{ label: editForm.value.make, value: editForm.value.make }]
  return makes.value.map(m => ({ label: m, value: m }))
})

const modelOptions = computed(() => {
  const selectedMake = editForm.value.make
  const models = selectedMake ? getModels(selectedMake) : []
  if (models.length === 0 && editForm.value.model) return [{ label: editForm.value.model, value: editForm.value.model }]
  return models.map(m => ({ label: m, value: m }))
})

const variantOptions = computed(() => {
  const selectedMake = editForm.value.make
  const selectedModel = editForm.value.model
  const variants = (selectedMake && selectedModel) ? getVariants(selectedMake, selectedModel) : []
  if (variants.length === 0 && editForm.value.variant) return [{ label: editForm.value.variant, value: editForm.value.variant }]
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
  if (!silent) isSaving.value = true
  try {
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}

    // Build the payload: only send fields that actually changed from the original car data
    // This prevents image uploads from sending ALL car info to telecallings/AppSheet
    const changedFields: Record<string, any> = {}
    const original = car.value || {}
    const edited = editForm.value || {}

    for (const key of Object.keys(edited)) {
      if (key === '_id' || key === 'id' || key === 'qcLogs' || key === 'logs') continue
      const oldStr = JSON.stringify(original[key])
      const newStr = JSON.stringify(edited[key])
      if (oldStr !== newStr) {
        changedFields[key] = edited[key]
      }
    }

    // Ensure numeric fields are properly typed when present
    if ('cubicCapacity' in changedFields) changedFields.cubicCapacity = Number(changedFields.cubicCapacity) || null
    if ('odometerReadingInKms' in changedFields) changedFields.odometerReadingInKms = Number(changedFields.odometerReadingInKms) || null
    if ('ownerSerialNumber' in changedFields) changedFields.ownerSerialNumber = Number(changedFields.ownerSerialNumber) || null
    if ('priceDiscovery' in changedFields) changedFields.priceDiscovery = Number(changedFields.priceDiscovery) || null

    // the telecallingId or appointmentId is needed
    // The get API merges them. We send updates using the appointmentId as telecallingId for the update API fallback in server
    await $fetch('/api/leads/update', {
      method: 'PUT',
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
  }
  catch (err: any) {
    if (!silent) toast.error(err?.data?.message || err?.message || 'Failed to save')
  }
  finally {
    if (!silent) isSaving.value = false
  }
}

function getConditionStyle(val: string) {
  const lower = val.toLowerCase().trim()
  const successKeys = ['ok', 'good', 'normal', 'safe', 'satisfactory', 'clean', 'clear']
  const errorKeys = ['major', 'tear', 'missing', 'broken', 'damage', 'dent', 'rust', 'cracked']
  const warningKeys = ['scratch', 'minor', 'fade', 'worn', 'repaint', 'chipped']
  const infoKeys = ['repair', 'replace', 'changed', 'service', 'dry']

  if (successKeys.some(k => lower.includes(k))) return { bg: 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400', icon: 'i-lucide-check-circle' }
  if (errorKeys.some(k => lower.includes(k))) return { bg: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400', icon: 'i-lucide-alert-triangle' }
  if (warningKeys.some(k => lower.includes(k))) return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: 'i-lucide-info' }
  if (infoKeys.some(k => lower.includes(k))) return { bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-400', icon: 'i-lucide-wrench' }
  return { bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-400', icon: 'i-lucide-tag' }
}

function getValuesArray(val: string | string[] | undefined | null) {
  let v: string[] = []
  if (Array.isArray(val)) v = val
  else if (typeof val === 'string' && val) v = [val]
  return v.flatMap(s => typeof s === 'string' ? s.split(',') : String(s)).map(s => s.trim()).filter(Boolean)
}

async function approveLead() {
  editForm.value.approvalStatus = 'Approved'
  await saveQC()
  router.push('/leads/approved')
}

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
    if (parts.length < 2) return null
    let afterUpload = parts[1]!.replace(/^v\d+\//, '')
    const hashIndex = afterUpload.indexOf('#')
    if (hashIndex !== -1) afterUpload = afterUpload.substring(0, hashIndex)
    const queryIndex = afterUpload.indexOf('?')
    if (queryIndex !== -1) afterUpload = afterUpload.substring(0, queryIndex)
    const lastDot = afterUpload.lastIndexOf('.')
    if (lastDot !== -1) afterUpload = afterUpload.substring(0, lastDot)
    return afterUpload
  } catch (e) {
    return null
  }
}

async function deleteCloudinaryFile(url: string) {
  const publicId = extractPublicId(url)
  if (!publicId) return
  const isVideo = url.match(/\.(mp4|webm|ogg)$/i)
  const endpoint = isVideo ? `${UPLOAD_BASE}/delete-video-from-cloudinary` : `${UPLOAD_BASE}/delete-image-from-cloudinary`
  
  try {
    await $fetch(endpoint, {
      method: 'DELETE',
      body: { publicId },
      headers: { Authorization: `Bearer ${KONG_TOKEN}`, 'token': KONG_TOKEN }
    })
  } catch (e) {
    console.error('Delete failed:', e)
  }
}

async function uploadCloudinaryFile(files: File[]) {
  if (files.length === 0) return []
  
  const isVideo = files[0]!.type.startsWith('video/')
  const endpoint = isVideo ? `${UPLOAD_BASE}/upload-car-video-to-cloudinary` : `${UPLOAD_BASE}/upload-car-images-to-cloudinary`
  
  const formData = new FormData()
  formData.append('appointmentId', String(car.value?.appointmentId || ''))
  
  if (isVideo) {
    formData.append('video', files[0]!)
  } else {
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
      headers: { Authorization: `Bearer ${KONG_TOKEN}`, 'token': KONG_TOKEN }
    })
    
    // Parse defensive multi-format responses
    if (res?.cloudinaryUrls && Array.isArray(res.cloudinaryUrls)) return res.cloudinaryUrls
    if (res?.cloudinaryUrl) return [res.cloudinaryUrl]
    if (res?.cloudinaryVideoUrl) return [res.cloudinaryVideoUrl]
    if (Array.isArray(res)) return res
    if (res?.data && Array.isArray(res.data)) return res.data
    if (res?.data?.url) return [res.data.url]
    if (res?.data?.videoUrl) return [res.data.videoUrl]
    if (res?.data?.imagesList) return res.data.imagesList
    if (res?.images && Array.isArray(res.images)) return res.images
    if (res?.urls && Array.isArray(res.urls)) return res.urls
    if (res?.url) return [res.url]
    if (res?.videoUrl) return [res.videoUrl]
    if (res?.imagesList) return res.imagesList
    if (typeof res === 'string') return [res]
    return []
  } catch (e) {
    console.error('Upload failed:', e)
    return []
  }
}

async function removeImage(key: string, idx: number, oldKey?: string) {
  let urlToDelete = null
  if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
    urlToDelete = editForm.value[key][idx]
    editForm.value[key].splice(idx, 1)
  } else if (oldKey && Array.isArray(editForm.value[oldKey])) {
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
      if (!Array.isArray(editForm.value[key])) editForm.value[key] = []
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
    if (!file) return
    
    let urlToDelete = null
    if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
      urlToDelete = editForm.value[key][idx]
    } else if (oldKey && Array.isArray(editForm.value[oldKey])) {
      urlToDelete = editForm.value[oldKey][idx]
    }
    
    const urls = await uploadCloudinaryFile([file])
    if (urls.length > 0) {
      const newUrl = urls[0]
      if (Array.isArray(editForm.value[key]) && editForm.value[key].length > 0) {
        editForm.value[key][idx] = newUrl
      } else if (oldKey && Array.isArray(editForm.value[oldKey])) {
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

const activeTab = ref('document-details')

const activeExteriorSection = computed(() => exteriorSections.find(s => s.title.toLowerCase().startsWith(activeTab.value)))

const tabs = [
  { id: 'document-details', label: 'Document Details', icon: 'i-lucide-file-text' },
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
const exteriorSections = [
  {
    title: 'Front',
    icon: 'i-lucide-arrow-up',
    imageKeys: ['frontMain', 'bonnetImages', 'frontWindshieldImages', 'roofImages', 'frontBumperImages', 'lhsHeadlampImages', 'lhsFoglampImages', 'rhsHeadlampImages', 'rhsFoglampImages'],
    parts: [
      { key: 'bonnet', label: 'Bonnet' },
      { key: 'frontWindshield', label: 'Front Windshield' },
      { key: 'roof', label: 'Roof' },
      { key: 'frontBumper', label: 'Front Bumper' },
      { key: 'lhsHeadlamp', label: 'LHS Headlamp' },
      { key: 'lhsFoglamp', label: 'LHS Foglamp' },
      { key: 'rhsHeadlamp', label: 'RHS Headlamp' },
      { key: 'rhsFoglamp', label: 'RHS Foglamp' },
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
      { new: 'lhsQuarterPanelWithRearDoorOpenImages', old: 'lhsQuarterPanelImages' }
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
      { key: 'lhsQuarterPanelDropdownList', oldKey: 'lhsQuarterPanel', imageKey: 'lhsQuarterPanelImages', oldImageKey: 'lhsQuarterPanelImages', label: 'LHS Quarter Panel' },
      { key: 'lhsQuarterPanelWithRearDoorOpenImages', oldKey: 'lhsQuarterPanelImages', imageKey: 'lhsQuarterPanelWithRearDoorOpenImages', oldImageKey: 'lhsQuarterPanelImages', label: 'LHS Qtr Panel W/ Boot Open', isImageOnly: true },
    ],
  },
  {
    title: 'Rear',
    icon: 'i-lucide-arrow-down',
    imageKeys: ['rearMain', 'rearWithBootDoorOpen', 'rearBumperImages', 'lhsTailLampImages', 'rhsTailLampImages', 'spareTyreImages', 'bootFloorImages'],
    parts: [
      { key: 'rearBumper', label: 'Rear Bumper' },
      { key: 'lhsTailLamp', label: 'LHS Tail Lamp' },
      { key: 'rhsTailLamp', label: 'RHS Tail Lamp' },
      { key: 'rearWindshield', label: 'Rear Windshield' },
      { key: 'bootDoor', label: 'Boot Door' },
      { key: 'spareTyre', label: 'Spare Tyre' },
      { key: 'bootFloor', label: 'Boot Floor' },
    ],
  },
  {
    title: 'Right (RHS)',
    icon: 'i-lucide-arrow-right',
    imageKeys: ['rhsRear45Degree', 'rhsFenderImages', 'rhsOrvmImages', 'rhsFrontAlloyImages', 'rhsFrontTyreImages', 'rhsFrontDoorImages', 'rhsRearDoorImages', 'rhsRunningBorderImages', 'rhsQuarterPanelImages'],
    parts: [
      { key: 'rhsFender', label: 'Fender' },
      { key: 'rhsOrvm', label: 'ORVM' },
      { key: 'rhsAPillar', label: 'A-Pillar', dropdownName: 'RHS A Pillar' },
      { key: 'rhsBPillar', label: 'B-Pillar', dropdownName: 'RHS B Pillar' },
      { key: 'rhsCPillar', label: 'C-Pillar', dropdownName: 'RHS C Pillar' },
      { key: 'rhsFrontAlloy', label: 'Front Alloy' },
      { key: 'rhsFrontTyre', label: 'Front Tyre' },
      { key: 'rhsRearAlloy', label: 'Rear Alloy' },
      { key: 'rhsRearTyre', label: 'Rear Tyre' },
      { key: 'rhsFrontDoor', label: 'Front Door' },
      { key: 'rhsRearDoor', label: 'Rear Door' },
      { key: 'rhsRunningBorder', label: 'Running Border' },
      { key: 'rhsQuarterPanel', label: 'Quarter Panel' },
    ],
  },
]

watch(() => car.value, (newVal) => {
  if (newVal) {
    const clone = JSON.parse(JSON.stringify(newVal))
    // Automatically map old keys to new keys based on exteriorSections config
    exteriorSections.forEach(section => {
      section.parts.forEach((part: any) => {
        if (part.oldKey && !clone[part.key] && clone[part.oldKey]) {
          clone[part.key] = clone[part.oldKey]
        }
      })
    })
    // Extract year from yearMonthOfManufacture for editing
    if (clone.yearMonthOfManufacture && !clone.yearOfManufacture) {
      try { clone.yearOfManufacture = new Date(clone.yearMonthOfManufacture).getFullYear() } catch {}
    }
    editForm.value = clone
  }
}, { immediate: true })

const engineParts = [
  { key: 'upperCrossMember', label: 'Upper Cross Member' },
  { key: 'radiatorSupport', label: 'Radiator Support' },
  { key: 'headlightSupport', label: 'Headlight Support' },
  { key: 'lowerCrossMember', label: 'Lower Cross Member' },
  { key: 'lhsApron', label: 'LHS Apron' },
  { key: 'rhsApron', label: 'RHS Apron' },
  { key: 'firewall', label: 'Firewall' },
  { key: 'cowlTop', label: 'Cowl Top' },
  { key: 'engine', label: 'Engine' },
  { key: 'coolant', label: 'Coolant' },
  { key: 'engineOilLevelDipstick', label: 'Engine Oil Dipstick' },
  { key: 'engineOil', label: 'Engine Oil' },
  { key: 'engineMount', label: 'Engine Mount' },
  { key: 'enginePermisableBlowBy', label: 'Blow-by' },
  { key: 'exhaustSmoke', label: 'Exhaust Smoke' },
  { key: 'clutch', label: 'Clutch' },
  { key: 'gearShift', label: 'Gear Shift' },
]

const electricalParts = [
  { key: 'battery', label: 'Battery' },
  { key: 'electricals', label: 'Electricals Condition' },
  { key: 'rearWiperWasher', label: 'Rear Wiper/Washer' },
  { key: 'rearDefogger', label: 'Rear Defogger' },
  { key: 'musicSystem', label: 'Music System' },
  { key: 'stereo', label: 'Stereo' },
  { key: 'inbuiltSpeaker', label: 'Inbuilt Speaker' },
  { key: 'externalSpeaker', label: 'External Speaker' },
  { key: 'steeringMountedAudioControl', label: 'Steering Audio Control' },
  { key: 'noOfPowerWindows', label: 'Power Windows' },
  { key: 'powerWindowConditionRhsFront', label: 'RHS Front Window' },
  { key: 'powerWindowConditionLhsFront', label: 'LHS Front Window' },
  { key: 'powerWindowConditionRhsRear', label: 'RHS Rear Window' },
  { key: 'powerWindowConditionLhsRear', label: 'LHS Rear Window' },
  { key: 'reverseCamera', label: 'Reverse Camera' },
]

const interiorParts = [
  { key: 'commentOnInterior', label: 'Interior Comments' },
  { key: 'sunroof', label: 'Sunroof' },
  { key: 'leatherSeats', label: 'Leather Seats' },
  { key: 'fabricSeats', label: 'Fabric Seats' },
  { key: 'airConditioningManual', label: 'AC (Manual)' },
  { key: 'airConditioningClimateControl', label: 'AC (Climate Control)' },
]

const steeringSuspensionBrakesParts = [
  { key: 'steering', label: 'Steering' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'abs', label: 'ABS' },
]

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

const engineImageKeys = [
  'engineBay',
  'apronLhsRhs',
  'batteryImages',
  'additionalImages',
]

const engineVideoKeys = [
  { key: 'engineSound', label: 'Engine Sound' },
  { key: 'exhaustSmokeImages', label: 'Exhaust Smoke' },
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
  catch (e) {
    // Return default below
  }
  return { type: 'video', src: url }
}

const interiorImageKeys = [
  'meterConsoleWithEngineOn',
  'airbags',
  'frontSeatsFromDriverSideDoorOpen',
  'rearSeatsFromRightSideDoorOpen',
  'dashboardFromRearSeat',
  'sunroofImages',
  'additionalImages2',
  'acImages',
]

const documentImageKeys = [
  'rcTaxToken',
  'insuranceCopy',
  'bothKeys',
  'form26GdCopyIfRcIsLost',
  'chassisEmbossmentImages',
  'vinPlateImages',
  'pucImages',
  'rtoNocImages',
  'rtoForm28Images',
  'roadTaxImages',
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
    for (const url of urls) {
      imgs.push({ url, label: humanize(newKey) })
    }
  }
  return imgs
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden -m-4 lg:-m-6">
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
        <div class="flex gap-1 px-4 lg:px-6 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px"
            :class="activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
            @click="activeTab = tab.id"
          >
            <Icon :name="tab.icon" class="size-4" />
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab Content (scrollable) -->
      <div class="flex-1 min-h-0 overflow-auto bg-muted/10 p-4 lg:p-6">
        
        <div v-if="activeTab === 'document-details'" class="animate-in fade-in duration-300 space-y-6">
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
                <!-- Row 1: Make, Model, Variant -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <!-- Make -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-2 font-medium">Make</p>
                    <div class="mt-auto relative z-10 w-full pr-8">
                      <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.make">{{ car.make || '—' }}</div>
                      <SearchableSelect v-else v-model="editForm.make" :options="makeOptions" placeholder="Make" class-name="h-8 text-sm font-bold shadow-none w-full border-b border-t-0 border-x-0 rounded-none px-0" />
                    </div>
                  </div>

                  <!-- Model -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-2 font-medium">Model</p>
                    <div class="mt-auto relative z-10 w-full pr-8">
                      <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.model">{{ car.model || '—' }}</div>
                      <SearchableSelect v-else v-model="editForm.model" :options="modelOptions" placeholder="Model" class-name="h-8 text-sm font-bold shadow-none w-full border-b border-t-0 border-x-0 rounded-none px-0" />
                    </div>
                  </div>

                  <!-- Variant -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-2 font-medium">Variant</p>
                    <div class="mt-auto relative z-10 w-full">
                      <div v-if="props.readonly" class="text-lg font-black text-foreground truncate" :title="car.variant">{{ car.variant || '—' }}</div>
                      <SearchableSelect v-else v-model="editForm.variant" :options="variantOptions" placeholder="Variant" class-name="h-8 w-full text-sm font-black shadow-none border-b border-t-0 border-x-0 rounded-none px-0" />
                    </div>
                  </div>
                </div>

                <!-- Row 2: Engine, Odometer, MFG Year -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <!-- Engine -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-1.5 font-medium">Engine</p>
                    <div class="flex items-center gap-2 mt-auto mr-12">
                      <div class="flex-1 bg-muted/80 rounded-lg py-1.5 px-3 border border-border/60 shadow-inner">
                        <p class="font-bold text-foreground text-sm tracking-tight truncate">{{ car.fuelType || '—' }} — {{ car.cubicCapacity || '—' }}<span class="text-[10px] opacity-70 ml-0.5">cc</span></p>
                      </div>
                    </div>
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 mt-1 size-12 rounded-full border-[3px] border-[#FBBC05]/10 flex items-center justify-center bg-background shadow-sm">
                      <Icon name="i-lucide-fuel" class="size-5 text-[#FBBC05]" />
                    </div>
                  </div>
                  
                  <!-- Odometer -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-1.5 font-medium">Odometer</p>
                    <div class="flex items-center gap-2 mt-auto mr-12">
                      <div class="flex-1 bg-muted/80 rounded-lg py-1.5 px-3 border border-border/60 shadow-inner">
                        <p v-if="props.readonly" class="font-extrabold text-foreground text-sm tracking-tight">{{ (car.odometerReadingInKms || 0).toLocaleString('en-IN') }} km</p>
                        <Input v-else v-model="editForm.odometerReadingInKms" type="number" class="h-6 text-sm font-extrabold bg-transparent border-none p-0 focus-visible:ring-0 shadow-none text-foreground" />
                      </div>
                    </div>
                    <!-- Decorative circle icon -->
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 mt-1 size-12 rounded-full border-[3px] border-[#4285F4]/10 flex items-center justify-center bg-background shadow-sm">
                      <Icon name="i-lucide-gauge" class="size-5 text-[#4285F4]" />
                    </div>
                  </div>

                  <!-- MFG Year -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-1 font-medium">MFG Year</p>
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

                <!-- Bottom Row: Ownership & City -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <!-- Ownership -->
                  <div class="md:col-span-2 rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between">
                    <p class="text-xs text-muted-foreground mb-2.5 font-medium">Ownership</p>
                    <div class="flex gap-1.5 h-9">
                      <!-- If readonly -->
                      <template v-if="props.readonly">
                        <div class="bg-blue-600 text-white rounded-md px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-md ring-1 ring-blue-600">
                          {{ Number(car.ownerSerialNumber || 1) }}{{ Number(car.ownerSerialNumber || 1) === 1 ? 'st' : Number(car.ownerSerialNumber || 1) === 2 ? 'nd' : Number(car.ownerSerialNumber || 1) === 3 ? 'rd' : 'th' }}
                        </div>
                        <div class="flex gap-1.5 opacity-50">
                          <div v-for="n in 5" :key="n" v-show="n !== Number(car.ownerSerialNumber || 1)" class="w-12 rounded-md border border-border/60 bg-muted/50 flex items-center justify-center text-xs font-semibold text-muted-foreground">{{ n }}{{ n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th' }}</div>
                        </div>
                      </template>
                      <!-- If editable -->
                      <template v-else>
                        <button
                          v-for="n in 5"
                          :key="n"
                          type="button"
                          class="flex-1 rounded-md text-sm font-bold transition-all duration-200 border flex items-center justify-center gap-2"
                          :class="Number(editForm.ownerSerialNumber) === n 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-1 ring-blue-600/50 scale-[1.02]' 
                            : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'"
                          @click="editForm.ownerSerialNumber = n"
                        >
                          {{ n }}{{ n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th' }}
                        </button>
                      </template>
                    </div>
                  </div>
                  
                  <!-- City -->
                  <div class="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between relative overflow-hidden">
                    <p class="text-xs text-muted-foreground mb-1 font-medium">City</p>
                    <h3 class="text-xl font-black text-foreground tracking-tight mt-auto relative z-10">{{ car.city || '—' }}</h3>
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
              <p class="text-sm text-muted-foreground mb-1 font-medium">Price Discovery</p>
              <div class="text-3xl font-black text-foreground tracking-tight mb-8">
                <span v-if="props.readonly">₹ {{ (car.priceDiscovery || 0).toLocaleString('en-IN') }}</span>
                <Input v-else v-model="editForm.priceDiscovery" type="number" class="h-12 text-2xl font-black bg-muted/50 mt-2 shadow-inner border-border/60" />
              </div>
              
              <!-- Assigned Inspector -->
              <div v-if="car.allocatedTo" class="mb-2 w-full">
                <p class="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-wider">Assigned Inspector</p>
                <div class="flex items-center gap-3 p-3 rounded-lg border border-border/80 bg-background/50 shadow-sm overflow-hidden">
                  <Avatar class="size-8 shrink-0">
                    <AvatarFallback class="text-xs font-bold bg-primary/10 text-primary">{{ (allocatedToName || 'UA').substring(0, 2).toUpperCase() }}</AvatarFallback>
                  </Avatar>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold text-foreground truncate" :title="allocatedToName">{{ allocatedToName }}</span>
                    <span class="text-[10px] text-muted-foreground truncate" :title="car.allocatedTo">{{ car.allocatedTo }}</span>
                  </div>
                </div>
              </div>
              
              <div v-if="!props.readonly" class="mt-6 flex flex-col gap-3">
                 <Separator />
                 <p class="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Icon name="i-lucide-check-circle-2" class="size-3 text-emerald-500" /> Auto-saving enabled
                 </p>
              </div>
            </div>
          </div>

          <!-- All Document Details -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-file-badge" class="size-4 text-primary" />
                Document & Registration Details
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="(val, key) in {
                    registrationNumber: 'Registration Number',
                    registrationDate: 'Registration Date',
                    registrationType: 'Registration Type',
                    registrationState: 'Registration State',
                    registeredRto: 'Registered RTO',
                    registeredOwner: 'Registered Owner',
                    registeredAddressAsPerRc: 'Registered Address',
                    rcBookAvailability: 'RC Book',
                    rcCondition: 'RC Condition',
                    rcStatus: 'RC Status',
                    fitnessTill: 'Fitness Till',
                    toBeScrapped: 'To Be Scrapped',
                    seatingCapacity: 'Seating Capacity',
                    numberOfCylinders: 'Number of Cylinders',
                    norms: 'Emission Norms',
                    color: 'Color',
                    insurance: 'Insurance Type',
                    insurancePolicyNumber: 'Policy Number',
                    insuranceValidity: 'Insurance Validity',
                    noClaimBonus: 'No Claim Bonus',
                    mismatchInInsurance: 'Insurance Mismatch',
                    insurer: 'Insurer',
                    hypothecatedTo: 'Hypothecated To',
                    hypothecationDetails: 'Hypothecation Details',
                    engineNumber: 'Engine Number',
                    chassisNumber: 'Chassis Number',
                    fuelType: 'Fuel Type',
                    cubicCapacity: 'Cubic Capacity',
                    roadTaxValidity: 'Road Tax Validity',
                    taxValidTill: 'Tax Valid Till',
                    duplicateKey: 'Duplicate Key',
                    rtoNoc: 'RTO NOC',
                    rtoForm28: 'RTO Form 28',
                    partyPeshi: 'Party Peshi',
                    mismatchInRc: 'Mismatch in RC',
                    additionalDetails: 'Additional Details',
                    contactNumber: 'Contact Number',
                    emailAddress: 'Email',
                  }" :key="key" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 w-1/3">
                    {{ val }}
                  </p>
                  <p v-if="props.readonly" class="text-sm font-medium text-right w-2/3">{{ editForm[key] || '—' }}</p>
                  <Input v-else v-model="editForm[key]" class="h-8 text-sm font-medium w-2/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ EXTERIOR TABS (FRONT/LEFT/REAR/RIGHT) ═══════ -->
        <div v-else-if="['front', 'left', 'rear', 'right'].includes(activeTab)" class="space-y-6">
          <!-- Condition Grid -->
          <Card class="!p-0 !py-0 overflow-hidden" style="padding: 0px !important;">
            <CardContent class="p-0 sm:p-0">
              <div v-if="activeExteriorSection" :key="activeExteriorSection.title" class="mb-0">
                <!-- Parts grid -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
                  <div
                    v-for="part in activeExteriorSection.parts"
                    :key="part.key"
                    class="rounded-xl border bg-card shadow-sm flex flex-row overflow-hidden min-h-[160px] h-[160px]"
                  >
                    <!-- Left Side: Controls & Condition -->
                    <div class="flex flex-col w-[200px] xl:w-[240px] shrink-0 border-r border-border/50 bg-muted/10 relative">
                      <template v-if="(part as any).isImageOnly">
                        <div class="h-full w-full flex flex-col bg-white/50 dark:bg-black/20">
                          <div class="px-3 py-2 border-b border-border/50 flex items-center justify-center bg-muted/30 h-10 shrink-0">
                            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{{ part.label }}</span>
                          </div>
                          <div class="p-4 flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-60">
                            <Icon name="i-lucide-camera" class="size-5 text-muted-foreground" />
                            <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-tight">Images Only<br/>Section</span>
                          </div>
                        </div>
                      </template>
                      <template v-else-if="!props.readonly && getOptions((part as any).dropdownName || part.label).length">
                        <MultiSelect 
                          v-model="editForm[part.key]" 
                          :options="getOptions((part as any).dropdownName || part.label)" 
                          class="h-full border-none shadow-none bg-transparent"
                        >
                          <template #trigger>
                            <div class="cursor-pointer h-full w-full flex flex-col hover:bg-muted/20 transition-colors group">
                              <!-- Header Label -->
                              <div class="px-3 py-2 border-b border-border/50 flex items-center justify-between bg-muted/30 h-10 shrink-0">
                                <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate group-hover:text-primary transition-colors">{{ part.label }}</span>
                                <Icon name="i-lucide-chevron-down" class="size-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                              </div>
                              
                              <!-- Selected Badges Render -->
                              <div class="p-3 flex-1 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white/50 dark:bg-black/20">
                                <div v-if="getValuesArray(editForm[part.key]).length" class="flex flex-wrap gap-2">
                                  <div 
                                    v-for="val in getValuesArray(editForm[part.key])" 
                                    :key="val"
                                    class="border px-2 py-1.5 rounded flex items-center gap-1.5 shadow-sm w-full"
                                    :class="getConditionStyle(val).bg"
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
                                selected ? '!border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-background font-black scale-[1.02] z-10' : 'opacity-85 hover:opacity-100'
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
                            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate">{{ part.label }}</span>
                          </div>
                          <div class="p-3 flex-1 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white/50 dark:bg-black/20">
                            <div v-if="getValuesArray(editForm[part.key]).length" class="flex flex-wrap gap-2">
                              <div 
                                v-for="val in getValuesArray(editForm[part.key])" 
                                :key="val"
                                class="border px-2 py-1.5 rounded flex items-center gap-1.5 shadow-sm w-full"
                                :class="getConditionStyle(val).bg"
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
                          <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-full truncate">{{ part.label }}</span>
                        </div>
                        <div class="p-3 flex-1 flex flex-col justify-center bg-white/50 dark:bg-black/20">
                          <p v-if="props.readonly" class="text-sm font-medium">{{ editForm[part.key] || '—' }}</p>
                          <Input v-else v-model="editForm[part.key]" class="shadow-sm border-border text-sm focus-visible:ring-1 bg-white dark:bg-zinc-900" placeholder="e.g. Scratched, Rust" />
                        </div>
                      </template>
                    </div>

                    <!-- Right Side: Horizontal Image Strip -->
                    <div class="flex-1 relative group bg-zinc-950/5 dark:bg-black/50 overflow-hidden flex flex-col">
                      <!-- Photo Gallery -->
                      <div v-if="getImages(editForm, (part as any).imageKey || `${part.key}Images`, (part as any).oldImageKey).length" class="flex-1 h-full w-full">
                        <div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-stretch">
                          <div
                            v-for="(imgUrl, idx) in getImages(editForm, (part as any).imageKey || `${part.key}Images`, (part as any).oldImageKey)"
                            :key="idx"
                            class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer group/item transition-all duration-300 border-r border-border/20 last:border-r-0"
                            @click="openLightboxUrls(getImages(editForm, (part as any).imageKey || `${part.key}Images`, (part as any).oldImageKey), idx, part.label)"
                          >
                            <img :src="imgUrl" :alt="part.label" class="w-full h-full object-cover select-none" loading="lazy">
                            
                            <!-- Overlay Actions (QC only) -->
                            <div v-if="!props.readonly" class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button 
                                variant="secondary" 
                                size="icon" 
                                class="size-7 shadow-sm rounded-full bg-white/90 hover:bg-white text-primary focus:outline-none" 
                                @click.stop="replaceImage((part as any).imageKey || `${part.key}Images`, idx, (part as any).oldImageKey)"
                              >
                                <Icon name="i-lucide-refresh-cw" class="size-3.5" />
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                class="size-7 shadow-sm rounded-full bg-red-500/90 hover:bg-red-600 focus:outline-none" 
                                @click.stop="removeImage((part as any).imageKey || `${part.key}Images`, idx, (part as any).oldImageKey)"
                              >
                                <Icon name="i-lucide-trash" class="size-3.5 text-white" />
                              </Button>
                            </div>
                          </div>
                          
                          <!-- Add Photo Endcap (QC only) -->
                          <div 
                            v-if="!props.readonly"
                            class="relative shrink-0 h-full aspect-[4/3] snap-center cursor-pointer bg-muted/30 border-r border-border/20 last:border-r-0 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors group/add" 
                            @click.stop="addImage((part as any).imageKey || `${part.key}Images`)"
                          >
                            <div class="size-10 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-2 group-hover/add:scale-110 transition-transform">
                              <Icon name="i-lucide-plus" class="size-5 text-primary" />
                            </div>
                            <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Add Photo</span>
                          </div>
                        </div>
                        
                        <!-- Swipe Indicator hint -->
                        <div v-if="getImages(editForm, (part as any).imageKey || `${part.key}Images`, (part as any).oldImageKey).length > 1" class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[8px] text-white font-medium tracking-wider pointer-events-none">
                           SWIPE
                        </div>
                      </div>
                      
                      <!-- Empty State -->
                      <div v-if="!props.readonly" class="flex h-full w-full flex-col items-center justify-center bg-transparent gap-3 relative cursor-pointer hover:bg-muted/10 transition-colors" @click.stop="addImage((part as any).imageKey || `${part.key}Images`)">
                         <div class="size-12 rounded-full bg-muted/30 flex items-center justify-center">
                           <Icon name="i-lucide-image-plus" class="size-5 text-muted-foreground/50" />
                         </div>
                         <span class="text-[11px] text-muted-foreground/60 font-bold tracking-widest uppercase">Click to add Photo</span>
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
              </div>
              <div v-if="activeTab === 'front'" class="mt-4 rounded-lg bg-muted/50 p-4">
                <p class="text-xs font-medium text-muted-foreground mb-1">
                  Inspector Comments
                </p>
                <p v-if="props.readonly" class="text-sm">{{ editForm.comments || '—' }}</p>
                <Textarea v-else v-model="editForm.comments" placeholder="Comments on exterior..." class="w-full text-sm min-h-[80px]" />
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ ENGINE BAY TAB ═══════ -->
        <div v-else-if="activeTab === 'engine-bay'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-cog" class="size-4 text-primary" />
                Engine Bay Components
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div
                  v-for="part in engineParts"
                  :key="part.key"
                  class="rounded-lg border overflow-hidden"
                >
                  <div
                    class="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2"
                    :class="getImages(editForm, (part as any).imageKey || `${part.key}Images`).length ? 'cursor-pointer hover:bg-muted/70 transition-colors' : ''"
                    @click="getImages(editForm, (part as any).imageKey || `${part.key}Images`).length && openLightboxUrls(getImages(editForm, (part as any).imageKey || `${part.key}Images`), 0, part.label)"
                  >
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ part.label }}</span>
                    <span v-if="getImages(editForm, (part as any).imageKey || `${part.key}Images`).length" class="flex items-center gap-1 text-[10px] text-primary">
                      <Icon name="i-lucide-camera" class="size-3" />
                      {{ getImages(editForm, (part as any).imageKey || `${part.key}Images`).length }}
                    </span>
                  </div>
                  <div class="p-2 border-t border-border/50">
                    <p v-if="props.readonly" class="text-sm font-medium px-1">{{ editForm[part.key] || '—' }}</p>
                    <Input v-else v-model="editForm[part.key]" class="h-8 text-sm" placeholder="e.g. Okay, Scratched" />
                  </div>
                </div>
              </div>

              <!-- Engine Photos inline -->
              <div v-if="sectionImages(engineImageKeys).length" class="mt-4">
                <div class="flex items-center gap-2 mb-3">
                  <Icon name="i-lucide-image" class="size-4 text-primary" />
                  <h3 class="text-sm font-semibold">
                    Engine Bay Photos
                  </h3>
                  <Separator class="flex-1" />
                </div>
                <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  <div
                    v-for="(img, idx) in sectionImages(engineImageKeys)"
                    :key="idx"
                    class="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                    @click="openLightbox(sectionImages(engineImageKeys), idx)"
                  >
                    <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge variant="secondary" class="absolute bottom-1 left-1 text-[9px] max-w-[calc(100%-8px)] truncate">
                      {{ img.label }}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card v-if="car">
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-video" class="size-4 text-primary" />
                Engine Videos
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <template v-for="vk in engineVideoKeys" :key="vk.key">
                  <div class="space-y-2">
                    <p class="text-sm font-medium flex items-center gap-2">
                      <Icon name="i-lucide-play-circle" class="size-4 text-primary" />
                      {{ vk.label }}
                    </p>
                    <template v-if="getVideos(car, vk.key).length">
                      <div v-for="(videoUrl, vIdx) in getVideos(car, vk.key)" :key="`${vk.key}-${vIdx}`" class="rounded-lg overflow-hidden border bg-black relative" style="padding-top: 56.25%;">
                        <template v-if="getEmbedUrl(videoUrl).type === 'iframe'">
                          <iframe
                            :src="getEmbedUrl(videoUrl).src"
                            allow="autoplay"
                            allowfullscreen
                            class="absolute inset-0 w-full h-full border-0"
                          />
                        </template>
                        <template v-else>
                          <video
                            :src="getEmbedUrl(videoUrl).src"
                            controls
                            playsinline
                            crossorigin="anonymous"
                            preload="auto"
                            class="absolute inset-0 w-full h-full object-contain"
                          >
                            Your browser does not support the video tag.
                          </video>
                        </template>
                      </div>
                    </template>
                    <template v-else>
                      <div class="rounded-lg border border-dashed border-border flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors relative" style="padding-top: 56.25%;">
                        <div class="absolute inset-0 flex items-center justify-center">
                          <img src="/video-not-available.png" alt="Video Not Available" class="h-full w-full object-cover opacity-80">
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ ELECTRICALS TAB ═══════ -->
        <div v-else-if="activeTab === 'electricals'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-zap" class="size-4 text-primary" />
                Electrical Components
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div
                  v-for="part in electricalParts"
                  :key="part.key"
                  class="rounded-lg border overflow-hidden"
                >
                  <div class="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ part.label }}</span>
                  </div>
                  <div class="p-2 border-t border-border/50">
                    <p v-if="props.readonly" class="text-sm font-medium px-1">{{ editForm[part.key] || '—' }}</p>
                    <Input v-else v-model="editForm[part.key]" class="h-8 text-sm" placeholder="e.g. Okay, Scratched" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ INTERIOR TAB ═══════ -->
        <div v-else-if="activeTab === 'interior'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-armchair" class="size-4 text-primary" />
                Interior Features
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div
                  v-for="item in [
                    { label: 'Music System', value: editForm.musicSystem },
                    { label: 'Stereo', value: editForm.stereo },
                    { label: 'Inbuilt Speaker', value: editForm.inbuiltSpeaker },
                    { label: 'External Speaker', value: editForm.externalSpeaker },
                    { label: 'Steering Audio Control', value: editForm.steeringMountedAudioControl },
                    { label: 'Power Windows', value: editForm.noOfPowerWindows },
                    { label: 'Rear Wiper/Washer', value: editForm.rearWiperWasher },
                    { label: 'Rear Defogger', value: editForm.rearDefogger },
                    { label: 'Reverse Camera', value: editForm.reverseCamera },
                    { label: 'Sunroof', value: editForm.sunroof },
                    { label: 'Leather Seats', value: editForm.leatherSeats },
                    { label: 'Fabric Seats', value: editForm.fabricSeats },
                    { label: 'AC (Manual)', value: editForm.airConditioningManual },
                    { label: 'AC (Climate)', value: editForm.airConditioningClimateControl },
                  ]" :key="item.label" class="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0"
                >
                  <p class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium text-right">
                    {{ item.value || '—' }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Airbags -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-shield" class="size-4 text-primary" />
                Safety — Airbags ({{ car.noOfAirBags || 0 }})
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div
                  v-for="item in [
                    { label: 'Driver Side', key: 'airbagFeaturesDriverSide' },
                    { label: 'Co-Driver Side', key: 'airbagFeaturesCoDriverSide' },
                    { label: 'LHS A-Pillar Curtain', key: 'airbagFeaturesLhsAPillarCurtain' },
                    { label: 'LHS B-Pillar Curtain', key: 'airbagFeaturesLhsBPillarCurtain' },
                    { label: 'LHS C-Pillar Curtain', key: 'airbagFeaturesLhsCPillarCurtain' },
                    { label: 'RHS A-Pillar Curtain', key: 'airbagFeaturesRhsAPillarCurtain' },
                    { label: 'RHS B-Pillar Curtain', key: 'airbagFeaturesRhsBPillarCurtain' },
                    { label: 'RHS C-Pillar Curtain', key: 'airbagFeaturesRhsCPillarCurtain' },
                  ]"
                  :key="item.key"
                  class="rounded-lg border overflow-hidden"
                >
                  <div class="px-3 py-2 bg-muted/40 border-b">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ item.label }}</span>
                  </div>
                  <div class="p-2 border-t border-border/50">
                    <p v-if="props.readonly" class="text-sm font-medium px-1">{{ editForm[item.key] || '—' }}</p>
                    <Input v-else v-model="editForm[item.key]" class="h-8 text-sm" placeholder="e.g. Okay, Scratched" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Interior Photos inline -->
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-camera" class="size-4 text-primary" />
                Interior Photos
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div v-if="sectionImages(interiorImageKeys).length" class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                <div
                  v-for="(img, idx) in sectionImages(interiorImageKeys)"
                  :key="idx"
                  class="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border hover:border-primary/50 transition-colors"
                  @click="openLightbox(sectionImages(interiorImageKeys), idx)"
                >
                  <img :src="img.url" :alt="img.label" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <Badge variant="secondary" class="absolute bottom-1 left-1 text-[9px] max-w-[calc(100%-8px)] truncate">
                    {{ img.label }}
                  </Badge>
                </div>
              </div>
              <p v-else class="text-center text-muted-foreground text-sm py-8">
                No interior photos available
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ STEERING, SUSPENSION, BRAKES TAB ═══════ -->
        <!-- ═══════ STEERING, SUSPENSION, BRAKES TAB ═══════ -->
        <div v-else-if="activeTab === 'steering-suspension-brakes'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-disc" class="size-4 text-primary" />
                Steering, Suspension & Brakes
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div
                  v-for="part in steeringSuspensionBrakesParts"
                  :key="part.key"
                  class="rounded-lg border overflow-hidden"
                >
                  <div class="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ part.label }}</span>
                  </div>
                  <div class="p-2 border-t border-border/50">
                    <p v-if="props.readonly" class="text-sm font-medium px-1">{{ editForm[part.key] || '—' }}</p>
                    <Input v-else v-model="editForm[part.key]" class="h-8 text-sm" placeholder="e.g. Okay, Scratched" />
                  </div>
                </div>
              </div>

              <!-- Test Drive Summary -->
              <div class="mt-6 pt-4 border-t">
                <h3 class="text-sm font-semibold mb-3">
                  Test Drive Details
                </h3>
                <div class="flex items-center gap-4 py-1.5">
                  <p class="text-xs text-muted-foreground w-1/4">
                    Odometer Reading Before Test Drive
                  </p>
                  <p class="text-sm font-medium">
                    {{ (car.odometerReadingBeforeTestDrive || car.odometerReadingInKms || 0).toLocaleString() }} km
                  </p>
                </div>
                <div v-if="car.odometerReadingAfterTestDriveInKms" class="flex items-center gap-4 py-1.5">
                  <p class="text-xs text-muted-foreground w-1/4">
                    Odometer Reading After Test Drive
                  </p>
                  <p class="text-sm font-medium">
                    {{ car.odometerReadingAfterTestDriveInKms.toLocaleString() }} km
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ═══════ QC AUDIT LOGS TAB ═══════ -->
        <div v-else-if="activeTab === 'qc-logs'" class="space-y-6">
          <Card>
            <CardHeader class="pt-5 pb-3">
              <CardTitle class="text-base flex items-center gap-2">
                <Icon name="i-lucide-history" class="size-4 text-primary" />
                Modification History Log
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent class="pt-4 pb-5">
              <div v-if="!car?.qcLogs || car.qcLogs.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-dashed border-border bg-muted/20">
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
                <div v-for="(log, idx) in [...car.qcLogs].reverse()" :key="idx" class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
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
          <Card>
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
          <Card>
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
          <Card>
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
          <Card>
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
