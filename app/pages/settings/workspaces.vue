<script setup lang="ts">
import { toast } from 'vue-sonner'

const {
  workspaces,
  activeWorkspaceId,
  allMenuItems,
  toggleMenuItem,
  addWorkspace,
  removeWorkspace,
  resetWorkspaces,
  setActiveWorkspace,
} = useWorkspace()

// ─── Add Workspace Dialog ───
const showAddDialog = ref(false)
const newWorkspaceName = ref('')
const newWorkspaceIcon = ref('i-lucide-briefcase')

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
]

function handleAddWorkspace() {
  if (!newWorkspaceName.value.trim()) {
    toast.error('Please enter a workspace name')
    return
  }
  const success = addWorkspace(newWorkspaceName.value.trim(), newWorkspaceIcon.value)
  if (success) {
    toast.success(`Workspace "${newWorkspaceName.value}" created`)
    newWorkspaceName.value = ''
    newWorkspaceIcon.value = 'i-lucide-briefcase'
    showAddDialog.value = false
  }
  else {
    toast.error('A workspace with this name already exists')
  }
}

function handleRemoveWorkspace(id: string, name: string) {
  if (id === 'admin') {
    toast.error('Cannot remove the Admin workspace')
    return
  }
  removeWorkspace(id)
  toast.success(`Workspace "${name}" removed`)
}

function handleReset() {
  resetWorkspaces()
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

// Currently editing workspace
const editingWorkspaceId = ref(workspaces.value[0]?.id || 'admin')
const editingWorkspace = computed(() =>
  workspaces.value.find(w => w.id === editingWorkspaceId.value),
)
</script>

<template>
  <div class="space-y-6">
    <!-- Section Header -->
    <div>
      <h3 class="text-lg font-medium">
        Workspaces
      </h3>
      <p class="text-sm text-muted-foreground">
        Manage workspaces and configure menus for each workspace.
      </p>
    </div>
    <Separator />

    <!-- Toolbar -->
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" @click="handleReset">
        <Icon name="i-lucide-rotate-ccw" class="mr-1.5 size-3.5" />
        Reset to Defaults
      </Button>
      <Button size="sm" @click="showAddDialog = true">
        <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
        Add Workspace
      </Button>
    </div>

    <!-- Workspace Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="ws in workspaces"
        :key="ws.id"
        class="workspace-card group relative rounded-xl border p-4 transition-all cursor-pointer"
        :class="{
          'border-primary bg-primary/5 ring-1 ring-primary/20': editingWorkspaceId === ws.id,
          'hover:border-primary/40 hover:bg-muted/30': editingWorkspaceId !== ws.id,
        }"
        @click="editingWorkspaceId = ws.id"
      >
        <div class="flex items-center gap-3">
          <div
            class="size-10 flex items-center justify-center rounded-lg transition-colors"
            :class="editingWorkspaceId === ws.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <Icon :name="ws.icon" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">
              {{ ws.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ ws.menuIds.length }} menu items
            </p>
          </div>
          <div class="flex items-center gap-1">
            <Badge
              v-if="activeWorkspaceId === ws.id"
              variant="outline"
              class="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            >
              Active
            </Badge>
            <Button
              v-if="activeWorkspaceId !== ws.id"
              variant="ghost"
              size="icon"
              class="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="setActiveWorkspace(ws.id)"
            >
              <Icon name="i-lucide-check-circle" class="size-3.5 text-emerald-500" />
            </Button>
            <Button
              v-if="ws.id !== 'admin'"
              variant="ghost"
              size="icon"
              class="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
              @click.stop="handleRemoveWorkspace(ws.id, ws.name)"
            >
              <Icon name="i-lucide-trash-2" class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Menu Configuration for Selected Workspace -->
    <div v-if="editingWorkspace" class="space-y-4">
      <div class="flex items-center gap-3">
        <div class="size-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon :name="editingWorkspace.icon" class="size-4" />
        </div>
        <div>
          <h2 class="text-lg font-semibold">
            {{ editingWorkspace.name }} — Menu Configuration
          </h2>
          <p class="text-xs text-muted-foreground">
            Toggle which menu items appear in this workspace.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="[groupName, items] in menuGroups"
          :key="groupName"
          class="rounded-lg border bg-card p-4"
        >
          <h3 class="text-sm font-medium text-muted-foreground mb-3">
            {{ groupName }}
          </h3>
          <div class="space-y-2">
            <label
              v-for="item in items"
              :key="item.id"
              class="flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors hover:bg-muted/50"
              :class="{ 'opacity-60': item.comingSoon }"
            >
              <div
                class="size-8 flex items-center justify-center rounded-md border transition-colors"
                :class="editingWorkspace.menuIds.includes(item.id) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/50 text-muted-foreground'"
              >
                <Icon :name="item.icon" class="size-4" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">
                  {{ item.title }}
                </p>
                <p class="text-[11px] text-muted-foreground truncate">
                  {{ item.link }}
                </p>
              </div>
              <Switch
                :checked="editingWorkspace.menuIds.includes(item.id)"
                @update:checked="toggleMenuItem(editingWorkspace!.id, item.id)"
              />
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Workspace Dialog -->
    <Dialog v-model:open="showAddDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Add a new workspace with its own set of menus.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleAddWorkspace">
          <div class="space-y-2">
            <label class="text-sm font-medium">Workspace Name</label>
            <Input
              v-model="newWorkspaceName"
              placeholder="e.g. Sales Team"
              autofocus
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Icon</label>
            <div class="grid grid-cols-6 gap-2">
              <button
                v-for="ico in availableIcons"
                :key="ico.icon"
                type="button"
                class="size-10 flex items-center justify-center rounded-lg border transition-all"
                :class="newWorkspaceIcon === ico.icon ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'"
                :title="ico.label"
                @click="newWorkspaceIcon = ico.icon"
              >
                <Icon :name="ico.icon" class="size-5" />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="showAddDialog = false">
              Cancel
            </Button>
            <Button type="submit">
              <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
