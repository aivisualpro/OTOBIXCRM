<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  checked?: boolean
  modelValue?: boolean | null
  disabled?: boolean
  id?: string
  name?: string
  activeColor?: string
}>(), {
  modelValue: null,
})

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:checked': [value: boolean]
}>()

const isOn = computed(() => {
  if (props.modelValue !== null && props.modelValue !== undefined) {
    return props.modelValue
  }
  return props.checked ?? false
})

function toggle(event: MouseEvent) {
  if (props.disabled)
    return
  event.stopPropagation()
  event.preventDefault()

  const next = !isOn.value

  emits('update:modelValue', next)
  emits('update:checked', next)
}
</script>

<template>
  <button
    :id="id"
    type="button"
    role="switch"
    :aria-checked="isOn"
    :disabled="disabled"
    :style="isOn && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : {}"
    :class="cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'shadow-sm transition-all duration-200 outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      isOn
        ? (activeColor ? '' : 'bg-primary')
        : 'bg-muted-foreground/30 dark:bg-input/80',
      props.class,
    )"
    @click="toggle"
  >
    <span
      :class="cn(
        'pointer-events-none block size-4 rounded-full bg-white shadow-md ring-0',
        'transition-transform duration-200 ease-in-out',
        isOn ? 'translate-x-4' : 'translate-x-0',
      )"
    />
  </button>
</template>

