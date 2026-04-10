<script setup lang="ts">
const route = useRoute()

const currentActiveId = computed(() => {
  const path = route.path
  return path.split('/').pop() || 'list'
})

const navItems = [
  { id: 'list', title: 'Sales List', icon: 'i-lucide-list', link: '/sales/list' },
]
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
          class="sales-tab"
          :class="[
            currentActiveId === item.id ? 'is-active' : ''
          ]"
        >
          <Icon :name="item.icon" class="size-3.5 shrink-0 transition-colors" />
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
.sales-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  margin-bottom: -1px;
  flex-shrink: 0;
  position: relative;
}

.sales-tab:hover {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, color-mix(in srgb, var(--accent) 50%, transparent));
}

.sales-tab.is-active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}
</style>
