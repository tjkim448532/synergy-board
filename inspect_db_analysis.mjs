import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { isHoliday } from 'korean-holidays';

const firebaseConfig = {
  projectId: "synergy-board",
  appId: "1:1090826952361:web:8ad8a33583b985c9a793b8",
  storageBucket: "synergy-board.firebasestorage.app",
  apiKey: "AIzaSyB3BlR6" + "iCy11R49FbYss7OkhFxOQZYzcIY",
  authDomain: "synergy-board.firebaseapp.com",
  messagingSenderId: "1090826952361"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getDefaultGroup = (loc) => {
  if (loc.includes('골프') || loc.includes('클럽하우스') || loc.includes('그늘집') || loc === '골프부대' || loc.includes('그린피') || loc.includes('프로샵')) {
    return 'golf';
  } else if (loc.includes('식당') || loc.includes('BBQ') || loc.includes('조식') || loc.includes('바베큐') || loc.includes('카페') || loc.includes('식음') || loc.includes('BHC') || loc.includes('멕시카나') || loc.includes('편의점') || loc.includes('CU') || loc.includes('쿠치나') || loc.includes('연회장') || loc.includes('벨포레홀') || loc.includes('벼루재촌') || loc.includes('밤밤') || loc.includes('남도예담') || loc.includes('브리스킷') || loc.includes('투썸') || loc.includes('레스토랑') || loc.includes('스타트하우스') || loc.includes('딜라이트')) {
    return 'fnb';
  } else if (loc.includes('기타') || loc === '임대수익' || loc.includes('주차') || loc.includes('대여품')) {
    return 'other';
  } else if (loc.includes('모토아레나') || loc.includes('핏스탑')) {
    return 'moto';
  } else {
    return 'leisure';
  }
};

async function fetchHourlyPrecipitation(startDate, endDate) {
  const lat = 36.8451;
  const lon = 127.5821;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=precipitation&timezone=Asia/Seoul`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const hourly = data.hourly;
    const dailyMap = {};
    if (hourly && hourly.time) {
      hourly.time.forEach((t, idx) => {
        const [dateStr, timeStr] = t.split('T');
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (hour >= 10 && hour <= 18) {
          const rainVal = Number(hourly.precipitation[idx] || 0);
          dailyMap[dateStr] = (dailyMap[dateStr] || 0) + rainVal;
        }
      });
    }
    return dailyMap;
  } catch (error) {
    console.error("fetchHourlyPrecipitation failed:", error);
    return {};
  }
}

async function run() {
  const snapshot = await getDocs(collection(db, 'monthly_records'));
  const processedData = [];
  snapshot.forEach(doc => processedData.push(doc.data()));

  let minDate = null;
  let maxDate = null;
  processedData.forEach(m => {
    if (m.rawRoomRecords && Array.isArray(m.rawRoomRecords)) {
      m.rawRoomRecords.forEach(rec => {
        if (rec.date) {
          if (!minDate || rec.date < minDate) minDate = rec.date;
          if (!maxDate || rec.date > maxDate) maxDate = rec.date;
        }
      });
    }
  });

  const hourlyWeatherMap = await fetchHourlyPrecipitation(minDate, maxDate);

  const dateMap = {};
  processedData.forEach(m => {
    if (m.rawLeisureRecords && Array.isArray(m.rawLeisureRecords)) {
      m.rawLeisureRecords.forEach(rec => {
        if (!rec.date) return;
        const dateStr = rec.date;
        if (!dateMap[dateStr]) {
          const rain10to18 = hourlyWeatherMap[dateStr] !== undefined ? hourlyWeatherMap[dateStr] : null;
          dateMap[dateStr] = {
            date: dateStr,
            precipitation: rain10to18,
            leisureBreakdown: {}
          };
        }
        if (rec.breakdown) {
          Object.entries(rec.breakdown).forEach(([locName, amt]) => {
            const val = Number(amt) || 0;
            dateMap[dateStr].leisureBreakdown[locName] = (dateMap[dateStr].leisureBreakdown[locName] || 0) + val;
          });
        }
      });
    }
  });

  const RAIN_THRESHOLD = 3.0;
  const rainyDays = [];

  Object.values(dateMap).forEach(d => {
    if (d.precipitation === null) return;
    const [yyyy, mm, dd] = d.date.split('-');
    const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    const day = dateObj.getDay();
    const isWeekendOrHoliday = day === 0 || day === 6 || isHoliday(dateObj);
    
    if (isWeekendOrHoliday) return;

    if (d.precipitation >= RAIN_THRESHOLD) {
      rainyDays.push(d);
    }
  });

  console.log(`\n[검증] 주중 우천일 (${rainyDays.length}일) 일자별 상세 목장/야외 매출 출력`);
  console.log("==========================================================================================");
  console.log("   날짜     | 강수량(10-18h) |    목장 매출   |   사계절썰매장   |   놀이동산    |  마운틴카트 ");
  console.log("==========================================================================================");
  
  // 날짜순 정렬
  rainyDays.sort((a,b) => a.date.localeCompare(b.date));

  rainyDays.forEach(d => {
    const p = d.precipitation.toFixed(1);
    const m = (d.leisureBreakdown['목장'] || 0);
    const s = (d.leisureBreakdown['사계절썰매장'] || 0);
    const n = (d.leisureBreakdown['놀이동산(2025)'] || d.leisureBreakdown['놀이동산'] || 0);
    const c = (d.leisureBreakdown['마운틴카트'] || 0);
    
    console.log(`${d.date} | ${p.padStart(10)}mm | ₩${m.toLocaleString().padStart(12)} | ₩${s.toLocaleString().padStart(12)} | ₩${n.toLocaleString().padStart(12)} | ₩${c.toLocaleString().padStart(12)}`);
  });
  console.log("==========================================================================================");
  
  process.exit(0);
}

run();
