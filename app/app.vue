<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
const color = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')
const { theme } = useAppSettings()
const { currentEnv } = useApiEnvironment()

// ─── Smart Prefetch Engine ───
// Eagerly load leads + people + car data in background after app boot
const { bootPrefetch } = usePrefetch()
onMounted(() => {
  // Kick off data prefetch silently — zero loading screens when user navigates
  bootPrefetch()
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
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192x192.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/manifest.json' },
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
    <ConfigProvider :dir="dir">
      <div id="app" vaul-drawer-wrapper class="relative h-full overflow-hidden">
        <!-- Environment dot: green=production, amber=development -->
        <span
          class="env-dot"
          :class="{
            'bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.6)]': currentEnv === 'production',
            'bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.6)]': currentEnv === 'development',
          }"
        />
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </div>

      <Toaster :theme="colorMode.preference as any || 'system'" />
    </ConfigProvider>

    <!-- PWA Components -->
    <PwaServiceWorkerRegistration />
    <PwaInstallPrompt />

    <Analytics :debug="false" />
  </Body>
</template>

<style>
.env-dot {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 9999;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  animation: env-blink 2s ease-in-out infinite;
}

@keyframes env-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
