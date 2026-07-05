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
          
          const latestMonth = json.data[json.data.length - 1];
          console.log("revenues:", JSON.stringify(latestMonth.revenues, null, 2));
          console.log("\nvisitorData:", JSON.stringify(latestMonth.visitorData, null, 2));
          console.log("\nleisureVisitorBreakdown:", JSON.stringify(latestMonth.leisureVisitorBreakdown, null, 2));
       }
    }
  } catch (e) {
    console.error("Error fetching data:", e);
  }
}

testV3Api();
