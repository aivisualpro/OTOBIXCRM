<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { UseTimeAgoMessages, UseTimeAgoOptions, UseTimeAgoUnitNamesDefault } from '@vueuse/core'
import type { Column, NewTask, Task } from '~/types/kanban'
import {
  CalendarDateTime,
  DateFormatter,
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from '@internationalized/date'
import Draggable from 'vuedraggable'
import { useKanban } from '~/composables/useKanban'
import CardFooter from '../ui/card/CardFooter.vue'

const { board, addTask, updateTask, removeTask, setColumns, addSubtask, toggleSubtask, removeSubtask, addComment, removeComment, fetchTasks, isLoading: isBoardLoading } = useKanban()

onMounted(() => {
  fetchTasks()
})

// ── Pagination: show 20 tasks per column, load more on scroll ──
const PAGE_SIZE = 20
const visibleCount = ref<Record<string, number>>({})

function getVisibleCount(colId: string): number {
  return visibleCount.value[colId] || PAGE_SIZE
}

function visibleTasks(col: Column): Task[] {
  return col.tasks.slice(0, getVisibleCount(col.id))
}

function hasMore(col: Column): boolean {
  return col.tasks.length > getVisibleCount(col.id)
}

function loadMore(colId: string) {
  visibleCount.value[colId] = (visibleCount.value[colId] || PAGE_SIZE) + PAGE_SIZE
}

function onColumnScroll(event: Event, colId: string) {
  const el = event.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
    loadMore(colId)
  }
}

const newSubtaskTitle = ref('')
const newCommentText = ref('')

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})
const dueDate = ref<DateValue | undefined>()
const dueTime = ref<string | undefined>('00:00')

watch(() => dueTime.value, (newVal) => {
  if (!newVal)
    return
  if (dueDate.value) {
    const [hours, minutes] = newVal.split(':').map(Number)
    dueDate.value = new CalendarDateTime(
      dueDate.value.year,
      dueDate.value.month,
      dueDate.value.day,
      hours,
      minutes,
    )
  }
})

const showModalTask = ref<{ type: 'create' | 'edit', open: boolean, columnId: string | null, taskId?: string | null }>({
  type: 'create',
  open: false,
  columnId: null,
  taskId: null,
})
const newTask = reactive<NewTask>({
  title: '',
  description: '',
  priority: undefined,
  dueDate: undefined,
  status: '',
  labels: undefined,
})
function resetData() {
  dueDate.value = undefined
  dueTime.value = '00:00'
}
watch(() => showModalTask.value.open, (newVal) => {
  if (!newVal)
    resetData()
})

function openNewTask(colId: string) {
  showModalTask.value = { type: 'create', open: true, columnId: colId }
  newTask.title = ''
  newTask.description = ''
  newTask.priority = undefined
}
function createTask() {
  if (!showModalTask.value.columnId || !newTask.title.trim())
    return
  const payload: NewTask = {
    title: newTask.title.trim(),
    description: newTask.description?.trim(),
    priority: newTask.priority,
    dueDate: dueDate.value?.toDate(getLocalTimeZone()),
    status: showModalTask.value.columnId,
    labels: newTask.labels,
  }
  addTask(showModalTask.value.columnId, payload)
  showModalTask.value.open = false
}

function editTask() {
  if (!showModalTask.value.columnId || !newTask.title.trim())
    return
  const payload: Partial<Task> = {
    title: newTask.title.trim(),
    description: newTask.description?.trim(),
    priority: newTask.priority,
    dueDate: dueDate.value?.toDate(getLocalTimeZone()),
    status: showModalTask.value.columnId,
    labels: newTask.labels,
  }
  updateTask(showModalTask.value.columnId, showModalTask.value.taskId!, payload)
  showModalTask.value.open = false
}

function showEditTask(colId: string, taskId: string) {
  const task = board.value.columns.find(c => c.id === colId)?.tasks.find(t => t.id === taskId)
  if (!task)
    return
  newTask.title = task.title
  newTask.description = task.description
  newTask.priority = task.priority
  if (typeof task.dueDate === 'object') {
    task.dueDate = task.dueDate.toISOString()
  }
  dueDate.value = parseAbsoluteToLocal(task.dueDate as string)
  dueTime.value = `${dueDate.value.hour < 10 ? `0${dueDate.value?.hour}` : dueDate.value?.hour}:${dueDate.value.minute < 10 ? `0${dueDate.value?.minute}` : dueDate.value?.minute}`
  newTask.status = task.status
  newTask.labels = task.labels
  showModalTask.value = { type: 'edit', open: true, columnId: colId, taskId }
}

