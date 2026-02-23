export interface TelecallingLead {
  [key: string]: any
  _id: string
  id: string
  appointmentId: string
  carRegistrationNumber: string
  yearOfRegistration: string
  ownerName: string
  ownershipSerialNumber: number
  make: string
  model: string
  variant: string
  emailAddress: string
  appointmentSource: string
  vehicleStatus: string
  zipCode: string
  customerContactNumber: string
  city: string
  yearOfManufacture: string
  allocatedTo: string
  inspectionStatus: string
  approvalStatus: string
  priority: string
  ncdUcdName: string
  repName: string
  repContact: string
  bankSource: string
  referenceName: string
  remarks: string
  createdBy: string
  odometerReadingInKms: number
  additionalNotes: string
  carImages: string[]
  inspectionDateTime: string
  inspectionAddress: string
  inspectionEngineerNumber: string
  addedBy: string
  timeStamp: string
  createdAt: string
  updatedAt: string
}

interface ApiResponse {
  data: TelecallingLead[]
  total?: number
  totalCount?: number
  totalPages?: number
  page?: number
  limit?: number
}

// ─── Global cache: fetch once, reuse across all route views ───
const _allLeads = ref<TelecallingLead[]>([])
const _isFetched = ref(false)
const _isFetching = ref(false)
const _fetchError = ref<string | null>(null)

export function useLeadsApi() {
  const { apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  /** Fetch all leads from the API (runs only once, cached globally) */
  async function fetchAllLeads(force = false) {
    // Skip if already fetched & not forced
    if (_isFetched.value && !force)
      return
    // Skip if another call is already in-flight
    if (_isFetching.value && !force)
      return

    _isFetching.value = true
    _fetchError.value = null

    try {
      // Fetch first page with a reasonable limit for fast initial load
      const response = await $fetch<ApiResponse>(
        `${apiBaseUrl.value}admin/telecallings/get-list`,
        {
          method: 'GET',
          params: { page: 1, limit: 500 },
          headers: {
            ...(authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}),
          },
          signal: AbortSignal.timeout(60_000), // 60s timeout for cold-start APIs
        },
      )

      // Extract the leads array from whatever shape the API returns
      const responseData = (response as any)?.data || response
      const leadsArray = Array.isArray(responseData) ? responseData : responseData?.data || []

      // Normalize: map _id → id
      _allLeads.value = leadsArray.map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }))

      _isFetched.value = true

      // If there are more pages, fetch them in the background
      const totalCount = (response as any)?.totalCount || (response as any)?.total || 0
      if (totalCount > 500) {
        const totalPages = Math.ceil(totalCount / 500)
        for (let page = 2; page <= totalPages; page++) {
          try {
            const nextPage = await $fetch<ApiResponse>(
              `${apiBaseUrl.value}admin/telecallings/get-list`,
              {
                method: 'GET',
                params: { page, limit: 500 },
                headers: {
                  ...(authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}),
                },
              },
            )
            const nextData = (nextPage as any)?.data || nextPage
            const nextArray = Array.isArray(nextData) ? nextData : nextData?.data || []
            _allLeads.value = [
              ..._allLeads.value,
              ...nextArray.map((item: any) => ({ ...item, id: item._id || item.id })),
            ]
          }
          catch { break }
        }
      }
    }
    catch (err: any) {
      console.error('Failed to fetch leads:', err)
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch leads'
      _allLeads.value = []
    }
    finally {
      _isFetching.value = false
    }
  }

  /** Force re-fetch (e.g. after create/edit/delete or manual refresh) */
  async function refreshLeads() {
    await fetchAllLeads(true)
  }

  return {
    allLeads: _allLeads,
    isLoading: _isFetching,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchAllLeads,
    refreshLeads,
  }
}
