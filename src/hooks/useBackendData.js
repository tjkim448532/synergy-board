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

// 새로 추가된 Vercel 시계열 API 응답을 시너지 배열 포맷으로 매핑
function transformTimeseriesToMonthly(jsonArray) {
  const monthlyMap = new Map();

  jsonArray.forEach(dayData => {
    const yearMonth = dayData.date.substring(0, 7);
    if (!monthlyMap.has(yearMonth)) {
      monthlyMap.set(yearMonth, {
        id: yearMonth,
        yearMonth: yearMonth,
        rawRoomRecords: [],
        rawLeisureRecords: [],
        leisureSalesByLocation: {},
        salesByLocation: {},
        venues: {},
        visitorData: {
          ...(dayData.visitorData || {})
        },
        leisureVisitorBreakdown: []
      });
    }

    const monthObj = monthlyMap.get(yearMonth);
    const w = dayData.weather || {};

    const roomsSold = Number(dayData.visitorData?.roomsSold || dayData.roomsSold || 0);
    const roomRev = Number(dayData.revenues?.room || dayData.roomRevenue || 0);
    
    // [V4 API] Use unified rooms array with marketType and rateType
    const rooms = dayData.rooms || dayData.roomTypeBreakdown || dayData.visitorData?.roomTypeBreakdown || [];
    if (rooms && Array.isArray(rooms) && rooms.length > 0) {
      rooms.forEach(room => {
        monthObj.rawRoomRecords.push({
          date: dayData.date,
          roomType: room.room_type || room.roomType,
          marketType: room.market_type || room.marketType || 'TOTAL',
          rateType: room.rate_type || room.rateType || '',
          count: Number(room.rooms_sold || room.roomsSold || 0),
          revenue: Number(room.room_revenue || room.roomRevenue || room.revenue || 0),
          weatherTempMax: Number(w.tempMax || 0),
          weatherTempMin: Number(w.tempMin || 0),
          weatherPrecipitation: Number(w.precipitation || 0),
          weatherDaytimePrecip: 0, 
          weatherNighttimePrecip: 0,
          weatherWindSpeed: Number(w.windSpeed || 0),
          weatherCode: Number(w.code || 0),
          weatherDesc: w.weatherDesc || '정보없음'
        });
      });
    } else {
      // Fallback
      if (roomsSold > 0 || roomRev > 0) {
        monthObj.rawRoomRecords.push({
          date: dayData.date, roomType: '합계', marketType: 'TOTAL', count: roomsSold, revenue: roomRev,
          weatherTempMax: Number(w.tempMax || 0), weatherTempMin: Number(w.tempMin || 0), weatherPrecipitation: Number(w.precipitation || 0),
          weatherDaytimePrecip: 0, weatherNighttimePrecip: 0,
          weatherWindSpeed: Number(w.windSpeed || 0), weatherCode: Number(w.code || 0), weatherDesc: w.weatherDesc || '정보없음'
        });
      }
    }
    if (dayData.visitorData) {
      Object.keys(dayData.visitorData).forEach(key => {
        const val = Number(dayData.visitorData[key]);
        if (!isNaN(val)) {
          monthObj.visitorData[key] = (monthObj.visitorData[key] || 0) + val;
        }
      });
    }

    if (dayData.leisureVisitorBreakdown && Array.isArray(dayData.leisureVisitorBreakdown)) {
      if (!monthObj.leisureTicketUsage) monthObj.leisureTicketUsage = {};
      dayData.leisureVisitorBreakdown.forEach(item => {
        const venue = item.venue || item.facility_name;
        if (!venue) return;
        const existing = monthObj.leisureVisitorBreakdown.find(v => (v.venue || v.facility_name) === venue);
        const visitorsCount = Number(item.visitors || item.qty || 0);
        
        if (venue === '객실') {
          monthObj.guests = (monthObj.guests || 0) + visitorsCount;
        }

        if (existing) {
          existing.visitors = (Number(existing.visitors) || 0) + visitorsCount;
        } else {
          monthObj.leisureVisitorBreakdown.push({ venue: venue, facility_name: venue, visitors: visitorsCount });
        }
        monthObj.leisureTicketUsage[venue] = (monthObj.leisureTicketUsage[venue] || 0) + visitorsCount;
      });
    }

    // [V3 API] Extract marketTypeBreakdown / segmentBreakdown
    if (!monthObj.rawMarketRecords) monthObj.rawMarketRecords = [];
    const marketBreakdown = dayData.marketTypeBreakdown || dayData.segmentBreakdown || [];
    if (marketBreakdown && Array.isArray(marketBreakdown)) {
      marketBreakdown.forEach(m => {
        monthObj.rawMarketRecords.push({
          date: dayData.date,
          marketType: m.market_type || m.marketType || m.segment,
          count: Number(m.rooms_sold || m.roomsSold || m.roomsSold || 0),
          revenue: Number(m.room_revenue || m.roomRevenue || m.revenue || 0),
          visitors: Number(m.visitors || m.guests || 0)
        });
      });
    }

    // [V3 API] Extract motoArenaDetails
    if (dayData.motoArenaDetails) {
      if (!monthObj.venues['모토아레나']) {
        monthObj.venues['모토아레나'] = { totalRev: 0, tickets: {}, breakdown: {} };
      }
      if (!monthObj.venues['모토아레나'].breakdown) {
         monthObj.venues['모토아레나'].breakdown = { guest: 0, internal: 0, member: 0, partnership: 0, local: 0, online: 0, general: 0 };
      }
      monthObj.venues['모토아레나'].breakdown = {
        guest: (monthObj.venues['모토아레나'].breakdown.guest || 0) + Number(dayData.motoArenaDetails.guestRevenue || 0),
        internal: (monthObj.venues['모토아레나'].breakdown.internal || 0) + Number(dayData.motoArenaDetails.internalRevenue || 0),
        member: (monthObj.venues['모토아레나'].breakdown.member || 0) + Number(dayData.motoArenaDetails.memberRevenue || 0),
        partnership: (monthObj.venues['모토아레나'].breakdown.partnership || 0) + Number(dayData.motoArenaDetails.partnershipRevenue || 0),
        local: (monthObj.venues['모토아레나'].breakdown.local || 0) + Number(dayData.motoArenaDetails.localRevenue || 0),
        online: (monthObj.venues['모토아레나'].breakdown.online || 0) + Number(dayData.motoArenaDetails.onlineRevenue || 0),
        general: (monthObj.venues['모토아레나'].breakdown.general || 0) + Number(dayData.motoArenaDetails.generalRevenue || 0)
      };
    }

    if (dayData.revenues) {
      const breakdown = {};
      
      if (dayData.revenues.venueBreakdown && Object.keys(dayData.revenues.venueBreakdown).length > 0) {
        Object.entries(dayData.revenues.venueBreakdown).forEach(([venueName, rev]) => {
          monthObj.salesByLocation[venueName] = (monthObj.salesByLocation[venueName] || 0) + Number(rev || 0);
          if (!monthObj.venues[venueName]) {
            monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
          }
          monthObj.venues[venueName].totalRev += Number(rev || 0);
          breakdown[venueName] = Number(rev || 0);
        });
      } else {
        Object.entries(dayData.revenues).forEach(([key, rev]) => {
          if (key === 'room' || key === 'venueBreakdown') return;
          const categoryMap = { fnb: 'FNB', ticket: 'TICKET', golf: 'GOLF' };
          const venueName = categoryMap[key] || key;
          
          monthObj.salesByLocation[venueName] = (monthObj.salesByLocation[venueName] || 0) + Number(rev || 0);
          
          if (!monthObj.venues[venueName]) {
            monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
          }
          monthObj.venues[venueName].totalRev += Number(rev || 0);
          breakdown[venueName] = Number(rev || 0);
        });
      }
      
      const totalRev = Object.values(breakdown).reduce((a, b) => a + b, 0);
      if (totalRev > 0) {
        monthObj.rawLeisureRecords.push({
          date: dayData.date,
          revenue: totalRev,
          breakdown: breakdown
        });
      }
    }
  });

  return Array.from(monthlyMap.values());
}

