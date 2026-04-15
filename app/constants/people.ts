import type { CrudColumn } from '~/composables/useCrud'

export const peopleColumns: CrudColumn[] = [
  { key: 'userName', label: 'Name', type: 'avatar' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'approvalStatus', label: 'Status', type: 'badge' },
  { key: 'workspaces', label: 'Workspaces', type: 'badge' },
  { key: 'createdAt', label: 'Created', type: 'date' },
  { key: 'updatedAt', label: 'Updated', type: 'date' },
]

// Each sub-route defines how to filter the global users list
export interface PeopleRouteFilter {
  label: string
  filterFn: (user: any) => boolean
  showStatusCounts: boolean
}

export const peopleRouteFilters: Record<string, PeopleRouteFilter> = {
  'dealer': {
    label: 'Dealer',
    filterFn: (user: any) => user.userRole === 'Dealer',
    showStatusCounts: true,
  },
  'customer': {
    label: 'Customer',
    filterFn: (user: any) => user.userRole === 'Customer',
    showStatusCounts: true,
  },
  'inspection-engineer': {
    label: 'Inspection Engineer',
    filterFn: (user: any) => user.userRole === 'Inspection Engineer',
    showStatusCounts: true,
  },
  'admin': {
    label: 'Admin',
    filterFn: (user: any) => user.userRole === 'Admin' || user.userRole === 'Super Admin',
    showStatusCounts: true,
  },
  'retailer': {
    label: 'Retailer',
    filterFn: (user: any) => user.userRole === 'Retailer',
    showStatusCounts: true,
  },
  'sales-manager': {
    label: 'Sales Manager',
    filterFn: (user: any) => user.userRole === 'Sales Manager',
    showStatusCounts: true,
  },
  'telecaller': {
    label: 'Telecaller',
    filterFn: (user: any) => user.userRole === 'Telecaller',
    showStatusCounts: true,
  },
  'qc': {
    label: 'QC',
    filterFn: (user: any) => user.userRole === 'QC',
    showStatusCounts: true,
  },
}
