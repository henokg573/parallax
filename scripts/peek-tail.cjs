const fs = require('fs')
const s = fs.readFileSync('src/app/(frontend)/admin/registrations/page.tsx', 'utf8')
const lines = s.split('\n')
console.log(lines.slice(240, 310).map((l, i) => (i + 241) + ': ' + l).join('\n'))