// Vercel API의 대시보드 단일 객체 응답을 시너지 배열 포맷으로 매핑
function transformPolymorphicData(json) {
  const targetDate = json.date || json.startDate || new Date().toISOString().split('T')[0];
  const yearMonth = targetDate.substring(0, 7);

  const monthObj = {
    id: yearMonth,
    yearMonth: yearMonth,
    rawRoomRecords: [],
    rawLeisureRecords: [],
    leisureSalesByLocation: {},
    salesByLocation: {},
    venues: {},
    visitorData: {
      totalVehicles: json.visitorData?.totalVehicles || null,
      employeeVehicles: json.visitorData?.employeeVehicles || null,
      golfGuests: json.visitorData?.golfGuests || null
    },
    leisureVisitorBreakdown: json.leisureVisitorBreakdown || []
  };

  const w = json.weather || {};

  // 1. 객실 데이터 매핑
  if (json.roomTypeBreakdown && Array.isArray(json.roomTypeBreakdown) && json.roomTypeBreakdown.length > 0) {
    json.roomTypeBreakdown.forEach(room => {
      monthObj.rawRoomRecords.push({
        date: targetDate,
        roomType: room.room_type,
        marketType: 'TOTAL', 
        count: Number(room.rooms_sold || 0),
        revenue: Number(room.room_revenue || room.today_actual || 0),
        weatherTempMax: Number(w.tempMax || 0),
        weatherTempMin: Number(w.tempMin || 0),
        weatherPrecipitation: Number(w.precipitation || 0),
        weatherDaytimePrecip: 0, 
        weatherNighttimePrecip: 0,
        weatherWindSpeed: Number(w.windSpeed || 0),
        weatherCode: Number(w.code || 0),
        weatherDesc: w.weatherDesc || '정보없음'
      });
    });
  } else if (json.dailyReportBreakdown) {
    // fallback
    const kpiRoom = json.dailyReportBreakdown.find(d => d.category === 'KPI' && d.name === 'Occupied Rooms');
    const roomRev = json.dailyReportBreakdown.find(d => d.category === 'ROOM' && d.name === 'ROOM');
    
    const totalSold = kpiRoom ? Number(kpiRoom.today_actual || 0) : 0;
    const totalRev = roomRev ? Number(roomRev.today_actual || 0) : 0;
    
    if (totalSold > 0 || totalRev > 0) {
      monthObj.rawRoomRecords.push({
        date: targetDate, roomType: '합계', marketType: 'TOTAL', count: totalSold, revenue: totalRev,
        weatherTempMax: Number(w.tempMax || 0), weatherTempMin: Number(w.tempMin || 0), weatherPrecipitation: Number(w.precipitation || 0),
        weatherDaytimePrecip: 0, weatherNighttimePrecip: 0,
        weatherWindSpeed: Number(w.windSpeed || 0), weatherCode: Number(w.code || 0), weatherDesc: w.weatherDesc || '정보없음'
      });
    }
  }

  // 1.5 Extract marketTypeBreakdown / segmentBreakdown
  monthObj.rawMarketRecords = [];
  const polymorphicMarketBreakdown = json.marketTypeBreakdown || json.segmentBreakdown || [];
  if (polymorphicMarketBreakdown && Array.isArray(polymorphicMarketBreakdown)) {
    polymorphicMarketBreakdown.forEach(m => {
      monthObj.rawMarketRecords.push({
        date: targetDate,
        marketType: m.market_type || m.marketType || m.segment,
        count: Number(m.rooms_sold || m.roomsSold || m.roomsSold || 0),
        revenue: Number(m.room_revenue || m.roomRevenue || m.revenue || 0),
        visitors: Number(m.visitors || m.guests || 0)
      });
    });
  }

  // 2. 부대 매출 데이터 매핑
  if (json.dailyReportBreakdown && Array.isArray(json.dailyReportBreakdown)) {
    json.dailyReportBreakdown.forEach(item => {
      if (item.category === 'KPI' || item.category === 'TOTAL' || item.category === 'ROOM') return;
      
      const venueName = item.facility_name || item.name;
      if (!venueName) return;

      const revenue = Number(item.today_actual || 0);
      monthObj.salesByLocation[venueName] = (monthObj.salesByLocation[venueName] || 0) + revenue;
      
      if (!monthObj.venues[venueName]) {
        monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
      }
      monthObj.venues[venueName].totalRev += revenue;
    });
  }

  // 3. 부대 티켓 매핑 (매출 상세)
  if (json.leisureProductBreakdown && Array.isArray(json.leisureProductBreakdown)) {
    json.leisureProductBreakdown.forEach(ticket => {
      const venueName = ticket.facility_name || '기타';
      const ticketName = ticket.product_name;
      const qty = Number(ticket.qty || 0);
      
      if (!monthObj.venues[venueName]) {
        monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
      }
      monthObj.venues[venueName].tickets[ticketName] = (monthObj.venues[venueName].tickets[ticketName] || 0) + qty;
    });
  }

  // 3.5 방문객 전용 매핑 (백엔드 필터 & 배수 처리 완료본)
  if (json.leisureVisitorBreakdown && Array.isArray(json.leisureVisitorBreakdown)) {
    if (!monthObj.leisureTicketUsage) {
      monthObj.leisureTicketUsage = {};
    }
    json.leisureVisitorBreakdown.forEach(v => {
      const venueName = v.facility_name || '기타';
      const qty = Number(v.visitors || v.qty || v.visitor_count || 0); // Handle 'visitors' field from V3 API
      monthObj.leisureTicketUsage[venueName] = (monthObj.leisureTicketUsage[venueName] || 0) + qty;
    });
  }

  // 4. 모토아레나 breakdown 연동
  if (!monthObj.venues['모토아레나']) {
    monthObj.venues['모토아레나'] = { totalRev: 0, tickets: {} };
  }
  
  if (json.motoArenaBreakdown) {
    monthObj.venues['모토아레나'].breakdown = {
        guest: Number(json.motoArenaBreakdown.guestRevenue || 0),
        internal: Number(json.motoArenaBreakdown.internalRevenue || 0),
        member: Number(json.motoArenaBreakdown.memberRevenue || 0),
        partnership: Number(json.motoArenaBreakdown.partnershipRevenue || 0),
        local: Number(json.motoArenaBreakdown.localRevenue || 0),
        online: Number(json.motoArenaBreakdown.onlineRevenue || 0),
        general: Number(json.motoArenaBreakdown.generalRevenue || 0)
    };
  } else {
    monthObj.venues['모토아레나'].breakdown = {
        guest: 0, internal: 0, member: 0, partnership: 0, local: 0, online: 0, general: 0
    };
  }

  return [monthObj];
}

