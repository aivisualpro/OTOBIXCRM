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
  { icon: 'i-lucide-phone', label: 'Phone' },
  { icon: 'i-lucide-phone-call', label: 'Phone Call' },
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
const enabledMenuItems = computed(() => {
  if (!editingWorkspace.value)
    return 0
  return editingWorkspace.value.menuIds.filter(id => allMenuItems.some(m => m.id === id)).length
})
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

// ─── Auction Tabs Sub-Config ───
const AUCTION_TABS = [
  { id: 'upcoming', title: 'Upcoming', route: '/auctions?tab=upcoming' },
  { id: 'live', title: 'Live', route: '/auctions?tab=live' },
  { id: 'otobuy', title: 'Otobuy', route: '/auctions?tab=otobuy' },
  { id: 'ended', title: 'Ended', route: '/auctions?tab=ended' },
  { id: 'sold', title: 'Sold', route: '/auctions?tab=sold' },
  { id: 'removed', title: 'Removed', route: '/auctions?tab=removed' },
  { id: 'admin', title: 'Admin', route: '/auctions?tab=admin' },
]

function localToggleAuctionTab(tabId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return
  if (!ws.auctionTabs)
    ws.auctionTabs = AUCTION_TABS.map(t => t.id)
  const current = [...ws.auctionTabs]
  const idx = current.indexOf(tabId)
  if (idx >= 0) { current.splice(idx, 1) }
  else { current.push(tabId) }
  ws.auctionTabs = current
  isDirty.value = true
}

// ─── Sales Tabs Sub-Config ───
const SALES_TABS = [
  { id: 'all', title: 'All', route: '/sales?tab=all' },
  { id: 'upcoming', title: 'Upcoming', route: '/sales?tab=upcoming' },
  { id: 'live', title: 'Live', route: '/sales?tab=live' },
  { id: 'otobuy', title: 'Otobuy', route: '/sales?tab=otobuy' },
  { id: 'customer-activity', title: 'Customer Activity', route: '/sales?tab=customer-activity' },
  { id: 'dealer-activity', title: 'Dealer Activity', route: '/sales?tab=dealer-activity' },
  { id: 'ended', title: 'Ended', route: '/sales?tab=ended' },
  { id: 'sold', title: 'Sold', route: '/sales?tab=sold' },
  { id: 'removed', title: 'Removed', route: '/sales?tab=removed' },
  { id: 'dealers', title: 'Dealers', route: '/sales?tab=dealers' },
]

function localToggleSalesTab(tabId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return
  if (!ws.salesTabs)
    ws.salesTabs = SALES_TABS.map(t => t.id)
  const current = [...ws.salesTabs]
  const idx = current.indexOf(tabId)
  if (idx >= 0) { current.splice(idx, 1) }
  else { current.push(tabId) }
  ws.salesTabs = current
  isDirty.value = true
}

// ─── Retail Tabs Sub-Config ───
const RETAIL_TABS = [
  { id: 'all', title: 'All Vehicles', route: '/retail?tab=all' },
  { id: 'upcoming', title: 'Upcoming', route: '/retail?tab=upcoming' },
  { id: 'live', title: 'Live', route: '/retail?tab=live' },
  { id: 'otobuy', title: 'Otobuy', route: '/retail?tab=otobuy' },
  { id: 'customer-activity', title: 'Customer Activity', route: '/retail?tab=customer-activity' },
  { id: 'dealer-activity', title: 'Dealer Activity', route: '/retail?tab=dealer-activity' },
  { id: 'ended', title: 'Ended', route: '/retail?tab=ended' },
  { id: 'sold', title: 'Sold', route: '/retail?tab=sold' },
  { id: 'removed', title: 'Removed', route: '/retail?tab=removed' },
  { id: 'followup', title: 'Followup', route: '/retail?tab=followup' },
]

function localToggleRetailTab(tabId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return
  if (!ws.retailTabs)
    ws.retailTabs = RETAIL_TABS.map(t => t.id)
  const current = [...ws.retailTabs]
  const idx = current.indexOf(tabId)
  if (idx >= 0) { current.splice(idx, 1) }
  else { current.push(tabId) }
  ws.retailTabs = current
  isDirty.value = true
}

