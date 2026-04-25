interface PageHeaderState {
  title: string
  description?: string
  icon?: string
  badge?: string
  showBackButton?: boolean
  backUrl?: string
}

const headerState = reactive<PageHeaderState>({
  title: '',
  description: '',
  icon: '',
  badge: '',
  showBackButton: false,
  backUrl: '',
})

export function usePageHeader() {
  function setHeader(opts: PageHeaderState) {
    headerState.title = opts.title
    headerState.description = opts.description || ''
    headerState.icon = opts.icon || ''
    headerState.badge = opts.badge || ''
    headerState.showBackButton = opts.showBackButton ?? false
    headerState.backUrl = opts.backUrl || ''
  }

  function clearHeader() {
    headerState.title = ''
    headerState.description = ''
    headerState.icon = ''
    headerState.badge = ''
    headerState.showBackButton = false
    headerState.backUrl = ''
  }

  return {
    headerState: readonly(headerState),
    setHeader,
    clearHeader,
  }
}
