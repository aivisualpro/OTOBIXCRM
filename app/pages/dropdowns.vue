<script setup lang="ts">
import { toast } from 'vue-sonner'

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
const BATCH_SIZE = 30
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

// Track keys for the values objects
const valueKeys = ref<string[]>([])
const newKeyInput = ref('')

function openCreate() {
  isEditing.value = false
  form.value = { _id: '', dropdownName: '', dropdownValues: [{}], isActive: true }
  valueKeys.value = []
  newKeyInput.value = ''
  showDialog.value = true
}

function openEdit(item: DropdownItem) {
  isEditing.value = true
  form.value = {
    _id: item._id,
    dropdownName: item.dropdownName,
    dropdownValues: item.dropdownValues?.length > 0
      ? JSON.parse(JSON.stringify(item.dropdownValues))
      : [{}],
    isActive: item.isActive,
  }
  // Extract keys from existing values
  const allKeys = new Set<string>()
  item.dropdownValues?.forEach((v: any) => {
    Object.keys(v).forEach(k => { if (k !== '_id') allKeys.add(k) })
  })
  valueKeys.value = [...allKeys]
  newKeyInput.value = ''
  showDialog.value = true
}

function addKey() {
  const key = newKeyInput.value.trim()
  if (!key || valueKeys.value.includes(key)) return
  valueKeys.value.push(key)
  // Add this key to each existing value row
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
  const row: Record<string, string> = {}
  valueKeys.value.forEach(k => { row[k] = '' })
  form.value.dropdownValues.push(row)
}

function removeValueRow(index: number) {
  form.value.dropdownValues.splice(index, 1)
}

async function handleSubmit() {
  if (!form.value.dropdownName.trim()) {
    toast.error('Dropdown name is required')
    return
  }

  isSubmitting.value = true
  try {
    // Clean values — filter out empty rows
    const cleanedValues = form.value.dropdownValues.filter(v =>
      Object.values(v).some(val => val !== '' && val !== null && val !== undefined),
    )

    if (isEditing.value) {
      await $fetch('/api/dropdowns', {
        method: 'PUT',
        body: {
          _id: form.value._id,
          dropdownName: form.value.dropdownName,
          dropdownValues: cleanedValues,
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
          dropdownValues: cleanedValues,
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
function formatDate(value?: string): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  catch { return value }
}

async function handleRefresh() {
  await fetchDropdowns()
  toast.success('Dropdowns refreshed')
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
        {{ totalFiltered }} record{{ totalFiltered !== 1 ? 's' : '' }}
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
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">Failed to load dropdowns</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ fetchError }}</p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">Retry</Button>
    </div>

    <!-- Loading -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">Loading dropdowns...</p>
      </div>
    </div>

    <!-- Table -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Values Count</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead class="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in visibleItems"
            :key="item._id"
            class="group hover:bg-muted/40 transition-colors"
          >
            <TableCell>
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-list" class="size-4 text-primary shrink-0" />
                <span class="font-medium">{{ item.dropdownName }}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" class="text-xs tabular-nums">
                {{ item.dropdownValues?.length || 0 }} items
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                :class="item.isActive
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-gray-500/10 text-gray-500 border-gray-500/20'"
              >
                {{ item.isActive ? 'Active' : 'Inactive' }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground text-sm">
              {{ formatDate(item.createdAt) }}
            </TableCell>
            <TableCell class="text-muted-foreground text-sm">
              {{ formatDate(item.updatedAt) }}
            </TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                <Button variant="ghost" size="icon" class="size-7" @click="openEdit(item)">
                  <Icon name="i-lucide-pencil" class="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" class="size-7 text-destructive hover:text-destructive" @click="confirmDelete(item)">
                  <Icon name="i-lucide-trash-2" class="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="visibleItems.length === 0 && !isLoading">
            <TableCell :colspan="6" class="h-32 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon name="i-lucide-inbox" class="size-8" />
                <p>No dropdowns found</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Scroll sentinel -->
      <div v-if="hasMore" ref="scrollSentinel" class="flex items-center justify-center py-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
          Loading more...
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ visibleItems.length }} of {{ totalFiltered }} records
      </p>
    </div>
  </div>

  <!-- Create/Edit Sheet -->
  <Sheet v-model:open="showDialog">
    <SheetContent class="sm:max-w-2xl overflow-y-auto p-6">
      <SheetHeader>
        <SheetTitle>{{ isEditing ? 'Edit Dropdown' : 'Create Dropdown' }}</SheetTitle>
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
        <AlertDialogTitle>Delete Dropdown</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete <strong>{{ deleteTarget?.dropdownName }}</strong>? This action cannot be undone.
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
