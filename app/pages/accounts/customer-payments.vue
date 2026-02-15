<script setup lang="ts">
const columns = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Account Name' },
  { key: 'type', label: 'Type', type: 'badge' as const },
  { key: 'balance', label: 'Balance', type: 'currency' as const },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status', type: 'badge' as const },
]

const formFields = [
  { key: 'code', label: 'Account Code', placeholder: '1000' },
  { key: 'name', label: 'Account Name', placeholder: 'Cash & Equivalents' },
  { key: 'type', label: 'Account Type', type: 'select' as const, options: [
    { label: 'Asset', value: 'Asset' },
    { label: 'Liability', value: 'Liability' },
    { label: 'Equity', value: 'Equity' },
    { label: 'Revenue', value: 'Revenue' },
    { label: 'Expense', value: 'Expense' },
  ] },
  { key: 'balance', label: 'Balance ($)', type: 'number' as const, placeholder: '50000' },
  { key: 'currency', label: 'Currency', type: 'select' as const, options: [
    { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' },
    { label: 'GBP', value: 'GBP' },
    { label: 'CAD', value: 'CAD' },
  ] },
  { key: 'status', label: 'Status', type: 'select' as const, options: [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
  ] },
  { key: 'description', label: 'Description', type: 'textarea' as const, placeholder: 'Account description...' },
]

const seedData = [
  { id: 'ac1', code: '1000', name: 'Cash & Cash Equivalents', type: 'Asset', balance: 485000, currency: 'USD', status: 'Active' },
  { id: 'ac2', code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: 342000, currency: 'USD', status: 'Active' },
  { id: 'ac3', code: '1200', name: 'Inventory', type: 'Asset', balance: 1800000, currency: 'USD', status: 'Active' },
  { id: 'ac4', code: '1500', name: 'Fixed Assets', type: 'Asset', balance: 950000, currency: 'USD', status: 'Active' },
  { id: 'ac5', code: '2000', name: 'Accounts Payable', type: 'Liability', balance: 186000, currency: 'USD', status: 'Active' },
  { id: 'ac6', code: '2100', name: 'Accrued Expenses', type: 'Liability', balance: 45000, currency: 'USD', status: 'Active' },
  { id: 'ac7', code: '2500', name: 'Long-Term Debt', type: 'Liability', balance: 520000, currency: 'USD', status: 'Active' },
  { id: 'ac8', code: '3000', name: 'Common Stock', type: 'Equity', balance: 1000000, currency: 'USD', status: 'Active' },
  { id: 'ac9', code: '3100', name: 'Retained Earnings', type: 'Equity', balance: 2340000, currency: 'USD', status: 'Active' },
  { id: 'ac10', code: '4000', name: 'Product Revenue', type: 'Revenue', balance: 4560000, currency: 'USD', status: 'Active' },
  { id: 'ac11', code: '4100', name: 'Service Revenue', type: 'Revenue', balance: 1890000, currency: 'USD', status: 'Active' },
  { id: 'ac12', code: '5000', name: 'Cost of Goods Sold', type: 'Expense', balance: 2100000, currency: 'USD', status: 'Active' },
  { id: 'ac13', code: '6000', name: 'Salaries & Wages', type: 'Expense', balance: 1560000, currency: 'USD', status: 'Active' },
  { id: 'ac14', code: '6100', name: 'Marketing & Advertising', type: 'Expense', balance: 340000, currency: 'USD', status: 'Active' },
  { id: 'ac15', code: '7000', name: 'EUR Operating Account', type: 'Asset', balance: 125000, currency: 'EUR', status: 'Active' },
]
</script>

<template>
  <ErpCrudPage store-key="fin-accounts" title="Chart of Accounts" description="Hierarchical account structure with financial statement configuration." icon="i-lucide-wallet" entity-name="Account" :columns="columns" :form-fields="formFields" :initial-data="seedData" />
</template>
