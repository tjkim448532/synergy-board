const fs = require('fs');
const XLSX = require('xlsx');

const dir = 'C:/Users/RESOLVE_01/Documents';
const files = fs.readdirSync(dir);
const targetFile = files.find(f => f.includes('1') && f.endsWith('.xlsx'));

if (targetFile) {
  const filePath = dir + '/' + targetFile;
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const venues = new Set();
  const items = new Set();
  for (let i = 3; i < jsonData.length; i++) {
    if (jsonData[i] && jsonData[i][1]) {
      venues.add(String(jsonData[i][1]).trim());
      items.add(String(jsonData[i][3] || '').trim());
    }
  }
  console.log('--- VENUES ---');
  console.log(Array.from(venues).join(', '));
  console.log('\n--- SAMPLE ITEMS ---');
  console.log(Array.from(items).slice(0, 30).join(', '));
}
