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
  
  const motoItems = new Set();
  for (let i = 3; i < jsonData.length; i++) {
    if (jsonData[i] && String(jsonData[i][1]).trim() === '모토아레나') {
      motoItems.add(String(jsonData[i][3] || '').trim() + ' (Qty: ' + jsonData[i][4] + ', Rev: ' + jsonData[i][5] + ')');
    }
  }
  console.log('--- MOTO ARENA ITEMS ---');
  console.log(Array.from(motoItems).join('\n'));
}
