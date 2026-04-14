// ─── Car Details API ───
// Fetches full inspection details for a single vehicle by appointmentId

interface CarDetailsResponse {
  carDetails: Record<string, any>
}

export function useCarDetails() {
  const { apiBaseUrl: _apiBaseUrl } = useApiEnvironment()
  const _authToken = useCookie('authToken')

  const carDetails = ref<Record<string, any> | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCarDetails(carId: string, silent = false) {
    if (!silent) isLoading.value = true
    error.value = null

    try {
      const ts = Date.now()
      const response = await $fetch<CarDetailsResponse>(`/api/leads/${carId}?t=${ts}`, {
        retry: 0,
        timeout: 15000,
      })

      carDetails.value = response.carDetails || response
    }
    catch (err: any) {
      console.error('Failed to fetch car details:', err)
      error.value = err?.data?.message || err?.message || 'Failed to fetch car details'
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    carDetails,
    isLoading,
    error,
    fetchCarDetails,
  }
}
