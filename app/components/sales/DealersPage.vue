<script setup lang="ts">
import { toast } from 'vue-sonner'
import { dealerColumns } from '~/constants/people'

const { setHeader } = usePageHeader()
setHeader({ title: 'Sales / Dealers', description: '', icon: 'i-lucide-store' })

const router = useRouter()
const { allUsers, isLoading, isFetched, fetchAllUsers } = usePeopleApi()
const { allKams, fetchKams } = useKamsApi()

// Fetch dealer IDs that have bids
const bidDealerIds = ref<string[]>([])
const isLoadingBidDealers = ref(false)

async function fetchBidDealerIds() {
  isLoadingBidDealers.value = true
  try {
    const res = await $fetch<any>('/api/sales/dealer-ids')
    if (res.success) {
      bidDealerIds.value = res.userIds || []
    }
  } catch (err) {
    console.error('Failed to fetch bid dealer IDs:', err)
  } finally {
    isLoadingBidDealers.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchAllUsers(), fetchKams(), fetchBidDealerIds()])
})

// Filter: only dealers with at least one bid
const filteredDealers = computed(() => {
  if (!bidDealerIds.value.length) return []
  const bidSet = new Set(bidDealerIds.value)
  return allUsers.value
    .filter(u => u.userRole === 'Dealer')
    .filter(u => bidSet.has(u._id) || bidSet.has(u.id))
    .map(u => ({
      ...u,
      wishlistCount: u.wishlist?.length || 0,
      myBidsCount: u.myBids?.length || 0,
    }))
})

// Search
const searchQuery = ref('')
const searchedDealers = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return filteredDealers.value
  return filteredDealers.value.filter(d => {
    const text = [d.userName, d.dealershipName, d.email, d.phoneNumber, d.entityType, d.primaryContactPerson]
      .filter(Boolean).join(' ').toLowerCase()
    return text.includes(q)
  })
})

// Resolve KAM name
function resolveKamName(kamId: string): string {
  if (!kamId) return '—'
  const kam = allKams.value.find(k => k._id === kamId || k.id === kamId)
  return kam?.name || kamId
}

// Columns (same as people/dealer but without inline KAM edit)
const columns = dealerColumns

function navigateToDealer(dealer: any) {
  const id = dealer._id || dealer.id
  router.push(`/sales/dealers/${id}`)
}

function formatDate(val: string): string {
  if (!val) return '—'
  try {
    return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return val }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header actions -->
    <ClientOnly>
      <HeaderActions>
        <div class="relative">
          <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search dealers..." class="pl-8 h-8 w-48 text-sm" />
        </div>
        <Badge variant="secondary" class="text-xs tabular-nums">
          {{ searchedDealers.length }} dealers with bids
        </Badge>
      </HeaderActions>
    </ClientOnly>

    <!-- Loading -->
    <div v-if="isLoading || isLoadingBidDealers" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">Loading dealers...</p>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="flex-1 overflow-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
          <tr>
            <th class="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</th>
            <th v-for="col in columns" :key="col.key" class="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="dealer in searchedDealers"
            :key="dealer._id || dealer.id"
            class="border-b hover:bg-muted/30 transition-colors cursor-pointer"
            @click="navigateToDealer(dealer)"
          >
            <!-- Image -->
            <td class="py-2 px-3">
              <Avatar class="size-8">
                <AvatarImage :src="dealer.image" :alt="dealer.userName" />
                <AvatarFallback class="text-xs bg-primary/10 text-primary">
                  {{ (dealer.userName || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) }}
                </AvatarFallback>
              </Avatar>
            </td>
            <!-- Columns -->
            <td v-for="col in columns" :key="col.key" class="py-2 px-3">
              <!-- Name -->
              <template v-if="col.key === 'userName'">
                <span class="font-medium text-xs uppercase">{{ dealer.userName || '—' }}</span>
              </template>
              <!-- Assigned KAM (read-only, show name) -->
              <template v-else-if="col.key === 'assignedKam'">
                <span class="text-xs">{{ resolveKamName(dealer.assignedKam) }}</span>
              </template>
              <!-- Status badge -->
              <template v-else-if="col.key === 'approvalStatus'">
                <Badge
                  variant="outline"
                  class="text-[10px]"
                  :class="{
                    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20': dealer.approvalStatus === 'Approved',
                    'bg-amber-500/10 text-amber-600 border-amber-500/20': dealer.approvalStatus === 'Pending',
                    'bg-red-500/10 text-red-600 border-red-500/20': dealer.approvalStatus === 'Rejected',
                  }"
                >
                  {{ dealer.approvalStatus || '—' }}
                </Badge>
              </template>
              <!-- Date -->
              <template v-else-if="col.type === 'date'">
                <span class="text-xs text-muted-foreground tabular-nums">{{ formatDate((dealer as any)[col.key]) }}</span>
              </template>
              <!-- Wishlist/Bids counts -->
              <template v-else-if="col.key === 'wishlistCount' || col.key === 'myBidsCount'">
                <Badge variant="secondary" class="text-[10px] tabular-nums">{{ (dealer as any)[col.key] }}</Badge>
              </template>
              <!-- Default -->
              <template v-else>
                <span class="text-xs">{{ (dealer as any)[col.key] || '—' }}</span>
              </template>
            </td>
          </tr>
          <!-- Empty state -->
          <tr v-if="searchedDealers.length === 0">
            <td :colspan="columns.length + 1" class="py-16 text-center text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Icon name="i-lucide-store" class="size-8 opacity-20" />
                <p class="text-sm">{{ searchQuery ? 'No matching dealers' : 'No dealers with bids found' }}</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
