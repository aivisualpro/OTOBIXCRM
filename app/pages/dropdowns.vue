<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })
useHead({ title: 'Dropdowns — OTOBIX' })

const { setHeader } = usePageHeader()
setHeader({ title: 'Dropdowns', icon: 'i-lucide-list', description: 'Manage dropdown collections' })

// ─── State ───
interface DropdownValue {
  [key: string]: any
}

interface DropdownItem {
  _id: string
  dropdownName: string
  dropdownValues: DropdownValue[]
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

const dropdowns = ref<DropdownItem[]>([])
const isLoading = ref(false)
const isFetched = ref(false)
const fetchError = ref<string | null>(null)
const search = ref('')

// ─── Fetch ───
async function fetchDropdowns() {
  isLoading.value = true
  fetchError.value = null
  try {
    const res = await $fetch<any>('/api/dropdowns')
    dropdowns.value = (res.dropdowns || []).map((d: any) => ({
      ...d,
      _id: d._id?.$oid || d._id || d.id,
    }))
    isFetched.value = true
  }
  catch (err: any) {
    fetchError.value = err?.data?.message || err?.message || 'Failed to fetch dropdowns'
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => fetchDropdowns())

// ─── Filtered + Infinite scroll ───
const BATCH_SIZE = 24
const visibleCount = ref(BATCH_SIZE)

watch(search, () => { visibleCount.value = BATCH_SIZE })

const filteredItems = computed(() => {
  if (!search.value) return dropdowns.value
  const q = search.value.toLowerCase()
  return dropdowns.value.filter(d =>
    d.dropdownName.toLowerCase().includes(q)
    || JSON.stringify(d.dropdownValues).toLowerCase().includes(q),
  )
})

const totalFiltered = computed(() => filteredItems.value.length)
const hasMore = computed(() => visibleCount.value < totalFiltered.value)
const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))

function loadMore() {
  if (hasMore.value) {
    visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, totalFiltered.value)
  }
}

const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    },
    { rootMargin: '200px' },
  )
})

onBeforeUnmount(() => { observer?.disconnect() })

watch(scrollSentinel, (el) => {
  observer?.disconnect()
  if (el) observer?.observe(el)
})

// ─── Expanded cards ───
const expandedCards = ref<Set<string>>(new Set())

function toggleExpand(id: string) {
  if (expandedCards.value.has(id)) {
    expandedCards.value.delete(id)
  } else {
    expandedCards.value.add(id)
  }
}

// ─── Create / Edit Dialog ───
const showDialog = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)

interface FormState {
  _id: string
  dropdownName: string
  dropdownValues: DropdownValue[]
  isActive: boolean
}

const form = ref<FormState>({
  _id: '',
  dropdownName: '',
  dropdownValues: [{}],
  isActive: true,
})

const valueKeys = ref<string[]>([])
const newKeyInput = ref('')

// Track whether the current form is editing string values vs object values
const isStringMode = ref(false)
// For string mode: a simple array of strings
const stringValues = ref<string[]>([])

function openCreate() {
  isEditing.value = false
  isStringMode.value = true
  form.value = { _id: '', dropdownName: '', dropdownValues: [{}], isActive: true }
  stringValues.value = ['']
  valueKeys.value = []
  newKeyInput.value = ''
  showDialog.value = true
}

function openEdit(item: DropdownItem) {
  isEditing.value = true
  form.value = {
    _id: item._id,
    dropdownName: item.dropdownName,
    dropdownValues: [],
    isActive: item.isActive,
  }

  // Detect if values are strings or objects
  const hasStringValues = item.dropdownValues?.some(v => typeof v === 'string')

  if (hasStringValues || !item.dropdownValues?.length) {
    // String mode
    isStringMode.value = true
    stringValues.value = (item.dropdownValues || []).map((v: any) => typeof v === 'string' ? v : String(v))
    if (stringValues.value.length === 0) stringValues.value = ['']
    valueKeys.value = []
  } else {
    // Object mode
    isStringMode.value = false
    form.value.dropdownValues = JSON.parse(JSON.stringify(item.dropdownValues))
    const allKeys = new Set<string>()
    item.dropdownValues?.forEach((v: any) => {
      if (typeof v === 'object' && v !== null) {
        Object.keys(v).forEach(k => { if (k !== '_id') allKeys.add(k) })
      }
    })
    valueKeys.value = [...allKeys]
    stringValues.value = []
  }

  newKeyInput.value = ''
  showDialog.value = true
}

