<script setup lang="ts">
const { updateAvailable, dismissUpdate, applyUpdate } = useVersionCheck()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="updateAvailable"
        class="fixed bottom-4 right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)]"
        role="status"
        aria-live="polite"
      >
        <div class="rounded-lg border border-border bg-card text-card-foreground shadow-md">
          <div class="flex items-start gap-3 p-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon name="i-lucide-refresh-cw" class="size-4 text-muted-foreground" />
            </div>

            <div class="min-w-0 flex-1">
              <h4 class="text-sm font-medium text-foreground">
                Update available
              </h4>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Refresh to load the latest version.
              </p>
            </div>

            <button
              class="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Dismiss"
              @click="dismissUpdate"
            >
              <Icon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>

          <div class="flex items-center justify-end gap-2 px-3 pb-3">
            <button
              class="h-8 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="dismissUpdate"
            >
              Later
            </button>
            <button
              class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              @click="applyUpdate"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
