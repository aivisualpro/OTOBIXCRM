<script setup lang="ts">
import { formatKm, formatDateShort, ordinal } from '~/lib/format'

const props = defineProps<{
  car: any
}>()

const facts = computed(() => {
  if (!props.car) return []
  const c = props.car
  return [
    { icon: 'i-lucide-gauge', label: 'Odometer', value: formatKm(c.odometer) },
    { icon: 'i-lucide-fuel', label: 'Fuel', value: [c.fuelType, c.cubicCapacity ? `${c.cubicCapacity}cc` : ''].filter(Boolean).join(' · ') || '—' },
    { icon: 'i-lucide-user', label: 'Owner', value: c.ownershipSerialNo ? `${ordinal(c.ownershipSerialNo)} Owner` : '—' },
    { icon: 'i-lucide-shield-check', label: 'Accident', value: c.accidentalStatus || '—' },
    { icon: 'i-lucide-map-pin', label: 'State', value: c.registrationState || '—' },
    { icon: 'i-lucide-calendar', label: 'Manufactured', value: formatDateShort(c.manufacturingDate) },
  ].filter(f => f.value && f.value !== '—')
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-y-3 gap-x-0 py-4 px-1 border rounded-xl bg-card">
    <template v-for="(fact, idx) in facts" :key="fact.label">
      <div class="flex items-center gap-2.5 px-4 min-w-0">
        <Icon :name="fact.icon" class="size-4 text-muted-foreground shrink-0" />
        <div class="flex flex-col min-w-0">
          <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">{{ fact.label }}</span>
          <span class="text-sm font-semibold text-foreground leading-tight truncate">{{ fact.value }}</span>
        </div>
      </div>
      <Separator v-if="idx < facts.length - 1" orientation="vertical" class="h-8 hidden sm:block" />
    </template>
  </div>
</template>
