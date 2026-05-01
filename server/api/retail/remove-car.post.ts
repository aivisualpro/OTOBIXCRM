// POST /api/retail/remove-car
// Proxy to external API: remove car from auction

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { carId, reasonOfRemoval, removedBy } = body

    if (!carId || !removedBy) {
      throw createError({ statusCode: 400, message: 'Missing required fields: carId, removedBy' })
    }

    const config = useRuntimeConfig(event)
    const apiBase = (config.public.apiBaseUrlProduction as string) || 'https://ob-dealerapp-kong.onrender.com/api/'
    const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

    const response = await $fetch(`${apiBase}otobix/remove-car`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { carId, reasonOfRemoval: reasonOfRemoval || '', removedBy },
    })

    return { success: true, data: response }
  }
  catch (err: any) {
    console.error('[remove-car] Error:', err?.data || err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err?.data?.message || err.message || 'Failed to remove car' })
  }
})
