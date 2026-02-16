<script setup lang="ts">
import type { TelecallingLead } from '~/composables/useLeadsApi'

const { setHeader } = usePageHeader()
setHeader({ title: 'Timeline', icon: 'i-lucide-gantt-chart', description: 'Approved leads lifecycle — track each appointment through status changes' })

// ── Fetch leads data ───────────────────────────────────
const { allLeads, isLoading, fetchAllLeads } = useLeadsApi()
onMounted(() => fetchAllLeads())

// ── Status pipeline (ordered journey) ──────────────────
const statusPipeline = [
  { key: 'Pending', label: 'Pending', color: '#94a3b8', bg: 'bg-slate-500' },
  { key: 'Scheduled', label: 'Scheduled', color: '#3b82f6', bg: 'bg-blue-500' },
  { key: 'Rescheduled', label: 'Re-Scheduled', color: '#6366f1', bg: 'bg-indigo-500' },
  { key: 'Running', label: 'Running', color: '#f59e0b', bg: 'bg-amber-500' },
  { key: 'Inspected', label: 'Inspected', color: '#10b981', bg: 'bg-emerald-500' },
  { key: 'Cancelled', label: 'Cancelled', color: '#ef4444', bg: 'bg-red-500' },
]

const approvalPipeline = [
  { key: 'Pending', label: 'Approval Pending', color: '#94a3b8', bg: 'bg-slate-400' },
  { key: 'Under Review', label: 'Under Review', color: '#8b5cf6', bg: 'bg-violet-500' },
  { key: 'Quality Approved', label: 'Approved', color: '#10b981', bg: 'bg-emerald-500' },
  { key: 'Quality Rejected', label: 'Rejected', color: '#ef4444', bg: 'bg-red-500' },
]

// Map for quick lookup
const statusColorMap: Record<string, string> = {}
statusPipeline.forEach(s => { statusColorMap[s.key] = s.color })
approvalPipeline.forEach(s => { statusColorMap[s.key] = s.color })

// ── State ──────────────────────────────────────────────
const searchQuery = ref('')
const filterStatus = ref('all')
const selectedLead = ref<TelecallingLead | null>(null)
const showDetail = ref(false)

// ── Process leads into Gantt rows ──────────────────────
interface GanttBar {
  label: string
  color: string
  startDay: number
  durationDays: number
  isCurrent: boolean
}

interface GanttRow {
  lead: TelecallingLead
  appointmentId: string
  vehicle: string
  bars: GanttBar[]
}

// Timeline boundaries
const timelineStart = computed(() => {
  if (allLeads.value.length === 0) return new Date()
  const dates = allLeads.value
    .map(l => new Date(l.createdAt))
    .filter(d => !isNaN(d.getTime()))
  if (dates.length === 0) return new Date()
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
  // Shift to start of that day
  earliest.setHours(0, 0, 0, 0)
  return earliest
})

const timelineEnd = computed(() => {
  // End = today + 7 days buffer
  const end = new Date()
  end.setDate(end.getDate() + 7)
  end.setHours(23, 59, 59, 999)
  return end
})

