<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { useStorage } from '@vueuse/core'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  Contact,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-vue-next'
import draggable from 'vuedraggable'

// ─── Date range from the picker ───
const dateRange = ref({ start: new Date(), end: new Date() })

function onDateRangeUpdate(range: { start: Date, end: Date }) {
  dateRange.value = range
}

// ─── Dashboard stats composable ───
const {
  isLoading,
  kpi,
  auctionsClosedChange,
  newCustomersChange,
  auctionChartData,
  customerChartData,
  dealersOverview,
} = useDashboardStats(dateRange)

// ─── Chart time range ───
const timeRange = ref('30d')
const isDesktop = useMediaQuery('(min-width: 768px)')
watch(isDesktop, () => {
  timeRange.value = isDesktop.value ? '30d' : '7d'
}, { immediate: true })

// ─── Format helpers ───
function _formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
}

function formatCompact(val: number): string {
  if (val >= 10000000)
    return `₹${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000)
    return `₹${(val / 100000).toFixed(1)}L`
  if (val >= 1000)
    return `₹${(val / 1000).toFixed(1)}K`
  return `₹${val}`
}

// ─── Contextual footer messages ───
const auctionsFooterMsg = computed(() => {
  const c = auctionsClosedChange.value
  if (c > 10)
    return 'Strong auction performance'
  if (c > 0)
    return 'Auctions trending upward'
  if (c === 0)
    return 'Steady auction volume'
  if (c > -10)
    return 'Slight auction dip'
  return 'Auctions need attention'
})

const auctionsFooterSub = computed(() =>
  `${kpi.value.auctionsClosedCount} cars sold this period`,
)

const customersFooterMsg = computed(() => {
  const c = newCustomersChange.value
  if (c > 10)
    return 'Customer growth accelerating'
  if (c > 0)
    return 'Steady customer acquisition'
  if (c === 0)
    return 'Customer acquisition stable'
  return 'Acquisition needs attention'
})

const customersFooterSub = computed(() =>
  `Based on Joined date filter`,
)

const activeFooterMsg = computed(() => {
  const { activeAccountsDealers, activeAccountsCustomers } = kpi.value
  return `${activeAccountsDealers} dealers · ${activeAccountsCustomers} customers`
})

const growthFooterMsg = computed(() => {
  const g = kpi.value.growthRate
  if (g > 20)
    return 'Exceptional growth trajectory'
  if (g > 10)
    return 'Strong growth momentum'
  if (g > 0)
    return 'Positive growth trend'
  if (g === 0)
    return 'Flat period-over-period'
  if (g > -10)
    return 'Minor decline detected'
  return 'Significant decline – review needed'
})

const growthFooterSub = computed(() =>
  `${formatCompact(kpi.value.auctionsClosed)} vs ${formatCompact(kpi.value.auctionsClosedPrev)} prior`,
)

const { setHeader } = usePageHeader()
setHeader({ title: 'Dashboard', icon: 'i-lucide-layout-dashboard', description: 'Live overview · metrics · performance' })

// ─── Workspace Widgets Permissions ───
const { activeWorkspace } = useWorkspace()

const WIDGETS_MANIFEST = [
  { id: 'auctions_closed', title: 'Sales Revenue', icon: 'i-lucide-banknote' },
  { id: 'total_leads', title: 'Active Lead Pipeline', icon: 'i-lucide-activity' },
  { id: 'total_cars', title: 'Total Cars Inventory', icon: 'i-lucide-car-front' },
  { id: 'new_customers', title: 'New Customers', icon: 'i-lucide-users' },
  { id: 'active_accounts', title: 'Active Accounts', icon: 'i-lucide-car' },
  { id: 'growth_rate', title: 'Sales Growth Rate', icon: 'i-lucide-bar-chart-3' },
  { id: 'total_dealers', title: 'Total Dealers', icon: 'i-lucide-contact' },
  { id: 'auction_trends', title: 'Sales & Customer Trends', icon: 'i-lucide-trending-up', fullWidth: true },
  { id: 'dealers_overview', title: 'People Network', icon: 'i-lucide-building-2', fullWidth: true },
]

const availableWidgets = computed(() => {
  return activeWorkspace.value?.dashboardWidgets || WIDGETS_MANIFEST.map(w => w.id)
})

const allLayouts = useStorage<Record<string, string[]>>('otobix_dashboard_layouts', {})

const userLayout = computed({
  get: () => {
    const wsId = activeWorkspace.value?.workspaceId || 'admin'
    return allLayouts.value[wsId] || WIDGETS_MANIFEST.map(w => w.id)
  },
  set: (val) => {
    const wsId = activeWorkspace.value?.workspaceId || 'admin'
    allLayouts.value[wsId] = val
  },
})

const displayedWidgets = computed({
  get: () => {
    // only show widgets that userLayout has AND are available
    const layout = userLayout.value.filter(id => availableWidgets.value.includes(id))
    // if a widget was added to permissions but isn't in layout yet, let's auto-add it to the end
    const missing = availableWidgets.value.filter(id => !layout.includes(id) && WIDGETS_MANIFEST.map(w => w.id).includes(id))
    if (layout.length === 0 && missing.length > 0) {
      // If layout is completely empty, it might mean user hid them all manually, or it's uninitialized.
      // But we will stick strictly to userLayout so if user deleted all, they stay deleted.
      // Except if userLayout itself was never initialized to this exact length ... actually let's just use what useStorage provides.
    }

    return layout
  },
  set: (val) => { userLayout.value = val },
})

function toggleWidget(widgetId: string) {
  const current = [...userLayout.value]
  const idx = current.indexOf(widgetId)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(widgetId)
  }
  userLayout.value = current
}
</script>

<template>
  <div class="w-full h-full flex flex-col gap-4 overflow-y-auto pb-10">
    <ClientOnly>
      <HeaderActions>
        <div class="flex items-center gap-2">
          <BaseDateRangePicker @update:range="onDateRangeUpdate" />
          <Button size="sm" class="h-8">
            Download
          </Button>

          <Popover>
            <PopoverTrigger as-child>
              <Button size="sm" variant="outline" class="h-8 w-8 px-0" title="Dashboard Widgets">
                <Icon name="i-lucide-layout-grid" class="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-64 p-2">
              <div class="space-y-1">
                <p class="text-xs font-semibold text-muted-foreground px-2 py-1.5 mb-1 uppercase tracking-wider">
                  Dashboard Widgets
                </p>
                <div class="max-h-64 overflow-y-auto pr-1">
                  <button
                    v-for="widget in WIDGETS_MANIFEST.filter(w => availableWidgets.includes(w.id))"
                    :key="widget.id"
                    class="w-full flex items-center justify-between px-2 py-2 rounded-md transition-colors hover:bg-muted text-sm font-medium"
                    @click="toggleWidget(widget.id)"
                  >
                    <div class="flex items-center gap-2.5">
                      <Icon :name="widget.icon" class="size-4 text-muted-foreground" />
                      {{ widget.title }}
                    </div>
                    <Switch
                      :checked="displayedWidgets.includes(widget.id)"
                      class="pointer-events-none scale-75"
                    />
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </HeaderActions>
    </ClientOnly>

    <main class="@container/main flex flex-1 flex-col">
      <!-- ═══════════════════  WIDGETS LAYOUT  ═══════════════════ -->
      <ClientOnly>
        <draggable
          v-model="displayedWidgets"
          item-key="id"
          animation="200"
          ghost-class="opacity-50"
          handle=".cursor-move"
          class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4"
        >
          <template #item="{ element: widgetId }">
            <div
              :class="[
                widgetId === 'auction_trends' ? 'col-span-1 @xl/main:col-span-2 @5xl/main:col-span-4' : '',
                widgetId === 'dealers_overview' ? 'col-span-1 @xl/main:col-span-2 @5xl/main:col-span-2' : '',
              ]"
              class="relative group/widget"
            >
              <!-- Drag Handle Overlay -->
              <div class="absolute top-2 right-2 z-10 opacity-0 group-hover/widget:opacity-100 transition-opacity flex items-center gap-1">
                <div class="cursor-move bg-background/80 backdrop-blur border rounded-md p-1 border-dashed shadow-xs hover:bg-muted text-muted-foreground hover:text-foreground">
                  <Icon name="i-lucide-grip-horizontal" class="size-4" />
                </div>
              </div>

              <!-- 1 ─ Auctions Closed (Sales Revenue) -->
              <Card v-if="widgetId === 'auctions_closed'" class="@container/card group relative overflow-hidden h-full">
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-emerald-500/10" />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-emerald-500/10 p-1.5">
                      <Icon name="i-lucide-banknote" class="size-3.5 text-emerald-500" />
                    </div>
                    Total Sales Revenue
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-32 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow
                        :value="kpi.auctionsClosed"
                        :format="{ style: 'currency', currency: 'INR', maximumFractionDigits: 0 }"
                      />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant="outline"
                      :class="[
                        auctionsClosedChange >= 0
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
                      ]"
                    >
                      <ArrowUpRight v-if="auctionsClosedChange >= 0" class="size-3.5" />
                      <ArrowDownRight v-else class="size-3.5" />
                      {{ auctionsClosedChange >= 0 ? '+' : '' }}{{ auctionsClosedChange.toFixed(1) }}%
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="flex-col items-start gap-1.5 text-sm">
                  <div class="line-clamp-1 flex gap-2 font-medium">
                    {{ auctionsFooterMsg }}
                    <TrendingUp v-if="auctionsClosedChange >= 0" class="size-4 text-emerald-500" />
                    <TrendingDown v-else class="size-4 text-red-500" />
                  </div>
                  <div class="text-muted-foreground">
                    {{ auctionsFooterSub }}
                  </div>
                </CardFooter>
              </Card>

              <!-- LEAD FUNNEL WIDGET -->
              <Card v-else-if="widgetId === 'total_leads'" class="@container/card group relative overflow-hidden h-full">
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-fuchsia-500/10" />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-fuchsia-500/10 p-1.5">
                      <Icon name="i-lucide-activity" class="size-3.5 text-fuchsia-500" />
                    </div>
                    Active Lead Pipeline
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-32 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow :value="kpi.totalLeads" />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" class="border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
                      <Icon name="i-lucide-target" class="size-3.5 mr-1" />
                      Acquisition
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="flex-col items-start gap-1.5 text-sm">
                  <div class="line-clamp-1 flex gap-2 font-medium">
                    Strong incoming volume
                    <TrendingUp class="size-4 text-fuchsia-500" />
                  </div>
                  <div class="text-muted-foreground">
                    Total aggregated pipeline source
                  </div>
                </CardFooter>
              </Card>

              <!-- 2 ─ New Customers -->
              <Card v-else-if="widgetId === 'new_customers'" class="@container/card group relative overflow-hidden h-full">
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-blue-500/10" />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-blue-500/10 p-1.5">
                      <Users class="size-3.5 text-blue-500" />
                    </div>
                    New Customers
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-32 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow
                        :value="kpi.newCustomers"
                      />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant="outline"
                      :class="[
                        newCustomersChange >= 0
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
                      ]"
                    >
                      <ArrowUpRight v-if="newCustomersChange >= 0" class="size-3.5" />
                      <ArrowDownRight v-else class="size-3.5" />
                      {{ newCustomersChange >= 0 ? '+' : '' }}{{ newCustomersChange.toFixed(1) }}%
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="flex-col items-start gap-1.5 text-sm">
                  <div class="line-clamp-1 flex gap-2 font-medium">
                    {{ customersFooterMsg }}
                    <TrendingUp v-if="newCustomersChange >= 0" class="size-4 text-blue-500" />
                    <TrendingDown v-else class="size-4 text-red-500" />
                  </div>
                  <div class="text-muted-foreground">
                    {{ customersFooterSub }}
                  </div>
                </CardFooter>
              </Card>

              <!-- 3 ─ Active Accounts -->
              <Card v-else-if="widgetId === 'active_accounts'" class="@container/card group relative overflow-hidden h-full">
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-violet-500/10" />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-violet-500/10 p-1.5">
                      <Car class="size-3.5 text-violet-500" />
                    </div>
                    Active Accounts
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-32 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow
                        :value="kpi.activeAccounts"
                      />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant="outline"
                      class="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    >
                      <Users class="size-3.5" />
                      Approved
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="flex-col items-start gap-1.5 text-sm">
                  <div class="line-clamp-1 flex gap-2 font-medium">
                    {{ activeFooterMsg }}
                  </div>
                  <div class="text-muted-foreground">
                    Total approved dealers + customers
                  </div>
                </CardFooter>
              </Card>

              <!-- 4 ─ Growth Rate -->
              <Card v-else-if="widgetId === 'growth_rate'" class="@container/card group relative overflow-hidden h-full">
                <div
                  class="pointer-events-none absolute inset-0 transition-all duration-500"
                  :class="[
                    kpi.growthRateDirection === 'up'
                      ? 'bg-gradient-to-br from-amber-500/5 via-transparent to-transparent group-hover:from-amber-500/10'
                      : kpi.growthRateDirection === 'down'
                        ? 'bg-gradient-to-br from-red-500/5 via-transparent to-transparent group-hover:from-red-500/10'
                        : 'bg-gradient-to-br from-slate-500/5 via-transparent to-transparent group-hover:from-slate-500/10',
                  ]"
                />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div
                      class="flex items-center justify-center rounded-lg p-1.5"
                      :class="[
                        kpi.growthRateDirection === 'up' ? 'bg-amber-500/10' : kpi.growthRateDirection === 'down' ? 'bg-red-500/10' : 'bg-slate-500/10',
                      ]"
                    >
                      <BarChart3
                        class="size-3.5"
                        :class="[
                          kpi.growthRateDirection === 'up' ? 'text-amber-500' : kpi.growthRateDirection === 'down' ? 'text-red-500' : 'text-slate-500',
                        ]"
                      />
                    </div>
                    Growth Rate
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-32 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow
                        :value="Math.abs(kpi.growthRate)"
                        :format="{ maximumFractionDigits: 1 }"
                        suffix="%"
                      />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant="outline"
                      :class="[
                        kpi.growthRateDirection === 'up'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : kpi.growthRateDirection === 'down'
                            ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
                      ]"
                    >
                      <ArrowUpRight v-if="kpi.growthRateDirection === 'up'" class="size-3.5" />
                      <ArrowDownRight v-else-if="kpi.growthRateDirection === 'down'" class="size-3.5" />
                      <Minus v-else class="size-3.5" />
                      {{ kpi.growthRate >= 0 ? '+' : '' }}{{ kpi.growthRate.toFixed(1) }}%
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="flex-col items-start gap-1.5 text-sm">
                  <div class="line-clamp-1 flex gap-2 font-medium">
                    {{ growthFooterMsg }}
                    <TrendingUp v-if="kpi.growthRateDirection === 'up'" class="size-4 text-amber-500" />
                    <TrendingDown v-else-if="kpi.growthRateDirection === 'down'" class="size-4 text-red-500" />
                    <Minus v-else class="size-4 text-slate-500" />
                  </div>
                  <div class="text-muted-foreground">
                    {{ growthFooterSub }}
                  </div>
                </CardFooter>
              </Card>

              <!-- ═══════════════════  TREND CHART  ═══════════════════ -->
              <Card v-else-if="widgetId === 'auction_trends'" class="@container/card h-full">
                <CardHeader>
                  <CardTitle>Auction & Customer Trends</CardTitle>
                  <CardDescription>
                    <span class="hidden @[540px]/card:block">
                      Daily auction close amounts and new customer registrations
                    </span>
                    <span class="@[540px]/card:hidden">Daily trends</span>
                  </CardDescription>
                  <CardAction>
                    <ToggleGroup
                      v-model="timeRange"
                      type="single"
                      variant="outline"
                      class="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
                    >
                      <ToggleGroupItem value="90d">
                        All
                      </ToggleGroupItem>
                      <ToggleGroupItem value="30d">
                        Last 30 days
                      </ToggleGroupItem>
                      <ToggleGroupItem value="7d">
                        Last 7 days
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <Select v-model="timeRange">
                      <SelectTrigger
                        class="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                        size="sm"
                        aria-label="Select a value"
                      >
                        <SelectValue placeholder="Last 30 days" />
                      </SelectTrigger>
                      <SelectContent class="rounded-xl">
                        <SelectItem value="90d" class="rounded-lg">
                          All
                        </SelectItem>
                        <SelectItem value="30d" class="rounded-lg">
                          Last 30 days
                        </SelectItem>
                        <SelectItem value="7d" class="rounded-lg">
                          Last 7 days
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <template v-if="isLoading">
                    <div class="flex items-center justify-center h-64">
                      <div class="animate-pulse flex flex-col items-center gap-2 text-muted-foreground">
                        <div class="h-32 w-full bg-muted rounded-md" />
                        <span class="text-sm">Loading trend data...</span>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <DashboardTrends
                      :auction-data="auctionChartData"
                      :customer-data="customerChartData"
                      :time-range="timeRange"
                    />
                  </template>
                </CardContent>
              </Card>

              <!-- ═══════════════════  NEW WIDGETS ═══════════════════ -->
              <Card v-else-if="widgetId === 'total_dealers'" class="@container/card group relative h-full overflow-hidden">
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-indigo-500/10" />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-indigo-500/10 p-1.5">
                      <Contact class="size-3.5 text-indigo-500" />
                    </div>
                    Total Dealers
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-16 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow :value="kpi.totalDealers" />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" class="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Building2 class="size-3.5 mr-1" /> Network
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="text-sm text-muted-foreground flex gap-1 items-center">
                  Total registered dealers in DB
                </CardFooter>
              </Card>

              <Card v-else-if="widgetId === 'total_cars'" class="@container/card group relative h-full overflow-hidden">
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-purple-500/10" />
                <CardHeader>
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-purple-500/10 p-1.5">
                      <Car class="size-3.5 text-purple-500" />
                    </div>
                    Total Cars
                  </CardDescription>
                  <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    <template v-if="isLoading">
                      <div class="h-8 w-16 animate-pulse rounded-md bg-muted" />
                    </template>
                    <template v-else>
                      <NumberFlow :value="kpi.totalCars" />
                    </template>
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" class="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Car class="size-3.5 mr-1" /> Inventory
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter class="text-sm text-muted-foreground flex gap-1 items-center">
                  Total cars across all statuses
                </CardFooter>
              </Card>

              <Card v-else-if="widgetId === 'dealers_overview'" class="@container/card h-full flex flex-col">
                <CardHeader class="pb-3">
                  <CardDescription class="flex items-center gap-2">
                    <div class="flex items-center justify-center rounded-lg bg-cyan-500/10 p-1.5">
                      <Building2 class="size-3.5 text-cyan-500" />
                    </div>
                    Dealers Overview
                  </CardDescription>
                </CardHeader>
                <CardContent class="flex-1">
                  <template v-if="isLoading">
                    <div class="h-24 w-full animate-pulse rounded-md bg-muted" />
                  </template>
                  <template v-else>
                    <div class="grid grid-cols-3 gap-3 mb-4">
                      <div class="flex flex-col items-center justify-center bg-muted/20 border border-emerald-500/20 rounded-xl p-4 transition-all hover:bg-emerald-500/5 shadow-sm">
                        <span class="text-[11px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1.5"><CheckCircle2 class="text-emerald-500 size-3" /> Approved</span>
                        <span class="text-2xl font-bold mt-2 text-emerald-600 tabular-nums"><NumberFlow :value="dealersOverview.approved" /></span>
                      </div>
                      <div class="flex flex-col items-center justify-center bg-muted/20 border border-amber-500/20 rounded-xl p-4 transition-all hover:bg-amber-500/5 shadow-sm">
                        <span class="text-[11px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1.5"><Clock class="text-amber-500 size-3" /> Pending</span>
                        <span class="text-2xl font-bold mt-2 text-amber-600 tabular-nums"><NumberFlow :value="dealersOverview.pending" /></span>
                      </div>
                      <div class="flex flex-col items-center justify-center bg-muted/20 border border-rose-500/20 rounded-xl p-4 transition-all hover:bg-rose-500/5 shadow-sm">
                        <span class="text-[11px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1.5"><XCircle class="text-rose-500 size-3" /> Rejected</span>
                        <span class="text-2xl font-bold mt-2 text-rose-600 tabular-nums"><NumberFlow :value="dealersOverview.rejected" /></span>
                      </div>
                    </div>
                    <div class="space-y-2 overflow-hidden">
                      <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Recently Joined
                      </p>
                      <div v-for="dealer in dealersOverview.recent" :key="dealer.id" class="flex items-center justify-between p-3 px-4 rounded-xl bg-background/50 border hover:bg-accent/50 text-sm transition-all shadow-sm">
                        <div class="flex flex-col min-w-0 flex-1">
                          <span class="font-bold text-[13px] truncate">{{ dealer.dealershipName || dealer.userName || 'Unnamed Dealer' }}</span>
                          <span class="text-[11px] font-medium text-muted-foreground truncate">{{ dealer.email }} • {{ dealer.phoneNumber }}</span>
                        </div>
                        <Badge
                          variant="outline" class="text-[9px] uppercase tracking-widest px-1.5 shrink-0 ml-2"
                          :class="[
                            dealer.approvalStatus === 'approved' ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                            : dealer.approvalStatus === 'pending' ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                              : 'border-rose-500/40 text-rose-600 bg-rose-500/10',
                          ]"
                        >
                          {{ dealer.approvalStatus || 'pending' }}
                        </Badge>
                      </div>
                      <div v-if="dealersOverview.recent.length === 0" class="text-xs text-muted-foreground/60 text-center py-4 italic">
                        No dealers recorded.
                      </div>
                    </div>
                  </template>
                </CardContent>
              </Card>
            </div>
          </template>
        </draggable>

        <!-- Empty State -->
        <div v-if="displayedWidgets.length === 0" class="flex flex-col items-center justify-center p-12 py-24 border rounded-xl border-dashed mt-4">
          <Icon name="i-lucide-layout-dashboard" class="size-10 text-muted-foreground/50 mb-4" />
          <h3 class="text-lg font-medium">
            No Widgets Displayed
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            Click the Widgets button to add widgets to your dashboard.
          </p>
        </div>
      </ClientOnly>
    </main>
  </div>
</template>
