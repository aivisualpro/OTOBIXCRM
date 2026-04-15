<script setup lang="ts">
import { useSidebar } from '~/components/ui/sidebar'

defineProps<{
  user: {
    name: string
    role: string
    avatar: string
    profileUrl: string
  }
}>()

const { isMobile, setOpenMobile } = useSidebar()

function handleLogout() {
  const isLoggedIn = useCookie('isLoggedIn')
  const authToken = useCookie('authToken')
  const userData = useCookie('userData')
  const activeWorkspace = useCookie('activeWorkspace')
  isLoggedIn.value = null
  authToken.value = null
  userData.value = null
  activeWorkspace.value = null
  if (isMobile.value)
    setOpenMobile(false)
  // Use navigateTo to keep app client-side (avoids SSR re-render crash)
  navigateTo('/login')
}

const showModalTheme = ref(false)
const { isConnected: liveSyncConnected } = useLiveSync()
</script>

<template>
  <div class="px-2 pb-1 text-[11px] text-muted-foreground/90 font-bold flex items-center gap-1.5 opacity-90">
    <span class="relative flex size-1.5">
      <span
        class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        :class="liveSyncConnected ? 'bg-emerald-400' : 'bg-red-400'"
      />
      <span
        class="relative inline-flex rounded-full size-1.5"
        :class="liveSyncConnected ? 'bg-emerald-500' : 'bg-red-500'"
      />
    </span>
    version beta.1.2.1
  </div>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage :src="user.avatar" :alt="user.name" />
              <AvatarFallback class="rounded-lg">
                {{ user.name.split(' ').map((n) => n[0]).join('') }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ user.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ user.role }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="min-w-56 w-[--radix-dropdown-menu-trigger-width] rounded-lg z-[100]"
          :side="isMobile ? 'bottom' : 'top'"
          align="start"
          :side-offset="8"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage :src="user.avatar" :alt="user.name" />
                <AvatarFallback class="rounded-lg">
                  {{ user.name.split(' ').map((n) => n[0]).join('') }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ user.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ user.role }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem as-child>
              <NuxtLink :to="user.profileUrl" @click="setOpenMobile(false)">
                <Icon name="i-lucide-user" />
                Profile
              </NuxtLink>
            </DropdownMenuItem>

            <DropdownMenuItem @click="showModalTheme = true">
              <Icon name="i-lucide-paintbrush" />
              Theme
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleLogout">
            <Icon name="i-lucide-log-out" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>

  <Dialog v-model:open="showModalTheme">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Customize</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          Customize & Preview in Real Time
        </DialogDescription>
      </DialogHeader>
      <ThemeCustomize />
    </DialogContent>
  </Dialog>
</template>

<style scoped>

</style>
