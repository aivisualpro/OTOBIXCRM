<script setup lang="ts">
import { toast } from 'vue-sonner'

// ─── Margin Helpers Logic ───
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

const margins = ref<CarMargin[]>([])
const isLoading = ref(false)
const isFetched = ref(false)
const fetchError = ref<string | null>(null)

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

onMounted(() => {
  if (!isFetched.value)
    fetchMargins()
})

const cardThemes = [
  { bg: 'from-blue-50 to-blue-100/50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', accent: 'bg-blue-400', pill: 'bg-white border-blue-200' },
  { bg: 'from-emerald-50 to-emerald-100/50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', accent: 'bg-emerald-400', pill: 'bg-white border-emerald-200' },
  { bg: 'from-amber-50 to-amber-100/50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', accent: 'bg-amber-400', pill: 'bg-white border-amber-200' },
  { bg: 'from-red-50 to-red-100/50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', accent: 'bg-red-400', pill: 'bg-white border-red-200' },
  { bg: 'from-purple-50 to-purple-100/50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', accent: 'bg-purple-400', pill: 'bg-white border-purple-200' },
  { bg: 'from-pink-50 to-pink-100/50', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-700', accent: 'bg-pink-400', pill: 'bg-white border-pink-200' },
  { bg: 'from-orange-50 to-orange-100/50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', accent: 'bg-orange-400', pill: 'bg-white border-orange-200' },
  { bg: 'from-cyan-50 to-cyan-100/50', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700', accent: 'bg-cyan-400', pill: 'bg-white border-cyan-200' },
]
function getTheme(idx: number) { return cardThemes[idx % cardThemes.length]! }

function formatValue(val: any): string {
  if (val === null || val === undefined) {
    return '—'
  }
  if (typeof val === 'number') {
    return val.toLocaleString()
  }
  return String(val)
}

// CRUD Dialog
const showDialog = ref(false)
const isEditingForm = ref(false)
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
  isEditingForm.value = false
  form.value = {
    _id: '',
    fixedMargin: 0,
    variableRanges: [{ min: '', max: '', margin: '' }],
  }
  showDialog.value = true
}

function openEdit(record: CarMargin) {
  isEditingForm.value = true
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

    if (isEditingForm.value) {
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

// Delete
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
  <div class="px-6 py-6 pb-20 w-full h-full">
    <ClientOnly>
      <Teleport to="#settings-tab-actions">
        <Button size="sm" class="h-8 shadow-sm" @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Global Scheme
        </Button>
      </Teleport>
    </ClientOnly>

    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading && !isFetched" class="flex flex-col items-center justify-center py-20 gap-4 border rounded-xl bg-muted/10">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        <p class="text-sm text-muted-foreground font-medium animate-pulse">
          Syncing logic tiers...
        </p>
      </div>

      <!-- Empty State -->
      <div v-else-if="isFetched && margins.length === 0" class="flex flex-col items-center justify-center py-20 gap-4 border border-dashed rounded-xl bg-muted/5">
        <div class="size-16 rounded-2xl bg-muted flex items-center justify-center">
          <Icon name="i-lucide-calculator" class="size-8 text-muted-foreground" />
        </div>
        <div class="text-center">
          <p class="text-base font-semibold">
            No margin tiers defined
          </p>
          <p class="text-sm text-muted-foreground mt-1">
            Add your pricing breakdown to automate margin execution.
          </p>
        </div>
        <Button class="mt-2" variant="outline" size="sm" @click="openCreate">
          Create First Scheme
        </Button>
      </div>

      <!-- Margin Records List -->
      <div v-else class="space-y-8 mt-6">
        <div v-for="record in margins" :key="record._id" class="rounded-xl border bg-card/50 p-6 shadow-sm">
          <!-- Record header -->
          <div class="flex items-center justify-between mb-8 pb-4 border-b">
            <div class="flex items-center gap-4">
              <div class="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Icon name="i-lucide-percent" class="size-5 text-emerald-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-foreground">
                  Global Tier Template
                </h3>
                <div class="flex items-center gap-2 mt-0.5 text-sm">
                  <span class="text-muted-foreground">Fixed Margin:</span>
                  <span class="font-bold text-emerald-600 tabular-nums">{{ record.fixedMargin }}%</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" @click="openEdit(record)">
                <Icon name="i-lucide-pencil" class="size-4 mr-2" /> Edit
              </Button>
              <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive hover:bg-destructive/10" @click="confirmDelete(record._id)">
                <Icon name="i-lucide-trash-2" class="size-4" />
              </Button>
            </div>
          </div>

          <!-- Tiers Grid -->
          <h4 class="text-sm font-semibold mb-4 text-muted-foreground">
            Dynamic Variable Ranges (Lacs)
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="(range, idx) in (record.variableRanges || [])"
              :key="idx"
              class="group relative rounded-xl border p-4 transition-all duration-300 hover:shadow-md bg-gradient-to-br overflow-hidden"
              :class="[getTheme(idx).bg, getTheme(idx).border]"
            >
              <!-- Left accent bar -->
              <div
                class="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                :class="getTheme(idx).accent"
              />

              <!-- Header -->
              <div class="flex items-center justify-between mb-3 pl-2">
                <h3 class="text-xs font-bold text-foreground/80 uppercase tracking-widest opacity-80">
                  Tier {{ idx + 1 }}
                </h3>
                <div
                  class="px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums shadow-sm"
                  :class="getTheme(idx).badge"
                >
                  Variable: {{ (range as any).margin ?? (range as any).percentage ?? (range as any).variableMargin ?? '' }}%
                </div>
              </div>

              <!-- Fields -->
              <div class="space-y-2 mt-4 pl-2 grid grid-cols-2 gap-x-2">
                <div class="space-y-0.5">
                  <p class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                    Min (Lacs)
                  </p>
                  <div class="rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums text-foreground/80 shadow-sm bg-white">
                    {{ formatValue((range as any).min) }}
                  </div>
                </div>
                <div class="space-y-0.5">
                  <p class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                    Max (Lacs)
                  </p>
                  <div class="rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums text-foreground/80 shadow-sm bg-white">
                    {{ formatValue((range as any).max) }}
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
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon :name="isEditingForm ? 'i-lucide-pencil' : 'i-lucide-plus-circle'" class="size-5 text-primary" />
            {{ isEditingForm ? 'Edit Margin Logic' : 'Create Margin Logic' }}
          </DialogTitle>
          <DialogDescription>
            Map your Price Discovery limits (in lacs) to dynamic variable percentages.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Fixed Margin -->
          <div class="space-y-2 bg-muted/30 p-4 rounded-xl border">
            <label class="text-sm font-semibold">Global Fixed Margin (%)</label>
            <input
              v-model.number="form.fixedMargin"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 2.0"
              class="w-full sm:max-w-[200px] h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
            <p class="text-xs text-muted-foreground mt-1">
              This fixed percentage is applied to all vehicles.
            </p>
          </div>

          <!-- Variable Ranges -->
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b">
              <label class="text-sm font-bold tracking-tight">Price Discovery Tiers</label>
              <Button size="sm" @click="addRange">
                <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
                Add Slab
              </Button>
            </div>

            <div
              v-for="(range, idx) in form.variableRanges"
              :key="idx"
              class="relative rounded-xl border p-4 bg-background shadow-sm hover:border-primary/50 transition-colors"
            >
              <div class="absolute -top-3 -left-2 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shadow-sm">
                {{ idx + 1 }}
              </div>
              <div class="absolute top-3 right-3">
                <Button
                  v-if="form.variableRanges.length > 1"
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  @click="removeRange(idx)"
                >
                  <Icon name="i-lucide-x" class="size-4" />
                </Button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-muted-foreground">Min (Lacs)</label>
                  <input
                    v-model="range.min"
                    type="number"
                    placeholder="0"
                    class="w-full h-9 px-3 rounded-md border bg-muted/5 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-primary/30 transition-all font-mono"
                  >
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-muted-foreground">Max (Lacs)</label>
                  <input
                    v-model="range.max"
                    type="number"
                    placeholder="2"
                    class="w-full h-9 px-3 rounded-md border bg-muted/5 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-primary/30 transition-all font-mono"
                  >
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-muted-foreground">Variable (%)</label>
                  <input
                    v-model="range.margin"
                    type="number"
                    step="0.1"
                    placeholder="16"
                    class="w-full h-9 px-3 rounded-md border bg-muted/5 text-sm outline-none focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all font-mono border-primary/20 bg-primary/5 font-bold"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="pt-4 border-t">
          <Button variant="outline" @click="showDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSubmitting" @click="handleSubmit">
            <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-1.5 size-4 animate-spin" />
            <Icon v-else name="i-lucide-save" class="mr-1.5 size-4" />
            {{ isEditingForm ? 'Update Configuration' : 'Save Configuration' }}
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
            Delete Margin Logic
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this global scheme? The calculation API will stop evaluating margins for these tiers.
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
