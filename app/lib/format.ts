/**
 * Formatting utilities for the self-inspection detail view.
 * All dates are formatted in Asia/Kolkata timezone.
 */

const IST = 'Asia/Kolkata'

/** Format number in Indian numbering system with ₹ prefix: ₹5,43,000 */
export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

/** Format a date as relative time: "in 9h 12m" or "2 days ago" */
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'

  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const absDiff = Math.abs(diffMs)
  const isFuture = diffMs > 0

  const minutes = Math.floor(absDiff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let label = ''
  if (days > 0) label = `${days}d ${hours % 24}h`
  else if (hours > 0) label = `${hours}h ${minutes % 60}m`
  else label = `${minutes}m`

  return isFuture ? `in ${label}` : `${label} ago`
}

/** Format odometer: "45,000 km" */
export function formatKm(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('en-IN')} km`
}

/** Check validity status of a date relative to today */
export function validityStatus(date: string | Date | null | undefined): { label: string, tone: 'success' | 'warning' | 'destructive' } {
  if (!date) return { label: 'Unknown', tone: 'destructive' }
  const d = new Date(date)
  if (isNaN(d.getTime())) return { label: 'Unknown', tone: 'destructive' }

  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { label: 'Expired', tone: 'destructive' }
  if (diffDays <= 30) return { label: `${diffDays}d left`, tone: 'warning' }
  return { label: 'Valid', tone: 'success' }
}

/** Format date as short month + year: "Dec 2012" */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { timeZone: IST, month: 'short', year: 'numeric' })
}

/** Format date as full readable: "Jan 30, 2014" */
export function formatDateFull(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { timeZone: IST, month: 'short', day: 'numeric', year: 'numeric' })
}

/** Ordinal suffix: 1 → "1st", 2 → "2nd" */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'] as const
  const v = n % 100
  const i = (v - 20) % 10
  return n + (s[i >= 0 ? i : -1] ?? s[v] ?? 'th')
}