// ─── People Tabs Sub-Config ───
const PEOPLE_TABS = [
  { id: 'dealer', title: 'Dealer', route: '/people/dealer' },
  { id: 'customer', title: 'Customer', route: '/people/customer' },
  { id: 'inspection-engineer', title: 'Inspection Engineer', route: '/people/inspection-engineer' },
  { id: 'admin', title: 'Admin', route: '/people/admin' },
  { id: 'retailer', title: 'Retailer', route: '/people/retailer' },
  { id: 'sales-manager', title: 'Sales Manager', route: '/people/sales-manager' },
  { id: 'telecaller', title: 'Telecaller', route: '/people/telecaller' },
  { id: 'qc', title: 'QC', route: '/people/qc' },
  { id: 'kams', title: 'KAMs', route: '/people/kams' },
]

function localTogglePeopleTab(tabId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return
  if (!ws.peopleTabs)
    ws.peopleTabs = PEOPLE_TABS.map(t => t.id)
  const current = [...ws.peopleTabs]
  const idx = current.indexOf(tabId)
  if (idx >= 0) { current.splice(idx, 1) }
  else { current.push(tabId) }
  ws.peopleTabs = current
  isDirty.value = true
}

// ─── Leads Tabs Sub-Config ───
const LEADS_TABS = [
  { id: 'all', title: 'All Leads' },
  { id: 'pending', title: 'Pending' },
  { id: 'scheduled', title: 'Scheduled' },
  { id: 're-scheduled', title: 'Re-Scheduled' },
  { id: 'running', title: 'Running' },
  { id: 'cancelled', title: 'Cancelled' },
  { id: 're-inspection', title: 'Re-Inspection' },
  { id: 'inspected', title: 'Inspected' },
  { id: 'self-inspected', title: 'Self Inspected' },
  { id: 'under-review', title: 'Under Review' },
  { id: 'quality-approved', title: 'Approved' },
  { id: 'quality-rejected', title: 'Quality Rejected' },
]

function localToggleLeadTab(tabId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return

  if (!ws.leadTabs)
    ws.leadTabs = LEADS_TABS.map(t => t.id) // Default all

  const current = [...ws.leadTabs]
  const idx = current.indexOf(tabId)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(tabId)
  }
  ws.leadTabs = current
  isDirty.value = true
}

// ─── Leads Actions Sub-Config ───
// ─── Leads Actions Sub-Config ───
const LEADS_ACTIONS = [
  { id: 'add', title: 'Add Data' },
  { id: 'edit', title: 'Edit Data' },
  { id: 'delete', title: 'Delete Data' },
  { id: 'pd-button', title: 'Price Discovery (PD) Button' },
  { id: 're-qc-button', title: 'Re-QC Button' },
]

function localToggleLeadAction(actionId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return

  if (!ws.leadActions)
    ws.leadActions = LEADS_ACTIONS.map(t => t.id) // Default all

  const current = [...ws.leadActions]
  const idx = current.indexOf(actionId)
  if (idx >= 0) {
    current.splice(idx, 1)

    // Auto turn off dependent actions if 'edit' is disabled
    if (actionId === 'edit') {
      const pdIdx = current.indexOf('pd-button')
      if (pdIdx >= 0)
        current.splice(pdIdx, 1)
      const reqcIdx = current.indexOf('re-qc-button')
      if (reqcIdx >= 0)
        current.splice(reqcIdx, 1)
    }
  }
  else {
    // If turning on pd-button or re-qc-button, make sure edit is turned on
    if ((actionId === 'pd-button' || actionId === 're-qc-button') && !current.includes('edit')) {
      return // Do not allow enabling if edit is not selected
    }
    current.push(actionId)
  }
  ws.leadActions = current
  isDirty.value = true
}

// ─── People Actions Sub-Config ───
const PEOPLE_ACTIONS = [
  { id: 'add', title: 'Add Data' },
  { id: 'edit', title: 'Edit Data' },
  { id: 'delete', title: 'Delete Data' },
]

