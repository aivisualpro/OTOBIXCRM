<script setup lang="ts">
import { cn, getConditionStyle } from '~/lib/utils'

const props = defineProps<{
  options: { label: string, value: string }[]
  modelValue?: any
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)

const selectedLabel = computed(() => {
  const option = props.options.find(opt => String(opt.value) === String(props.modelValue))
  if (option)
    return option.label
  // Fallback: show raw stored value when no matching option exists (e.g. legacy data)
  if (props.modelValue !== undefined && props.modelValue !== null && props.modelValue !== '')
    return Array.isArray(props.modelValue) ? props.modelValue.join(', ') : String(props.modelValue)
  return ''
})

function handleSelect(val: string) {
  emit('update:modelValue', val)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :disabled="disabled"
        :class="cn('w-full justify-between font-normal h-9 px-3', !modelValue && 'text-muted-foreground', className)"
      >
        <span v-if="!selectedLabel" class="truncate opacity-70">{{ placeholder || 'Select option...' }}</span>
        <div v-else class="flex items-center gap-1.5 px-2 py-0.5 rounded shadow-sm border min-w-0 flex-1 max-w-full" :class="getConditionStyle(selectedLabel).bg">
          <Icon :name="getConditionStyle(selectedLabel).icon" class="size-3.5 shrink-0" />
          <span class="text-[12px] font-bold leading-tight truncate flex-1 text-left">{{ selectedLabel }}</span>
        </div>
        <Icon name="i-lucide-chevrons-up-down" class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0 w-[--radix-popover-trigger-width] min-w-[200px]">
      <Command>
        <CommandInput :placeholder="searchPlaceholder || 'Search...'" class="h-9" />
        <CommandEmpty>{{ emptyMessage || 'No results found.' }}</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              @select="handleSelect(String(opt.value))"
            >
              <div
                class="flex-1 flex items-center gap-2 px-2 py-1.5 rounded shadow-sm w-full transition-all duration-200"
                :class="[
                  getConditionStyle(opt.label).bg,
                  String(modelValue) === String(opt.value) ? '!border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-background font-black scale-[1.02] z-10' : 'opacity-85 hover:opacity-100',
                ]"
              >
                <Icon :name="getConditionStyle(opt.label).icon" class="size-4 shrink-0" />
                <span class="text-[13px]" :class="String(modelValue) === String(opt.value) ? 'font-black' : 'font-bold'">{{ opt.label }}</span>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
