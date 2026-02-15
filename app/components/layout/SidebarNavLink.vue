<script setup lang="ts">
import type { SidebarMenuButtonVariants } from '~/components/ui/sidebar'
import type { NavLink } from '~/types/nav'
import { useSidebar } from '~/components/ui/sidebar'

withDefaults(defineProps<{
  item: NavLink
  size?: SidebarMenuButtonVariants['size']
}>(), {
  size: 'default',
})

const { setOpenMobile } = useSidebar()
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton as-child :tooltip="item.title" :size="size" :data-active="!item.disabled && item.link === $route.path">
        <!-- Disabled / Coming Soon: render as non-clickable span -->
        <span v-if="item.disabled" class="flex items-center gap-2 opacity-50 cursor-not-allowed">
          <Icon :name="item.icon || ''" />
          <span>{{ item.title }}</span>
          <span v-if="item.comingSoon" class="ml-auto rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 leading-none whitespace-nowrap">
            Coming Soon
          </span>
        </span>
        <!-- Normal link -->
        <NuxtLink v-else :to="item.link" @click="setOpenMobile(false)">
          <Icon :name="item.icon || ''" />
          <span>{{ item.title }}</span>
          <span v-if="item.new" class="rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
            New
          </span>
        </NuxtLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>

</style>
