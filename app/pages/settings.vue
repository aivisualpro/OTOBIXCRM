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
  { id: 'imports', label: 'Imports', icon: 'i-lucide-upload' },
]

const activeTab = ref('workspaces')

// Sync tab with route on load
onMounted(() => {
  const sub = route.path.replace('/settings/', '').replace('/settings', '')
  const found = tabs.find(t => t.id === sub)
  if (found)
    activeTab.value = found.id
})

// Also watch for route changes (e.g. back/forward)
watch(() => route.path, (path) => {
  const sub = path.replace('/settings/', '').replace('/settings', '')
  const found = tabs.find(t => t.id === sub)
  if (found)
    activeTab.value = found.id
})

function switchTab(id: string) {
  activeTab.value = id
  router.replace({ path: `/settings/${id}` })
}
</script>

<template>
  <div class="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Bar -->
    <div class="shrink-0 border-b bg-background/80 backdrop-blur-sm z-10 flex items-center justify-between">
      <div class="flex items-center gap-2 px-4 lg:px-6 py-2 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap flex-shrink-0"
            :class="activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'"
            @click="switchTab(tab.id)"
          >
            <Icon :name="tab.icon" class="size-4" />
            <span>{{ tab.label }}</span>
          </button>
      </div>
      <div id="settings-tab-actions" class="px-4 lg:px-6 flex items-center gap-2 flex-shrink-0"></div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0 overflow-y-auto w-full">
      <NuxtPage />
    </div>
  </div>
</template>
