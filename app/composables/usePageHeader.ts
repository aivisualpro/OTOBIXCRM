interface PageHeaderState {
  title: string
  description?: string
  icon?: string
  badge?: string
  showBackButton?: boolean
}

const headerState = reactive<PageHeaderState>({
  title: '',
  description: '',
  icon: '',
  badge: '',
  showBackButton: false,
})

export function usePageHeader() {
  function setHeader(opts: PageHeaderState) {
    headerState.title = opts.title
    headerState.description = opts.description || ''
    headerState.icon = opts.icon || ''
    headerState.badge = opts.badge || ''
    headerState.showBackButton = opts.showBackButton ?? false
  }

  function clearHeader() {
    headerState.title = ''
    headerState.description = ''
    headerState.icon = ''
    headerState.badge = ''
    headerState.showBackButton = false
  }

  return {
    headerState: readonly(headerState),
    setHeader,
    clearHeader,
  }
}
