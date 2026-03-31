<script setup lang="ts">
import { leadsColumns, leadsFormFields, routeFilters } from '~/constants/leads'

const { activeWorkspace } = useWorkspace()

// Gatekeep the index route itself
const ws = activeWorkspace.value
const allowed = ws?.leadTabs || []
// If the user has an active global search or advanced filter, and they click the root Leads menu, take them directly back to their search results.
const { serverSearch, activeAdvancedFilterCount } = useLeadsApi()
if (serverSearch.value || activeAdvancedFilterCount.value > 0) {
  navigateTo('/leads/search-results', { replace: true })
}
else if (allowed.length > 0 && !allowed.includes('leads')) {
  const fallback = ws?.defaultRoutes?.leads || `/leads/${allowed[0]}`

  // Replace the history state instantly so 'back' button doesn't trap them
  navigateTo(fallback, { replace: true })
}

// /leads index route uses the 'leads' filter: inspectionStatus=Pending & approvalStatus=Pending
const filter = routeFilters.leads
</script>

<template>
  <LeadsApiCrudPage
    :title="filter.label"
    :description="`Viewing leads: Inspection ${filter.inspectionStatus}, Approval ${filter.approvalStatus}`"
    icon="i-lucide-magnet"
    entity-name="Lead"
    :columns="leadsColumns"
    :form-fields="leadsFormFields"
    :filters="{ inspectionStatus: filter.inspectionStatus, approvalStatus: filter.approvalStatus }"
  />
</template>
