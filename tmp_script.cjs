const fs = require('fs');
let content = fs.readFileSync('src/components/AdvancedAnalytics.jsx', 'utf8');

const lines = content.split('\n');

// Find bounds for Chunk 1
const start1 = lines.findIndex(l => l.includes('const [googleVisitorsData'));
const end1 = lines.findIndex(l => l.includes('const divisionConfig = useMemo')) - 1;

if (start1 > -1 && end1 > -1) {
  lines.splice(start1, end1 - start1 + 1, '  // Google Visitors data replaced by visitorCalcData logic');
}

// Find bound for Chunk 2
const start2 = lines.findIndex(l => l.includes('const totalHotelGuests = useMemo(() => {'));
if (start2 > -1) {
  const newLogic = `
  const displayVisitors = useMemo(() => {
    return filteredProcessedData.reduce((sum, d) => {
      if (d.visitorCalcData) {
        const numTotalVehicles = Number(d.visitorCalcData.totalVehicles) || 0;
        const numEmployeeVehicles = Number(d.visitorCalcData.employeeVehicles) || 0;
        const numGolfGuests = Number(d.visitorCalcData.golfGuests) || 0;
        const netVehicles = Math.max(0, numTotalVehicles - numEmployeeVehicles);
        const estimatedPeople = netVehicles * 3;
        const totalVisitors = Math.max(0, estimatedPeople - numGolfGuests);
        return sum + totalVisitors;
      }
      return sum;
    }, 0);
  }, [filteredProcessedData]);
`;
  lines.splice(start2, 0, newLogic);
}

// Find bound for Chunk 3
const start3 = lines.findIndex(l => l.includes('Live from Google'));
if (start3 > -1) {
  lines[start3] = lines[start3].replace('Live from Google', 'Calculated');
}

fs.writeFileSync('src/components/AdvancedAnalytics.jsx', lines.join('\n'));
console.log('AdvancedAnalytics.jsx updated successfully.');
