import type { Updater } from '@tanstack/vue-table'
import type { ClassValue } from 'clsx'
import type { Ref } from 'vue'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function valueUpdater<T extends Updater<any>>(updaterOrValue: T, ref: Ref) {
  ref.value = typeof updaterOrValue === 'function'
    ? updaterOrValue(ref.value)
    : updaterOrValue
}

export function getConditionStyle(val: string) {
  if (!val) return { bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-400', icon: 'i-lucide-tag' }
  const lower = String(val).toLowerCase().trim()
  const successKeys = ['ok', 'good', 'normal', 'safe', 'satisfactory', 'clean', 'clear', 'photocopy', 'available', 'yes', 'original']
  const errorKeys = ['major', 'tear', 'missing', 'broken', 'damage', 'dent', 'rust', 'cracked', 'rejected', 'scrapped']
  const warningKeys = ['scratch', 'minor', 'fade', 'worn', 'repaint', 'chipped', 'duplicate', 'mismatch', 'no']
  const infoKeys = ['repair', 'replace', 'changed', 'service', 'dry']

  if (successKeys.some(k => lower.includes(k))) return { bg: 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400', icon: 'i-lucide-check-circle' }
  if (errorKeys.some(k => lower.includes(k))) return { bg: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400', icon: 'i-lucide-alert-triangle' }
  if (warningKeys.some(k => lower.includes(k))) return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: 'i-lucide-info' }
  if (infoKeys.some(k => lower.includes(k))) return { bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-400', icon: 'i-lucide-wrench' }
  return { bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-400', icon: 'i-lucide-tag' }
}
