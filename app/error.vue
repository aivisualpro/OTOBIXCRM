<script setup>
const { theme } = useAppSettings()

useHead({
  bodyAttrs: {
    class: computed(() => `color-${theme.value?.color || 'default'} theme-${theme.value?.type || 'default'}`),
  },
})

const error = useError()
const router = useRouter()

const statusCode = computed(() => error.value?.statusCode || 404)
const statusMessage = computed(() => {
  if (error.value?.statusMessage)
    return error.value.statusMessage
  if (statusCode.value === 404)
    return 'Oops! Page Not Found!'
  if (statusCode.value === 500)
    return 'Internal Server Error'
  return 'Something went wrong'
})

const description = computed(() => {
  if (statusCode.value === 404) {
    return `It seems like the page you're looking for does not exist or might have been removed.`
  }
  if (statusCode.value === 500) {
    return `The server encountered an unexpected condition. Please try again.`
  }
  return error.value?.message || 'An unexpected error occurred. Please try again.'
})

function handleClearError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="h-svh">
    <div class="m-auto h-full w-full flex flex-col items-center justify-center gap-2">
      <h1 class="text-[7rem] font-bold leading-tight">
        {{ statusCode }}
      </h1>
      <span class="font-medium">{{ statusMessage }}</span>
      <p class="text-center text-muted-foreground">
        {{ description }}
      </p>
      <div class="mt-6 flex gap-4">
        <Button variant="outline" @click="router.back()">
          Go Back
        </Button>
        <Button @click="handleClearError">
          Back to Home
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
