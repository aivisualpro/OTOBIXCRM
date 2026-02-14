<script setup lang="ts">
const route = useRoute()

const navItems = [
  { id: 'otobix', title: 'Otobix', icon: 'i-lucide-shield-check', color: 'text-blue-500', link: '/people/otobix' },
  { id: 'dealers', title: 'Dealers', icon: 'i-lucide-store', color: 'text-amber-500', link: '/people/dealers' },
  { id: 'customers', title: 'Customers', icon: 'i-lucide-user-round', color: 'text-emerald-500', link: '/people/customers' },
]

const currentActiveId = computed(() => {
  const path = route.path
  return path.split('/').pop() || 'otobix'
})
</script>

<template>
  <div class="flex flex-col gap-1 p-2">
    <NuxtLink
      v-for="item in navItems"
      :key="item.id"
      :to="item.link"
      class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground"
      :class="[
        currentActiveId === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
      ]"
    >
      <Icon :name="item.icon" class="size-4" :class="currentActiveId === item.id ? item.color : 'text-muted-foreground'" />
      <span class="flex-1 text-left">{{ item.title }}</span>
    </NuxtLink>
  </div>
</template>
