<script setup lang="ts">
import { formatINR, formatDateFull, formatRelative } from '~/lib/format'
import { toast } from 'vue-sonner'

const props = defineProps<{
  car: any
}>()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => { timer = setInterval(() => now.value = new Date(), 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const expectedPrice = computed(() => Number(props.car?.expectedPrice) || 0)
const highestOffer = computed(() => Number(props.car?.highestOffer) || 0)
const priceDiscovery = computed(() => Number(props.car?.priceDiscovery) || 0)

const sellerContact = computed(() => props.car?.sellerContactNumber || '')

function copyContact() {
  if (!sellerContact.value) return
  navigator.clipboard.writeText(sellerContact.value)
  toast.success('Contact copied')
}

// Timeline milestones
const milestones = computed(() => {
  const c = props.car
  if (!c) return []
  return [
    { label: 'Auction Start', date: c.auctionStartTime, icon: 'i-lucide-play' },
    { label: 'Auction End', date: c.auctionEndTime, icon: 'i-lucide-flag' },
    { label: 'Handover', date: c.expectedDateOfCarHandover, icon: 'i-lucide-truck' },
  ].filter(m => m.date)
})

function isInPast(date: string) {
  return new Date(date).getTime() < now.value.getTime()
}
</script>

<template>
  <div class="space-y-8">
    <!-- Price Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="rounded-xl border bg-card p-4 space-y-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expected Price</p>
        <p class="text-xl font-semibold">{{ formatINR(expectedPrice) }}</p>
      </div>
      <div class="rounded-xl border bg-card p-4 space-y-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Highest Offer</p>
        <p class="text-xl font-semibold">{{ formatINR(highestOffer) }}</p>
        <Badge
          v-if="highestOffer && expectedPrice"
          variant="outline"
          :class="highestOffer >= expectedPrice
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'"
          class="text-[10px]"
        >
          {{ highestOffer >= expectedPrice ? '+' : '' }}{{ formatINR(highestOffer - expectedPrice) }}
        </Badge>
      </div>
      <div class="rounded-xl border bg-card p-4 space-y-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price Discovery</p>
        <p class="text-xl font-semibold">{{ formatINR(priceDiscovery) }}</p>
      </div>
    </div>

    <!-- Timeline -->
    <div v-if="milestones.length > 0" class="space-y-3">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Auction Timeline</p>
      <div class="flex items-center gap-0 overflow-x-auto no-scrollbar">
        <template v-for="(m, idx) in milestones" :key="m.label">
          <div class="flex flex-col items-center gap-1.5 shrink-0 px-3">
            <div
              class="size-8 rounded-full flex items-center justify-center border-2 transition-colors"
              :class="isInPast(m.date) ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-border text-muted-foreground'"
            >
              <Icon :name="m.icon" class="size-3.5" />
            </div>
            <span class="text-[10px] font-semibold text-center whitespace-nowrap">{{ m.label }}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <span class="text-[10px] text-muted-foreground cursor-help whitespace-nowrap">
                    {{ formatRelative(m.date) }}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{{ formatDateFull(m.date) }}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div
            v-if="idx < milestones.length - 1"
            class="flex-1 min-w-8 h-0.5 rounded-full"
            :class="isInPast(milestones[idx + 1]?.date) ? 'bg-primary' : 'bg-border'"
          />
        </template>
      </div>
    </div>

    <!-- Margins -->
    <div class="flex items-center gap-6">
      <div v-if="car?.fixedMargin" class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Fixed Margin</span>
        <Badge variant="secondary" class="text-xs font-semibold">{{ car.fixedMargin }}%</Badge>
      </div>
      <div v-if="car?.variableMargin" class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Variable Margin</span>
        <Badge variant="secondary" class="text-xs font-semibold">{{ car.variableMargin }}%</Badge>
      </div>
    </div>

    <!-- Seller Contact -->
    <div v-if="sellerContact" class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <Icon name="i-lucide-phone" class="size-4 text-muted-foreground" />
      <div class="flex-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Seller Contact</p>
        <a :href="`tel:${sellerContact}`" class="text-sm font-semibold font-mono hover:text-primary transition-colors">
          {{ sellerContact }}
        </a>
      </div>
      <Button variant="ghost" size="icon" class="size-8" @click="copyContact">
        <Icon name="i-lucide-copy" class="size-3.5" />
      </Button>
    </div>
  </div>
</template>
