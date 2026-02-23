<script setup lang="ts">
const props = defineProps<{
  user: any
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

function getInitials(name: string): string {
  if (!name)
    return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  catch { return value }
}

function formatDateTime(value: string): string {
  if (!value)
    return '—'
  try {
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch { return value }
}

const statusColor: Record<string, string> = {
  Approved: 'bg-emerald-500',
  Pending: 'bg-amber-500',
  Rejected: 'bg-red-500',
}

const statusBadge: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const roleBadge: Record<string, string> = {
  'Admin': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Staff': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Super Admin': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  'KAM': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Inspector': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Operations': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  'Dealer': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Customer': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
}

const locations = computed(() => {
  const loc = props.user?.location
  if (!loc)
    return []
  if (Array.isArray(loc))
    return loc
  return [loc]
})

const addresses = computed(() => {
  const addr = props.user?.addressList
  if (!addr || (Array.isArray(addr) && addr.length === 0))
    return []
  return Array.isArray(addr) ? addr.filter((a: string) => a?.trim()) : [addr]
})

// Info cards data
const infoCards = computed(() => {
  if (!props.user)
    return []
  return [
    {
      icon: 'i-lucide-mail',
      label: 'Email',
      value: props.user.email,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: 'i-lucide-phone',
      label: 'Phone',
      value: props.user.phoneNumber,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: 'i-lucide-shield-check',
      label: 'Role',
      value: props.user.userRole,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      isBadge: true,
    },
    {
      icon: 'i-lucide-building-2',
      label: 'Dealership',
      value: props.user.dealershipName,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: 'i-lucide-user-check',
      label: 'Assigned KAM',
      value: props.user.assignedKam,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: 'i-lucide-tag',
      label: 'Entity Type',
      value: props.user.entityType,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
  ].filter(c => c.value)
})
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="sm:max-w-xl overflow-y-auto p-0">
      <!-- Hero Header -->
      <div class="relative">
        <!-- Gradient Background -->
        <div class="h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/10 relative overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.15),transparent_50%)]" />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
          <!-- Subtle pattern overlay -->
          <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;20&quot; height=&quot;20&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cdefs%3E%3Cpattern id=&quot;grid&quot; width=&quot;20&quot; height=&quot;20&quot; patternUnits=&quot;userSpaceOnUse&quot;%3E%3Cpath d=&quot;M 20 0 L 0 0 0 20&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;0.5&quot;/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=&quot;100%25&quot; height=&quot;100%25&quot; fill=&quot;url(%23grid)&quot;/%3E%3C/svg%3E');" />
        </div>

        <!-- Profile Avatar (overlapping hero) -->
        <div class="px-6 -mt-12 relative z-10">
          <div class="flex items-end gap-4">
            <Avatar class="size-20 border-4 border-background shadow-lg ring-2 ring-primary/10">
              <AvatarImage :src="user?.image" :alt="user?.userName" />
              <AvatarFallback class="text-xl font-semibold bg-primary/10 text-primary">
                {{ getInitials(user?.userName) }}
              </AvatarFallback>
            </Avatar>
            <div class="pb-1 flex-1 min-w-0">
              <h2 class="text-lg font-semibold truncate">
                {{ user?.userName || '—' }}
              </h2>
              <div class="flex items-center gap-2 mt-0.5">
                <span
                  class="inline-block size-2 rounded-full"
                  :class="statusColor[user?.approvalStatus] || 'bg-gray-400'"
                />
                <Badge variant="outline" class="text-[10px] h-5" :class="statusBadge[user?.approvalStatus] || ''">
                  {{ user?.approvalStatus || 'Unknown' }}
                </Badge>
                <Badge
                  v-if="user?.isStaff"
                  variant="outline"
                  class="text-[10px] h-5 bg-primary/10 text-primary border-primary/20"
                >
                  <Icon name="i-lucide-sparkles" class="size-2.5 mr-0.5" />
                  Staff
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Content Body -->
      <div class="px-6 pt-5 pb-6 space-y-6">
        <!-- Quick Info Cards -->
        <div class="grid grid-cols-2 gap-2.5">
          <div
            v-for="card in infoCards"
            :key="card.label"
            class="rounded-xl border bg-card/50 p-3 space-y-1.5 hover:shadow-sm transition-shadow"
          >
            <div class="flex items-center gap-2">
              <div class="rounded-lg p-1.5" :class="card.bgColor">
                <Icon :name="card.icon" class="size-3.5" :class="card.color" />
              </div>
              <span class="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{{ card.label }}</span>
            </div>
            <Badge v-if="card.isBadge" variant="outline" class="text-xs" :class="roleBadge[card.value] || ''">
              {{ card.value }}
            </Badge>
            <p v-else class="text-sm font-medium truncate" :title="card.value">
              {{ card.value }}
            </p>
          </div>
        </div>

        <!-- Locations -->
        <div v-if="locations.length > 0" class="space-y-2.5">
          <div class="flex items-center gap-2">
            <div class="rounded-lg p-1.5 bg-rose-500/10">
              <Icon name="i-lucide-map-pin" class="size-3.5 text-rose-500" />
            </div>
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locations</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="loc in locations"
              :key="loc"
              variant="outline"
              class="bg-rose-500/5 text-rose-600 border-rose-500/15 text-xs"
            >
              <Icon name="i-lucide-map-pin" class="size-3 mr-1" />
              {{ loc }}
            </Badge>
          </div>
        </div>

        <!-- Addresses -->
        <div v-if="addresses.length > 0" class="space-y-2.5">
          <div class="flex items-center gap-2">
            <div class="rounded-lg p-1.5 bg-sky-500/10">
              <Icon name="i-lucide-home" class="size-3.5 text-sky-500" />
            </div>
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Addresses</span>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="(addr, i) in addresses"
              :key="i"
              class="rounded-lg border bg-muted/30 px-3 py-2 text-sm flex items-start gap-2"
            >
              <Icon name="i-lucide-navigation" class="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <span>{{ addr }}</span>
            </div>
          </div>
        </div>

        <!-- Primary Contact -->
        <div v-if="user?.primaryContactPerson" class="space-y-2.5">
          <div class="flex items-center gap-2">
            <div class="rounded-lg p-1.5 bg-indigo-500/10">
              <Icon name="i-lucide-contact" class="size-3.5 text-indigo-500" />
            </div>
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary Contact</span>
          </div>
          <div class="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            {{ user.primaryContactPerson }}
          </div>
        </div>

        <!-- Separator -->
        <Separator />

        <!-- Metadata / Timeline -->
        <div class="space-y-2.5">
          <div class="flex items-center gap-2">
            <div class="rounded-lg p-1.5 bg-gray-500/10">
              <Icon name="i-lucide-clock" class="size-3.5 text-gray-500" />
            </div>
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Joined</span>
              <span class="font-medium">{{ formatDate(user?.createdAt) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Last updated</span>
              <span class="font-medium">{{ formatDateTime(user?.updatedAt) }}</span>
            </div>
            <div v-if="user?.lastLogin" class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Last login</span>
              <span class="font-medium">{{ formatDateTime(user.lastLogin) }}</span>
            </div>
          </div>
        </div>

        <!-- User ID (subtle) -->
        <div class="rounded-lg bg-muted/40 border border-dashed px-3 py-2 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">User ID</span>
          <code class="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
            {{ user?._id || user?.id || '—' }}
          </code>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
