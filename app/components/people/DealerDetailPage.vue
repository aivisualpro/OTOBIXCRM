<script setup lang="ts">
import type { PeopleUser } from '~/composables/usePeopleApi'
import { toast } from 'vue-sonner'

const props = defineProps<{ user: PeopleUser, readOnly?: boolean, backRoute?: string }>()
const emit = defineEmits<{
  edit: []
  delete: []
}>()

// ─── Inline Edit Mode ───
const isEditing = ref(false)
const editForm = ref<Record<string, any>>({})

const EDITABLE_FIELDS = [
  'dealershipName', 'userName', 'email', 'phoneNumber', 'entityType',
  'primaryContactPerson', 'primaryContactNumber',
  'secondaryContactPerson', 'secondaryContactNumber',
]

function startEditing() {
  const obj: Record<string, any> = {}
  EDITABLE_FIELDS.forEach(k => { obj[k] = props.user[k] ?? '' })
  editForm.value = obj
  isEditing.value = true
}

const { updateUser: _updateUser } = usePeopleApi()
const isSaving = ref(false)

async function saveEdits() {
  const id = props.user._id || props.user.id
  if (!id) return
  isSaving.value = true
  try {
    const changes: Record<string, any> = {}
    EDITABLE_FIELDS.forEach(k => {
      if (editForm.value[k] !== (props.user[k] ?? '')) changes[k] = editForm.value[k]
    })
    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save')
      isEditing.value = false
      isSaving.value = false
      return
    }
    await _updateUser(id, changes)
    Object.assign(props.user, changes)
    toast.success('Dealer updated')
    isEditing.value = false
  } catch (err: any) {
    toast.error(err?.data?.message || 'Failed to save')
  } finally {
    isSaving.value = false
  }
}

const router = useRouter()

const userCookie = useCookie('userData')
const currentUserRole = computed(() => {
  const cUser = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
  return cUser?.userType || cUser?.userRole || cUser?.role || ''
})
const canViewPassword = computed(() => currentUserRole.value === 'Admin' || currentUserRole.value === 'Super Admin')
const showPassword = ref(false)

const { activeWorkspace } = useWorkspace()
const hasEditPermission = computed(() => {
  if (!activeWorkspace.value?.peopleActions)
    return true
  return activeWorkspace.value.peopleActions.includes('edit')
})
const hasDeletePermission = computed(() => {
  if (!activeWorkspace.value?.peopleActions)
    return true
  return activeWorkspace.value.peopleActions.includes('delete')
})

// ─── KAM lookup ───
const { allKams, fetchKams } = useKamsApi()
const { updateUser } = usePeopleApi()
onMounted(() => fetchKams())

const assignedKam = computed(() => {
  const id = props.user.assignedKam
  if (!id)
    return null
  return allKams.value.find(k => k._id === id || k.id === id) || null
})

// ─── KAM Change ───
const showKamChangeDialog = ref(false)
const selectedNewKamId = ref('')
const kamChangeSaving = ref(false)

function openKamChange() {
  selectedNewKamId.value = props.user.assignedKam || '_none_'
  showKamChangeDialog.value = true
}

async function confirmKamChange() {
  kamChangeSaving.value = true
  const uid = props.user._id || props.user.id
  try {
    const kamValue = selectedNewKamId.value === '_none_' ? '' : selectedNewKamId.value
    await updateUser(uid, { assignedKam: kamValue })
    // Optimistic update on the reactive user
    ;(props.user as any).assignedKam = kamValue
    toast.success('KAM assignment updated')
    showKamChangeDialog.value = false
  } catch (err: any) {
    toast.error(err?.data?.message || 'Failed to update KAM')
  } finally {
    kamChangeSaving.value = false
  }
}


// ─── Formatters ───
function getInitials(name: string): string {
  if (!name)
    return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try { return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }
  catch { return value }
}

function formatDateTime(value: string): string {
  if (!value)
    return '—'
  try { return new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return value }
}

const statusBadge: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const locations = computed(() => {
  const loc = props.user?.location
  if (!loc)
    return []
  if (Array.isArray(loc))
    return loc
  return loc.split(',').map((l: string) => l.trim()).filter(Boolean)
})

