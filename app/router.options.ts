import type { RouterConfig } from '@nuxt/schema'

export default {
  scrollBehavior() {
    // Don't scroll anything automatically on route change.
    // The sidebar uses overflow-auto and should retain its scroll position.
    // The main content area resets naturally since each page is a new component.
    return false
  },
} satisfies RouterConfig
