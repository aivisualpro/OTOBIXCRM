<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { navMenu, navMenuBottom } from '~/constants/menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const teams: {
  name: string
  logo: string
  plan: string
}[] = [
  {
    name: 'OTOBIX ADMIN',
    logo: 'i-lucide-shield-check',
    plan: 'Workspace',
  },
  {
    name: 'OTOBIX INSPECTION',
    logo: 'i-lucide-scan-search',
    plan: 'Workspace',
  },
  {
    name: 'OTOBIX DEALERS',
    logo: 'i-lucide-handshake',
    plan: 'Workspace',
  },
]

const userCookie = useCookie('userData')
const user = computed(() => {
  try {
    const parsed = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
    return {
      name: parsed?.userName || parsed?.name || 'User',
      role: parsed?.role || 'Member',
      avatar: parsed?.avatar || parsed?.profileImage || '',
    }
  }
  catch {
    return { name: 'User', role: 'Member', avatar: '' }
  }
})

const { sidebar } = useAppSettings()
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarHeader>
      <LayoutSidebarNavHeader :teams="teams" />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in navMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in navMenuBottom" :key="index" :item="item" size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <LayoutSidebarNavFooter :user="user" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>

<style scoped>

</style>
