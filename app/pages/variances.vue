<script setup lang="ts">
import { useDebounceFn, useIntersectionObserver } from '@vueuse/core'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })
useHead({ title: 'Variances Dashboard — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Variances Analytics', icon: 'i-lucide-layers' })

const {
  carDropdowns,
  totalCount,
  isLoading,
  brandStats,
  fetchCarDropdowns,
  fetchBrandStats,
  addDropdown,
  editDropdown,
  deleteDropdown,
} = useCarDropdowns()

const search = ref('')
const selectedMake = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = 50
const initialLoaded = ref(false)

// ─── Server-side metrics (no client recomputation) ───
const metrics = computed(() => {
  if (brandStats.value) {
    return {
      totalMakes: brandStats.value.totalMakes,
      totalModels: brandStats.value.totalModels,
      totalVariants: brandStats.value.totalVariants,
      activeCount: brandStats.value.activeCount,
    }
  }
  return { totalMakes: 0, totalModels: 0, totalVariants: 0, activeCount: 0 }
})



// Sidebar brands from server stats
const brandsWithCounts = computed(() => {
  if (!brandStats.value?.brands) return []
  return brandStats.value.brands.map(b => [b.make, b.count] as [string, number])
})

// ─── Data State Management ───
async function reload() {
  currentPage.value = 1
  await fetchCarDropdowns({ page: 1, limit: pageSize, search: search.value })
}

const debouncedSearch = useDebounceFn(() => reload(), 300)
watch(search, debouncedSearch)

watch(selectedMake, (newMake) => {
  search.value = newMake || ''
})

// Parallel boot: list + brand stats simultaneously
onMounted(async () => {
  await Promise.all([reload(), fetchBrandStats()])
  initialLoaded.value = true
})

const hasMore = computed(() => carDropdowns.value.length < totalCount.value)

async function loadMore() {
  if (isLoading.value || !hasMore.value) return
  currentPage.value++
  await fetchCarDropdowns({ page: currentPage.value, limit: pageSize, search: search.value, append: true })
}

// ─── Infinite Scroll via IntersectionObserver ───
const loadMoreTrigger = ref<HTMLElement | null>(null)
useIntersectionObserver(loadMoreTrigger, (entries) => {
  if (entries[0]?.isIntersecting && hasMore.value && !isLoading.value) loadMore()
}, { threshold: 0.1 })

// ─── Dialog Logic ───
const showDialog = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const form = ref({ _id: '', make: '', model: '', variant: '', isActive: true })

function openCreate() {
  isEditing.value = false
  form.value = { _id: '', make: selectedMake.value || '', model: '', variant: '', isActive: true }
  showDialog.value = true
}

function openEdit(item: any) {
  isEditing.value = true
  form.value = { _id: item._id, make: item.make || '', model: item.model || '', variant: item.variant || '', isActive: item.isActive !== false }
  showDialog.value = true
}

async function handleSubmit() {
  if (!form.value.make || !form.value.model || !form.value.variant)
    return toast.error('Required fields missing')
  isSubmitting.value = true
  try {
    if (isEditing.value) {
      await editDropdown({ dropdownId: form.value._id, ...form.value })
      toast.success('Variance synchronized successfully')
    }
    else {
      await addDropdown(form.value)
      toast.success('New variance published')
    }
    showDialog.value = false
  }
  catch (err: any) {
    toast.error(`Sync failed: ${err.message || 'Network error'}`)
  }
  finally { isSubmitting.value = false }
}

const showDeleteDialog = ref(false)
const deleteTarget = ref<any>(null)
const isDeleting = ref(false)

function confirmDelete(item: any) {
  deleteTarget.value = item
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await deleteDropdown(deleteTarget.value._id)
    toast.success('Variance purged from database')
    showDeleteDialog.value = false
  }
  catch { toast.error('Delete failed') }
  finally { isDeleting.value = false }
}


</script>

