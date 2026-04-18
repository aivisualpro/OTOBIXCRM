/**
 * ─── SSE (Server-Sent Events) Endpoint v3 ───
 * GET /api/live-sync
 *
 * Streams versioned, ordered events to all connected browsers.
 * Uses SSE `id:` field so the browser tracks lastEventId automatically.
 *
 * On reconnect, the browser sends `Last-Event-ID` header, and this endpoint
 * replays missed events from the in-memory ring buffer before streaming live.
 */
export default defineEventHandler(async (event) => {
  // Prevent Node.js from tearing down the long-lived SSE socket
  if (event.node.req.socket) {
    event.node.req.socket.setTimeout(0)
    event.node.req.socket.setKeepAlive(true)
  }

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  })

  const currentSeq = getEventSequence()

  // Check if client is reconnecting and missed events
  const lastEventIdHeader = event.node.req.headers['last-event-id']
  const lastEventId = lastEventIdHeader ? Number(lastEventIdHeader) : 0

  // Send initial connection event with current sequence and timestamps
  const initData = JSON.stringify({
    type: 'connected',
    currentVersion: currentSeq,
    timestamps: getLastChangeTimestamps(),
  })
  event.node.res.write(`id: ${currentSeq}\ndata: ${initData}\n\n`)

  // Replay missed events from ring buffer (if client reconnected)
  if (lastEventId > 0 && lastEventId < currentSeq) {
    const missed = getEventsSince(lastEventId)
    for (const missedEvent of missed) {
      const payload = JSON.stringify({ type: 'change', ...missedEvent })
      event.node.res.write(`id: ${missedEvent.eventId}\ndata: ${payload}\n\n`)
    }
  }

  // Subscribe to live change events
  const unsubscribe = onDataChange((changeEvent) => {
    try {
      const payload = JSON.stringify({ type: 'change', ...changeEvent })
      event.node.res.write(`id: ${changeEvent.eventId}\ndata: ${payload}\n\n`)
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
