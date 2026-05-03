/**
 * ─── Kanban Composable v2 ───
 * MongoDB-backed task board with `otobixCRMTasks` collection.
 *
 * Columns are fixed: To Do, In Progress, In Review, Done
 * Tasks are fetched from API and grouped by status field.
 */
import type { BoardState, Column, NewTask, Task } from '~/types/kanban'
import { nanoid } from 'nanoid'
import { toast } from 'vue-sonner'

const COLUMNS_DEF: { id: string, title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'in-review', title: 'In Review' },
  { id: 'done', title: 'Done' },
]

export function useKanban() {
  const board = useState<BoardState>('kanban-board', () => ({
    columns: COLUMNS_DEF.map(c => ({ ...c, tasks: [] })),
  }))
  const _isFetched = useState('kanban_fetched', () => false)
  const _isLoading = useState('kanban_loading', () => false)

  async function fetchTasks() {
    _isLoading.value = true
    try {
      const res = await $fetch<{ tasks: any[] }>('/api/tasks')
      const tasks = res?.tasks || []

      // Group tasks by status into columns
      const grouped: Record<string, Task[]> = {}
      for (const colDef of COLUMNS_DEF) {
        grouped[colDef.id] = []
      }
      for (const t of tasks) {
        const status = t.status || 'todo'
        if (!grouped[status]) grouped[status] = []
        grouped[status].push(normalizeTask(t))
      }

      board.value = {
        columns: COLUMNS_DEF.map(c => ({
          ...c,
          tasks: grouped[c.id] || [],
        })),
      }
      _isFetched.value = true
    }
    catch (err: any) {
      console.error('[useKanban] Failed to fetch tasks:', err)
      toast.error('Failed to load tasks')
    }
    finally {
      _isLoading.value = false
    }
  }

  function normalizeTask(raw: any): Task {
    return {
      id: raw._id || raw.id,
      title: raw.title || '',
      description: raw.description || '',
      priority: raw.priority,
      assignee: raw.assignees?.[0] ? {
        id: raw.assignees[0].email || raw.assignees[0].id,
        name: raw.assignees[0].name || raw.assignees[0].email,
        avatar: raw.assignees[0].avatar,
      } : undefined,
      assignees: raw.assignees || [],
      dueDate: raw.dueDate,
      status: raw.status || 'todo',
      labels: raw.labels || [],
      subtasks: raw.subtasks || [],
      comments: raw.comments || [],
      createdAt: raw.createdAt || new Date().toISOString(),
      carId: raw.carId,
      appointmentId: raw.appointmentId,
      carImage: raw.carImage,
      carInfo: raw.carInfo,
      createdBy: raw.createdBy,
    }
  }

  async function addTask(columnId: string, payload: any) {
    try {
      const res = await $fetch<{ task: any }>('/api/tasks', {
        method: 'POST',
        body: {
          ...payload,
          status: columnId,
        },
      })

      if (res?.task) {
        const col = board.value.columns.find(c => c.id === columnId)
        if (col) {
          col.tasks.unshift(normalizeTask(res.task))
        }
        toast.success('Task created')
      }
    }
    catch (err: any) {
      console.error('[useKanban] Failed to create task:', err)
      toast.error('Failed to create task')
    }
  }

  async function updateTask(columnId: string, taskId: string, patch: Partial<Task>) {
    // Optimistic update
    const col = board.value.columns.find(c => c.id === columnId)
    if (!col) return
    const t = col.tasks.find(t => t.id === taskId)
    if (!t) return
    Object.assign(t, patch)

    try {
      await $fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: patch,
      })
    }
    catch (err: any) {
      console.error('[useKanban] Failed to update task:', err)
      toast.error('Failed to update task')
      fetchTasks() // Revert on error
    }
  }

  async function removeTask(columnId: string, taskId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    if (!col) return
    const idx = col.tasks.findIndex(t => t.id === taskId)
    if (idx === -1) return

    // Optimistic delete
    const [removed] = col.tasks.splice(idx, 1)

    try {
      await $fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      toast.success('Task deleted')
    }
    catch (err: any) {
      console.error('[useKanban] Failed to delete task:', err)
      if (removed) col.tasks.splice(idx, 0, removed) // Revert
      toast.error('Failed to delete task')
    }
  }

  async function setColumns(next: Column[]) {
    board.value.columns = next
    // Persist status changes for moved tasks
    for (const col of next) {
      for (const task of col.tasks) {
        if (task.status !== col.id) {
          task.status = col.id
          try {
            await $fetch(`/api/tasks/${task.id}`, {
              method: 'PUT',
              body: { status: col.id },
            })
          }
          catch { /* silent — background persist */ }
        }
      }
    }
  }

  // ── Subtask CRUD (server-persisted via full task update) ──
  async function addSubtask(columnId: string, taskId: string, title: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task) return
    if (!task.subtasks) task.subtasks = []
    const st = { id: nanoid(8), title, completed: false }
    task.subtasks.push(st)
    try {
      await $fetch(`/api/tasks/${taskId}`, { method: 'PUT', body: { subtasks: task.subtasks } })
    }
    catch { toast.error('Failed to save subtask') }
  }

  async function toggleSubtask(columnId: string, taskId: string, subtaskId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task?.subtasks) return
    const st = task.subtasks.find(s => s.id === subtaskId)
    if (st) st.completed = !st.completed
    try {
      await $fetch(`/api/tasks/${taskId}`, { method: 'PUT', body: { subtasks: task.subtasks } })
    }
    catch { toast.error('Failed to update subtask') }
  }

  async function removeSubtask(columnId: string, taskId: string, subtaskId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task?.subtasks) return
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId)
    try {
      await $fetch(`/api/tasks/${taskId}`, { method: 'PUT', body: { subtasks: task.subtasks } })
    }
    catch { toast.error('Failed to remove subtask') }
  }

  // ── Comment CRUD ──
  async function addComment(columnId: string, taskId: string, text: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task) return
    if (!task.comments) task.comments = []
    task.comments.push({
      id: nanoid(8),
      author: 'Admin',
      text,
      createdAt: new Date().toISOString(),
    })
    try {
      await $fetch(`/api/tasks/${taskId}`, { method: 'PUT', body: { comments: task.comments } })
    }
    catch { toast.error('Failed to save comment') }
  }

  async function removeComment(columnId: string, taskId: string, commentId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task?.comments) return
    task.comments = task.comments.filter(c => c.id !== commentId)
    try {
      await $fetch(`/api/tasks/${taskId}`, { method: 'PUT', body: { comments: task.comments } })
    }
    catch { toast.error('Failed to remove comment') }
  }

  return {
    board,
    isFetched: computed(() => _isFetched.value),
    isLoading: computed(() => _isLoading.value),
    fetchTasks,
    addTask,
    updateTask,
    removeTask,
    setColumns,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    addComment,
    removeComment,
  }
}
