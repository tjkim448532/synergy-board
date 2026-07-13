async function testV3Api() {
  try {
    const res = await fetch('https://belleforet-data.vercel.app/api/v3/synergy/timeseries?startDate=2026-06-01&endDate=2026-06-30');
    const json = await res.json();
    
    console.log("Status:", res.status);
    console.log("JSON Type:", Array.isArray(json) ? "Array" : typeof json);
    console.log("Keys:", Object.keys(json).join(", "));
    if (json.data) {
       console.log("Data is array:", Array.isArray(json.data));
       if (Array.isArray(json.data) && json.data.length > 0) {
          console.log("First element:", Object.keys(json.data[0] || {}).join(", "));
          
          const first = json.data[0];
          console.log("revenues:", JSON.stringify(first.revenues, null, 2));
          console.log("\nvisitorData:", JSON.stringify(first.visitorData, null, 2));
          console.log('\nleisureVisitorBreakdown:');
          console.log(JSON.stringify(first.leisureVisitorBreakdown?.slice(0,3), null, 2));

          console.log('\nmotoArenaDetails:');
          console.log(JSON.stringify(first.motoArenaDetails, null, 2));

          console.log('\ntotalRevenue:');
          console.log(JSON.stringify(first.totalRevenue, null, 2));

          console.log('\ncapacity:');
          console.log(JSON.stringify(first.capacity, null, 2));

          console.log('\nmetadata:');
          console.log(JSON.stringify(json.metadata, null, 2));

          console.log('\nrooms:');
          console.log(JSON.stringify(first.rooms, null, 2));

          console.log('\nmarketTypeBreakdown:');
          console.log(JSON.stringify(first.marketTypeBreakdown, null, 2));
       }
    }
  } catch (e) {
    console.error("Error fetching data:", e);
  }
}

testV3Api();
