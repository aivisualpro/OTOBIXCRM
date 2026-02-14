<script setup lang="ts">
definePageMeta({
  middleware: [
    (_to, _from) => {
      return navigateTo('/people/otobix', { replace: true })
    },
  ],
})
</script>

<template>
  <div />
</template>
