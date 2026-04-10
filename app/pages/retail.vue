<script setup lang="ts">
import { useWorkspace } from '~/composables/useWorkspace'

const { activeWorkspace } = useWorkspace()

const RETAIL_TABS = [
  { id: 'all', title: 'All Vehicles', link: '/retail/all' },
  { id: 'published', title: 'Published', link: '/retail/published' },
  { id: 'drafts', title: 'Drafts', link: '/retail/drafts' },
]

const navItems = computed(() => {
  const allowed = activeWorkspace.value?.retailTabs
  if (allowed && allowed.length > 0) {
    return RETAIL_TABS.filter(item => allowed.includes(item.id))
  }
  return RETAIL_TABS
})

const route = useRoute()
const currentActiveId = computed(() => {
  const path = route.path
  return path.split('/').pop() || 'all'
})
</script>

<template>
  <div class="h-[calc(100vh-8rem)] flex flex-col overflow-hidden bg-background">
    <!-- Tab Navigation Bar -->
    <div class="shrink-0 border-b bg-background/80 backdrop-blur-sm z-10 w-full mb-8">
      <div class="flex items-center gap-2 px-4 lg:px-6 py-2 overflow-x-auto no-scrollbar">
        <NuxtLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.link"
          class="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap flex-shrink-0"
          :class="currentActiveId === item.id || (route.path === '/retail' && item.id === 'all')
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'"
        >
          <span>{{ item.title }}</span>
        </NuxtLink>
      </div>
    </div>

    <div class="flex-1 w-full flex items-center justify-center relative overflow-hidden">
      <!-- Animated Background Blobs -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
         <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 mix-blend-multiply blur-3xl animate-blob"></div>
         <div class="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 mix-blend-multiply blur-3xl animate-blob animation-delay-2000"></div>
         <div class="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-purple-500/5 mix-blend-multiply blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div class="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto space-y-8">
        <div class="relative bg-gradient-to-br from-primary/20 to-primary/5 w-32 h-32 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/20 ring-1 ring-primary/20 backdrop-blur-xl mb-6 transform -rotate-6 hover:rotate-0 transition-transform duration-500 cursor-pointer group">
          <Icon name="i-lucide-store" class="size-16 text-primary drop-shadow-md group-hover:scale-110 transition-transform duration-500" />
          <div class="absolute -right-3 -top-3">
             <span class="relative flex h-6 w-6">
               <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
               <span class="relative inline-flex rounded-full h-6 w-6 bg-amber-500 items-center justify-center border-2 border-background">
                 <Icon name="i-lucide-zap" class="size-3 text-white" />
               </span>
             </span>
          </div>
        </div>

        <h1 class="text-6xl md:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground via-foreground/90 to-foreground/40 leading-tight">
          Next-Gen Retail
          <br>
          <span class="text-primary opacity-90 inline-block mt-2">Coming Soon.</span>
        </h1>
        
        <p class="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
          The future of consumer vehicle distribution is currently under active development. Our revolutionary unified retail marketplace is dropping earlier than you think.
        </p>

        <div class="pt-8">
          <div class="flex items-center gap-3 bg-muted/30 backdrop-blur-md px-6 py-3 rounded-full border border-border/50 text-sm font-semibold tracking-widest uppercase text-muted-foreground shadow-sm">
            <Icon name="i-lucide-clock" class="size-4 text-primary animate-pulse" />
            <span class="opacity-80">ETA: Q4 Launch Sequence</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
</style>
