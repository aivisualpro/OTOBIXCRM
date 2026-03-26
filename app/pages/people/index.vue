<script setup lang="ts">
definePageMeta({
  middleware: [
    (_to, _from) => {
      return navigateTo('/people/dealer', { replace: true })
    },
  ],
})
</script>

<template>
  <div />
</template>
