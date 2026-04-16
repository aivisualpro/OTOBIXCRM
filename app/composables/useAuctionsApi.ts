export interface AuctionCar {
  [key: string]: any
  id: string
  _id?: string
  appointmentId: string
  imageUrl: string
  make: string
  model: string
  variant: string
  priceDiscovery: number
  yearMonthOfManufacture: string
  odometerReadingInKms: number
  ownerSerialNumber: number
  fuelType: string
  registrationNumber: string
  registeredRto: string
  registrationState: string
  registrationDate: string
  city: string
  isInspected: boolean
  cubicCapacity: number
  oneClickPrice: number
  otobuyOffer: number
  soldAt: number
  highestBid: number
  highestBidder: string
  auctionStartTime: string
  auctionEndTime: string
  auctionDuration: number
  auctionStatus: string
  upcomingTime: string | null
  upcomingUntil: string
  liveAt: string
  soldTo: string | null
  soldToName: string
  customerExpectedPrice: number
  imageUrls: { title: string, url: string }[]
  autoBidsForLiveSection?: any[]
}

export function useAuctionsApi() {
  const _allCars = useState<AuctionCar[]>('auctions_data', () => [])
  const _isFetched = useState('auctions_isFetched', () => false)
  const _isFetching = useState('auctions_isFetching', () => false)
  const _fetchError = useState<string | null>('auctions_fetchError', () => null)
  const globalSearch = useState<string>('auctions_globalSearch', () => '')

  const { apiBaseUrl: _apiBaseUrl } = useApiEnvironment()
  const _authToken = useCookie('authToken')

  /** Fetch all cars from the API (runs only once, cached globally) */
  async function fetchAllCars(force = false) {
    if (_isFetched.value && !force)
      return
    if (_isFetching.value && !force)
      return

    _isFetching.value = true
    _fetchError.value = null

    try {
      const ts = Date.now()
      const response = await $fetch<any>(`/api/cars?t=${ts}`, { method: 'GET' })

      // Extract cars array from response
      const carsArray = Array.isArray(response)
        ? response
        : response?.cars || response?.data || []

      // Normalize: ensure id field
      _allCars.value = carsArray.map((item: any) => ({
        ...item,
        id: item.id || item._id,
      }))

      _isFetched.value = true
    }
    catch (err: any) {
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch cars'
      _allCars.value = []
    }
    finally {
      _isFetching.value = false
    }
  }

  /** Force re-fetch */
  async function refreshCars() {
    await fetchAllCars(true)
  }

  // ─── Quick Sync Engine ───
  // Polls a lightweight timestamp endpoint every 15s.
  // If any user on any device changed a car record, silently refetch.
  const _lastKnownTs = useState('auctions_lastKnownTs', () => 0)
  let _quickSyncInterval: ReturnType<typeof setInterval> | null = null

  async function _checkForUpdates() {
    try {
      const res = await $fetch<{ ts: number }>(`/api/cars/last-updated?t=${Date.now()}`)
      if (res.ts && _lastKnownTs.value > 0 && res.ts > _lastKnownTs.value) {
        // Something changed — silently refetch
        await fetchAllCars(true)
      }
      if (res.ts) {
        _lastKnownTs.value = res.ts
      }
    }
    catch {
      // Silent fail — will retry next interval
    }
  }

  function startQuickSync() {
    if (_quickSyncInterval) return
    // Set initial timestamp
    _checkForUpdates()
    // Poll every 15 seconds
    _quickSyncInterval = setInterval(_checkForUpdates, 5000)
  }

  function stopQuickSync() {
    if (_quickSyncInterval) {
      clearInterval(_quickSyncInterval)
      _quickSyncInterval = null
    }
  }

  return {
    allCars: _allCars,
    isLoading: _isFetching,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchAllCars,
    refreshCars,
    globalSearch,
    startQuickSync,
    stopQuickSync,
  }
}
