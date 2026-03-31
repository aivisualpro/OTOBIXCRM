// 30-day persistent login with rolling session renewal
// Every page visit resets the 30-day clock

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export default defineNuxtRouteMiddleware((to, _from) => {
  const cookieOptions = {
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: import.meta.server ? import.meta.env.PROD : globalThis.location.protocol === 'https:',
  }

  const isLoggedIn = useCookie('isLoggedIn', cookieOptions)
  const authToken = useCookie('authToken', cookieOptions)
  const userData = useCookie('userData', cookieOptions)

  // Rolling renewal: On every navigation, re-set the cookie values
  // to refresh the maxAge countdown back to 30 days
  if (isLoggedIn.value) {
    // Touch cookies to reset their expiry (re-assign via spread to avoid self-assign lint)
    // eslint-disable-next-line no-self-assign
    isLoggedIn.value = isLoggedIn.value
    if (authToken.value)
      // eslint-disable-next-line no-self-assign
      authToken.value = authToken.value
    if (userData.value)
      // eslint-disable-next-line no-self-assign
      userData.value = userData.value
  }

  // Auth guard: redirect unauthenticated users to /login
  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Redirect authenticated users away from /login
  if (isLoggedIn.value && to.path === '/login') {
    let redirectPath = '/'
    if (userData.value) {
      try {
        const user = typeof userData.value === 'string' ? JSON.parse(userData.value) : userData.value
        const roleString = user?.userType || user?.userRole || user?.role
        const userId = user?._id || user?.id
        if (roleString && userId) {
          redirectPath = `/profile`
        }
      }
      catch {}
    }
    return navigateTo(redirectPath)
  }

  // ─── Strict Workspace Allocation Sandboxing ───
  if (isLoggedIn.value && to.path !== '/login' && to.path !== '/profile') {
    const wCookie = useCookie('activeWorkspace', cookieOptions)
    let activeW: any = null
    try { activeW = wCookie.value ? (typeof wCookie.value === 'string' ? JSON.parse(wCookie.value) : wCookie.value) : null }
    catch {}

    const pathRootFragment = to.path.split('/')[1] || ''
    const requestedId = pathRootFragment === '' ? 'dashboard' : pathRootFragment
    const isSystemRoot = ['settings', 'profile', 'inspection'].includes(requestedId)

    if (!activeW) {
      // If the workspace session token expires or is not generated yet, securely deny naked module access by routing to safe-zone profiling where clientside hooks will rehydrate the workspace token.
      if (!isSystemRoot) {
        console.warn(`[Scope Lockdown] Missing workspace session token. Rerouting to safe zone.`)
        return navigateTo('/profile', { replace: true })
      }
    }
    else if (Array.isArray(activeW.menuIds)) {
      const allowed = activeW.menuIds as string[]

      // Strict root-level module locking (disregard generic globals)
      // If the module attempts a generic root load not natively in scope
      if (!isSystemRoot && !allowed.includes(requestedId)) {
        console.warn(`[Scope Lockdown] Workspace blocked access to module: /${requestedId}`)
        const fallback = allowed.length > 0 ? (allowed[0] === 'dashboard' ? '/' : `/${allowed[0]}`) : '/profile'
        return navigateTo(fallback, { replace: true })
      }
    }
  }
})
