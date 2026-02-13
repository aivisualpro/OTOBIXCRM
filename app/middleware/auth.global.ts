export default defineNuxtRouteMiddleware((to, from) => {
  // Simple mock auth check
  // In a real app, you'd check a token or cookie
  const isLoggedIn = useCookie('isLoggedIn')

  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo('/login')
  }

  if (isLoggedIn.value && to.path === '/login') {
    return navigateTo('/')
  }
})
