<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'

const period = ref('Q4 2026')

const kpis = ref({
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  debtToEquity: 0,
})

onMounted(() => {
  kpis.value = {
    totalAssets: 12850000,
    totalLiabilities: 4320000,
    totalEquity: 8530000,
    debtToEquity: 0.51,
  }
})

const currentAssets = [
  { name: 'Cash & Cash Equivalents', current: 2450000, prior: 2180000 },
  { name: 'Short-Term Investments', current: 890000, prior: 720000 },
  { name: 'Accounts Receivable', current: 1340000, prior: 1190000 },
  { name: 'Inventory', current: 980000, prior: 1050000 },
  { name: 'Prepaid Expenses', current: 145000, prior: 132000 },
]

const nonCurrentAssets = [
  { name: 'Property, Plant & Equipment', current: 4200000, prior: 3850000 },
  { name: 'Intangible Assets (Goodwill)', current: 1680000, prior: 1680000 },
  { name: 'Long-Term Investments', current: 890000, prior: 750000 },
  { name: 'Right-of-Use Assets', current: 275000, prior: 310000 },
]

const currentLiabilities = [
  { name: 'Accounts Payable', current: 760000, prior: 690000 },
  { name: 'Accrued Liabilities', current: 340000, prior: 295000 },
  { name: 'Short-Term Debt', current: 500000, prior: 450000 },
  { name: 'Current Portion of Long-Term Debt', current: 280000, prior: 260000 },
  { name: 'Deferred Revenue', current: 190000, prior: 165000 },
]

const nonCurrentLiabilities = [
  { name: 'Long-Term Debt', current: 1450000, prior: 1620000 },
  { name: 'Deferred Tax Liabilities', current: 380000, prior: 355000 },
  { name: 'Pension Obligations', current: 290000, prior: 275000 },
  { name: 'Lease Liabilities', current: 130000, prior: 160000 },
]

const equity = [
  { name: 'Common Stock', current: 2000000, prior: 2000000 },
  { name: 'Additional Paid-In Capital', current: 1500000, prior: 1500000 },
  { name: 'Retained Earnings', current: 4780000, prior: 4120000 },
  { name: 'Treasury Stock', current: -500000, prior: -350000 },
  { name: 'Accumulated Other Comprehensive Income', current: 750000, prior: 620000 },
]

const totalCurrent = computed(() => currentAssets.reduce((s, r) => s + r.current, 0))
const totalNonCurrent = computed(() => nonCurrentAssets.reduce((s, r) => s + r.current, 0))
const totalCurrentLiab = computed(() => currentLiabilities.reduce((s, r) => s + r.current, 0))
const totalNonCurrentLiab = computed(() => nonCurrentLiabilities.reduce((s, r) => s + r.current, 0))
const totalEquityCalc = computed(() => equity.reduce((s, r) => s + r.current, 0))

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function pctChange(current: number, prior: number) {
  if (prior === 0)
    return 0
  return ((current - prior) / Math.abs(prior) * 100)
}

const _compositionData = [
  { name: 'Current Assets', value: 5805000 },
  { name: 'Non-Current Assets', value: 7045000 },
]

const liabCompositionData = [
  { name: 'Current Liabilities', value: 2070000 },
  { name: 'Non-Current Liabilities', value: 2250000 },
  { name: 'Total Equity', value: 8530000 },
]

const trendData = [
  { quarter: 'Q1 2026', assets: 10200000, liabilities: 4800000, equity: 5400000 },
  { quarter: 'Q2 2026', assets: 10800000, liabilities: 4650000, equity: 6150000 },
  { quarter: 'Q3 2026', assets: 11300000, liabilities: 4500000, equity: 6800000 },
  { quarter: 'Q4 2026', assets: 11900000, liabilities: 4400000, equity: 7500000 },
  { quarter: 'Q1 2026', assets: 12100000, liabilities: 4380000, equity: 7720000 },
  { quarter: 'Q2 2026', assets: 12300000, liabilities: 4360000, equity: 7940000 },
  { quarter: 'Q3 2026', assets: 12600000, liabilities: 4340000, equity: 8260000 },
  { quarter: 'Q4 2026', assets: 12850000, liabilities: 4320000, equity: 8530000 },
]

