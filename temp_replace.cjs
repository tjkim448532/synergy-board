const fs = require('fs');
const path = require('path');
function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      walk(file);
    } else if (file.endsWith('.jsx')) {
      let content = fs.readFileSync(file, 'utf8');
      const original = content;
      content = content.replace(/fontSize:\s*['"]10px['"]/g, "fontSize: '12px'");
      content = content.replace(/fontSize:\s*['"]11px['"]/g, "fontSize: '12px'");
      content = content.replace(/fontSize:\s*['"]12\.5px['"]/g, "fontSize: '13px'");
      content = content.replace(/fontSize:\s*['"]42px['"]/g, "fontSize: '40px'");
      content = content.replace(/fontSize:\s*['"]56px['"]/g, "fontSize: '48px'");
      if (original !== content) {
        fs.writeFileSync(file, content);
        console.log('Updated font sizes in ' + file);
      }
    }
  });
}
walk('src');
