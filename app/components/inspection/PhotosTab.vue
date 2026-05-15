<script setup lang="ts">
const props = defineProps<{
  images: { url: string, label: string }[]
}>()

const showLightbox = ref(false)
const lightboxIndex = ref(0)

function openLightbox(idx: number) {
  lightboxIndex.value = idx
  showLightbox.value = true
}
</script>

<template>
  <div>
    <!-- Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="(img, idx) in images"
        :key="idx"
        class="group relative aspect-[4/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border hover:ring-primary/50 transition-all focus-visible:ring-2 focus-visible:ring-ring"
        @click="openLightbox(idx)"
      >
        <img :src="img.url" :alt="`${img.label} photo`" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
          <span class="text-white text-xs font-medium">{{ img.label }}</span>
        </div>
      </button>
    </div>

    <!-- Shared Lightbox -->
    <InspectionPhotoLightbox
      v-model:open="showLightbox"
      v-model:index="lightboxIndex"
      :images="images"
    />
  </div>
</template>
