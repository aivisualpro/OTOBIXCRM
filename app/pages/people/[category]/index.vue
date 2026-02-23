<script setup lang="ts">
import { otobixColumns, peopleColumns, peopleRouteFilters } from '~/constants/people'

const route = useRoute()
const categoryKey = computed(() => route.params.category as string)
const isKams = computed(() => categoryKey.value === 'kams')
const filter = computed(() => peopleRouteFilters[categoryKey.value])
const activeColumns = computed(() => categoryKey.value === 'otobix' ? otobixColumns : peopleColumns)
</script>

<template>
  <!-- KAMs have their own dedicated component & API -->
  <PeopleKamsPage v-if="isKams" />
  <PeopleTablePage
    v-else-if="filter"
    :title="filter.label"
    :description="`Viewing ${filter.label} users`"
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
