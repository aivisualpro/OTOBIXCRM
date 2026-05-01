<script setup lang="ts">
import { useDebounceFn, useIntersectionObserver } from '@vueuse/core'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })
useHead({ title: 'Variances Dashboard — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Variances', icon: 'i-lucide-layers' })

const {
  carDropdowns,
  totalCount,
  isLoading,
  brandStats,
  makes,
  getModels,
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

const brandsWithCounts = computed(() => {
  if (!brandStats.value?.brands)
    return []
  return brandStats.value.brands.map(b => [b.make, b.count] as [string, number])
})

// ─── Data State ───
async function reload() {
  currentPage.value = 1
  await fetchCarDropdowns({ page: 1, limit: pageSize, search: search.value })
}

const debouncedSearch = useDebounceFn(() => reload(), 300)
watch(search, debouncedSearch)

watch(selectedMake, (newMake) => {
  search.value = newMake || ''
})

onMounted(async () => {
  await Promise.all([reload(), fetchBrandStats()])
  initialLoaded.value = true
})

const hasMore = computed(() => carDropdowns.value.length < totalCount.value)

async function loadMore() {
  if (isLoading.value || !hasMore.value)
    return
  currentPage.value++
  await fetchCarDropdowns({ page: currentPage.value, limit: pageSize, search: search.value, append: true })
}

const loadMoreTrigger = ref<HTMLElement | null>(null)
useIntersectionObserver(loadMoreTrigger, (entries) => {
  if (entries[0]?.isIntersecting && hasMore.value && !isLoading.value)
    loadMore()
}, { threshold: 0.1 })

// ─── Dialog Logic ───
const showDialog = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const form = ref({ _id: '', make: '', model: '', variant: '' })

// Make dropdown — use ALL makes from server aggregation (not just loaded page)
const makeSearch = ref('')
const showMakeDropdown = ref(false)
const allMakesFromStats = computed(() => {
  if (!brandStats.value?.brands)
    return []
  return brandStats.value.brands.map(b => b.make).sort((a, b) => a.localeCompare(b))
})
const filteredMakes = computed(() => {
  const all = allMakesFromStats.value
  if (!makeSearch.value)
    return all
  const q = makeSearch.value.toLowerCase()
  return all.filter(m => m.toLowerCase().includes(q))
})
const canAddNewMake = computed(() => {
  if (!makeSearch.value.trim())
    return false
  return !allMakesFromStats.value.some(m => m.toLowerCase() === makeSearch.value.trim().toLowerCase())
})

// Model dropdown — declare early so make functions can reference
const modelSearch = ref('')
const showModelDropdown = ref(false)

function selectMake(make: string) {
  form.value.make = make
  makeSearch.value = ''
  showMakeDropdown.value = false
  // Reset model when make changes
  form.value.model = ''
  modelSearch.value = ''
}

function addNewMake() {
  const newMake = makeSearch.value.trim()
  if (!newMake)
    return
  form.value.make = newMake
  makeSearch.value = ''
  showMakeDropdown.value = false
  form.value.model = ''
  modelSearch.value = ''
}

// Model dropdown — fetch ALL models for selected make from server
const allModelsForMake = ref<string[]>([])
const isLoadingModels = ref(false)

// Fetch models whenever the form make changes
watch(() => form.value.make, async (newMake) => {
  allModelsForMake.value = []
  if (!newMake)
    return
  isLoadingModels.value = true
  try {
    const res = await $fetch<any>('/api/car-dropdowns/models-by-make', { query: { make: newMake } })
    allModelsForMake.value = res.models || []
  }
  catch { /* silent */ }
  finally { isLoadingModels.value = false }
})

const filteredModels = computed(() => {
  if (!form.value.make)
    return []
  const all = allModelsForMake.value
  if (!modelSearch.value)
    return all
  const q = modelSearch.value.toLowerCase()
  return all.filter(m => m.toLowerCase().includes(q))
})
const canAddNewModel = computed(() => {
  if (!modelSearch.value.trim() || !form.value.make)
    return false
  return !allModelsForMake.value.some(m => m.toLowerCase() === modelSearch.value.trim().toLowerCase())
})

function selectModel(model: string) {
  form.value.model = model
  modelSearch.value = ''
  showModelDropdown.value = false
}

function addNewModel() {
  const newModel = modelSearch.value.trim()
  if (!newModel)
    return
  form.value.model = newModel
  modelSearch.value = ''
  showModelDropdown.value = false
}

const modelInputRef = ref<any>(null)

function openCreate() {
  isEditing.value = false
  form.value = { _id: '', make: selectedMake.value || '', model: '', variant: '' }
  makeSearch.value = ''
  modelSearch.value = ''
  showMakeDropdown.value = false
  showModelDropdown.value = false
  showDialog.value = true
  // If make is pre-selected, auto-focus model field after dialog renders
  if (selectedMake.value) {
    setTimeout(() => {
      showModelDropdown.value = true
      const el = modelInputRef.value?.$el || modelInputRef.value
      if (el?.focus)
        el.focus()
    }, 150)
  }
}

function openEdit(item: any) {
  isEditing.value = true
  form.value = { _id: item._id, make: item.make || '', model: item.model || '', variant: item.variant || '' }
  makeSearch.value = ''
  modelSearch.value = ''
  showMakeDropdown.value = false
  showModelDropdown.value = false
  showDialog.value = true
}

async function handleSubmit() {
  if (!form.value.make || !form.value.model || !form.value.variant)
    return toast.error('All fields are required')
  isSubmitting.value = true
  try {
    if (isEditing.value) {
      await editDropdown({ _id: form.value._id, make: form.value.make, model: form.value.model, variant: form.value.variant })
      toast.success('Updated successfully')
    }
    else {
      await addDropdown({ make: form.value.make, model: form.value.model, variant: form.value.variant })
      toast.success('Added successfully')
    }
    showDialog.value = false
  }
  catch (err: any) {
    toast.error(err?.data?.message || err.message || 'Failed')
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
  if (!deleteTarget.value)
    return
  isDeleting.value = true
  try {
    await deleteDropdown(deleteTarget.value._id)
    toast.success('Deleted successfully')
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
      <Button size="sm" class="h-8 hover:scale-105 active:scale-95 transition-all text-xs font-bold px-4" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
        New
      </Button>
    </HeaderActions>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden pb-6 gap-6">
      <!-- Sidebar -->
      <aside class="w-64 shrink-0 flex flex-col gap-4">
        <Card class="flex-1 overflow-hidden bg-white/5 dark:bg-black/5 border-border/50 backdrop-blur items-stretch flex flex-col rounded-lg">
          <div class="p-4 border-b flex items-center justify-between bg-muted/30">
            <h3 class="text-xs font-extra-bold uppercase tracking-[0.2em] text-foreground/70">
              Makes
            </h3>
            <Badge variant="secondary" class="h-5 text-[9px] font-bold">
              {{ metrics.totalMakes }}
            </Badge>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            <div class="relative mb-6">
              <Icon name="i-lucide-filter" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input v-model="search" placeholder="Filter..." class="pl-8 h-8 text-[11px] bg-muted/20 border-border/50 focus-visible:ring-primary/20 rounded-lg" />
            </div>

            <!-- Sidebar skeleton -->
            <template v-if="!brandsWithCounts.length && !initialLoaded">
              <div v-for="i in 8" :key="i" class="flex items-center justify-between p-2.5 rounded-lg">
                <div class="flex items-center gap-2 px-1">
                  <div class="size-6 rounded bg-muted/50 animate-pulse" />
                  <div class="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
                <div class="h-4 w-6 bg-muted rounded animate-pulse" />
              </div>
            </template>
            <nav v-else class="space-y-1">
              <button
                class="w-full text-left p-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between group relative overflow-hidden"
                :class="selectedMake === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'"
                @click="selectedMake = null"
              >
                <div class="flex items-center gap-2.5 relative z-10">
                  <Icon name="i-lucide-layers" class="size-3.5" />
                  All
                </div>
                <span class="text-[10px] tabular-nums font-black opacity-60">{{ metrics.totalVariants }}</span>
              </button>

              <div class="my-4 h-px bg-border/20 mx-2" />

              <button
                v-for="[make, count] in brandsWithCounts"
                :key="make"
                class="w-full text-left p-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between group"
                :class="selectedMake === make ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground/80 hover:bg-muted/50 hover:text-foreground'"
                @click="selectedMake = make"
              >
                <div class="flex items-center gap-2 px-1">
                  <div class="size-6 rounded bg-muted/50 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
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

      <!-- Data Table -->
      <main class="flex-1 flex flex-col min-w-0 bg-white/5 dark:bg-black/5 rounded-lg border border-border/50 overflow-hidden backdrop-blur-sm">
        <header class="px-6 py-3 border-b bg-muted/5 flex items-center justify-between gap-4">
          <h2 class="text-lg font-black tracking-tight text-foreground flex items-center gap-3 shrink-0">
            {{ selectedMake || 'All Makes' }}
            <Badge variant="outline" class="text-[10px] font-bold opacity-50">
              {{ carDropdowns.length }} of {{ selectedMake ? (brandsWithCounts.find(([m]) => m === selectedMake)?.[1] ?? 0) : metrics.totalVariants }}
            </Badge>
          </h2>
          <div class="relative max-w-xs w-full">
            <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              v-model="search"
              placeholder="Search make, model, variant..."
              class="pl-9 pr-8 h-9 text-xs bg-muted/20 border-border/50 focus-visible:ring-primary/20 rounded-lg"
            />
            <button
              v-if="search"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              @click="search = ''; selectedMake = null"
            >
              <Icon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-auto custom-scrollbar p-1">
          <!-- Table skeleton -->
          <template v-if="isLoading && !initialLoaded">
            <div class="space-y-0">
              <div v-for="i in 12" :key="i" class="flex items-center gap-4 px-4 py-3 border-b border-border/20">
                <div class="w-8 h-4 bg-muted rounded animate-pulse" />
                <div class="h-4 w-32 bg-muted rounded animate-pulse flex-1" />
                <div class="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                <div class="h-4 w-8 bg-muted/30 rounded animate-pulse" />
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
                  Make
                </TableHead>
                <TableHead class="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Model
                </TableHead>
                <TableHead class="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Variant
                </TableHead>
                <TableHead class="w-20 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Actions
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
                    {{ item.make }}
                  </span>
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
                <TableCell class="text-center">
                  <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" class="size-7 rounded-md" @click="openEdit(item)">
                      <Icon name="i-lucide-pencil" class="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" class="size-7 rounded-md text-destructive hover:text-destructive" @click="confirmDelete(item)">
                      <Icon name="i-lucide-trash-2" class="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>

              <!-- Infinite scroll trigger -->
              <TableRow v-if="hasMore" class="hover:bg-transparent">
                <TableCell colspan="5" class="p-6">
                  <div ref="loadMoreTrigger" class="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" :disabled="isLoading" class="text-xs font-bold" @click="loadMore">
                      <Icon v-if="isLoading" name="i-lucide-refresh-cw" class="mr-2 size-3.5 animate-spin" />
                      {{ isLoading ? 'Loading...' : 'Load More' }}
                    </Button>
                    <span class="text-[10px] text-muted-foreground font-bold">
                      {{ carDropdowns.length }} / {{ metrics.totalVariants }}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </main>
    </div>

    <!-- Add / Edit Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ isEditing ? 'Edit Variance' : 'New Variance' }}
          </DialogTitle>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Make: Searchable dropdown with add new -->
          <div class="space-y-2">
            <Label class="text-xs font-bold">Make</Label>
            <div class="relative">
              <Input
                :model-value="form.make || makeSearch"
                placeholder="Search or type new make..."
                class="h-10"
                @update:model-value="(v: string | number) => { makeSearch = String(v); form.make = ''; showMakeDropdown = true }"
                @focus="() => { if (!form.make) showMakeDropdown = true }"
              />
              <div
                v-if="showMakeDropdown && (filteredMakes.length > 0 || canAddNewMake)"
                class="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border bg-popover shadow-lg"
              >
                <button
                  v-if="canAddNewMake"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                  @mousedown.prevent="addNewMake"
                >
                  <Icon name="i-lucide-plus-circle" class="size-4" />
                  Add "{{ makeSearch.trim() }}"
                </button>
                <button
                  v-for="m in filteredMakes"
                  :key="m"
                  class="w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                  :class="form.make === m ? 'bg-primary/10 text-primary font-bold' : ''"
                  @mousedown.prevent="selectMake(m)"
                >
                  {{ m }}
                </button>
              </div>
            </div>
          </div>

          <!-- Model: Searchable dropdown with add new -->
          <div class="space-y-2">
            <Label class="text-xs font-bold">Model</Label>
            <div class="relative">
              <Input
                ref="modelInputRef"
                :model-value="form.model || modelSearch"
                placeholder="Search or type new model..."
                class="h-10"
                :disabled="!form.make"
                @update:model-value="(v: string | number) => { modelSearch = String(v); form.model = ''; showModelDropdown = true }"
                @focus="() => { if (!form.model) showModelDropdown = true }"
              />
              <div
                v-if="showModelDropdown && form.make && (filteredModels.length > 0 || canAddNewModel)"
                class="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border bg-popover shadow-lg"
              >
                <button
                  v-if="canAddNewModel"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                  @mousedown.prevent="addNewModel"
                >
                  <Icon name="i-lucide-plus-circle" class="size-4" />
                  Add "{{ modelSearch.trim() }}"
                </button>
                <button
                  v-for="m in filteredModels"
                  :key="m"
                  class="w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                  :class="form.model === m ? 'bg-primary/10 text-primary font-bold' : ''"
                  @mousedown.prevent="selectModel(m)"
                >
                  {{ m }}
                </button>
              </div>
            </div>
          </div>

          <!-- Variant: Plain text input -->
          <div class="space-y-2">
            <Label class="text-xs font-bold">Variant</Label>
            <Input v-model="form.variant" placeholder="e.g. 1.5 i-VTEC V" class="h-10" />
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button variant="ghost" @click="showDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSubmitting" class="gap-2" @click="handleSubmit">
            <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="size-4 animate-spin" />
            {{ isEditing ? 'Save' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Dialog -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this variance?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{{ deleteTarget?.make }} {{ deleteTarget?.model }} {{ deleteTarget?.variant }}</strong>.
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
