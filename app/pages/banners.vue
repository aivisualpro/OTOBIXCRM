<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })
useHead({ title: 'Banners — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Banners', icon: 'i-lucide-image-play', description: 'Campaigns · promotions · announcements' })

const {
  allBanners,
  isLoading,
  isFetched,
  fetchError,
  totalCount,
  refreshBanners,
  fetchBannersCount,
  addBanner,
  updateBannerStatus,
  deleteBanner,
} = useBannersApi()

// ─── Filters ───
const filterView = ref('')
const filterType = ref('')
const filterStatus = ref('')
const search = ref('')

const viewOptions = ['home', 'auction', 'profile', 'deals', 'settings']
const typeOptions = ['promotional', 'informational', 'announcement', 'seasonal', 'event']
const statusOptions = ['active', 'inactive', 'draft', 'scheduled']

const currentFilters = computed(() => ({
  view: filterView.value || undefined,
  type: filterType.value || undefined,
  status: filterStatus.value || undefined,
}))

const hasActiveFilter = computed(() => !!(filterView.value || filterType.value || filterStatus.value))

// ─── Fetch ───
async function doFetch() {
  await refreshBanners(currentFilters.value)
  await fetchBannersCount(currentFilters.value)
}

onMounted(() => doFetch())
watch([filterView, filterType, filterStatus], () => doFetch())

// ─── Search + virtual list ───
const BATCH_SIZE = 24
const visibleCount = ref(BATCH_SIZE)

watch(search, () => { visibleCount.value = BATCH_SIZE })

const filteredItems = computed(() => {
  if (!search.value) return allBanners.value
  const q = search.value.toLowerCase()
  return allBanners.value.filter(b =>
    b.screenName?.toLowerCase().includes(q)
    || b.type?.toLowerCase().includes(q)
    || b.view?.toLowerCase().includes(q)
    || b.status?.toLowerCase().includes(q),
  )
})

const totalFiltered = computed(() => filteredItems.value.length)
const hasMore = computed(() => visibleCount.value < totalFiltered.value)
const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))

// ─── Group by view ───
const groupedByView = computed(() => {
  const groups: Record<string, typeof visibleItems.value> = {}
  visibleItems.value.forEach((item) => {
    const key = item.view || 'other'
    ;(groups[key] ??= []).push(item)
  })
  // Sort groups by viewOptions order, unknown at the end
  const order = [...viewOptions, 'other']
  return Object.entries(groups).sort(([a], [b]) => {
    return (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b))
  })
})

function viewDescription(view: string) {
  switch (view?.toLowerCase()) {
    case 'home': return 'Banners displayed on the home screen'
    case 'auction': return 'Banners shown in the auctions section'
    case 'profile': return 'Banners on user profile pages'
    case 'deals': return 'Banners in the deals & offers section'
    case 'settings': return 'Banners shown in the settings area'
    default: return 'Uncategorized banners'
  }
}

function viewGradient(view: string) {
  switch (view?.toLowerCase()) {
    case 'home': return 'from-blue-500/10 to-indigo-500/10'
    case 'auction': return 'from-amber-500/10 to-orange-500/10'
    case 'profile': return 'from-violet-500/10 to-purple-500/10'
    case 'deals': return 'from-emerald-500/10 to-teal-500/10'
    case 'settings': return 'from-gray-500/10 to-slate-500/10'
    default: return 'from-muted to-muted/50'
  }
}

function viewAccent(view: string) {
  switch (view?.toLowerCase()) {
    case 'home': return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20'
    case 'auction': return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
    case 'profile': return 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20'
    case 'deals': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    case 'settings': return 'text-gray-600 dark:text-gray-400 bg-gray-500/10 border-gray-500/20'
    default: return 'text-muted-foreground bg-muted/50'
  }
}

function loadMore() {
  if (hasMore.value) {
    visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, totalFiltered.value)
  }
}

const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    },
    { rootMargin: '200px' },
  )
})

onBeforeUnmount(() => { observer?.disconnect() })

