export function useApiEnvironment() {
  const config = useRuntimeConfig()

  const currentEnv = computed({
    get: () => 'production' as const,
    set: () => {},
  })

  const apiBaseUrl = computed(() => {
    return config.public.apiBaseUrlProduction as string
  })

  const envLabel = computed(() => 'Production')
  const envColor = computed(() => 'text-emerald-500')

  function setEnvironment() {
    // No-op: only production is supported
  }

  return {
    currentEnv,
    apiBaseUrl,
    envLabel,
    envColor,
    setEnvironment,
    ENV_LABELS: { production: 'Production' },
    ENV_COLORS: { production: 'text-emerald-500' },
  }
}