export default function useBackendData(startDate, endDate, targetDate) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. 항상 시계열 데이터 호출 (12개월 꺾은선 차트용 전체 흐름)
        const tsUrl = `https://belleforet-data.vercel.app/api/v3/synergy/timeseries?startDate=${startDate}&endDate=${endDate}`;
        const tsRes = await fetch(tsUrl);
        if (!tsRes.ok) throw new Error('Timeseries API failed: ' + tsRes.statusText);
        const tsJson = await tsRes.json();
        
        if (tsJson.status !== 'success' || !Array.isArray(tsJson.data)) {
          throw new Error('Invalid Timeseries Data Structure');
        }
        
        let formattedData = transformTimeseriesToMonthly(tsJson.data);
        
        // 2. targetDate가 있을 경우, 대시보드(Iframe)에서 전달한 상세 요약본을 호출하여 병합
        // (파이 차트 등 상세 분석용 데이터를 선택된 월에 덮어씀)
        if (targetDate) {
          const detailUrl = `https://belleforet-data.vercel.app/api/v3/dashboard/revenue-summary?date=${targetDate}`;
          const detailRes = await fetch(detailUrl);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            const detailArray = transformPolymorphicData(detailJson);
            if (detailArray && detailArray.length > 0) {
               const detailMonthObj = detailArray[0];
               const existingIndex = formattedData.findIndex(d => d.yearMonth === detailMonthObj.yearMonth);
               if (existingIndex !== -1) {
                  // 깊은 병합(Deep Merge): 일별 배열 데이터는 유지하고 상세 요약본의 필드만 업데이트
                  const existingObj = formattedData[existingIndex];
                  formattedData[existingIndex] = {
                     ...existingObj,
                     salesByLocation: { ...existingObj.salesByLocation, ...detailMonthObj.salesByLocation },
                     venues: { ...existingObj.venues, ...detailMonthObj.venues },
                     leisureTicketUsage: { ...existingObj.leisureTicketUsage, ...detailMonthObj.leisureTicketUsage },
                     visitorData: { ...existingObj.visitorData, ...detailMonthObj.visitorData },
                     leisureVisitorBreakdown: detailMonthObj.leisureVisitorBreakdown?.length > 0 ? detailMonthObj.leisureVisitorBreakdown : existingObj.leisureVisitorBreakdown
                  };
               } else {
                  formattedData.push(detailMonthObj);
               }
            }
          }
        }

        setData(formattedData);
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
  }, [startDate, endDate, targetDate]);

  return { data, loading, error };
}
