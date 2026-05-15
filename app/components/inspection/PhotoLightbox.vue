<script setup lang="ts">
/**
 * PhotoLightbox — Shared fullscreen image lightbox for inspection views.
 *
 * Features:
 *   - Keyboard nav: ← → step, Esc close
 *   - Pinch-zoom on touch, mouse-wheel zoom on desktop
 *   - Caption strip: part name + "3 / 12"
 *   - Download button
 *   - Thumbnail strip
 *
 * Usage:
 *   <PhotoLightbox v-model:open="showLightbox" :images="images" v-model:index="currentIndex" />
 */

const props = defineProps<{
  open: boolean
  images: { url: string; label: string }[]
  index: number
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  'update:index': [val: number]
}>()

// Zoom state
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = { x: 0, y: 0, panX: 0, panY: 0 }

const currentImage = computed(() => props.images[props.index])

function close() {
  resetZoom()
  emit('update:open', false)
}

function prev() {
  resetZoom()
  emit('update:index', (props.index - 1 + props.images.length) % props.images.length)
  nextTick(scrollThumbIntoView)
}

function next() {
  resetZoom()
  emit('update:index', (props.index + 1) % props.images.length)
  nextTick(scrollThumbIntoView)
}

function goTo(idx: number) {
  resetZoom()
  emit('update:index', idx)
  nextTick(scrollThumbIntoView)
}

function resetZoom() {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

// Mouse-wheel zoom
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.15 : 0.15
  zoomLevel.value = Math.min(5, Math.max(1, zoomLevel.value + delta))
  if (zoomLevel.value <= 1) {
    panX.value = 0
    panY.value = 0
  }
}

// Mouse drag pan (when zoomed)
function onMouseDown(e: MouseEvent) {
  if (zoomLevel.value <= 1) return
  isDragging.value = true
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  dragStart.panX = panX.value
  dragStart.panY = panY.value
}
function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  panX.value = dragStart.panX + (e.clientX - dragStart.x)
  panY.value = dragStart.panY + (e.clientY - dragStart.y)
}
function onMouseUp() {
  isDragging.value = false
}

// Touch pinch-zoom
let lastTouchDist = 0
function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    lastTouchDist = Math.hypot(
      e.touches[0]!.clientX - e.touches[1]!.clientX,
      e.touches[0]!.clientY - e.touches[1]!.clientY,
    )
  }
}
function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    e.preventDefault()
    const dist = Math.hypot(
      e.touches[0]!.clientX - e.touches[1]!.clientX,
      e.touches[0]!.clientY - e.touches[1]!.clientY,
    )
    const scale = dist / lastTouchDist
    zoomLevel.value = Math.min(5, Math.max(1, zoomLevel.value * scale))
    lastTouchDist = dist
    if (zoomLevel.value <= 1) {
      panX.value = 0
      panY.value = 0
    }
  }
}

// Keyboard
function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'Escape') close()
  else if (e.key === '+' || e.key === '=') zoomLevel.value = Math.min(5, zoomLevel.value + 0.25)
  else if (e.key === '-') { zoomLevel.value = Math.max(1, zoomLevel.value - 0.25); if (zoomLevel.value <= 1) resetZoom() }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// Download
function downloadImage() {
  if (!currentImage.value?.url) return
  const a = document.createElement('a')
  a.href = currentImage.value.url
  a.download = `${(currentImage.value.label || 'image').replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`
  a.target = '_blank'
  a.rel = 'noopener'
  a.click()
}

// Thumbnail scroll
function scrollThumbIntoView() {
  const el = document.querySelector(`[data-lightbox-thumb="${props.index}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

const imageTransform = computed(() =>
  `scale(${zoomLevel.value}) translate(${panX.value / zoomLevel.value}px, ${panY.value / zoomLevel.value}px)`,
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
        @click.self="close"
        @mouseup="onMouseUp"
        @mousemove="onMouseMove"
      >
        <!-- Top bar: caption + counter + toolbar + close -->
        <div class="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
          <div class="flex items-center gap-3 min-w-0">
            <Badge variant="outline" class="border-white/20 text-white/70 text-xs shrink-0 font-mono">
              {{ index + 1 }} / {{ images.length }}
            </Badge>
            <h3 class="text-white text-sm font-medium truncate">
              {{ currentImage?.label || 'Image' }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <!-- Zoom indicator -->
            <Badge v-if="zoomLevel > 1" variant="outline" class="border-white/20 text-white/50 text-[10px] shrink-0 font-mono">
              {{ Math.round(zoomLevel * 100) }}%
            </Badge>
            <!-- Download -->
            <button
              class="text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              title="Download image"
              @click="downloadImage"
            >
              <Icon name="i-lucide-download" class="size-4" />
            </button>
            <!-- Reset zoom -->
            <button
              v-if="zoomLevel > 1"
              class="text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              title="Reset zoom"
              @click="resetZoom"
            >
              <Icon name="i-lucide-minimize-2" class="size-4" />
            </button>
            <!-- Close -->
            <button
              class="text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              title="Close (Esc)"
              @click="close"
            >
              <Icon name="i-lucide-x" class="size-5" />
            </button>
          </div>
        </div>

        <!-- Main image area -->
        <div
          class="flex-1 min-h-0 flex items-center justify-center relative px-14 sm:px-16 overflow-hidden"
          :class="zoomLevel > 1 ? 'cursor-grab' : ''"
          @click.self="close"
          @wheel="onWheel"
          @mousedown="onMouseDown"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
        >
          <!-- Prev -->
          <button
            v-if="images.length > 1"
            class="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10 backdrop-blur-sm"
            @click.stop="prev"
          >
            <Icon name="i-lucide-chevron-left" class="size-5" />
          </button>

          <!-- Image -->
          <img
            v-if="currentImage"
            :key="index"
            :src="currentImage.url"
            :alt="currentImage.label"
            class="max-w-full max-h-full object-contain rounded-lg transition-transform duration-150 ease-out"
            :class="isDragging ? 'cursor-grabbing' : ''"
            :style="{ transform: imageTransform }"
            draggable="false"
          >

          <!-- Next -->
          <button
            v-if="images.length > 1"
            class="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10 backdrop-blur-sm"
            @click.stop="next"
          >
            <Icon name="i-lucide-chevron-right" class="size-5" />
          </button>
        </div>

        <!-- Thumbnail strip -->
        <div v-if="images.length > 1" class="shrink-0 bg-black/60 backdrop-blur-sm border-t border-white/10 px-4 sm:px-6 py-3">
          <div class="flex gap-2 overflow-x-auto no-scrollbar justify-center max-w-full">
            <button
              v-for="(thumb, ti) in images"
              :key="ti"
              :data-lightbox-thumb="ti"
              class="shrink-0 size-14 rounded-lg overflow-hidden border-2 transition-all duration-200"
              :class="ti === index ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'"
              @click="goTo(ti)"
            >
              <img :src="thumb.url" :alt="thumb.label" class="w-full h-full object-cover" loading="lazy">
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
