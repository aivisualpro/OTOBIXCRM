<script setup lang="ts">
import type { CrudColumn } from '~/composables/useCrud'
import { toast } from 'vue-sonner'

const props = defineProps<{
  title: string
  description: string
  icon: string
  entityName?: string
  columns: CrudColumn[]
  filterFn: (user: any) => boolean
  showStatusCounts?: boolean
  categoryKey?: string
}>()

const isOtobix = computed(() => props.categoryKey === 'otobix')

const _entity = computed(() => props.entityName || 'Person')

const { setHeader } = usePageHeader()
setHeader({ title: props.title, description: props.description, icon: props.icon })

// ─── Single cached data source for all tabs ───
const {
  allUsers,
  isLoading,
  isFetched,
  fetchError,
  fetchAllUsers,
  refreshUsers,
  createUser,
} = usePeopleApi()

onMounted(() => { fetchAllUsers() })

// ─── UI State ───
const search = ref('')

// All tabs filter from allUsers using their filterFn
const baseFilteredItems = computed(() => allUsers.value.filter(props.filterFn))

// ─── Approval status counts ───
const approvedCount = computed(() => baseFilteredItems.value.filter(u => u.approvalStatus === 'Approved').length)
const pendingCount = computed(() => baseFilteredItems.value.filter(u => u.approvalStatus === 'Pending').length)
const rejectedCount = computed(() => baseFilteredItems.value.filter(u => u.approvalStatus === 'Rejected').length)

// ─── Client-side filtering ───
const filteredItems = computed(() => {
  let result = baseFilteredItems.value

  // Apply search across visible columns
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(item =>
      props.columns.some(col =>
        String(item[col.key] ?? '').toLowerCase().includes(q),
      ),
    )
  }

  return result
})

// ─── Client-side infinite scroll (load more on scroll) ───
const BATCH_SIZE = 30
const visibleCount = ref(BATCH_SIZE)

watch(search, () => { visibleCount.value = BATCH_SIZE })

const totalFiltered = computed(() => filteredItems.value.length)
const hasMore = computed(() => visibleCount.value < totalFiltered.value)

const visibleItems = computed(() => {
  return filteredItems.value.slice(0, visibleCount.value)
})

function loadMore() {
  if (hasMore.value) {
    visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, totalFiltered.value)
  }
}

// IntersectionObserver for the scroll sentinel
const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    { rootMargin: '200px' },
  )
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

watch(scrollSentinel, (el) => {
  observer?.disconnect()
  if (el)
    observer?.observe(el)
})