<template>
  <div class="h-full flex flex-col bg-background/50 backdrop-blur-3xl">
    <!-- Header Actions -->
    <HeaderActions>
      <Button variant="ghost" size="icon" class="size-8 hover:bg-muted/50 transition-all" :disabled="isLoading" @click="reload">
        <Icon name="i-lucide-refresh-cw" class="size-3.5" :class="{ 'animate-spin': isLoading }" />
      </Button>
      <Button size="sm" class="h-8 shadow-[0_2px_10px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all text-xs font-bold px-4" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
        New
      </Button>
    </HeaderActions>



    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden pb-6 gap-6">
      <!-- Sidebar -->
      <aside class="w-64 shrink-0 flex flex-col gap-4">
        <Card class="flex-1 overflow-hidden bg-white/5 dark:bg-black/5 border-border/50 backdrop-blur items-stretch flex flex-col">
          <div class="p-4 border-b flex items-center justify-between bg-muted/30">
            <h3 class="text-xs font-extra-bold uppercase tracking-[0.2em] text-foreground/70">
              Master Brands
            </h3>
            <Badge variant="secondary" class="h-5 text-[9px] font-bold">
              {{ metrics.totalMakes }}
            </Badge>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            <div class="relative mb-6">
              <Icon name="i-lucide-filter" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input v-model="search" placeholder="Quick Filter..." class="pl-8 h-8 text-[11px] bg-muted/20 border-border/50 focus-visible:ring-primary/20" />
            </div>

            <!-- Sidebar skeleton -->
            <template v-if="!brandsWithCounts.length && !initialLoaded">
              <div v-for="i in 8" :key="i" class="flex items-center justify-between p-2.5 rounded-xl">
                <div class="flex items-center gap-2 px-1">
                  <div class="size-6 rounded-md bg-muted/50 animate-pulse" />
                  <div class="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
                <div class="h-4 w-6 bg-muted rounded animate-pulse" />
              </div>
            </template>
            <nav v-else class="space-y-1">
              <button
                class="w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group relative overflow-hidden"
                :class="selectedMake === null ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-muted text-muted-foreground hover:text-foreground'"
                @click="selectedMake = null"
              >
                <div class="flex items-center gap-2.5 relative z-10">
                  <Icon name="i-lucide-layers" class="size-3.5" />
                  All Distribution
                </div>
                <span class="text-[10px] tabular-nums font-black opacity-60">{{ metrics.totalVariants }}</span>
              </button>

              <div class="my-4 h-px bg-border/20 mx-2" />

              <button
                v-for="[make, count] in brandsWithCounts"
                :key="make"
                class="w-full text-left p-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-between group"
                :class="selectedMake === make ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground/80 hover:bg-muted/50 hover:text-foreground'"
                @click="selectedMake = make"
              >
                <div class="flex items-center gap-2 px-1">
                  <div class="size-6 rounded-md bg-muted/50 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span class="text-[10px] font-black leading-none">{{ make.charAt(0) }}</span>
                  </div>
                  {{ make }}
                </div>
                <Badge :variant="selectedMake === make ? 'default' : 'outline'" class="h-4.5 px-1.5 text-[9px] font-black border-none">
                  {{ count }}
                </Badge>
              </button>
            </nav>
          </div>
        </Card>
      </aside>

      <!-- Premium Data Matrix -->
      <main class="flex-1 flex flex-col min-w-0 bg-white/5 dark:bg-black/5 rounded-3xl border border-border/50 overflow-hidden backdrop-blur-sm">
        <header class="px-6 py-4 border-b bg-muted/5 flex items-center justify-between">
          <h2 class="text-lg font-black tracking-tight text-foreground flex items-center gap-3">
            {{ selectedMake || 'All Brands' }}
            <Badge variant="outline" class="text-[10px] font-bold opacity-50">
              {{ carDropdowns.length }} of {{ metrics.totalVariants }}
            </Badge>
          </h2>
        </header>

        <div class="flex-1 overflow-auto custom-scrollbar p-1">
          <!-- Table skeleton on first load -->
          <template v-if="isLoading && !initialLoaded">
            <div class="space-y-0">
              <div class="flex items-center gap-4 px-4 py-3 border-b border-border/20" v-for="i in 12" :key="i">
                <div class="w-8 h-4 bg-muted rounded animate-pulse" />
                <div class="h-4 w-32 bg-muted rounded animate-pulse flex-1" />
                <div class="h-7 w-24 bg-muted/50 rounded-lg animate-pulse" />
              </div>
            </div>
          </template>
          <Table v-else class="relative">
            <TableHeader class="sticky top-0 z-30 bg-background/90 backdrop-blur-2xl">
              <TableRow class="hover:bg-transparent border-b-2 border-primary/5">
                <TableHead class="w-14 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  S.No.
                </TableHead>
                <TableHead class="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Model
                </TableHead>
                <TableHead class="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Variant
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(item, idx) in carDropdowns" :key="item._id" class="group transition-all hover:bg-muted/30 border-b border-border/20">
                <TableCell class="text-center text-[10px] font-black text-muted-foreground/50 px-0 tabular-nums">
                  {{ idx + 1 + (currentPage - 1) * pageSize }}
                </TableCell>
                <TableCell>
                  <span class="text-[13px] font-bold text-foreground tracking-tight">
                    {{ item.model }}
                  </span>
                </TableCell>
                <TableCell>
                  <span class="text-[13px] font-bold text-foreground tracking-tight">
                    {{ item.variant }}
                  </span>
                </TableCell>
              </TableRow>

              <!-- Infinite scroll trigger + load more fallback -->
              <TableRow v-if="hasMore" class="hover:bg-transparent">
                <TableCell colspan="3" class="p-10">
                  <div ref="loadMoreTrigger" class="flex flex-col items-center gap-6">
                    <div class="flex items-center gap-1.5 p-1 bg-muted/30 rounded-full border border-border/50">
                      <div class="px-6 py-2.5 rounded-full bg-background text-[11px] font-black text-muted-foreground border border-border/20 shadow-sm">
                        TOTAL INDEXED: {{ metrics.totalVariants }}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      class="h-12 px-12 rounded-2xl bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all font-black text-sm tracking-tight shadow-xl shadow-primary/20"
                      :disabled="isLoading"
                      @click="loadMore"
                    >
                      <Icon v-if="isLoading" name="i-lucide-refresh-cw" class="mr-3 size-5 animate-spin" />
                      {{ isLoading ? 'SYNCHRONIZING...' : 'DISCOVER MORE VARIANCES' }}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </main>
    </div>

    <!-- Master Logic Modals -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="sm:max-w-md rounded-3xl border border-border/50 shadow-2xl backdrop-blur-3xl bg-background/80">
        <DialogHeader class="space-y-1">
          <DialogTitle class="text-2xl font-black tracking-tight">
            {{ isEditing ? 'Edit Vehicle Essence' : 'Initialize New Intelligence' }}
          </DialogTitle>
          <DialogDescription class="text-[10px] font-black text-muted-foreground tracking-widest uppercase">
            Mapping the global vehicle matrix
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Brand Authority</Label>
              <Input v-model="form.make" placeholder="e.g. Honda" class="h-11 rounded-xl bg-muted/20 border-border/30 focus-visible:ring-primary/20 font-bold" />
            </div>
            <div class="space-y-2">
              <Label class="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Series ID</Label>
              <Input v-model="form.model" placeholder="e.g. City" class="h-11 rounded-xl bg-muted/20 border-border/30 focus-visible:ring-primary/20 font-bold" />
            </div>
          </div>
          <div class="space-y-2">
            <Label class="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Specific Variant Logic</Label>
            <Input v-model="form.variant" placeholder="e.g. 1.5 i-VTEC V" class="h-11 rounded-xl bg-muted/20 border-border/30 focus-visible:ring-primary/20 font-bold" />
          </div>
          <div v-if="isEditing" class="flex items-center justify-between rounded-2xl border border-border/30 bg-muted/10 p-4 transition-all hover:bg-muted/20">
            <div class="space-y-0.5">
              <Label class="text-xs font-black uppercase">Active Status</Label>
              <p class="text-[10px] font-bold text-muted-foreground">
                Broadcast availability to global nodes
              </p>
            </div>
            <Switch :checked="form.isActive" class="data-[state=checked]:bg-emerald-500" @update:checked="(v) => form.isActive = v" />
          </div>
        </div>

        <DialogFooter class="sm:justify-between gap-4 mt-2">
          <Button variant="ghost" class="h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-muted/50" @click="showDialog = false">
            Abort Sync
          </Button>
          <Button :disabled="isSubmitting" class="h-12 rounded-2xl px-10 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" @click="handleSubmit">
            <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            {{ isEditing ? 'Sync Matrix' : 'Publish Index' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Dialog -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this variance from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            <Icon v-if="isDeleting" name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
