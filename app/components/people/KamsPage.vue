<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'KAMs', description: 'Key Account Managers', icon: 'i-lucide-briefcase' })

const {
  allKams,
  isLoading,
  isFetched,
  fetchError,
  fetchKams,
  refreshKams,
  createKam,
  updateKam,
  deleteKam,
  assignKamToDealer,
} = useKamsApi()

const { allUsers, fetchAllUsers } = usePeopleApi()

onMounted(() => {
  fetchKams()
  fetchAllUsers()
})

// ─── Search ───
const search = ref('')

const filteredKams = computed(() => {
  let result = allKams.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(k =>
      ['name', 'email', 'phoneNumber', 'region'].some(key =>
        String(k[key] ?? '').toLowerCase().includes(q),
      ),
    )
  }
  return result
})

// ─── Pagination (30 per page) ───
const PER_PAGE = 30
const currentPage = ref(1)

watch(search, () => { currentPage.value = 1 })

const totalFiltered = computed(() => filteredKams.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltered.value / PER_PAGE)))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * PER_PAGE
  return filteredKams.value.slice(start, start + PER_PAGE)
})

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value)
    return
  currentPage.value = page
}

const showingFrom = computed(() => totalFiltered.value === 0 ? 0 : ((currentPage.value - 1) * PER_PAGE) + 1)
const showingTo = computed(() => Math.min(currentPage.value * PER_PAGE, totalFiltered.value))

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7)
    return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  if (current > 3)
    pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2)
    pages.push('...')
  pages.push(total)
  return pages
})

async function handleRefresh() {
  await refreshKams()
  toast.success('KAM data refreshed')
}

// ─── Create / Edit Dialog ───
const showFormDialog = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)

function defaultForm() {
  return {
    id: '',
    name: '',
    email: '',
    phoneNumber: '',
    region: '',
  }
}

const form = ref(defaultForm())

function openCreate() {
  isEditing.value = false
  form.value = defaultForm()
  showFormDialog.value = true
}

function openEdit(kam: any) {
  isEditing.value = true
  form.value = {
    id: kam._id || kam.id,
    name: kam.name || '',
    email: kam.email || '',
    phoneNumber: kam.phoneNumber || '',
    region: kam.region || '',
  }
  showFormDialog.value = true
}

async function handleSubmit() {
  if (!form.value.name.trim() || !form.value.email.trim()) {
    toast.error('Name and Email are required')
    return
  }

  isSubmitting.value = true
  try {
    if (isEditing.value) {
      await updateKam(form.value)
      toast.success(`KAM "${form.value.name}" updated`)
    }
    else {
      await createKam(form.value)
      toast.success(`KAM "${form.value.name}" created`)
    }
    showFormDialog.value = false
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Operation failed')
  }
  finally {
    isSubmitting.value = false
  }
}

// ─── Delete Confirmation ───
const showDeleteDialog = ref(false)
const deletingKam = ref<any>(null)
const isDeleting = ref(false)

function confirmDelete(kam: any) {
  deletingKam.value = kam
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deletingKam.value)
    return
  isDeleting.value = true
  try {
    await deleteKam(deletingKam.value._id || deletingKam.value.id)
    toast.success(`KAM "${deletingKam.value.name}" deleted`)
    showDeleteDialog.value = false
    deletingKam.value = null
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Delete failed')
  }
  finally {
    isDeleting.value = false
  }
}

// ─── Assign to Dealer Dialog ───
const showAssignDialog = ref(false)
const assigningKam = ref<any>(null)
const selectedDealerId = ref('')
const isAssigning = ref(false)

const dealerUsers = computed(() => allUsers.value.filter(u => u.userRole === 'Dealer'))

function openAssign(kam: any) {
  assigningKam.value = kam
  selectedDealerId.value = ''
  showAssignDialog.value = true
}

