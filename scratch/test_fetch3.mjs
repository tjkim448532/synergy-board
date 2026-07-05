const API_URL = 'https://belleforet-data.vercel.app/api/v3/dashboard/revenue-summary?date=2026-07-04'; fetch(API_URL).then(r=>r.json()).then(j=>console.log(JSON.stringify(j, null, 2)));
