<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })
useHead({ title: 'Car Margins — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Car Margins', icon: 'i-lucide-percent', description: 'Fixed margins · variable ranges · pricing tiers' })

// ─── Types ───
interface VariableRange {
  min: number | string
  max: number | string
  margin: number | string
  [key: string]: any
}

interface CarMargin {
  _id: string
  fixedMargin: number
  variableRanges: VariableRange[]
}

// ─── State ───
const margins = ref<CarMargin[]>([])
const isLoading = ref(false)
const isFetched = ref(false)
const fetchError = ref<string | null>(null)

// ─── Fetch ───
async function fetchMargins() {
  isLoading.value = true
  fetchError.value = null
  try {
    const res = await $fetch<any>('/api/car-margins')
    margins.value = (res.margins || []).map((m: any) => ({
      ...m,
      _id: m._id?.$oid || m._id || m.id,
      fixedMargin: Number(m.fixedMargin) || 0,
      variableRanges: m.variableRanges || [],
    }))
    isFetched.value = true
  }
  catch (err: any) {
    fetchError.value = err?.data?.message || err?.message || 'Failed to fetch car margins'
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => fetchMargins())

// ─── Flatten all ranges ───
interface FlatRange {
  recordId: string
  fixedMargin: number
  rangeIndex: number
  data: VariableRange
}

const _allRanges = computed<FlatRange[]>(() => {
  const result: FlatRange[] = []
  margins.value.forEach((m) => {
    ;(m.variableRanges || []).forEach((r: any, idx: number) => {
      result.push({ recordId: m._id, fixedMargin: m.fixedMargin, rangeIndex: idx, data: r })
    })
  })
  return result
})

// ─── Card Colors ───
const cardThemes = [
  { bg: 'from-red-50 to-red-100/50', border: 'border-red-300', badge: 'bg-red-100 text-red-600', accent: 'border-red-400', pill: 'bg-white border-red-200' },
  { bg: 'from-yellow-50 to-yellow-100/50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', accent: 'border-yellow-400', pill: 'bg-white border-yellow-200' },
  { bg: 'from-green-50 to-green-100/50', border: 'border-green-300', badge: 'bg-green-100 text-green-600', accent: 'border-green-400', pill: 'bg-white border-green-200' },
  { bg: 'from-blue-50 to-blue-100/50', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-600', accent: 'border-blue-400', pill: 'bg-white border-blue-200' },
  { bg: 'from-purple-50 to-purple-100/50', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-600', accent: 'border-purple-400', pill: 'bg-white border-purple-200' },
  { bg: 'from-pink-50 to-pink-100/50', border: 'border-pink-300', badge: 'bg-pink-100 text-pink-600', accent: 'border-pink-400', pill: 'bg-white border-pink-200' },
  { bg: 'from-orange-50 to-orange-100/50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-600', accent: 'border-orange-400', pill: 'bg-white border-orange-200' },
  { bg: 'from-cyan-50 to-cyan-100/50', border: 'border-cyan-300', badge: 'bg-cyan-100 text-cyan-600', accent: 'border-cyan-400', pill: 'bg-white border-cyan-200' },
]

function getTheme(idx: number) {
  return cardThemes[idx % cardThemes.length]!
}

// ─── Format cell value ───
function formatValue(val: any): string {
  if (val === null || val === undefined)
    return '—'
  if (typeof val === 'number')
    return val.toLocaleString()
  return String(val)
}

// ─── Field label formatter ───
function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase()).trim()
}

// ─── Get display keys from a range object ───
function getRangeKeys(data: any): string[] {
  if (typeof data !== 'object' || data === null)
    return []
  return Object.keys(data).filter(k => k !== '_id' && k !== '$oid')
}

// ─── CRUD Dialog ───
const showDialog = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)

interface FormState {
  _id: string
  fixedMargin: number
  variableRanges: VariableRange[]
}

