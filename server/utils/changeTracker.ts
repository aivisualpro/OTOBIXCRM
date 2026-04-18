/**
 * ─── Change Tracker v3 ───
 *
 * In-memory event bus with versioned, ordered events.
 *
 * Every event includes:
 *   - eventId (monotonic sequence number)
 *   - collection, action, recordId
 *   - updatedAt (ISO string)
 *   - version (same as eventId — global sequence)
 *   - payload (action-specific: full normalized doc, changed fields, or nothing)
 *
 * Rules:
 *   - create: payload = full normalized record (no raw MongoDB internals)
 *   - update: payload = changed fields only (lightweight)
 *   - delete: payload = null (only recordId needed)
 */

interface SyncEvent {
  /** Monotonic event ID — clients track this for ordering & gap detection */
  eventId: number
  /** Global sequence version — same as eventId */
  version: number
  collection: string
  action: 'create' | 'update' | 'delete'
  recordId: string
  updatedAt: string
  changedBy?: string
  /** For create: full normalized doc. For update: changed fields only. For delete: null. */
  payload: Record<string, any> | null
}

type ChangeListener = (event: SyncEvent) => void

// Module-level singleton — shared across all Nitro handlers
const _listeners = new Set<ChangeListener>()
const _lastChange: Record<string, number> = {}

/**
 * Monotonic event counter — survives for the lifetime of the server process.
 * On server restart, clients detect the gap via lastEventId and trigger catch-up.
 */
let _eventSequence = 0

/**
 * Ring buffer of recent events for missed-event catch-up.
 * Holds the last 500 events so reconnecting clients can replay gaps
 * without hitting the database delta endpoints.
 */
const EVENT_BUFFER_SIZE = 500
const _eventBuffer: SyncEvent[] = []

/**
 * Get the current event sequence number.
 */
export function getEventSequence(): number {
  return _eventSequence
}

/**
 * Get events since a given eventId (for catch-up on reconnect).
 * Returns events with eventId > sinceId, in order.
 */
export function getEventsSince(sinceId: number): SyncEvent[] {
  if (sinceId <= 0 || _eventBuffer.length === 0) return []

  const idx = _eventBuffer.findIndex(e => e.eventId > sinceId)
  if (idx === -1) return [] // Client is already up to date

  return _eventBuffer.slice(idx)
}

/**
 * Broadcast a versioned, ordered change event.
 *
 * @param collection - Collection name ('leads', 'cars', 'users')
 * @param action     - 'create', 'update', or 'delete'
 * @param recordId   - The record's ID (required)
 * @param changedBy  - Who made the change
 * @param payload    - Action-specific payload:
 *                     create: full normalized record (id, not _id)
 *                     update: only the changed fields
 *                     delete: null (omit or pass null)
 */
export function broadcastChange(
  collection: string,
  action: SyncEvent['action'],
  recordId: string,
  changedBy?: string,
  payload?: Record<string, any> | null,
) {
  _eventSequence++

  const event: SyncEvent = {
    eventId: _eventSequence,
    version: _eventSequence,
    collection,
    action,
    recordId: String(recordId || ''),
    updatedAt: new Date().toISOString(),
    changedBy,
    payload: payload ?? null,
  }

  _lastChange[collection] = Date.now()

  // Add to ring buffer
  _eventBuffer.push(event)
  if (_eventBuffer.length > EVENT_BUFFER_SIZE) {
    _eventBuffer.shift()
  }

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