const addresses = computed(() => {
  const addr = props.user?.addressList
  if (!addr || (Array.isArray(addr) && addr.length === 0))
    return []
  return Array.isArray(addr) ? addr.filter((a: string) => a?.trim()) : [addr]
})

// ─── Address management ───
const showAddAddress = ref(false)
const newAddress = ref('')
const addressSaving = ref(false)

async function addAddress() {
  const val = newAddress.value.trim()
  if (!val) return
  addressSaving.value = true
  const id = props.user._id || props.user.id
  const current = Array.isArray(props.user.addressList) ? [...props.user.addressList] : props.user.addressList ? [props.user.addressList] : []
  current.push(val)
  try {
    await _updateUser(id, { addressList: current })
    props.user.addressList = current
    newAddress.value = ''
    showAddAddress.value = false
    toast.success('Address added')
  } catch (err: any) {
    toast.error('Failed to add address')
  } finally {
    addressSaving.value = false
  }
}

async function removeAddress(index: number) {
  const id = props.user._id || props.user.id
  const current = [...addresses.value]
  current.splice(index, 1)
  try {
    await _updateUser(id, { addressList: current })
    props.user.addressList = current
    toast.success('Address removed')
  } catch {
    toast.error('Failed to remove address')
  }
}

const bids = computed(() => props.user?.myBids || [])
const purchasedCarIds = computed(() => props.user?.purchasedCars || [])
const wishlistIds = computed(() => props.user?.wishlist || [])

// ─── Resolve car ObjectIds to car data ───
const resolvedPurchasedCars = ref<any[]>([])
const resolvedWishlistCars = ref<any[]>([])
const isLoadingCars = ref(false)

async function resolveCarIds() {
  const allIds = [...new Set([...purchasedCarIds.value, ...wishlistIds.value].filter(Boolean))]
  if (!allIds.length) return

  isLoadingCars.value = true
  try {
    const res = await $fetch<any>('/api/cars/by-ids', { method: 'POST', body: { ids: allIds } })
    const carMap = new Map<string, any>()
    ;(res?.cars || []).forEach((c: any) => carMap.set(c._id || c.id, c))

    resolvedPurchasedCars.value = purchasedCarIds.value
      .map((id: string) => carMap.get(id))
      .filter(Boolean)
    resolvedWishlistCars.value = wishlistIds.value
      .map((id: string) => carMap.get(id))
      .filter(Boolean)
  }
  catch (err) {
    console.error('Failed to resolve car IDs:', err)
  }
  finally {
    isLoadingCars.value = false
  }
}

// ─── Enriched bids (from bids collection) ───
const enrichedBids = ref<any[]>([])
const isLoadingBids = ref(false)

async function fetchEnrichedBids() {
  const userId = props.user?._id || props.user?.id
  if (!userId) return
  isLoadingBids.value = true
  try {
    const res = await $fetch<any>(`/api/users/${userId}/bids`)
    enrichedBids.value = res?.bids || []
  }
  catch (err) {
    console.error('Failed to fetch bids:', err)
  }
  finally {
    isLoadingBids.value = false
  }
}

onMounted(() => {
  resolveCarIds()
  fetchEnrichedBids()
})

function formatCurrency(val: any): string {
  if (!val && val !== 0) return '—'
  return '₹' + Number(val).toLocaleString('en-IN')
}

function formatBidTime(val: any): string {
  if (!val) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(val))
  } catch { return String(val) }
}

// ─── Search state ───
const wishlistSearch = ref('')
const bidsSearch = ref('')

// ─── Group bids by appointmentId ───
const groupedBids = computed(() => {
  const groups = new Map<string, { key: string, appointmentId: string, make: string, model: string, variant: string, image: any, bids: any[] }>()
  for (const bid of enrichedBids.value) {
    const key = bid.appointmentId || bid.carId || 'unknown'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        appointmentId: bid.appointmentId || '',
        make: bid.make || '',
        model: bid.model || '',
        variant: bid.variant || '',
        image: bid.frontMainImage || null,
        bids: [],
      })
    }
    groups.get(key)!.bids.push(bid)
  }
  return Array.from(groups.values())
})