function onColumnDrop(evt: any) {
  setColumns(evt.to.__draggable_component__.modelValue)
}

function onTaskDrop() {
  nextTick(() => setColumns([...board.value.columns]))
}

function colorPriority(p?: Task['priority']) {
  if (!p)
    return 'text-warning'
  if (p === 'low')
    return 'text-blue-500'
  if (p === 'medium')
    return 'text-warning'
  return 'text-destructive'
}

function iconPriority(p?: Task['priority']) {
  if (!p)
    return 'lucide:equal'
  if (p === 'low')
    return 'lucide:chevron-down'
  if (p === 'medium')
    return 'lucide:equal'
  return 'lucide:chevron-up'
}

const SHORT_MESSAGES = {
  justNow: 'now',
  past: (n: string, _isPast: boolean) => n,
  future: (n: string, _isPast: boolean) => n,
  invalid: '',

  second: (n: number, _isPast: boolean) => `${n}sec`,
  minute: (n: number, _isPast: boolean) => `${n}min`,
  hour: (n: number, _isPast: boolean) => `${n}h`,
  day: (n: number, _isPast: boolean) => `${n}d`,
  week: (n: number, _isPast: boolean) => `${n}w`,
  month: (n: number, _isPast: boolean) => `${n}m`,
  year: (n: number, _isPast: boolean) => `${n}y`,
} as const satisfies UseTimeAgoMessages<UseTimeAgoUnitNamesDefault>

const OPTIONS: UseTimeAgoOptions<false, UseTimeAgoUnitNamesDefault> = {
  messages: SHORT_MESSAGES,
  showSecond: true,
  rounding: 'floor',
  updateInterval: 1000,
}

// ── Current user from cookie (for permission checks) ──
const currentUserEmail = computed(() => {
  try {
    const cookie = useCookie('userData')
    const user = typeof cookie.value === 'string' ? JSON.parse(cookie.value) : cookie.value
    return (user?.email || '').toLowerCase()
  }
  catch { return '' }
})

function isTaskOwner(task: Task): boolean {
  return !!currentUserEmail.value && (task as any).createdBy?.toLowerCase() === currentUserEmail.value
}

// ── Live remaining days ──
const now = ref(Date.now())
let _tickInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => { _tickInterval = setInterval(() => { now.value = Date.now() }, 60_000) })
onUnmounted(() => { if (_tickInterval) clearInterval(_tickInterval) })

function getDaysRemaining(dueDate: any): { days: number, label: string, color: string } | null {
  if (!dueDate) return null
  const due = new Date(dueDate).getTime()
  const diff = due - now.value
  const days = Math.ceil(diff / 86_400_000)
  if (days < 0) return { days, label: `${Math.abs(days)}d overdue`, color: 'bg-red-500/15 text-red-600 border-red-500/20' }
  if (days === 0) return { days, label: 'Due today', color: 'bg-amber-500/15 text-amber-600 border-amber-500/20' }
  if (days === 1) return { days, label: 'Tomorrow', color: 'bg-amber-500/15 text-amber-600 border-amber-500/20' }
  if (days <= 3) return { days, label: `${days}d left`, color: 'bg-orange-500/15 text-orange-600 border-orange-500/20' }
  if (days <= 7) return { days, label: `${days}d left`, color: 'bg-blue-500/15 text-blue-600 border-blue-500/20' }
  return { days, label: `${days}d left`, color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' }
}

function formatShortDate(d: any): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
  catch { return '' }
}

// ── Detail Dialog ──
const showDetailDialog = ref(false)
const detailTask = ref<(Task & { _colId?: string }) | null>(null)
</script>

