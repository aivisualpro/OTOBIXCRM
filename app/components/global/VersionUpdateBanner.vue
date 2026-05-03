<script setup lang="ts">
const { updateAvailable, dismissUpdate, applyUpdate } = useVersionCheck()

const isAnimating = ref(false)

watch(updateAvailable, (val) => {
  if (val) {
    isAnimating.value = true
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-500 ease-out"
      enter-from-class="translate-y-full opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition-all duration-300 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-full opacity-0 scale-95"
    >
      <div
        v-if="updateAvailable"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[420px] max-w-[calc(100vw-2rem)]"
      >
        <!-- Glow effect -->
        <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500/30 via-blue-500/30 to-emerald-500/30 blur-xl animate-pulse" />

        <!-- Main card -->
        <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
          <!-- Animated gradient border -->
          <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500 animate-gradient-x" />

          <!-- Shimmer overlay -->
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />

          <div class="relative p-4 flex items-center gap-4">
            <!-- Animated icon -->
            <div class="relative shrink-0">
              <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 blur-md animate-pulse" />
              <div class="relative size-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Icon name="i-lucide-rocket" class="size-6 text-white animate-bounce" />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <h4 class="text-sm font-bold text-white tracking-tight">
                  New Version Available
                </h4>
                <span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  Live
                </span>
              </div>
              <p class="text-xs text-zinc-400 leading-relaxed">
                A fresh update just landed. Refresh to get the latest features & fixes.
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="size-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
                title="Dismiss"
                @click="dismissUpdate"
              >
                <Icon name="i-lucide-x" class="size-3.5" />
              </button>
              <button
                class="group relative h-8 px-4 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-1.5"
                @click="applyUpdate"
              >
                <Icon name="i-lucide-refresh-cw" class="size-3 group-hover:animate-spin" />
                Update
              </button>
            </div>
          </div>

          <!-- Progress shimmer at bottom -->
          <div class="h-[1px] bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; background-size: 200% 100%; }
  50% { background-position: 100% 50%; background-size: 200% 100%; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-gradient-x {
  background-size: 200% 100%;
  animation: gradient-x 3s linear infinite;
}

.animate-shimmer {
  animation: shimmer 3s ease-in-out infinite;
}
</style>
