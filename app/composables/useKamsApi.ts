export interface Kam {
  [key: string]: any
  _id: string
  id: string
  name: string
  email: string
  phoneNumber: string
  region: string
  createdAt?: string
  updatedAt?: string
}

// ─── Global cache ───
const _allKams = ref<Kam[]>([])
const _isFetched = ref(false)
const _isFetching = ref(false)
const _fetchError = ref<string | null>(null)

export function useKamsApi() {
  const { apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  function headers(): Record<string, string> {
    const h: Record<string, string> = {}
    if (authToken.value)
      h.Authorization = `Bearer ${authToken.value}`
    return h
  }

  /** Fetch all KAMs */
  async function fetchKams(force = false) {
    if (_isFetched.value && !force)
      return
    if (_isFetching.value && !force)
      return

    _isFetching.value = true
    _fetchError.value = null

    try {
      const response = await $fetch<any>(
        `${apiBaseUrl.value}admin/kams/get-list`,
        { method: 'GET', headers: headers() },
      )

      const kamsArray = Array.isArray(response)
        ? response
        : response?.kams || response?.data || []

      _allKams.value = kamsArray.map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }))

      _isFetched.value = true
    }
    catch (err: any) {
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch KAMs'
      _allKams.value = []
    }
    finally {
      _isFetching.value = false
    }
  }

  /** Force re-fetch */
  async function refreshKams() {
    await fetchKams(true)
  }

  /** Create KAM */
  async function createKam(payload: { name: string, email: string, phoneNumber: string, region: string }) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}admin/kams/create`,
      { method: 'POST', headers: headers(), body: payload },
    )
    await refreshKams()
    return response
  }

  /** Update KAM */
  async function updateKam(payload: { id: string, name: string, email: string, phoneNumber: string, region: string }) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}admin/kams/update`,
      { method: 'PUT', headers: headers(), body: payload },
    )
    await refreshKams()
    return response
  }

  /** Delete KAM */
  async function deleteKam(id: string) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}admin/kams/delete`,
      { method: 'POST', headers: headers(), body: { id } },
    )
    await refreshKams()
    return response
  }

  /** Assign KAM to Dealer */
  async function assignKamToDealer(kamId: string, dealerId: string) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}admin/kams/assign-to-dealer`,
      { method: 'POST', headers: headers(), body: { kamId, dealerId } },
    )
    return response
  }

  return {
    allKams: _allKams,
    isLoading: _isFetching,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchKams,
    refreshKams,
    createKam,
    updateKam,
    deleteKam,
    assignKamToDealer,
  }
}
