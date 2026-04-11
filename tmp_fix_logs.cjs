const fs = require('node:fs')
const path = require('node:path')

function walkDir(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name)
    if (f.isDirectory() && !full.includes('node_modules') && !full.includes('.git')) {
      walkDir(full)
    }
    else if (full.endsWith('.ts') || full.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8')
      if (content.includes('console.log')) {
        fs.writeFileSync(full, content.replace(/console\.log/g, 'console.warn'))
      }
    }
  }
}
walkDir('server')
walkDir('test_upload.js')
console.warn('Done replacing logs.')
