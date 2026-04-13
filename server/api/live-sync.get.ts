/**
 * ─── SSE (Server-Sent Events) Endpoint ───
 * GET /api/live-sync
 *
 * Keeps a persistent HTTP connection open.
 * When any mutation endpoint calls broadcastChange(), this streams
 * the event to every connected browser tab in real-time.
 *
 * The client listens via EventSource and auto-refetches stale data.
 */
export default defineEventHandler(async (event) => {
  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  })

  // Send initial connection event with current timestamps
  const timestamps = getLastChangeTimestamps()
  const initData = JSON.stringify({ type: 'connected', timestamps })
  event.node.res.write(`data: ${initData}\n\n`)

  // Subscribe to change events
  const unsubscribe = onDataChange((changeEvent) => {
    try {
      const payload = JSON.stringify({
        type: 'change',
        ...changeEvent,
      })
      event.node.res.write(`data: ${payload}\n\n`)
    }
    catch {
      // Connection closed — will be cleaned up below
    }
  })

  // Keep-alive ping every 30 seconds to prevent proxy/LB timeouts
  const keepAlive = setInterval(() => {
    try {
      event.node.res.write(`: ping\n\n`)
    }
    catch {
      clearInterval(keepAlive)
    }
  }, 30000)

  // Wait for client disconnect
  await new Promise<void>((resolve) => {
    event.node.res.on('close', () => {
      unsubscribe()
      clearInterval(keepAlive)
      resolve()
    })
  })
})
