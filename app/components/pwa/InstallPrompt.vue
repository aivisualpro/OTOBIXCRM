<script setup lang="ts">
import { Download, Smartphone, X } from 'lucide-vue-next'

const deferredPrompt = ref<any>(null)
const showBanner = ref(false)
const dismissed = ref(false)
const isInstalled = ref(false)

// Hide the install banner if a version update banner is on screen,
// so the two never stack on top of each other.
const { updateAvailable } = useVersionCheck()

// Check if already installed via display-mode
if (import.meta.client) {
  isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true
}

// Listen for the beforeinstallprompt event
onMounted(() => {
  // Don't show if already installed or previously dismissed this session
  if (isInstalled.value)
    return

  const dismissedAt = localStorage.getItem('pwa-install-dismissed')
  if (dismissedAt) {
    const dismissedTime = Number.parseInt(dismissedAt, 10)
    // Re-show after 7 days
    if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
      return
    }
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
    // Delay showing the banner by 3 seconds so user isn't overwhelmed on first load
    setTimeout(() => {
      if (!dismissed.value) {
        showBanner.value = true
      }
    }, 3000)
  })

  window.addEventListener('appinstalled', () => {
    showBanner.value = false
    isInstalled.value = true
    deferredPrompt.value = null
  })
})

async function handleInstall() {
  if (!deferredPrompt.value)
    return

  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice

  if (outcome === 'accepted') {
    showBanner.value = false
  }
  deferredPrompt.value = null
}

function handleDismiss() {
  showBanner.value = false
  dismissed.value = true
  localStorage.setItem('pwa-install-dismissed', Date.now().toString())
}

const visible = computed(() => showBanner.value && !updateAvailable.value)
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed bottom-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)]"
    >
      <div class="rounded-lg border border-border bg-card text-card-foreground shadow-md">
        <div class="flex items-start gap-3 p-3">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Smartphone class="size-4 text-muted-foreground" />
          </div>

          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-medium text-foreground">
              Install OTOBIX CRM
            </h3>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Add to home screen for app-like access.
            </p>
          </div>

          <button
            class="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="handleDismiss"
          >
            <X class="size-3.5" />
          </button>
        </div>

        <div class="flex items-center justify-end gap-2 px-3 pb-3">
          <button
            class="h-8 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="handleDismiss"
          >
            Not now
          </button>
          <button
            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            @click="handleInstall"
          >
            <Download class="size-3.5" />
            Install
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
