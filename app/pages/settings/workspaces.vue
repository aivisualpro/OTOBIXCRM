<script setup lang="ts">
import { toast } from 'vue-sonner'

const {
  workspaces,
  activeWorkspaceId,
  allMenuItems,
  addWorkspace,
  removeWorkspace,
  updateWorkspace,
  resetWorkspaces,
  setActiveWorkspace,
  fetchWorkspaces,
} = useWorkspace()

// ─── Sync from DB on page load ───
onMounted(() => fetchWorkspaces())

// ─── Add Workspace Dialog ───
const showAddDialog = ref(false)
const newWorkspaceName = ref('')
const newWorkspaceIcon = ref('i-lucide-briefcase')
const newWorkspaceDescription = ref('')
const newWorkspaceColor = ref('#6366f1')
const isSaving = ref(false)

const availableIcons = [
  { icon: 'i-lucide-briefcase', label: 'Briefcase' },
  { icon: 'i-lucide-building-2', label: 'Building' },
  { icon: 'i-lucide-store', label: 'Store' },
  { icon: 'i-lucide-factory', label: 'Factory' },
  { icon: 'i-lucide-warehouse', label: 'Warehouse' },
  { icon: 'i-lucide-truck', label: 'Truck' },
  { icon: 'i-lucide-wrench', label: 'Wrench' },
  { icon: 'i-lucide-cog', label: 'Cog' },
  { icon: 'i-lucide-globe', label: 'Globe' },
  { icon: 'i-lucide-rocket', label: 'Rocket' },
  { icon: 'i-lucide-star', label: 'Star' },
  { icon: 'i-lucide-zap', label: 'Zap' },
  { icon: 'i-lucide-shield-check', label: 'Shield' },
  { icon: 'i-lucide-scan-search', label: 'Search' },
  { icon: 'i-lucide-handshake', label: 'Handshake' },
  { icon: 'i-lucide-crown', label: 'Crown' },
  { icon: 'i-lucide-target', label: 'Target' },
  { icon: 'i-lucide-flame', label: 'Flame' },
]

const colorPresets = [
  { color: '#6366f1', label: 'Indigo' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#10b981', label: 'Emerald' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#ef4444', label: 'Red' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#f97316', label: 'Orange' },
  { color: '#14b8a6', label: 'Teal' },
  { color: '#64748b', label: 'Slate' },
  { color: '#84cc16', label: 'Lime' },
]

async function handleAddWorkspace() {
  if (!newWorkspaceName.value.trim()) {
    toast.error('Please enter a workspace name')
    return
  }
  isSaving.value = true
  try {
    const success = await addWorkspace(
      newWorkspaceName.value.trim(),
      newWorkspaceIcon.value,
      newWorkspaceDescription.value.trim(),
      newWorkspaceColor.value,
    )
    if (success) {
      toast.success(`Workspace "${newWorkspaceName.value}" created`)
      newWorkspaceName.value = ''
      newWorkspaceIcon.value = 'i-lucide-briefcase'
      newWorkspaceDescription.value = ''
      newWorkspaceColor.value = '#6366f1'
      showAddDialog.value = false
    }
    else {
      toast.error('A workspace with this name already exists')
    }
  }
  finally {
    isSaving.value = false
  }
}

// ─── Delete Confirmation ───
const showDeleteDialog = ref(false)
const deletingWorkspace = ref<{ workspaceId: string, name: string } | null>(null)

function confirmDelete(workspaceId: string, name: string) {
  if (workspaceId === 'admin') {
    toast.error('Cannot remove the Admin workspace')
    return
  }
  deletingWorkspace.value = { workspaceId, name }
  showDeleteDialog.value = true
}

async function handleRemoveWorkspace() {
  if (!deletingWorkspace.value)
    return
  await removeWorkspace(deletingWorkspace.value.workspaceId)
  toast.success(`Workspace "${deletingWorkspace.value.name}" removed`)
  showDeleteDialog.value = false
  deletingWorkspace.value = null
}

async function _handleReset() {
  await resetWorkspaces()
  toast.success('Workspaces reset to defaults')
}

// Group menu items by category for display
const menuGroups = computed(() => {
  const groups: Record<string, typeof allMenuItems> = {}
  allMenuItems.forEach((item) => {
    ;(groups[item.group] ??= []).push(item)
  })
  return Object.entries(groups)
})

// Active editing workspace
const editingWorkspaceId = ref(workspaces.value[0]?.workspaceId || 'admin')
const editingWorkspace = computed(() =>
  workspaces.value.find(w => w.workspaceId === editingWorkspaceId.value),
)

// Stats
const totalMenuItems = computed(() => allMenuItems.length)
const enabledMenuItems = computed(() => editingWorkspace.value?.menuIds?.length ?? 0)
const allSelected = computed(() => enabledMenuItems.value === totalMenuItems.value)

// ─── Local Menu Toggle (no API call) ───
const isDirty = ref(false)

function localToggle(menuId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return
  const current = [...ws.menuIds]
  const idx = current.indexOf(menuId)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(menuId)
  }
  ws.menuIds = current // Replace reference for reactivity
  isDirty.value = true
}

