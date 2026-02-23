import type { CrudColumn } from '~/composables/useCrud'

export const peopleColumns: CrudColumn[] = [
  { key: 'userName', label: 'Name', type: 'avatar' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'userRole', label: 'Role', type: 'badge' },
  { key: 'dealershipName', label: 'Dealership' },
  { key: 'location', label: 'Location' },
  { key: 'entityType', label: 'Entity Type' },
  { key: 'primaryContactPerson', label: 'Primary Contact' },
  { key: 'approvalStatus', label: 'Status', type: 'badge' },
  { key: 'createdAt', label: 'Joined', type: 'date' },
]

export const otobixColumns: CrudColumn[] = [
  { key: 'userName', label: 'Name', type: 'avatar' },
  { key: 'userRole', label: 'Role', type: 'badge' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'approvalStatus', label: 'Status', type: 'badge' },
  { key: 'location', label: 'City' },
]

// Each sub-route defines how to filter the global users list
export interface PeopleRouteFilter {
  label: string
  filterFn: (user: any) => boolean
  showStatusCounts: boolean
}

/** Known Otobix staff roles — same as create-user form */
const STAFF_ROLES = ['Admin', 'Staff', 'KAM', 'Inspector', 'Operations', 'Super Admin']

export const peopleRouteFilters: Record<string, PeopleRouteFilter> = {
  otobix: {
    label: 'Otobix',
    // Otobix tab uses dedicated staff fetch (see usePeopleApi) — this filter is a fallback
    filterFn: (user: any) => user.isStaff === true || STAFF_ROLES.includes(user.userRole),
    showStatusCounts: true,
  },
  dealers: {
    label: 'Dealers',
    filterFn: (user: any) => user.userRole === 'Dealer',
    showStatusCounts: true,
  },
  customers: {
    label: 'Customers',
    filterFn: (user: any) => user.userRole === 'Customer',
    showStatusCounts: true,
  },
  others: {
    label: 'Others',
    filterFn: (user: any) => !STAFF_ROLES.includes(user.userRole) && user.userRole !== 'Dealer' && user.userRole !== 'Customer',
    showStatusCounts: true,
  },
}

