const fs = require('fs');
const path = require('path');
const regex = /fontSize:\s*['"]([^'"]+)['"]/g;
function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      walk(file);
    } else if (file.endsWith('.jsx')) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        let match;
        while ((match = regex.exec(l)) !== null) {
          const size = match[1];
          if (['10px', '11px', '12.5px', '42px', '56px'].includes(size)) {
            console.log(file + ':' + (i+1) + ': ' + size + ' - ' + l.trim());
          }
        }
      });
    }
  });
}
walk('src');
