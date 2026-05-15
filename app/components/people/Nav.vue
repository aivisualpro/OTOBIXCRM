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
  { id: 'kams', title: 'KAMs', icon: 'i-lucide-briefcase', color: 'text-indigo-500', link: '/people/kams' },
]

const currentActiveId = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  return segments[1] || 'dealer'
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
