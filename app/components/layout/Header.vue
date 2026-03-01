<script setup lang="ts">
const route = useRoute()
const { headerState, clearHeader } = usePageHeader()

// Clear header state on route change so pages without setHeader() don't show stale info
watch(() => route.fullPath, () => {
  clearHeader()
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
  <header class="sticky top-0 md:peer-data-[variant=inset]:top-2 z-10 h-(--header-height) flex items-center gap-4 border-b bg-background/80 backdrop-blur-xl px-4 md:px-6 md:rounded-tl-xl md:rounded-tr-xl">
    <div class="flex items-center gap-3 min-w-0">
      <SidebarTrigger />
      <Separator orientation="vertical" class="h-4 opacity-30" />
      <div class="flex items-center gap-2.5 min-w-0">
        <ClientOnly>
          <div
            v-if="headerState.icon"
            class="size-7 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-primary/20"
            :style="{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--primary) 18%, transparent), color-mix(in oklch, var(--primary) 8%, transparent))' }"
          >
            <Icon :name="headerState.icon" class="size-3.5 text-primary" />
          </div>
        </ClientOnly>
        <div class="min-w-0">
          <h1
            class="text-sm font-bold leading-tight tracking-tight truncate"
            style="background: linear-gradient(to right, var(--foreground) 60%, color-mix(in oklch, var(--foreground) 45%, transparent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
          >
            {{ displayTitle }}
          </h1>
          <ClientOnly>
            <p v-if="headerState.description" class="text-[10.5px] text-muted-foreground/70 leading-tight truncate hidden md:block mt-px font-medium tracking-wide">
              {{ headerState.description }}
            </p>
          </ClientOnly>
        </div>
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <div id="header-actions" class="contents" />
      <slot />
    </div>
  </header>
</template>