const filteredGroupedBids = computed(() => {
  const q = bidsSearch.value.toLowerCase().trim()
  if (!q) return groupedBids.value
  return groupedBids.value.filter(g =>
    g.make.toLowerCase().includes(q)
    || g.model.toLowerCase().includes(q)
    || g.variant.toLowerCase().includes(q)
    || g.appointmentId.toLowerCase().includes(q),
  )
})

const filteredWishlistCars = computed(() => {
  const q = wishlistSearch.value.toLowerCase().trim()
  if (!q) return resolvedWishlistCars.value
  return resolvedWishlistCars.value.filter((car: any) => {
    const text = [car.make, car.model, car.variant, car.appointmentId, car.registrationNumber, car.city].filter(Boolean).join(' ').toLowerCase()
    return text.includes(q)
  })
})

function getCarImage(car: any): string | null {
  // Check both singular and plural field names
  const raw = car.frontMainImage || car.frontMainImages
  if (!raw) return null
  if (Array.isArray(raw) && raw.length > 0) return raw[0]
  if (typeof raw === 'string' && raw !== '[]' && raw !== 'null' && raw !== '') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0]
    }
    catch { return raw }
  }
  return null
}

function formatKms(val: any): string {
  if (!val) return ''
  return Number(val).toLocaleString()
}
</script>

