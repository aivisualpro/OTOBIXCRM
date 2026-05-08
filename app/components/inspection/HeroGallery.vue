<script setup lang="ts">
const props = defineProps<{
  images: { url: string, label: string }[]
}>()

const activeIndex = ref(0)
const showLightbox = ref(false)

const currentImage = computed(() => props.images[activeIndex.value])

function prev() {
  activeIndex.value = (activeIndex.value - 1 + props.images.length) % props.images.length
}
function next() {
  activeIndex.value = (activeIndex.value + 1) % props.images.length
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
  <div class="space-y-3">
    <!-- Main Image -->
    <div
      class="relative aspect-[16/10] rounded-2xl overflow-hidden bg-muted cursor-pointer ring-1 ring-border"
      @click="showLightbox = true"
    >
      <img
        v-if="currentImage"
        :src="currentImage.url"
        :alt="`${currentImage.label} view`"
        class="w-full h-full object-contain transition-opacity duration-300"
      >
      <div class="absolute bottom-3 right-3">
        <Badge class="bg-black/60 text-white border-0 backdrop-blur-sm text-xs font-mono">
          {{ activeIndex + 1 }} / {{ images.length }}
        </Badge>
      </div>
      <button
        v-if="images.length > 1"
        class="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Previous image"
        @click.stop="prev"
      >
        <Icon name="i-lucide-chevron-left" class="size-4" />
      </button>
      <button
        v-if="images.length > 1"
        class="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Next image"
        @click.stop="next"
      >
        <Icon name="i-lucide-chevron-right" class="size-4" />
      </button>
    </div>

    <!-- Thumbnails -->
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        v-for="(img, idx) in images"
        :key="idx"
        class="group relative shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all focus-visible:ring-2 focus-visible:ring-ring"
        :class="activeIndex === idx ? 'ring-2 ring-primary opacity-100' : 'opacity-50 hover:opacity-80 ring-1 ring-border'"
        :aria-label="`View ${img.label}`"
        @click="activeIndex = idx"
      >
        <img :src="img.url" :alt="img.label" class="w-full h-full object-cover">
        <div class="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
          {{ img.label }}
        </div>
      </button>
    </div>

    <!-- Lightbox Dialog -->
    <Dialog v-model:open="showLightbox">
      <DialogContent class="max-w-4xl p-0 bg-black/95 border-0 overflow-hidden [&>button]:text-white">
        <div class="relative">
          <img
            v-if="currentImage"
            :src="currentImage.url"
            :alt="currentImage.label"
            class="w-full max-h-[80vh] object-contain"
          >
          <div class="absolute top-3 left-3">
            <Badge class="bg-black/60 text-white border-0 backdrop-blur-sm">
              {{ currentImage?.label }}
            </Badge>
          </div>
          <div class="absolute top-3 right-12">
            <Badge class="bg-black/60 text-white border-0 backdrop-blur-sm font-mono text-xs">
              {{ activeIndex + 1 }} / {{ images.length }}
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
