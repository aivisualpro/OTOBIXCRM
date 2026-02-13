<script setup lang="ts">
const route = useRoute()

const navItems = [
  { id: 'leads', title: 'Leads', icon: 'i-lucide-magnet', color: 'text-blue-500', link: '/leads' },
  { id: 'scheduled', title: 'Scheduled', icon: 'i-lucide-calendar', color: 'text-indigo-500', link: '/leads/scheduled' },
  { id: 're-scheduled', title: 'Re-Scheduled', icon: 'i-lucide-calendar-range', color: 'text-purple-500', link: '/leads/re-scheduled' },
  { id: 'cancelled', title: 'Cancelled', icon: 'i-lucide-ban', color: 'text-red-500', link: '/leads/cancelled' },
  { id: 'inspected', title: 'Inspected', icon: 'i-lucide-check-circle', color: 'text-emerald-500', link: '/leads/inspected' },
  { type: 'separator' },
  { id: 'under-review', title: 'Under Review', icon: 'i-lucide-eye', color: 'text-orange-500', link: '/leads/under-review' },
  { id: 'quality-approved', title: 'Quality Approved', icon: 'i-lucide-shield-check', color: 'text-teal-500', link: '/leads/quality-approved' },
  { id: 'quality-rejected', title: 'Quality Rejected', icon: 'i-lucide-shield-x', color: 'text-rose-500', link: '/leads/quality-rejected' },
]

function isNavNavItem(item: any): item is { id: string, title: string, icon: string, color: string, link: string } {
  return 'id' in item
}

const currentActiveId = computed(() => {
  const path = route.path
  if (path === '/leads' || path === '/leads/') return 'leads'
  return path.split('/').pop() || 'leads'
})
</script>

<template>
  <div class="flex flex-col gap-1 p-2">
    <template v-for="(item, index) in navItems" :key="index">
      <div v-if="'type' in item && item.type === 'separator'" class="my-2 h-px bg-border mx-2" />
      <NuxtLink
        v-else-if="isNavNavItem(item)"
        :to="item.link"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground"
        :class="[
          currentActiveId === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
        ]"
      >
        <Icon :name="item.icon" class="size-4" :class="currentActiveId === item.id ? item.color : 'text-muted-foreground'" />
        <span class="flex-1 text-left">{{ item.title }}</span>
      </NuxtLink>
    </template>
  </div>
</template>
