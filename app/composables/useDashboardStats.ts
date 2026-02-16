import type { Ref } from 'vue'

export interface DashboardDateRange {
  start: Date
  end: Date
}

export interface DashboardKpi {
  auctionsClosed: number // Sum of soldAt for sold auctions in the period
  auctionsClosedCount: number // Number of sold auctions in the period
  auctionsClosedPrev: number // Sum of soldAt for previous period
  auctionsClosedCountPrev: number // Number of sold auctions in previous period

  newCustomers: number // New customers joined in the period
  newCustomersPrev: number // New customers joined in previous period

  activeAccounts: number // Total approved dealers + customers (all time)
  activeAccountsDealers: number // Approved dealers count
  activeAccountsCustomers: number // Approved customers count

  growthRate: number // % change: (current - prev) / prev * 100
  growthRateDirection: 'up' | 'down' | 'flat'
}

/**
 * Determines if a date string falls within [start, end] range
 */
function isDateInRange(dateStr: string | null | undefined, start: Date, end: Date): boolean {
  if (!dateStr)
    return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime()))
    return false
  return d >= start && d <= end
}

/**
 * Calculate the "previous period" of equal length ending right before the current start
 */
function getPreviousPeriod(start: Date, end: Date): { prevStart: Date, prevEnd: Date } {
  const durationMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1) // 1ms before start
  const prevStart = new Date(prevEnd.getTime() - durationMs)
  return { prevStart, prevEnd }
}

/**
 * Compute percentage change from prev to current
 */
function percentChange(current: number, prev: number): number {
  if (prev === 0 && current === 0)
    return 0
  if (prev === 0)
    return 100 // from 0 → any = 100% growth
  return ((current - prev) / prev) * 100
}

export function useDashboardStats(dateRange: Ref<DashboardDateRange>) {
  const { allCars, fetchAllCars, isLoading: carsLoading } = useAuctionsApi()
  const { allUsers, fetchAllUsers, isLoading: usersLoading } = usePeopleApi()

  const isLoading = computed(() => carsLoading.value || usersLoading.value)

  // Fetch data on mount
  onMounted(async () => {
    await Promise.all([fetchAllCars(), fetchAllUsers()])
  })

  // ─── Sold auctions (filtered by auctionEndTime) ───
  const soldCarsInPeriod = computed(() => {
    const { start, end } = dateRange.value
    return allCars.value.filter(
      car => car.auctionStatus === 'sold' && isDateInRange(car.auctionEndTime, start, end),
    )
  })

  const soldCarsInPrevPeriod = computed(() => {
    const { start, end } = dateRange.value
    const { prevStart, prevEnd } = getPreviousPeriod(start, end)
    return allCars.value.filter(
      car => car.auctionStatus === 'sold' && isDateInRange(car.auctionEndTime, prevStart, prevEnd),
    )
  })

  // ─── Customers (filtered by createdAt = "Joined" date) ───
  const allCustomers = computed(() =>
    allUsers.value.filter(u => u.userRole === 'Customer'),
  )

  const customersInPeriod = computed(() => {
    const { start, end } = dateRange.value
    return allCustomers.value.filter(
      u => isDateInRange(u.createdAt, start, end),
    )
  })

  const customersInPrevPeriod = computed(() => {
    const { start, end } = dateRange.value
    const { prevStart, prevEnd } = getPreviousPeriod(start, end)
    return allCustomers.value.filter(
      u => isDateInRange(u.createdAt, prevStart, prevEnd),
    )
  })

  // ─── Active accounts: approved dealers + approved customers ───
  const approvedDealers = computed(() =>
    allUsers.value.filter(u => u.userRole === 'Dealer' && u.approvalStatus === 'approved'),
  )
  const approvedCustomers = computed(() =>
    allUsers.value.filter(u => u.userRole === 'Customer' && u.approvalStatus === 'approved'),
  )

  // ─── KPI aggregate ───
  const kpi = computed<DashboardKpi>(() => {
    const auctionsClosed = soldCarsInPeriod.value.reduce((sum, c) => sum + (c.soldAt || 0), 0)
    const auctionsClosedCount = soldCarsInPeriod.value.length
    const auctionsClosedPrev = soldCarsInPrevPeriod.value.reduce((sum, c) => sum + (c.soldAt || 0), 0)
    const auctionsClosedCountPrev = soldCarsInPrevPeriod.value.length

    const newCustomers = customersInPeriod.value.length
    const newCustomersPrev = customersInPrevPeriod.value.length

    const activeAccounts = approvedDealers.value.length + approvedCustomers.value.length

    const growthRate = percentChange(auctionsClosed, auctionsClosedPrev)
    const growthRateDirection: 'up' | 'down' | 'flat'
      = growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'flat'

    return {
      auctionsClosed,
      auctionsClosedCount,
      auctionsClosedPrev,
      auctionsClosedCountPrev,
      newCustomers,
      newCustomersPrev,
      activeAccounts,
      activeAccountsDealers: approvedDealers.value.length,
      activeAccountsCustomers: approvedCustomers.value.length,
      growthRate,
      growthRateDirection,
    }
  })

  // ─── Per-card % change helpers ───
  const auctionsClosedChange = computed(() =>
    percentChange(kpi.value.auctionsClosed, kpi.value.auctionsClosedPrev),
  )
  const newCustomersChange = computed(() =>
    percentChange(kpi.value.newCustomers, kpi.value.newCustomersPrev),
  )

  // ─── Chart data: daily auction closed amounts in the period ───
  const auctionChartData = computed(() => {
    const { start, end } = dateRange.value
    const dayMap = new Map<string, { date: string, amount: number, count: number }>()

    // Create empty days for the full range
    const current = new Date(start)
    // eslint-disable-next-line no-unmodified-loop-condition -- `current` is mutated via setDate()
    while (current <= end) {
      const key = current.toISOString().slice(0, 10)
      dayMap.set(key, { date: key, amount: 0, count: 0 })
      current.setDate(current.getDate() + 1)
    }

    // Fill in sold auction values
    soldCarsInPeriod.value.forEach((car) => {
      if (!car.auctionEndTime)
        return
      const key = new Date(car.auctionEndTime).toISOString().slice(0, 10)
      const entry = dayMap.get(key)
      if (entry) {
        entry.amount += (car.soldAt || 0)
        entry.count += 1
      }
    })

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  })

  // ─── Chart data: daily new customers in the period ───
  const customerChartData = computed(() => {
    const { start, end } = dateRange.value
    const dayMap = new Map<string, { date: string, count: number }>()

    const current = new Date(start)
    // eslint-disable-next-line no-unmodified-loop-condition -- `current` is mutated via setDate()
    while (current <= end) {
      const key = current.toISOString().slice(0, 10)
      dayMap.set(key, { date: key, count: 0 })
      current.setDate(current.getDate() + 1)
    }

    customersInPeriod.value.forEach((u) => {
      if (!u.createdAt)
        return
      const key = new Date(u.createdAt).toISOString().slice(0, 10)
      const entry = dayMap.get(key)
      if (entry) {
        entry.count += 1
      }
    })

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  })

  return {
    isLoading,
    kpi,
    auctionsClosedChange,
    newCustomersChange,
    auctionChartData,
    customerChartData,
    soldCarsInPeriod,
    customersInPeriod,
  }
}
