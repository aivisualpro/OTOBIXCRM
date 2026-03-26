/**
 * ─── Dynamic Workspace Engine ───
 *
 * Manages workspaces with configurable menus.
 * Each workspace has its own set of menu items.
 * Users can add/remove menus per workspace from Settings.
 * Persisted in MongoDB via /api/workspaces.
 */

import type { NavLink } from '~/types/nav'

// ─── All available menu items (flat registry) ───
export interface MenuItem {
  id: string
  title: string
  icon: string
  link: string
  group: string // category for grouping in the sidebar
  disabled?: boolean
  comingSoon?: boolean
}

export interface Workspace {
  _id?: string
  workspaceId: string
  name: string
  icon: string
  description?: string
  color?: string
  menuIds: string[]
  leadTabs?: string[]
  isDefault?: boolean
  isProtected?: boolean
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

// Master registry of all available menu items
export const ALL_MENU_ITEMS: MenuItem[] = [
  // Workspace
  { id: 'dashboard', title: 'Dashboard', icon: 'i-lucide-layout-dashboard', link: '/', group: 'Workspace' },
  { id: 'leads', title: 'Leads', icon: 'i-lucide-magnet', link: '/leads', group: 'Workspace' },
  { id: 'people', title: 'People', icon: 'i-lucide-users', link: '/people/dealer', group: 'Workspace' },
  { id: 'auctions', title: 'Auctions', icon: 'i-lucide-gavel', link: '/auctions/upcoming', group: 'Workspace' },
  { id: 'notifications', title: 'Notifications', icon: 'i-lucide-bell', link: '/notifications', group: 'Workspace' },
  { id: 'dropdowns', title: 'Dropdowns', icon: 'i-lucide-list', link: '/dropdowns', group: 'Workspace' },
  { id: 'banners', title: 'Banners', icon: 'i-lucide-image', link: '/banners', group: 'Workspace' },
  { id: 'variances', title: 'Variances', icon: 'i-lucide-layers', link: '/variances', group: 'Workspace' },
  { id: 'car-margins', title: 'Car Margins', icon: 'i-lucide-percent', link: '/car-margins', group: 'Workspace' },
  // Apps
  { id: 'tasks', title: 'Tasks', icon: 'i-lucide-check-square', link: '/tasks', group: 'Apps' },
  { id: 'timeline', title: 'Timeline', icon: 'i-lucide-gantt-chart', link: '/timeline', group: 'Apps' },
  // Support
  { id: 'tickets', title: 'Tickets', icon: 'i-lucide-ticket', link: '/support/tickets', group: 'Support' },
  // System
  { id: 'settings', title: 'General Settings', icon: 'i-lucide-settings', link: '/settings', group: 'System' },
  { id: 'workspaces', title: 'Workspaces', icon: 'i-lucide-briefcase', link: '/settings/workspaces', group: 'System' },
  { id: 'system', title: 'System Logs', icon: 'i-lucide-server-cog', link: '/settings/system', group: 'System' },
  { id: 'imports', title: 'Data Imports', icon: 'i-lucide-database-backup', link: '/settings/imports', group: 'System' },
]

// ─── Global state ───
const _workspaces = ref<Workspace[]>([])
const _activeWorkspaceId = ref('admin')
const _initialized = ref(false)
const _loading = ref(false)

// Fallback defaults for SSR or before API loads
const FALLBACK_WORKSPACES: Workspace[] = [
  {
    workspaceId: 'admin',
    name: 'OTOBIX ADMIN',
    icon: 'i-lucide-shield-check',
    menuIds: ALL_MENU_ITEMS.map(m => m.id),
  },
  {
    workspaceId: 'inspection',
    name: 'OTOBIX INSPECTION',
    icon: 'i-lucide-scan-search',
    menuIds: ['dashboard', 'leads', 'people', 'notifications', 'dropdowns', 'banners', 'variances', 'tasks'],
  },
  {
    workspaceId: 'dealers',
    name: 'OTOBIX DEALERS',
    icon: 'i-lucide-handshake',
    menuIds: ['dashboard', 'auctions', 'people', 'notifications', 'dropdowns', 'banners'],
  },
]

export function useWorkspace() {
  // Initialize — load from API once
  if (!_initialized.value) {
    _initialized.value = true

    // Set fallback immediately so sidebar renders
    _workspaces.value = structuredClone(FALLBACK_WORKSPACES)

    // Restore active workspace from localStorage
    if (import.meta.client) {
      const savedActive = localStorage.getItem('otobix_active_workspace')
      if (savedActive)
        _activeWorkspaceId.value = savedActive
    }

    // Fetch from MongoDB in background
    if (import.meta.client) {
      fetchWorkspaces()
    }
  }

  // Fetch workspaces from MongoDB
  async function fetchWorkspaces() {
    _loading.value = true
    try {
      const data = await $fetch<{ workspaces: Workspace[] }>('/api/workspaces')
      if (data?.workspaces?.length) {
        _workspaces.value = data.workspaces

        // If active workspace no longer exists, reset to admin
        if (!_workspaces.value.some(w => w.workspaceId === _activeWorkspaceId.value)) {
          _activeWorkspaceId.value = 'admin'
          persistActiveId()
        }
      }
    }
    catch (err) {
      console.error('[useWorkspace] Failed to fetch workspaces:', err)
      // Keep fallback data
    }
    finally {
      _loading.value = false
    }
  }

  // Save active workspace ID to localStorage (fast persist for UX)
  function persistActiveId() {
    if (import.meta.client) {
      localStorage.setItem('otobix_active_workspace', _activeWorkspaceId.value)
    }
  }

  // Load securely authorized scopes
  const userCookie = useCookie('userData')
  const availableWorkspaces = computed(() => {
    try {
      const user = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
      const role = String(user?.userType || user?.userRole || user?.role || '').toLowerCase()
      
      // System Admins always get unobstructed access to all active workspaces natively
      if (role === 'admin') return _workspaces.value

      // Other users only see specifically assigned workspaces
      const assignedIds = Array.isArray(user?.workspaces) ? user.workspaces : []
      const filtered = _workspaces.value.filter(w => assignedIds.includes(w.workspaceId))
      
      // Fallback securely preventing naked access if not assigned
      return filtered.length > 0 ? filtered : [_workspaces.value[0]] 
    } catch {
      return _workspaces.value
    }
  })

  // Active workspace dynamically scopes down checking availability
  const activeWorkspace = computed(() => {
    const list = availableWorkspaces.value.filter(Boolean) as Workspace[]
    return list.find(w => w?.workspaceId === _activeWorkspaceId.value) || list[0]
  })

  // Menu items for the active workspace, grouped by category
  const activeMenuGroups = computed(() => {
    const ws = activeWorkspace.value
    if (!ws)
      return []

    const items = ALL_MENU_ITEMS.filter(m => ws.menuIds.includes(m.id))

    // Group by category
    const groups: Record<string, NavLink[]> = {}
    items.forEach((item) => {
      const group = (groups[item.group] ??= [])
      group.push({
        title: item.title,
        icon: item.icon,
        link: item.link,
        disabled: item.disabled,
        comingSoon: item.comingSoon,
      })
    })

    return Object.entries(groups).map(([heading, navItems]) => ({
      heading,
      items: navItems,
    }))
  })

  function setActiveWorkspace(id: string) {
    _activeWorkspaceId.value = id
    persistActiveId()
  }

  async function toggleMenuItem(workspaceId: string, menuId: string) {
    // Optimistic update
    const ws = _workspaces.value.find(w => w.workspaceId === workspaceId)
    if (!ws)
      return

    const idx = ws.menuIds.indexOf(menuId)
    if (idx >= 0) {
      ws.menuIds.splice(idx, 1)
    }
    else {
      ws.menuIds.push(menuId)
    }

    // Persist to MongoDB
    try {
      await $fetch('/api/workspaces', {
        method: 'PUT',
        body: { action: 'toggleMenu', workspaceId, menuId },
      })
    }
    catch (err) {
      console.error('[useWorkspace] Failed to toggle menu item:', err)
      // Revert on failure
      await fetchWorkspaces()
    }
  }

  async function addWorkspace(name: string, icon: string, description?: string, color?: string) {
    try {
      const result = await $fetch<{ success: boolean, workspace: Workspace, message: string }>('/api/workspaces', {
        method: 'POST',
        body: { name, icon, description, color },
      })

      if (result?.success && result.workspace) {
        _workspaces.value.push(result.workspace)
        return true
      }
      return false
    }
    catch (err: any) {
      console.error('[useWorkspace] Failed to add workspace:', err)
      // Check for duplicate
      if (err?.data?.statusCode === 409 || err?.statusCode === 409) {
        return false
      }
      return false
    }
  }

  async function removeWorkspace(id: string) {
    if (id === 'admin')
      return

    // Optimistic removal
    const removed = _workspaces.value.find(w => w.workspaceId === id)
    _workspaces.value = _workspaces.value.filter(w => w.workspaceId !== id)
    if (_activeWorkspaceId.value === id) {
      _activeWorkspaceId.value = 'admin'
      persistActiveId()
    }

    try {
      await $fetch('/api/workspaces', {
        method: 'DELETE',
        body: { workspaceId: id },
      })
    }
    catch (err) {
      console.error('[useWorkspace] Failed to remove workspace:', err)
      // Revert
      if (removed)
        _workspaces.value.push(removed)
      await fetchWorkspaces()
    }
  }

  async function updateWorkspace(workspaceId: string, updates: Partial<Workspace>) {
    try {
      await $fetch('/api/workspaces', {
        method: 'PUT',
        body: { workspaceId, ...updates },
      })

      // Optimistic update
      const ws = _workspaces.value.find(w => w.workspaceId === workspaceId)
      if (ws) {
        Object.assign(ws, updates)
      }

      return true
    }
    catch (err) {
      console.error('[useWorkspace] Failed to update workspace:', err)
      return false
    }
  }

  async function resetWorkspaces() {
    // Delete all non-admin, then refetch
    try {
      const nonAdmin = _workspaces.value.filter(w => w.workspaceId !== 'admin' && !w.isProtected)
      for (const ws of nonAdmin) {
        await $fetch('/api/workspaces', {
          method: 'DELETE',
          body: { workspaceId: ws.workspaceId },
        })
      }
      await fetchWorkspaces()
      _activeWorkspaceId.value = 'admin'
      persistActiveId()
    }
    catch (err) {
      console.error('[useWorkspace] Failed to reset workspaces:', err)
    }
  }

  return {
    workspaces: availableWorkspaces,
    allWorkspaces: _workspaces,
    activeWorkspaceId: _activeWorkspaceId,
    activeWorkspace,
    activeMenuGroups,
    allMenuItems: ALL_MENU_ITEMS,
    loading: _loading,
    fetchWorkspaces,
    setActiveWorkspace,
    toggleMenuItem,
    addWorkspace,
    removeWorkspace,
    updateWorkspace,
    resetWorkspaces,
  }
}
