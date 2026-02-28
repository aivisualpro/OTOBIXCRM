<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  SwitchRoot,
  SwitchThumb,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<SwitchRootProps & {
  class?: HTMLAttributes['class']
  checked?: boolean
}>()

const emits = defineEmits<SwitchRootEmits & {
  'update:checked': [value: boolean]
}>()

const delegatedProps = reactiveOmit(props, 'class', 'checked')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

// Resolve the effective checked state: prefer modelValue, fall back to checked prop
const effectiveValue = computed(() => props.modelValue ?? props.checked ?? false)

function handleUpdate(val: boolean) {
  emits('update:modelValue', val)
  emits('update:checked', val)
}
</script>

<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="forwarded"
    :model-value="effectiveValue"
    :class="cn(
      'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    @update:model-value="handleUpdate"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :class="cn('bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0')"
    >
      <slot name="thumb" />
    </SwitchThumb>
  </SwitchRoot>
</template>
