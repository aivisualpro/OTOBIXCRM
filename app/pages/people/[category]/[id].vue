<script setup lang="ts">
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()
const categoryKey = computed(() => route.params.category as string)
const userId = computed(() => route.params.id as string)
const isDealer = computed(() => categoryKey.value === 'dealers')

const { setHeader } = usePageHeader()

const {
  fetchAllUsers,
  updateUser,
  deleteUser,
  getUserById,
} = usePeopleApi()

// Ensure data is loaded
onMounted(async () => {
  await fetchAllUsers()
})

// Find the user from cache
const user = computed(() => getUserById(userId.value))

// Map category → human-readable detail title & icon
const CATEGORY_META: Record<string, { title: string, icon: string }> = {
  otobix: { title: 'User Details', icon: 'i-lucide-shield-check' },
  dealers: { title: 'Dealer Details', icon: 'i-lucide-store' },
  customers: { title: 'Customer Details', icon: 'i-lucide-user-round' },
  kams: { title: 'KAM Details', icon: 'i-lucide-briefcase' },
}

// Set header immediately from category — no waiting for user data
const meta = computed(() => CATEGORY_META[categoryKey.value] || { title: 'Profile', icon: 'i-lucide-user' })
setHeader({ title: meta.value.title, description: '', icon: meta.value.icon })
watch(categoryKey, () => setHeader({ title: meta.value.title, description: '', icon: meta.value.icon }))

// ─── Edit Mode ───
const isEditing = ref(false)
const isSaving = ref(false)

const roleOptions = ['Inspection Engineer', 'Retailer', 'Sales Manager', 'Telecaller', 'QC']
const statusOptions = ['Approved', 'Pending', 'Rejected']

const editForm = ref<Record<string, any>>({})

function startEdit() {
  if (!user.value)
    return
  editForm.value = {
    userName: user.value.userName || '',
    email: user.value.email || '',
    phoneNumber: user.value.phoneNumber || '',
    userRole: user.value.userRole || '',
    location: user.value.location || '',
    dealershipName: user.value.dealershipName || '',
    entityType: user.value.entityType || '',
    primaryContactPerson: user.value.primaryContactPerson || '',
    primaryContactNumber: user.value.primaryContactNumber || '',
    secondaryContactPerson: user.value.secondaryContactPerson || '',
    secondaryContactNumber: user.value.secondaryContactNumber || '',
    approvalStatus: user.value.approvalStatus || '',
    assignedKam: user.value.assignedKam || '',
    isStaff: user.value.isStaff || false,
    addressList: [...(user.value.addressList || [])],
  }
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editForm.value = {}
}

async function saveEdit() {
  if (!user.value)
    return
  isSaving.value = true
  try {
    await updateUser(userId.value, editForm.value)
    toast.success('Profile updated successfully')
    isEditing.value = false
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update profile')
  }
  finally {
    isSaving.value = false
  }
}

function addAddress() {
  editForm.value.addressList.push('')
}

function removeAddress(index: number) {
  editForm.value.addressList.splice(index, 1)
}

// ─── Delete ───
const showDeleteDialog = ref(false)
const isDeleting = ref(false)

