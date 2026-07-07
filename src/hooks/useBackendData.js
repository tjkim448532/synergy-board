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
      // API 가이드: 부대 매출은 gross 우선 추출 (부가세 포함 통일)
      const netRevenue = typeof revenue === 'object' && revenue !== null 
        ? Number(revenue.gross ?? revenue.total_gross ?? revenue.total_net ?? revenue.revenue ?? 0) 
        : Number(revenue ?? 0);

      monthObj.salesByLocation[venueName] = (monthObj.salesByLocation[venueName] || 0) + netRevenue;
      
      if (!monthObj.venues[venueName]) {
        monthObj.venues[venueName] = { totalRev: 0, tickets: {} };
      }
      monthObj.venues[venueName].totalRev += netRevenue;
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

    // [Capacity & Total Net Rule]
    if (!monthObj.capacity) {
      // API 응답의 capacity 객체를 최우선, 없으면 metadata.total_capacity 사용, 모두 없으면 가이드에 따라 기본값(16평:90, 35평:90)
      monthObj.capacity = dayData.capacity || jsonArray[0]?.capacity || {
        total: jsonArray[0]?.metadata?.total_capacity || 180,
        '16평': 90,
        '35평': 90,
        '51평': 0
      };
    }

    const roomsSold = Number(dayData.visitorData?.roomsSold || dayData.roomsSold || 0);
    // 가이드: gross(부가세 포함) 최우선 사용 (Net 기반 연산들도 모두 Gross 기반으로 상향 통일됨)
    const roomRev = Number(dayData.gross ?? dayData.total_gross ?? dayData.total_net ?? dayData.revenues?.total_gross ?? dayData.revenues?.total_net ?? dayData.revenues?.room ?? dayData.roomRevenue ?? 0);
    
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
          guests: Number(room.guests || (Number(room.adults || 0) + Number(room.children || 0)) || 0),
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

    // [V4 API] Rebuild rawMarketRecords by aggregating rooms array
    if (!monthObj.rawMarketRecords) monthObj.rawMarketRecords = [];
    const roomsForMarket = dayData.rooms || dayData.roomTypeBreakdown || [];
    if (roomsForMarket && Array.isArray(roomsForMarket) && roomsForMarket.length > 0) {
      const marketAggMap = {};
      roomsForMarket.forEach(m => {
        const mType = m.market_type || m.marketType || 'TOTAL';
        if (!marketAggMap[mType]) {
          marketAggMap[mType] = { count: 0, revenue: 0, visitors: 0 };
        }
        marketAggMap[mType].count += Number(m.rooms_sold || m.roomsSold || 0);
        marketAggMap[mType].revenue += Number(m.room_revenue || m.roomRevenue || m.revenue || 0);
        marketAggMap[mType].visitors += Number(m.visitors || m.guests || 0);
      });
      
      Object.keys(marketAggMap).forEach(mType => {
        monthObj.rawMarketRecords.push({
          date: dayData.date,
          marketType: mType,
          count: marketAggMap[mType].count,
          revenue: marketAggMap[mType].revenue,
          visitors: marketAggMap[mType].visitors
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
          // [Double Counting 방지] 객실 매출은 rawRoomRecords에서 이미 처리하므로 부대시설(Leisure)에서는 제외합니다.
          if (venueName === 'ROOM' || venueName === 'ROOM OTHER' || venueName === '객실' || venueName === '그린피' || venueName === '골프장') {
             return;
          }
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
      if (totalRev > 0 || dayData.motoArenaDetails) {
        monthObj.rawLeisureRecords.push({
          date: dayData.date,
          revenue: totalRev,
          breakdown: breakdown,
          motoDetails: dayData.motoArenaDetails || null // 일별 상관관계 분석을 위해 탑승
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
    venueCategories: {},
    venues: {},
    visitorData: {
      totalVehicles: json.visitorData?.totalVehicles || null,
      employeeVehicles: json.visitorData?.employeeVehicles || null,
      golfGuests: json.visitorData?.golfGuests || null
    },
    leisureVisitorBreakdown: json.leisureVisitorBreakdown || []
  };

  const w = json.weather || {};

  // 1. V3 정규화 스펙 제네릭 파싱 파이프라인
  let totalRoomsSold = 0;
  monthObj.rawMarketRecords = [];
  if (!monthObj.leisureTicketUsage) monthObj.leisureTicketUsage = {};

  // JSON 내의 모든 배열을 순회하며 category_code 기반으로 자동 라우팅
  Object.values(json).forEach(arr => {
    if (!Array.isArray(arr)) return;
    
    arr.forEach(item => {
      const cat = item.category_code;
      if (!cat) {
        // V2 Market/Segment Fallback (category_code가 없는 마켓 세그먼트 배열용)
        if (item.market_type || item.segment) {
          monthObj.rawMarketRecords.push({
            date: targetDate,
            marketType: item.market_type || item.segment || item.shop_name,
            count: Number(item.rooms_sold || item.qty || 0),
            revenue: Number(item.today_actual || item.room_revenue || 0),
            visitors: Number(item.visitors || item.guests || 0)
          });
        }
        return;
      }

      const shopName = item.shop_name || '기타';
      const todayActual = Number(item.today_actual || 0);
      // V4 수량(Quantity) 단일화 (레거시 방어 코드 제거)
      const qty = Number(item.sales_qty || 0);

      // 백엔드 원본 카테고리 보존 (문자열 매칭 의존성 탈피)
      if (cat !== 'ROOM' && shopName !== '기타') {
        monthObj.venueCategories[shopName] = cat;
      }

      if (cat === 'ROOM') {
        // 객실 매출 및 판매량 매핑
        if (shopName !== '합계' && shopName !== 'TOTAL' && shopName !== 'KPI') {
          totalRoomsSold += qty;
          monthObj.rawRoomRecords.push({
            date: targetDate,
            roomType: shopName,
            marketType: 'TOTAL', 
            count: qty,
            revenue: todayActual,
            weatherTempMax: Number(w.tempMax || 0),
            weatherTempMin: Number(w.tempMin || 0),
            weatherPrecipitation: Number(w.precipitation || 0),
            weatherDaytimePrecip: 0, 
            weatherNighttimePrecip: 0,
            weatherWindSpeed: Number(w.windSpeed || 0),
            weatherCode: Number(w.code || 0),
            weatherDesc: w.weatherDesc || '정보없음'
          });
        }
      } else if (['FNB', 'TICKET', 'GOLF', 'BANQUET', 'OTHER', 'MOTO'].includes(cat)) {
        // 부대 매출 누적 (MOTO 독립 카테고리 포함)
        if (todayActual !== 0) {
          monthObj.salesByLocation[shopName] = (monthObj.salesByLocation[shopName] || 0) + todayActual;
          if (!monthObj.venues[shopName]) monthObj.venues[shopName] = { totalRev: 0, tickets: {} };
          monthObj.venues[shopName].totalRev += todayActual;
        // 방문객 및 티켓 수량 누적
        if (qty !== 0) {
          monthObj.leisureTicketUsage[shopName] = (monthObj.leisureTicketUsage[shopName] || 0) + qty;
          if (!monthObj.venues[shopName]) {
            monthObj.venues[shopName] = { totalRev: 0, tickets: {} };
          }
          // V4 상품명(product_name) 필수화 보장 (F&B 등 없는 경우에만 업장명 보존)
          const ticketName = item.product_name || shopName;
          monthObj.venues[shopName].tickets[ticketName] = (monthObj.venues[shopName].tickets[ticketName] || 0) + qty;
        }

        // V4 모토아레나 세부 고객 유형 세그먼트 매핑
        if (cat === 'MOTO' && item.segment_type) {
          if (!monthObj.venues['모토아레나']) {
            monthObj.venues['모토아레나'] = { totalRev: 0, tickets: {}, breakdown: {
              guest: 0, internal: 0, member: 0, partnership: 0, local: 0, online: 0, general: 0
            }};
          }
          if (!monthObj.venues['모토아레나'].breakdown) {
            monthObj.venues['모토아레나'].breakdown = { guest: 0, internal: 0, member: 0, partnership: 0, local: 0, online: 0, general: 0 };
          }
          const segKey = item.segment_type.toLowerCase();
          monthObj.venues['모토아레나'].breakdown[segKey] += todayActual;
        }
      }
    });
  });

  monthObj.roomsSold = totalRoomsSold;

  // 구형 json.motoArenaBreakdown 맵핑 블록 전면 폐기 (V4 배열 스펙으로 대체됨)
  if (!monthObj.venues['모토아레나']) {
    monthObj.venues['모토아레나'] = { totalRev: 0, tickets: {}, breakdown: { guest: 0, internal: 0, member: 0, partnership: 0, local: 0, online: 0, general: 0 }};
  } else if (!monthObj.venues['모토아레나'].breakdown) {
    monthObj.venues['모토아레나'].breakdown = { guest: 0, internal: 0, member: 0, partnership: 0, local: 0, online: 0, general: 0 };
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
