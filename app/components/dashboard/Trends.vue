<script setup lang="ts">
const props = defineProps<{
  auctionData: { date: string, amount: number, count: number }[]
  customerData: { date: string, count: number }[]
  timeRange: string
}>()

/** Merge auction + customer daily data into a single dataset for the chart */
const chartData = computed(() => {
  const dateMap = new Map<string, { date: string, 'Auctions Closed': number, 'New Customers': number }>()

  // Seed from auction data
  props.auctionData.forEach((d) => {
    dateMap.set(d.date, { date: d.date, 'Auctions Closed': d.amount, 'New Customers': 0 })
  })

  // Merge customer data
  props.customerData.forEach((d) => {
    const existing = dateMap.get(d.date)
    if (existing) {
      existing['New Customers'] = d.count
    }
    else {
      dateMap.set(d.date, { date: d.date, 'Auctions Closed': 0, 'New Customers': d.count })
    }
  })

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
})

const filteredData = computed(() => {
  if (!chartData.value.length) return chartData.value

  const data = chartData.value
  const totalDays = data.length

  if (props.timeRange === '7d') {
    return data.slice(Math.max(0, totalDays - 7))
  }
  else if (props.timeRange === '30d') {
    return data.slice(Math.max(0, totalDays - 30))
  }
  return data // 90d or all
})
</script>

<template>
  <AreaChart :data="filteredData" :categories="['Auctions Closed', 'New Customers']" index="date" />
</template>
