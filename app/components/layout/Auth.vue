<script setup lang="ts">
const props = defineProps<{
  reverse?: boolean
  video?: string
}>()
</script>

<template>
  <div
    class="relative flex items-center justify-center h-dvh lg:max-w-none lg:px-0 overflow-hidden"
    :class="{ 'flex-row-reverse': reverse }"
  >
    <!-- Left Section: Video / Branding -->
    <div class="relative hidden h-full flex-1 flex-col bg-zinc-950 p-10 text-white lg:flex dark:border-r overflow-hidden">
      <!-- Centered Video Container -->
      <ClientOnly>
        <div v-if="video" class="absolute inset-0 z-0 flex items-center justify-center auth-video-fade">
          <video
            class="h-full w-full object-contain"
            autoplay
            muted
            loop
            playsinline
          >
            <source :src="video" type="video/mp4">
            <source :src="video" type="video/quicktime">
          </video>
          <!-- Optional subtle gradient if the video isn't pure black background -->
          <div class="absolute inset-0 bg-black/10" />
        </div>
      </ClientOnly>
      


      <div class="relative z-20 mt-auto">
        <blockquote class="space-y-4 max-w-lg">
          <p class="text-2xl font-light leading-snug text-zinc-100">
            &ldquo;Streamlining automotive inspections and dealer management with next-gen intelligence.&rdquo;
          </p>
          <footer class="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <span class="h-px w-8 bg-zinc-700" />
            OTOBIX CRM v1.0
          </footer>
        </blockquote>
      </div>
    </div>

    <!-- Right Section: Login Form -->
    <div class="flex-1 flex flex-col justify-center px-6 lg:p-8 bg-background">
      <div class="mx-auto w-full max-w-[350px]">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth fade-in for the video after client-side hydration */
.auth-video-fade {
  animation: authVideoFadeIn 0.6s ease-out forwards;
}

@keyframes authVideoFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
