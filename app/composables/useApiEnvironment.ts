export type ApiEnvironment = 'production' | 'development' | 'staging'

const ENV_LABELS: Record<ApiEnvironment, string> = {
  production: 'Production',
  development: 'Development',
  staging: 'Kong / Staging',
}

const ENV_COLORS: Record<ApiEnvironment, string> = {
  production: 'text-emerald-500',
  development: 'text-amber-500',
  staging: 'text-violet-500',
}

export function useApiEnvironment() {
  const config = useRuntimeConfig()
  const envCookie = useCookie<ApiEnvironment>('apiEnvironment', {
    maxAge: 365 * 24 * 60 * 60, // 1 year
    default: () => 'production',
  })

  const currentEnv = computed({
    get: () => envCookie.value || 'production',
    set: (v: ApiEnvironment) => { envCookie.value = v },
  })

  const apiBaseUrl = computed(() => {
    if (currentEnv.value === 'development')
      return config.public.apiBaseUrlDevelopment as string
    if (currentEnv.value === 'staging')
      return config.public.apiBaseUrlStaging as string
    // 'production' default
    return config.public.apiBaseUrlProduction as string
  })

  const envLabel = computed(() => ENV_LABELS[currentEnv.value])
  const envColor = computed(() => ENV_COLORS[currentEnv.value])

  function setEnvironment(env: ApiEnvironment) {
    currentEnv.value = env
  }

  return {
    currentEnv,
    apiBaseUrl,
    envLabel,
    envColor,
    setEnvironment,
    ENV_LABELS,
    ENV_COLORS,
  }
}
