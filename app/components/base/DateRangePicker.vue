<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { Ref } from 'vue'
import { CalendarDate, DateFormatter, getLocalTimeZone, today } from '@internationalized/date'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

const emit = defineEmits<{
  'update:range': [{ start: Date, end: Date }]
}>()

// Default: last 20 days
const todayDate = today(getLocalTimeZone())
const defaultStart = todayDate.subtract({ days: 20 })

const value = ref({
  start: defaultStart,
  end: todayDate,
}) as Ref<DateRange>

function emitRange() {
  if (value.value.start && value.value.end) {
    const start = value.value.start.toDate(getLocalTimeZone())
    const end = value.value.end.toDate(getLocalTimeZone())
    // Set end to end of day
    end.setHours(23, 59, 59, 999)
    emit('update:range', { start, end })
  }
}

// Emit initial range on mount
onMounted(() => {
  emitRange()
})

// Watch for range changes
watch(value, () => {
  emitRange()
}, { deep: true })
</script>

<template>
  <div :class="cn('grid gap-2', $attrs.class ?? '')">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          id="date"
          variant="outline"
          :class="cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
          )"
        >
          <CalendarIcon class="mr-2 h-4 w-4" />

          <template v-if="value.start">
            <template v-if="value.end">
              {{ df.format(value.start.toDate(getLocalTimeZone())) }} - {{ df.format(value.end.toDate(getLocalTimeZone())) }}
            </template>

            <template v-else>
              {{ df.format(value.start.toDate(getLocalTimeZone())) }}
            </template>
          </template>
          <template v-else>
            Pick a date
          </template>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="end">
        <RangeCalendar
          v-model="value"
          weekday-format="short"
          :number-of-months="2"
          initial-focus
          :placeholder="value.start"
          @update:start-value="(startDate: any) => value.start = startDate"
        />
      </PopoverContent>
    </Popover>
  </div>
</template>
