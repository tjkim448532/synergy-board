const API_URL = 'https://belleforet-data.vercel.app/api/v3/dashboard/revenue-summary?date=2026-07-04';
const res = await fetch(API_URL);
const json = await res.json();
console.log(JSON.stringify(json.leisureVisitorBreakdown, null, 2));
