<script setup lang="ts">
// Inspection page — readonly mode, uses shared CarInspectionView component
// Route: /inspection/:id/:tab? — tab is optional, defaults to 'details'
// All QC edits are automatically reflected here since they share the same data source
definePageMeta({
  key: route => `/inspection/${route.params.id}`,
})
</script>

<template>
  <CarInspectionView :readonly="true" />
</template>
