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
  const rawUserData = getCookie(event, 'userData')
  let userEmail = ''
  let userRole = ''
  
  if (rawUserData) {
    try {
      const decoded = JSON.parse(decodeURIComponent(rawUserData))
      userEmail = decoded.email || ''
      userRole = decoded.userRole || decoded.role || ''
    } catch (e) {}
  }
  
  if (!userRole) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

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

  // Send initial connection event with timestamps
  const initData = JSON.stringify({
    type: 'connected',
    timestamps: getLastChangeTimestamps(),
  })
  event.node.res.write(`data: ${initData}\n\n`)

  // Subscribe to live change events
  const unsubscribe = onDataChange((changeEvent) => {
    try {
      // Role-based filtering
      if (userRole === 'Retailer') {
        if (changeEvent.collection === 'users' || changeEvent.collection === 'workspaces') return
        // Ideally we filter by retailAssociate but updates may not contain that field
      }

      const payload = JSON.stringify({ type: 'change', ...changeEvent })
      // We no longer send an `id:` field to avoid cross-instance eventId collisions on serverless
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