const form = ref<FormState>({
  _id: '',
  fixedMargin: 0,
  variableRanges: [{ min: '', max: '', margin: '' }],
})

function openCreate() {
  isEditing.value = false
  form.value = {
    _id: '',
    fixedMargin: 0,
    variableRanges: [{ min: '', max: '', margin: '' }],
  }
  showDialog.value = true
}

function openEdit(record: CarMargin) {
  isEditing.value = true
  form.value = {
    _id: record._id,
    fixedMargin: record.fixedMargin,
    variableRanges: JSON.parse(JSON.stringify(record.variableRanges.length ? record.variableRanges : [{ min: '', max: '', margin: '' }])),
  }
  showDialog.value = true
}

function addRange() {
  form.value.variableRanges.push({ min: '', max: '', margin: '' })
}

function removeRange(idx: number) {
  if (form.value.variableRanges.length > 1) {
    form.value.variableRanges.splice(idx, 1)
  }
}

async function handleSubmit() {
  isSubmitting.value = true
  try {
    const payload = {
      ...form.value,
      fixedMargin: Number(form.value.fixedMargin),
      variableRanges: form.value.variableRanges.map(r => ({
        min: Number(r.min) || 0,
        max: Number(r.max) || 0,
        margin: Number(r.margin) || 0,
      })),
    }

    if (isEditing.value) {
      await $fetch('/api/car-margins', { method: 'PUT', body: payload })
      toast.success('Car margin updated')
    }
    else {
      await $fetch('/api/car-margins', { method: 'POST', body: payload })
      toast.success('Car margin created')
    }

    showDialog.value = false
    await fetchMargins()
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to save')
  }
  finally {
    isSubmitting.value = false
  }
}

// ─── Delete ───
const showDeleteDialog = ref(false)
const deletingId = ref('')

function confirmDelete(id: string) {
  deletingId.value = id
  showDeleteDialog.value = true
}

async function handleDelete() {
  try {
    await $fetch('/api/car-margins', { method: 'DELETE', body: { _id: deletingId.value } })
    toast.success('Car margin deleted')
    showDeleteDialog.value = false
    await fetchMargins()
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to delete')
  }
}
</script>

