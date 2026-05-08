<script setup lang="ts">
import { toast } from 'vue-sonner'

const router = useRouter()
const { setHeader } = usePageHeader()
setHeader({ title: 'Leads - Self Inspected', description: '', icon: 'i-lucide-smartphone' })

// ─── Data ───
const items = ref<any[]>([])
const isLoading = ref(true)
const totalCount = ref(0)
const search = ref('')

const columns = [
  { key: 'inspectionId', label: 'Inspection ID' },
  { key: 'auctionStatus', label: 'Auction Status', type: 'status' },
  { key: 'registrationNumber', label: 'Reg. Number' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant' },
  { key: 'userId', label: 'User ID' },
  { key: 'createdAt', label: 'Created At', type: 'date' },
]

// ─── Fetch (only inspectionRequested) ───
async function fetchData() {
  isLoading.value = true
  try {
    const params: Record<string, string> = { auctionStatus: 'inspectionRequested' }
    if (search.value) params.search = search.value

    const data = await $fetch<any>('/api/self-inspected', { params })
    items.value = data.items || []
    totalCount.value = data.total || 0
  }
  catch (err: any) {
    toast.error(err?.data?.message || 'Failed to fetch self-inspected cars')
  }
  finally {
    isLoading.value = false
  }
}

onMounted(fetchData)

let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(fetchData, 400)
})

// ─── Take Under Review Dialog ───
const showReviewDialog = ref(false)
const reviewingCar = ref<any>(null)
const isSubmitting = ref(false)

function getCurrentUser() {
  const cookie = useCookie('userData')
  const val = cookie.value
  if (!val) return { userName: 'Unknown', email: '' }
  const user = typeof val === 'string' ? JSON.parse(val) : val
  return { userName: user?.userName || 'Unknown', email: user?.email || '' }
}

function openReviewDialog(item: any) {
  reviewingCar.value = item
  showReviewDialog.value = true
}

async function confirmReview() {
  if (!reviewingCar.value) return
  isSubmitting.value = true
  try {
    const id = reviewingCar.value._id || reviewingCar.value.id
    const user = getCurrentUser()

    await $fetch('/api/self-inspected/update-status', {
      method: 'PUT',
      body: {
        id,
        auctionStatus: 'inspectionApproved',
        reviewedBy: user.email,
      },
    })

    toast.success('Car taken under review successfully')
    showReviewDialog.value = false
    reviewingCar.value = null
    fetchData()
  }
  catch (err: any) {
    toast.error(err?.data?.message || 'Failed to update status')
  }
  finally {
    isSubmitting.value = false
  }
}

// ─── Sort ───
const sortKey = ref('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const sortedItems = computed(() => {
  return [...items.value].sort((a, b) => {
    const aVal = a[sortKey.value] ?? ''
    const bVal = b[sortKey.value] ?? ''
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

function formatDate(value: any): string {
  if (!value) return '—'
  try {
    const d = typeof value === 'object' && value.$date ? new Date(value.$date) : new Date(value)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  catch { return String(value) }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <HeaderActions>
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="Search self-inspected cars..." class="pl-8 h-8 w-[260px] text-sm pr-8" />
        <Button
          v-if="search"
          variant="ghost"
          size="icon"
          class="absolute right-0 top-0 h-full size-8 rounded-l-none text-muted-foreground hover:bg-transparent"
          @click="search = ''"
        >
          <Icon name="i-lucide-x" class="size-3.5" />
        </Button>
      </div>

      <div class="flex-1" />

      <Badge variant="outline" class="bg-muted/30 border-primary/20 text-muted-foreground text-[10px] tracking-wider font-mono h-[24px]">
        Total: <span class="text-primary font-semibold ml-1 text-xs">{{ totalCount }}</span>
      </Badge>
    </HeaderActions>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Table -->
    <div v-else class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <Table container-class="h-full pb-10 px-[19px]">
        <TableHeader class="sticky top-0 z-10 bg-muted border-b border-border">
          <TableRow>
            <TableHead
              v-for="col in columns"
              :key="col.key"
              class="cursor-pointer select-none hover:bg-muted/80 transition-colors whitespace-nowrap"
              @click="toggleSort(col.key)"
            >
              <div class="flex items-center gap-1">
                {{ col.label }}
                <span class="text-muted-foreground/60 text-xs">
                  <template v-if="sortKey === col.key">{{ sortDir === 'asc' ? '↑' : '↓' }}</template>
                  <template v-else>↕</template>
                </span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in sortedItems"
            :key="item._id || item.id"
            class="group cursor-pointer hover:bg-muted/50"
            @click="router.push(`/self-inspection/${item.inspectionId}`)"
          >
            <TableCell v-for="col in columns" :key="col.key">
              <!-- Auction Status (clickable → opens Take Under Review dialog) -->
              <template v-if="col.type === 'status'">
                <Badge
                  variant="outline"
                  class="cursor-pointer hover:ring-1 hover:ring-amber-500/30 transition-all bg-amber-500/10 border-amber-500/20 text-amber-600"
                  @click.stop="openReviewDialog(item)"
                >
                  <Icon name="i-lucide-clipboard-list" class="size-3 mr-1" />
                  Inspection Requested
                </Badge>
              </template>

              <!-- Date -->
              <span v-else-if="col.type === 'date'" class="text-muted-foreground text-sm">
                {{ formatDate(item[col.key]) }}
              </span>

              <!-- Default text -->
              <span v-else class="text-sm">{{ item[col.key] ?? '—' }}</span>
            </TableCell>
          </TableRow>

          <TableRow v-if="sortedItems.length === 0">
            <TableCell :colspan="columns.length" class="h-32 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon name="i-lucide-inbox" class="size-8" />
                <p>No self-inspected cars found</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Footer -->
    <div class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ sortedItems.length }} of {{ totalCount }} records
      </p>
    </div>

    <!-- Take Under Review Dialog -->
    <Dialog v-model:open="showReviewDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-activity" class="size-5 text-orange-500" />
            Take Under Review
          </DialogTitle>
          <DialogDescription>
            You are about to assign this inspection to yourself for quality review.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div v-if="reviewingCar" class="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p class="text-sm font-medium">
              {{ reviewingCar.registeredOwner || reviewingCar.registrationNumber || 'Unknown' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ reviewingCar.make }} {{ reviewingCar.model }} {{ reviewingCar.variant }} — {{ reviewingCar.registrationNumber }}
            </p>
            <p class="text-sm font-medium text-muted-foreground mt-3 border-t pt-3 w-full">
              Taking Responsibility as:
              <strong class="text-foreground text-orange-600">
                {{ getCurrentUser().userName }}
              </strong>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showReviewDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSubmitting" class="bg-orange-600 hover:bg-orange-700 text-white" @click="confirmReview">
            <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Confirm QC Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
