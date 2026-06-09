const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile('C:/Users/tj_ki/Desktop/1월.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

let headerRowIdx = -1;
for (let i = 0; i < 15; i++) {
  if (data[i] && data[i][0] && data[i][0].toString().includes('일자')) {
    headerRowIdx = i;
    break;
  }
}

const headers = data[headerRowIdx];
const rateIdx = headers.findIndex(h => h === '요금타입');
const marketIdx = headers.findIndex(h => h === '마켓타입');
const sourceIdx = headers.findIndex(h => h === '소스타입');
const agencyIdx = headers.findIndex(h => h === '거래처');

console.log('Headers:', { rateIdx, marketIdx, sourceIdx, agencyIdx });

const rateSet = new Set();
const marketSet = new Set();
const sourceSet = new Set();
const agencySet = new Set();

for (let i = headerRowIdx + 1; i < data.length; i++) {
  const row = data[i];
  if (!row || !row[0]) continue;
  
  if (rateIdx !== -1 && row[rateIdx]) rateSet.add(row[rateIdx]);
  if (marketIdx !== -1 && row[marketIdx]) marketSet.add(row[marketIdx]);
  if (sourceIdx !== -1 && row[sourceIdx]) sourceSet.add(row[sourceIdx]);
  if (agencyIdx !== -1 && row[agencyIdx]) agencySet.add(row[agencyIdx]);
}

console.log('Rates:', Array.from(rateSet).slice(0, 10));
console.log('Markets:', Array.from(marketSet).slice(0, 10));
console.log('Sources:', Array.from(sourceSet).slice(0, 10));
console.log('Agencies:', Array.from(agencySet).slice(0, 10));
