import xlsx from 'xlsx';

const workbook = xlsx.readFile('C:\\Users\\RESOLVE_01\\Desktop\\모노아레나.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, {header: 1});

let guestRev = 0;
let generalRev = 0;
let internalRev = 0;
let totalRev = 0;
let otherRev = 0;

for (let i = 2; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length < 9) continue;
  
  const txName = row[3];
  const rev = Number(row[8]) || 0;

  if (typeof txName === 'string') {
    if (txName.includes('TOTAL')) continue; // Skip subtotal/total rows

    if (txName.includes('콘도')) {
      guestRev += rev;
    } else if (txName.includes('일반') || txName.includes('증평군민') || txName.includes('MOU')) {
      generalRev += rev;
    } else if (txName.includes('임직원') || txName.includes('직원동반')) {
      internalRev += rev;
    } else {
      otherRev += rev;
      console.log("Other ticket:", txName, rev);
    }
    totalRev += rev;
  }
}

console.log("Guest Revenue:", guestRev);
console.log("General Revenue:", generalRev);
console.log("Internal Revenue:", internalRev);
console.log("Other Revenue:", otherRev);
console.log("Total Ticket Revenue:", totalRev);
console.log("Ratio Guest:", (guestRev/totalRev).toFixed(4));
console.log("Ratio General:", (generalRev/totalRev).toFixed(4));
