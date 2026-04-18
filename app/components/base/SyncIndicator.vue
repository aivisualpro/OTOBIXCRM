<script setup lang="ts">
/**
 * ─── SyncIndicator ───
 *
 * A subtle, non-blocking indicator that shows when data is being
 * refreshed in the background. Appears as a small animated dot
 * near the top-right of the parent container.
 *
 * Usage:
 *   <SyncIndicator :syncing="isRefreshing" />
 */
defineProps<{
  syncing: boolean
  label?: string
}>()
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="syncing"
      class="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70 select-none"
    >
      <span class="relative flex size-2">
        <span class="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
        <span class="relative inline-flex size-2 rounded-full bg-primary/60" />
      </span>
      <span>{{ label || 'Syncing' }}</span>
    </div>
  </Transition>
</template>
