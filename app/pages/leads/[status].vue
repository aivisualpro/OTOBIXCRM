<script setup lang="ts">
import { leadsColumns, leadsFormFields, routeFilters } from '~/constants/leads'

const route = useRoute()
const statusKey = computed(() => route.params.status as string)
const filter = computed(() => routeFilters[statusKey.value as keyof typeof routeFilters])
</script>

<template>
  <LeadsApiCrudPage
    v-if="filter"
    :title="`Leads - ${filter.label}`"
    :description="`Viewing leads: Inspection ${filter.inspectionStatus}, Approval ${filter.approvalStatus}`"
    icon="i-lucide-magnet"
    entity-name="Lead"
    :columns="leadsColumns"
    :form-fields="leadsFormFields"
    :filters="{ inspectionStatus: filter.inspectionStatus, approvalStatus: filter.approvalStatus }"
    :clickable="statusKey === 'inspected'"
  />
  <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
    <p>Unknown status: {{ statusKey }}</p>
  </div>
</template>
