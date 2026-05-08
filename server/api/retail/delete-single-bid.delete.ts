// DELETE /api/retail/delete-single-bid
// Proxy to external API: delete a single bid

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { bidId } = body

    if (!bidId) {
      throw createError({ statusCode: 400, message: 'Missing required field: bidId' })
    }

    const config = useRuntimeConfig(event)
    const apiBase = (config.public.apiBaseUrlProduction as string) || 'https://ob-dealerapp-kong.onrender.com/api/'
    const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

    const response = await $fetch(`${apiBase}otobix/delete-single-bid`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: { bidId },
    })

    return { success: true, data: response }
  }
  catch (err: any) {
    console.error('[delete-single-bid] Error:', err?.data || err.message)
    throw createError({ statusCode: err.statusCode || 500, message: err?.data?.message || err.message || 'Failed to delete bid' })
  }
})