const { setHeader } = usePageHeader()
setHeader({ title: 'Balance Sheet', icon: 'i-lucide-landmark', description: 'Assets · liabilities · equity position' })
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <!-- Period & Export -->
    <div class="flex items-center justify-end gap-2">
      <Select v-model="period">
        <SelectTrigger class="w-36">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Q4 2026">
            Q4 2026
          </SelectItem>
          <SelectItem value="Q3 2026">
            Q3 2026
          </SelectItem>
          <SelectItem value="Q2 2026">
            Q2 2026
          </SelectItem>
          <SelectItem value="Q1 2026">
            Q1 2026
          </SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline">
        <Icon name="i-lucide-download" class="mr-2 size-4" />
        Export
      </Button>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card class="@container/card">
        <CardHeader>
          <CardDescription>Total Assets</CardDescription>
          <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            <NumberFlow :value="kpis.totalAssets" :format="{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline" class="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <TrendingUp class="size-3" />
              +8.0%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter class="flex-col items-start gap-1 text-sm">
          <div class="flex gap-2 font-medium">
            Year-over-year growth <TrendingUp class="size-4 text-emerald-500" />
          </div>
          <div class="text-muted-foreground">
            vs. $11.9M in Q4 2026
          </div>
        </CardFooter>
      </Card>

      <Card class="@container/card">
        <CardHeader>
          <CardDescription>Total Liabilities</CardDescription>
          <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            <NumberFlow :value="kpis.totalLiabilities" :format="{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline" class="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <TrendingDown class="size-3" />
              -1.8%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter class="flex-col items-start gap-1 text-sm">
          <div class="flex gap-2 font-medium">
            Declining steadily <TrendingDown class="size-4 text-emerald-500" />
          </div>
          <div class="text-muted-foreground">
            Reduced by $80K from Q4 2026
          </div>
        </CardFooter>
      </Card>

      <Card class="@container/card">
        <CardHeader>
          <CardDescription>Shareholders' Equity</CardDescription>
          <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            <NumberFlow :value="kpis.totalEquity" :format="{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline" class="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <TrendingUp class="size-3" />
              +13.7%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter class="flex-col items-start gap-1 text-sm">
          <div class="flex gap-2 font-medium">
            Strong equity growth <TrendingUp class="size-4 text-emerald-500" />
          </div>
          <div class="text-muted-foreground">
            Equity ratio: 66.3%
          </div>
        </CardFooter>
      </Card>

      <Card class="@container/card">
        <CardHeader>
          <CardDescription>Debt-to-Equity Ratio</CardDescription>
          <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            <NumberFlow :value="kpis.debtToEquity" :format="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline" class="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <TrendingDown class="size-3" />
              -13%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter class="flex-col items-start gap-1 text-sm">
          <div class="flex gap-2 font-medium">
            Below 1.0 — well-leveraged <TrendingDown class="size-4 text-emerald-500" />
          </div>
          <div class="text-muted-foreground">
            Industry avg: 0.85
          </div>
        </CardFooter>
      </Card>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card class="xl:col-span-2">
        <CardHeader>
          <CardTitle>Balance Sheet Trend</CardTitle>
          <CardDescription>Assets, Liabilities & Equity over 8 quarters</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            :data="trendData"
            index="quarter"
            :categories="['assets', 'liabilities', 'equity']"
            :colors="['#3b82f6', '#ef4444', '#10b981']"
            :y-formatter="(v: number | Date) => `$${(Number(v) / 1000000).toFixed(1)}M`"
            class="h-[300px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capital Structure</CardTitle>
          <CardDescription>How the company is funded</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart
            :data="liabCompositionData"
            index="name"
            category="value"
            :colors="['#f59e0b', '#ef4444', '#10b981']"
            :value-formatter="(v: number) => `$${(v / 1000000).toFixed(1)}M`"
            class="h-[260px]"
          />
        </CardContent>
      </Card>
    </div>

    <!-- Balance Sheet Tables -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- ASSETS -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center rounded-lg bg-blue-500/10 p-2">
              <Icon name="i-lucide-landmark" class="size-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Assets</CardTitle>
              <CardDescription>What the company owns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <!-- Current Assets -->
          <div class="px-6 py-3 bg-muted/30 border-y">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Current Assets
            </h4>
          </div>
          <div class="divide-y">
            <div v-for="item in currentAssets" :key="item.name" class="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
              <span class="text-sm">{{ item.name }}</span>
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium tabular-nums">{{ fmt(item.current) }}</span>
                <Badge :variant="pctChange(item.current, item.prior) >= 0 ? 'outline' : 'destructive'" class="text-xs min-w-16 justify-center">
                  {{ pctChange(item.current, item.prior) >= 0 ? '+' : '' }}{{ pctChange(item.current, item.prior).toFixed(1) }}%
                </Badge>
              </div>
            </div>
            <div class="flex items-center justify-between px-6 py-3 bg-blue-500/5 font-semibold">
              <span class="text-sm">Total Current Assets</span>
              <span class="text-sm tabular-nums">{{ fmt(totalCurrent) }}</span>
            </div>
          </div>

          <!-- Non-Current Assets -->
          <div class="px-6 py-3 bg-muted/30 border-y">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Non-Current Assets
            </h4>
          </div>
          <div class="divide-y">
            <div v-for="item in nonCurrentAssets" :key="item.name" class="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
              <span class="text-sm">{{ item.name }}</span>
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium tabular-nums">{{ fmt(item.current) }}</span>
                <Badge :variant="pctChange(item.current, item.prior) >= 0 ? 'outline' : 'destructive'" class="text-xs min-w-16 justify-center">
                  {{ pctChange(item.current, item.prior) >= 0 ? '+' : '' }}{{ pctChange(item.current, item.prior).toFixed(1) }}%
                </Badge>
              </div>
            </div>
            <div class="flex items-center justify-between px-6 py-3 bg-blue-500/5 font-semibold">
              <span class="text-sm">Total Non-Current Assets</span>
              <span class="text-sm tabular-nums">{{ fmt(totalNonCurrent) }}</span>
            </div>
          </div>

          <!-- Grand Total -->
          <div class="flex items-center justify-between px-6 py-4 bg-blue-500/10 border-t-2 border-blue-500/30">
            <span class="font-bold">TOTAL ASSETS</span>
            <span class="font-bold text-lg tabular-nums">{{ fmt(totalCurrent + totalNonCurrent) }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- LIABILITIES & EQUITY -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center rounded-lg bg-rose-500/10 p-2">
              <Icon name="i-lucide-scale" class="size-5 text-rose-500" />
            </div>
            <div>
              <CardTitle>Liabilities & Equity</CardTitle>
              <CardDescription>How assets are financed</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <!-- Current Liabilities -->
          <div class="px-6 py-3 bg-muted/30 border-y">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Current Liabilities
            </h4>
          </div>
          <div class="divide-y">
            <div v-for="item in currentLiabilities" :key="item.name" class="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
              <span class="text-sm">{{ item.name }}</span>
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium tabular-nums">{{ fmt(item.current) }}</span>
                <Badge :variant="pctChange(item.current, item.prior) <= 0 ? 'outline' : 'destructive'" class="text-xs min-w-16 justify-center">
                  {{ pctChange(item.current, item.prior) >= 0 ? '+' : '' }}{{ pctChange(item.current, item.prior).toFixed(1) }}%
                </Badge>
              </div>
            </div>
            <div class="flex items-center justify-between px-6 py-3 bg-rose-500/5 font-semibold">
              <span class="text-sm">Total Current Liabilities</span>
              <span class="text-sm tabular-nums">{{ fmt(totalCurrentLiab) }}</span>
            </div>
          </div>

          <!-- Non-Current Liabilities -->
          <div class="px-6 py-3 bg-muted/30 border-y">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Non-Current Liabilities
            </h4>
          </div>
          <div class="divide-y">
            <div v-for="item in nonCurrentLiabilities" :key="item.name" class="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
              <span class="text-sm">{{ item.name }}</span>
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium tabular-nums">{{ fmt(item.current) }}</span>
                <Badge :variant="pctChange(item.current, item.prior) <= 0 ? 'outline' : 'destructive'" class="text-xs min-w-16 justify-center">
                  {{ pctChange(item.current, item.prior) >= 0 ? '+' : '' }}{{ pctChange(item.current, item.prior).toFixed(1) }}%
                </Badge>
              </div>
            </div>
            <div class="flex items-center justify-between px-6 py-3 bg-rose-500/5 font-semibold">
              <span class="text-sm">Total Non-Current Liabilities</span>
              <span class="text-sm tabular-nums">{{ fmt(totalNonCurrentLiab) }}</span>
            </div>
          </div>

          <!-- Equity -->
          <div class="px-6 py-3 bg-muted/30 border-y">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Shareholders' Equity
            </h4>
          </div>
          <div class="divide-y">
            <div v-for="item in equity" :key="item.name" class="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
              <span class="text-sm">{{ item.name }}</span>
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium tabular-nums" :class="item.current < 0 ? 'text-destructive' : ''">{{ fmt(item.current) }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between px-6 py-3 bg-emerald-500/5 font-semibold">
              <span class="text-sm">Total Equity</span>
              <span class="text-sm tabular-nums">{{ fmt(totalEquityCalc) }}</span>
            </div>
          </div>

          <!-- Grand Total -->
          <div class="flex items-center justify-between px-6 py-4 bg-rose-500/10 border-t-2 border-rose-500/30">
            <span class="font-bold">TOTAL LIABILITIES & EQUITY</span>
            <span class="font-bold text-lg tabular-nums">{{ fmt(totalCurrentLiab + totalNonCurrentLiab + totalEquityCalc) }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
