<script setup lang="ts">
const columns = [
  { key: 'name', label: 'Customer', type: 'avatar' as const },
  { key: 'email', label: 'Email', type: 'email' as const },
  { key: 'company', label: 'Company' },
  { key: 'totalSpent', label: 'Lifetime Value', type: 'currency' as const },
  { key: 'orders', label: 'Orders', type: 'number' as const },
  { key: 'status', label: 'Status', type: 'badge' as const },
  { key: 'joinDate', label: 'Since', type: 'date' as const },
]

const formFields = [
  { key: 'name', label: 'Name', placeholder: 'Jane Smith' },
  { key: 'email', label: 'Email', type: 'email' as const, placeholder: 'jane@company.com' },
  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
  { key: 'company', label: 'Company', placeholder: 'Acme Corp' },
  { key: 'totalSpent', label: 'Lifetime Value ($)', type: 'number' as const, placeholder: '5000' },
  { key: 'orders', label: 'Total Orders', type: 'number' as const, placeholder: '10' },
  { key: 'status', label: 'Status', type: 'select' as const, options: [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
    { label: 'VIP', value: 'VIP' },
  ] },
  { key: 'joinDate', label: 'Customer Since', type: 'date' as const },
]

const seedData = [
  { id: 'cu1', name: 'Olivia Harper', email: 'olivia@techvision.io', phone: '+1 (555) 111-2222', company: 'TechVision Inc', totalSpent: 452000, orders: 28, status: 'VIP', joinDate: '2023-03-15', avatar: 'https://i.pravatar.cc/40?u=olivia@techvision.io' },
  { id: 'cu2', name: 'Lucas Rivera', email: 'lucas@globalsoft.com', phone: '+1 (555) 333-4444', company: 'GlobalSoft', totalSpent: 186000, orders: 15, status: 'Active', joinDate: '2026-01-20', avatar: 'https://i.pravatar.cc/40?u=lucas@globalsoft.com' },
  { id: 'cu3', name: 'Amelia Brooks', email: 'amelia@meridian.com', phone: '+1 (555) 555-6666', company: 'Meridian Corp', totalSpent: 95000, orders: 8, status: 'Active', joinDate: '2026-06-10', avatar: 'https://i.pravatar.cc/40?u=amelia@meridian.com' },
  { id: 'cu4', name: 'Ethan Clarke', email: 'ethan@nexgen.co', phone: '+1 (555) 777-8888', company: 'NexGen Solutions', totalSpent: 34500, orders: 4, status: 'Active', joinDate: '2026-02-28', avatar: 'https://i.pravatar.cc/40?u=ethan@nexgen.co' },
  { id: 'cu5', name: 'Sophia Bennett', email: 'sophia@apex.group', phone: '+1 (555) 999-0000', company: 'Apex Group', totalSpent: 560000, orders: 42, status: 'VIP', joinDate: '2022-11-05', avatar: 'https://i.pravatar.cc/40?u=sophia@apex.group' },
  { id: 'cu6', name: 'Noah Mitchell', email: 'noah@cloudnine.tech', phone: '+1 (555) 222-3333', company: 'CloudNine Tech', totalSpent: 22000, orders: 3, status: 'Active', joinDate: '2026-08-14', avatar: 'https://i.pravatar.cc/40?u=noah@cloudnine.tech' },
  { id: 'cu7', name: 'Isabella Cruz', email: 'isabella@brightpath.io', phone: '+1 (555) 444-5555', company: 'BrightPath', totalSpent: 8500, orders: 2, status: 'Active', joinDate: '2026-10-22', avatar: 'https://i.pravatar.cc/40?u=isabella@brightpath.io' },
  { id: 'cu8', name: 'William Foster', email: 'will@zenithsys.com', phone: '+1 (555) 666-7777', company: 'Zenith Systems', totalSpent: 128000, orders: 11, status: 'Active', joinDate: '2026-04-18', avatar: 'https://i.pravatar.cc/40?u=will@zenithsys.com' },
  { id: 'cu9', name: 'Charlotte Owens', email: 'charlotte@dataflowai.com', phone: '+1 (555) 888-9999', company: 'DataFlow AI', totalSpent: 67000, orders: 6, status: 'Active', joinDate: '2026-09-01', avatar: 'https://i.pravatar.cc/40?u=charlotte@dataflowai.com' },
  { id: 'cu10', name: 'Liam Peterson', email: 'liam@synthetix.io', phone: '+1 (555) 100-2003', company: 'Synthetix Labs', totalSpent: 15000, orders: 1, status: 'Inactive', joinDate: '2026-05-30', avatar: 'https://i.pravatar.cc/40?u=liam@synthetix.io' },
]
</script>

<template>
  <ErpCrudPage store-key="sales-customers" title="Customers" description="360-degree customer profiles with purchase history and lifetime value analytics." icon="i-lucide-users" entity-name="Customer" :columns="columns" :form-fields="formFields" :initial-data="seedData" />
</template>
