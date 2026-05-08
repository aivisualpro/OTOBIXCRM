<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { formatINR } from '~/lib/format'

const props = defineProps<{
  car: any
}>()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => { timer = setInterval(() => now.value = new Date(), 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const highestOffer = computed(() => Number(props.car?.highestOffer) || 0)
const expectedPrice = computed(() => Number(props.car?.expectedPrice) || 0)
const priceDiscovery = computed(() => Number(props.car?.priceDiscovery) || 0)
const priceDelta = computed(() => highestOffer.value - expectedPrice.value)
const isDeltaPositive = computed(() => priceDelta.value >= 0)

const auctionStart = computed(() => new Date(props.car?.auctionStartTime))
const auctionEnd = computed(() => new Date(props.car?.auctionEndTime))
const totalDuration = computed(() => auctionEnd.value.getTime() - auctionStart.value.getTime())
const elapsed = computed(() => Math.max(0, now.value.getTime() - auctionStart.value.getTime()))
const progressPct = computed(() => {
  if (totalDuration.value <= 0) return 0
  return Math.min(100, Math.round((elapsed.value / totalDuration.value) * 100))
})

const timeRemaining = computed(() => Math.max(0, auctionEnd.value.getTime() - now.value.getTime()))
const isUrgent = computed(() => timeRemaining.value > 0 && timeRemaining.value < 3600000)
const isExpired = computed(() => timeRemaining.value <= 0)

const hours = computed(() => String(Math.floor(timeRemaining.value / 3600000)).padStart(2, '0'))
const minutes = computed(() => String(Math.floor((timeRemaining.value % 3600000) / 60000)).padStart(2, '0'))
const seconds = computed(() => String(Math.floor((timeRemaining.value % 60000) / 1000)).padStart(2, '0'))

const sellerContact = computed(() => props.car?.sellerContactNumber || '')
</script>

<template>
  <div class="rounded-2xl border bg-card p-6 space-y-5 h-full flex flex-col">
    <!-- Highest Offer -->
    <div class="space-y-1">
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Highest Offer</p>
      <div class="flex items-baseline gap-3 flex-wrap">
        <span class="text-4xl font-semibold tracking-tight text-foreground">
          <NumberFlow
            :value="highestOffer"
            :format="{ style: 'currency', currency: 'INR', maximumFractionDigits: 0 }"
          />
        </span>
        <Badge
          v-if="priceDelta !== 0"
          variant="outline"
          :class="isDeltaPositive
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'"
          class="text-xs font-semibold"
        >
          <Icon :name="isDeltaPositive ? 'i-lucide-trending-up' : 'i-lucide-trending-down'" class="size-3" />
          {{ isDeltaPositive ? '+' : '' }}{{ formatINR(priceDelta) }}
        </Badge>
      </div>
    </div>

    <!-- Countdown Timer -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time Remaining</p>
        <span class="text-[10px] text-muted-foreground font-mono">{{ progressPct }}% elapsed</span>
      </div>
      <div
        class="font-mono text-3xl font-semibold tracking-tight tabular-nums"
        :class="isExpired ? 'text-muted-foreground' : isUrgent ? 'text-destructive' : 'text-foreground'"
      >
        <template v-if="isExpired">
          <span class="text-lg font-medium">Auction Ended</span>
        </template>
        <template v-else>
          <span>{{ hours }}</span>
          <span class="text-muted-foreground mx-1 animate-pulse">:</span>
          <span>{{ minutes }}</span>
          <span class="text-muted-foreground mx-1 animate-pulse">:</span>
          <span>{{ seconds }}</span>
        </template>
      </div>
      <Progress :model-value="progressPct" class="h-1.5" />
    </div>

    <!-- Stat Blocks -->
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl bg-muted/50 p-3 space-y-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expected Price</p>
        <p class="text-sm font-semibold">{{ formatINR(expectedPrice) }}</p>
      </div>
      <div class="rounded-xl bg-muted/50 p-3 space-y-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price Discovery</p>
        <p class="text-sm font-semibold">{{ formatINR(priceDiscovery) }}</p>
      </div>
    </div>

    <!-- CTAs -->
    <div class="flex gap-2 mt-auto pt-2">
      <Button class="flex-1" size="sm">
        <Icon name="i-lucide-gavel" class="size-4 mr-1.5" />
        View All Bids
      </Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :as="sellerContact ? 'a' : 'button'"
              :href="sellerContact ? `tel:${sellerContact}` : undefined"
            >
              <Icon name="i-lucide-phone" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ sellerContact || 'No contact available' }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
