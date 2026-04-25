<script setup lang="ts">
import { watch } from 'vue'
import { leadsColumns, leadsFormFields, routeColumnsMap, routeFilters } from '~/constants/leads'

const { activeWorkspace } = useWorkspace()
const ws = activeWorkspace.value
const allowed = ws?.leadTabs || []

const route = useRoute()
const router = useRouter()
const { serverSearch, activeAdvancedFilterCount, setTab } = useLeadsApi()

// Default tab resolution logic
const tabParam = computed(() => (route.query.tab as string) || '')
const searchParam = computed(() => (route.query.search as string) || '')

// Auto-navigate to correct tab if none provided
if (!tabParam.value) {
  let fallback = 'all'
  if (searchParam.value || serverSearch.value || activeAdvancedFilterCount.value > 0) {
    fallback = 'search-results'
  }
  else if (allowed.length > 0 && !allowed.includes('all') && !allowed.includes('pending')) {
    fallback = ws?.defaultRoutes?.leads?.split('/').pop() || allowed[0] || 'all'
  }
  else if (allowed.includes('all')) {
    fallback = 'all'
  }
  else if (allowed.includes('pending')) {
    fallback = 'pending'
  }
  router.replace({ query: { ...route.query, tab: fallback } })
}

// Compute the active filter configuration from constants
const filter = computed(() => routeFilters[tabParam.value as keyof typeof routeFilters] || routeFilters.all)
const activeColumns = computed(() => routeColumnsMap[tabParam.value] || leadsColumns)

if (searchParam.value && !serverSearch.value) {
  serverSearch.value = searchParam.value
}

// When tab changes, update useLeadsApi's internal tab tracker
watch(tabParam, (newTab) => {
  if (newTab) {
    setTab(newTab)
  }
}, { immediate: true })
</script>

<template>
  <LeadsApiCrudPage
    v-if="filter"
    :title="`Leads - ${filter.label || 'All Leads'}`"
    icon="i-lucide-magnet"
    entity-name="Lead"
    :columns="activeColumns"
    :form-fields="leadsFormFields"
    :clickable="tabParam === 'inspected'"
    :default-sort-key="tabParam === 'inspected' ? 'createdAt' : 'appointmentId'"
    default-sort-dir="desc"
  />
</template>
