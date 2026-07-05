const https = require('https');

https.get('https://belleforet-data.vercel.app/api/v3/dashboard/revenue-summary?date=2026-07-04', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json.leisureVisitorBreakdown, null, 2));
    } catch(e) {
      console.error(e);
    }
  });
});
