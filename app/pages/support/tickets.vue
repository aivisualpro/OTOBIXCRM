<script setup lang="ts">
// Fetch Otobix staff users for the Assignee dropdown
const { allUsers, fetchAllUsers } = usePeopleApi()
onMounted(() => fetchAllUsers())

const otobixStaff = computed(() =>
  allUsers.value
    .filter((u: any) => u.isStaff === true)
    .map((u: any) => ({ label: u.userName, value: u.userName })),
)

const columns = [
  { key: 'ticketId', label: 'Ticket #' },
  { key: 'subject', label: 'Subject' },
  { key: 'createdBy', label: 'Created by' },
  { key: 'priority', label: 'Priority', type: 'badge' as const },
  { key: 'status', label: 'Status', type: 'badge' as const },
  { key: 'assignee', label: 'Assignee' },
  { key: 'created', label: 'Created', type: 'date' as const },
]

const formFields = computed(() => [
  { key: 'ticketId', label: 'Ticket ID', placeholder: 'TKT-001' },
  { key: 'subject', label: 'Subject', placeholder: 'Unable to login' },
  { key: 'createdBy', label: 'Created by', placeholder: 'John Smith' },
  { key: 'priority', label: 'Priority', type: 'select' as const, options: [
    { label: 'Critical', value: 'Critical' },
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
    { label: 'Low', value: 'Low' },
  ] },
  { key: 'status', label: 'Status', type: 'select' as const, options: [
    { label: 'Open', value: 'Open' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Resolved', value: 'Resolved' },
    { label: 'Closed', value: 'Closed' },
  ] },
  { key: 'assignee', label: 'Assignee', type: 'select' as const, options: otobixStaff.value, placeholder: 'Select assignee' },
  { key: 'description', label: 'Description', type: 'textarea' as const, placeholder: 'Ticket details...' },
])

const seedData = [
  { id: 'tk1', ticketId: 'TKT-1247', subject: 'Dashboard not loading after update', createdBy: 'TechVision Inc', priority: 'Critical', status: 'In Progress', assignee: 'Thomas Wright', created: '2026-02-13' },
  { id: 'tk2', ticketId: 'TKT-1246', subject: 'Unable to export CSV reports', createdBy: 'GlobalSoft', priority: 'High', status: 'Open', assignee: 'Thomas Wright', created: '2026-02-13' },
  { id: 'tk3', ticketId: 'TKT-1245', subject: 'SSO integration with Azure AD', createdBy: 'Meridian Corp', priority: 'High', status: 'In Progress', assignee: 'Sofia Nguyen', created: '2026-02-12' },
  { id: 'tk4', ticketId: 'TKT-1244', subject: 'Invoice PDF formatting issue', createdBy: 'BrightPath', priority: 'Medium', status: 'Pending', assignee: 'Thomas Wright', created: '2026-02-12' },
  { id: 'tk5', ticketId: 'TKT-1243', subject: 'Bulk import failing for >1000 rows', createdBy: 'Apex Group', priority: 'High', status: 'In Progress', assignee: 'David Kim', created: '2026-02-11' },
  { id: 'tk6', ticketId: 'TKT-1242', subject: 'Two-factor auth not sending codes', createdBy: 'DataFlow AI', priority: 'Critical', status: 'Resolved', assignee: 'Sofia Nguyen', created: '2026-02-11' },
  { id: 'tk7', ticketId: 'TKT-1241', subject: 'Feature request: Dark mode for reports', createdBy: 'CloudNine Tech', priority: 'Low', status: 'Open', assignee: 'Unassigned', created: '2026-02-10' },
  { id: 'tk8', ticketId: 'TKT-1240', subject: 'Calendar sync with Google Workspace', createdBy: 'NexGen Solutions', priority: 'Medium', status: 'Resolved', assignee: 'Thomas Wright', created: '2026-02-09' },
  { id: 'tk9', ticketId: 'TKT-1239', subject: 'API rate limiting too aggressive', createdBy: 'Zenith Systems', priority: 'High', status: 'Pending', assignee: 'Michael Chen', created: '2026-02-08' },
  { id: 'tk10', ticketId: 'TKT-1238', subject: 'Mobile app crash on Android 14', createdBy: 'Synthetix Labs', priority: 'Critical', status: 'Closed', assignee: 'David Kim', created: '2026-02-07' },
  { id: 'tk11', ticketId: 'TKT-1237', subject: 'Permission denied on admin module', createdBy: 'BlueOcean AI', priority: 'Medium', status: 'Resolved', assignee: 'Sofia Nguyen', created: '2026-02-06' },
  { id: 'tk12', ticketId: 'TKT-1236', subject: 'How to set up webhook notifications', createdBy: 'InnovaTech', priority: 'Low', status: 'Closed', assignee: 'Thomas Wright', created: '2026-02-05' },
]
</script>

<template>
  <ErpCrudPage store-key="support-tickets" title="Support Tickets" description="Full-featured helpdesk with ticket lifecycle management and SLA tracking." icon="i-lucide-ticket" entity-name="Ticket" :columns="columns" :form-fields="formFields" :initial-data="seedData" />
</template>
