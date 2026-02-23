<script setup lang="ts">
import type { PeopleUser } from '~/composables/usePeopleApi'

const props = defineProps<{ user: PeopleUser }>()

const router = useRouter()

// ─── KAM lookup ───
const { allKams, fetchKams } = useKamsApi()
onMounted(() => fetchKams())

const assignedKam = computed(() => {
  const id = props.user.assignedKam
  if (!id)
    return null
  return allKams.value.find(k => k._id === id || k.id === id) || null
})

// ─── Tabs ───
type Tab = 'info' | 'kam' | 'auctions' | 'cars'
const activeTab = ref<Tab>('info')

const tabs: { id: Tab, label: string, icon: string }[] = [
  { id: 'info', label: 'Dealer Info', icon: 'i-lucide-building-2' },
  { id: 'kam', label: 'KAM Assigned', icon: 'i-lucide-user-check' },
  { id: 'auctions', label: 'Auctions', icon: 'i-lucide-gavel' },
  { id: 'cars', label: 'Cars', icon: 'i-lucide-car' },
]

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

const bids = computed(() => props.user?.myBids || [])
const purchasedCars = computed(() => props.user?.purchasedCars || [])
const wishlist = computed(() => props.user?.wishlist || [])
</script>

<template>
  <!-- Teleport header actions -->
  <ClientOnly>
    <Teleport to="#header-actions">
      <Button variant="ghost" size="sm" class="h-8" @click="router.push('/people/dealers')">
        <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
        Back
      </Button>
    </Teleport>
  </ClientOnly>

  <div class="w-full h-full overflow-auto">
    <div class="max-w-5xl mx-auto p-6 space-y-6">
      <!-- ─── Hero Card ─── -->
      <div class="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <!-- Gradient Banner -->
        <div class="h-32 relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-orange-400/10 to-rose-500/10">
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgba(251,146,60,0.2),transparent_60%)]" />
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(244,63,94,0.1),transparent_60%)]" />
          <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        </div>

        <!-- Avatar + Identity -->
        <div class="px-6 -mt-12 pb-5 relative z-10">
          <div class="flex flex-col sm:flex-row sm:items-end gap-4">
            <div class="size-20 rounded-2xl border-4 border-background bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg ring-2 ring-amber-500/20 shrink-0">
              <span class="text-2xl font-bold text-white">{{ getInitials(user.dealershipName || user.userName) }}</span>
            </div>
            <div class="pb-1 flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h2 class="text-xl font-bold truncate">
                  {{ user.dealershipName || user.userName || '—' }}
                </h2>
                <Badge variant="outline" class="text-xs" :class="statusBadge[user.approvalStatus] || 'bg-gray-500/10 text-gray-600 border-gray-500/20'">
                  {{ user.approvalStatus || 'Unknown' }}
                </Badge>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span v-if="user.userName" class="flex items-center gap-1.5">
                  <Icon name="i-lucide-user" class="size-3.5" />
                  {{ user.userName }}
                </span>
                <span v-if="user.email" class="flex items-center gap-1.5">
                  <Icon name="i-lucide-mail" class="size-3.5" />
                  {{ user.email }}
                </span>
                <span v-if="user.phoneNumber" class="flex items-center gap-1.5 font-mono">
                  <Icon name="i-lucide-phone" class="size-3.5" />
                  {{ user.phoneNumber }}
                </span>
              </div>
            </div>
            <!-- Stats pills -->
            <div class="flex items-center gap-2 shrink-0 pb-1">
              <div class="rounded-xl border bg-muted/40 px-3 py-1.5 text-center">
                <p class="text-xs text-muted-foreground">
                  Bids
                </p>
                <p class="text-lg font-bold tabular-nums leading-tight">
                  {{ bids.length }}
                </p>
              </div>
              <div class="rounded-xl border bg-muted/40 px-3 py-1.5 text-center">
                <p class="text-xs text-muted-foreground">
                  Cars
                </p>
                <p class="text-lg font-bold tabular-nums leading-tight">
                  {{ purchasedCars.length }}
                </p>
              </div>
              <div class="rounded-xl border bg-muted/40 px-3 py-1.5 text-center">
                <p class="text-xs text-muted-foreground">
                  Wishlist
                </p>
                <p class="text-lg font-bold tabular-nums leading-tight">
                  {{ wishlist.length }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Tab Bar ─── -->
      <div class="flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
          :class="activeTab === tab.id
            ? 'bg-background text-foreground shadow-sm border'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.icon" class="size-4 shrink-0" />
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </button>
      </div>

      <!-- ─── Tab Content ─── -->

      <!-- DEALER INFO -->
      <template v-if="activeTab === 'info'">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Primary Contact -->
          <div class="rounded-xl border bg-card p-5 space-y-3">
            <h3 class="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide text-[11px]">
              <Icon name="i-lucide-user" class="size-3.5" />
              Contact
            </h3>
            <div class="space-y-3">
              <div v-if="user.email" class="flex items-center gap-3">
                <div class="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-mail" class="size-4 text-blue-500" />
                </div>
                <div class="min-w-0">
                  <p class="text-[11px] text-muted-foreground">
                    Email
                  </p>
                  <p class="text-sm font-medium truncate">
                    {{ user.email }}
                  </p>
                </div>
              </div>
              <div v-if="user.phoneNumber" class="flex items-center gap-3">
                <div class="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-phone" class="size-4 text-emerald-500" />
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">
                    Phone
                  </p>
                  <p class="text-sm font-medium font-mono">
                    {{ user.phoneNumber }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Business Details -->
          <div class="rounded-xl border bg-card p-5 space-y-3">
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Icon name="i-lucide-briefcase" class="size-3.5" />
              Business
            </h3>
            <div class="space-y-3">
              <div v-if="user.entityType" class="flex items-center gap-3">
                <div class="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-tag" class="size-4 text-violet-500" />
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">
                    Entity Type
                  </p>
                  <p class="text-sm font-medium">
                    {{ user.entityType }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-calendar" class="size-4 text-amber-500" />
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">
                    Member Since
                  </p>
                  <p class="text-sm font-medium">
                    {{ formatDate(user.createdAt) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="size-8 rounded-lg bg-gray-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-refresh-cw" class="size-4 text-gray-500" />
                </div>
                <div>
                  <p class="text-[11px] text-muted-foreground">
                    Last Updated
                  </p>
                  <p class="text-sm font-medium">
                    {{ formatDateTime(user.updatedAt) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Primary & Secondary Contacts -->
          <div v-if="user.primaryContactPerson || user.secondaryContactPerson" class="md:col-span-2 rounded-xl border bg-card p-5 space-y-3">
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Icon name="i-lucide-contact" class="size-3.5" />
              Contact People
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div v-if="user.primaryContactPerson" class="rounded-lg border bg-muted/20 p-4 space-y-1">
                <div class="flex items-center gap-2 mb-2">
                  <div class="size-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Icon name="i-lucide-user" class="size-3.5 text-indigo-500" />
                  </div>
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primary</span>
                </div>
                <p class="text-sm font-semibold">
                  {{ user.primaryContactPerson }}
                </p>
                <p v-if="user.primaryContactNumber" class="text-xs text-muted-foreground font-mono">
                  {{ user.primaryContactNumber }}
                </p>
              </div>
              <div v-if="user.secondaryContactPerson" class="rounded-lg border bg-muted/20 p-4 space-y-1">
                <div class="flex items-center gap-2 mb-2">
                  <div class="size-7 rounded-full bg-pink-500/10 flex items-center justify-center">
                    <Icon name="i-lucide-user" class="size-3.5 text-pink-500" />
                  </div>
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Secondary</span>
                </div>
                <p class="text-sm font-semibold">
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
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Icon name="i-lucide-map-pin" class="size-3.5" />
              Locations
            </h3>
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="loc in locations"
                :key="loc"
                variant="outline"
                class="bg-rose-500/5 text-rose-600 border-rose-500/15 px-3 py-1 gap-1.5"
              >
                <Icon name="i-lucide-map-pin" class="size-3" />
                {{ loc }}
              </Badge>
            </div>
          </div>

          <!-- Addresses -->
          <div v-if="addresses.length > 0" class="rounded-xl border bg-card p-5 space-y-3">
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Icon name="i-lucide-home" class="size-3.5" />
              Addresses
            </h3>
            <div class="space-y-2">
              <div
                v-for="(addr, i) in addresses"
                :key="i"
                class="rounded-lg bg-muted/30 border px-3 py-2.5 text-sm flex items-start gap-2.5"
              >
                <Icon name="i-lucide-navigation" class="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>{{ addr }}</span>
              </div>
            </div>
          </div>

          <!-- ID Row -->
          <div class="md:col-span-2 rounded-xl border border-dashed bg-muted/20 px-4 py-3 flex items-center justify-between">
            <span class="text-xs text-muted-foreground">Dealer ID</span>
            <code class="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{{ user._id || user.id }}</code>
          </div>
        </div>
      </template>

      <!-- KAM ASSIGNED -->
      <template v-else-if="activeTab === 'kam'">
        <!-- Has KAM -->
        <div v-if="assignedKam" class="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div class="h-20 bg-gradient-to-r from-orange-500/15 via-amber-400/10 to-transparent relative">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(249,115,22,0.15),transparent_60%)]" />
          </div>
          <div class="px-6 -mt-8 pb-6 relative z-10">
            <div class="flex items-end gap-4">
              <div class="size-16 rounded-xl border-4 border-background bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-md shrink-0">
                <span class="text-xl font-bold text-white">
                  {{ (assignedKam.name || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) }}
                </span>
              </div>
              <div class="pb-1">
                <h3 class="text-lg font-bold">
                  {{ assignedKam.name }}
                </h3>
                <p class="text-sm text-muted-foreground">
                  Key Account Manager
                </p>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-px border-t bg-border">
            <div class="bg-card p-5 space-y-1">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </p>
              <p class="text-sm font-medium">
                {{ assignedKam.email || '—' }}
              </p>
            </div>
            <div class="bg-card p-5 space-y-1">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone
              </p>
              <p class="text-sm font-medium font-mono">
                {{ assignedKam.phoneNumber || '—' }}
              </p>
            </div>
            <div class="bg-card p-5 space-y-1">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Region
              </p>
              <Badge v-if="assignedKam.region" variant="outline" class="bg-blue-500/10 text-blue-600 border-blue-500/20 mt-0.5">
                {{ assignedKam.region }}
              </Badge>
              <p v-else class="text-sm text-muted-foreground">
                —
              </p>
            </div>
          </div>
        </div>

        <!-- assignedKam ref exists but not resolved yet (by ID string) -->
        <div v-else-if="user.assignedKam" class="rounded-2xl border bg-card p-8 text-center space-y-3">
          <div class="size-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <Icon name="i-lucide-user-check" class="size-6 text-amber-500" />
          </div>
          <p class="text-sm font-medium">
            KAM Assigned
          </p>
          <code class="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded-full">{{ user.assignedKam }}</code>
          <p class="text-xs text-muted-foreground">
            KAM record not found in the directory
          </p>
        </div>

        <!-- No KAM -->
        <div v-else class="rounded-2xl border bg-card p-12 flex flex-col items-center gap-4 text-muted-foreground">
          <div class="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Icon name="i-lucide-user-x" class="size-8" />
          </div>
          <div class="text-center">
            <p class="font-medium">
              No KAM Assigned
            </p>
            <p class="text-xs mt-1">
              This dealer doesn't have a Key Account Manager assigned yet.
            </p>
          </div>
        </div>
      </template>

      <!-- AUCTIONS -->
      <template v-else-if="activeTab === 'auctions'">
        <div v-if="bids.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">
              {{ bids.length }} bid{{ bids.length !== 1 ? 's' : '' }} found
            </p>
          </div>
          <div class="rounded-xl border bg-card overflow-hidden">
            <div
              v-for="(bid, i) in bids"
              :key="i"
              class="flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors group"
            >
              <div class="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-gavel" class="size-4 text-amber-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium font-mono truncate">
                  {{ bid }}
                </p>
                <p class="text-xs text-muted-foreground">
                  Auction ID
                </p>
              </div>
              <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
        <div v-else class="rounded-2xl border bg-card p-12 flex flex-col items-center gap-4 text-muted-foreground">
          <div class="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Icon name="i-lucide-gavel" class="size-8" />
          </div>
          <div class="text-center">
            <p class="font-medium">
              No Auctions Yet
            </p>
            <p class="text-xs mt-1">
              This dealer hasn't placed any bids.
            </p>
          </div>
        </div>
      </template>

      <!-- CARS -->
      <template v-else-if="activeTab === 'cars'">
        <div class="space-y-4">
          <!-- Purchased Cars -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <div class="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Icon name="i-lucide-circle-check" class="size-4 text-emerald-500" />
              </div>
              <h3 class="text-sm font-semibold">
                Purchased Cars
              </h3>
              <Badge variant="secondary" class="ml-auto">
                {{ purchasedCars.length }}
              </Badge>
            </div>
            <div v-if="purchasedCars.length > 0" class="rounded-xl border bg-card overflow-hidden">
              <div
                v-for="(car, i) in purchasedCars"
                :key="i"
                class="flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors group"
              >
                <div class="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-car" class="size-4 text-emerald-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium font-mono truncate">
                    {{ car }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Vehicle ID
                  </p>
                </div>
                <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div v-else class="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No purchased cars yet
            </div>
          </div>

          <!-- Wishlist -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <div class="size-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <Icon name="i-lucide-heart" class="size-4 text-rose-500" />
              </div>
              <h3 class="text-sm font-semibold">
                Wishlist
              </h3>
              <Badge variant="secondary" class="ml-auto">
                {{ wishlist.length }}
              </Badge>
            </div>
            <div v-if="wishlist.length > 0" class="rounded-xl border bg-card overflow-hidden">
              <div
                v-for="(item, i) in wishlist"
                :key="i"
                class="flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors group"
              >
                <div class="size-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-heart" class="size-4 text-rose-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium font-mono truncate">
                    {{ item }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Vehicle ID
                  </p>
                </div>
                <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div v-else class="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Wishlist is empty
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
