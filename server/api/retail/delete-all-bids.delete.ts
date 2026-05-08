// DELETE /api/retail/delete-all-bids
// Proxy to external API: delete all bids for a car

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { carId } = body

    if (!carId) {
      throw createError({ statusCode: 400, message: 'Missing required field: carId' })
    }

    const config = useRuntimeConfig(event)
    const apiBase = (config.public.apiBaseUrlProduction as string) || 'https://ob-dealerapp-kong.onrender.com/api/'
    const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

    const response = await $fetch(`${apiBase}otobix/delete-all-bids`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: { carId },
    })

    return { success: true, data: response }
  }
  catch (err: any) {
    console.error('[delete-all-bids] Error:', err?.data || err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err?.data?.message || err.message || 'Failed to delete all bids' })
  }
})
