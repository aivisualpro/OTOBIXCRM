<script setup lang="ts">
const columns = [
  { key: 'name', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category', type: 'badge' as const },
  { key: 'price', label: 'Price', type: 'currency' as const },
  { key: 'stock', label: 'Stock', type: 'number' as const },
  { key: 'status', label: 'Status', type: 'badge' as const },
]

const formFields = [
  { key: 'name', label: 'Product Name', placeholder: 'Cloud Storage Pro' },
  { key: 'sku', label: 'SKU', placeholder: 'CSP-001' },
  { key: 'category', label: 'Category', type: 'select' as const, options: [
    { label: 'Software', value: 'Software' },
    { label: 'Hardware', value: 'Hardware' },
    { label: 'Services', value: 'Services' },
    { label: 'Accessories', value: 'Accessories' },
    { label: 'Licenses', value: 'Licenses' },
  ] },
  { key: 'price', label: 'Price ($)', type: 'number' as const, placeholder: '99' },
  { key: 'stock', label: 'Stock', type: 'number' as const, placeholder: '100' },
  { key: 'status', label: 'Status', type: 'select' as const, options: [
    { label: 'Active', value: 'Active' },
    { label: 'Out of Stock', value: 'Out of Stock' },
    { label: 'Inactive', value: 'Inactive' },
  ] },
  { key: 'description', label: 'Description', type: 'textarea' as const, placeholder: 'Product description...' },
]

const seedData = [
  { id: 'p1', name: 'Enterprise Cloud Suite', sku: 'ECS-001', category: 'Software', price: 2499, stock: 999, status: 'Active', description: 'Full cloud infrastructure management' },
  { id: 'p2', name: 'DataShield Pro', sku: 'DSP-002', category: 'Software', price: 899, stock: 999, status: 'Active', description: 'Advanced cybersecurity platform' },
  { id: 'p3', name: 'SmartDesk Hub', sku: 'SDH-003', category: 'Hardware', price: 1250, stock: 45, status: 'Active', description: 'IoT-enabled smart desk manager' },
  { id: 'p4', name: 'API Gateway License', sku: 'AGL-004', category: 'Licenses', price: 499, stock: 999, status: 'Active', description: 'Annual API gateway license' },
  { id: 'p5', name: 'Cloud Migration Service', sku: 'CMS-005', category: 'Services', price: 15000, stock: 50, status: 'Active', description: 'Full cloud migration package' },
  { id: 'p6', name: 'Wireless Presenter', sku: 'WPR-006', category: 'Accessories', price: 79, stock: 0, status: 'Out of Stock', description: 'Bluetooth laser presenter' },
  { id: 'p7', name: 'Analytics Dashboard', sku: 'ADH-007', category: 'Software', price: 599, stock: 999, status: 'Active', description: 'Real-time business analytics' },
  { id: 'p8', name: 'Server Rack Unit 42U', sku: 'SRU-008', category: 'Hardware', price: 3800, stock: 12, status: 'Active', description: '42U server rack enclosure' },
  { id: 'p9', name: 'Premium Support Plan', sku: 'PSP-009', category: 'Services', price: 4500, stock: 100, status: 'Active', description: '24/7 premium support annual plan' },
  { id: 'p10', name: 'USB-C Docking Station', sku: 'UDS-010', category: 'Accessories', price: 189, stock: 230, status: 'Active', description: 'Thunderbolt 4 dock with dual display' },
  { id: 'p11', name: 'Legacy CRM Module', sku: 'LCM-011', category: 'Software', price: 299, stock: 0, status: 'Inactive', description: 'Deprecated CRM module' },
  { id: 'p12', name: 'Network Switch 48-Port', sku: 'NSW-012', category: 'Hardware', price: 2100, stock: 8, status: 'Active', description: 'Managed L3 switch 48-port PoE+' },
]
</script>

<template>
  <ErpCrudPage store-key="sales-products" title="Products" description="Comprehensive product catalog with variants, pricing, and categories." icon="i-lucide-package" entity-name="Product" :columns="columns" :form-fields="formFields" :initial-data="seedData" />
</template>
