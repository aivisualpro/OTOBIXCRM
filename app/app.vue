<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
const color = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')
const { theme } = useAppSettings()
const { currentEnv: _currentEnv } = useApiEnvironment()

// ─── Smart Prefetch Engine ───
// Eagerly load leads + people + car data in background after app boot
const { bootPrefetch } = usePrefetch()

// ─── Live Sync Engine ───
// Real-time data sync across all connected browsers via SSE
const { startLiveSync } = useLiveSync()

// ─── Quick Sync Engine ───
// Delta-based polling for cross-device data sync (5s interval)
const { startQuickSync: startCarsSync } = useAuctionsApi()
const { startQuickSync: startLeadsSync } = useLeadsApi()
const { startQuickSync: startPeopleSync } = usePeopleApi()
const { startQuickSync: startWorkspaceSync } = useWorkspace()

onMounted(() => {
  // Kick off data prefetch silently — zero loading screens when user navigates
  bootPrefetch()
  // Start listening for real-time changes from other users
  startLiveSync()
  // Start Quick Sync polling for all data stores
  startCarsSync()
  startLeadsSync()
  startPeopleSync()
  startWorkspaceSync()
})

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} | OTOBIX CRM` : 'OTOBIX CRM'
  },
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { key: 'theme-color', name: 'theme-color', content: color },
    { name: 'description', content: 'A comprehensive CRM platform by OTOBIX for car dealership management.' },
    // PWA meta tags
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'OTOBIX CRM' },
    { name: 'application-name', content: 'OTOBIX CRM' },
    { name: 'msapplication-TileColor', content: '#E31E24' },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=2' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192x192.png?v=2' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=2' },
    { rel: 'manifest', href: '/manifest.json?v=2' },
  ],
  htmlAttrs: {
    lang: 'en',
  },
  bodyAttrs: {
    class: computed(() => `color-${theme.value?.color || 'default'} theme-${theme.value?.type || 'default'}`),
  },
})

const _title = 'OTOBIX CRM'
const _description = 'A comprehensive CRM platform by OTOBIX.'

const router = useRouter()

defineShortcuts({
  'G-H': () => router.push('/'),
  'G-L': () => router.push('/leads'),
})

const textDirection = useTextDirection({ initialValue: 'ltr' })
const dir = computed(() => textDirection.value === 'rtl' ? 'rtl' : 'ltr')
</script>

<template>
  <Body class="overscroll-none antialiased bg-background text-foreground">
    <div id="app" :dir="dir" vaul-drawer-wrapper class="relative h-full overflow-hidden">
      <!-- No environment indicator, strictly production only now -->
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <ClientOnly>
      <Toaster :theme="colorMode.preference as any || 'system'" />
      <PwaServiceWorkerRegistration />
      <PwaInstallPrompt />
      <Analytics :debug="false" />
    </ClientOnly>
  </Body>
</template>
