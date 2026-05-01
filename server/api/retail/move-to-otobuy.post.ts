// POST /api/retail/move-to-otobuy
// Proxy to external API: move car to otobuy

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { carId, oneClickPrice } = body

    if (!carId || !oneClickPrice) {
      throw createError({ statusCode: 400, message: 'Missing required fields: carId, oneClickPrice' })
    }

    const config = useRuntimeConfig(event)
    const apiBase = (config.public.apiBaseUrlProduction as string) || 'https://ob-dealerapp-kong.onrender.com/api/'
    const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

    const response = await $fetch(`${apiBase}otobix/move-car-to-otobuy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { carId, oneClickPrice: Number(oneClickPrice) },
    })

    return { success: true, data: response }
  }
  catch (err: any) {
    console.error('[move-to-otobuy] Error:', err?.data || err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err?.data?.message || err.message || 'Failed to move to otobuy' })
  }
})