<template>
  <!-- Teleport header actions -->
  <ClientOnly>
    <HeaderActions>
      <Button variant="ghost" size="sm" class="h-8" @click="router.push(props.backRoute || '/people/dealer')">
        <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
        Back
      </Button>
      <Separator orientation="vertical" class="h-5" />
      <template v-if="!readOnly && isEditing">
        <Button size="sm" class="h-8" :disabled="isSaving" @click="saveEdits">
          <Icon :name="isSaving ? 'i-lucide-loader-2' : 'i-lucide-check'" class="mr-1.5 size-3.5" :class="{ 'animate-spin': isSaving }" />
          Save
        </Button>
        <Button variant="outline" size="sm" class="h-8" @click="isEditing = false">
          Cancel
        </Button>
      </template>
      <template v-else-if="!readOnly">
        <Button v-if="hasEditPermission" size="sm" class="h-8" @click="startEditing">
          <Icon name="i-lucide-pencil" class="mr-1.5 size-3.5" />
          Edit
        </Button>
        <Button v-if="hasDeletePermission" variant="destructive" size="sm" class="h-8" @click="emit('delete')">
          <Icon name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
          Delete
        </Button>
      </template>
    </HeaderActions>
  </ClientOnly>

  <!-- 3-Column Layout (fixed height, no page scroll) -->
  <div class="w-full h-full flex gap-2 p-2 overflow-hidden">
    <!-- ═══════════ LEFT COLUMN: Dealer Info ═══════════ -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border bg-card">
      <div class="shrink-0 px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <Icon name="i-lucide-building-2" class="size-4 text-amber-500" />
        <h3 class="text-sm font-bold">Dealer Details</h3>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Identity Card -->
        <div class="rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border p-4 space-y-3">
          <div class="flex items-center gap-3">
            <div class="size-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md">
              <span class="text-lg font-bold text-white">{{ getInitials(user.dealershipName || user.userName) }}</span>
            </div>
            <div v-if="isEditing" class="min-w-0 flex-1 space-y-1">
              <Input v-model="editForm.dealershipName" class="h-7 text-xs" placeholder="Dealership Name" />
              <Input v-model="editForm.userName" class="h-7 text-xs" placeholder="User Name" />
            </div>
            <div v-else class="min-w-0 flex-1">
              <p class="font-bold text-base truncate">{{ user.dealershipName || user.userName || '—' }}</p>
              <p v-if="user.userName && user.dealershipName" class="text-xs text-muted-foreground">{{ user.userName }}</p>
            </div>
          </div>
          <!-- Stats row -->
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border bg-background/60 px-2.5 py-1.5 text-center">
              <p class="text-[10px] text-muted-foreground">Bids</p>
              <p class="text-sm font-bold tabular-nums">{{ bids.length }}</p>
            </div>
            <div class="rounded-lg border bg-background/60 px-2.5 py-1.5 text-center">
              <p class="text-[10px] text-muted-foreground">Cars</p>
              <p class="text-sm font-bold tabular-nums">{{ purchasedCarIds.length }}</p>
            </div>
            <div class="rounded-lg border bg-background/60 px-2.5 py-1.5 text-center">
              <p class="text-[10px] text-muted-foreground">Wishlist</p>
              <p class="text-sm font-bold tabular-nums">{{ wishlistIds.length }}</p>
            </div>
          </div>
        </div>

        <!-- Contact Info -->
        <div class="rounded-xl border p-4 space-y-2.5">
          <h4 class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Icon name="i-lucide-contact" class="size-3" />
            Contact
          </h4>
          <div class="flex items-center gap-2.5 text-sm">
            <Icon name="i-lucide-mail" class="size-3.5 text-muted-foreground shrink-0" />
            <Input v-if="isEditing" v-model="editForm.email" class="h-7 text-xs flex-1" />
            <span v-else class="truncate">{{ user.email || '—' }}</span>
          </div>
          <div class="flex items-center gap-2.5 text-sm">
            <Icon name="i-lucide-phone" class="size-3.5 text-muted-foreground shrink-0" />
            <Input v-if="isEditing" v-model="editForm.phoneNumber" class="h-7 text-xs flex-1 font-mono" />
            <span v-else class="font-mono">{{ user.phoneNumber || '—' }}</span>
          </div>
          <div class="flex items-center gap-2.5 text-sm">
            <Icon name="i-lucide-building" class="size-3.5 text-muted-foreground shrink-0" />
            <Input v-if="isEditing" v-model="editForm.entityType" class="h-7 text-xs flex-1" />
            <span v-else>{{ user.entityType || '—' }}</span>
          </div>
        </div>

        <!-- Primary & Secondary Contacts -->
        <div v-if="user.primaryContactPerson || user.secondaryContactPerson" class="rounded-xl border p-4 space-y-2.5">
          <h4 class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Icon name="i-lucide-users" class="size-3" />
            Contact Persons
          </h4>
          <div class="flex items-center gap-2.5 rounded-lg bg-muted/20 border p-2.5">
            <div class="size-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-user" class="size-3 text-blue-500" />
            </div>
            <div v-if="isEditing" class="min-w-0 flex-1 space-y-1">
              <Input v-model="editForm.primaryContactPerson" class="h-7 text-xs" placeholder="Primary Contact Name" />
              <Input v-model="editForm.primaryContactNumber" class="h-7 text-xs font-mono" placeholder="Primary Contact Number" />
            </div>
            <div v-else class="min-w-0 flex-1">
              <p class="text-xs font-semibold truncate">{{ user.primaryContactPerson || '—' }}</p>
              <p class="text-[10px] text-muted-foreground font-mono">{{ user.primaryContactNumber || '—' }}</p>
            </div>
            <Badge variant="secondary" class="text-[9px]">Primary</Badge>
          </div>
          <div class="flex items-center gap-2.5 rounded-lg bg-muted/20 border p-2.5">
            <div class="size-7 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-user" class="size-3 text-pink-500" />
            </div>
            <div v-if="isEditing" class="min-w-0 flex-1 space-y-1">
              <Input v-model="editForm.secondaryContactPerson" class="h-7 text-xs" placeholder="Secondary Contact Name" />
              <Input v-model="editForm.secondaryContactNumber" class="h-7 text-xs font-mono" placeholder="Secondary Contact Number" />
            </div>
            <div v-else class="min-w-0 flex-1">
              <p class="text-xs font-semibold truncate">{{ user.secondaryContactPerson || '—' }}</p>
              <p class="text-[10px] text-muted-foreground font-mono">{{ user.secondaryContactNumber || '—' }}</p>
            </div>
            <Badge variant="secondary" class="text-[9px]">Secondary</Badge>
          </div>
        </div>

        <!-- Locations -->
        <div v-if="locations.length > 0" class="rounded-xl border p-4 space-y-2.5">
          <h4 class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Icon name="i-lucide-map-pin" class="size-3" />
            Locations
          </h4>
          <div class="flex flex-wrap gap-1.5">
            <Badge v-for="loc in locations" :key="loc" variant="outline" class="bg-rose-500/5 text-rose-600 border-rose-500/15 text-[10px] gap-1">
              <Icon name="i-lucide-map-pin" class="size-2.5" />
              {{ loc }}
            </Badge>
          </div>
        </div>

        <!-- Addresses -->
        <div class="rounded-xl border p-4 space-y-2.5">
          <div class="flex items-center justify-between">
            <h4 class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="i-lucide-home" class="size-3" />
              Addresses
            </h4>
            <Button v-if="!readOnly" variant="ghost" size="sm" class="h-6 w-6 p-0" @click="showAddAddress = !showAddAddress">
              <Icon :name="showAddAddress ? 'i-lucide-x' : 'i-lucide-plus'" class="size-3" />
            </Button>
          </div>
          <!-- Add new address -->
          <div v-if="showAddAddress" class="flex items-center gap-1.5">
            <Input v-model="newAddress" placeholder="Enter new address..." class="h-7 text-xs flex-1" @keyup.enter="addAddress" />
            <Button size="sm" class="h-7 text-xs px-2" :disabled="!newAddress.trim() || addressSaving" @click="addAddress">
              <Icon :name="addressSaving ? 'i-lucide-loader-2' : 'i-lucide-check'" class="size-3" :class="{ 'animate-spin': addressSaving }" />
            </Button>
          </div>
          <div v-for="(addr, i) in addresses" :key="i" class="rounded-lg bg-muted/20 border px-3 py-2 text-xs flex items-start gap-2 group">
            <Icon name="i-lucide-navigation" class="size-3 text-muted-foreground mt-0.5 shrink-0" />
            <span class="flex-1">{{ addr }}</span>
            <button v-if="!readOnly" class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" @click="removeAddress(i)">
              <Icon name="i-lucide-x" class="size-3" />
            </button>
          </div>
          <p v-if="addresses.length === 0 && !showAddAddress" class="text-xs text-muted-foreground italic">No addresses</p>
        </div>

        <!-- Assigned KAM -->
        <div class="rounded-xl border p-4 space-y-2.5">
          <div class="flex items-center justify-between">
            <h4 class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="i-lucide-user-check" class="size-3" />
              Assigned KAM
            </h4>
            <Button v-if="!readOnly" variant="ghost" size="sm" class="h-6 text-[10px] px-2" @click="openKamChange">
              <Icon name="i-lucide-repeat" class="mr-1 size-2.5" />
              {{ assignedKam ? 'Change' : 'Assign' }}
            </Button>
          </div>
          <div v-if="assignedKam" class="flex items-center gap-2.5 rounded-lg bg-orange-500/5 border border-orange-500/15 p-2.5">
            <div class="size-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-white">{{ (assignedKam.name || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold truncate">{{ assignedKam.name }}</p>
              <p v-if="assignedKam.email" class="text-[10px] text-muted-foreground truncate">{{ assignedKam.email }}</p>
            </div>
            <Badge v-if="assignedKam.region" variant="outline" class="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20">{{ assignedKam.region }}</Badge>
          </div>
          <p v-else class="text-xs text-muted-foreground italic">No KAM assigned</p>
        </div>

        <!-- Dealer ID -->
        <div class="rounded-xl border border-dashed bg-muted/10 px-3 py-2 flex items-center justify-between">
          <span class="text-[10px] text-muted-foreground">Dealer ID</span>
          <code class="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{{ user._id || user.id }}</code>
        </div>
      </div>
    </div>

    <!-- ═══════════ MIDDLE COLUMN: Wishlist ═══════════ -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border bg-card">
      <div class="shrink-0 border-b bg-muted/30">
        <div class="px-4 py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="i-lucide-heart" class="size-4 text-rose-500" />
            <h3 class="text-sm font-bold">Wishlist</h3>
          </div>
          <Badge variant="secondary" class="text-[10px] tabular-nums">{{ filteredWishlistCars.length }}</Badge>
        </div>
        <div v-if="resolvedWishlistCars.length > 3" class="px-3 pb-2">
          <Input v-model="wishlistSearch" placeholder="Search cars..." class="h-7 text-xs" />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div v-if="isLoadingCars" class="flex items-center justify-center py-12 text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-5 animate-spin mr-2" />
          <span class="text-xs">Loading...</span>
        </div>
        <div v-else-if="filteredWishlistCars.length > 0" class="p-2 space-y-1.5">
          <div
            v-for="car in filteredWishlistCars"
            :key="car._id"
            class="rounded-lg border bg-background overflow-hidden hover:shadow-sm transition-all cursor-pointer"
          >
            <!-- Row 1: Image (tall) + Make/Model/Variant/AppointmentId inline -->
            <div class="flex items-stretch gap-2.5 p-2">
              <div class="w-20 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                <img v-if="getCarImage(car)" :src="getCarImage(car)!" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Icon name="i-lucide-car" class="size-6 text-muted-foreground/15" />
                </div>
              </div>
              <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold">{{ car.make }}</span>
                  <span class="text-xs font-semibold text-muted-foreground">{{ car.model }}</span>
                </div>
                <p v-if="car.variant" class="text-[10px] text-muted-foreground/70 truncate">{{ car.variant }}</p>
                <div class="flex items-center gap-1 mt-0.5">
                  <span v-if="car.fuelType" class="bg-rose-500/10 text-rose-600 px-1 py-0 text-[8px] font-bold rounded uppercase">{{ car.fuelType }}</span>
                  <span v-if="car.transmissionType" class="bg-purple-500/10 text-purple-600 px-1 py-0 text-[8px] font-bold rounded uppercase">{{ car.transmissionType }}</span>
                </div>
              </div>
              <span v-if="car.appointmentId" class="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded self-start shrink-0">{{ car.appointmentId }}</span>
            </div>
            <!-- Row 2: All specs inline -->
            <div class="flex items-center gap-2 flex-wrap px-2 pb-2 text-[10px]">
              <span v-if="car.mfgYear" class="flex items-center gap-0.5"><span class="text-muted-foreground">Year</span> <span class="font-semibold">{{ car.mfgYear }}</span></span>
              <span v-if="car.odometerReadingInKms" class="flex items-center gap-0.5"><span class="text-muted-foreground">KMs</span> <span class="font-semibold tabular-nums">{{ formatKms(car.odometerReadingInKms) }}</span></span>
              <span v-if="car.ownerSerialNumber" class="flex items-center gap-0.5"><span class="text-muted-foreground">Owner</span> <span class="font-semibold">{{ car.ownerSerialNumber }}</span></span>
              <span v-if="car.bodyType" class="flex items-center gap-0.5"><span class="text-muted-foreground">Body</span> <span class="font-semibold">{{ car.bodyType }}</span></span>
              <span v-if="car.city" class="flex items-center gap-0.5"><span class="text-muted-foreground">City</span> <span class="font-semibold">{{ car.city }}</span></span>
              <span v-if="car.registrationNumber" class="flex items-center gap-0.5"><span class="text-muted-foreground">Reg</span> <span class="font-semibold font-mono">{{ car.registrationNumber }}</span></span>
            </div>
          </div>
        </div>
        <div v-else class="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Icon name="i-lucide-heart" class="size-8 opacity-20" />
          <p class="text-xs">{{ wishlistSearch ? 'No matches' : 'Wishlist is empty' }}</p>
        </div>
      </div>
    </div>

    <!-- ═══════════ RIGHT COLUMN: My Bids ═══════════ -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border bg-card">
      <div class="shrink-0 border-b bg-muted/30">
        <div class="px-4 py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="i-lucide-gavel" class="size-4 text-amber-500" />
            <h3 class="text-sm font-bold">My Bids</h3>
          </div>
          <div class="flex items-center gap-1.5">
            <Badge variant="secondary" class="text-[10px] tabular-nums">{{ filteredGroupedBids.length }} cars</Badge>
            <Badge variant="outline" class="text-[10px] tabular-nums">{{ enrichedBids.length }} bids</Badge>
          </div>
        </div>
        <div v-if="groupedBids.length > 3" class="px-3 pb-2">
          <Input v-model="bidsSearch" placeholder="Search bids..." class="h-7 text-xs" />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <!-- Loading -->
        <div v-if="isLoadingBids" class="flex items-center justify-center py-12 text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-5 animate-spin mr-2" />
          <span class="text-xs">Loading bids...</span>
        </div>
        <!-- Grouped Bids -->
        <div v-else-if="filteredGroupedBids.length > 0" class="p-2 space-y-2">
          <div
            v-for="group in filteredGroupedBids"
            :key="group.key"
            class="rounded-lg border bg-background overflow-hidden"
          >
            <!-- Group Header: Image + Make Model Variant + Bids count (all inline) -->
            <div class="px-2.5 py-2 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-b flex items-center gap-2">
              <div class="size-10 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                <img v-if="getCarImage({ frontMainImage: group.image })" :src="getCarImage({ frontMainImage: group.image })!" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Icon name="i-lucide-car" class="size-4 text-muted-foreground/25" />
                </div>
              </div>
              <div class="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                <span v-if="group.make" class="text-xs font-bold">{{ group.make }}</span>
                <span v-if="group.model" class="text-xs font-semibold text-muted-foreground">{{ group.model }}</span>
                <span v-if="group.variant" class="text-[10px] text-muted-foreground/70 truncate">{{ group.variant }}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="group.appointmentId" class="text-[9px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{{ group.appointmentId }}</span>
                <Badge variant="secondary" class="text-[9px] tabular-nums">{{ group.bids.length }}</Badge>
              </div>
            </div>
            <!-- Individual Bids -->
            <div class="divide-y">
              <div
                v-for="bid in group.bids"
                :key="bid._id"
                class="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20 transition-colors"
              >
                <Badge variant="outline" class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-bold tabular-nums">
                  {{ formatCurrency(bid.bidAmount) }}
                </Badge>
                <span v-if="bid.time" class="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Icon name="i-lucide-clock" class="size-2.5" />
                  {{ formatBidTime(bid.time) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <!-- Empty -->
        <div v-else class="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Icon name="i-lucide-gavel" class="size-8 opacity-20" />
          <p class="text-xs">{{ bidsSearch ? 'No matches' : 'No bids yet' }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- KAM Change Dialog -->
  <Dialog v-model:open="showKamChangeDialog">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-user-check" class="size-4 text-orange-600" />
          {{ assignedKam ? 'Change' : 'Assign' }} KAM
        </DialogTitle>
        <DialogDescription class="text-xs">
          Select a Key Account Manager for <strong>{{ user.dealershipName || user.userName }}</strong>.
        </DialogDescription>
      </DialogHeader>
      <div class="py-4 space-y-3">
        <Label for="dealer-kam-select">Select KAM</Label>
        <Select v-model="selectedNewKamId">
          <SelectTrigger id="dealer-kam-select">
            <SelectValue placeholder="Choose a KAM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none_">None (Unassign)</SelectItem>
            <SelectItem v-for="kam in allKams" :key="kam._id || kam.id" :value="kam._id || kam.id">
              {{ kam.name }}
              <span v-if="kam.region" class="text-muted-foreground"> — {{ kam.region }}</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="showKamChangeDialog = false">
          Cancel
        </Button>
        <Button size="sm" :disabled="kamChangeSaving" @click="confirmKamChange">
          <Icon v-if="kamChangeSaving" name="i-lucide-loader-2" class="mr-1 size-3.5 animate-spin" />
          <Icon v-else name="i-lucide-check" class="mr-1 size-3.5" />
          {{ assignedKam ? 'Update' : 'Assign' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

