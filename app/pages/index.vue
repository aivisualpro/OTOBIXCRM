<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Car,
  Gavel,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-vue-next'

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
setHeader({ title: 'Dashboard', icon: 'i-lucide-layout-dashboard', description: 'Overview of key metrics and performance' })
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <ClientOnly>
      <Teleport to="#header-actions">
        <div class="flex items-center gap-2">
          <BaseDateRangePicker @update:range="onDateRangeUpdate" />
          <Button size="sm" class="h-8">
            Download
          </Button>
        </div>
      </Teleport>
    </ClientOnly>

    <main class="@container/main flex flex-1 flex-col gap-4 md:gap-8">
      <!-- ═══════════════════  KPI CARDS  ═══════════════════ -->
      <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <!-- 1 ─ Auctions Closed -->
        <Card class="@container/card group relative overflow-hidden">
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent transition-all duration-500 group-hover:from-emerald-500/10" />
          <CardHeader>
            <CardDescription class="flex items-center gap-2">
              <div class="flex items-center justify-center rounded-lg bg-emerald-500/10 p-1.5">
                <Gavel class="size-3.5 text-emerald-500" />
              </div>
              Auctions Closed
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

        <!-- 2 ─ New Customers -->
        <Card class="@container/card group relative overflow-hidden">
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
        <Card class="@container/card group relative overflow-hidden">
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
        <Card class="@container/card group relative overflow-hidden">
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
      </div>

      <!-- ═══════════════════  TREND CHART  ═══════════════════ -->
      <Card class="@container/card">
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
    </main>
  </div>
</template>
