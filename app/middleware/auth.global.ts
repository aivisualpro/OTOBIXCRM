// 30-day persistent login with rolling session renewal
// Every page visit resets the 30-day clock

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export default defineNuxtRouteMiddleware((to, _from) => {
  const cookieOptions = {
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: import.meta.server ? process.env.NODE_ENV === 'production' : window.location.protocol === 'https:',
  }

  const isLoggedIn = useCookie('isLoggedIn', cookieOptions)
  const authToken = useCookie('authToken', cookieOptions)
  const userData = useCookie('userData', cookieOptions)

  // Rolling renewal: On every navigation, re-set the cookie values
  // to refresh the maxAge countdown back to 30 days
  if (isLoggedIn.value) {
    // Touch cookies to reset their expiry (re-assign same value)
    isLoggedIn.value = isLoggedIn.value
    if (authToken.value) authToken.value = authToken.value
    if (userData.value) userData.value = userData.value
  }

  // Auth guard: redirect unauthenticated users to /login
  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Redirect authenticated users away from /login
  if (isLoggedIn.value && to.path === '/login') {
    return navigateTo('/')
  }
})
