<script setup lang="ts">
const route = useRoute()

const SYSTEM_TABS = [
  { id: '', title: 'General Settings', icon: 'i-lucide-settings' },
  { id: 'margin-helpers', title: 'Margin Helpers', icon: 'i-lucide-calculator' },
]

// To highlight the active tab accurately even on nested routes
const isTabActive = (tabId: string) => {
  if (tabId === '') {
    return route.path === '/settings/system' || route.path === '/settings/system/'
  }
  return route.path.includes(`/settings/system/${tabId}`)
}
</script>

<template>
  <div class="h-full flex flex-col md:flex-row overflow-hidden bg-background">
    <!-- Left Sidebar: Sub settings -->
    <div class="w-full md:w-64 shrink-0 border-r bg-muted/10 p-4 space-y-2 overflow-y-auto">
      <NuxtLink
        v-for="tab in SYSTEM_TABS"
        :key="tab.id"
        :to="tab.id ? `/settings/system/${tab.id}` : `/settings/system`"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
        :class="isTabActive(tab.id)
          ? 'bg-primary/10 text-primary hover:bg-primary/15' 
          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'"
      >
        <Icon :name="tab.icon" class="size-4" />
        {{ tab.title }}
      </NuxtLink>
    </div>

    <!-- Right Content -->
    <div class="flex-1 overflow-y-auto bg-background">
      <NuxtPage />
    </div>
  </div>
</template>
