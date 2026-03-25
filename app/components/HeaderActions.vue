<script setup lang="ts">
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <ClientOnly>
    <Teleport v-if="mounted" to="#header-actions" :defer="true">
      <div class="flex items-center gap-2">
        <slot />
      </div>
    </Teleport>
  </ClientOnly>
</template>
