// POST /api/retail/mark-as-sold
// Proxy to external API: mark car as sold

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { carId, soldBy, soldTo, soldAt } = body

    if (!carId || !soldBy || !soldTo || !soldAt) {
      throw createError({ statusCode: 400, message: 'Missing required fields: carId, soldBy, soldTo, soldAt' })
    }

    const config = useRuntimeConfig(event)
    const apiBase = (config.public.apiBaseUrlProduction as string) || 'https://ob-dealerapp-kong.onrender.com/api/'
    const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

    const response = await $fetch(`${apiBase}otobix/mark-car-as-sold`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { carId, soldBy, soldTo, soldAt: Number(soldAt) },
    })

    return { success: true, data: response }
  }
  catch (err: any) {
    console.error('[mark-as-sold] Error:', err?.data || err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err?.data?.message || err.message || 'Failed to mark as sold' })
  }
})
