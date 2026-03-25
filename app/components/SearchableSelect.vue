<script setup lang="ts">
import { cn } from '~/lib/utils'

const props = defineProps<{
  options: { label: string, value: string }[]
  modelValue?: string | number
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
  return option ? option.label : ''
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
        <span class="truncate">{{ selectedLabel || placeholder || 'Select option...' }}</span>
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
              <Icon
                name="i-lucide-check"
                :class="cn(
                  'mr-2 size-4',
                  String(modelValue) === String(opt.value) ? 'opacity-100' : 'opacity-0',
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