// ─── Formatters ───
const badgeClasses: Record<string, string> = {
  'Approved': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Rejected': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Dealer': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Customer': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'Admin': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Super Admin': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  'Staff': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Inspection Engineer': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Retailer': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  'Sales Manager': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Telecaller': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  'QC': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Yes': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'No': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

function getBadgeClass(value: any): string {
  const str = formatBadgeValue(value)
  return badgeClasses[str] || 'bg-gray-500/10 text-gray-600 border-gray-500/20'
}

function formatBadgeValue(value: any): string {
  if (value === true)
    return 'Yes'
  if (value === false)
    return 'No'
  if (value === null || value === undefined || value === '')
    return '—'
  return String(value)
}

function toTagsArray(value: any): string[] {
  if (!value)
    return []
  if (Array.isArray(value))
    return value.filter(Boolean).map(String)
  return [String(value)]
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  catch { return value }
}

function getInitials(name: string): string {
  if (!name)
    return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

async function handleRefresh() {
  await refreshUsers()
  toast.success('Data refreshed from server')
}

// ─── Navigate to profile ───
const router = useRouter()

function openProfile(user: any) {
  const userId = user._id || user.id
  router.push(`/people/${props.categoryKey}/${userId}`)
}

// ─── Add User Dialog ───
const showAddDialog = ref(false)
const isSubmitting = ref(false)

function defaultForm() {
  return {
    userName: '',
    email: '',
    password: '',
    phoneNumber: '',
    userRole: 'Staff',
    location: [] as string[],
    approvalStatus: 'Approved',
    assignedKam: '',
    addressList: [''],
    isStaff: true,
  }
}

const form = ref(defaultForm())

function addAddress() {
  form.value.addressList.push('')
}

function removeAddress(index: number) {
  form.value.addressList.splice(index, 1)
}

function resetForm() {
  form.value = defaultForm()
}

async function handleCreateUser() {
  // Validate all required fields
  const f = form.value
  const filledAddresses = f.addressList.filter(a => a.trim())
  if (!f.userName.trim() || !f.email.trim() || !f.password.trim() || !f.phoneNumber.trim() || !f.userRole || f.location.length === 0 || filledAddresses.length === 0) {
    toast.error('Please fill all required fields (Name, Email, Password, Phone, Role, Location, Address)')
    return
  }

  isSubmitting.value = true
  try {
    // Filter out empty address strings
    const payload = {
      ...form.value,
      addressList: form.value.addressList.filter(a => a.trim()),
    }
    await createUser(payload)
    toast.success(`User "${form.value.userName}" created successfully`)
    showAddDialog.value = false
    resetForm()
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to create user')
  }
  finally {
    isSubmitting.value = false
  }
}

const roleOptions = ['Inspection Engineer', 'Retailer', 'Sales Manager', 'Telecaller', 'QC']
const statusOptions = ['Approved', 'Pending', 'Rejected']
const locationOptions = ['SILIGURI', 'BHUBANESWAR', 'PATNA', 'GAYA', 'DURGAPUR', 'KOLKATA', 'KRISHNANAGAR', 'CUTTACK', 'ASANSOL', 'RANCHI']

const locationPopoverOpen = ref(false)

function toggleLocation(loc: string) {
  const idx = form.value.location.indexOf(loc)
  if (idx >= 0)
    form.value.location.splice(idx, 1)
  else form.value.location.push(loc)
}

function removeLocation(loc: string) {
  form.value.location = form.value.location.filter(l => l !== loc)
}

const allLocationsSelected = computed(() => form.value.location.length === locationOptions.length)

function toggleSelectAllLocations() {
  if (allLocationsSelected.value) {
    form.value.location = []
  }
  else {
    form.value.location = [...locationOptions]
  }
}
</script>

<template>
  <!-- Teleport toolbar into the main header -->
  <ClientOnly>
    <Teleport to="#header-actions">
      <div v-if="showStatusCounts && isFetched" class="hidden sm:flex items-center gap-1.5">
        <Badge variant="outline" class="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs tabular-nums gap-1">
          <Icon name="i-lucide-check-circle" class="size-3" />
          {{ approvedCount }} Approved
        </Badge>
        <Badge variant="outline" class="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs tabular-nums gap-1">
          <Icon name="i-lucide-clock" class="size-3" />
          {{ pendingCount }} Pending
        </Badge>
        <Badge variant="outline" class="bg-red-500/10 text-red-600 border-red-500/20 text-xs tabular-nums gap-1">
          <Icon name="i-lucide-x-circle" class="size-3" />
          {{ rejectedCount }} Rejected
        </Badge>
      </div>
      <Separator v-if="showStatusCounts && isFetched" orientation="vertical" class="h-5 hidden sm:block" />
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="Search people..." class="pl-8 h-8 w-48 text-sm" />
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} record{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
      <Button v-if="isOtobix" size="sm" class="h-8" @click="showAddDialog = true">
        <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
        Add User
      </Button>
    </Teleport>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <!-- Error Banner -->
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">
          Failed to load users
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ fetchError }}
        </p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">
          Loading users...
        </p>
      </div>
    </div>

    <!-- Table (scrollable) -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
          <TableRow>
            <TableHead v-for="col in columns" :key="col.key">
              {{ col.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in visibleItems"
            :key="item.id || item._id"
            class="group cursor-pointer hover:bg-muted/40 transition-colors"
            @click="openProfile(item)"
          >
            <TableCell v-for="col in columns" :key="col.key">
              <!-- Avatar -->
              <div v-if="col.type === 'avatar'" class="flex items-center gap-3">
                <Avatar class="size-8 border">
                  <AvatarImage :src="item.image" :alt="item[col.key]" />
                  <AvatarFallback class="text-xs">
                    {{ getInitials(item[col.key]) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-medium">{{ item[col.key] || '—' }}</span>
              </div>
              <!-- Badge -->
              <Badge v-else-if="col.type === 'badge'" variant="outline" :class="getBadgeClass(item[col.key])">
                {{ formatBadgeValue(item[col.key]) }}
              </Badge>
              <!-- Date -->
              <span v-else-if="col.type === 'date'" class="text-muted-foreground text-sm">
                {{ formatDate(item[col.key]) }}
              </span>
              <!-- Tags -->
              <div v-else-if="col.type === 'tags'" class="flex flex-wrap gap-1">
                <template v-if="toTagsArray(item[col.key]).length > 0">
                  <Badge v-for="tag in toTagsArray(item[col.key])" :key="tag" variant="secondary" class="text-xs font-normal">
                    {{ tag }}
                  </Badge>
                </template>
                <span v-else class="text-sm text-muted-foreground">—</span>
              </div>
              <!-- Default text -->
              <span v-else class="text-sm">{{ item[col.key] ?? '—' }}</span>
            </TableCell>
          </TableRow>
          <TableRow v-if="visibleItems.length === 0 && !isLoading">
            <TableCell :colspan="columns.length" class="h-32 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon name="i-lucide-inbox" class="size-8" />
                <p>No records found</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Scroll Sentinel for infinite loading -->
      <div v-if="hasMore" ref="scrollSentinel" class="flex items-center justify-center py-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
          Loading more...
        </div>
      </div>
    </div>

    <!-- Footer info bar -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ visibleItems.length }} of {{ totalFiltered }} records
      </p>
    </div>
  </div>

  <!-- Add User Dialog -->
  <Sheet v-model:open="showAddDialog">
    <SheetContent class="sm:max-w-lg overflow-y-auto p-6">
      <SheetHeader>
        <SheetTitle>Add New User</SheetTitle>
        <SheetDescription>Create a new Otobix staff user account.</SheetDescription>
      </SheetHeader>

      <div class="mt-6 space-y-4">
        <!-- Name -->
        <div class="space-y-1.5">
          <Label for="add-user-name">Full Name <span class="text-destructive">*</span></Label>
          <Input id="add-user-name" v-model="form.userName" placeholder="John Doe" />
        </div>

        <!-- Email -->
        <div class="space-y-1.5">
          <Label for="add-user-email">Email <span class="text-destructive">*</span></Label>
          <Input id="add-user-email" v-model="form.email" type="email" placeholder="john@otobix.com" />
        </div>

        <!-- Password -->
        <div class="space-y-1.5">
          <Label for="add-user-password">Password <span class="text-destructive">*</span></Label>
          <Input id="add-user-password" v-model="form.password" type="password" placeholder="Minimum 6 characters" />
        </div>

        <!-- Phone -->
        <div class="space-y-1.5">
          <Label for="add-user-phone">Phone Number <span class="text-destructive">*</span></Label>
          <Input id="add-user-phone" v-model="form.phoneNumber" placeholder="+91 9876543210" />
        </div>

        <!-- Role + Status row -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label for="add-user-role">Role <span class="text-destructive">*</span></Label>
            <Select v-model="form.userRole">
              <SelectTrigger id="add-user-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="r in roleOptions" :key="r" :value="r">
                  {{ r }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label for="add-user-status">Approval Status</Label>
            <Select v-model="form.approvalStatus">
              <SelectTrigger id="add-user-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in statusOptions" :key="s" :value="s">
                  {{ s }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Location (multi-select) -->
        <div class="space-y-1.5">
          <Label>Location <span class="text-destructive">*</span></Label>
          <Popover v-model:open="locationPopoverOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" role="combobox" class="w-full justify-between h-auto min-h-9 font-normal">
                <span v-if="form.location.length === 0" class="text-muted-foreground">Select locations...</span>
                <div v-else class="flex flex-wrap gap-1">
                  <Badge v-for="loc in form.location" :key="loc" variant="secondary" class="text-xs gap-1">
                    {{ loc }}
                    <Icon name="i-lucide-x" class="size-3 cursor-pointer hover:text-destructive" @click.stop="removeLocation(loc)" />
                  </Badge>
                </div>
                <Icon name="i-lucide-chevrons-up-down" class="ml-2 size-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[--reka-popover-trigger-width] p-0" align="start">
              <div class="max-h-56 overflow-y-auto p-1">
                <!-- Select All -->
                <button
                  class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover:bg-accent cursor-pointer border-b mb-1 pb-1.5"
                  @click="toggleSelectAllLocations()"
                >
                  <Checkbox :checked="allLocationsSelected" class="pointer-events-none" />
                  Select All
                  <span class="ml-auto text-xs text-muted-foreground">{{ form.location.length }}/{{ locationOptions.length }}</span>
                </button>
                <!-- Individual locations -->
                <button
                  v-for="loc in locationOptions"
                  :key="loc"
                  class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors"
                  :class="form.location.includes(loc) ? 'bg-primary/5 text-primary hover:bg-primary/10' : 'hover:bg-accent'"
                  @click="toggleLocation(loc)"
                >
                  <Checkbox :checked="form.location.includes(loc)" class="pointer-events-none" />
                  {{ loc }}
                  <Icon v-if="form.location.includes(loc)" name="i-lucide-check" class="ml-auto size-3.5 text-primary" />
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <!-- Assigned KAM -->
        <div class="space-y-1.5">
          <Label for="add-user-kam">Assigned KAM</Label>
          <Input id="add-user-kam" v-model="form.assignedKam" placeholder="KAM name or ID" />
        </div>

        <!-- Addresses -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label>Addresses <span class="text-destructive">*</span></Label>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="addAddress">
              <Icon name="i-lucide-plus" class="mr-1 size-3" />
              Add
            </Button>
          </div>
          <div v-for="(_, idx) in form.addressList" :key="idx" class="flex items-center gap-2">
            <Input v-model="form.addressList[idx]" :placeholder="`Address ${idx + 1}`" class="flex-1" />
            <Button v-if="form.addressList.length > 1" variant="ghost" size="icon" class="size-8 shrink-0 text-muted-foreground hover:text-destructive" @click="removeAddress(idx)">
              <Icon name="i-lucide-x" class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Is Staff toggle (auto-on & locked for Otobix) -->
        <div class="flex items-center justify-between rounded-lg border p-3" :class="{ 'opacity-60': isOtobix }">
          <div>
            <Label for="add-user-staff">Staff Member</Label>
            <p class="text-xs text-muted-foreground">
              {{ isOtobix ? 'Always enabled for Otobix staff' : 'Mark this user as Otobix staff' }}
            </p>
          </div>
          <Switch id="add-user-staff" :checked="form.isStaff" :disabled="isOtobix" @update:checked="form.isStaff = $event" />
        </div>
      </div>

      <SheetFooter class="mt-6 pt-4 border-t">
        <Button variant="outline" @click="showAddDialog = false">
          Cancel
        </Button>
        <Button :disabled="isSubmitting" @click="handleCreateUser">
          <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else name="i-lucide-user-plus" class="mr-1.5 size-3.5" />
          Create User
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
