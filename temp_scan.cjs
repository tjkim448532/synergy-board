const fs = require('fs');
const path = require('path');
const regex = /fontSize:\s*['"]([^'"]+)['"]/g;
let results = {};
function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      walk(file);
    } else if (file.endsWith('.jsx')) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const size = match[1];
        if (!results[size]) results[size] = [];
        results[size].push(file);
      }
    }
  });
}
walk('src');
for (const [size, files] of Object.entries(results)) {
  console.log(size + ': ' + files.length + ' occurrences');
}
