<script setup lang="ts">
// Inspection page — readonly mode, uses shared CarInspectionView component
// All QC edits are automatically reflected here since they share the same data source
</script>

<template>
  <CarInspectionView :readonly="true" />
</template>
