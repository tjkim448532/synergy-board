import { useMemo } from 'react';
import { calculateGroupedSales } from '../utils/revenueUtils';

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
      const days = d.daysCount || 30;
      const daysWd = d.daysCountWeekday || 22;
      const daysWe = d.daysCountWeekend || 8;
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const sold51Acc = Number(d.sold51Acc || 0);
      
      const guests = (sold16 * 2) + (sold35 * 4) + ((sold51 + sold51Acc) * 6);
      
      const count51AsTwoRooms = settings?.count51AsTwoRooms !== false;
      const physicalRooms = Number(settings?.totalRooms) || 175;
      const rooms51Sets = Number(settings?.connectingRooms51) || 85;
      const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
      
      const totalInventory = dailyInventory * days;
      const invWd = dailyInventory * daysWd;
      const invWe = dailyInventory * daysWe;

      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51) + sold51Acc;
      const rawSoldWd = Number(d.soldWeekday || 0);
      const rawSoldWe = Number(d.soldWeekend || 0);
      const totalRawSold = rawSoldWd + rawSoldWe;
      
      let soldWd = rawSoldWd;
      let soldWe = rawSoldWe;
      
      if (totalRawSold > 0 && totalSold > 0) {
        const ratio = totalSold / totalRawSold;
        soldWd = rawSoldWd * ratio;
        soldWe = rawSoldWe * ratio;
      }

      const totalRoomRevenue = Number(d.totalRoomRevenue || 0);
      const revWd = Number(d.revWeekday || 0);
      const revWe = Number(d.revWeekend || 0);
      
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
        if (d.motoTotalRev) {
          salesObj['모토아레나(티켓)'] = Number(d.motoTotalRev);
        }

        // 새로 추가된 동적 영업장 티켓 매출 합산 (이미 leisureSalesByLocation에 있는 항목은 중복 방지)
        if (d.venues) {
          Object.entries(d.venues).forEach(([vName, vData]) => {
            if (vName !== '모토아레나' && !salesObj[vName]) { 
              salesObj[`${vName}(티켓)`] = Number(vData.totalRev || 0);
            }
          });
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
      totalOtherRevenueAll += otherSales;
      totalGolfRevenueAll += golfSales;
      totalGuestsAll += guests;
      
      total16All += sold16;
      total35All += sold35;
      total51ConnVirtualAll += (count51AsTwoRooms ? sold51 * 2 : sold51);
      total51AccVirtualAll += sold51Acc;

      return {
        ...d,
        yearMonth: d.yearMonth,
        sold16,
        sold35,
        sold51,
        sold51Acc,
        totalSold,
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
        motoGuestRev: d.motoGuestRev,
        motoGeneralRev: d.motoGeneralRev,
        motoInternalRev: d.motoInternalRev,
        motoOtherRev: d.motoOtherRev,
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
    const rooms51Sets = Number(settings?.connectingRooms51) || 85;
    const count51AsTwoRooms = settings?.count51AsTwoRooms !== false;
    const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
    
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
