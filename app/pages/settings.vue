<script setup lang="ts">
definePageMeta({ title: 'Settings', layout: 'default' })
useHead({ title: 'Settings — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Settings' })

const route = useRoute()
const router = useRouter()

// ─── Tabs ───
const tabs = [
  { id: 'workspaces', label: 'Workspaces', icon: 'i-lucide-layers' },
  { id: 'system', label: 'System', icon: 'i-lucide-monitor-cog' },
]

const activeTab = ref('workspaces')

// Sync tab with route on load
onMounted(() => {
  const sub = route.path.replace('/settings/', '').replace('/settings', '')
  const found = tabs.find(t => t.id === sub)
  if (found) activeTab.value = found.id
})

// Also watch for route changes (e.g. back/forward)
watch(() => route.path, (path) => {
  const sub = path.replace('/settings/', '').replace('/settings', '')
  const found = tabs.find(t => t.id === sub)
  if (found) activeTab.value = found.id
})

function switchTab(id: string) {
  activeTab.value = id
  router.replace({ path: `/settings/${id}` })
}
</script>

<template>
  <div class="w-full flex flex-col h-full overflow-hidden">
    <!-- Tab Bar -->
    <div class="shrink-0 border-b bg-muted/20">
      <div class="px-4 lg:px-6">
        <nav class="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-none">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap"
            :class="activeTab === tab.id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'"
            @click="switchTab(tab.id)"
          >
            <Icon :name="tab.icon" class="size-4" />
            {{ tab.label }}
            <span
              v-if="activeTab === tab.id"
              class="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
            />
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <div class="max-w-5xl">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>
