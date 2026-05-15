<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const userId = computed(() => route.params.id as string)

const { setHeader } = usePageHeader()
setHeader({ title: 'Sales / Dealer Details', description: '', icon: 'i-lucide-store' })

const { fetchAllUsers, getUserById } = usePeopleApi()
const { fetchKams } = useKamsApi()

onMounted(async () => {
  await Promise.all([fetchAllUsers(), fetchKams()])
})

const user = computed(() => getUserById(userId.value))
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Loading -->
    <div v-if="!user" class="flex items-center justify-center h-64 text-muted-foreground">
      <div class="flex flex-col items-center gap-3">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">Loading dealer...</p>
      </div>
    </div>

    <!-- Dealer detail view (read-only) -->
    <PeopleDealerDetailPage
      v-else
      :user="user"
      :read-only="true"
      back-route="/sales?tab=dealers"
    />
  </div>
</template>
