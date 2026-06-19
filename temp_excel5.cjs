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
  
  console.log('--- ALL MOTO ROWS ---');
  for (let i = 3; i < jsonData.length; i++) {
    const rowStr = JSON.stringify(jsonData[i] || []);
    if (rowStr.includes('모토아레나')) {
      console.log(rowStr);
    }
  }
}
