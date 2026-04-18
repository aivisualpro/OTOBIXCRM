<script setup lang="ts">
const router = useRouter()
const { activeWorkspace } = useWorkspace()

const ws = activeWorkspace.value
let fallback = '/people/dealer'

if (ws?.defaultRoutes?.people) {
  fallback = ws.defaultRoutes.people
}
else if (ws?.peopleTabs && ws.peopleTabs.length > 0) {
  fallback = `/people/${ws.peopleTabs[0]}`
}

router.replace(fallback)
</script>

<template>
  <div />
</template>
