<script setup lang="ts">
const props = defineProps<{
  car: any
}>()

const components = computed(() => {
  if (!props.car) return []
  const c = props.car
  return [
    { name: 'Clutch', value: c.clutch, icon: 'i-lucide-disc' },
    { name: 'Suspension', value: c.suspension, icon: 'i-lucide-arrow-up-down' },
    { name: 'Steering', value: c.steering, icon: 'i-lucide-navigation' },
    { name: 'Brake', value: c.brake, icon: 'i-lucide-octagon' },
    { name: 'AC', value: c.ac, icon: 'i-lucide-snowflake' },
  ].filter(item => item.value)
})

const goodValues = ['okay', 'ok', 'effective', 'working', 'good', 'normal']
const badValues = ['non-working', 'not working', 'damaged', 'broken', 'not okay', 'ineffective']

const score = computed(() => {
  if (components.value.length === 0) return 0
  const good = components.value.filter(c => {
    const v = (c.value || '').toLowerCase()
    return goodValues.includes(v)
  }).length
  return Math.round((good / components.value.length) * 10)
})

const scoreColor = computed(() => {
  if (score.value >= 8) return { stroke: 'text-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Good' }
  if (score.value >= 5) return { stroke: 'text-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Average' }
  return { stroke: 'text-red-500', text: 'text-red-600 dark:text-red-400', label: 'Poor' }
})

const radius = 40
const circumference = 2 * Math.PI * radius
const dashOffset = computed(() => circumference - (score.value / 10) * circumference)

function getStatusStyle(value: string) {
  const v = (value || '').toLowerCase()
  if (goodValues.includes(v)) {
    return { cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400', icon: 'i-lucide-check-circle' }
  }
  if (badValues.includes(v)) {
    return { cls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400', icon: 'i-lucide-x-circle' }
  }
  return { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: 'i-lucide-alert-circle' }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row gap-6 items-start">
      <!-- Circular Score -->
      <div class="flex flex-col items-center gap-2 shrink-0 mx-auto sm:mx-0">
        <div class="relative size-28">
          <svg class="size-28 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" :r="radius"
              fill="none" class="stroke-muted/30" stroke-width="6"
            />
            <circle
              cx="50" cy="50" :r="radius"
              fill="none" :class="scoreColor.stroke" stroke-width="6"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="dashOffset"
              style="transition: stroke-dashoffset 0.8s ease-out"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-2xl font-bold" :class="scoreColor.text">{{ score }}</span>
            <span class="text-[10px] text-muted-foreground font-medium">/10</span>
          </div>
        </div>
        <span class="text-xs font-semibold" :class="scoreColor.text">{{ scoreColor.label }}</span>
      </div>

      <!-- Component Rows -->
      <div class="flex-1 w-full space-y-2">
        <div
          v-for="comp in components"
          :key="comp.name"
          class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <Icon :name="comp.icon" class="size-4 text-muted-foreground shrink-0" />
          <span class="text-sm font-medium flex-1">{{ comp.name }}</span>
          <Badge variant="outline" :class="getStatusStyle(comp.value).cls" class="text-xs font-semibold">
            <Icon :name="getStatusStyle(comp.value).icon" class="size-3" />
            {{ comp.value }}
          </Badge>
        </div>
      </div>
    </div>

    <!-- Additional Notes -->
    <div v-if="car?.additionalNotes" class="border-l-4 border-primary pl-4 py-2">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Inspector Notes</p>
      <p class="text-sm text-muted-foreground leading-relaxed">{{ car.additionalNotes }}</p>
    </div>
  </div>
</template>
