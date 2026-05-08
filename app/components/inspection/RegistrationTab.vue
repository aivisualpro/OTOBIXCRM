<script setup lang="ts">
import { formatDateFull, validityStatus } from '~/lib/format'

const props = defineProps<{
  car: any
}>()

const ownerSection = computed(() => {
  if (!props.car) return []
  const c = props.car
  return [
    { label: 'Registered Owner', value: c.registeredOwner },
    { label: 'Registration State', value: c.registrationState },
    { label: 'Registered RTO', value: c.registeredRTO },
    { label: 'RC Status', value: c.rcStatus },
    { label: 'Registration Date', value: formatDateFull(c.registrationDate) },
    { label: 'Hypothecation', value: c.hypothecationDetails },
    { label: 'Financier', value: c.financierName },
    { label: 'Blacklist Status', value: c.blacklistStatus },
  ].filter(i => i.value && i.value !== '—')
})

const identifiers = computed(() => {
  if (!props.car) return []
  const c = props.car
  return [
    { label: 'Engine Number', value: c.engineNumber },
    { label: 'Chassis Number', value: c.chassisNumber },
    { label: 'PUC Number', value: c.pucNumber },
    { label: 'Manufacturing Date', value: formatDateFull(c.manufacturingDate) },
  ].filter(i => i.value && i.value !== '—')
})

const validityFields = computed(() => {
  if (!props.car) return []
  const c = props.car
  return [
    { label: 'Road Tax', value: c.roadTaxValidity, date: c.taxValidTill },
    { label: 'Tax Valid Till', value: null, date: c.taxValidTill },
    { label: 'Fitness', value: null, date: c.fitnessValidity },
    { label: 'Insurance', value: null, date: c.insuranceValidity },
    { label: 'PUC Validity', value: null, date: c.pucValidityDate },
  ].filter(i => i.date || i.value)
})

const toneClasses: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  destructive: 'bg-red-500',
}
</script>

<template>
  <div class="space-y-8">
    <!-- Owner & Registration -->
    <div v-if="ownerSection.length > 0" class="space-y-3">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Owner & Registration</p>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <div v-for="item in ownerSection" :key="item.label">
          <dt class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{{ item.label }}</dt>
          <dd class="text-sm font-medium mt-0.5">{{ item.value }}</dd>
        </div>
      </dl>
    </div>

    <Separator v-if="identifiers.length > 0" />

    <!-- Identifiers -->
    <div v-if="identifiers.length > 0" class="space-y-3">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Identifiers</p>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <div v-for="item in identifiers" :key="item.label">
          <dt class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{{ item.label }}</dt>
          <dd class="text-sm font-medium font-mono mt-0.5">{{ item.value }}</dd>
        </div>
      </dl>
    </div>

    <Separator v-if="validityFields.length > 0" />

    <!-- Validity -->
    <div v-if="validityFields.length > 0" class="space-y-3">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Validity</p>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <div v-for="item in validityFields" :key="item.label">
          <dt class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{{ item.label }}</dt>
          <dd class="text-sm font-medium mt-0.5 flex items-center gap-2">
            <template v-if="item.date">
              <span
                class="size-2 rounded-full shrink-0"
                :class="toneClasses[validityStatus(item.date).tone]"
              />
              <span>{{ formatDateFull(item.date) }}</span>
              <Badge
                variant="outline"
                class="text-[10px]"
                :class="{
                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400': validityStatus(item.date).tone === 'success',
                  'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400': validityStatus(item.date).tone === 'warning',
                  'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400': validityStatus(item.date).tone === 'destructive',
                }"
              >
                {{ validityStatus(item.date).label }}
              </Badge>
            </template>
            <template v-else>
              {{ item.value || '—' }}
            </template>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Address -->
    <div v-if="car?.registeredAddressAsPerRC" class="space-y-2 pt-2">
      <Separator />
      <div class="pt-3">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Address (as per RC)</p>
        <p class="text-sm text-muted-foreground leading-relaxed">{{ car.registeredAddressAsPerRC }}</p>
      </div>
    </div>
  </div>
</template>