function addKey() {
  const key = newKeyInput.value.trim()
  if (!key || valueKeys.value.includes(key)) return
  valueKeys.value.push(key)
  form.value.dropdownValues.forEach((v) => {
    if (!(key in v)) v[key] = ''
  })
  newKeyInput.value = ''
}

function removeKey(key: string) {
  valueKeys.value = valueKeys.value.filter(k => k !== key)
  form.value.dropdownValues.forEach((v) => {
    delete v[key]
  })
}

function addValueRow() {
  if (isStringMode.value) {
    stringValues.value.push('')
  } else {
    const row: Record<string, string> = {}
    valueKeys.value.forEach(k => { row[k] = '' })
    form.value.dropdownValues.push(row)
  }
}

function removeValueRow(index: number) {
  if (isStringMode.value) {
    stringValues.value.splice(index, 1)
  } else {
    form.value.dropdownValues.splice(index, 1)
  }
}

async function handleSubmit() {
  if (!form.value.dropdownName.trim()) {
    toast.error('Dropdown name is required')
    return
  }

  isSubmitting.value = true
  try {
    // Build the final values array based on current mode
    let finalValues: any[]
    if (isStringMode.value) {
      finalValues = stringValues.value.filter(v => v.trim() !== '')
    } else {
      finalValues = form.value.dropdownValues.filter(v =>
        Object.values(v).some(val => val !== '' && val !== null && val !== undefined),
      )
    }

    if (isEditing.value) {
      await $fetch('/api/dropdowns', {
        method: 'PUT',
        body: {
          _id: form.value._id,
          dropdownName: form.value.dropdownName,
          dropdownValues: finalValues,
          isActive: form.value.isActive,
        },
      })
      toast.success('Dropdown updated successfully')
    }
    else {
      await $fetch('/api/dropdowns', {
        method: 'POST',
        body: {
          dropdownName: form.value.dropdownName,
          dropdownValues: finalValues,
          isActive: form.value.isActive,
        },
      })
      toast.success('Dropdown created successfully')
    }

    showDialog.value = false
    await fetchDropdowns()
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to save dropdown')
  }
  finally {
    isSubmitting.value = false
  }
}

// ─── Delete ───
const showDeleteDialog = ref(false)
const deleteTarget = ref<DropdownItem | null>(null)
const isDeleting = ref(false)

function confirmDelete(item: DropdownItem) {
  deleteTarget.value = item
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await $fetch('/api/dropdowns', {
      method: 'DELETE',
      body: { _id: deleteTarget.value._id },
    })
    toast.success(`"${deleteTarget.value.dropdownName}" deleted`)
    showDeleteDialog.value = false
    deleteTarget.value = null
    await fetchDropdowns()
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to delete dropdown')
  }
  finally {
    isDeleting.value = false
  }
}

// ─── Helpers ───
function timeAgo(value?: string): string {
  if (!value) return '—'
  const now = new Date()
  const date = new Date(value)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

async function handleRefresh() {
  await fetchDropdowns()
  toast.success('Dropdowns refreshed')
}

function isStringArray(item: DropdownItem): boolean {
  return item.dropdownValues?.some(v => typeof v === 'string') ?? false
}

function getValueKeys(item: DropdownItem): string[] {
  if (isStringArray(item)) return []
  const keys = new Set<string>()
  item.dropdownValues?.forEach(v => {
    if (typeof v === 'object' && v !== null) {
      Object.keys(v).forEach(k => { if (k !== '_id') keys.add(k) })
    }
  })
  return [...keys]
}

function getDisplayValue(val: any): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return JSON.stringify(val)
}