<template>
  <div>
    <ClientOnly>
      <Teleport to="#header-actions">
        <Button size="sm" class="h-8" @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Margin
        </Button>
      </Teleport>
    </ClientOnly>

    <div class="p-4 lg:p-6">
      <!-- Loading State -->
      <div v-if="isLoading && !isFetched" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="size-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p class="text-sm text-muted-foreground animate-pulse">
          Loading car margins…
        </p>
      </div>

      <!-- Error State -->
      <div v-else-if="fetchError" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="size-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon name="i-lucide-alert-circle" class="size-7 text-destructive" />
        </div>
        <p class="text-sm text-destructive font-medium">
          {{ fetchError }}
        </p>
        <Button variant="outline" size="sm" @click="fetchMargins">
          Retry
        </Button>
      </div>

      <!-- Empty State -->
      <div v-else-if="isFetched && margins.length === 0" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Icon name="i-lucide-percent" class="size-8 text-muted-foreground/50" />
        </div>
        <div class="text-center">
          <p class="text-base font-semibold">
            No car margins yet
          </p>
          <p class="text-sm text-muted-foreground mt-1">
            Create your first pricing tier to get started.
          </p>
        </div>
        <Button size="sm" @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Margin
        </Button>
      </div>

      <!-- Margin Records -->
      <div v-else class="space-y-8">
        <div v-for="record in margins" :key="record._id" class="space-y-3">
          <!-- Record header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-foreground">Fixed Margin: {{ record.fixedMargin }}%</span>
              <Badge variant="secondary" class="text-[10px] h-5 tabular-nums">
                {{ record.variableRanges?.length || 0 }} ranges
              </Badge>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="icon" class="size-7" title="Edit" @click="openEdit(record)">
                <Icon name="i-lucide-pencil" class="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" class="size-7 text-destructive" title="Delete" @click="confirmDelete(record._id)">
                <Icon name="i-lucide-trash-2" class="size-3.5" />
              </Button>
            </div>
          </div>

          <!-- Range cards grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="(range, idx) in (record.variableRanges || [])"
              :key="idx"
              class="range-card group relative rounded-2xl border-2 p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-br overflow-hidden"
              :class="[getTheme(idx).bg, getTheme(idx).border]"
              :style="{ animationDelay: `${idx * 60}ms` }"
            >
              <!-- Left accent bar -->
              <div
                class="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                :class="getTheme(idx).accent"
              />

              <!-- Header -->
              <div class="flex items-center justify-between mb-3 pl-2">
                <h3 class="text-sm font-bold text-foreground/80">
                  Range {{ idx + 1 }}
                </h3>
                <div
                  class="px-2.5 py-1 rounded-full text-xs font-bold tabular-nums"
                  :class="getTheme(idx).badge"
                >
                  {{ (range as any).margin ?? (range as any).percentage ?? (range as any).variableMargin ?? '' }}%
                </div>
              </div>

              <!-- Fields -->
              <div class="space-y-2 pl-2">
                <div v-for="key in getRangeKeys(range)" :key="key" class="space-y-0.5">
                  <p class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                    {{ formatLabel(key) }}
                  </p>
                  <div
                    class="rounded-lg border px-3 py-1.5 text-sm font-semibold text-foreground/80 shadow-sm"
                    :class="getTheme(idx).pill"
                  >
                    {{ formatValue((range as any)[key]) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon :name="isEditing ? 'i-lucide-pencil' : 'i-lucide-plus-circle'" class="size-5 text-primary" />
            {{ isEditing ? 'Edit Car Margin' : 'Create Car Margin' }}
          </DialogTitle>
          <DialogDescription>
            {{ isEditing ? 'Update the fixed margin and variable ranges.' : 'Set a fixed margin percentage and define variable price ranges.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-5 py-2">
          <!-- Fixed Margin -->
          <div class="space-y-1.5">
            <label class="text-sm font-semibold">Fixed Margin (%)</label>
            <input
              v-model.number="form.fixedMargin"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 2"
              class="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            >
          </div>

          <!-- Variable Ranges -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-semibold">Variable Ranges</label>
              <Button variant="outline" size="sm" class="h-7 text-xs" @click="addRange">
                <Icon name="i-lucide-plus" class="mr-1 size-3" />
                Add Range
              </Button>
            </div>

            <div
              v-for="(range, idx) in form.variableRanges"
              :key="idx"
              class="relative rounded-xl border p-3 space-y-2 bg-muted/10"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-muted-foreground">Range {{ idx + 1 }}</span>
                <Button
                  v-if="form.variableRanges.length > 1"
                  variant="ghost"
                  size="icon"
                  class="size-6 text-destructive"
                  @click="removeRange(idx)"
                >
                  <Icon name="i-lucide-x" class="size-3.5" />
                </Button>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="space-y-1">
                  <label class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Min</label>
                  <input
                    v-model="range.min"
                    type="number"
                    placeholder="0"
                    class="w-full h-8 px-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Max</label>
                  <input
                    v-model="range.max"
                    type="number"
                    placeholder="100"
                    class="w-full h-8 px-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Margin %</label>
                  <input
                    v-model="range.margin"
                    type="number"
                    step="0.1"
                    placeholder="10"
                    class="w-full h-8 px-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSubmitting" @click="handleSubmit">
            <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
            {{ isEditing ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-destructive">
            <Icon name="i-lucide-alert-triangle" class="size-5" />
            Delete Car Margin
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this margin record and all its variable ranges? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">
            Cancel
          </Button>
          <Button variant="destructive" @click="handleDelete">
            <Icon name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.range-card {
  animation: card-pop 0.4s ease both;
}

@keyframes card-pop {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
