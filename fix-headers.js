const fs = require('node:fs')

const salesFiles = [
  'all.vue',
  'customer-activity.vue',
  'customers.vue',
  'dealer-activity.vue',
  'ended.vue',
  'invoices.vue',
  'live.vue',
  'orders.vue',
  'otobuy.vue',
  'products.vue',
  'quotes.vue',
  'removed.vue',
  'sold.vue',
  'upcoming.vue',
].map(f => `app/pages/sales/${f}`)

const retailFiles = [
  'all.vue',
  'customer-activity.vue',
  'customers.vue',
  'dealer-activity.vue',
  'ended.vue',
  'invoices.vue',
  'live.vue',
  'orders.vue',
  'otobuy.vue',
  'pickup-requests.vue',
  'products.vue',
  'purchase-requests.vue',
  'quotes.vue',
  'removed.vue',
  'sold.vue',
  'upcoming.vue',
].map(f => `app/pages/retail/${f}`)

function processFile(filePath, isRetail) {
  if (!fs.existsSync(filePath))
    return

  let content = fs.readFileSync(filePath, 'utf8')
  let changed = false

  const prefix = isRetail ? 'Retail / ' : 'Sales / '

  // Fix title="..."
  content = content.replace(/title="([^"]+)"/g, (match, title) => {
    changed = true
    let newTitle = title.replace(/ Sales/g, '').replace(/ Retail/g, '') // strip out existing " Sales" or " Retail"
    if (!newTitle.includes(prefix)) {
      if (newTitle === 'Sales')
        newTitle = 'All' // if it was just "Sales", call it "All"
      return `title="${prefix}${newTitle}"`
    }
    return match
  })

  // Fix description="..."
  content = content.replace(/description="[^"]*"/g, () => {
    changed = true
    return `description=""`
  })

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`Updated: ${filePath}`)
  }
}

salesFiles.forEach(f => processFile(f, false))
retailFiles.forEach(f => processFile(f, true))
