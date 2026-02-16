<script setup lang="ts">
import KanbanBoard from '~/components/kanban/KanbanBoard.vue'

const { setHeader } = usePageHeader()
setHeader({ title: 'Tasks', icon: 'i-lucide-check-square' })
</script>

<template>
  <div class="h-full">
    <KanbanBoard />
  </div>
</template>
