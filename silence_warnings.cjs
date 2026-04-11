const fs = require('node:fs')
const path = require('node:path')

function replaceInDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath)
    }
    else if (fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      // replace all variations
      const newContent = content.replace(/console\.warn/g, (match, offset, str) => {
        // check if this line contains MongoDB
        const lineEnd = str.indexOf('\n', offset)
        const lineScope = str.substring(offset, lineEnd)
        if (lineScope.includes('MongoDB')) {
          return 'console.info'
        }
        return match
      })
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent)
        console.log('Fixed:', fullPath)
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'server/api'))

const utilsFile = path.join(__dirname, 'server/utils/appsheet.ts')
if (fs.existsSync(utilsFile)) {
  const content = fs.readFileSync(utilsFile, 'utf8')
  const newContent = content.replace(/console\.warn\('\[AppSheet\] Sync error/g, 'console.info(\'[AppSheet] Sync error')
  if (content !== newContent) {
    fs.writeFileSync(utilsFile, newContent)
    console.log('Fixed:', utilsFile)
  }
}
