const fs = require('fs');
const path = 'src/components/NewBusinessTraining.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('export default function NewBusinessTraining({ monthlyData, settings })', 'export default function NewBusinessTraining({ processedData, globalStats, settings })');

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('let totSold = 0;'));
const endIdx = lines.findIndex(l => l.includes('return {'));

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx, 
      '    let totSold = 0;\n' +
      '    let totRev = 0;\n' +
      '    let totLeisure = 0;\n' +
      '    let totMotoGuest = 0;\n' +
      '    let totMotoTotal = 0;\n' +
      '    let totFnb = 0;\n' +
      '    let totOther = 0;\n' +
      '    let totGolf = 0;\n' +
      '\n' +
      '    const pointsLeisure = [];\n' +
      '    const pointsMoto = [];\n' +
      '    const pointsFnb = [];\n' +
      '\n' +
      '    const validData = (processedData || []).filter(d => {\n' +
      '      const idStr = String(d.id || d.yearMonth || "");\n' +
      '      return idStr.match(/^\\d{4}-\\d{2}$/);\n' +
      '    });\n' +
      '\n' +
      '    validData.forEach(d => {\n' +
      '      const totalSold = d.totalSold || 0;\n' +
      '      totSold += totalSold;\n' +
      '      totRev += d.totalRoomRevenue || 0;\n' +
      '\n' +
      '      let mGuestRev = 0;\n' +
      '      let mTotalRev = d.motoSales || 0;\n' +
      '      const excel2Total = Number(d.motoTotalRev || 0);\n' +
      '      if (excel2Total > 0 && mTotalRev > 0) {\n' +
      '        const guestRatio = Number(d.motoGuestRev || 0) / excel2Total;\n' +
      '        mGuestRev = Math.round(mTotalRev * guestRatio);\n' +
      '      } else if (mTotalRev > 0) {\n' +
      '        mGuestRev = Math.round(mTotalRev * 0.7);\n' +
      '      }\n' +
      '\n' +
      '      totLeisure += d.leisureSales || 0;\n' +
      '      totMotoGuest += mGuestRev;\n' +
      '      totMotoTotal += mTotalRev;\n' +
      '      totFnb += d.fnbSales || 0;\n' +
      '      totOther += d.otherSales || 0;\n' +
      '      totGolf += d.golfSales || 0;\n' +
      '\n' +
      '      if (totalSold > 0) {\n' +
      '         if (d.leisureSales > 0) pointsLeisure.push({ x: totalSold, y: d.leisureSales });\n' +
      '         if (mGuestRev > 0) pointsMoto.push({ x: totalSold, y: mGuestRev });\n' +
      '         if (d.fnbSales > 0) pointsFnb.push({ x: totalSold, y: d.fnbSales });\n' +
      '      }\n' +
      '    });\n' +
      '\n'
  );
}

content = lines.join('\n');
content = content.replace('totRev: totRev,', 'totRev: totRev,\n      totOther,\n      totGolf,');
content = content.replace('((baseMetrics.totRev + baseMetrics.totLeisure + baseMetrics.totMoto + baseMetrics.totFnb) / baseMetrics.monthsCount * 12) + expectedTotalRev', '((baseMetrics.totRev + baseMetrics.totLeisure + baseMetrics.totMoto + baseMetrics.totFnb + baseMetrics.totOther) / baseMetrics.monthsCount * 12) + expectedTotalRev');

fs.writeFileSync(path, content, 'utf8');
console.log('NewBusinessTraining replaced successfully');
