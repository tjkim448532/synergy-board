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
  
  console.log('--- MOTO ARENA & LEISURE DATA ---');
  let headerRowIdx = 2; // based on previous output
  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row) continue;
    const venue = String(row[1] || '').trim();
    if (venue.includes('모토') || venue.includes('레저') || venue.includes('루지') || venue.includes('목장')) {
      console.log(venue + ' | ' + String(row[3] || '').trim() + ' | Qty: ' + row[4] + ' | Total: ' + row[8]);
    }
  }
}
