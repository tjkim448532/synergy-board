const fs = require('fs');
const XLSX = require('xlsx');

const dir = 'C:/Users/RESOLVE_01/Documents';
const files = fs.readdirSync(dir);
const targetFile = files.find(f => f.includes('1') && f.endsWith('.xlsx'));

if (targetFile) {
  const filePath = dir + '/' + targetFile;
  console.log('Processing: ' + filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('--- HEADERS ---');
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    console.log('Row ' + i + ': ' + JSON.stringify(jsonData[i]));
  }

  console.log('\n--- SAMPLE DATA ---');
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    if (jsonData[i].length > 5) {
      headerRowIdx = i;
      break;
    }
  }
  for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 5, jsonData.length); i++) {
    console.log('Row ' + i + ': ' + JSON.stringify(jsonData[i].filter(Boolean)));
  }
} else {
  console.log('File not found in Documents.');
}
