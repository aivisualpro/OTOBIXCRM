<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  checked?: boolean
  modelValue?: boolean | null
  disabled?: boolean
  id?: string
  name?: string
}>()

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:checked': [value: boolean]
}>()

function toggle(event: MouseEvent) {
  if (props.disabled) return
  event.stopPropagation()
  event.preventDefault()
  
  const current = props.modelValue ?? props.checked ?? false
  const next = !current
  
  emits('update:modelValue', next)
  emits('update:checked', next)
}
</script>

<template>
  <button
    :id="id"
    type="button"
    role="switch"
    :aria-checked="!!(modelValue ?? checked)"
    :disabled="disabled"
    :class="cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'shadow-sm transition-all duration-200 outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      (modelValue ?? checked) 
        ? 'bg-primary' 
        : 'bg-muted-foreground/30 dark:bg-input/80',
      props.class
    )"
    @click="toggle"
  >
    <span
      :class="cn(
        'pointer-events-none block size-4 rounded-full bg-white shadow-md ring-0',
        'transition-transform duration-200 ease-in-out',
        (modelValue ?? checked) ? 'translate-x-4' : 'translate-x-0'
      )"
    />
  </button>
</template>
