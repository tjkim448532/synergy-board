import { useState, useEffect } from 'react';

// 백엔드 API에서 제공하는 Daily 데이터를 기존 시너지의 Monthly 데이터 포맷으로 변환하는 어댑터 함수
function transformDailyToMonthly(dailyRecords) {
  const monthlyMap = new Map();

  dailyRecords.forEach(dayData => {
    // 예: "2026-06-01" -> "2026-06"
    const yearMonth = dayData.date.substring(0, 7); 
    
    if (!monthlyMap.has(yearMonth)) {
      monthlyMap.set(yearMonth, {
        id: yearMonth,
        yearMonth: yearMonth,
        rawRoomRecords: [],
        rawLeisureRecords: [],
        leisureSalesByLocation: {},
        salesByLocation: {},
        venues: {}
        // 기타 필요한 합산 필드들 초기화
      });
    }

    const monthObj = monthlyMap.get(yearMonth);

    // 1. 객실 데이터 누적 (rawRoomRecords)
    if (dayData.rooms && Array.isArray(dayData.rooms)) {
      dayData.rooms.forEach(room => {
        monthObj.rawRoomRecords.push({
          date: dayData.date,
          roomType: room.roomType,
          marketType: room.marketType,
          count: room.roomsSold,
          revenue: room.revenue,
          // 기상 데이터 복사 (MRA 분석용)
          weatherTempMax: dayData.weather?.tempMax || 0,
          weatherTempMin: dayData.weather?.tempMin || 0,
          weatherPrecipitation: dayData.weather?.precipitation || 0,
          weatherDaytimePrecip: dayData.weather?.daytimePrecip || 0,
          weatherNighttimePrecip: dayData.weather?.nighttimePrecip || 0
        });
      });
    }

    // 2. 부대 매출 데이터 누적 (salesByLocation, venues 등)
    Object.entries(dayData.revenues || {}).forEach(([venueName, revenue]) => {
      monthObj.salesByLocation[venueName] = (monthObj.salesByLocation[venueName] || 0) + revenue;
      
      if (!monthObj.venues[venueName]) {
        monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
      }
      monthObj.venues[venueName].totalRev += revenue;
    });

    // 3. 부대 티켓 데이터 누적
    Object.entries(dayData.leisureTickets || {}).forEach(([venueName, tickets]) => {
      if (!monthObj.venues[venueName]) {
        monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
      }
      Object.entries(tickets).forEach(([ticketName, qty]) => {
        monthObj.venues[venueName].tickets[ticketName] = (monthObj.venues[venueName].tickets[ticketName] || 0) + qty;
      });
    });

    // 4. 모토아레나 전용 데이터 누적
    if (dayData.motoArenaDetails) {
      if (!monthObj.venues['모토아레나']) {
        monthObj.venues['모토아레나'] = { totalRev: 0, tickets: {}, breakdown: {} };
      }
      if (!monthObj.venues['모토아레나'].breakdown) {
        monthObj.venues['모토아레나'].breakdown = {};
      }
      // 백엔드에서 받은 7가지 카테고리를 프론트에 맞게 매핑
      monthObj.venues['모토아레나'].breakdown = {
        guest: (monthObj.venues['모토아레나'].breakdown.guest || 0) + (dayData.motoArenaDetails.guestRevenue || 0),
        internal: (monthObj.venues['모토아레나'].breakdown.internal || 0) + (dayData.motoArenaDetails.internalRevenue || 0),
        member: (monthObj.venues['모토아레나'].breakdown.member || 0) + (dayData.motoArenaDetails.memberRevenue || 0),
        partnership: (monthObj.venues['모토아레나'].breakdown.partnership || 0) + (dayData.motoArenaDetails.partnershipRevenue || 0),
        local: (monthObj.venues['모토아레나'].breakdown.local || 0) + (dayData.motoArenaDetails.localRevenue || 0),
        online: (monthObj.venues['모토아레나'].breakdown.online || 0) + (dayData.motoArenaDetails.onlineRevenue || 0),
        general: (monthObj.venues['모토아레나'].breakdown.general || 0) + (dayData.motoArenaDetails.generalRevenue || 0)
      };
    }

  });

  return Array.from(monthlyMap.values());
}

export default function useBackendData(startDate, endDate) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // sessionStorage에 부모 창에서 넘어온 date가 있으면 우선 적용
        const targetDate = sessionStorage.getItem('sso_date');
        const queryDate = targetDate ? `&targetDate=${targetDate}` : '';

        // 실제 배포된 백엔드 API 주소 (벨포레 대시보드 백엔드)
        const API_URL = `https://belleforet-data.vercel.app/api/v3/synergy/daily-records?startDate=${startDate}&endDate=${endDate}${queryDate}`;
        
        const response = await fetch(API_URL);
        
        if (!response.ok) {
          throw new Error('API fetching failed: ' + response.statusText);
        }

        const json = await response.json();
        
        if (json.status === 'success') {
          // 일일 데이터를 월별 포맷으로 묶어서 리턴 (기존 시너지 로직 호환성 유지)
          const monthlyFormatData = transformDailyToMonthly(json.data);
          setData(monthlyFormatData);
        } else {
          throw new Error(json.message || 'Unknown API Error');
        }
      } catch (err) {
        console.error("Backend API Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  return { data, loading, error };
}