function selectAll() {
  const ws = editingWorkspace.value
  if (!ws)
    return
  ws.menuIds = allMenuItems.map(i => i.id)
  isDirty.value = true
}

function deselectAll() {
  const ws = editingWorkspace.value
  if (!ws)
    return
  ws.menuIds = [] // Reference change
  isDirty.value = true
}

function isGroupAllSelected(items: typeof allMenuItems): boolean {
  const ws = editingWorkspace.value
  if (!ws)
    return false
  return items.every(i => ws.menuIds.includes(i.id))
}

function toggleGroupAll(items: typeof allMenuItems) {
  const ws = editingWorkspace.value
  if (!ws)
    return
  const currentIds = items.map(i => i.id)
  if (isGroupAllSelected(items)) {
    ws.menuIds = ws.menuIds.filter(id => !currentIds.includes(id))
  }
  else {
    const toAdd = currentIds.filter(id => !ws.menuIds.includes(id))
    ws.menuIds = [...ws.menuIds, ...toAdd] // Reference change
  }
  isDirty.value = true
}

// ─── Save to MongoDB ───
const isSavingMenu = ref(false)

// Reset dirty flag when switching workspaces
watch(editingWorkspaceId, () => { isDirty.value = false })

async function saveMenuConfig() {
  const ws = editingWorkspace.value
  if (!ws)
    return
  isSavingMenu.value = true
  try {
    await updateWorkspace(ws.workspaceId, { menuIds: [...ws.menuIds] })
    isDirty.value = false
    toast.success('Menu configuration saved')
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to save')
  }
  finally {
    isSavingMenu.value = false
  }
}
</script>