const totalDays = computed(() => {
  const diff = timelineEnd.value.getTime() - timelineStart.value.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

const dayWidth = 12
const timelineWidth = computed(() => totalDays.value * dayWidth)

// ── Build Gantt rows from lead data ────────────────────
const ganttRows = computed<GanttRow[]>(() => {
  return allLeads.value
    .filter((lead) => {
      // Only show inspected + approved leads
      if (lead.inspectionStatus !== 'Inspected') return false
      if (lead.approvalStatus !== 'Quality Approved') return false
      // Search filter
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        const searchable = `${lead.appointmentId} ${lead.make} ${lead.model} ${lead.variant} ${lead.ownerName}`.toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
    .map((lead) => {
      const bars = buildBarsForLead(lead)
      return {
        lead,
        appointmentId: lead.appointmentId,
        vehicle: [lead.make, lead.model, lead.variant].filter(Boolean).join(' '),
        bars,
      }
    })
    .sort((a, b) => {
      // Sort by createdAt descending (newest first)
      return new Date(b.lead.createdAt).getTime() - new Date(a.lead.createdAt).getTime()
    })
})

// Build timeline bars for a single lead based on its current status
function buildBarsForLead(lead: TelecallingLead): GanttBar[] {
  const bars: GanttBar[] = []
  const createdAt = new Date(lead.createdAt)
  if (isNaN(createdAt.getTime())) return bars

  const currentInspection = lead.inspectionStatus || 'Pending'
  const currentApproval = lead.approvalStatus || 'Pending'

  // Find the index of current inspection status in the pipeline
  const currentInspIdx = statusPipeline.findIndex(s => s.key === currentInspection)
  const resolvedInspIdx = currentInspIdx >= 0 ? currentInspIdx : 0

  // Determine the timeline: createdAt → now
  const now = new Date()
  const totalLeadDays = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))

  // Distribute the completed statuses evenly across the elapsed time
  const completedSteps = resolvedInspIdx + 1 // Number of statuses reached (including current)
  const daysPerStep = Math.max(1, Math.floor(totalLeadDays / completedSteps))
  const startDayOffset = Math.max(0, Math.floor((createdAt.getTime() - timelineStart.value.getTime()) / (1000 * 60 * 60 * 24)))

  for (let i = 0; i <= resolvedInspIdx; i++) {
    const status = statusPipeline[i]
    if (!status) continue
    const isLast = i === resolvedInspIdx
    const barStart = startDayOffset + (i * daysPerStep)
    const barDuration = isLast
      ? Math.max(1, totalLeadDays - (i * daysPerStep))
      : daysPerStep

    bars.push({
      label: status.label,
      color: status.color,
      startDay: barStart,
      durationDays: barDuration,
      isCurrent: isLast,
    })
  }

  // If inspected + has approval status beyond 'Pending', add approval bars
  if (currentInspection === 'Inspected' && currentApproval !== 'Pending') {
    const approvalIdx = approvalPipeline.findIndex(s => s.key === currentApproval)
    if (approvalIdx > 0) {
      const lastBar = bars[bars.length - 1]
      const approvalStart = lastBar ? lastBar.startDay + lastBar.durationDays : startDayOffset + totalLeadDays
      // Mark the last inspection bar as no longer current
      if (lastBar) lastBar.isCurrent = false

      for (let i = 1; i <= approvalIdx; i++) {
        const step = approvalPipeline[i]
        if (!step) continue
        bars.push({
          label: step.label,
          color: step.color,
          startDay: approvalStart + ((i - 1) * 2),
          durationDays: 2,
          isCurrent: i === approvalIdx,
        })
      }
    }
  }

  return bars
}

// ── Month headers ──────────────────────────────────────
const monthHeaders = computed(() => {
  const headers: { label: string; left: number; width: number }[] = []
  const start = new Date(timelineStart.value)
  const current = new Date(start.getFullYear(), start.getMonth(), 1)

  while (current < timelineEnd.value) {
    const monthStart = new Date(Math.max(current.getTime(), start.getTime()))
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    const monthEnd = new Date(Math.min(nextMonth.getTime(), timelineEnd.value.getTime()))
    const daysInView = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24))
    const offsetDays = Math.ceil((monthStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    headers.push({
      label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      left: offsetDays * dayWidth,
      width: daysInView * dayWidth,
    })
    current.setMonth(current.getMonth() + 1)
  }
  return headers
})

// Weekly markers
const weekMarkers = computed(() => {
  const markers: { label: string; left: number; width: number }[] = []
  const start = new Date(timelineStart.value)
  const current = new Date(start)
  // Align to Monday
  current.setDate(current.getDate() - current.getDay() + 1)

  while (current < timelineEnd.value) {
    const weekStart = new Date(Math.max(current.getTime(), start.getTime()))
    const weekEnd = new Date(current)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const actualEnd = new Date(Math.min(weekEnd.getTime(), timelineEnd.value.getTime()))
    const daysInView = Math.ceil((actualEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
    const offsetDays = Math.ceil((weekStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    markers.push({
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      left: offsetDays * dayWidth,
      width: daysInView * dayWidth,
    })
    current.setDate(current.getDate() + 7)
  }
  return markers
})

// ── Today indicator ────────────────────────────────────
const todayOffset = computed(() => {
  const today = new Date()
  const days = Math.ceil((today.getTime() - timelineStart.value.getTime()) / (1000 * 60 * 60 * 24))
  return days * dayWidth
})

// ── Stats ──────────────────────────────────────────────
const stats = computed(() => {
  const total = allLeads.value.length
  const pending = allLeads.value.filter(l => l.inspectionStatus === 'Pending').length
  const scheduled = allLeads.value.filter(l => l.inspectionStatus === 'Scheduled' || l.inspectionStatus === 'Rescheduled').length
  const inspected = allLeads.value.filter(l => l.inspectionStatus === 'Inspected').length
  const cancelled = allLeads.value.filter(l => l.inspectionStatus === 'Cancelled').length
  return { total, pending, scheduled, inspected, cancelled }
})

// ── Detail Dialog ──────────────────────────────────────
function openLeadDetail(lead: TelecallingLead) {
  selectedLead.value = lead
  showDetail.value = true
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  catch { return dateStr }
}

// ── Scroll Sync ────────────────────────────────────────
const headerTimelineRef = ref<HTMLElement | null>(null)
const bodyTimelineRef = ref<HTMLElement | null>(null)
const leftPanelRef = ref<HTMLElement | null>(null)
let isSyncing = false

function onBodyScroll() {
  if (isSyncing) return
  isSyncing = true
  if (headerTimelineRef.value && bodyTimelineRef.value) {
    headerTimelineRef.value.scrollLeft = bodyTimelineRef.value.scrollLeft
  }
  requestAnimationFrame(() => { isSyncing = false })
}

function onHeaderScroll() {
  if (isSyncing) return
  isSyncing = true
  if (bodyTimelineRef.value && headerTimelineRef.value) {
    bodyTimelineRef.value.scrollLeft = headerTimelineRef.value.scrollLeft
  }
  requestAnimationFrame(() => { isSyncing = false })
}

function onBodyVerticalScroll() {
  if (leftPanelRef.value && bodyTimelineRef.value) {
    leftPanelRef.value.scrollTop = bodyTimelineRef.value.scrollTop
  }
}

function onLeftPanelScroll() {
  if (bodyTimelineRef.value && leftPanelRef.value) {
    bodyTimelineRef.value.scrollTop = leftPanelRef.value.scrollTop
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <ClientOnly>
      <Teleport to="#header-actions">
        <div class="flex items-center gap-2">
          <div class="relative">
            <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-8 h-8 w-48 text-sm" />
          </div>
          <p class="text-xs text-muted-foreground tabular-nums hidden lg:block">
            {{ ganttRows.length }} leads
          </p>
          <Button variant="outline" size="sm" class="h-8" @click="fetchAllLeads(true)">
            <Icon name="i-lucide-refresh-cw" class="mr-1 size-3.5" />
            Refresh
          </Button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Card>
        <CardContent class="flex items-center gap-3 p-4">
          <div class="flex items-center justify-center rounded-lg bg-primary/10 p-2">
            <Icon name="i-lucide-list-checks" class="size-4 text-primary" />
          </div>
          <div>
            <p class="text-2xl font-bold tabular-nums">{{ stats.total }}</p>
            <p class="text-xs text-muted-foreground">Total Leads</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center gap-3 p-4">
          <div class="flex items-center justify-center rounded-lg bg-slate-500/10 p-2">
            <Icon name="i-lucide-clock" class="size-4 text-slate-500" />
          </div>
          <div>
            <p class="text-2xl font-bold tabular-nums text-slate-600 dark:text-slate-400">{{ stats.pending }}</p>
            <p class="text-xs text-muted-foreground">Pending</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center gap-3 p-4">
          <div class="flex items-center justify-center rounded-lg bg-blue-500/10 p-2">
            <Icon name="i-lucide-calendar-check" class="size-4 text-blue-500" />
          </div>
          <div>
            <p class="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{{ stats.scheduled }}</p>
            <p class="text-xs text-muted-foreground">Scheduled</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center gap-3 p-4">
          <div class="flex items-center justify-center rounded-lg bg-emerald-500/10 p-2">
            <Icon name="i-lucide-check-circle-2" class="size-4 text-emerald-500" />
          </div>
          <div>
            <p class="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ stats.inspected }}</p>
            <p class="text-xs text-muted-foreground">Inspected</p>
          </div>
        </CardContent>
      </Card>
      <Card class="col-span-2 md:col-span-1">
        <CardContent class="flex items-center gap-3 p-4">
          <div class="flex items-center justify-center rounded-lg bg-red-500/10 p-2">
            <Icon name="i-lucide-x-circle" class="size-4 text-red-500" />
          </div>
          <div>
            <p class="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{{ stats.cancelled }}</p>
            <p class="text-xs text-muted-foreground">Cancelled</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Loading -->
    <Card v-if="isLoading" class="p-8">
      <div class="space-y-4">
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-3/4" />
      </div>
    </Card>

    <!-- Gantt Chart -->
    <Card v-else class="overflow-hidden">
      <div class="flex border-b">
        <!-- Left panel header -->
        <div class="w-[300px] shrink-0 px-4 py-3 bg-muted/30 border-r flex items-center gap-2">
          <Icon name="i-lucide-car" class="size-4 text-muted-foreground" />
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appointments</span>
        </div>
        <!-- Timeline header -->
        <div
          ref="headerTimelineRef"
          class="flex-1 overflow-x-auto gantt-scroll-header"
          @scroll="onHeaderScroll"
        >
          <div :style="{ width: `${timelineWidth}px` }" class="relative">
            <!-- Month labels -->
            <div class="flex border-b bg-muted/20" style="height: 28px">
              <div
                v-for="(mh, i) in monthHeaders"
                :key="i"
                class="text-xs font-semibold text-center py-1.5 border-r border-border/50"
                :style="{ position: 'absolute', left: `${mh.left}px`, width: `${mh.width}px` }"
              >
                {{ mh.label }}
              </div>
            </div>
            <!-- Week labels -->
            <div class="flex h-7 relative">
              <div
                v-for="(wm, i) in weekMarkers"
                :key="i"
                class="text-[10px] text-muted-foreground text-center border-r border-border/30 flex items-center justify-center"
                :style="{ position: 'absolute', left: `${wm.left}px`, width: `${wm.width}px` }"
              >
                {{ wm.label }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="flex max-h-[600px]">
        <!-- Left panel: appointment list -->
        <div
          ref="leftPanelRef"
          class="w-[300px] shrink-0 border-r overflow-y-auto gantt-scroll-y"
          @scroll="onLeftPanelScroll"
        >
          <button
            v-for="row in ganttRows"
            :key="row.appointmentId"
            class="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer text-left border-b"
            :class="{ 'bg-primary/5': selectedLead?.appointmentId === row.appointmentId }"
            @click="openLeadDetail(row.lead)"
          >
            <!-- Status dot -->
            <div
              class="size-2 rounded-full shrink-0"
              :style="{ backgroundColor: statusColorMap[row.lead.inspectionStatus] || '#94a3b8' }"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold font-mono text-primary truncate">{{ row.appointmentId }}</span>
              </div>
              <div class="text-[10px] text-muted-foreground truncate mt-0.5">
                {{ row.vehicle || 'Unknown Vehicle' }}
              </div>
            </div>
            <!-- Current status badge -->
            <Badge
              variant="outline"
              class="text-[9px] px-1.5 py-0 h-4 shrink-0"
              :style="{ borderColor: `${statusColorMap[row.lead.inspectionStatus] || '#94a3b8'}40`, color: statusColorMap[row.lead.inspectionStatus] || '#94a3b8' }"
            >
              {{ row.lead.inspectionStatus }}
            </Badge>
          </button>

          <!-- Empty state -->
          <div v-if="ganttRows.length === 0" class="p-8 text-center">
            <Icon name="i-lucide-inbox" class="size-8 text-muted-foreground mx-auto mb-2" />
            <p class="text-sm text-muted-foreground">No leads found</p>
          </div>
        </div>

        <!-- Right panel: timeline bars -->
        <div
          ref="bodyTimelineRef"
          class="flex-1 overflow-auto gantt-scroll"
          @scroll="onBodyScroll(); onBodyVerticalScroll()"
        >
          <div :style="{ width: `${timelineWidth}px` }" class="relative">
            <div
              v-for="row in ganttRows"
              :key="row.appointmentId"
              class="h-[41px] border-b relative group"
              :class="{ 'bg-primary/[0.02]': selectedLead?.appointmentId === row.appointmentId }"
            >
              <!-- Week grid lines -->
              <div
                v-for="(wm, wmIdx) in weekMarkers"
                :key="wmIdx"
                class="absolute top-0 bottom-0 border-r border-border/10"
                :style="{ left: `${wm.left + wm.width}px` }"
              />

              <!-- Today line -->
              <div
                class="absolute top-0 bottom-0 w-px bg-rose-500/60 z-10"
                :style="{ left: `${todayOffset}px` }"
              />

              <!-- Status bars -->
              <div
                v-for="(bar, barIdx) in row.bars"
                :key="barIdx"
                class="absolute top-[10px] h-[20px] rounded-full cursor-pointer z-20 group/bar transition-all hover:scale-y-125 hover:shadow-lg"
                :style="{
                  left: `${bar.startDay * dayWidth}px`,
                  width: `${Math.max(dayWidth, bar.durationDays * dayWidth)}px`,
                  backgroundColor: `${bar.color}${bar.isCurrent ? '40' : '25'}`,
                  border: `1.5px solid ${bar.color}${bar.isCurrent ? '80' : '50'}`,
                }"
                @click="openLeadDetail(row.lead)"
              >
                <!-- Fill for current status -->
                <div
                  v-if="bar.isCurrent"
                  class="absolute inset-0 rounded-full animate-pulse-subtle"
                  :style="{ backgroundColor: `${bar.color}30` }"
                />
                <!-- Hover tooltip -->
                <div
                  class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity bg-popover border shadow-lg z-30 pointer-events-none"
                >
                  {{ bar.label }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t bg-muted/20">
        <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline:</span>
        <div v-for="s in statusPipeline" :key="s.key" class="flex items-center gap-1.5">
          <div class="size-2 rounded-full" :style="{ backgroundColor: s.color }" />
          <span class="text-[10px] text-muted-foreground">{{ s.label }}</span>
        </div>
        <div class="w-px h-3 bg-border mx-1" />
        <div v-for="s in approvalPipeline.slice(1)" :key="s.key" class="flex items-center gap-1.5">
          <div class="size-2 rounded-full" :style="{ backgroundColor: s.color }" />
          <span class="text-[10px] text-muted-foreground">{{ s.label }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-px h-4 bg-rose-500/60" />
          <span class="text-[10px] text-muted-foreground">Today</span>
        </div>
      </div>
    </Card>

    <!-- Lead Detail Dialog -->
    <Dialog v-model:open="showDetail">
      <DialogContent class="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="i-lucide-car" class="size-4 text-primary" />
            {{ selectedLead?.appointmentId }}
          </DialogTitle>
          <DialogDescription>
            {{ [selectedLead?.make, selectedLead?.model, selectedLead?.variant].filter(Boolean).join(' ') }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedLead" class="space-y-4">
          <!-- Status badges -->
          <div class="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              :style="{ borderColor: `${statusColorMap[selectedLead.inspectionStatus] || '#94a3b8'}40`, color: statusColorMap[selectedLead.inspectionStatus] || '#94a3b8' }"
            >
              <div class="size-1.5 rounded-full mr-1.5" :style="{ backgroundColor: statusColorMap[selectedLead.inspectionStatus] || '#94a3b8' }" />
              {{ selectedLead.inspectionStatus }}
            </Badge>
            <Badge
              variant="outline"
              :style="{ borderColor: `${statusColorMap[selectedLead.approvalStatus] || '#94a3b8'}40`, color: statusColorMap[selectedLead.approvalStatus] || '#94a3b8' }"
            >
              {{ selectedLead.approvalStatus }}
            </Badge>
            <Badge v-if="selectedLead.priority" variant="outline" class="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800">
              {{ selectedLead.priority }} Priority
            </Badge>
          </div>

          <!-- Info grid -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Owner</p>
              <p class="text-sm font-medium">{{ selectedLead.ownerName || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Contact</p>
              <p class="text-sm font-medium">{{ selectedLead.customerContactNumber || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Registration</p>
              <p class="text-sm font-medium font-mono">{{ selectedLead.carRegistrationNumber || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">City</p>
              <p class="text-sm font-medium">{{ selectedLead.city || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Created</p>
              <p class="text-sm font-medium">{{ formatDate(selectedLead.createdAt) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Inspection Date</p>
              <p class="text-sm font-medium">{{ formatDate(selectedLead.inspectionDateTime) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Allocated To</p>
              <p class="text-sm font-medium">{{ selectedLead.allocatedTo || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Added By</p>
              <p class="text-sm font-medium">{{ selectedLead.addedBy || '—' }}</p>
            </div>
          </div>

          <!-- Remarks -->
          <div v-if="selectedLead.remarks" class="space-y-1">
            <p class="text-xs text-muted-foreground">Remarks</p>
            <p class="text-sm">{{ selectedLead.remarks }}</p>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" @click="showDetail = false">
            Close
          </Button>
          <NuxtLink :to="`/inspection/${selectedLead?.id}`">
            <Button>
              <Icon name="i-lucide-external-link" class="mr-1 size-4" />
              View Details
            </Button>
          </NuxtLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.gantt-scroll::-webkit-scrollbar {
  height: 6px;
}
.gantt-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.gantt-scroll::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 3px;
}
.gantt-scroll::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.4);
}

.gantt-scroll-header {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.gantt-scroll-header::-webkit-scrollbar {
  display: none;
}

.gantt-scroll-y::-webkit-scrollbar {
  width: 4px;
}
.gantt-scroll-y::-webkit-scrollbar-track {
  background: transparent;
}
.gantt-scroll-y::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 2px;
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2.5s ease-in-out infinite;
}
</style>
