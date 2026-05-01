// POST /api/retail/schedule-auction
// Proxy to external API: schedule auction (make upcoming or live)
// Keeps the static API token server-side.

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { carId, auctionStartTime, auctionDuration, auctionEndTime, auctionMode } = body

    if (!carId || !auctionStartTime || !auctionEndTime || !auctionMode) {
      throw createError({ statusCode: 400, message: 'Missing required fields: carId, auctionStartTime, auctionEndTime, auctionMode' })
    }

    const config = useRuntimeConfig(event)
    const apiBase = (config.public.apiBaseUrlProduction as string) || 'https://ob-dealerapp-kong.onrender.com/api/'
    const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

    const response = await $fetch(`${apiBase}otobix/schedule-auction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        carId,
        auctionStartTime,
        auctionDuration: auctionDuration || 24,
        auctionEndTime,
        auctionMode,
      },
    })

    return { success: true, data: response }
  }
  catch (err: any) {
    console.error('[schedule-auction] Error:', err?.data || err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err?.data?.message || err.message || 'Failed to schedule auction' })
  }
})
