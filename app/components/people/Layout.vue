<script setup lang="ts">
const route = useRoute()

const navItems = [
  { id: 'dealer', title: 'Dealer', icon: 'i-lucide-store', color: 'text-amber-500', link: '/people/dealer' },
  { id: 'customer', title: 'Customer', icon: 'i-lucide-user-round', color: 'text-emerald-500', link: '/people/customer' },
  { id: 'inspection-engineer', title: 'Inspection Engineer', icon: 'i-lucide-clipboard-check', color: 'text-purple-500', link: '/people/inspection-engineer' },
  { id: 'admin', title: 'Admin', icon: 'i-lucide-shield-check', color: 'text-blue-500', link: '/people/admin' },
  { id: 'retailer', title: 'Retailer', icon: 'i-lucide-shopping-bag', color: 'text-cyan-500', link: '/people/retailer' },
  { id: 'sales-manager', title: 'Sales Manager', icon: 'i-lucide-briefcase', color: 'text-sky-500', link: '/people/sales-manager' },
  { id: 'telecaller', title: 'Telecaller', icon: 'i-lucide-phone-call', color: 'text-pink-500', link: '/people/telecaller' },
  { id: 'qc', title: 'QC', icon: 'i-lucide-badge-check', color: 'text-orange-500', link: '/people/qc' },
]

const currentActiveId = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  return segments[1] || 'dealer'
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
          class="people-tab"
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
.people-tab {
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

.people-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent) / 0.5);
}

.people-tab.is-active {
  color: hsl(var(--foreground));
  border-bottom-color: hsl(var(--primary));
}
</style>
