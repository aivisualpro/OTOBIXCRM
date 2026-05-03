/**
 * Shared composable for persisting car simulations (Margin % + CEP value) to MongoDB.
 * Both retail and admin table pages use this to load/save/clear simulations.
 */
export function useCarSimulations() {
  const _userCookie = useCookie('userData')
  const userId = computed(() => {
    try {
      const parsed = typeof _userCookie.value === 'string' ? JSON.parse(_userCookie.value) : _userCookie.value
      return parsed?._id || parsed?.id || ''
    }
    catch { return '' }
  })

  // Loaded simulations map: { [carId]: { marginSimulation, cepSimulation } }
  const simulations = ref<Record<string, { marginSimulation?: string, cepSimulation?: number }>>({})
  const isLoaded = ref(false)

  async function loadSimulations() {
    if (!userId.value) return
    try {
      const res = await $fetch<any>('/api/car-simulations', {
        params: { userId: userId.value },
      })
      if (res?.success && res.simulations) {
        simulations.value = res.simulations
      }
      isLoaded.value = true
    }
    catch (err) {
      console.warn('[CarSimulations] Failed to load:', err)
      isLoaded.value = true
    }
  }

  /**
   * Apply loaded simulations to an array of car objects.
   * Sets car.marginSimulation and car._cepSimulation from persisted data.
   */
  function hydrateSimulations(cars: any[]) {
    if (!isLoaded.value) return
    for (const car of cars) {
      const key = String(car._id || car.id)
      const saved = simulations.value[key]
      if (!saved) continue
      if (saved.marginSimulation !== undefined && saved.marginSimulation !== null && saved.marginSimulation !== '') {
        car.marginSimulation = saved.marginSimulation
      }
      if (saved.cepSimulation !== undefined && saved.cepSimulation !== null) {
        car._cepSimulation = saved.cepSimulation
      }
    }
  }

  /** Persist simulation state for a single car to the server (fire-and-forget). */
  function saveSimulation(car: any) {
    if (!userId.value) return
    const carId = String(car._id || car.id)

    const marginSim = car.marginSimulation
    const cepSim = car._cepSimulation

    // Update local cache
    if ((marginSim !== undefined && marginSim !== null && marginSim !== '') || (cepSim !== undefined && cepSim !== null && cepSim !== '')) {
      simulations.value[carId] = {
        marginSimulation: marginSim,
        cepSimulation: cepSim,
      }
    }
    else {
      delete simulations.value[carId]
    }

    // Fire-and-forget POST
    $fetch('/api/car-simulations', {
      method: 'POST',
      body: {
        userId: userId.value,
        carId,
        marginSimulation: marginSim ?? null,
        cepSimulation: cepSim ?? null,
      },
    }).catch(err => console.warn('[CarSimulations] Save failed:', err))
  }

  /** Clear all simulations for a car from the server. */
  function deleteSimulation(car: any) {
    if (!userId.value) return
    const carId = String(car._id || car.id)
    delete simulations.value[carId]

    $fetch('/api/car-simulations', {
      method: 'DELETE',
      params: { userId: userId.value, carId },
    }).catch(err => console.warn('[CarSimulations] Delete failed:', err))
  }

  return {
    userId,
    simulations,
    isLoaded,
    loadSimulations,
    hydrateSimulations,
    saveSimulation,
    deleteSimulation,
  }
}
