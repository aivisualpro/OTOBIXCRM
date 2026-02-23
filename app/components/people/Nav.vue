<script setup lang="ts">
const route = useRoute()

const navItems = [
  { id: 'otobix', title: 'Otobix', icon: 'i-lucide-shield-check', color: 'text-blue-500', link: '/people/otobix' },
  { id: 'dealers', title: 'Dealers', icon: 'i-lucide-store', color: 'text-amber-500', link: '/people/dealers' },
  { id: 'customers', title: 'Customers', icon: 'i-lucide-user-round', color: 'text-emerald-500', link: '/people/customers' },
  { id: 'kams', title: 'KAMs', icon: 'i-lucide-briefcase', color: 'text-orange-500', link: '/people/kams' },
  { id: 'others', title: 'Others', icon: 'i-lucide-users-round', color: 'text-violet-500', link: '/people/others' },
]

const currentActiveId = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  // /people/otobix -> ['people', 'otobix']
  // /people/otobix/abc123 -> ['people', 'otobix', 'abc123']
  return segments[1] || 'otobix'
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
