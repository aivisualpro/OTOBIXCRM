<script setup lang="ts">
import type { Workspace } from '~/composables/useWorkspace'
import { useSidebar } from '~/components/ui/sidebar'

defineProps<{
  workspaces: Workspace[]
  activeWorkspace: Workspace
}>()

const emit = defineEmits<{
  workspaceChange: [id: string]
}>()

const { isMobile } = useSidebar()
const userCookie = useCookie('userData')
const isAdmin = computed(() => {
  try {
    const user = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
    const role = user?.userType || user?.userRole || user?.role || ''
    return typeof role === 'string' && role.toLowerCase() === 'admin'
  }
  catch {
    return false
  }
})
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div class="grid flex-1 text-left text-sm leading-tight ml-2">
              <span class="truncate font-semibold">
                {{ activeWorkspace?.name || 'Workspace' }}
              </span>
            </div>
            <Icon v-if="workspaces.length > 1" name="i-lucide-chevrons-up-down" class="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          v-if="workspaces.length > 1"
          class="min-w-56 w-[--radix-dropdown-menu-trigger-width] rounded-lg"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
        >
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="(ws, index) in workspaces"
            :key="ws.workspaceId"
            class="gap-2 p-2"
            :class="{ 'bg-accent': activeWorkspace.workspaceId === ws.workspaceId }"
            @click="emit('workspaceChange', ws.workspaceId)"
          >
            {{ ws.name }}
            <Icon v-if="activeWorkspace.workspaceId === ws.workspaceId" name="i-lucide-check" class="ml-auto size-3.5 text-primary" />
            <DropdownMenuShortcut v-else>
              ⌘{{ index + 1 }}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="isAdmin" />
          <DropdownMenuItem v-if="isAdmin" as-child class="gap-2 p-2">
            <NuxtLink to="/settings/workspaces">
              <Icon name="i-lucide-settings" class="size-4" />
              Manage Workspaces
            </NuxtLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>

</style>