<template>
  <div class="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 h-full">
    <!-- Columns Draggable wrapper -->
    <Draggable
      v-model="board.columns"
      class="flex gap-4 w-full h-full"
      item-key="id"
      :animation="180"
      handle=".col-handle"
      ghost-class="opacity-50"
      @end="onColumnDrop"
    >
      <template #item="{ element: col }: { element: Column }">
        <Card class="flex-1 min-w-[240px] shrink-0 py-2 gap-0 flex flex-col self-stretch">
          <CardHeader class="flex flex-row items-center justify-between gap-2 px-2 shrink-0">
            <CardTitle class="font-semibold text-base flex items-center gap-2">
              <Icon name="lucide:grip-vertical" class="col-handle cursor-grab opacity-60" />
              <span class="px-1">{{ col.title }}</span>
              <Badge variant="secondary" class="h-5 min-w-5 px-1 font-mono tabular-nums">
                {{ col.tasks.length }}
              </Badge>
            </CardTitle>
            <CardAction class="flex">
              <Button size="icon-sm" variant="ghost" class="size-7 text-muted-foreground" @click="openNewTask(col.id)">
                <Icon name="lucide:plus" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="px-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0" @scroll="onColumnScroll($event, col.id)">
            <!-- Tasks within the column -->
            <Draggable
              v-model="col.tasks"
              :group="{ name: 'kanban-tasks', pull: true, put: true }"
              item-key="id"
              :animation="180"
              class="flex flex-col gap-3 min-h-[24px] p-0.5"
              ghost-class="opacity-50"
              @end="onTaskDrop"
            >
              <template #item="{ element: t }: { element: Task }">
                <div v-if="visibleTasks(col).includes(t)" class="rounded-xl border bg-card shadow-sm hover:shadow-lg cursor-pointer overflow-hidden transition-all duration-200 group/card">
                  <!-- ═══ Car Image with ALL overlays ═══ -->
                  <div v-if="(t as any).carImage" class="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                    <img :src="(t as any).carImage" :alt="t.title" class="size-full object-cover transition-transform duration-500 group-hover/card:scale-105" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                    <!-- Top: Due date + Priority + Menu -->
                    <div class="absolute top-0 left-0 right-0 p-2 flex items-start justify-between">
                      <Badge v-if="getDaysRemaining(t.dueDate)" class="text-[9px] font-bold border-0 shadow-md backdrop-blur-md px-2 py-0.5 gap-1" :class="getDaysRemaining(t.dueDate)!.days < 0 ? 'bg-red-500/90 text-white' : getDaysRemaining(t.dueDate)!.days <= 3 ? 'bg-amber-500/90 text-white' : 'bg-white/90 text-zinc-900'">
                        <Icon name="lucide:clock" class="size-2.5" />{{ getDaysRemaining(t.dueDate)!.label }} · {{ formatShortDate(t.dueDate) }}
                      </Badge>
                      <div v-else />
                      <div class="flex items-center gap-1">
                        <Badge v-if="t.priority" class="text-[9px] font-bold border-0 shadow-md backdrop-blur-sm" :class="t.priority === 'high' ? 'bg-red-500/90 text-white' : t.priority === 'medium' ? 'bg-amber-500/90 text-white' : 'bg-blue-500/90 text-white'">
                          <Icon :name="iconPriority(t.priority)" class="size-2.5 mr-0.5" />{{ t.priority }}
                        </Badge>
                        <DropdownMenu v-if="isTaskOwner(t)">
                          <DropdownMenuTrigger as-child>
                            <button class="size-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white cursor-pointer opacity-0 group-hover/card:opacity-100 transition-all"><Icon name="lucide:ellipsis-vertical" class="size-3" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent class="w-28" align="end">
                            <DropdownMenuItem @click="showEditTask(col.id, t.id)"><Icon name="lucide:edit-2" class="size-3.5" /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" class="text-destructive" @click="removeTask(col.id, t.id)"><Icon name="lucide:trash-2" class="size-3.5" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <!-- Bottom: Assignees + Car info -->
                    <div class="absolute bottom-0 left-0 right-0 p-2 flex flex-col gap-1.5">
                      <div v-if="(t as any).assignees?.length" class="flex items-center gap-1">
                        <div class="flex -space-x-1">
                          <Tooltip v-for="a in (t as any).assignees.slice(0, 4)" :key="a.email">
                            <TooltipTrigger as-child><Avatar class="size-5 ring-1 ring-white/50"><AvatarFallback class="text-[7px] font-bold bg-violet-500 text-white">{{ a.name?.slice(0, 2).toUpperCase() || '?' }}</AvatarFallback></Avatar></TooltipTrigger>
                            <TooltipContent side="bottom">{{ a.name }} <span v-if="a.role" class="text-muted-foreground text-[10px]">({{ a.role }})</span></TooltipContent>
                          </Tooltip>
                          <div v-if="(t as any).assignees.length > 4" class="size-5 rounded-full bg-black/50 ring-1 ring-white/30 flex items-center justify-center text-[7px] font-bold text-white">+{{ (t as any).assignees.length - 4 }}</div>
                        </div>
                        <span class="text-[9px] text-white/80 font-medium truncate">{{ (t as any).assignees.map((a: any) => a.name?.split(' ')[0]).slice(0, 2).join(', ') }}{{ (t as any).assignees.length > 2 ? ` +${(t as any).assignees.length - 2}` : '' }}</span>
                      </div>
                      <div class="flex items-center gap-1 flex-wrap">
                        <Badge v-if="(t as any).appointmentId" class="bg-white/95 text-zinc-900 text-[9px] font-bold shadow border-0 px-1.5 py-0"><Icon name="lucide:hash" class="size-2 mr-0.5" />{{ (t as any).appointmentId }}</Badge>
                        <Badge v-if="(t as any).carInfo?.make" class="bg-white/95 text-zinc-900 text-[9px] font-bold shadow border-0 px-1.5 py-0">{{ (t as any).carInfo.make }} {{ (t as any).carInfo.model || '' }}</Badge>
                        <Badge v-if="(t as any).carInfo?.city" class="bg-white/85 text-zinc-700 text-[8px] shadow border-0 px-1 py-0"><Icon name="lucide:map-pin" class="size-2 mr-0.5" />{{ (t as any).carInfo.city }}</Badge>
                      </div>
                    </div>
                  </div>

                  <!-- ═══ Body: description + compact footer ═══ -->
                  <div class="px-3 py-2 space-y-1.5">
                    <p v-if="t.description" class="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{{ t.description }}</p>
                    <div v-if="t.labels?.length" class="flex items-center gap-1 flex-wrap">
                      <Badge v-for="label in t.labels" :key="label" variant="outline" class="text-[8px] px-1.5 py-0">{{ label }}</Badge>
                    </div>
                    <div class="flex items-center justify-between pt-1 border-t border-border/40">
                      <div class="flex items-center gap-2">
                        <span class="flex items-center text-[10px] text-muted-foreground gap-0.5"><Icon name="lucide:square-check-big" class="size-2.5" /> {{ t.subtasks?.filter(s => s.completed).length || 0 }}/{{ t.subtasks?.length || 0 }}</span>
                        <span class="flex items-center text-[10px] text-muted-foreground gap-0.5"><Icon name="lucide:message-square" class="size-2.5" /> {{ t.comments?.length || 0 }}</span>
                        <span class="text-[9px] text-muted-foreground/50">{{ (t as any).createdBy?.split('@')[0] || '' }}</span>
                      </div>
                      <button
                        class="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                        title="View details"
                        @click.stop="detailTask = { ...t, _colId: col.id } as any; showDetailDialog = true"
                      >
                        <Icon name="lucide:eye" class="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </template>
            </Draggable>
          </CardContent>
          <div v-if="hasMore(col)" class="shrink-0 px-2 py-2 border-t">
            <Button size="sm" variant="ghost" class="w-full text-muted-foreground text-xs gap-1.5" @click="loadMore(col.id)">
              <Icon name="lucide:chevrons-down" class="size-3.5" />
              Load {{ Math.min(PAGE_SIZE, col.tasks.length - getVisibleCount(col.id)) }} more
            </Button>
          </div>
          <CardFooter class="px-2 mt-auto shrink-0">
            <Button size="sm" variant="ghost" class="text-muted-foreground" @click="openNewTask(col.id)">
              <Icon name="lucide:plus" />
              Add Task
            </Button>
          </CardFooter>
        </Card>
      </template>
    </Draggable>
  </div>

  <!-- New Task Dialog -->
  <Dialog v-model:open="showModalTask.open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ showModalTask.type === 'create' ? 'New Task' : 'Edit Task' }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ showModalTask.type === 'create' ? 'Add a new task to the board' : 'Edit the task' }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-3">
        <div class="grid items-baseline grid-cols-1 md:grid-cols-4 md:[&>label]:col-span-1 *:col-span-3 gap-3">
          <Label>Title</Label>
          <Input v-model="newTask.title" placeholder="Title" />
          <Label>Description</Label>
          <Textarea v-model="newTask.description" placeholder="Description (optional)" rows="4" />
          <Label>Priority</Label>
          <Select v-model="newTask.priority">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select a priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">
                Low
              </SelectItem>
              <SelectItem value="medium">
                Medium
              </SelectItem>
              <SelectItem value="high">
                High
              </SelectItem>
            </SelectContent>
          </Select>
          <Label>Due Date</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  :class="cn(
                    'flex-1 justify-start text-left font-normal px-3',
                    !dueDate && 'text-muted-foreground',
                  )"
                >
                  <Icon name="lucide:calendar" class="mr-2" />
                  {{ dueDate ? df.format(dueDate.toDate(getLocalTimeZone())) : "Pick a date" }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="dueDate" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              id="time-picker"
              v-model="dueTime"
              type="time"
              step="60"
              default-value="00:00"
              class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="showModalTask.open = false">
          Cancel
        </Button>
        <Button @click="showModalTask.type === 'create' ? createTask() : editTask()">
          {{ showModalTask.type === 'create' ? 'Create' : 'Update' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ═══ Task Detail Dialog ═══ -->
  <Dialog v-model:open="showDetailDialog">
    <DialogContent class="sm:max-w-[640px] p-0 overflow-hidden">
      <DialogHeader class="sr-only"><DialogTitle>Task Details</DialogTitle><DialogDescription>Full task information</DialogDescription></DialogHeader>
      <template v-if="detailTask">
        <div v-if="(detailTask as any).carImage" class="relative w-full h-48 overflow-hidden bg-muted">
          <img :src="(detailTask as any).carImage" :alt="detailTask.title" class="size-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div class="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div class="flex items-center gap-1.5 flex-wrap">
              <Badge v-if="(detailTask as any).appointmentId" class="bg-white/95 text-zinc-900 text-xs font-bold shadow border-0 px-2.5 py-0.5"><Icon name="lucide:hash" class="size-3 mr-1" />{{ (detailTask as any).appointmentId }}</Badge>
              <Badge v-if="(detailTask as any).carInfo?.make" class="bg-white/95 text-zinc-900 text-xs font-bold shadow border-0 px-2.5 py-0.5">{{ (detailTask as any).carInfo.make }} {{ (detailTask as any).carInfo.model || '' }}</Badge>
              <Badge v-if="(detailTask as any).carInfo?.city" class="bg-white/90 text-zinc-700 text-[11px] shadow border-0 px-2 py-0.5"><Icon name="lucide:map-pin" class="size-3 mr-0.5" />{{ (detailTask as any).carInfo.city }}</Badge>
            </div>
            <Badge v-if="detailTask.priority" class="text-xs font-bold border-0 shadow-md shrink-0" :class="detailTask.priority === 'high' ? 'bg-red-500 text-white' : detailTask.priority === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'">{{ detailTask.priority }}</Badge>
          </div>
        </div>
        <div class="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div class="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" class="text-xs capitalize px-2.5 py-1"><Icon name="lucide:columns-3" class="size-3 mr-1" />{{ detailTask.status?.replace('-', ' ') || 'todo' }}</Badge>
            <Badge v-if="getDaysRemaining(detailTask.dueDate)" variant="outline" class="text-xs font-semibold gap-1 px-2.5 py-1" :class="getDaysRemaining(detailTask.dueDate)!.color"><Icon name="lucide:clock" class="size-3" />{{ getDaysRemaining(detailTask.dueDate)!.label }} · {{ formatShortDate(detailTask.dueDate) }}</Badge>
          </div>
          <div v-if="detailTask.description" class="space-y-1">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</h4>
            <p class="text-sm leading-relaxed">{{ detailTask.description }}</p>
          </div>
          <div v-if="(detailTask as any).assignees?.length" class="space-y-2">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignees</h4>
            <div class="flex flex-wrap gap-2">
              <div v-for="a in (detailTask as any).assignees" :key="a.email" class="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                <Avatar class="size-6"><AvatarFallback class="text-[9px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">{{ a.name?.slice(0, 2).toUpperCase() }}</AvatarFallback></Avatar>
                <div><p class="text-xs font-medium leading-none">{{ a.name }}</p><p v-if="a.role" class="text-[10px] text-muted-foreground">{{ a.role }}</p></div>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subtasks ({{ detailTask.subtasks?.filter(s => s.completed).length || 0 }}/{{ detailTask.subtasks?.length || 0 }})</h4>
            <div v-if="detailTask.subtasks?.length" class="space-y-1">
              <div v-for="st in detailTask.subtasks" :key="st.id" class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 group">
                <Checkbox :checked="st.completed" @update:checked="toggleSubtask((detailTask as any)._colId, detailTask.id, st.id)" />
                <span class="text-sm flex-1" :class="st.completed ? 'line-through text-muted-foreground' : ''">{{ st.title }}</span>
                <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer transition-all" @click="removeSubtask((detailTask as any)._colId, detailTask.id, st.id)"><Icon name="lucide:x" class="size-3.5" /></button>
              </div>
            </div>
            <form class="flex gap-1.5" @submit.prevent="() => { if (newSubtaskTitle.trim()) { addSubtask((detailTask as any)._colId, detailTask!.id, newSubtaskTitle.trim()); newSubtaskTitle = '' } }">
              <Input v-model="newSubtaskTitle" placeholder="Add subtask..." class="h-8 text-xs" />
              <Button type="submit" size="sm" variant="outline" class="h-8 shrink-0"><Icon name="lucide:plus" class="size-3.5 mr-1" />Add</Button>
            </form>
          </div>
          <div class="space-y-2">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comments ({{ detailTask.comments?.length || 0 }})</h4>
            <div v-if="detailTask.comments?.length" class="space-y-2">
              <div v-for="cm in detailTask.comments" :key="cm.id" class="rounded-lg border bg-muted/20 px-3 py-2 group">
                <div class="flex items-center justify-between"><span class="text-xs font-semibold">{{ cm.author }}</span><span class="text-[10px] text-muted-foreground">{{ useTimeAgo(cm.createdAt ?? '', OPTIONS) }}</span></div>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{{ cm.text }}</p>
              </div>
            </div>
            <form class="flex gap-1.5" @submit.prevent="() => { if (newCommentText.trim()) { addComment((detailTask as any)._colId, detailTask!.id, newCommentText.trim()); newCommentText = '' } }">
              <Input v-model="newCommentText" placeholder="Write a comment..." class="h-8 text-xs" />
              <Button type="submit" size="sm" variant="outline" class="h-8 shrink-0"><Icon name="lucide:send" class="size-3.5 mr-1" />Send</Button>
            </form>
          </div>
          <div v-if="(detailTask as any).activityLog?.length" class="space-y-2">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity Log</h4>
            <div class="relative pl-4 border-l-2 border-border/50 space-y-3">
              <div v-for="(log, i) in (detailTask as any).activityLog" :key="i" class="relative">
                <div class="absolute -left-[21px] top-0.5 size-3 rounded-full border-2 border-background" :class="log.action === 'created' ? 'bg-emerald-500' : 'bg-blue-500'" />
                <div class="text-xs"><span class="font-medium">{{ log.by?.split('@')[0] || 'System' }}</span> <span class="text-muted-foreground">{{ log.detail }}</span></div>
                <span class="text-[10px] text-muted-foreground/60">{{ formatShortDate(log.at) }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between pt-3 border-t text-[11px] text-muted-foreground">
            <div class="flex items-center gap-1"><Icon name="lucide:user-circle" class="size-3.5" />Created by <span class="font-medium text-foreground">{{ (detailTask as any).createdBy?.split('@')[0] || 'System' }}</span></div>
            <span>{{ formatShortDate((detailTask as any).createdAt) }}</span>
          </div>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