function getCardColor(index: number) {
  const colors = [
    { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', icon: 'bg-blue-500' },
    { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20', icon: 'bg-violet-500' },
    { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', icon: 'bg-emerald-500' },
    { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', icon: 'bg-amber-500' },
    { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/20', icon: 'bg-pink-500' },
    { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/20', icon: 'bg-teal-500' },
    { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20', icon: 'bg-sky-500' },
    { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20', icon: 'bg-orange-500' },
  ]
  return colors[index % colors.length]!
}
</script>

<template>
  <!-- Teleport toolbar -->
  <ClientOnly>
    <Teleport to="#header-actions">
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="Search dropdowns..." class="pl-8 h-8 w-48 text-sm" />
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} dropdown{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
      <Button size="sm" class="h-8" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
        Add Dropdown
      </Button>
    </Teleport>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <!-- Error Banner -->
    <div v-if="fetchError" class="shrink-0 m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <div class="size-10 rounded-xl bg-destructive/10 flex items-center justify-center">
        <Icon name="i-lucide-alert-circle" class="size-5 text-destructive" />
      </div>
      <div class="flex-1">
        <p class="text-sm font-semibold text-destructive">Failed to load dropdowns</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ fetchError }}</p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" />
        Retry
      </Button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 overflow-auto p-4 lg:p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="rounded-2xl border bg-card overflow-hidden animate-pulse">
          <div class="p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-xl bg-muted" />
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-muted rounded w-2/3" />
                <div class="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
            <div class="space-y-2">
              <div class="h-8 bg-muted rounded" />
              <div class="h-8 bg-muted rounded" />
              <div class="h-8 bg-muted rounded" />
            </div>
            <div class="flex gap-2">
              <div class="h-5 bg-muted rounded w-16" />
              <div class="h-5 bg-muted rounded w-12" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cards Grid -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto">
      <TransitionGroup name="cards" tag="div" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="(item, idx) in visibleItems"
          :key="item._id"
          class="dropdown-card group relative rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20"
          :style="{ '--delay': `${idx * 40}ms` }"
        >
          <!-- Card Header -->
          <div class="p-5 pb-0">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="size-10 shrink-0 rounded-xl flex items-center justify-center"
                  :class="[getCardColor(idx).bg, getCardColor(idx).text]"
                >
                  <Icon name="i-lucide-list" class="size-5" />
                </div>
                <h3 class="font-semibold text-sm leading-tight">
                  {{ item.dropdownName }}
                </h3>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" class="text-[10px] tabular-nums font-medium h-5 px-1.5">
                  {{ item.dropdownValues?.length || 0 }} items
                </Badge>
                <Badge
                  variant="outline"
                  class="text-[10px] font-medium h-5 px-1.5"
                  :class="item.isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-gray-500/10 text-gray-500 border-gray-500/20'"
                >
                  <span class="size-1.5 rounded-full mr-1" :class="item.isActive ? 'bg-emerald-500' : 'bg-gray-400'" />
                  {{ item.isActive ? 'Active' : 'Inactive' }}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="i-lucide-more-vertical" class="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-36">
                  <DropdownMenuItem @click="openEdit(item)">
                    <Icon name="i-lucide-pencil" class="size-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive focus:text-destructive" @click="confirmDelete(item)">
                    <Icon name="i-lucide-trash-2" class="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <!-- Values Preview -->
          <div class="px-5 pt-4 pb-2">
            <template v-if="item.dropdownValues?.length > 0">

              <!-- STRING VALUES: simple list -->
              <template v-if="isStringArray(item)">
                <div class="space-y-1">
                  <div
                    v-for="(val, vIdx) in (expandedCards.has(item._id) ? item.dropdownValues : item.dropdownValues.slice(0, 5))"
                    :key="vIdx"
                    class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/50"
                    :class="vIdx % 2 === 0 ? 'bg-muted/20' : ''"
                  >
                    <span class="size-1.5 rounded-full shrink-0" :class="getCardColor(idx).icon" />
                    <span class="font-medium text-foreground truncate">
                      {{ getDisplayValue(val) }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- OBJECT VALUES: column table -->
              <template v-else>
                <!-- Column Headers -->
                <div
                  v-if="getValueKeys(item).length > 0"
                  class="flex items-center gap-2 mb-2 px-2.5"
                >
                  <span class="w-5" />
                  <span
                    v-for="key in getValueKeys(item).slice(0, 3)"
                    :key="key"
                    class="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate"
                  >
                    {{ key }}
                  </span>
                </div>

                <!-- Value Rows -->
                <div class="space-y-1">
                  <div
                    v-for="(val, vIdx) in (expandedCards.has(item._id) ? item.dropdownValues : item.dropdownValues.slice(0, 5))"
                    :key="vIdx"
                    class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/50"
                    :class="vIdx % 2 === 0 ? 'bg-muted/20' : ''"
                  >
                    <span class="size-1.5 rounded-full shrink-0" :class="getCardColor(idx).icon" />
                    <template v-if="getValueKeys(item).length > 0">
                      <span
                        v-for="key in getValueKeys(item).slice(0, 3)"
                        :key="key"
                        class="flex-1 truncate"
                        :class="key === getValueKeys(item)[0] ? 'font-medium text-foreground' : 'text-muted-foreground'"
                      >
                        {{ val[key] ?? '—' }}
                      </span>
                    </template>
                    <template v-else>
                      <span class="text-muted-foreground truncate">
                        {{ JSON.stringify(val).slice(0, 60) }}
                      </span>
                    </template>
                  </div>
                </div>
              </template>

              <!-- Show More / Less -->
              <button
                v-if="item.dropdownValues.length > 5"
                class="w-full mt-1 py-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1"
                @click="toggleExpand(item._id)"
              >
                <Icon
                  :name="expandedCards.has(item._id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="size-3"
                />
                {{ expandedCards.has(item._id) ? 'Show less' : `Show all ${item.dropdownValues.length} items` }}
              </button>
            </template>

            <!-- No Values -->
            <div v-else class="py-4 flex flex-col items-center gap-1 text-muted-foreground/50">
              <Icon name="i-lucide-inbox" class="size-6" />
              <span class="text-[11px] font-medium">No values defined</span>
            </div>
          </div>


        </div>
      </TransitionGroup>

      <!-- Empty state -->
      <div
        v-if="!isLoading && filteredItems.length === 0"
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <div class="size-24 rounded-3xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center mb-6 shadow-xl shadow-primary/5">
          <Icon name="i-lucide-list-x" class="size-10 text-primary/60" />
        </div>
        <h3 class="text-xl font-bold mb-1.5">
          {{ search ? 'No dropdowns match your search' : 'No dropdowns yet' }}
        </h3>
        <p class="text-sm text-muted-foreground max-w-sm mb-6">
          {{ search
            ? `We couldn't find any dropdowns matching "${search}".`
            : 'Get started by creating your first dropdown collection.'
          }}
        </p>
        <div class="flex items-center gap-3">
          <Button v-if="search" variant="outline" @click="search = ''">
            <Icon name="i-lucide-x" class="mr-1.5 size-4" />
            Clear search
          </Button>
          <Button @click="openCreate">
            <Icon name="i-lucide-plus" class="mr-1.5 size-4" />
            Add Dropdown
          </Button>
        </div>
      </div>

      <!-- Scroll sentinel -->
      <div v-if="hasMore" ref="scrollSentinel" class="flex items-center justify-center py-8">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
          Loading more...
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ visibleItems.length }} of {{ totalFiltered }} dropdowns
      </p>
    </div>
  </div>

  <!-- Create/Edit Sheet -->
  <Sheet v-model:open="showDialog">
    <SheetContent class="sm:max-w-2xl overflow-y-auto p-6">
      <SheetHeader>
        <SheetTitle class="flex items-center gap-2">
          <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon :name="isEditing ? 'i-lucide-pencil' : 'i-lucide-plus'" class="size-4 text-primary" />
          </div>
          {{ isEditing ? 'Edit Dropdown' : 'Create Dropdown' }}
        </SheetTitle>
        <SheetDescription>
          {{ isEditing ? 'Update the dropdown name, values, and status.' : 'Define a new dropdown with its values.' }}
        </SheetDescription>
      </SheetHeader>

      <div class="mt-6 space-y-5">
        <!-- Dropdown Name -->
        <div class="space-y-1.5">
          <Label for="dd-name">Dropdown Name <span class="text-destructive">*</span></Label>
          <Input id="dd-name" v-model="form.dropdownName" placeholder="e.g. Car Colors, Fuel Types" />
        </div>

        <!-- Active Toggle -->
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label for="dd-active">Active</Label>
            <p class="text-xs text-muted-foreground">Enable or disable this dropdown</p>
          </div>
          <Switch id="dd-active" :checked="form.isActive" @update:checked="form.isActive = $event" />
        </div>

        <!-- STRING MODE: Simple list editor -->
        <template v-if="isStringMode">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label>Values</Label>
              <Button variant="ghost" size="sm" class="h-7 text-xs" @click="addValueRow">
                <Icon name="i-lucide-plus" class="mr-1 size-3" />
                Add Value
              </Button>
            </div>
            <div class="space-y-1.5">
              <div
                v-for="(val, idx) in stringValues"
                :key="idx"
                class="flex items-center gap-2"
              >
                <div class="flex items-center justify-center size-6 shrink-0 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {{ idx + 1 }}
                </div>
                <Input
                  :model-value="stringValues[idx]"
                  @update:model-value="v => stringValues[idx] = v as string"
                  class="h-8 text-sm flex-1"
                  placeholder="Enter value..."
                />
                <Button
                  v-if="stringValues.length > 1"
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  @click="removeValueRow(idx)"
                >
                  <Icon name="i-lucide-x" class="size-3.5" />
                </Button>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground">{{ stringValues.filter(v => v.trim()).length }} value(s) defined</p>
          </div>
        </template>

        <!-- OBJECT MODE: Column-based table -->
        <template v-else>
          <!-- Value Keys Management -->
          <div class="space-y-2">
            <Label>Value Fields (columns for each value)</Label>
            <div class="flex flex-wrap gap-1.5 min-h-8">
              <Badge
                v-for="key in valueKeys"
                :key="key"
                variant="secondary"
                class="text-xs gap-1 pr-1"
              >
                {{ key }}
                <button class="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5" @click="removeKey(key)">
                  <Icon name="i-lucide-x" class="size-3 text-destructive" />
                </button>
              </Badge>
              <span v-if="valueKeys.length === 0" class="text-xs text-muted-foreground py-1">No fields added yet</span>
            </div>
            <div class="flex gap-2">
              <Input
                v-model="newKeyInput"
                placeholder="Add field name (e.g. label, value, color)"
                class="flex-1"
                @keyup.enter="addKey"
              />
              <Button variant="outline" size="sm" @click="addKey">
                <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
                Add Field
              </Button>
            </div>
          </div>

          <!-- Values Table -->
          <div v-if="valueKeys.length > 0" class="space-y-2">
            <div class="flex items-center justify-between">
              <Label>Values</Label>
              <Button variant="ghost" size="sm" class="h-7 text-xs" @click="addValueRow">
                <Icon name="i-lucide-plus" class="mr-1 size-3" />
                Add Row
              </Button>
            </div>
            <div class="rounded-lg border overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-muted/50">
                    <th v-for="key in valueKeys" :key="key" class="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {{ key }}
                    </th>
                    <th class="px-2 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in form.dropdownValues" :key="idx" class="border-t">
                    <td v-for="key in valueKeys" :key="key" class="px-2 py-1.5">
                      <Input v-model="row[key]" class="h-8 text-sm" :placeholder="key" />
                    </td>
                    <td class="px-2 py-1.5 text-center">
                      <Button
                        v-if="form.dropdownValues.length > 1"
                        variant="ghost"
                        size="icon"
                        class="size-7 text-muted-foreground hover:text-destructive"
                        @click="removeValueRow(idx)"
                      >
                        <Icon name="i-lucide-x" class="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <SheetFooter class="mt-6 pt-4 border-t">
        <Button variant="outline" @click="showDialog = false">Cancel</Button>
        <Button :disabled="isSubmitting" @click="handleSubmit">
          <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else :name="isEditing ? 'i-lucide-check' : 'i-lucide-plus'" class="mr-1.5 size-3.5" />
          {{ isEditing ? 'Save Changes' : 'Create Dropdown' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>

  <!-- Delete Confirmation -->
  <AlertDialog v-model:open="showDeleteDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2">
          <div class="size-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Icon name="i-lucide-alert-triangle" class="size-4 text-destructive" />
          </div>
          Delete Dropdown
        </AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete <strong>{{ deleteTarget?.dropdownName }}</strong>
          with {{ deleteTarget?.dropdownValues?.length || 0 }} values? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="showDeleteDialog = false">Cancel</AlertDialogCancel>
        <Button variant="destructive" :disabled="isDeleting" @click="handleDelete">
          <Icon v-if="isDeleting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
          Delete
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<style scoped>
.dropdown-card {
  animation: card-appear 0.4s ease both;
  animation-delay: var(--delay, 0ms);
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.cards-enter-active {
  transition: all 0.4s ease;
}
.cards-leave-active {
  transition: all 0.3s ease;
}
.cards-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
.cards-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.cards-move {
  transition: transform 0.4s ease;
}
</style>
