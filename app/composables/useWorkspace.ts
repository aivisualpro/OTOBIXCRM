/**
 * ─── Dynamic Workspace Engine ───
 *
 * Manages workspaces with configurable menus.
 * Each workspace has its own set of menu items.
 * Users can add/remove menus per workspace from Settings.
 * Persisted in localStorage.
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
    id: string
    name: string
    icon: string
    menuIds: string[] // IDs of menu items assigned to this workspace
}

// Master registry of all available menu items
export const ALL_MENU_ITEMS: MenuItem[] = [
    // Workspace
    { id: 'dashboard', title: 'Dashboard', icon: 'i-lucide-layout-dashboard', link: '/', group: 'Workspace' },
    { id: 'leads', title: 'Leads', icon: 'i-lucide-magnet', link: '/leads', group: 'Workspace' },
    { id: 'people', title: 'People', icon: 'i-lucide-users', link: '/people/otobix', group: 'Workspace' },
    { id: 'auctions', title: 'Auctions', icon: 'i-lucide-gavel', link: '/auctions/upcoming', group: 'Workspace' },
    { id: 'notifications', title: 'Notifications', icon: 'i-lucide-bell', link: '/notifications', group: 'Workspace' },
    { id: 'dropdowns', title: 'Dropdowns', icon: 'i-lucide-list', link: '/dropdowns', group: 'Workspace' },
    // Apps
    { id: 'tasks', title: 'Tasks', icon: 'i-lucide-check-square', link: '/tasks', group: 'Apps' },
    { id: 'timeline', title: 'Timeline', icon: 'i-lucide-gantt-chart', link: '/timeline', group: 'Apps' },
    // Retail
    { id: 'purchase-requests', title: 'Purchase Requests', icon: 'i-lucide-file-text', link: '/retail/purchase-requests', group: 'Retail', disabled: true, comingSoon: true },
    { id: 'pickup-requests', title: 'Pickup Requests', icon: 'i-lucide-receipt', link: '/retail/pickup-requests', group: 'Retail', disabled: true, comingSoon: true },
    // Accounts
    { id: 'customer-payments', title: 'Customer Payments', icon: 'i-lucide-wallet', link: '/accounts/customer-payments', group: 'Accounts', disabled: true, comingSoon: true },
    { id: 'dealer-payments', title: 'Dealer Payments', icon: 'i-lucide-arrow-right-left', link: '/accounts/dealer-payments', group: 'Accounts', disabled: true, comingSoon: true },
    // Finance
    { id: 'expenses', title: 'Expenses', icon: 'i-lucide-credit-card', link: '/finance/expenses', group: 'Finance', disabled: true, comingSoon: true },
    { id: 'tax-management', title: 'Tax Management', icon: 'i-lucide-percent', link: '/finance/taxes', group: 'Finance', disabled: true, comingSoon: true },
    { id: 'balance-sheet', title: 'Balance Sheet', icon: 'i-lucide-landmark', link: '/finance/balance-sheet', group: 'Finance', disabled: true, comingSoon: true },
    { id: 'income-statement', title: 'Income Statement', icon: 'i-lucide-receipt', link: '/finance/income-statement', group: 'Finance', disabled: true, comingSoon: true },
    { id: 'financial-ratios', title: 'Financial Ratios', icon: 'i-lucide-chart-no-axes-combined', link: '/finance/ratios', group: 'Finance', disabled: true, comingSoon: true },
    // Reports
    { id: 'sales-reports', title: 'Sales Reports', icon: 'i-lucide-trending-up', link: '/reports/sales', group: 'Reports', disabled: true, comingSoon: true },
    { id: 'financial-reports', title: 'Financial Reports', icon: 'i-lucide-pie-chart', link: '/reports/financial', group: 'Reports', disabled: true, comingSoon: true },
    { id: 'business-health', title: 'Business Health', icon: 'i-lucide-heart-pulse', link: '/reports/business-health', group: 'Reports', disabled: true, comingSoon: true },
    // Support
    { id: 'tickets', title: 'Tickets', icon: 'i-lucide-ticket', link: '/support/tickets', group: 'Support' },
]

// Default workspaces
const DEFAULT_WORKSPACES: Workspace[] = [
    {
        id: 'admin',
        name: 'OTOBIX ADMIN',
        icon: 'i-lucide-shield-check',
        menuIds: ALL_MENU_ITEMS.map(m => m.id), // Admin gets everything
    },
    {
        id: 'inspection',
        name: 'OTOBIX INSPECTION',
        icon: 'i-lucide-scan-search',
        menuIds: ['dashboard', 'leads', 'people', 'notifications', 'tasks'],
    },
    {
        id: 'dealers',
        name: 'OTOBIX DEALERS',
        icon: 'i-lucide-handshake',
        menuIds: ['dashboard', 'auctions', 'people', 'notifications'],
    },
]

// ─── Global state ───
const _workspaces = ref<Workspace[]>([])
const _activeWorkspaceId = ref('admin')
const _initialized = ref(false)

export function useWorkspace() {
    // Initialize from localStorage (once)
    if (!_initialized.value) {
        _initialized.value = true
        if (import.meta.client) {
            const saved = localStorage.getItem('otobix_workspaces')
            const savedActive = localStorage.getItem('otobix_active_workspace')
            _workspaces.value = saved ? JSON.parse(saved) : structuredClone(DEFAULT_WORKSPACES)
            _activeWorkspaceId.value = savedActive || 'admin'
        }
        else {
            _workspaces.value = structuredClone(DEFAULT_WORKSPACES)
        }
    }

    // Persist to localStorage
    function persist() {
        if (import.meta.client) {
            localStorage.setItem('otobix_workspaces', JSON.stringify(_workspaces.value))
            localStorage.setItem('otobix_active_workspace', _activeWorkspaceId.value)
        }
    }

    // Active workspace
    const activeWorkspace = computed(() =>
        _workspaces.value.find(w => w.id === _activeWorkspaceId.value) || _workspaces.value[0],
    )

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
        persist()
    }

    function toggleMenuItem(workspaceId: string, menuId: string) {
        const ws = _workspaces.value.find(w => w.id === workspaceId)
        if (!ws)
            return

        const idx = ws.menuIds.indexOf(menuId)
        if (idx >= 0) {
            ws.menuIds.splice(idx, 1)
        }
        else {
            ws.menuIds.push(menuId)
        }
        persist()
    }

    function addWorkspace(name: string, icon: string) {
        const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        if (_workspaces.value.some(w => w.id === id))
            return false

        _workspaces.value.push({
            id,
            name: name.toUpperCase(),
            icon,
            menuIds: ['dashboard', 'notifications'], // Minimum defaults
        })
        persist()
        return true
    }

    function removeWorkspace(id: string) {
        // Can't remove admin
        if (id === 'admin')
            return
        _workspaces.value = _workspaces.value.filter(w => w.id !== id)
        if (_activeWorkspaceId.value === id)
            _activeWorkspaceId.value = 'admin'
        persist()
    }

    function resetWorkspaces() {
        _workspaces.value = structuredClone(DEFAULT_WORKSPACES)
        _activeWorkspaceId.value = 'admin'
        persist()
    }

    return {
        workspaces: _workspaces,
        activeWorkspaceId: _activeWorkspaceId,
        activeWorkspace,
        activeMenuGroups,
        allMenuItems: ALL_MENU_ITEMS,
        setActiveWorkspace,
        toggleMenuItem,
        addWorkspace,
        removeWorkspace,
        resetWorkspaces,
    }
}
