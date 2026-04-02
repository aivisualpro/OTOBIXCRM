<script setup lang="ts">
// QC page — editable mode, uses shared CarInspectionView component
// Route: /qc/:id/:tab? — tab is optional, defaults to 'details'
definePageMeta({
  key: route => `/qc/${route.params.id}`,
})
</script>

<template>
  <CarInspectionView />
</template>