async function handleDelete() {
  if (!user.value)
    return
  isDeleting.value = true
  try {
    await deleteUser(userId.value)
    toast.success(`User "${user.value.userName}" deleted successfully`)
    showDeleteDialog.value = false
    router.push(`/people/${categoryKey.value}`)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to delete user')
  }
  finally {
    isDeleting.value = false
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
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  catch { return value }
}

function formatDateTime(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  catch { return value }
}

const statusBadge: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const roleBadge: Record<string, string> = {
  'Admin': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Staff': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Super Admin': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  'KAM': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Inspector': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Operations': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  'Dealer': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Customer': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
}

const locations = computed(() => {
  const loc = user.value?.location
  if (!loc)
    return []
  if (Array.isArray(loc))
    return loc
  return loc.split(',').map((l: string) => l.trim()).filter(Boolean)
})

const addresses = computed(() => {
  const addr = user.value?.addressList
  if (!addr || (Array.isArray(addr) && addr.length === 0))
    return []
  return Array.isArray(addr) ? addr.filter((a: string) => a?.trim()) : [addr]
})
</script>

<template>
  <div>
    <!-- Loading state (shared) -->
    <div v-if="!user" class="flex items-center justify-center h-64 text-muted-foreground">
      <div class="flex flex-col items-center gap-3">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">
          Loading...
        </p>
      </div>
    </div>

    <!-- Dealer detail view -->
    <PeopleDealerDetailPage v-else-if="isDealer" :user="user" />

    <!-- Generic profile view -->
    <div v-else>
      <ClientOnly>
        <Teleport to="#header-actions">
          <Button variant="ghost" size="sm" class="h-8" @click="router.push(`/people/${categoryKey}`)">
            <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
            Back
          </Button>
          <Separator orientation="vertical" class="h-5" />
          <template v-if="!isEditing">
            <Button size="sm" class="h-8" @click="startEdit">
              <Icon name="i-lucide-pencil" class="mr-1.5 size-3.5" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" class="h-8" @click="showDeleteDialog = true">
              <Icon name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
              Delete
            </Button>
          </template>
          <template v-else>
            <Button variant="outline" size="sm" class="h-8" @click="cancelEdit">
              Cancel
            </Button>
            <Button size="sm" class="h-8" :disabled="isSaving" @click="saveEdit">
              <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
              <Icon v-else name="i-lucide-check" class="mr-1.5 size-3.5" />
              Save Changes
            </Button>
          </template>
        </Teleport>
      </ClientOnly>

      <div class="w-full h-full overflow-auto">
        <!-- Profile Content -->
        <div class="max-w-4xl mx-auto p-6 space-y-6">
          <!-- Hero Card -->
          <div class="rounded-2xl border bg-card overflow-hidden">
            <!-- Gradient Banner -->
            <div class="h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/10 relative overflow-hidden">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.15),transparent_50%)]" />
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
            </div>

            <!-- Avatar + Name -->
            <div class="px-6 -mt-10 pb-6 relative z-10">
              <div class="flex items-end gap-5">
                <Avatar class="size-20 border-4 border-background shadow-lg ring-2 ring-primary/10">
                  <AvatarImage :src="user.image" :alt="user.userName" />
                  <AvatarFallback class="text-xl font-semibold bg-primary/10 text-primary">
                    {{ getInitials(user.userName) }}
                  </AvatarFallback>
                </Avatar>
                <div class="pb-1 flex-1 min-w-0">
                  <h2 class="text-xl font-bold truncate">
                    {{ user.userName || '—' }}
                  </h2>
                  <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" class="text-xs" :class="statusBadge[user.approvalStatus] || ''">
                      {{ user.approvalStatus || 'Unknown' }}
                    </Badge>
                    <Badge variant="outline" class="text-xs" :class="roleBadge[user.userRole] || ''">
                      {{ user.userRole || 'No Role' }}
                    </Badge>
                    <Badge
                      v-if="user.isStaff"
                      variant="outline"
                      class="text-xs bg-primary/10 text-primary border-primary/20"
                    >
                      <Icon name="i-lucide-sparkles" class="size-3 mr-1" />
                      Staff
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- VIEW MODE -->
          <template v-if="!isEditing">
            <!-- Contact Info Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-xl border bg-card p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="rounded-lg p-2 bg-blue-500/10">
                    <Icon name="i-lucide-mail" class="size-4 text-blue-500" />
                  </div>
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</span>
                </div>
                <p class="text-sm font-medium pl-10">
                  {{ user.email || '—' }}
                </p>
              </div>

              <div class="rounded-xl border bg-card p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="rounded-lg p-2 bg-emerald-500/10">
                    <Icon name="i-lucide-phone" class="size-4 text-emerald-500" />
                  </div>
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</span>
                </div>
                <p class="text-sm font-medium pl-10 font-mono">
                  {{ user.phoneNumber || '—' }}
                </p>
              </div>

              <div v-if="user.dealershipName" class="rounded-xl border bg-card p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="rounded-lg p-2 bg-amber-500/10">
                    <Icon name="i-lucide-building-2" class="size-4 text-amber-500" />
                  </div>
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dealership</span>
                </div>
                <p class="text-sm font-medium pl-10">
                  {{ user.dealershipName }}
                </p>
              </div>

              <div v-if="user.assignedKam" class="rounded-xl border bg-card p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="rounded-lg p-2 bg-orange-500/10">
                    <Icon name="i-lucide-user-check" class="size-4 text-orange-500" />
                  </div>
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned KAM</span>
                </div>
                <p class="text-sm font-medium pl-10">
                  {{ user.assignedKam }}
                </p>
              </div>

              <div v-if="user.entityType" class="rounded-xl border bg-card p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="rounded-lg p-2 bg-pink-500/10">
                    <Icon name="i-lucide-tag" class="size-4 text-pink-500" />
                  </div>
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entity Type</span>
                </div>
                <p class="text-sm font-medium pl-10">
                  {{ user.entityType }}
                </p>
              </div>
            </div>

            <!-- Primary & Secondary Contact -->
            <div v-if="user.primaryContactPerson || user.secondaryContactPerson" class="rounded-xl border bg-card p-5 space-y-4">
              <h3 class="text-sm font-semibold flex items-center gap-2">
                <Icon name="i-lucide-contact" class="size-4 text-indigo-500" />
                Contact People
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-if="user.primaryContactPerson" class="rounded-lg bg-muted/30 border p-3 space-y-1">
                  <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Primary</span>
                  <p class="text-sm font-medium">
                    {{ user.primaryContactPerson }}
                  </p>
                  <p v-if="user.primaryContactNumber" class="text-xs text-muted-foreground font-mono">
                    {{ user.primaryContactNumber }}
                  </p>
                </div>
                <div v-if="user.secondaryContactPerson" class="rounded-lg bg-muted/30 border p-3 space-y-1">
                  <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Secondary</span>
                  <p class="text-sm font-medium">
                    {{ user.secondaryContactPerson }}
                  </p>
                  <p v-if="user.secondaryContactNumber" class="text-xs text-muted-foreground font-mono">
                    {{ user.secondaryContactNumber }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Locations -->
            <div v-if="locations.length > 0" class="rounded-xl border bg-card p-5 space-y-3">
              <h3 class="text-sm font-semibold flex items-center gap-2">
                <Icon name="i-lucide-map-pin" class="size-4 text-rose-500" />
                Locations
              </h3>
              <div class="flex flex-wrap gap-2">
                <Badge
                  v-for="loc in locations"
                  :key="loc"
                  variant="outline"
                  class="bg-rose-500/5 text-rose-600 border-rose-500/15 text-xs px-3 py-1"
                >
                  <Icon name="i-lucide-map-pin" class="size-3 mr-1.5" />
                  {{ loc }}
                </Badge>
              </div>
            </div>

            <!-- Addresses -->
            <div v-if="addresses.length > 0" class="rounded-xl border bg-card p-5 space-y-3">
              <h3 class="text-sm font-semibold flex items-center gap-2">
                <Icon name="i-lucide-home" class="size-4 text-sky-500" />
                Addresses
              </h3>
              <div class="space-y-2">
                <div
                  v-for="(addr, i) in addresses"
                  :key="i"
                  class="rounded-lg border bg-muted/20 px-4 py-3 text-sm flex items-start gap-3"
                >
                  <Icon name="i-lucide-navigation" class="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{{ addr }}</span>
                </div>
              </div>
            </div>

            <!-- Metadata -->
            <div class="rounded-xl border bg-card p-5 space-y-3">
              <h3 class="text-sm font-semibold flex items-center gap-2">
                <Icon name="i-lucide-clock" class="size-4 text-gray-500" />
                Activity
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">Joined</span>
                  <span class="font-medium">{{ formatDate(user.createdAt) }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">Last updated</span>
                  <span class="font-medium">{{ formatDateTime(user.updatedAt) }}</span>
                </div>
              </div>
              <!-- User ID -->
              <div class="rounded-lg bg-muted/40 border border-dashed px-3 py-2 flex items-center justify-between mt-3">
                <span class="text-xs text-muted-foreground">User ID</span>
                <code class="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                  {{ user._id || user.id || '—' }}
                </code>
              </div>
            </div>
          </template>

          <!-- EDIT MODE -->
          <template v-else>
            <div class="rounded-xl border bg-card p-6 space-y-5">
              <h3 class="text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="i-lucide-pencil" class="size-4 text-primary" />
                Edit Profile
              </h3>

              <!-- Name & Email row -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label for="edit-name">Full Name</Label>
                  <Input id="edit-name" v-model="editForm.userName" placeholder="John Doe" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-email">Email</Label>
                  <Input id="edit-email" v-model="editForm.email" type="email" placeholder="john@otobix.com" />
                </div>
              </div>

              <!-- Phone & Role -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label for="edit-phone">Phone Number</Label>
                  <Input id="edit-phone" v-model="editForm.phoneNumber" placeholder="+91 9876543210" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-role">Role</Label>
                  <Select v-model="editForm.userRole">
                    <SelectTrigger id="edit-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="r in roleOptions" :key="r" :value="r">
                        {{ r }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <!-- Status & Location -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label for="edit-status">Approval Status</Label>
                  <Select v-model="editForm.approvalStatus">
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="s in statusOptions" :key="s" :value="s">
                        {{ s }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-location">Location</Label>
                  <Input id="edit-location" v-model="editForm.location" placeholder="KOLKATA, SILIGURI" />
                </div>
              </div>

              <!-- Dealership & Entity Type -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label for="edit-dealership">Dealership Name</Label>
                  <Input id="edit-dealership" v-model="editForm.dealershipName" placeholder="Dealership name" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-entity">Entity Type</Label>
                  <Input id="edit-entity" v-model="editForm.entityType" placeholder="Entity type" />
                </div>
              </div>

              <!-- Assigned KAM -->
              <div class="space-y-1.5">
                <Label for="edit-kam">Assigned KAM</Label>
                <Input id="edit-kam" v-model="editForm.assignedKam" placeholder="KAM name or ID" />
              </div>

              <!-- Contact People -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label for="edit-primary-person">Primary Contact Person</Label>
                  <Input id="edit-primary-person" v-model="editForm.primaryContactPerson" placeholder="Contact name" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-primary-number">Primary Contact Number</Label>
                  <Input id="edit-primary-number" v-model="editForm.primaryContactNumber" placeholder="Contact number" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-secondary-person">Secondary Contact Person</Label>
                  <Input id="edit-secondary-person" v-model="editForm.secondaryContactPerson" placeholder="Contact name" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-secondary-number">Secondary Contact Number</Label>
                  <Input id="edit-secondary-number" v-model="editForm.secondaryContactNumber" placeholder="Contact number" />
                </div>
              </div>

              <!-- Staff Member Toggle -->
              <div class="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label for="edit-staff">Staff Member</Label>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Mark this user as Otobix staff (isStaff=true)
                  </p>
                </div>
                <Switch id="edit-staff" :checked="editForm.isStaff" @update:checked="editForm.isStaff = $event" />
              </div>

              <!-- Addresses -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label>Addresses</Label>
                  <Button variant="ghost" size="sm" class="h-7 text-xs" @click="addAddress">
                    <Icon name="i-lucide-plus" class="mr-1 size-3" />
                    Add
                  </Button>
                </div>
                <div v-for="(_, idx) in (editForm.addressList as string[])" :key="idx" class="flex items-center gap-2">
                  <Input v-model="editForm.addressList[idx]" :placeholder="`Address ${Number(idx) + 1}`" class="flex-1" />
                  <Button
                    v-if="editForm.addressList.length > 1"
                    variant="ghost"
                    size="icon"
                    class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    @click="removeAddress(Number(idx))"
                  >
                    <Icon name="i-lucide-x" class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Delete Confirmation Dialog -->
      <AlertDialog v-model:open="showDeleteDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{{ user?.userName }}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showDeleteDialog = false">
              Cancel
            </AlertDialogCancel>
            <Button variant="destructive" :disabled="isDeleting" @click="handleDelete">
              <Icon v-if="isDeleting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
              <Icon v-else name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div><!-- end scroll wrapper -->
  </div><!-- end v-else generic profile -->
</template>
