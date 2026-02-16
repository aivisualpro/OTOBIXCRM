<script setup lang="ts">
// Fetch Otobix staff users for the Assignee dropdown
const { allUsers, fetchAllUsers } = usePeopleApi()
// Fetch leads to derive ticket seed data
const { allLeads, fetchAllLeads } = useLeadsApi()

const dataReady = ref(false)
onMounted(async () => {
  await Promise.all([fetchAllUsers(), fetchAllLeads()])
  dataReady.value = true
})

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
  { key: 'subject', label: 'Subject', placeholder: 'Issue description' },
  { key: 'createdBy', label: 'Created by', placeholder: 'Owner / Customer name' },
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

// ── Generate ticket subjects from lead data ────────────
const subjectTemplates = [
  (l: any) => `Inspection delay for ${l.make} ${l.model} (${l.appointmentId})`,
  (l: any) => `${l.carRegistrationNumber} — customer not reachable`,
  (l: any) => `Re-schedule request for ${l.appointmentId}`,
  (l: any) => `${l.make} ${l.model} — document mismatch`,
  (l: any) => `Quality review pending — ${l.appointmentId}`,
  (l: any) => `Odometer discrepancy on ${l.carRegistrationNumber}`,
  (l: any) => `Customer complaint — ${l.ownerName} (${l.appointmentId})`,
  (l: any) => `Price negotiation issue for ${l.make} ${l.model} ${l.variant}`,
  (l: any) => `${l.appointmentId} — inspection report missing`,
  (l: any) => `Image upload failed for ${l.carRegistrationNumber}`,
  (l: any) => `${l.ownerName} — callback requested for ${l.appointmentId}`,
  (l: any) => `Approval escalation — ${l.make} ${l.model}`,
]

const priorities = ['Critical', 'High', 'Medium', 'Low']
const statuses = ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed']

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Generate seed data from leads on first load
const seedData = computed(() => {
  const leads = allLeads.value
  if (leads.length === 0)
    return []

  // Pick up to 15 leads as ticket sources
  const ticketLeads = leads.slice(0, Math.min(15, leads.length))

  // Get staff names for assignees
  const staffNames = otobixStaff.value.map((s: any) => s.value)
  const fallbackStaff = ['Admin', 'Support Team']
  const assignees = staffNames.length > 0 ? staffNames : fallbackStaff

  return ticketLeads.map((lead: any, idx: number) => {
    const hash = idx + (lead.appointmentId || '').charCodeAt(0) || idx
    const templateFn = subjectTemplates[idx % subjectTemplates.length]
    const subject = templateFn ? templateFn(lead) : `Ticket for ${lead.appointmentId}`

    return {
      id: `tk${idx + 1}`,
      ticketId: `TKT-${String(idx + 1).padStart(4, '0')}`,
      subject,
      createdBy: lead.ownerName || lead.appointmentId || 'Unknown',
      priority: priorities[Math.floor(seededRandom(hash) * priorities.length)],
      status: statuses[Math.floor(seededRandom(hash + 100) * statuses.length)],
      assignee: assignees[Math.floor(seededRandom(hash + 200) * assignees.length)] || 'Unassigned',
      created: lead.createdAt
        ? new Date(lead.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    }
  })
})
</script>

<template>
  <ErpCrudPage
    v-if="dataReady"
    store-key="support-tickets"
    title="Support Tickets"
    description=""
    icon="i-lucide-ticket"
    entity-name="Ticket"
    :columns="columns"
    :form-fields="formFields"
    :initial-data="seedData"
    auto-serial-prefix="TKT"
    auto-serial-field="ticketId"
    header-actions
  />
  <div v-else class="w-full flex flex-col gap-4 p-4 lg:p-6">
    <Card class="p-8">
      <div class="space-y-4">
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-3/4" />
      </div>
    </Card>
  </div>
</template>
