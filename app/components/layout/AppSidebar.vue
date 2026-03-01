<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const { activeWorkspace, activeMenuGroups, workspaces, setActiveWorkspace } = useWorkspace()

const userCookie = useCookie('userData')
const user = computed(() => {
  try {
    const parsed = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
    return {
      name: parsed?.userName || parsed?.name || 'User',
      role: parsed?.userType || parsed?.userRole || parsed?.role || 'Member',
      avatar: parsed?.avatar || parsed?.profileImage || parsed?.image || '',
    }
  }
  catch {
    return { name: 'User', role: 'Member', avatar: '' }
  }
})

const { sidebar } = useAppSettings()

// Settings link (always shown after workspace menus)
const settingsLink = {
  title: 'Settings',
  icon: 'i-lucide-settings',
  link: '/settings',
}
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarHeader>
      <LayoutSidebarNavHeader
        :workspaces="workspaces"
        :active-workspace="activeWorkspace"
        @workspace-change="setActiveWorkspace($event as string)"
      />
    </SidebarHeader>
    <SidebarContent>
      <!-- Dynamic workspace menus -->
      <SidebarGroup v-for="(nav, indexGroup) in activeMenuGroups" :key="nav.heading + indexGroup">
        <SidebarGroupLabel>
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>

      <!-- Settings (always visible) -->
      <SidebarGroup>
        <SidebarGroupLabel>System</SidebarGroupLabel>
        <LayoutSidebarNavLink :item="settingsLink" />
      </SidebarGroup>

      <!-- Bottom spacer -->
      <SidebarGroup class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <LayoutSidebarNavFooter :user="user" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>

<style scoped>

</style>
