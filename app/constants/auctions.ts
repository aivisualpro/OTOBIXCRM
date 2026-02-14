import type { CrudColumn } from '~/composables/useCrud'

export const auctionColumns: CrudColumn[] = [
  { key: 'imageUrl', label: '', type: 'avatar' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant' },
  { key: 'registrationNumber', label: 'Reg. No.' },
  { key: 'fuelType', label: 'Fuel' },
  { key: 'odometerReadingInKms', label: 'Odometer (KM)', type: 'number' },
  { key: 'highestBid', label: 'Highest Bid', type: 'currency' },
  { key: 'inspectionLocation', label: 'Location' },
  { key: 'auctionStatus', label: 'Status', type: 'badge' },
  { key: 'auctionEndTime', label: 'Ends At', type: 'date' },
]

export interface AuctionRouteFilter {
  label: string
  filterFn: (car: any) => boolean
  icon: string
  color: string
}

export const auctionRouteFilters: Record<string, AuctionRouteFilter> = {
  upcoming: {
    label: 'Upcoming',
    filterFn: (car: any) => !car.auctionStatus || car.auctionStatus === '' || car.auctionStatus === 'upcoming',
    icon: 'i-lucide-clock',
    color: 'text-blue-500',
  },
  live: {
    label: 'Live',
    filterFn: (car: any) => car.auctionStatus === 'live',
    icon: 'i-lucide-radio',
    color: 'text-emerald-500',
  },
  otobuy: {
    label: 'Otobuy',
    filterFn: (car: any) => car.auctionStatus === 'otobuy',
    icon: 'i-lucide-tag',
    color: 'text-violet-500',
  },
  ended: {
    label: 'Ended',
    filterFn: (car: any) => car.auctionStatus === 'liveAuctionEnded',
    icon: 'i-lucide-timer-off',
    color: 'text-amber-500',
  },
  sold: {
    label: 'Sold',
    filterFn: (car: any) => car.auctionStatus === 'sold',
    icon: 'i-lucide-badge-check',
    color: 'text-teal-500',
  },
  removed: {
    label: 'Removed',
    filterFn: (car: any) => car.auctionStatus === 'removed',
    icon: 'i-lucide-trash-2',
    color: 'text-red-500',
  },
}