async function handleAssign() {
  if (!selectedDealerId.value) {
    toast.error('Please select a dealer')
    return
  }
  isAssigning.value = true
  try {
    await assignKamToDealer(assigningKam.value._id || assigningKam.value.id, selectedDealerId.value)
    const dealer = dealerUsers.value.find(d => (d._id || d.id) === selectedDealerId.value)
    toast.success(`Assigned "${assigningKam.value.name}" to dealer "${dealer?.userName || selectedDealerId.value}"`)
    showAssignDialog.value = false
  }
  catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Assignment failed')
  }
  finally {
    isAssigning.value = false
  }
}
</script>

<template>
  <!-- Teleport toolbar into the main header -->
  <ClientOnly>
    <Teleport to="#header-actions">
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="Search KAMs..." class="pl-8 h-8 w-48 text-sm" />
      </div>
      <p class="text-xs text-muted-foreground tabular-nums hidden sm:block whitespace-nowrap">
        {{ totalFiltered }} KAM{{ totalFiltered !== 1 ? 's' : '' }}
      </p>
      <Button variant="ghost" size="sm" class="h-8" :disabled="isLoading" @click="handleRefresh">
        <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
      <Button size="sm" class="h-8" @click="openCreate">
        <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
        Add KAM
      </Button>
    </Teleport>
  </ClientOnly>

  <div class="w-full flex flex-col h-full overflow-hidden">
    <!-- Error Banner -->
    <div v-if="fetchError" class="shrink-0 m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <Icon name="i-lucide-alert-circle" class="size-5 text-destructive shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">
          Failed to load KAMs
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ fetchError }}
        </p>
      </div>
      <Button variant="outline" size="sm" @click="handleRefresh">
        Retry
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="!isFetched && !fetchError" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Icon name="i-lucide-loader-2" class="size-8 animate-spin" />
        <p class="text-sm">
          Loading KAMs...
        </p>
      </div>
    </div>

    <!-- Table -->
    <div v-else-if="!fetchError" class="flex-1 min-h-0 overflow-auto">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Region</TableHead>
            <TableHead class="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="kam in paginatedItems"
            :key="kam.id"
            class="group"
          >
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar class="size-8 border">
                  <AvatarFallback class="text-xs bg-primary/10 text-primary">
                    {{ (kam.name || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-medium text-sm">{{ kam.name || '—' }}</span>
              </div>
            </TableCell>
            <TableCell>
              <span class="text-sm text-muted-foreground">{{ kam.email || '—' }}</span>
            </TableCell>
            <TableCell>
              <span class="text-sm font-mono">{{ kam.phoneNumber || '—' }}</span>
            </TableCell>
            <TableCell>
              <Badge v-if="kam.region" variant="outline" class="bg-blue-500/10 text-blue-600 border-blue-500/20">
                {{ kam.region }}
              </Badge>
              <span v-else class="text-sm text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" class="size-7" title="Assign to Dealer" @click.stop="openAssign(kam)">
                  <Icon name="i-lucide-link" class="size-3.5 text-violet-500" />
                </Button>
                <Button variant="ghost" size="icon" class="size-7" title="Edit" @click.stop="openEdit(kam)">
                  <Icon name="i-lucide-pencil" class="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" class="size-7" title="Delete" @click.stop="confirmDelete(kam)">
                  <Icon name="i-lucide-trash-2" class="size-3.5 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="paginatedItems.length === 0 && !isLoading">
            <TableCell :colspan="5" class="h-32 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon name="i-lucide-inbox" class="size-8" />
                <p>No KAMs found</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div v-if="isFetched && !fetchError" class="shrink-0 border-t bg-muted/30 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground tabular-nums">
        Showing {{ showingFrom }} to {{ showingTo }} out of {{ totalFiltered }} KAMs
      </p>
      <div v-if="totalPages > 1" class="flex items-center gap-1">
        <Button variant="outline" size="icon" class="size-7" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
          <Icon name="i-lucide-chevron-left" class="size-3.5" />
        </Button>
        <template v-for="pg in pageNumbers" :key="pg">
          <Button
            v-if="pg !== '...'"
            :variant="pg === currentPage ? 'default' : 'outline'"
            size="icon"
            class="size-7 text-xs"
            @click="goToPage(pg as number)"
          >
            {{ pg }}
          </Button>
          <span v-else class="px-1 text-xs text-muted-foreground">…</span>
        </template>
        <Button variant="outline" size="icon" class="size-7" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>

  <!-- Create / Edit KAM Dialog -->
  <Sheet v-model:open="showFormDialog">
    <SheetContent class="sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ isEditing ? 'Edit KAM' : 'Add New KAM' }}</SheetTitle>
        <SheetDescription>{{ isEditing ? 'Update KAM details.' : 'Create a new Key Account Manager.' }}</SheetDescription>
      </SheetHeader>

      <div class="mt-6 space-y-4">
        <div class="space-y-1.5">
          <Label for="kam-name">Name <span class="text-destructive">*</span></Label>
          <Input id="kam-name" v-model="form.name" placeholder="Full name" />
        </div>
        <div class="space-y-1.5">
          <Label for="kam-email">Email <span class="text-destructive">*</span></Label>
          <Input id="kam-email" v-model="form.email" type="email" placeholder="kam@otobix.com" />
        </div>
        <div class="space-y-1.5">
          <Label for="kam-phone">Phone Number</Label>
          <Input id="kam-phone" v-model="form.phoneNumber" placeholder="+91 9876543210" />
        </div>
        <div class="space-y-1.5">
          <Label for="kam-region">Region</Label>
          <Input id="kam-region" v-model="form.region" placeholder="Mumbai, Delhi, etc." />
        </div>
      </div>

      <SheetFooter class="mt-6">
        <Button variant="outline" @click="showFormDialog = false">
          Cancel
        </Button>
        <Button :disabled="isSubmitting" @click="handleSubmit">
          <Icon v-if="isSubmitting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else :name="isEditing ? 'i-lucide-save' : 'i-lucide-user-plus'" class="mr-1.5 size-3.5" />
          {{ isEditing ? 'Save Changes' : 'Create KAM' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>

  <!-- Delete Confirmation -->
  <AlertDialog v-model:open="showDeleteDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete KAM</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete <strong>{{ deletingKam?.name }}</strong>? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="showDeleteDialog = false">
          Cancel
        </AlertDialogCancel>
        <Button variant="destructive" :disabled="isDeleting" @click="handleDelete">
          <Icon v-if="isDeleting" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else name="i-lucide-trash-2" class="mr-1.5 size-3.5" />
          Delete
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Assign to Dealer Dialog -->
  <Sheet v-model:open="showAssignDialog">
    <SheetContent class="sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Assign KAM to Dealer</SheetTitle>
        <SheetDescription>
          Assign <strong>{{ assigningKam?.name }}</strong> to a dealer.
        </SheetDescription>
      </SheetHeader>

      <div class="mt-6 space-y-4">
        <div class="space-y-1.5">
          <Label for="assign-dealer">Select Dealer</Label>
          <Select v-model="selectedDealerId">
            <SelectTrigger id="assign-dealer">
              <SelectValue placeholder="Choose a dealer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="dealer in dealerUsers" :key="dealer._id || dealer.id" :value="dealer._id || dealer.id">
                {{ dealer.userName || dealer.email }} — {{ dealer.dealershipName || 'No dealership' }}
              </SelectItem>
              <div v-if="dealerUsers.length === 0" class="px-2 py-4 text-center text-sm text-muted-foreground">
                No dealers found
              </div>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SheetFooter class="mt-6">
        <Button variant="outline" @click="showAssignDialog = false">
          Cancel
        </Button>
        <Button :disabled="isAssigning || !selectedDealerId" @click="handleAssign">
          <Icon v-if="isAssigning" name="i-lucide-loader-2" class="mr-1.5 size-3.5 animate-spin" />
          <Icon v-else name="i-lucide-link" class="mr-1.5 size-3.5" />
          Assign
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