function localTogglePeopleAction(actionId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return

  if (!ws.peopleActions)
    ws.peopleActions = PEOPLE_ACTIONS.map(t => t.id) // Default all

  const current = [...ws.peopleActions]
  const idx = current.indexOf(actionId)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(actionId)
  }
  ws.peopleActions = current
  isDirty.value = true
}

// ─── Dashboard Widgets Sub-Config ───
const DASHBOARD_WIDGETS = [
  { id: 'auctions_closed', title: 'Auctions Closed' },
  { id: 'new_customers', title: 'New Customers' },
  { id: 'active_accounts', title: 'Active Accounts' },
  { id: 'growth_rate', title: 'Growth Rate' },
  { id: 'auction_trends', title: 'Auction & Customer Trends' },
  { id: 'total_dealers', title: 'Total Dealers' },
  { id: 'total_cars', title: 'Total Cars' },
  { id: 'dealers_overview', title: 'Dealers Overview' },
]

function localToggleDashboardWidget(widgetId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return

  if (!ws.dashboardWidgets)
    ws.dashboardWidgets = DASHBOARD_WIDGETS.map(w => w.id) // Default all

  const current = [...ws.dashboardWidgets]
  const idx = current.indexOf(widgetId)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(widgetId)
  }
  ws.dashboardWidgets = current
  isDirty.value = true
}

// ─── System Settings Sub-Config ───
const SYSTEM_SETTINGS = [
  { id: 'workspaces', title: 'Workspaces' },
  { id: 'system_logs', title: 'System Logs' },
  { id: 'data_imports', title: 'Data Imports' },
]

function localToggleSystemSetting(settingId: string) {
  const ws = editingWorkspace.value
  if (!ws)
    return

  if (!ws.systemSettings)
    ws.systemSettings = SYSTEM_SETTINGS.map(s => s.id) // Default all

  const current = [...ws.systemSettings]
  const idx = current.indexOf(settingId)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(settingId)
  }
  ws.systemSettings = current
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