<template>
  <div>
    <ClientOnly>
      <Teleport to="#header-actions">
        <Button size="sm" class="h-8" @click="showAddDialog = true">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Workspace
        </Button>
      </Teleport>
    </ClientOnly>

    <div class="space-y-6 p-4 lg:p-6">
      <!-- Workspace Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="ws in workspaces"
          :key="ws.workspaceId"
          class="workspace-card group relative rounded-xl border p-4 transition-all cursor-pointer"
          :class="{
            'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm': editingWorkspaceId === ws.workspaceId,
            'hover:border-muted-foreground/30 hover:bg-muted/30 hover:shadow-sm': editingWorkspaceId !== ws.workspaceId,
          }"
          @click="editingWorkspaceId = ws.workspaceId"
        >
          <!-- Color accent bar -->
          <div
            class="absolute top-0 left-0 right-0 h-1 rounded-t-xl transition-opacity"
            :style="{ backgroundColor: ws.color || '#6366f1' }"
            :class="editingWorkspaceId === ws.workspaceId ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'"
          />

          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate">
                {{ ws.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ ws.menuIds?.length || 0 }} menu items
              </p>
              <p v-if="ws.description" class="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                {{ ws.description }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <Badge
                v-if="activeWorkspaceId === ws.workspaceId"
                variant="outline"
                class="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              >
                <Icon name="i-lucide-circle-dot" class="size-2.5 mr-1" />
                Active
              </Badge>
              <div class="flex items-center gap-0.5">
                <Button
                  v-if="activeWorkspaceId !== ws.workspaceId"
                  variant="ghost"
                  size="icon"
                  class="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Set as active"
                  @click.stop="setActiveWorkspace(ws.workspaceId)"
                >
                  <Icon name="i-lucide-check-circle" class="size-3.5 text-emerald-500" />
                </Button>
                <Button
                  v-if="!ws.isProtected && ws.workspaceId !== 'admin'"
                  variant="ghost"
                  size="icon"
                  class="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  title="Delete workspace"
                  @click.stop="confirmDelete(ws.workspaceId, ws.name)"
                >
                  <Icon name="i-lucide-trash-2" class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu Configuration for Selected Workspace -->
      <div v-if="editingWorkspace" class="space-y-4">
        <!-- Menu Actions -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-xs"
              @click="allSelected ? deselectAll() : selectAll()"
            >
              <Icon :name="allSelected ? 'i-lucide-square' : 'i-lucide-check-square'" class="mr-1.5 size-3.5" />
              {{ allSelected ? 'Deselect All' : 'Select All' }}
            </Button>
            <span class="text-xs text-muted-foreground tabular-nums">
              {{ enabledMenuItems }}/{{ totalMenuItems }} selected
            </span>
          </div>
          <Button
            size="sm"
            class="h-7 text-xs"
            :disabled="!isDirty || isSavingMenu"
            @click="saveMenuConfig"
          >
            <Icon v-if="isSavingMenu" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
            <Icon v-else name="i-lucide-save" class="mr-1.5 size-3.5" />
            Save
          </Button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="[groupName, items] in menuGroups"
            :key="groupName"
            class="rounded-xl border bg-card p-4 transition-all hover:shadow-sm"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {{ groupName }}
                </h3>
                <Badge variant="secondary" class="text-[10px]">
                  {{ items.filter(i => editingWorkspace!.menuIds.includes(i.id)).length }}/{{ items.length }}
                </Badge>
              </div>
              <button
                class="text-[11px] font-medium text-primary hover:text-primary/70 transition-colors"
                @click="toggleGroupAll(items)"
              >
                {{ isGroupAllSelected(items) ? 'Deselect All' : 'Select All' }}
              </button>
            </div>
            <div class="space-y-1.5">
              <div
                v-for="item in items"
                :key="item.id"
                class="group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer"
                :class="[
                  item.comingSoon ? 'opacity-50 cursor-not-allowed bg-muted/20' : 'hover:bg-accent/50',
                  editingWorkspace!.menuIds.includes(item.id) && !item.comingSoon
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/10'
                    : 'bg-background/80',
                ]"
                @click="!item.comingSoon && localToggle(item.id)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <p class="text-sm font-semibold leading-none">
                        {{ item.title }}
                      </p>
                      <span v-if="item.comingSoon" class="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-600 uppercase tracking-tighter">
                        Soon
                      </span>
                    </div>
                    <p class="text-[10px] text-muted-foreground/70 truncate mt-1">
                      {{ item.link }}
                    </p>
                  </div>
                </div>
                <Switch
                  :checked="editingWorkspace!.menuIds.includes(item.id)"
                  :disabled="item.comingSoon"
                  class="scale-90"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Workspace Dialog -->
      <Dialog v-model:open="showAddDialog">
        <DialogContent class="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
              <Icon name="i-lucide-plus-circle" class="size-5 text-primary" />
              Create New Workspace
            </DialogTitle>
            <DialogDescription>
              Add a new workspace with its own set of menus and branding.
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-5" @submit.prevent="handleAddWorkspace">
            <div class="space-y-2">
              <label class="text-sm font-medium">Workspace Name</label>
              <Input
                v-model="newWorkspaceName"
                placeholder="e.g. Sales Team"
                autofocus
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Description</label>
              <Input
                v-model="newWorkspaceDescription"
                placeholder="e.g. For the sales and marketing team"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Icon</label>
              <div class="grid grid-cols-9 gap-1.5">
                <button
                  v-for="ico in availableIcons"
                  :key="ico.icon"
                  type="button"
                  class="size-9 flex items-center justify-center rounded-lg border transition-all"
                  :class="newWorkspaceIcon === ico.icon ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-110' : 'hover:bg-muted'"
                  :title="ico.label"
                  @click="newWorkspaceIcon = ico.icon"
                >
                  <Icon :name="ico.icon" class="size-4" />
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Color</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in colorPresets"
                  :key="c.color"
                  type="button"
                  class="size-7 rounded-full border-2 transition-all"
                  :class="newWorkspaceColor === c.color ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'"
                  :style="{ 'backgroundColor': c.color, 'borderColor': c.color, '--tw-ring-color': c.color }"
                  :title="c.label"
                  @click="newWorkspaceColor = c.color"
                />
              </div>
            </div>

            <!-- Preview -->
            <div class="rounded-xl border bg-muted/30 p-4">
              <p class="text-xs text-muted-foreground mb-2 font-medium">
                Preview
              </p>
              <div class="flex items-center gap-3">
                <div
                  class="size-10 flex items-center justify-center rounded-xl text-white"
                  :style="{ backgroundColor: newWorkspaceColor }"
                >
                  <Icon :name="newWorkspaceIcon" class="size-5" />
                </div>
                <div>
                  <p class="font-semibold text-sm">
                    {{ newWorkspaceName ? newWorkspaceName.toUpperCase() : 'WORKSPACE NAME' }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ newWorkspaceDescription || 'No description' }}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" @click="showAddDialog = false">
                Cancel
              </Button>
              <Button type="submit" :disabled="isSaving">
                <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
                <Icon v-else name="i-lucide-plus" class="mr-1.5 size-3.5" />
                Create Workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- Delete Confirmation Dialog -->
      <Dialog v-model:open="showDeleteDialog">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle class="flex items-center gap-2 text-destructive">
              <Icon name="i-lucide-alert-triangle" class="size-5" />
              Delete Workspace
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{{ deletingWorkspace?.name }}</strong>?
              This will remove all its menu configurations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="showDeleteDialog = false">
              Cancel
            </Button>
            <Button variant="destructive" @click="handleRemoveWorkspace">
              <Icon name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
              Delete Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>
.workspace-card {
  animation: card-appear 0.3s ease forwards;
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
