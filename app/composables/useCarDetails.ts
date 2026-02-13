// ─── Car Details API ───
// Fetches full inspection details for a single vehicle by appointmentId

interface CarDetailsResponse {
  carDetails: Record<string, any>
}

export function useCarDetails() {
  const config = useRuntimeConfig()
  const authToken = useCookie('authToken')

  const carDetails = ref<Record<string, any> | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCarDetails(carId: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<CarDetailsResponse>(
        `${config.public.apiBaseUrl}car/details/carId`,
        {
          method: 'GET',
          params: { appointmentId: carId },
          headers: {
            ...(authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}),
          },
        },
      )

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
