<script setup lang="ts">
import { leadsColumns, leadsFormFields, routeFilters } from '~/constants/leads'

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
