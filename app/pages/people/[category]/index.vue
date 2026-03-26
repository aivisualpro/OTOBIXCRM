<script setup lang="ts">
import { peopleColumns, peopleRouteFilters } from '~/constants/people'

const route = useRoute()
const categoryKey = computed(() => route.params.category as string)
const filter = computed(() => peopleRouteFilters[categoryKey.value])

const activeColumns = computed(() => {
  return peopleColumns.filter(col => {
    if (col.key === 'phoneNumber' && categoryKey.value === 'telecaller') return false
    return true
  })
})
</script>

<template>
  <PeopleTablePage
    v-if="filter"
    :title="filter.label"
    description=""
    icon="i-lucide-users"
    entity-name="Person"
    :columns="activeColumns"
    :filter-fn="filter.filterFn"
    :show-status-counts="filter.showStatusCounts"
    :category-key="categoryKey"
  />
  <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
    <p>Unknown category: {{ categoryKey }}</p>
  </div>
</template>
