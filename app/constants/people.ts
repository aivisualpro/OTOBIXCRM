import type { CrudColumn } from '~/composables/useCrud'

export const peopleColumns: CrudColumn[] = [
  { key: 'userName', label: 'Name', type: 'avatar' },
  { key: 'userRole', label: 'Role', type: 'badge' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'secondaryContactPerson', label: 'Secondary Contact' },
  { key: 'secondaryContactNumber', label: 'Secondary Phone' },
  { key: 'addressList', label: 'Addresses', type: 'tags' },
  { key: 'approvalStatus', label: 'Status', type: 'badge' },
  { key: 'rejectionComment', label: 'Rejection Comment' },
  { key: 'wishlist', label: 'Wishlist', type: 'tags' },
  { key: 'createdAt', label: 'Created', type: 'date' },
  { key: 'updatedAt', label: 'Updated', type: 'date' },
  { key: 'assignedKam', label: 'Assigned KAM' },
  { key: 'isStaff', label: 'Staff', type: 'badge' },
]

export const otobixColumns: CrudColumn[] = [
  { key: 'userName', label: 'Name', type: 'avatar' },
  { key: 'userRole', label: 'Role', type: 'badge' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'secondaryContactPerson', label: 'Secondary Contact' },
  { key: 'secondaryContactNumber', label: 'Secondary Phone' },
  { key: 'addressList', label: 'Addresses', type: 'tags' },
  { key: 'approvalStatus', label: 'Status', type: 'badge' },
  { key: 'rejectionComment', label: 'Rejection Comment' },
  { key: 'wishlist', label: 'Wishlist', type: 'tags' },
  { key: 'createdAt', label: 'Created', type: 'date' },
  { key: 'updatedAt', label: 'Updated', type: 'date' },
  { key: 'assignedKam', label: 'Assigned KAM' },
  { key: 'isStaff', label: 'Staff', type: 'badge' },
]

// Each sub-route defines how to filter the global users list
export interface PeopleRouteFilter {
  label: string
  filterFn: (user: any) => boolean
  showStatusCounts: boolean
}

/** Known Otobix staff roles */
const STAFF_ROLES = ['Inspection Engineer', 'Retailer', 'Sales Manager', 'Telecaller', 'QC']

export const peopleRouteFilters: Record<string, PeopleRouteFilter> = {
  otobix: {
    label: 'Otobix',
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
}
