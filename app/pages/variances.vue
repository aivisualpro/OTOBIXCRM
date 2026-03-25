<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })
useHead({ title: 'Variances Dashboard — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Variances Analytics', icon: 'i-lucide-layers', description: 'Advanced control and distribution metrics for vehicle data' })

const {
  carDropdowns,
  totalCount,
  isLoading,
  fetchCarDropdowns,
  addDropdown,
  editDropdown,
  deleteDropdown,
  toggleStatus,
} = useCarDropdowns()

const search = ref('')
const selectedMake = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = 50

// ─── Metrics Calculation ───
// We use carDropdowns as a sample for distributions
const metrics = computed(() => {
  const makes = new Set<string>()
  const models = new Set<string>()
  carDropdowns.value.forEach((item) => {
    if (item.make)
      makes.add(item.make)
    if (item.model)
      models.add(`${item.make}-${item.model}`)
  })
  return {
    totalMakes: makes.size,
    totalModels: models.size,
    totalVariants: totalCount.value,
    activeCount: carDropdowns.value.filter(d => d.isActive !== false).length,
  }
})

// Brand Distribution for the Top 5
const brandDist = computed(() => {
  const counts: Record<string, number> = {}
  carDropdowns.value.forEach((item) => {
    if (item.make)
      counts[item.make] = (counts[item.make] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([make, count]) => ({
      name: make,
      percent: Math.round((count / carDropdowns.value.length) * 100) || 0,
      count,
    }))
})

// ─── Data State Management ───
const reload = async () => {
  currentPage.value = 1
  await fetchCarDropdowns({
    page: 1,
    limit: pageSize,
    search: search.value,
  })
}

const debouncedSearch = useDebounceFn(() => reload(), 300)
watch(search, debouncedSearch)

watch(selectedMake, (newMake) => {
  search.value = newMake || ''
})

onMounted(async () => {
  await reload()
})

const hasMore = computed(() => carDropdowns.value.length < totalCount.value)

async function loadMore() {
  if (isLoading.value || !hasMore.value)
    return
  currentPage.value++
  await fetchCarDropdowns({
    page: currentPage.value,
    limit: pageSize,
    search: search.value,
    append: true,
  })
}

// ─── Sidebar Groups ───
const brandsWithCounts = computed(() => {
  const map: Record<string, number> = {}
  carDropdowns.value.forEach((d) => {
    if (d.make)
      map[d.make] = (map[d.make] || 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

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
    toast.error('Sync failed: ' + (err.message || 'Network error'))
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
  catch (err) { toast.error('Delete failed') }
  finally { isDeleting.value = false }
}

async function handleToggleStatus(item: any) {
  try {
    const prev = item.isActive !== false
    await toggleStatus(item._id)
    const target = carDropdowns.value.find(d => d._id === item._id)
    if (target) target.isActive = !prev
    toast.success('Status broadcasted')
  }
  catch (err) { toast.error('Toggle failed') }
}
</script>

<template>
  <div class="h-full flex flex-col bg-background/50 backdrop-blur-3xl">
    <!-- Super UI Header Actions -->
    <HeaderActions>
      <Badge variant="outline" class="h-7 text-[10px] font-bold border-primary/20 bg-primary/5 hidden xl:flex">
        DB SYNC OK
      </Badge>
      <Button variant="ghost" size="sm" class="h-8 hover:bg-muted/50 transition-all font-semibold" :disabled="isLoading" @click="reload">
        <Icon name="i-lucide-refresh-cw" class="mr-1.5 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Hard Refresh
      </Button>
      <Button size="sm" class="h-8 shadow-[0_2px_10px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all text-xs font-bold px-4" @click="openCreate">
        <Icon name="i-lucide-zap" class="mr-1.5 size-3.5 fill-current" />
        INIT NEW VARIANCE
      </Button>
    </HeaderActions>

    <!-- Analytics Dashboard Bar -->
    <section class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 lg:px-6">
      <!-- Total Variants -->
      <Card class="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-primary/10 relative overflow-hidden group">
        <div class="p-4 relative z-10">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-primary/70">Vehicle Variants</span>
            <Icon name="i-lucide-activity" class="size-4 text-primary animate-pulse" />
          </div>
          <p class="text-3xl font-black tabular-nums tracking-tighter">{{ totalCount }}</p>
          <div class="flex items-center gap-1.5 mt-2">
            <div class="h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <div class="h-full bg-primary" :style="{ width: `${(carDropdowns.length / totalCount) * 100}%` }" />
            </div>
            <span class="text-[9px] font-bold text-muted-foreground">{{ Math.round((carDropdowns.length / totalCount) * 100) }}% Ready</span>
          </div>
        </div>
      </Card>

      <!-- Distribution Metrics -->
      <Card v-for="brand in brandDist" :key="brand.name" class="hidden md:block bg-card/40 backdrop-blur-md border border-border/50 hover:border-primary/30 transition-all">
        <div class="p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{{ brand.name }} Distribution</span>
            <span class="text-[10px] font-black text-primary">{{ brand.percent }}%</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="size-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-car-front" class="size-4 text-muted-foreground" />
            </div>
            <div class="flex-1 space-y-1.5">
              <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-700" :style="{ width: `${brand.percent}%` }" />
              </div>
              <p class="text-[9px] font-bold text-muted-foreground uppercase flex justify-between">
                {{ brand.count }} Models Indexed <Icon name="i-lucide-trending-up" class="size-2.5" />
              </p>
            </div>
          </div>
        </div>
      </Card>
    </section>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden lg:px-6 pb-6 gap-6">
      <!-- Awesome Sidebar Grouping -->
      <aside class="w-64 shrink-0 flex flex-col gap-4">
        <Card class="flex-1 overflow-hidden bg-white/5 dark:bg-black/5 shadow-xl border-border/50 backdrop-blur items-stretch flex flex-col">
          <div class="p-4 border-b flex items-center justify-between bg-muted/30">
            <h3 class="text-xs font-extra-bold uppercase tracking-[0.2em] text-foreground/70">Master Brands</h3>
            <Badge variant="secondary" class="h-5 text-[9px] font-bold">{{ metrics.totalMakes }}</Badge>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            <!-- Active Search Filter -->
            <div class="relative mb-6">
              <Icon name="i-lucide-filter" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input v-model="search" placeholder="Quick Filter..." class="pl-8 h-8 text-[11px] bg-muted/20 border-border/50 focus-visible:ring-primary/20" />
            </div>

            <nav class="space-y-1">
              <button
                class="w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group relative overflow-hidden"
                :class="selectedMake === null ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-muted text-muted-foreground hover:text-foreground'"
                @click="selectedMake = null"
              >
                <div class="flex items-center gap-2.5 relative z-10">
                  <Icon name="i-lucide-layers" class="size-3.5" />
                  All Distribution
                </div>
                <span class="text-[10px] tabular-nums font-black opacity-60">{{ totalCount }}</span>
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
                <Badge :variant="selectedMake === make ? 'default' : 'outline'" class="h-4.5 px-1.5 text-[9px] font-black border-none">{{ count }}</Badge>
              </button>
            </nav>
          </div>
        </Card>
      </aside>

      <!-- Premium Data Matrix -->
      <main class="flex-1 flex flex-col min-w-0 bg-white/5 dark:bg-black/5 rounded-3xl border border-border/50 shadow-2xl overflow-hidden backdrop-blur-sm">
        <header class="p-6 border-b bg-muted/5 flex items-center justify-between">
          <div class="space-y-1">
            <h2 class="text-xl font-black tracking-tight text-foreground flex items-center gap-3">
              {{ selectedMake || 'Complete Collection' }}
              <Badge variant="outline" class="text-[10px] font-bold opacity-50">{{ carDropdowns.length }} Indices</Badge>
            </h2>
            <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Global Aggregate Pipeline Active</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-10 w-px bg-border/10" />
            <div class="text-right">
              <p class="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Global Coverage</p>
              <div class="flex items-center gap-2">
                <span class="text-lg font-black tabular-nums tracking-tighter">{{ metrics.activeCount }}</span>
                <span class="text-[10px] text-emerald-500 font-black">+14%</span>
              </div>
            </div>
          </div>
        </header>

        <div class="flex-1 overflow-auto custom-scrollbar p-1">
          <Table class="relative">
            <TableHeader class="sticky top-0 z-30 bg-background/90 backdrop-blur-2xl">
              <TableRow class="hover:bg-transparent border-b-2 border-primary/5">
                <TableHead class="w-14 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">ID</TableHead>
                <TableHead class="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Structure</TableHead>
                <TableHead class="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Variant Logic</TableHead>
                <TableHead class="w-32 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest px-0">Status</TableHead>
                <TableHead class="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(item, idx) in carDropdowns" :key="item._id" class="group transition-all hover:bg-muted/30 border-b border-border/20">
                <TableCell class="text-center text-[10px] font-black text-muted-foreground/50 px-0 tabular-nums">#{{ idx + 1 + (currentPage - 1) * pageSize }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-3 py-1">
                    <div class="size-9 rounded-xl flex items-center justify-center bg-gradient-to-tr from-muted/50 to-transparent border border-border/50 text-[11px] font-black tracking-tighter text-muted-foreground group-hover:text-primary transition-colors">
                      {{ item.make.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <p class="text-[10px] font-black text-primary/70 mb-0.5 uppercase tracking-wide">{{ item.make }}</p>
                      <p class="text-[13px] font-black text-foreground tracking-tight group-hover:translate-x-1 transition-transform">{{ item.model }}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="py-1">
                    <span class="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] font-black text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      {{ item.variant }}
                    </span>
                  </div>
                </TableCell>
                <TableCell class="text-center px-0">
                  <div class="flex justify-center">
                    <Switch
                      :checked="item.isActive !== false"
                      class="data-[state=checked]:bg-emerald-500 scale-90 border-transparent shadow-md"
                      @update:checked="handleToggleStatus(item)"
                    />
                  </div>
                </TableCell>
                <TableCell class="text-right pr-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="size-8 opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                        <Icon name="i-lucide-more-vertical" class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40 p-1.5 rounded-xl border-border/50 backdrop-blur-xl">
                      <DropdownMenuItem class="rounded-lg h-9 text-xs font-bold gap-2" @click="openEdit(item)">
                        <Icon name="i-lucide-pencil" class="size-3.5 text-muted-foreground" />
                        Edit Metrics
                      </DropdownMenuItem>
                      <DropdownMenuSeparator class="bg-border/30" />
                      <DropdownMenuItem class="rounded-lg h-9 text-xs font-bold gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive" @click="confirmDelete(item)">
                        <Icon name="i-lucide-trash-2" class="size-3.5" />
                        Purge Index
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>

              <!-- Advanced Load Discovery -->
              <TableRow v-if="hasMore" class="hover:bg-transparent">
                <TableCell colspan="5" class="p-10">
                  <div class="flex flex-col items-center gap-6">
                    <div class="flex items-center gap-1.5 p-1 bg-muted/30 rounded-full border border-border/50">
                      <div class="px-6 py-2.5 rounded-full bg-background text-[11px] font-black text-muted-foreground border border-border/20 shadow-sm">
                        TOTAL INDEXED: {{ totalCount }}
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
          <DialogTitle class="text-2xl font-black tracking-tight">{{ isEditing ? 'Edit Vehicle Essence' : 'Initialize New Intelligence' }}</DialogTitle>
          <DialogDescription class="text-[10px] font-black text-muted-foreground tracking-widest uppercase">Mapping the global vehicle matrix</DialogDescription>
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
              <p class="text-[10px] font-bold text-muted-foreground">Broadcast availability to global nodes</p>
            </div>
            <Switch :checked="form.isActive" @update:checked="(v) => form.isActive = v" class="data-[state=checked]:bg-emerald-500" />
          </div>
        </div>

        <DialogFooter class="sm:justify-between gap-4 mt-2">
          <Button variant="ghost" class="h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-muted/50" @click="showDialog = false">Abort Sync</Button>
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
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
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
