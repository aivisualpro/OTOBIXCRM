export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Comment {
  id: string
  author: string
  avatar?: string
  text: string
  createdAt: Date | number | string
}

export interface Task {
  id: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  assignee?: {
    id: string
    name: string
    avatar?: string
  }
  /** Multiple assignees for car-linked tasks */
  assignees?: { email: string, name: string, role?: string, avatar?: string }[]
  dueDate?: Date | number | string
  status?: string
  labels?: string[]
  subtasks?: Subtask[]
  comments?: Comment[]
  createdAt: Date | number | string
  /** Car reference fields */
  carId?: string
  appointmentId?: string
  carImage?: string
  carInfo?: { make?: string, model?: string, year?: string | number, city?: string }
  createdBy?: string
}

export interface NewTask extends Omit<Task, 'id' | 'assignee' | 'createdAt'> {
}

export interface Column {
  id: string
  title: string
  tasks: Task[]
}

export interface BoardState {
  columns: Column[]
}
