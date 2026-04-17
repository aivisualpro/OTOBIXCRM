<script setup lang="ts">
const { activeWorkspace } = useWorkspace()

const ws = activeWorkspace.value
const allowed = ws?.leadTabs || []

const { serverSearch, activeAdvancedFilterCount } = useLeadsApi()

let fallback = '/leads/all'

if (serverSearch.value || activeAdvancedFilterCount.value > 0) {
  fallback = '/leads/search-results'
}
else if (allowed.length > 0 && !allowed.includes('all') && !allowed.includes('pending')) {
  fallback = ws?.defaultRoutes?.leads || `/leads/${allowed[0]}`
}
else if (allowed.includes('all')) {
  fallback = '/leads/all'
}
else if (allowed.includes('pending')) {
  fallback = '/leads/pending'
}

navigateTo(fallback, { replace: true })
</script>

<template>
  <div class="flex items-center justify-center h-64 text-muted-foreground">
    <Icon name="i-lucide-loader-2" class="size-6 animate-spin" />
  </div>
</template>
