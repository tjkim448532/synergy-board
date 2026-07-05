import { useMemo } from 'react';
import { calculateGroupedSales } from '../utils/revenueUtils';
import { isHoliday } from 'korean-holidays';

export default function useProcessedData(monthlyData, settings) {
  return useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) {
      return { processedData: [], globalStats: {} };
    }

    let totalSoldAll = 0;
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
          
          if (roomType.includes('16평')) {
            calculatedSold16 += count;
          } else if (roomType.includes('35평')) {
            calculatedSold35 += count;
          } else if (roomType.includes('51평')) {
            if (roomType.includes('장애') || roomType.includes('휠체어')) {
              calculatedSold51Acc += count;
            } else {
              calculatedSold51 += count;
            }
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
        
        soldWd = calculatedSoldWd;
        soldWe = calculatedSoldWe;
        
        totalRoomRevenue = calculatedRevWd + calculatedRevWe;
        revWd = calculatedRevWd;
        revWe = calculatedRevWe;
      } else {
        const totalSoldFallback = sold16 + sold35 + sold51 + sold51Acc;
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

      const totalSold = sold16 + sold35 + sold51 + sold51Acc;
      
      const physicalRooms = Number(settings?.totalRooms) || 175;
      const dailyInventory = physicalRooms; // 백엔드 분할 정책에 따라 175 고정 분모 사용
      
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
      let leisureSales = 0;
      let motoSales = 0;
      let lRevWd = 0;
      let lRevWe = 0;
      let mRevWd = 0;
      let mRevWe = 0;
      let fnbSales = 0;
      let otherSales = 0;
      let golfSales = 0;
      let dynamicGroups = {};
      let fRevWd = 0;
      let fRevWe = 0;

      if (d.salesByLocation || d.leisureSalesByLocation || d.venues) {
        const salesObj = { ...(d.salesByLocation || d.leisureSalesByLocation || {}) };
        
        // 기존 버그 수정: 부대업장 엑셀을 올리면 기존에 올려둔 모토아레나 매출이 0으로 무시되던 현상 해결
        if (d.motoTotalRev && !salesObj['모토아레나']) {
          salesObj['모토아레나(티켓)'] = Number(d.motoTotalRev);
        }

        const calculated = calculateGroupedSales(salesObj, locationGroups);
        leisureSales = calculated.leisure;
        motoSales = calculated.moto || 0;
        fnbSales = calculated.fnb;
        otherSales = calculated.other || 0;
        golfSales = calculated.golf || 0;
        dynamicGroups = calculated.dynamicGroups || {};
        
        const wdObj = d.salesWdByLocation || {};
        const weObj = d.salesWeByLocation || {};
        const calcWd = calculateGroupedSales(wdObj, locationGroups);
        const calcWe = calculateGroupedSales(weObj, locationGroups);
        
        lRevWd = calcWd.leisure;
        lRevWe = calcWe.leisure;
        fRevWd = calcWd.fnb;
        fRevWe = calcWe.fnb;
        
        mRevWd = calcWd.moto || 0;
        mRevWe = calcWe.moto || 0;
      } else {
        // Fallback for legacy DB
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
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;
      const occWd = invWd > 0 ? (soldWd / invWd) * 100 : 0;
      const occWe = invWe > 0 ? (soldWe / invWe) * 100 : 0;
      const dynamicGroupsSum = Object.values(dynamicGroups).reduce((sum, val) => sum + val, 0);
      const totalSales = leisureSales + motoSales + fnbSales + otherSales + dynamicGroupsSum; // Total without Room/Golf

      totalSoldAll += totalSold;
      totalInventoryAll += totalInventory;
      totalSoldWdAll += soldWd;
      totalInvWdAll += invWd;
      totalSoldWeAll += soldWe;
      totalInvWeAll += invWe;
      totalRoomRevenueAll += totalRoomRevenue;
      totalLeisureRevenueAll += leisureSales;
      totalMotoRevenueAll += motoSales;
      totalFnbRevenueAll += fnbSales;
      totalOtherRevenueAll += otherSales + dynamicGroupsSum;
      totalGolfRevenueAll += golfSales;
      totalGuestsAll += guests;
      
      total16All += sold16;
      total35All += sold35;
      total51ConnVirtualAll += sold51;
      total51AccVirtualAll += sold51Acc;

      let calcMotoGuest = 0;
      let calcMotoGeneral = 0;
      let calcMotoInternal = 0;
      let calcMotoOther = 0;
      
      if (d.venues && d.venues['모토아레나'] && d.venues['모토아레나'].breakdown) {
        const breakdown = d.venues['모토아레나'].breakdown;
        calcMotoGuest = Object.values(breakdown.guest || {}).reduce((sum, v) => sum + Number(v || 0), 0);
        calcMotoGeneral = Object.values(breakdown.general || {}).reduce((sum, v) => sum + Number(v || 0), 0);
        calcMotoInternal = Object.values(breakdown.internal || {}).reduce((sum, v) => sum + Number(v || 0), 0);
        calcMotoOther = Object.values(breakdown.other || {}).reduce((sum, v) => sum + Number(v || 0), 0);
      } else if (d.venues && d.venues['모토아레나'] && d.venues['모토아레나'].tickets) {
        Object.entries(d.venues['모토아레나'].tickets).forEach(([ticket, amt]) => {
          let group = 'other';
          if (settings?.motoTicketGroups?.[ticket]) {
            group = settings.motoTicketGroups[ticket];
          } else {
            if (ticket.includes('콘도') || ticket.includes('객실') || ticket.includes('패키지')) {
              group = 'guest';
            }
          }
          const val = Number(amt) || 0;
          if (group === 'guest') calcMotoGuest += val;
          else if (group === 'general') calcMotoGeneral += val;
          else if (group === 'internal') calcMotoInternal += val;
          else calcMotoOther += val;
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
        totalSold,
        guests,
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

    const globalOccRate = totalInventoryAll > 0 ? (totalSoldAll / totalInventoryAll) * 100 : 0;
    const globalWdOccRate = totalInvWdAll > 0 ? (totalSoldWdAll / totalInvWdAll) * 100 : 0;
    const globalWeOccRate = totalInvWeAll > 0 ? (totalSoldWeAll / totalInvWeAll) * 100 : 0;
    const avgGuestsPerSoldRoom = totalSoldAll > 0 ? totalGuestsAll / totalSoldAll : 0;
    
    const physicalRooms = Number(settings?.totalRooms) || 175;
    const dailyInventory = physicalRooms;
    
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
