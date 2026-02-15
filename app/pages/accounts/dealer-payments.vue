<script setup lang="ts">
const columns = [
  { key: 'date', label: 'Date', type: 'date' as const },
  { key: 'description', label: 'Description' },
  { key: 'account', label: 'Account' },
  { key: 'type', label: 'Type', type: 'badge' as const },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', type: 'currency' as const },
]

const formFields = [
  { key: 'date', label: 'Date', type: 'date' as const },
  { key: 'description', label: 'Description', placeholder: 'Payment from client' },
  { key: 'account', label: 'Account', placeholder: 'Cash & Equivalents' },
  { key: 'type', label: 'Type', type: 'select' as const, options: [
    { label: 'Credit', value: 'Credit' },
    { label: 'Debit', value: 'Debit' },
  ] },
  { key: 'category', label: 'Category', type: 'select' as const, options: [
    { label: 'Revenue', value: 'Revenue' },
    { label: 'Payroll', value: 'Payroll' },
    { label: 'Operating', value: 'Operating' },
    { label: 'Marketing', value: 'Marketing' },
    { label: 'Utilities', value: 'Utilities' },
    { label: 'Rent', value: 'Rent' },
    { label: 'Refund', value: 'Refund' },
    { label: 'Transfer', value: 'Transfer' },
  ] },
  { key: 'amount', label: 'Amount ($)', type: 'number' as const, placeholder: '5000' },
  { key: 'reference', label: 'Reference #', placeholder: 'TXN-001' },
]

const seedData = [
  { id: 'tx1', date: '2026-02-13', description: 'Payment from TechVision Inc', account: 'Accounts Receivable', type: 'Credit', category: 'Revenue', amount: 92500, reference: 'PAY-4521' },
  { id: 'tx2', date: '2026-02-13', description: 'Monthly payroll - February', account: 'Salaries & Wages', type: 'Debit', category: 'Payroll', amount: 128000, reference: 'PAY-4520' },
  { id: 'tx3', date: '2026-02-12', description: 'AWS hosting charges', account: 'Cloud Infrastructure', type: 'Debit', category: 'Operating', amount: 8450, reference: 'AWS-FEB26' },
  { id: 'tx4', date: '2026-02-12', description: 'Google Ads campaign', account: 'Marketing & Advertising', type: 'Debit', category: 'Marketing', amount: 12000, reference: 'GAD-0213' },
  { id: 'tx5', date: '2026-02-11', description: 'Office rent - Q1', account: 'Rent Expense', type: 'Debit', category: 'Rent', amount: 45000, reference: 'RENT-Q1-26' },
  { id: 'tx6', date: '2026-02-11', description: 'Payment from GlobalSoft', account: 'Accounts Receivable', type: 'Credit', category: 'Revenue', amount: 72000, reference: 'PAY-4519' },
  { id: 'tx7', date: '2026-02-10', description: 'Internet & phone services', account: 'Utilities', type: 'Debit', category: 'Utilities', amount: 2800, reference: 'UTL-FEB26' },
  { id: 'tx8', date: '2026-02-10', description: 'Customer refund - Order #318', account: 'Revenue Returns', type: 'Debit', category: 'Refund', amount: 4500, reference: 'REF-0318' },
  { id: 'tx9', date: '2026-02-09', description: 'Payment from DataFlow AI', account: 'Accounts Receivable', type: 'Credit', category: 'Revenue', amount: 18500, reference: 'PAY-4518' },
  { id: 'tx10', date: '2026-02-09', description: 'Transfer to savings', account: 'Savings Account', type: 'Debit', category: 'Transfer', amount: 50000, reference: 'TFR-0209' },
  { id: 'tx11', date: '2026-02-08', description: 'Software licenses renewal', account: 'Operating Expenses', type: 'Debit', category: 'Operating', amount: 15600, reference: 'LIC-2026' },
  { id: 'tx12', date: '2026-02-08', description: 'Payment from CloudNine Tech', account: 'Accounts Receivable', type: 'Credit', category: 'Revenue', amount: 22000, reference: 'PAY-4517' },
]
</script>

<template>
  <ErpCrudPage store-key="fin-transactions" title="Transactions" description="Real-time transaction ledger with categorization and reconciliation." icon="i-lucide-arrow-right-left" entity-name="Transaction" :columns="columns" :form-fields="formFields" :initial-data="seedData" />
</template>