watch(scrollSentinel, (el) => {
  observer?.disconnect()
  if (el) observer?.observe(el)
})

// ─── Stats ───
const stats = computed(() => {
  const all = allBanners.value
  return {
    total: all.length,
    active: all.filter(b => b.status === 'active').length,
    inactive: all.filter(b => b.status === 'inactive').length,
    draft: all.filter(b => b.status === 'draft').length,
  }
})

// ─── Add Banner Dialog ───
const showAddDialog = ref(false)
const isSubmitting = ref(false)

const addForm = ref({
  screenName: '',
  status: 'active',
  type: 'promotional',
  view: 'home',
})

function openAdd() {
  addForm.value = { screenName: '', status: 'active', type: 'promotional', view: 'home' }
  showAddDialog.value = true
}

async function handleAdd() {
  if (!addForm.value.screenName.trim()) {
    toast.error('Screen name is required')
    return
  }
  isSubmitting.value = true
  try {
    await addBanner(addForm.value)
    toast.success('Banner added successfully')
    showAddDialog.value = false
    await doFetch()
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to add banner')
  }
  finally {
    isSubmitting.value = false
  }
}

// ─── Status Toggle ───
const togglingId = ref<string | null>(null)

async function handleStatusToggle(banner: any) {
  const newStatus = banner.status === 'active' ? 'inactive' : 'active'
  togglingId.value = banner._id
  try {
    await updateBannerStatus(banner._id, newStatus)
    toast.success(`Banner ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to update status')
    await doFetch()
  }
  finally {
    togglingId.value = null
  }
}

// ─── Delete ───
const showDeleteDialog = ref(false)
const deleteTarget = ref<any>(null)
const isDeleting = ref(false)

function confirmDelete(item: any) {
  deleteTarget.value = item
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await deleteBanner(deleteTarget.value._id)
    toast.success('Banner deleted successfully')
    showDeleteDialog.value = false
    deleteTarget.value = null
    await fetchBannersCount(currentFilters.value)
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to delete banner')
  }
  finally {
    isDeleting.value = false
  }
}

// ─── Helpers ───
function timeAgo(value?: string): string {
  if (!value) return '—'
  const now = new Date()
  const date = new Date(value)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

async function handleRefresh() {
  await doFetch()
  toast.success('Banners refreshed')
}

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'inactive': return 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20'
    case 'draft': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'scheduled': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    default: return 'bg-muted text-muted-foreground'
  }
}

function statusDot(status: string) {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-emerald-500'
    case 'inactive': return 'bg-gray-400'
    case 'draft': return 'bg-amber-500'
    case 'scheduled': return 'bg-blue-500'
    default: return 'bg-gray-400'
  }
}

function statusGlow(status: string) {
  switch (status?.toLowerCase()) {
    case 'active': return 'shadow-emerald-500/20'
    case 'scheduled': return 'shadow-blue-500/20'
    default: return ''
  }
}

function typeColor(type: string) {
  switch (type?.toLowerCase()) {
    case 'promotional': return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
    case 'informational': return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
    case 'announcement': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'seasonal': return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
    case 'event': return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
    default: return 'bg-muted text-muted-foreground'
  }
}

function typeIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'promotional': return 'i-lucide-megaphone'
    case 'informational': return 'i-lucide-info'
    case 'announcement': return 'i-lucide-bell-ring'
    case 'seasonal': return 'i-lucide-snowflake'
    case 'event': return 'i-lucide-calendar-days'
    default: return 'i-lucide-image'
  }
}

function viewIcon(view: string) {
  switch (view?.toLowerCase()) {
    case 'home': return 'i-lucide-home'
    case 'auction': return 'i-lucide-gavel'
    case 'profile': return 'i-lucide-user'
    case 'deals': return 'i-lucide-tag'
    case 'settings': return 'i-lucide-settings'
    default: return 'i-lucide-eye'
  }
}

// Image preview
const previewUrl = ref('')
const previewBanner = ref<any>(null)
const showPreview = ref(false)

function openPreview(banner: any) {
  previewUrl.value = banner.imageUrl
  previewBanner.value = banner
  showPreview.value = true
}
</script>

<template>
  <!-- Teleport toolbar -->
  <ClientOnly>
    <Teleport to="#header-actions">
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="Search banners..." class="pl-8 h-8 w-48 text-sm" />
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} banner{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
      <Button size="sm" class="h-8" @click="openAdd">
        <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
        Add Banner
      </Button>
    </Teleport>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <!-- Stats Row + Filters -->
    <div class="shrink-0 border-b bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 px-4 lg:px-6 py-4">
      <div class="flex flex-wrap items-center gap-4">
        <!-- Stat Pills -->
        <div class="flex items-center gap-2">
          <button
            class="stat-pill flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm"
            :class="!filterStatus ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'bg-card hover:bg-muted/50'"
            @click="filterStatus = ''"
          >
            <Icon name="i-lucide-layers" class="size-3.5" />
            All
            <span class="tabular-nums font-bold">{{ stats.total }}</span>
          </button>
          <button
            class="stat-pill flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm"
            :class="filterStatus === 'active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-card hover:bg-muted/50'"
            @click="filterStatus = filterStatus === 'active' ? '' : 'active'"
          >
            <span class="size-2 rounded-full bg-emerald-500" />
            Active
            <span class="tabular-nums font-bold">{{ stats.active }}</span>
          </button>
          <button
            class="stat-pill flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm"
            :class="filterStatus === 'inactive' ? 'bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400 shadow-sm' : 'bg-card hover:bg-muted/50'"
            @click="filterStatus = filterStatus === 'inactive' ? '' : 'inactive'"
          >
            <span class="size-2 rounded-full bg-gray-400" />
            Inactive
            <span class="tabular-nums font-bold">{{ stats.inactive }}</span>
          </button>
          <button
            class="stat-pill flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm"
            :class="filterStatus === 'draft' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm' : 'bg-card hover:bg-muted/50'"
            @click="filterStatus = filterStatus === 'draft' ? '' : 'draft'"
          >
            <span class="size-2 rounded-full bg-amber-500" />
            Draft
            <span class="tabular-nums font-bold">{{ stats.draft }}</span>
          </button>
        </div>

        <Separator orientation="vertical" class="h-6 hidden md:block" />

        <!-- Dropdown Filters -->
        <div class="flex items-center gap-2">
          <Select v-model="filterView">
            <SelectTrigger class="h-8 w-[120px] text-xs bg-card">
              <Icon name="i-lucide-monitor-smartphone" class="size-3 mr-1 text-muted-foreground shrink-0" />
              <SelectValue :placeholder="'All Views'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Views</SelectItem>
              <SelectItem v-for="opt in viewOptions" :key="opt" :value="opt">
                <div class="flex items-center gap-2">
                  <Icon :name="viewIcon(opt)" class="size-3.5" />
                  {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="filterType">
            <SelectTrigger class="h-8 w-[140px] text-xs bg-card">
              <Icon name="i-lucide-tag" class="size-3 mr-1 text-muted-foreground shrink-0" />
              <SelectValue :placeholder="'All Types'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem v-for="opt in typeOptions" :key="opt" :value="opt">
                <div class="flex items-center gap-2">
                  <Icon :name="typeIcon(opt)" class="size-3.5" />
                  {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            v-if="hasActiveFilter"
            variant="ghost"
            size="sm"
            class="h-8 text-xs text-muted-foreground"
            @click="filterView = ''; filterType = ''; filterStatus = ''"
          >
            <Icon name="i-lucide-x" class="mr-1 size-3" />
            Clear all
          </Button>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="fetchError" class="shrink-0 m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <div class="size-10 rounded-xl bg-destructive/10 flex items-center justify-center">
        <Icon name="i-lucide-alert-circle" class="size-5 text-destructive" />
      </div>
      <div class="flex-1">
        <p class="text-sm font-semibold text-destructive">Failed to load banners</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ fetchError }}</p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" />
        Retry
      </Button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 overflow-auto p-4 lg:p-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="i in 8" :key="i" class="rounded-2xl border bg-card overflow-hidden animate-pulse">
          <div class="aspect-[16/9] bg-muted" />
          <div class="p-4 space-y-3">
            <div class="h-4 bg-muted rounded w-2/3" />
            <div class="flex gap-2">
              <div class="h-5 bg-muted rounded w-16" />
              <div class="h-5 bg-muted rounded w-14" />
            </div>
            <div class="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <!-- Grouped Cards by View -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto p-4 lg:p-6 space-y-8">
      <template v-for="([viewName, items], groupIdx) in groupedByView" :key="viewName">
        <!-- Section Header -->
        <div class="view-section" :style="{ '--group-delay': `${groupIdx * 80}ms` }">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-xl flex items-center justify-center border" :class="viewAccent(viewName)">
                <Icon :name="viewIcon(viewName)" class="size-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-base font-bold capitalize">{{ viewName }}</h2>
                  <Badge variant="secondary" class="text-[10px] tabular-nums font-bold h-5 px-1.5">
                    {{ items.length }}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground">{{ viewDescription(viewName) }}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-xs gap-1"
              @click="filterView = filterView === viewName ? '' : viewName"
            >
              <Icon :name="filterView === viewName ? 'i-lucide-x' : 'i-lucide-filter'" class="size-3" />
              {{ filterView === viewName ? 'Clear' : 'Filter' }}
            </Button>
          </div>

          <!-- Cards Grid -->
          <TransitionGroup name="cards" tag="div" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="(item, idx) in items"
              :key="item._id"
              class="banner-card group relative rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5"
              :style="{ '--delay': `${idx * 40}ms` }"
            >
              <!-- Image Section -->
              <div
                class="relative aspect-[16/9] overflow-hidden cursor-pointer"
                :class="item.imageUrl ? '' : `bg-gradient-to-br ${viewGradient(viewName)}`"
                @click="item.imageUrl ? openPreview(item) : undefined"
              >
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.screenName"
                  class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div v-else class="size-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                  <Icon name="i-lucide-image" class="size-10" />
                  <span class="text-xs font-medium">No image</span>
                </div>

                <!-- Gradient Overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <!-- Status Indicator -->
                <div class="absolute top-3 right-3">
                  <div
                    class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border transition-all"
                    :class="[statusColor(item.status), statusGlow(item.status)]"
                  >
                    <span class="relative flex size-1.5">
                      <span
                        v-if="item.status === 'active'"
                        class="animate-ping absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75"
                      />
                      <span class="relative inline-flex rounded-full size-1.5" :class="statusDot(item.status)" />
                    </span>
                    {{ item.status }}
                  </div>
                </div>

                <!-- Hover Actions -->
                <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  <Button
                    v-if="item.imageUrl"
                    variant="secondary"
                    size="sm"
                    class="h-7 text-xs gap-1 bg-white/90 dark:bg-black/70 backdrop-blur-sm shadow-lg"
                    @click.stop="openPreview(item)"
                  >
                    <Icon name="i-lucide-expand" class="size-3" />
                    Preview
                  </Button>
                  <div v-else />
                  <div class="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      class="size-7 bg-white/90 dark:bg-black/70 backdrop-blur-sm shadow-lg"
                      :title="item.status === 'active' ? 'Deactivate' : 'Activate'"
                      @click.stop="handleStatusToggle(item)"
                    >
                      <Icon v-if="togglingId === item._id" name="i-lucide-loader-2" class="size-3.5 animate-spin" />
                      <Icon v-else :name="item.status === 'active' ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      class="size-7 bg-white/90 dark:bg-black/70 backdrop-blur-sm shadow-lg text-destructive hover:text-destructive"
                      title="Delete banner"
                      @click.stop="confirmDelete(item)"
                    >
                      <Icon name="i-lucide-trash-2" class="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <!-- Card Body -->
              <div class="p-4 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-semibold text-sm leading-tight line-clamp-1">
                    {{ item.screenName || 'Untitled Banner' }}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="size-6 shrink-0 -mr-1 -mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Icon name="i-lucide-more-horizontal" class="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40">
                      <DropdownMenuItem @click="handleStatusToggle(item)">
                        <Icon :name="item.status === 'active' ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4 mr-2" />
                        {{ item.status === 'active' ? 'Deactivate' : 'Activate' }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive focus:text-destructive" @click="confirmDelete(item)">
                        <Icon name="i-lucide-trash-2" class="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <!-- Tags Row -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" class="text-[10px] capitalize gap-1 font-medium" :class="typeColor(item.type)">
                    <Icon :name="typeIcon(item.type)" class="size-2.5" />
                    {{ item.type || '—' }}
                  </Badge>
                </div>

                <!-- Footer -->
                <div class="flex items-center justify-between pt-1 border-t border-dashed">
                  <span class="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Icon name="i-lucide-clock" class="size-3" />
                    {{ timeAgo(item.createdAt) }}
                  </span>
                  <button
                    class="text-[11px] font-medium flex items-center gap-1 transition-colors"
                    :class="item.status === 'active' ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700' : 'text-muted-foreground hover:text-foreground'"
                    @click="handleStatusToggle(item)"
                  >
                    <Icon v-if="togglingId === item._id" name="i-lucide-loader-2" class="size-3 animate-spin" />
                    <template v-else>
                      <span class="size-1.5 rounded-full" :class="statusDot(item.status)" />
                      {{ item.status === 'active' ? 'Live' : item.status }}
                    </template>
                  </button>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>

      <!-- Empty state -->
      <div
        v-if="!isLoading && filteredItems.length === 0"
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <div class="size-24 rounded-3xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center mb-6 shadow-xl shadow-primary/5">
          <Icon name="i-lucide-image-off" class="size-10 text-primary/60" />
        </div>
        <h3 class="text-xl font-bold mb-1.5">
          {{ search ? 'No banners match your search' : 'No banners yet' }}
        </h3>
        <p class="text-sm text-muted-foreground max-w-sm mb-6">
          {{ search
            ? `We couldn't find any banners matching "${search}". Try a different search term.`
            : 'Get started by adding your first banner. Banners are displayed in the mobile app.'
          }}
        </p>
        <div class="flex items-center gap-3">
          <Button v-if="search" variant="outline" @click="search = ''">
            <Icon name="i-lucide-x" class="mr-1.5 size-4" />
            Clear search
          </Button>
          <Button @click="openAdd">
            <Icon name="i-lucide-plus" class="mr-1.5 size-4" />
            Add Banner
          </Button>
        </div>
      </div>

      <!-- Scroll sentinel -->
      <div v-if="hasMore" ref="scrollSentinel" class="flex items-center justify-center py-8">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
          Loading more banners...
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ visibleItems.length }} of {{ totalFiltered }} banners
      </p>
      <p v-if="totalCount" class="text-xs text-muted-foreground tabular-nums">
        Total: {{ totalCount }}
      </p>
    </div>
  </div>

  <!-- Add Banner Dialog -->
  <Dialog v-model:open="showAddDialog">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="i-lucide-image-plus" class="size-4 text-primary" />
          </div>
          Add New Banner
        </DialogTitle>
        <DialogDescription>
          Create a new banner for the mobile app. Images are uploaded from the app.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4 mt-2" @submit.prevent="handleAdd">
        <div class="space-y-1.5">
          <Label for="banner-screen">Screen Name <span class="text-destructive">*</span></Label>
          <Input id="banner-screen" v-model="addForm.screenName" placeholder="e.g. HomeScreen, AuctionScreen" autofocus />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label>Type</Label>
            <Select v-model="addForm.type">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in typeOptions" :key="opt" :value="opt">
                  <div class="flex items-center gap-2">
                    <Icon :name="typeIcon(opt)" class="size-3.5" />
                    {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label>View</Label>
            <Select v-model="addForm.view">
              <SelectTrigger>
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in viewOptions" :key="opt" :value="opt">
                  <div class="flex items-center gap-2">
                    <Icon :name="viewIcon(opt)" class="size-3.5" />
                    {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label>Status</Label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="opt in statusOptions"
              :key="opt"
              type="button"
              class="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all"
              :class="addForm.status === opt
                ? `${statusColor(opt)} ring-1 ring-inset shadow-sm`
                : 'bg-card hover:bg-muted/50'"
              @click="addForm.status = opt"
            >
              <span class="size-1.5 rounded-full" :class="statusDot(opt)" />
              {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
            </button>
          </div>
        </div>

        <!-- Preview -->
        <div class="rounded-2xl border bg-gradient-to-br from-muted/30 to-muted/50 overflow-hidden">
          <div class="aspect-[3/1] bg-gradient-to-br from-primary/5 via-violet-500/5 to-pink-500/5 flex items-center justify-center">
            <div class="flex flex-col items-center gap-1 text-muted-foreground/40">
              <Icon name="i-lucide-image" class="size-8" />
              <span class="text-[10px] font-medium">Image uploaded from app</span>
            </div>
          </div>
          <div class="p-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold truncate">{{ addForm.screenName || 'Screen Name' }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Badge variant="outline" class="text-[9px] capitalize" :class="typeColor(addForm.type)">{{ addForm.type }}</Badge>
              <Badge variant="secondary" class="text-[9px] capitalize">{{ addForm.view }}</Badge>
              <Badge variant="outline" class="text-[9px] capitalize" :class="statusColor(addForm.status)">{{ addForm.status }}</Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" @click="showAddDialog = false">Cancel</Button>
          <Button type="submit" :disabled="isSubmitting">
            <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
            <Icon v-else name="i-lucide-plus" class="mr-1.5 size-3.5" />
            Add Banner
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation -->
  <AlertDialog v-model:open="showDeleteDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2">
          <div class="size-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Icon name="i-lucide-alert-triangle" class="size-4 text-destructive" />
          </div>
          Delete Banner
        </AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete the banner for <strong>{{ deleteTarget?.screenName }}</strong>?
          This will also remove the associated image. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <!-- Preview of banner being deleted -->
      <div v-if="deleteTarget?.imageUrl" class="rounded-xl border overflow-hidden">
        <img :src="deleteTarget.imageUrl" :alt="deleteTarget.screenName" class="w-full h-24 object-cover opacity-60" />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel @click="showDeleteDialog = false">Cancel</AlertDialogCancel>
        <Button variant="destructive" :disabled="isDeleting" @click="handleDelete">
          <Icon v-if="isDeleting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
          Delete
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Image Preview Dialog -->
  <Dialog v-model:open="showPreview">
    <DialogContent class="sm:max-w-3xl p-0 overflow-hidden bg-black/95 border-white/10">
      <div class="relative">
        <img
          :src="previewUrl"
          :alt="previewBanner?.screenName"
          class="w-full h-auto max-h-[75vh] object-contain"
        />
        <!-- Info bar -->
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
          <div class="flex items-end justify-between">
            <div>
              <h3 class="text-white font-semibold text-sm">{{ previewBanner?.screenName }}</h3>
              <div class="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" class="text-[10px] capitalize border-white/20 text-white/80 bg-white/10">
                  {{ previewBanner?.type }}
                </Badge>
                <Badge variant="outline" class="text-[10px] capitalize border-white/20 text-white/80 bg-white/10">
                  {{ previewBanner?.view }}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="text-white hover:bg-white/20"
              @click="showPreview = false"
            >
              <Icon name="i-lucide-x" class="size-5" />
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.view-section {
  animation: section-appear 0.5s ease both;
  animation-delay: var(--group-delay, 0ms);
}

@keyframes section-appear {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.banner-card {
  animation: card-appear 0.4s ease both;
  animation-delay: var(--delay, 0ms);
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.stat-pill {
  animation: pill-appear 0.3s ease both;
}

@keyframes pill-appear {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.cards-enter-active {
  transition: all 0.4s ease;
}
.cards-leave-active {
  transition: all 0.3s ease;
}
.cards-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
.cards-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.cards-move {
  transition: transform 0.4s ease;
}
</style>
