<script setup lang="ts">
</script>

<template>
  <NuxtErrorBoundary>
    <LeadsLayout>
      <NuxtPage />
    </LeadsLayout>
    <template #error="{ error, clearError }">
      <div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div class="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Icon name="i-lucide-alert-triangle" class="size-8 text-destructive" />
        </div>
        <h3 class="text-lg font-semibold">
          Something went wrong
        </h3>
        <p class="text-sm text-muted-foreground max-w-sm">
          {{ error?.message || 'An unexpected error occurred while loading leads.' }}
        </p>
        <Button size="sm" @click="clearError()">
          <Icon name="i-lucide-refresh-cw" class="mr-1.5 size-3.5" />
          Try Again
        </Button>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>
