<script setup lang="ts">
import { toast } from 'vue-sonner'

const router = useRouter()
const userCookie = useCookie('userData')

const parsedCookie = computed(() => {
  try {
    return typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
  } catch {
    return null
  }
})

const userId = computed(() => parsedCookie.value?._id || parsedCookie.value?.id)

const { setHeader } = usePageHeader()

const {
  fetchAllUsers,
  updateUser,
  getUserById,
} = usePeopleApi()

// Ensure data is loaded
onMounted(async () => {
  await fetchAllUsers()
})

// Find the user from cache
const user = computed(() => getUserById(userId.value))

// Set header immediately from category — no waiting for user data
setHeader({ title: 'My Profile', description: 'Manage your personal account settings and credentials', icon: 'i-lucide-user' })

// ─── Change Password ───
const showPasswordDialog = ref(false)
const showPassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const isSaving = ref(false)

function openPasswordDialog() {
  newPassword.value = ''
  confirmPassword.value = ''
  showPasswordDialog.value = true
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let pass = ''
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  newPassword.value = pass
  confirmPassword.value = pass
}

async function savePassword() {
  if (!user.value) return
  if (!newPassword.value) {
    toast.error('Please enter a new password')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error('Passwords do not match')
    return
  }
  
  isSaving.value = true
  try {
    await updateUser(userId.value, { password: newPassword.value })
    toast.success('Password updated successfully')
    showPasswordDialog.value = false
    user.value.password = newPassword.value // Update local state reactively
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update password')
  }
  finally {
    isSaving.value = false
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

    <!-- Profile View -->
    <div v-else>
      <ClientOnly>
        <HeaderActions>
          <Button size="sm" class="h-8" @click="openPasswordDialog">
            <Icon name="i-lucide-key-round" class="mr-1.5 size-3.5" />
            Change Password
          </Button>
        </HeaderActions>
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
          
            <!-- Login Credentials Grid -->
            <div class="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4 mb-4">
              <h3 class="text-sm font-semibold flex items-center gap-2 text-primary">
                <Icon name="i-lucide-key-round" class="size-4" />
                Login Credentials
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="rounded-lg bg-background border border-primary/10 p-3 space-y-1 relative shadow-sm">
                  <span class="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Username</span>
                  <p class="text-sm font-medium">
                    {{ user.userName || '—' }}
                  </p>
                </div>
                <div class="rounded-lg bg-background border border-primary/10 p-3 space-y-1 relative shadow-sm">
                  <span class="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Phone Number</span>
                  <p class="text-sm font-medium font-mono">
                    {{ user.phoneNumber || '—' }}
                  </p>
                </div>
                <div class="rounded-lg bg-background border border-primary/10 p-3 space-y-1 relative shadow-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Password</span>
                    <button v-if="user.password" type="button" @click="showPassword = !showPassword" class="text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded">
                      <Icon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3.5" />
                    </button>
                  </div>
                  <p class="text-sm font-medium font-mono tracking-widest mt-0.5">
                    <template v-if="!user.password">
                      <span class="text-muted-foreground/50 text-xs italic tracking-normal">Password not set</span>
                    </template>
                    <template v-else-if="showPassword">
                      <span class="tracking-normal">{{ user.password }}</span>
                    </template>
                    <template v-else>
                      ••••••••
                    </template>
                  </p>
                </div>
              </div>
            </div>

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
        </div>
      </div>

      <!-- Password Change Dialog -->
      <Dialog v-model:open="showPasswordDialog">
        <DialogContent class="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your account password. Strong passwords include numbers, symbols, and mixed-case letters.
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="space-y-2">
              <Label>New Password</Label>
              <div class="relative">
                <Input v-model="newPassword" type="text" placeholder="Enter new password" class="font-mono text-sm" />
              </div>
            </div>
            <div class="space-y-2">
              <Label>Confirm Password</Label>
              <Input v-model="confirmPassword" type="text" placeholder="Confirm new password" class="font-mono text-sm" />
            </div>
            <Button type="button" variant="outline" class="w-full mt-2" @click="generatePassword">
              <Icon name="i-lucide-wand-2" class="mr-2 size-4 text-primary" />
              Suggest Strong Password
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="showPasswordDialog = false">
              Cancel
            </Button>
            <Button :disabled="isSaving || !newPassword || newPassword !== confirmPassword" @click="savePassword">
              <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div><!-- end scroll wrapper -->
  </div><!-- end v-else generic profile -->
</template>
