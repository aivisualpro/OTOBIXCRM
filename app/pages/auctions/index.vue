<script setup lang="ts">
definePageMeta({
  middleware: [
    (_to: any, _from: any) => {
      return navigateTo('/auctions/upcoming', { replace: true })
    },
  ],
})
</script>

<template>
  <div />
</template>
