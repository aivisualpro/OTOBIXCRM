/**
 * ─── Change Tracker ───
 * In-memory event bus that tracks the latest modification timestamp
 * per collection. SSE clients poll this to know when data changed.
 *
 * Each mutation endpoint calls `broadcastChange(collection, meta)`.
 * The SSE endpoint streams these events to all connected browsers.
 */

interface ChangeEvent {
  collection: string
  action: 'create' | 'update' | 'delete'
  timestamp: number
  /** Optional: which record changed (e.g. appointmentId) */
  recordId?: string
  /** Optional: who made the change */
  changedBy?: string
}

type ChangeListener = (event: ChangeEvent) => void

// Module-level singleton — shared across all Nitro handlers
const _listeners = new Set<ChangeListener>()
const _lastChange: Record<string, number> = {}

/**
 * Broadcast a data change to all connected SSE clients.
 * Call this from any mutation endpoint (update, create, delete).
 */
export function broadcastChange(
  collection: string,
  action: ChangeEvent['action'],
  recordId?: string,
  changedBy?: string,
) {
  const event: ChangeEvent = {
    collection,
    action,
    timestamp: Date.now(),
    recordId,
    changedBy,
  }

  _lastChange[collection] = event.timestamp

  // Fan out to all active SSE connections
  for (const listener of _listeners) {
    try {
      listener(event)
    }
    catch {
      // Stale listener — will be cleaned up on disconnect
    }
  }
}

/**
 * Subscribe to change events. Returns an unsubscribe function.
 */
export function onDataChange(listener: ChangeListener): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

/**
 * Get the latest change timestamps (for initial SSE handshake).
 */
export function getLastChangeTimestamps(): Record<string, number> {
  return { ..._lastChange }
}
