const XLSX = require('xlsx');

const filePath = 'sheet.html';
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

let motoTargetMonth = "2026-01";
const breakdown = { guest: {}, general: {}, internal: {}, other: {} };

let headerRowIdx = -1;
let txColIdx = -1;
let revColIdx = -1;
let dateColIdx = -1;
let venueColIdx = -1;

for (let i = 0; i < 15; i++) {
  const r = data[i];
  if (!r) continue;
  const rStr = r.join(' ').replace(/\s+/g, '');
  
  if (rStr.includes('트랜잭션명') || rStr.includes('상품명') || rStr.includes('메뉴명') || rStr.includes('매출구분') || rStr.includes('품목명') || rStr.includes('아이템')) {
    headerRowIdx = i;
    for (let j = 0; j < r.length; j++) {
      const cellStr = r[j] ? r[j].toString().replace(/\s+/g, '') : '';
      if (cellStr.includes('트랜잭션명') || cellStr.includes('상품명') || cellStr.includes('메뉴명') || cellStr.includes('매출구분') || cellStr.includes('품목명') || cellStr.includes('아이템')) {
        txColIdx = j;
      }
      if (cellStr.includes('실매출') || cellStr.includes('결제금액') || cellStr.includes('매출') || cellStr.includes('합계')) {
        revColIdx = j;
      }
      if (cellStr.includes('영업장') || cellStr.includes('매장')) {
        venueColIdx = j;
      }
    }
    break;
  }
}

console.log({headerRowIdx, txColIdx, revColIdx, dateColIdx, venueColIdx});
console.log('data.length =', data.length);

const dataStartIdx = headerRowIdx + 1;
const motoParsedMap = {};

for (let i = dataStartIdx; i < data.length; i++) {
  const row = data[i];
  if (!row) continue;
  
  let monthKey = motoTargetMonth;
  
  if (!motoParsedMap[monthKey]) {
     motoParsedMap[monthKey] = {
         yearMonth: monthKey,
         motoGuestRev: 0,
         motoGeneralRev: 0,
         motoInternalRev: 0,
         motoOtherRev: 0,
         motoTotalRev: 0,
         breakdown: { guest: {}, general: {}, internal: {}, other: {} }
     };
  }

  const mData = motoParsedMap[monthKey];
  const venueName = venueColIdx !== -1 ? String(row[venueColIdx] || '') : '모토아레나';
  if (venueColIdx !== -1 && !venueName.includes('모토아레나')) continue;

  const txName = row[txColIdx];
  let revStr = String(row[revColIdx] || '0').replace(/,/g, '');
  let rev = parseInt(revStr, 10);
  if(isNaN(rev)) rev = 0;
  
  if (typeof txName === 'string') {
    const upperTx = txName.toUpperCase();
    if (upperTx.includes('TOTAL') || txName.includes('소계') || txName.includes('합계')) continue;
    
    let category = 'other';
    if (txName.includes('콘도') || txName.includes('객실')) {
      mData.motoGuestRev += rev;
      category = 'guest';
    } else if (txName.includes('일반') || txName.includes('증평군민') || txName.includes('MOU') || txName.includes('단체')) {
      mData.motoGeneralRev += rev;
      category = 'general';
    } else if (txName.includes('임직원') || txName.includes('직원동반')) {
      mData.motoInternalRev += rev;
      category = 'internal';
    } else {
      mData.motoOtherRev += rev;
    }
    
    mData.motoTotalRev += rev;
    mData.breakdown[category][txName] = (mData.breakdown[category][txName] || 0) + rev;
  }
}

console.log(JSON.stringify(motoParsedMap, null, 2));
