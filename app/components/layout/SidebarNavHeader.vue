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
                {{ activeWorkspace.name }}
              </span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
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
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child class="gap-2 p-2">
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