// ─── Default Routes Mutators ───
function safeGetDefaultRoute(ws: Workspace, itemId: string) {
  if (!ws.defaultRoutes)
    ws.defaultRoutes = {}
  return ws.defaultRoutes[itemId] || ''
}
function safeSetDefaultRoute(ws: Workspace, itemId: string, val: string) {
  if (!ws.defaultRoutes)
    ws.defaultRoutes = {}
  ws.defaultRoutes[itemId] = val
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
    const updates: Partial<Workspace> = { menuIds: [...ws.menuIds] }
    if (ws.auctionTabs)
      updates.auctionTabs = [...ws.auctionTabs]
    if (ws.salesTabs)
      updates.salesTabs = [...ws.salesTabs]
    if (ws.retailTabs)
      updates.retailTabs = [...ws.retailTabs]
    if (ws.peopleTabs)
      updates.peopleTabs = [...ws.peopleTabs]
    if (ws.peopleActions)
      updates.peopleActions = [...ws.peopleActions]
    if (ws.leadActions)
      updates.leadActions = [...ws.leadActions]
    if (ws.leadTabs)
      updates.leadTabs = [...ws.leadTabs]
    if (ws.dashboardWidgets)
      updates.dashboardWidgets = [...ws.dashboardWidgets]
    if (ws.systemSettings)
      updates.systemSettings = [...ws.systemSettings]
    if (ws.defaultRoutes)
      updates.defaultRoutes = { ...ws.defaultRoutes }

    await updateWorkspace(ws.workspaceId, updates)
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
      <HeaderActions>
        <Button size="sm" class="h-8" @click="showAddDialog = true">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Workspace
        </Button>
      </HeaderActions>
    </ClientOnly>

    <div class="h-full flex flex-col md:flex-row overflow-hidden bg-background">
      <!-- Left Sidebar: Workspaces -->
      <div class="w-full md:w-80 shrink-0 border-r bg-muted/10 p-4 overflow-y-auto space-y-3">
        <div
          v-for="ws in workspaces"
          :key="ws.workspaceId"
          class="workspace-card group relative rounded-xl border p-3 transition-all cursor-pointer"
          :class="{
            'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm': editingWorkspaceId === ws.workspaceId,
            'hover:border-muted-foreground/30 hover:bg-muted/30 hover:shadow-sm': editingWorkspaceId !== ws.workspaceId,
          }"
          @click="editingWorkspaceId = ws.workspaceId"
        >
          <!-- Color accent bar -->
          <div
            class="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl transition-opacity"
            :style="{ backgroundColor: ws.color || '#6366f1' }"
            :class="editingWorkspaceId === ws.workspaceId ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'"
          />

          <div class="flex items-center gap-3 pl-2">
            <div
              class="size-8 flex items-center justify-center rounded-lg text-white shrink-0"
              :style="{ backgroundColor: ws.color || '#6366f1' }"
            >
              <Icon :name="ws.icon || 'i-lucide-briefcase'" class="size-4" />
            </div>
            <div class="flex-1 min-w-0 pr-2">
              <p class="font-semibold text-sm leading-tight">
                {{ ws.name }}
              </p>
              <p class="text-[11px] text-muted-foreground">
                {{ ws.menuIds?.length || 0 }} menu items
              </p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <Badge
                v-if="activeWorkspaceId === ws.workspaceId"
                variant="outline"
                class="text-[9px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5"
              >
                Active
              </Badge>
              <div class="flex items-center gap-0.5">
                <Button
                  v-if="activeWorkspaceId !== ws.workspaceId"
                  variant="ghost"
                  size="icon"
                  class="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Set as active"
                  @click.stop="setActiveWorkspace(ws.workspaceId)"
                >
                  <Icon name="i-lucide-check-circle" class="size-3 text-emerald-500" />
                </Button>
                <Button
                  v-if="!ws.isProtected && ws.workspaceId !== 'admin'"
                  variant="ghost"
                  size="icon"
                  class="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  title="Delete workspace"
                  @click.stop="confirmDelete(ws.workspaceId, ws.name)"
                >
                  <Icon name="i-lucide-trash-2" class="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Content: Menu Configuration -->
      <div class="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">
        <div v-if="editingWorkspace" class="space-y-4">
          <!-- Workspace Header & Actions (Sticky) -->
          <div class="flex items-center justify-between border-b pb-4 mb-6 sticky top-0 bg-background/95 backdrop-blur z-10 -mx-4 px-4 lg:-mx-6 lg:px-6 pt-4 -mt-4">
            <div class="flex items-center gap-4">
              <div
                class="size-12 flex items-center justify-center rounded-xl text-white shadow-sm"
                :style="{ backgroundColor: editingWorkspace.color || '#6366f1' }"
              >
                <Icon :name="editingWorkspace.icon || 'i-lucide-briefcase'" class="size-6" />
              </div>
              <div>
                <h2 class="text-xl font-bold tracking-tight">
                  {{ editingWorkspace.name }}
                </h2>
              </div>
            </div>

            <!-- Menu Actions -->
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 text-xs font-semibold bg-background"
                  @click="allSelected ? deselectAll() : selectAll()"
                >
                  <Icon :name="allSelected ? 'i-lucide-square' : 'i-lucide-check-square'" class="mr-1.5 size-3.5" />
                  {{ allSelected ? 'Deselect All' : 'Select All' }}
                </Button>
                <span class="text-xs font-medium text-muted-foreground tabular-nums">
                  {{ enabledMenuItems }}/{{ totalMenuItems }} selected
                </span>
              </div>
              <Button
                size="sm"
                class="h-8 text-xs font-semibold"
                :disabled="!isDirty || isSavingMenu"
                @click="saveMenuConfig"
              >
                <Icon v-if="isSavingMenu" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
                <Icon v-else name="i-lucide-save" class="mr-1.5 size-3.5" />
                Save Changes
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            <div
              v-for="item in allMenuItems"
              :key="item.id"
              class="group flex flex-col p-3 rounded-xl border transition-all"
              :style="editingWorkspace!.menuIds.includes(item.id) && !item.comingSoon && editingWorkspace!.color ? { borderColor: `${editingWorkspace!.color}4D`, backgroundColor: `${editingWorkspace!.color}0D`, boxShadow: `0 0 0 1px ${editingWorkspace!.color}1A` } : {}"
              :class="[
                item.comingSoon ? 'opacity-50 cursor-not-allowed bg-muted/20' : '',
                editingWorkspace!.menuIds.includes(item.id) && !item.comingSoon
                  ? (editingWorkspace!.color ? '' : 'border-primary/30 bg-primary/5 ring-1 ring-primary/10')
                  : 'bg-background/80 hover:bg-accent/50',
              ]"
            >
              <div class="flex items-center justify-between cursor-pointer" @click="!item.comingSoon && localToggle(item.id)">
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
                  :active-color="editingWorkspace!.color"
                  class="scale-90 pointer-events-none"
                />
              </div>

              <!-- Auctions Sub-Tabs Options -->
              <div
                v-if="item.id === 'auctions' && editingWorkspace!.menuIds.includes('auctions')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  Visible Auction Tabs
                  <span class="text-[9px] uppercase tracking-wider opacity-60 flex items-center gap-1"><Icon name="i-lucide-star" class="size-2.5" /> Def. Route</span>
                </p>
                <div
                  v-for="subTab in AUCTION_TABS"
                  :key="subTab.id"
                  class="group/subtab flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleAuctionTab(subTab.id)"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      v-if="(editingWorkspace!.auctionTabs || AUCTION_TABS.map(t => t.id)).includes(subTab.id)"
                      title="Set as Default Route"
                      class="transition-opacity p-0.5 mt-0.5"
                      :class="safeGetDefaultRoute(editingWorkspace!, 'auctions') === subTab.route ? 'opacity-100' : 'opacity-0 group-hover/subtab:opacity-100'"
                      @click.stop="safeSetDefaultRoute(editingWorkspace!, 'auctions', subTab.route)"
                    >
                      <Icon
                        name="i-lucide-star"
                        class="size-3 block transition-colors"
                        :class="safeGetDefaultRoute(editingWorkspace!, 'auctions') === subTab.route ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-500'"
                      />
                    </button>
                    <span class="text-[11px] truncate" :class="(editingWorkspace!.auctionTabs || AUCTION_TABS.map(t => t.id)).includes(subTab.id) ? '' : 'pl-4'">{{ subTab.title }}</span>
                  </div>
                  <Icon
                    :name="(editingWorkspace!.auctionTabs || AUCTION_TABS.map(t => t.id)).includes(subTab.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.auctionTabs || AUCTION_TABS.map(t => t.id)).includes(subTab.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.auctionTabs || AUCTION_TABS.map(t => t.id)).includes(subTab.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- Leads Sub-Tabs Options -->
              <div
                v-if="item.id === 'leads' && editingWorkspace!.menuIds.includes('leads')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  Visible Lead Tabs
                  <span class="text-[9px] uppercase tracking-wider opacity-60 flex items-center gap-1"><Icon name="i-lucide-star" class="size-2.5" /> Def. Route</span>
                </p>
                <div
                  v-for="subTab in LEADS_TABS"
                  :key="subTab.id"
                  class="group/subtab flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleLeadTab(subTab.id)"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      v-if="(editingWorkspace!.leadTabs || LEADS_TABS.map(t => t.id)).includes(subTab.id)"
                      title="Set as Default Route"
                      class="transition-opacity p-0.5 mt-0.5" :class="[
                        safeGetDefaultRoute(editingWorkspace!, 'leads') === (subTab.id === 'leads' ? '/leads' : `/leads/${subTab.id}`) ? 'opacity-100' : 'opacity-0 group-hover/subtab:opacity-100',
                      ]"
                      @click.stop="safeSetDefaultRoute(editingWorkspace!, 'leads', subTab.id === 'leads' ? '/leads' : `/leads/${subTab.id}`)"
                    >
                      <Icon
                        name="i-lucide-star"
                        class="size-3 block transition-colors"
                        :class="safeGetDefaultRoute(editingWorkspace!, 'leads') === (subTab.id === 'leads' ? '/leads' : `/leads/${subTab.id}`) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-500'"
                      />
                    </button>
                    <span class="text-[11px] truncate" :class="(editingWorkspace!.leadTabs || LEADS_TABS.map(t => t.id)).includes(subTab.id) ? '' : 'pl-4'">{{ subTab.title }}</span>
                  </div>
                  <Icon
                    :name="(editingWorkspace!.leadTabs || LEADS_TABS.map(t => t.id)).includes(subTab.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.leadTabs || LEADS_TABS.map(t => t.id)).includes(subTab.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.leadTabs || LEADS_TABS.map(t => t.id)).includes(subTab.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- Leads Actions Options -->
              <div
                v-if="item.id === 'leads' && editingWorkspace!.menuIds.includes('leads')"
                class="col-span-2 mt-2 pt-2 border-t border-primary/5 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 text-xs font-medium text-muted-foreground mb-1">
                  Allowed Actions
                </p>
                <div
                  v-for="action in LEADS_ACTIONS"
                  :key="action.id"
                  class="flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleLeadAction(action.id)"
                >
                  <span class="text-[11px] truncate">{{ action.title }}</span>
                  <Icon
                    :name="(editingWorkspace!.leadActions || LEADS_ACTIONS.map(t => t.id)).includes(action.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
                    class="size-3.5"
                    :style="(editingWorkspace!.leadActions || LEADS_ACTIONS.map(t => t.id)).includes(action.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.leadActions || LEADS_ACTIONS.map(t => t.id)).includes(action.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- Sales Sub-Tabs Options -->
              <div
                v-if="item.id === 'sales' && editingWorkspace!.menuIds.includes('sales')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  Visible Sales Tabs
                  <span class="text-[9px] uppercase tracking-wider opacity-60 flex items-center gap-1"><Icon name="i-lucide-star" class="size-2.5" /> Def. Route</span>
                </p>
                <div
                  v-for="subTab in SALES_TABS"
                  :key="subTab.id"
                  class="group/subtab flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleSalesTab(subTab.id)"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      v-if="(editingWorkspace!.salesTabs || SALES_TABS.map(t => t.id)).includes(subTab.id)"
                      title="Set as Default Route"
                      class="transition-opacity p-0.5 mt-0.5"
                      :class="safeGetDefaultRoute(editingWorkspace!, 'sales') === subTab.route ? 'opacity-100' : 'opacity-0 group-hover/subtab:opacity-100'"
                      @click.stop="safeSetDefaultRoute(editingWorkspace!, 'sales', subTab.route)"
                    >
                      <Icon
                        name="i-lucide-star"
                        class="size-3 block transition-colors"
                        :class="safeGetDefaultRoute(editingWorkspace!, 'sales') === subTab.route ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-500'"
                      />
                    </button>
                    <span class="text-[11px] truncate" :class="(editingWorkspace!.salesTabs || SALES_TABS.map(t => t.id)).includes(subTab.id) ? '' : 'pl-4'">{{ subTab.title }}</span>
                  </div>
                  <Icon
                    :name="(editingWorkspace!.salesTabs || SALES_TABS.map(t => t.id)).includes(subTab.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.salesTabs || SALES_TABS.map(t => t.id)).includes(subTab.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.salesTabs || SALES_TABS.map(t => t.id)).includes(subTab.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- Retail Sub-Tabs Options -->
              <div
                v-if="item.id === 'retail' && editingWorkspace!.menuIds.includes('retail')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  Visible Retail Tabs
                  <span class="text-[9px] uppercase tracking-wider opacity-60 flex items-center gap-1"><Icon name="i-lucide-star" class="size-2.5" /> Def. Route</span>
                </p>
                <div
                  v-for="subTab in RETAIL_TABS"
                  :key="subTab.id"
                  class="group/subtab flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleRetailTab(subTab.id)"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      v-if="(editingWorkspace!.retailTabs || RETAIL_TABS.map(t => t.id)).includes(subTab.id)"
                      title="Set as Default Route"
                      class="transition-opacity p-0.5 mt-0.5"
                      :class="safeGetDefaultRoute(editingWorkspace!, 'retail') === subTab.route ? 'opacity-100' : 'opacity-0 group-hover/subtab:opacity-100'"
                      @click.stop="safeSetDefaultRoute(editingWorkspace!, 'retail', subTab.route)"
                    >
                      <Icon
                        name="i-lucide-star"
                        class="size-3 block transition-colors"
                        :class="safeGetDefaultRoute(editingWorkspace!, 'retail') === subTab.route ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-500'"
                      />
                    </button>
                    <span class="text-[11px] truncate" :class="(editingWorkspace!.retailTabs || RETAIL_TABS.map(t => t.id)).includes(subTab.id) ? '' : 'pl-4'">{{ subTab.title }}</span>
                  </div>
                  <Icon
                    :name="(editingWorkspace!.retailTabs || RETAIL_TABS.map(t => t.id)).includes(subTab.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.retailTabs || RETAIL_TABS.map(t => t.id)).includes(subTab.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.retailTabs || RETAIL_TABS.map(t => t.id)).includes(subTab.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- People Sub-Tabs Options -->
              <div
                v-if="item.id === 'people' && editingWorkspace!.menuIds.includes('people')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  Visible People Tabs
                  <span class="text-[9px] uppercase tracking-wider opacity-60 flex items-center gap-1"><Icon name="i-lucide-star" class="size-2.5" /> Def. Route</span>
                </p>
                <div
                  v-for="subTab in PEOPLE_TABS"
                  :key="subTab.id"
                  class="group/subtab flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localTogglePeopleTab(subTab.id)"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      v-if="(editingWorkspace!.peopleTabs || PEOPLE_TABS.map(t => t.id)).includes(subTab.id)"
                      title="Set as Default Route"
                      class="transition-opacity p-0.5 mt-0.5"
                      :class="safeGetDefaultRoute(editingWorkspace!, 'people') === subTab.route ? 'opacity-100' : 'opacity-0 group-hover/subtab:opacity-100'"
                      @click.stop="safeSetDefaultRoute(editingWorkspace!, 'people', subTab.route)"
                    >
                      <Icon
                        name="i-lucide-star"
                        class="size-3 block transition-colors"
                        :class="safeGetDefaultRoute(editingWorkspace!, 'people') === subTab.route ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-500'"
                      />
                    </button>
                    <span class="text-[11px] truncate" :class="(editingWorkspace!.peopleTabs || PEOPLE_TABS.map(t => t.id)).includes(subTab.id) ? '' : 'pl-4'">{{ subTab.title }}</span>
                  </div>
                  <Icon
                    :name="(editingWorkspace!.peopleTabs || PEOPLE_TABS.map(t => t.id)).includes(subTab.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.peopleTabs || PEOPLE_TABS.map(t => t.id)).includes(subTab.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.peopleTabs || PEOPLE_TABS.map(t => t.id)).includes(subTab.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- People Actions Options -->
              <div
                v-if="item.id === 'people' && editingWorkspace!.menuIds.includes('people')"
                class="col-span-2 mt-2 pt-2 border-t border-primary/5 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 text-xs font-medium text-muted-foreground mb-1">
                  Allowed Actions
                </p>
                <div
                  v-for="action in PEOPLE_ACTIONS"
                  :key="action.id"
                  class="flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localTogglePeopleAction(action.id)"
                >
                  <span class="text-[11px] truncate">{{ action.title }}</span>
                  <Icon
                    :name="(editingWorkspace!.peopleActions || PEOPLE_ACTIONS.map(t => t.id)).includes(action.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
                    class="size-3.5"
                    :style="(editingWorkspace!.peopleActions || PEOPLE_ACTIONS.map(t => t.id)).includes(action.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.peopleActions || PEOPLE_ACTIONS.map(t => t.id)).includes(action.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- Dashboard Widgets Options -->
              <div
                v-if="item.id === 'dashboard' && editingWorkspace!.menuIds.includes('dashboard')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 text-xs font-medium text-muted-foreground mb-1">
                  Dashboard Widgets
                </p>
                <div
                  v-for="widget in DASHBOARD_WIDGETS"
                  :key="widget.id"
                  class="flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleDashboardWidget(widget.id)"
                >
                  <span class="text-[11px]">{{ widget.title }}</span>
                  <Icon
                    :name="(editingWorkspace!.dashboardWidgets || DASHBOARD_WIDGETS.map(w => w.id)).includes(widget.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.dashboardWidgets || DASHBOARD_WIDGETS.map(w => w.id)).includes(widget.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.dashboardWidgets || DASHBOARD_WIDGETS.map(w => w.id)).includes(widget.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- System Settings Options -->
              <div
                v-if="item.id === 'settings' && editingWorkspace!.menuIds.includes('settings')"
                class="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2"
              >
                <p class="col-span-2 flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  System Menus
                  <span class="text-[9px] uppercase tracking-wider opacity-60 flex items-center gap-1"><Icon name="i-lucide-star" class="size-2.5" /> Def. Route</span>
                </p>
                <div
                  v-for="setting in SYSTEM_SETTINGS"
                  :key="setting.id"
                  class="group/subtab flex items-center justify-between p-1.5 px-2 bg-background/50 rounded border cursor-pointer hover:bg-accent transition-colors"
                  @click="localToggleSystemSetting(setting.id)"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      v-if="(editingWorkspace!.systemSettings || SYSTEM_SETTINGS.map(s => s.id)).includes(setting.id)"
                      title="Set as Default Route"
                      class="transition-opacity p-0.5 mt-0.5" :class="[
                        safeGetDefaultRoute(editingWorkspace!, 'settings') === `/settings/${setting.id}` ? 'opacity-100' : 'opacity-0 group-hover/subtab:opacity-100',
                      ]"
                      @click.stop="safeSetDefaultRoute(editingWorkspace!, 'settings', `/settings/${setting.id}`)"
                    >
                      <Icon
                        name="i-lucide-star"
                        class="size-3 block transition-colors"
                        :class="safeGetDefaultRoute(editingWorkspace!, 'settings') === `/settings/${setting.id}` ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-500'"
                      />
                    </button>
                    <span class="text-[11px] truncate" :class="(editingWorkspace!.systemSettings || SYSTEM_SETTINGS.map(s => s.id)).includes(setting.id) ? '' : 'pl-4'">{{ setting.title }}</span>
                  </div>
                  <Icon
                    :name="(editingWorkspace!.systemSettings || SYSTEM_SETTINGS.map(s => s.id)).includes(setting.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="size-3.5"
                    :style="(editingWorkspace!.systemSettings || SYSTEM_SETTINGS.map(s => s.id)).includes(setting.id) && editingWorkspace!.color ? { color: editingWorkspace!.color } : {}"
                    :class="(editingWorkspace!.systemSettings || SYSTEM_SETTINGS.map(s => s.id)).includes(setting.id) ? (editingWorkspace!.color ? '' : 'text-primary') : 'text-muted-foreground/40'"
                  />
                </div>
              </div>

              <!-- Placeholder for Unselected Items -->
              <div
                v-if="!editingWorkspace!.menuIds.includes(item.id) && !item.comingSoon"
                class="mt-3 py-6 rounded-lg border border-dashed border-muted/60 bg-muted/10 flex flex-col items-center justify-center text-center px-4 transition-colors group-hover:bg-muted/30 group-hover:border-muted/80"
              >
                <div class="size-10 rounded-full bg-background/50 flex items-center justify-center shadow-sm border border-muted/50 mb-3 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/70 group-hover:shadow-md">
                  <Icon name="i-lucide-power-off" class="size-4" />
                </div>
                <h4 class="text-xs font-semibold text-muted-foreground mb-1">
                  Module Offline
                </h4>
                <p class="text-[10px] text-muted-foreground/60 leading-relaxed max-w-[180px]">
                  Activate this workspace component to safely mount its interfaces and configuration payload.
                </p>
              </div>

              <!-- Placeholder for Selected Items with NO Options -->
              <div
                v-else-if="editingWorkspace!.menuIds.includes(item.id) && !['auctions', 'leads', 'people', 'sales', 'retail', 'dashboard', 'settings'].includes(item.id) && !item.comingSoon"
                class="mt-3 py-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center justify-center text-center px-4"
              >
                <div class="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-500/70">
                  <Icon name="i-lucide-check-circle-2" class="size-4" />
                </div>
                <p class="text-[10px] text-emerald-600/80 font-medium tracking-tight">
                  Active with uniform telemetry.
                </p>
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
              <label class="text-sm font-medium">Icon</label>
              <div class="grid grid-cols-10 gap-1.5">
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
