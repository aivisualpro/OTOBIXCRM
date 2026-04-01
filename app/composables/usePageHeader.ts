interface PageHeaderState {
  title: string
  description?: string
  icon?: string
  showBackButton?: boolean
}

const headerState = reactive<PageHeaderState>({
  title: '',
  description: '',
  icon: '',
  showBackButton: false,
})

export function usePageHeader() {
  function setHeader(opts: PageHeaderState) {
    headerState.title = opts.title
    headerState.description = opts.description || ''
    headerState.icon = opts.icon || ''
    headerState.showBackButton = opts.showBackButton ?? false
  }

  function clearHeader() {
    headerState.title = ''
    headerState.description = ''
    headerState.icon = ''
    headerState.showBackButton = false
  }

  return {
    headerState: readonly(headerState),
    setHeader,
    clearHeader,
  }
}
