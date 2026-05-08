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

function prev() {
  lightboxIndex.value = (lightboxIndex.value - 1 + props.images.length) % props.images.length
}
function next() {
  lightboxIndex.value = (lightboxIndex.value + 1) % props.images.length
}

function onKeydown(e: KeyboardEvent) {
  if (!showLightbox.value) return
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
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

    <!-- Lightbox -->
    <Dialog v-model:open="showLightbox">
      <DialogContent class="max-w-4xl p-0 bg-black/95 border-0 overflow-hidden [&>button]:text-white">
        <div class="relative">
          <img
            v-if="images[lightboxIndex]"
            :src="images[lightboxIndex]?.url"
            :alt="images[lightboxIndex]?.label"
            class="w-full max-h-[80vh] object-contain"
          >
          <div class="absolute top-3 left-3">
            <Badge class="bg-black/60 text-white border-0 backdrop-blur-sm">
              {{ images[lightboxIndex]?.label }}
            </Badge>
          </div>
          <div class="absolute top-3 right-12">
            <Badge class="bg-black/60 text-white border-0 backdrop-blur-sm font-mono text-xs">
              {{ lightboxIndex + 1 }} / {{ images.length }}
            </Badge>
          </div>
          <button
            v-if="images.length > 1"
            class="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            @click="prev"
          >
            <Icon name="i-lucide-chevron-left" class="size-5" />
          </button>
          <button
            v-if="images.length > 1"
            class="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            @click="next"
          >
            <Icon name="i-lucide-chevron-right" class="size-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
