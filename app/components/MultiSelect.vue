<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '~/lib/utils'

const props = defineProps<{
  options: { label: string, value: string }[]
  modelValue?: string | string[]
  placeholder?: string
  className?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const open = ref(false)

const selectedValues = computed({
  get: () => {
    let vals: string[] = []
    if (Array.isArray(props.modelValue)) vals = props.modelValue
    else if (typeof props.modelValue === 'string' && props.modelValue) vals = [props.modelValue]
    
    return vals.flatMap(v => typeof v === 'string' ? v.split(',') : String(v)).map(s => s.trim()).filter(Boolean)
  },
  set: (val: string[]) => {
    if (Array.isArray(props.modelValue)) emit('update:modelValue', val)
    else emit('update:modelValue', val.join(', '))
  }
})

function isSelected(val: string) {
  const target = String(val).trim().toLowerCase()
  return selectedValues.value.some(v => v.toLowerCase() === target)
}

function toggleOption(val: string) {
  const current = [...selectedValues.value]
  const target = String(val).trim().toLowerCase()
  const idx = current.findIndex(v => v.toLowerCase() === target)
  
  if (idx === -1) current.push(val)
  else current.splice(idx, 1)
  
  selectedValues.value = current
}

const selectedLabels = computed(() => {
  return selectedValues.value
    .map(v => {
      const match = props.options.find(o => String(o.value).trim().toLowerCase() === v.toLowerCase())
      return match ? match.label : v
    })
    .join(', ')
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger">
        <Button
          variant="outline"
          role="combobox"
          :aria-expanded="open"
          :class="cn('w-full justify-between font-normal h-8 px-3 text-sm flex', !selectedValues.length && 'text-muted-foreground', className)"
        >
          <span class="truncate block w-full text-left">{{ selectedLabels || placeholder || 'Select items...' }}</span>
          <Icon name="i-lucide-chevrons-up-down" class="ml-2 size-4 shrink-0 opacity-50 block" />
        </Button>
      </slot>
    </PopoverTrigger>
    <PopoverContent class="p-0 w-[var(--radix-popover-trigger-width)] min-w-[200px]">
      <Command>
        <CommandInput placeholder="Search..." class="h-9" />
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              @select="toggleOption(String(opt.value))"
            >
              <Icon
                name="i-lucide-check"
                :class="cn(
                  'mr-2 size-4',
                  selectedValues.includes(String(opt.value)) || isSelected(String(opt.value)) ? 'opacity-100 text-primary' : 'opacity-0'
                )"
              />
              {{ opt.label }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
