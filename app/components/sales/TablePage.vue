<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  title: string
  description: string
  icon: string
}>()

const { setHeader } = usePageHeader()
setHeader({ title: props.title, description: props.description, icon: props.icon })

const { allCars, isLoading, isFetched, fetchError, fetchAllCars, refreshCars } = useAuctionsApi()

onMounted(() => {
  fetchAllCars()
})

const search = ref('')

// Filter: only show if approvalStatus="Approved"
const baseFilteredItems = computed(() => {
  return allCars.value.filter(car => 
    car.approvalStatus === 'Approved'
  )
})

const filteredItems = computed(() => {
  let result = baseFilteredItems.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(item =>
      ['make', 'model', 'variant', 'registrationNumber', 'appointmentId'].some(key =>
        String(item[key] ?? '').toLowerCase().includes(q),
      ),
    )
  }
  return result
})

const PER_PAGE = 30
const currentPage = ref(1)
watch(search, () => { currentPage.value = 1 })

const totalFiltered = computed(() => filteredItems.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltered.value / PER_PAGE)))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * PER_PAGE
  return filteredItems.value.slice(start, start + PER_PAGE)
})

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page
}

const showingFrom = computed(() => totalFiltered.value === 0 ? 0 : ((currentPage.value - 1) * PER_PAGE) + 1)
const showingTo = computed(() => Math.min(currentPage.value * PER_PAGE, totalFiltered.value))

function formatCurrency(value: any): string {
  if (!value || isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function formatDate(value: string): string {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return value }
}

async function handleRefresh() {
  await refreshCars()
  toast.success('Sales data refreshed')
}

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | string)[] = [1]
  if (current > 3)
    pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2)
    pages.push('...')
  pages.push(total)
  return pages
})
</script>

<template>
  <ClientOnly>
    <HeaderActions>
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="Search sales..." class="pl-8 h-8 w-48 text-sm" />
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} record{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
    </HeaderActions>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">Failed to load sales data</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ fetchError }}</p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">Retry</Button>
    </div>

    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">Loading sales data...</p>
      </div>
    </div>

    <!-- Table -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
          <TableRow>
            <TableHead class="whitespace-nowrap">Date</TableHead>
            <TableHead class="whitespace-nowrap">Car Pic</TableHead>
            <TableHead class="whitespace-nowrap">App ID</TableHead>
            <TableHead class="whitespace-nowrap">Specs</TableHead>
            <TableHead class="whitespace-nowrap">Insp. Report, PDF</TableHead>
            <TableHead class="whitespace-nowrap">Auction Status</TableHead>
            <TableHead class="whitespace-nowrap">PD</TableHead>
            <TableHead class="whitespace-nowrap">CEP & OtoBuy</TableHead>
            <TableHead class="whitespace-nowrap">Act Bids</TableHead>
            <TableHead class="whitespace-nowrap">HB</TableHead>
            <TableHead class="whitespace-nowrap">Auto Bid</TableHead>
            <TableHead class="whitespace-nowrap">GAP</TableHead>
            <TableHead class="whitespace-nowrap">Overall Bids</TableHead>
            <TableHead class="whitespace-nowrap">Portfol. Bids</TableHead>
            <TableHead class="whitespace-nowrap">Portfol. Dealers</TableHead>
            <TableHead class="whitespace-nowrap">Prosp. Dealers</TableHead>
            <TableHead class="whitespace-nowrap">Retail Status</TableHead>
            <TableHead class="whitespace-nowrap">Quality</TableHead>
            <TableHead class="whitespace-nowrap">Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="car in paginatedItems"
            :key="car.id"
            class="group hover:bg-muted/50 transition-all duration-300"
          >
            <TableCell class="whitespace-nowrap text-xs text-muted-foreground">{{ formatDate(car.createdAt) }}</TableCell>
            <TableCell class="w-16">
              <div class="size-10 rounded-md overflow-hidden bg-muted border">
                <img v-if="car.imageUrl" :src="car.imageUrl" class="size-full object-cover">
                <div v-else class="size-full flex items-center justify-center"><Icon name="i-lucide-car" class="size-4 text-muted-foreground" /></div>
              </div>
            </TableCell>
            <TableCell class="whitespace-nowrap text-xs font-mono">{{ car.appointmentId || '—' }}</TableCell>
            <TableCell class="whitespace-nowrap">
              <p class="font-medium text-xs">{{ car.make }} {{ car.model }}</p>
              <p class="text-[10px] text-muted-foreground">{{ car.variant }} • {{ car.fuelType }}</p>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="whitespace-nowrap text-xs">
              <Badge variant="outline" class="font-normal">{{ car.auctionStatus || '—' }}</Badge>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs whitespace-nowrap">
              <div class="font-medium">{{ formatCurrency(car.cep) }}</div>
              <div class="text-[10px] text-muted-foreground">Oto: {{ formatCurrency(car.otobuyPrice) }}</div>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            
            <TableCell class="text-xs font-bold text-emerald-600 tabular-nums">
              {{ formatCurrency(car.highestBid) }}
            </TableCell>
            
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            
            <TableCell class="text-xs whitespace-nowrap font-medium tabular-nums shadow-sm" :class="Number(car.cep) - Number(car.highestBid) > 0 ? 'text-amber-600' : 'text-muted-foreground'">
              {{ (car.cep && car.highestBid) ? formatCurrency(Number(car.cep) - Number(car.highestBid)) : '—' }}
            </TableCell>

            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
            <TableCell class="text-xs text-muted-foreground text-center">—</TableCell>
          </TableRow>
          <TableRow v-if="paginatedItems.length === 0">
            <TableCell colspan="19" class="h-32 text-center text-muted-foreground bg-muted/10">No matching approved inspection records found</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ showingFrom }} to {{ showingTo }} out of {{ totalFiltered }} records
      </p>
      <div v-if="totalPages > 1" class="flex items-center gap-1">
        <Button variant="outline" size="icon" class="size-7" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
          <Icon name="i-lucide-chevron-left" class="size-3.5" />
        </Button>
        <template v-for="pg in pageNumbers" :key="pg">
          <Button
            v-if="pg !== '...'"
            :variant="pg === currentPage ? 'default' : 'outline'"
            size="icon"
            class="size-7 text-xs"
            @click="goToPage(pg as number)"
          >
            {{ pg }}
          </Button>
          <span v-else class="px-1 text-xs text-muted-foreground">…</span>
        </template>
        <Button variant="outline" size="icon" class="size-7" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
