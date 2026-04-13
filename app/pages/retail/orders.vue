<script setup lang="ts">
import type { SalesDocument } from '~/composables/useSalesDocument'

const statusOptions = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
]

const extraFields = [
  { key: 'tracking', label: 'Tracking Number', placeholder: 'USP-123456789' },
  { key: 'shippingMethod', label: 'Shipping Method', placeholder: 'FedEx Express, UPS Ground...' },
]

const seedData: SalesDocument[] = [
  {
    id: 'o1',
    number: 'ORD-2026-312',
    client: 'Sarah Johnson — TechVision Inc',
    clientEmail: 'sarah.j@techvision.com',
    clientAddress: '1200 Innovation Blvd, San Jose, CA 95134',
    status: 'Delivered',
    date: '2026-02-08',
    tracking: 'USP-847291536',
    shippingMethod: 'UPS Ground',
    notes: 'Delivered on Feb 11. Signed by reception desk. All items verified.',
    lineItems: [
      { id: 'li1', description: 'Dell Precision 5580 Workstation', quantity: 2, unitPrice: 2899, discount: 5, tax: 8.5 },
      { id: 'li2', description: 'LG UltraFine 32" 4K Monitor', quantity: 2, unitPrice: 699, discount: 0, tax: 8.5 },
      { id: 'li3', description: 'Logitech MX Master 3S + MX Keys', quantity: 2, unitPrice: 249, discount: 0, tax: 8.5 },
    ],
    subtotal: 7404.10,
    taxTotal: 629.35,
    discountTotal: 289.90,
    total: 8033.45,
    createdAt: '2026-02-08T09:15:00Z',
  },
  {
    id: 'o2',
    number: 'ORD-2026-313',
    client: 'Michael Chen — GlobalSoft',
    clientEmail: 'mchen@globalsoft.com',
    clientAddress: '800 Market Street, Floor 12, San Francisco, CA 94102',
    status: 'Shipped',
    date: '2026-02-10',
    tracking: 'FDX-293847561',
    shippingMethod: 'FedEx Express',
    notes: 'Expedited shipping requested. Expected delivery Feb 14.',
    lineItems: [
      { id: 'li4', description: 'Cisco Meraki MS120-48 Switch', quantity: 3, unitPrice: 1450, discount: 0, tax: 8.5 },
      { id: 'li5', description: 'Cisco Meraki MR46 Access Point', quantity: 10, unitPrice: 580, discount: 8, tax: 8.5 },
      { id: 'li6', description: 'CAT6a Cable (1000ft Box)', quantity: 5, unitPrice: 189, discount: 0, tax: 8.5 },
      { id: 'li7', description: 'Network Rack 42U Cabinet', quantity: 1, unitPrice: 1250, discount: 0, tax: 8.5 },
    ],
    subtotal: 11531,
    taxTotal: 980.14,
    discountTotal: 464,
    total: 12511.14,
    createdAt: '2026-02-10T13:30:00Z',
  },
  {
    id: 'o3',
    number: 'ORD-2026-314',
    client: 'Emily Rodriguez — Meridian Corp',
    clientEmail: 'e.rodriguez@meridian.com',
    clientAddress: '456 Oak Drive, Austin, TX 78701',
    status: 'Processing',
    date: '2026-02-12',
    tracking: '—',
    shippingMethod: 'Standard Ground',
    notes: 'Items being assembled and tested before shipment.',
    lineItems: [
      { id: 'li8', description: 'Custom Branded USB Drives (64GB)', quantity: 500, unitPrice: 8.50, discount: 10, tax: 8.25 },
      { id: 'li9', description: 'Branded Laptop Sleeves (15")', quantity: 200, unitPrice: 22, discount: 5, tax: 8.25 },
    ],
    subtotal: 8000,
    taxTotal: 660,
    discountTotal: 645,
    total: 8660,
    createdAt: '2026-02-12T10:00:00Z',
  },
  {
    id: 'o4',
    number: 'ORD-2026-315',
    client: 'James Wilson — NexGen Solutions',
    clientEmail: 'jwilson@nexgen.io',
    clientAddress: '2100 Greenway Plaza, Suite 800, Houston, TX 77046',
    status: 'Pending',
    date: '2026-02-13',
    tracking: '—',
    shippingMethod: '',
    notes: 'Large order pending payment verification. PO# NXG-2026-0445.',
    lineItems: [
      { id: 'li10', description: 'HP ProLiant DL380 Gen10 Server', quantity: 2, unitPrice: 4500, discount: 0, tax: 8.25 },
      { id: 'li11', description: 'Samsung 870 EVO 4TB SSD', quantity: 8, unitPrice: 349, discount: 5, tax: 8.25 },
      { id: 'li12', description: 'Crucial 64GB DDR4 ECC RAM', quantity: 8, unitPrice: 289, discount: 0, tax: 8.25 },
      { id: 'li13', description: 'APC Smart-UPS 3000VA', quantity: 2, unitPrice: 1890, discount: 0, tax: 8.25 },
      { id: 'li14', description: 'Server Installation & Config', quantity: 1, unitPrice: 3500, discount: 0, tax: 8.25 },
    ],
    subtotal: 21784.60,
    taxTotal: 1797.23,
    discountTotal: 139.60,
    total: 23581.83,
    createdAt: '2026-02-13T08:00:00Z',
  },
  {
    id: 'o5',
    number: 'ORD-2026-316',
    client: 'Priya Patel — DataFlow AI',
    clientEmail: 'ppatel@dataflowai.com',
    clientAddress: '300 Broad Street, Stamford, CT 06901',
    status: 'Shipped',
    date: '2026-02-09',
    tracking: 'DHL-192837465',
    shippingMethod: 'DHL Express',
    notes: 'International shipping to satellite office. Customs docs included.',
    lineItems: [
      { id: 'li15', description: 'Microsoft Surface Pro 9 (i7/16GB)', quantity: 3, unitPrice: 1599, discount: 0, tax: 6.35 },
      { id: 'li16', description: 'Surface Pro Keyboard + Pen Bundle', quantity: 3, unitPrice: 279, discount: 0, tax: 6.35 },
    ],
    subtotal: 5634,
    taxTotal: 357.76,
    discountTotal: 0,
    total: 5991.76,
    createdAt: '2026-02-09T15:45:00Z',
  },
  {
    id: 'o6',
    number: 'ORD-2026-317',
    client: 'David Kim — CloudNine Tech',
    clientEmail: 'dkim@cloudnine.com',
    clientAddress: '500 W Madison St, Chicago, IL 60661',
    status: 'Delivered',
    date: '2026-02-05',
    tracking: 'USP-738291046',
    shippingMethod: 'UPS Next Day Air',
    notes: 'Rush delivery completed successfully.',
    lineItems: [
      { id: 'li17', description: 'Ubiquiti UniFi Dream Machine Pro', quantity: 1, unitPrice: 379, discount: 0, tax: 10.25 },
    ],
    subtotal: 379,
    taxTotal: 38.85,
    discountTotal: 0,
    total: 417.85,
    createdAt: '2026-02-05T07:30:00Z',
  },
  {
    id: 'o7',
    number: 'ORD-2026-318',
    client: 'Lisa Chang — Apex Group',
    clientEmail: 'lchang@apexgroup.com',
    clientAddress: '777 Third Avenue, New York, NY 10017',
    status: 'Cancelled',
    date: '2026-02-07',
    tracking: '—',
    shippingMethod: '',
    notes: 'Cancelled by customer. Budget reallocation. Full refund processed.',
    lineItems: [
      { id: 'li18', description: 'Standing Desk (Electric, 72")', quantity: 5, unitPrice: 899, discount: 10, tax: 8.875 },
      { id: 'li19', description: 'Herman Miller Aeron Chair', quantity: 5, unitPrice: 1395, discount: 5, tax: 8.875 },
      { id: 'li20', description: 'Monitor Arm (Dual, Clamp)', quantity: 5, unitPrice: 159, discount: 0, tax: 8.875 },
    ],
    subtotal: 11467.50,
    taxTotal: 1017.49,
    discountTotal: 797.50,
    total: 12484.99,
    createdAt: '2026-02-07T11:00:00Z',
  },
  {
    id: 'o8',
    number: 'ORD-2026-319',
    client: 'Robert Martinez — Zenith Systems',
    clientEmail: 'rmartinez@zenithsys.com',
    clientAddress: '1500 NE Irving St, Portland, OR 97232',
    status: 'Processing',
    date: '2026-02-11',
    tracking: '—',
    shippingMethod: 'Freight (LTL)',
    notes: 'Bulk hardware order. Custom imaging on all laptops before shipment.',
    lineItems: [
      { id: 'li21', description: 'Lenovo ThinkPad X1 Carbon (Gen 11)', quantity: 15, unitPrice: 1849, discount: 12, tax: 0 },
      { id: 'li22', description: 'ThinkPad USB-C Dock Gen 2', quantity: 15, unitPrice: 249, discount: 10, tax: 0 },
      { id: 'li23', description: 'Windows 11 Pro License (Volume)', quantity: 15, unitPrice: 199, discount: 15, tax: 0 },
      { id: 'li24', description: 'Custom OS Image & Deployment', quantity: 15, unitPrice: 75, discount: 0, tax: 0 },
      { id: 'li25', description: 'Asset Tagging & Inventory Entry', quantity: 15, unitPrice: 25, discount: 0, tax: 0 },
    ],
    subtotal: 32887.50,
    taxTotal: 0,
    discountTotal: 6307.50,
    total: 32887.50,
    createdAt: '2026-02-11T14:00:00Z',
  },
]
</script>

<template>
  <RetailDocumentPage
    store-key="sales-orders-v2"
    doc-type="Order"
    title="Retail / Sales Orders"
    description=""
    icon="i-lucide-shopping-cart"
    :status-options="statusOptions"
    :extra-fields="extraFields"
    :initial-data="seedData"
  />
</template>
