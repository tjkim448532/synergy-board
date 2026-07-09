import { useMemo } from 'react';
import { calculateGroupedSales } from '../utils/revenueUtils';
import { isHoliday } from 'korean-holidays';

export default function useProcessedData(monthlyData, settings) {
  return useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) {
      return { processedData: [], globalStats: {} };
    }

    let totalSoldAll = 0;
    let totalSoldForOccAll = 0;
    let totalInventoryAll = 0;
    let totalSoldWdAll = 0;
    let totalSoldWeAll = 0;
    let totalInvWdAll = 0;
    let totalInvWeAll = 0;
    let totalRoomRevenueAll = 0;
    let totalLeisureRevenueAll = 0;
    let totalMotoRevenueAll = 0;
    let totalFnbRevenueAll = 0;
    let totalOtherRevenueAll = 0;
    let totalGolfRevenueAll = 0;
    let totalGuestsAll = 0;
    
    let total16All = 0;
    let total35All = 0;
    let total51ConnVirtualAll = 0;
    let total51AccVirtualAll = 0;

    const data = [...monthlyData].sort((a, b) => (a.id || a.yearMonth || '').localeCompare(b.id || b.yearMonth || '')).map(d => {
      let days = d.daysCount || 30;
      let daysWd = d.daysCountWeekday || 22;
      let daysWe = d.daysCountWeekend || 8;
      
      let sold16 = Number(d.sold16 || d.standardSold || 0);
      let sold35 = Number(d.sold35 || 0);
      let sold51 = Number(d.sold51 || d.connectingSold || 0);
      let sold51Acc = Number(d.sold51Acc || 0);
      
      let totalRoomRevenue = Number(d.totalRoomRevenue || 0);
      let revWd = Number(d.revWeekday || 0);
      let revWe = Number(d.revWeekend || 0);

      let soldWd = 0;
      let soldWe = 0;
      
      let soldOther = 0;
      let rev16Net = 0;
      let rev35Net = 0;
      let rev51Net = 0;
      let revOtherNet = 0;
      let guests16 = 0;
      let guests35 = 0;
      let guests51 = 0;
      let guestsOther = 0;

      if (d.rawRoomRecords && Array.isArray(d.rawRoomRecords)) {
        const customWeekends = settings?.customWeekends || [];
        const customWeekendsArray = Array.isArray(customWeekends)
          ? customWeekends
          : typeof customWeekends === 'string'
            ? customWeekends.split(',').map(s => s.trim()).filter(s => s)
            : [];
            
        let calculatedSold16 = 0;
        let calculatedSold35 = 0;
        let calculatedSold51 = 0;
        let calculatedSold51Acc = 0;
        let calculatedSoldOther = 0;
        
        let calculatedRevWd = 0;
        let calculatedRevWe = 0;
        let calculatedSoldWd = 0;
        let calculatedSoldWe = 0;
        
        const uniqueDates = new Set();
        const uniqueWeekdayDates = new Set();
        const uniqueWeekendDates = new Set();
        
        d.rawRoomRecords.forEach(rec => {
          const recDate = rec.date;
          if (!recDate) return;
          
          const [yyyy, mm, dd] = recDate.split('-');
          const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
          const day = dateObj.getDay();
          const nextDay = new Date(dateObj);
          nextDay.setDate(dateObj.getDate() + 1);
          
          const isFriOrSat = (day === 5 || day === 6);
          const isNextDayHoliday = isHoliday(nextDay);
          
          const isWeekend = customWeekendsArray.includes(recDate) || isFriOrSat || isNextDayHoliday;
          
          uniqueDates.add(recDate);
          if (isWeekend) {
            uniqueWeekendDates.add(recDate);
          } else {
            uniqueWeekdayDates.add(recDate);
          }
          
          const roomType = rec.roomType || '';
          const count = Number(rec.count || 0);
          const revenue = Number(rec.revenue || 0);
          const roomGuests = Number(rec.guests || 0);

          // [중복 방지] V5 파이프라인에서 marketBreakdown(세부채널)과 typeBreakdown(TOTAL)이 
          // 동일한 rawRoomRecords에 푸시되므로, 전체 집계 시에는 TOTAL 레코드만 합산합니다.
          if (rec.marketType !== 'TOTAL') return;
          
          if (roomType.includes('16평')) {
            calculatedSold16 += count;
            rev16Net += revenue;
            guests16 += roomGuests;
          } else if (roomType.includes('35평')) {
            calculatedSold35 += count;
            rev35Net += revenue;
            guests35 += roomGuests;
          } else if (roomType.includes('51평')) {
            rev51Net += revenue;
            guests51 += roomGuests;
            if (roomType.includes('장애') || roomType.includes('휠체어')) {
              calculatedSold51Acc += count;
            } else {
              calculatedSold51 += count;
            }
          } else {
            // 미매핑 신규 평형 흡수
            calculatedSoldOther += count;
            revOtherNet += revenue;
            guestsOther += roomGuests;
          }
          
          if (isWeekend) {
            calculatedSoldWe += count;
            calculatedRevWe += revenue;
          } else {
            calculatedSoldWd += count;
            calculatedRevWd += revenue;
          }
        });
        
        days = uniqueDates.size || days;
        daysWd = uniqueWeekdayDates.size || daysWd;
        daysWe = uniqueWeekendDates.size || daysWe;
        
        sold16 = calculatedSold16;
        sold35 = calculatedSold35;
        sold51 = calculatedSold51;
        sold51Acc = calculatedSold51Acc;
        soldOther = calculatedSoldOther;
        
        soldWd = calculatedSoldWd;
        soldWe = calculatedSoldWe;
        
        // [V5 패치] 백엔드 제공 Summary를 단일 진실 공급원(SSOT)으로 최우선 적용
        totalRoomRevenue = d.v5Summary?.room?.mtd_actual ?? (calculatedRevWd + calculatedRevWe);
        revWd = calculatedRevWd;
        revWe = calculatedRevWe;
      } else {
        const totalSoldFallback = sold16 + sold35 + sold51 + sold51Acc + (typeof soldOther !== 'undefined' ? soldOther : 0);
        // [장애 방어] rawRoomRecords 배열 누락 시 최상위 값 Fallback
        if (totalSoldFallback === 0 && d.roomsSold > 0) {
          soldOther = Number(d.roomsSold || 0);
          revOtherNet = Number(d.total_net || d.roomRevenue || 0);
        }
        const rawSoldWd = Number(d.soldWeekday || 0);
        const rawSoldWe = Number(d.soldWeekend || 0);
        const totalRawSold = rawSoldWd + rawSoldWe;
        
        soldWd = rawSoldWd;
        soldWe = rawSoldWe;
        
        if (totalRawSold > 0 && totalSoldFallback > 0) {
          const ratio = totalSoldFallback / totalRawSold;
          soldWd = rawSoldWd * ratio;
          soldWe = rawSoldWe * ratio;
        }
      }

      const totalBookings = sold16 + sold35 + sold51 + sold51Acc + (typeof soldOther !== 'undefined' ? soldOther : 0);
      const totalPhysicalKeys = sold16 + sold35 + sold51 + sold51Acc + (typeof soldOther !== 'undefined' ? soldOther : 0);
      const totalSold = totalBookings; // Legacy 호환성
      const totalSoldForOcc = totalPhysicalKeys;
      
      // [사각지대 방어] soldOther가 발생했음에도 기본값 180을 쓰면 가동률이 100%를 초과함
      // 백엔드가 capacity.total을 명시하지 않은 경우 soldOther 만큼 동적으로 수용량을 늘려줍니다.
      let globalCapacity = d.capacity?.total || 180;
      if (!d.capacity?.total && (typeof soldOther !== 'undefined' && soldOther > 0)) {
        globalCapacity += soldOther;
      }
      const cap16 = d.capacity?.['16평'] || 90;
      const cap35 = d.capacity?.['35평'] || 90;
      const dailyInventory = globalCapacity;
      
      const totalInventory = dailyInventory * days;
      const invWd = dailyInventory * daysWd;
      const invWe = dailyInventory * daysWe;
      
      // 구버전 DB(d.guests) 및 V3 신버전(leisureVisitorBreakdown) 모두 호환되도록 투숙객 수 안전 추출
      let guests = Number(d.guests || d.totalGuests || 0);
      if (guests === 0 && d.leisureVisitorBreakdown && Array.isArray(d.leisureVisitorBreakdown)) {
        const roomStat = d.leisureVisitorBreakdown.find(v => (v.venue || v.facility_name) === '객실');
        if (roomStat) guests = Number(roomStat.visitors || roomStat.qty || 0);
      }
      
      const locationGroups = settings?.locationGroups || {};
      let leisureSales = 0, motoSales = 0, fnbSales = 0, otherSales = 0, golfSales = 0, dynamicGroups = {};
      let lRevWd = null, lRevWe = null, mRevWd = null, mRevWe = null, fRevWd = null, fRevWe = null;

      if (d.salesByLocation) {
        const salesObj = d.salesByLocation;
        const calculated = calculateGroupedSales(salesObj, locationGroups, d.venueCategories);
        
        // [V5 패치] 백엔드 제공 Summary를 단일 진실 공급원(SSOT)으로 최우선 적용
        leisureSales = d.v5Summary?.ticket?.mtd_actual ?? calculated.leisure;
        fnbSales = d.v5Summary?.fnb?.mtd_actual ?? calculated.fnb;
        golfSales = d.v5Summary?.golf?.mtd_actual ?? calculated.golf;
        otherSales = calculated.other;
        motoSales = calculated.moto;
        dynamicGroups = calculated.dynamicGroups || {};
        
        const calcWd = calculateGroupedSales(d.salesWdByLocation || {}, locationGroups, d.venueCategories);
        const calcWe = calculateGroupedSales(d.salesWeByLocation || {}, locationGroups, d.venueCategories);
        lRevWd = calcWd.leisure; lRevWe = calcWe.leisure;
        fRevWd = calcWd.fnb; fRevWe = calcWe.fnb;
        mRevWd = calcWd.moto || 0; mRevWe = calcWe.moto || 0;
      } else {
        leisureSales = Number(d.leisureSales || d.totalLeisureSales || 0);
        motoSales = Number(d.motoSales || d.motoTotalRev || d.totalMotoSales || 0);
        fnbSales = Number(d.fnbSales || d.totalFnbSales || 0);
        otherSales = Number(d.otherSales || 0);
        golfSales = Number(d.golfSales || 0);
        lRevWd = d.leisureRevWd !== undefined ? Number(d.leisureRevWd) : null;
        lRevWe = d.leisureRevWe !== undefined ? Number(d.leisureRevWe) : null;
        mRevWd = d.motoRevWd !== undefined ? Number(d.motoRevWd) : null;
        mRevWe = d.motoRevWe !== undefined ? Number(d.motoRevWe) : null;
        fRevWd = d.fnbRevWd !== undefined ? Number(d.fnbRevWd) : null;
        fRevWe = d.fnbRevWe !== undefined ? Number(d.fnbRevWe) : null;
      }
      
      const occRate = dailyInventory > 0 ? (totalSoldForOcc / dailyInventory) * 100 : 0;
      const occWd = invWd > 0 ? (soldWd / invWd) * 100 : 0;
      const occWe = invWe > 0 ? (soldWe / invWe) * 100 : 0;
      
      const occ16 = cap16 > 0 ? ((sold16 + ((sold51 + sold51Acc) / 2)) / cap16) * 100 : 0;
      const occ35 = cap35 > 0 ? ((sold35 + ((sold51 + sold51Acc) / 2)) / cap35) * 100 : 0;
      
      // 51평 실제 결제 건수 (백엔드에서 방 갯수인 2로 내려오므로 반으로 나눔)
      const bookings51 = (sold51 + sold51Acc) / 2;
      
      // 51평 ADR 및 투숙객 통짜(1건) 기준 확립
      const adr16 = sold16 > 0 ? (rev16Net / sold16) : 0;
      const adr35 = sold35 > 0 ? (rev35Net / sold35) : 0;
      const adr51 = bookings51 > 0 ? (rev51Net / bookings51) : 0;
      
      // 개별 평형별 직관적 평균 투숙 인원 (가중치 없음)
      const avgGuests16 = sold16 > 0 ? (guests16 / sold16) : 0;
      const avgGuests35 = sold35 > 0 ? (guests35 / sold35) : 0;
      const avgGuests51 = bookings51 > 0 ? (guests51 / bookings51) : 0;

      const dynamicGroupsSum = Object.values(dynamicGroups).reduce((sum, val) => sum + val, 0);
      const totalSales = leisureSales + motoSales + fnbSales + otherSales + dynamicGroupsSum;

      totalSoldAll += totalSold;
      totalSoldForOccAll += totalSoldForOcc;
      totalInventoryAll += dailyInventory;
      totalSoldWdAll += soldWd;
      totalInvWdAll += invWd;
      totalSoldWeAll += soldWe;
      totalInvWeAll += invWe;
      // [V5 Rule 2] 상태 누적 합산 금지 (단일 진실 공급원 스냅샷 덮어쓰기 적용)
      totalRoomRevenueAll = d.v5Summary?.room?.ytd_actual ?? (totalRoomRevenueAll + totalRoomRevenue);
      totalLeisureRevenueAll = d.v5Summary?.ticket?.ytd_actual ?? (totalLeisureRevenueAll + leisureSales);
      totalMotoRevenueAll += motoSales; // V5 API 스펙 미정의 시 기존 fallback 유지
      totalFnbRevenueAll = d.v5Summary?.fnb?.ytd_actual ?? (totalFnbRevenueAll + fnbSales);
      totalOtherRevenueAll += otherSales + dynamicGroupsSum; // V5 API 스펙 미정의 시 기존 fallback 유지
      totalGolfRevenueAll = d.v5Summary?.golf?.ytd_actual ?? (totalGolfRevenueAll + golfSales);
      totalGuestsAll += guests;
      
      total16All += sold16;
      total35All += sold35;
      // [V5 Rule 1] 임의 수학 연산(Math Hack) 전면 금지: 백엔드 수량 그대로 렌더링
      total51ConnVirtualAll += sold51; 
      total51AccVirtualAll += sold51Acc;

      let calcMotoGuest = 0;
      let calcMotoGeneral = 0;
      let calcMotoInternal = 0;
      let calcMotoOther = 0;
      
      if (d.venues && d.venues['모토아레나'] && d.venues['모토아레나'].breakdown) {
        const breakdown = d.venues['모토아레나'].breakdown;
        const parseValue = (val) => typeof val === 'number' ? val : Object.values(val || {}).reduce((sum, v) => sum + Number(v || 0), 0);
        
        calcMotoGuest = parseValue(breakdown.guest);
        calcMotoGeneral = parseValue(breakdown.general);
        calcMotoInternal = parseValue(breakdown.internal);
        calcMotoOther = parseValue(breakdown.other);
      } else if (d.venues && d.venues['모토아레나'] && d.venues['모토아레나'].tickets) {
        // [V5 Rule 3] 문자열 검색 완전 제거 (O(1) Dictionary fallback)
        Object.entries(d.venues['모토아레나'].tickets).forEach(([ticket, amt]) => {
          let group = 'other';
          if (settings?.motoTicketGroups?.[ticket]) {
            group = settings.motoTicketGroups[ticket];
          } else {
            // "콘도", "객실" 등을 포함하는지 검사하던 레거시 `.includes()` 제거
            // O(1) Dictionary 매핑
            const fallbackMap = { '콘도': 'guest', '객실': 'guest', '패키지': 'guest' };
            group = fallbackMap[ticket] || 'other';
          }
          const val = Number(amt) || 0;
          if (group === 'guest') calcMotoGuest = val; // Rule 2: 덮어쓰기
          else if (group === 'general') calcMotoGeneral = val; // Rule 2: 덮어쓰기
          else if (group === 'internal') calcMotoInternal = val; // Rule 2: 덮어쓰기
          else calcMotoOther = val; // Rule 2: 덮어쓰기
        });
      } else {
        calcMotoGuest = d.motoGuestRev || 0;
        calcMotoGeneral = d.motoGeneralRev || 0;
        calcMotoInternal = d.motoInternalRev || 0;
        calcMotoOther = d.motoOtherRev || 0;
      }

      let calcLeisureTicketUsage = {};
      if (d.leisureTicketUsage) {
        // 백엔드에서 제공된 방문객 데이터를 그대로 사용합니다.
        calcLeisureTicketUsage = d.leisureTicketUsage;
      }

      return {
        ...d,
        yearMonth: d.yearMonth,
        sold16,
        sold35,
        sold51,
        sold51Acc,
        bookings51,
        totalSold,
        guests,
        revenue16: rev16Net,
        revenue35: rev35Net,
        revenue51: rev51Net,
        revenueOther: revOtherNet,
        occ16,
        occ35,
        adr16,
        adr35,
        adr51,
        avgGuests16,
        avgGuests35,
        avgGuests51,
        guests16,
        guests35,
        guests51,
        guestsOther,
        soldOther,
        totalInventory,
        occupancyRate: occRate,
        occWd,
        occWe,
        totalRoomRevenue,
        revWd,
        revWe,
        leisureSales,
        motoSales,
        fnbSales,
        ...Object.keys(dynamicGroups).reduce((acc, group) => ({ ...acc, [`${group}Sales`]: dynamicGroups[group] }), {}),
        otherSales,
        golfSales,
        totalSales,
        leisureTicketUsage: calcLeisureTicketUsage,
        motoGuestRev: calcMotoGuest,
        motoGeneralRev: calcMotoGeneral,
        motoInternalRev: calcMotoInternal,
        motoOtherRev: calcMotoOther,
        motoTotalRev: d.motoTotalRev,
        lRevWd,
        lRevWe,
        mRevWd,
        mRevWe,
        fRevWd,
        fRevWe
      };
    });

    const globalOccRate = totalInventoryAll > 0 ? (totalSoldForOccAll / totalInventoryAll) * 100 : 0;
    const globalWdOccRate = totalInvWdAll > 0 ? (totalSoldWdAll / totalInvWdAll) * 100 : 0; // Note: soldWd/We internally uses totalSoldForOcc
    const globalWeOccRate = totalInvWeAll > 0 ? (totalSoldWeAll / totalInvWeAll) * 100 : 0;
    const avgGuestsPerSoldRoom = totalSoldForOccAll > 0 ? totalGuestsAll / totalSoldForOccAll : 0;
    
    // Dynamic fallback instead of 175
    const dailyInventory = monthlyData[0]?.capacity?.total || 180;
    
    const avgWdDays = 22;
    const avgWeDays = 8;
    
    const sumVirtualRooms = total16All + total35All + total51ConnVirtualAll + total51AccVirtualAll;
    const mix16Virtual = sumVirtualRooms > 0 ? total16All / sumVirtualRooms : 0;
    const mix35Virtual = sumVirtualRooms > 0 ? total35All / sumVirtualRooms : 0;
    const mix51ConnVirtual = sumVirtualRooms > 0 ? total51ConnVirtualAll / sumVirtualRooms : 0;
    const mix51AccVirtual = sumVirtualRooms > 0 ? total51AccVirtualAll / sumVirtualRooms : 0;

    return { 
      processedData: data, 
      globalStats: {
        totalOccupancyRate: globalOccRate,
        globalWdOccRate,
        globalWeOccRate,
        totalRoomRevenue: totalRoomRevenueAll,
        totalLeisureRevenue: totalLeisureRevenueAll,
        totalMotoRevenue: totalMotoRevenueAll,
        totalFnbRevenue: totalFnbRevenueAll,
        totalOtherRevenue: totalOtherRevenueAll,
        totalGolfRevenue: totalGolfRevenueAll,
        avgGuestsPerSoldRoom,
        dailyInventory,
        avgWdDays,
        avgWeDays,
        mix16Virtual,
        mix35Virtual,
        mix51ConnVirtual,
        mix51AccVirtual
      }
    };
  }, [monthlyData, settings]);
}
