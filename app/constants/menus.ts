import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'Workspace',
    items: [
      {
        title: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        link: '/',
      },
      {
        title: 'Leads',
        icon: 'i-lucide-magnet',
        link: '/leads',
      },
      {
        title: 'People',
        icon: 'i-lucide-users',
        link: '/people/otobix',
      },
      {
        title: 'Auctions',
        icon: 'i-lucide-gavel',
        link: '/auctions/upcoming',
      },
      {
        title: 'Notifications',
        icon: 'i-lucide-bell',
        link: '/notifications',
      },
    ],
  },
  {
    heading: 'Apps',
    items: [
      {
        title: 'Tasks',
        icon: 'i-lucide-check-square',
        link: '/tasks',
      },
      {
        title: 'Timeline',
        icon: 'i-lucide-gantt-chart',
        link: '/timeline',
      },
    ],
  },
  {
    heading: 'Retail',
    items: [
      {
        title: 'Purchase Requests',
        icon: 'i-lucide-file-text',
        link: '/retail/purchase-requests',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Pickup Requests',
        icon: 'i-lucide-receipt',
        link: '/retail/pickup-requests',
        disabled: true,
        comingSoon: true,
      },
    ],
  },
  {
    heading: 'Accounts',
    items: [
      {
        title: 'Customer Payments',
        icon: 'i-lucide-wallet',
        link: '/accounts/customer-payments',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Dealer Payments',
        icon: 'i-lucide-arrow-right-left',
        link: '/accounts/dealer-payments',
        disabled: true,
        comingSoon: true,
      },
    ],
  },
  {
    heading: 'Finance',
    items: [
      {
        title: 'Expenses',
        icon: 'i-lucide-credit-card',
        link: '/finance/expenses',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Tax Management',
        icon: 'i-lucide-percent',
        link: '/finance/taxes',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Balance Sheet',
        icon: 'i-lucide-landmark',
        link: '/finance/balance-sheet',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Income Statement',
        icon: 'i-lucide-receipt',
        link: '/finance/income-statement',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Financial Ratios',
        icon: 'i-lucide-chart-no-axes-combined',
        link: '/finance/ratios',
        disabled: true,
        comingSoon: true,
      },
    ],
  },
  {
    heading: 'Reports',
    items: [
      {
        title: 'Sales Reports',
        icon: 'i-lucide-trending-up',
        link: '/reports/sales',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Financial Reports',
        icon: 'i-lucide-pie-chart',
        link: '/reports/financial',
        disabled: true,
        comingSoon: true,
      },
      {
        title: 'Business Health',
        icon: 'i-lucide-heart-pulse',
        link: '/reports/business-health',
        disabled: true,
        comingSoon: true,
      },
    ],
  },
  {
    heading: 'Support',
    items: [
      {
        title: 'Tickets',
        icon: 'i-lucide-ticket',
        link: '/support/tickets',
      },
    ],
  },

]

export const navMenuBottom: NavMenuItems = []
