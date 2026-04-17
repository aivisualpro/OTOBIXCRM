<script setup lang="ts">
const route = useRoute()
const { headerState, clearHeader } = usePageHeader()

const router = useRouter()
// Clear header state BEFORE route changes so deep pages with setHeader() don't get cleared post-mount
router.beforeEach((to, from, next) => {
  if (to.path !== from.path)
    clearHeader()
  next()
})

// Derive fallback title from route when no explicit title is set
const fallbackTitle = computed(() => {
  if (route.fullPath === '/')
    return 'Dashboard'
  const segments = route.fullPath.split('/').filter(s => s !== '')
  const last = segments[segments.length - 1] || ''
  // Skip raw IDs (MongoDB ObjectId pattern ~24 hex chars)
  const cleaned = /^[a-f0-9]{24}$/i.test(last) ? (segments[segments.length - 2] || last) : last
  return cleaned
    .replace(/-/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
})

const displayTitle = computed(() => headerState.title || fallbackTitle.value)
</script>

<template>
  <header class="sticky top-0 md:peer-data-[variant=inset]:top-2 z-10 min-h-(--header-height) py-1.5 flex items-center gap-4 border-b bg-background/80 backdrop-blur-xl px-4 md:px-6 md:rounded-tl-xl md:rounded-tr-xl">
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <SidebarTrigger class="hover:bg-accent/50 transition-colors rounded-lg shrink-0" />
      <div class="h-5 w-px bg-border/60 mx-1 shrink-0" />
      <div class="flex items-center gap-4 min-w-0 flex-1">
        <ClientOnly>
          <div class="flex items-center gap-3">
            <Button v-if="headerState.showBackButton" variant="ghost" size="sm" class="h-8 px-2.5 text-primary hover:text-primary hover:bg-primary/10 shrink-0 lg:hidden" @click="$router.back()">
              <Icon name="i-lucide-arrow-left" class="size-4" />
              <span class="ml-1.5 font-semibold text-xs text-primary">Back</span>
            </Button>
            <Button v-if="headerState.showBackButton" variant="ghost" size="sm" class="h-8 px-3 text-primary hover:text-primary shrink-0 hidden lg:flex border border-primary/20 bg-primary/5 hover:bg-primary/10" @click="$router.back()">
              <Icon name="i-lucide-arrow-left" class="size-4" />
              <span class="ml-1.5 font-semibold text-sm text-primary">Back</span>
            </Button>

            <div
              v-if="headerState.icon"
              class="size-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all"
              :class="headerState.title === 'Notifications' ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-primary/5 border border-primary/10'"
            >
              <Icon :name="headerState.icon" class="size-5" :class="headerState.title === 'Notifications' ? 'text-blue-600 dark:text-blue-400' : 'text-primary'" />
            </div>
          </div>
        </ClientOnly>

        <div class="min-w-0 flex flex-col justify-center">
          <div class="flex items-center gap-3">
            <h1
              class="text-lg md:text-xl font-bold tracking-tight truncate drop-shadow-sm text-slate-900 dark:text-white"
            >
              {{ displayTitle }}
            </h1>
            <div v-if="headerState.badge" class="bg-red-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center shrink-0">
              {{ headerState.badge }}
            </div>
          </div>
          <p v-if="headerState.description" class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md hidden md:block">
            {{ headerState.description }}
          </p>
        </div>
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <div id="header-actions" class="contents" />
      <slot />
    </div>
  </header>
</template>
