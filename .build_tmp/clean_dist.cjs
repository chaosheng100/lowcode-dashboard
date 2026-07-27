const fs = require('fs')
const path = require('path')
const stale = 'dist_stale_bak'
fs.mkdirSync(stale + '/assets', { recursive: true })
const move = (src) => {
  const dest = path.join(stale, src.replace(/^dist[\\/]/, ''))
  try {
    fs.renameSync(src, dest)
    console.log('moved', src)
  } catch (e) {
    console.log('move FAIL', src, e.code)
  }
}
const files = [
  'dist/index.html',
  'dist/assets/index-BoxGGDvs.css',
  'dist/assets/index-CMkOoRkk.js',
  'dist/assets/index-CV1V2Lci.js'
]
for (const f of files) {
  if (fs.existsSync(f)) move(f)
}
console.log('remaining in dist:', fs.readdirSync('dist'), fs.readdirSync('dist/assets'))
