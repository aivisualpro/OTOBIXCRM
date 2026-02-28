<script setup lang="ts">
const route = useRoute()

const navItems = [
  { id: 'leads', title: 'Leads', icon: 'i-lucide-magnet', color: 'text-blue-500', link: '/leads' },
  { id: 'scheduled', title: 'Scheduled', icon: 'i-lucide-calendar', color: 'text-indigo-500', link: '/leads/scheduled' },
  { id: 're-scheduled', title: 'Re-Scheduled', icon: 'i-lucide-calendar-range', color: 'text-purple-500', link: '/leads/re-scheduled' },
  { id: 'cancelled', title: 'Cancelled', icon: 'i-lucide-ban', color: 'text-red-500', link: '/leads/cancelled' },
  { id: 're-inspection', title: 'Re-Inspection', icon: 'i-lucide-rotate-ccw', color: 'text-amber-500', link: '/leads/re-inspection' },
  { id: 'inspected', title: 'Inspected', icon: 'i-lucide-check-circle', color: 'text-emerald-500', link: '/leads/inspected' },
  { id: 'under-review', title: 'Under Review', icon: 'i-lucide-eye', color: 'text-orange-500', link: '/leads/under-review' },
  { id: 'quality-approved', title: 'Quality Approved', icon: 'i-lucide-shield-check', color: 'text-teal-500', link: '/leads/quality-approved' },
  { id: 'quality-rejected', title: 'Quality Rejected', icon: 'i-lucide-shield-x', color: 'text-rose-500', link: '/leads/quality-rejected' },
]

const currentActiveId = computed(() => {
  const path = route.path
  if (path === '/leads' || path === '/leads/')
    return 'leads'
  return path.split('/').pop() || 'leads'
})
</script>

<template>
  <div class="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Navigation Bar -->
    <div class="shrink-0 border-b bg-muted/30">
      <div class="flex items-center gap-0 overflow-x-auto no-scrollbar px-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.link"
          class="leads-tab"
          :class="{ 'is-active': currentActiveId === item.id }"
        >
          <Icon :name="item.icon" class="size-3.5" :class="currentActiveId === item.id ? item.color : ''" />
          <span>{{ item.title }}</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Full-width content area -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.leads-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  margin-bottom: -1px;
}

.leads-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent) / 0.5);
}

.leads-tab.is-active {
  color: hsl(var(--foreground));
  border-bottom-color: hsl(var(--primary));
}
</style>
