import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, PieChart, Pie, Cell
} from 'recharts';
import CountUpModule from 'react-countup';
const CountUp = CountUpModule.default || CountUpModule;
import { isHoliday } from 'korean-holidays';

// ?¼ì–´???ê?ê³„ìˆ˜ ê³„ì‚° ?¨ìˆ˜
function calculateCorrelation(xArray, yArray) {
  if (xArray.length !== yArray.length || xArray.length < 2) return null;
  const n = xArray.length;
  // ë§¤ì¶œ ?œê³± ???ë°”?¤í¬ë¦½íŠ¸ ìµœë? ?•ìˆ˜ ?œê³„(9000ì¡? ì´ˆê³¼ë¥?ë§‰ê¸° ?„í•´ 1ë§Œì› ?¨ìœ„ë¡??¤ì??¼ë§
  const normX = xArray.map(v => v / 10000);
  const normY = yArray.map(v => v / 10000);

  const sumX = normX.reduce((a, b) => a + b, 0);
  const sumY = normY.reduce((a, b) => a + b, 0);
  const sumX2 = normX.reduce((a, b) => a + (b * b), 0);
  const sumY2 = normY.reduce((a, b) => a + (b * b), 0);
  const sumXY = normX.reduce((acc, val, i) => acc + (val * normY[i]), 0);

  const numerator = (n * sumXY) - (sumX * sumY);
  const denomInside = (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY);
  if (denomInside <= 0) return 0;
  const denominator = Math.sqrt(denomInside);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function AdvancedAnalytics({ monthlyData, settings }) {
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [activeDivision, setActiveDivision] = useState('all');
  const [motoLogic, setMotoLogic] = useState('current');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  const [googleVisitorsData, setGoogleVisitorsData] = useState({ total: null, months: {} });

  useEffect(() => {
    const fetchGoogleData = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/1wlNrE_FvXCYNGfyvIYxEidYLKoEas4pidWe0Z9e_2xs/export?format=csv&gid=1933764837');
        const text = await response.text();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.includes('ë¦¬ì¡°??ì´?ë°©ë¬¸ê°?) || line.includes('?ˆì?ë³¸ë? ë°©ë¬¸ê°?)) {
            let current = '';
            let inQuotes = false;
            const result = [];
            for (let i = 0; i < line.length; i++) {
              if (line[i] === '"') {
                inQuotes = !inQuotes;
              } else if (line[i] === ',' && !inQuotes) {
                result.push(current);
                current = '';
              } else {
                current += line[i];
              }
            }
            result.push(current);
            if (result.length >= 4) {
              const cleanStr = (str) => str ? Number(str.replace(/[^0-9]/g, '')) : 0;
              setGoogleVisitorsData({
                total: cleanStr(result[3]),
                months: {
                  '01': cleanStr(result[6]),
                  '02': cleanStr(result[9]),
                  '03': cleanStr(result[12]),
                  '04': cleanStr(result[15]),
                  '05': cleanStr(result[18]),
                  '06': cleanStr(result[21]),
                  '07': cleanStr(result[24]),
                  '08': cleanStr(result[27]),
                  '09': cleanStr(result[30]),
                  '10': cleanStr(result[33]),
                  '11': cleanStr(result[36]),
                  '12': cleanStr(result[39])
                }
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error("Failed to fetch google sheets data", err);
      }
    };
    fetchGoogleData();
  }, []);

  const displayVisitors = useMemo(() => {
    if (googleVisitorsData.total === null) return null;
    if (selectedMonthFilter === 'all') return googleVisitorsData.total;
    return googleVisitorsData.months[selectedMonthFilter] || 0;
  }, [googleVisitorsData, selectedMonthFilter]);



  const divisionConfig = {
    all: { title: '?„ì²´?µí•©', dataKey: 'totalSales', color: 'var(--accent-emerald)' },
    leisure: { title: '?ˆì?ë³¸ë?', dataKey: 'leisureSales', color: 'var(--accent-purple)' },
    fnb: { title: '?ìŒë³¸ë?', dataKey: 'fnbSales', color: 'var(--accent-blue)' },
    moto: { title: 'ëª¨í† ?„ë ˆ??, dataKey: 'motoSales', color: 'var(--accent-gold)' }
  };
  const activeConf = divisionConfig[activeDivision];

  // ?°ì´??ê°€ê³?
  const processedData = useMemo(() => {
    // ?¤ë˜???œìœ¼ë¡??•ë ¬ (ê·¸ë˜?„ìš©)
    const sorted = [...monthlyData].sort((a, b) => (a.yearMonth || '').localeCompare(b.yearMonth || ''));
    
    return sorted.map(d => {
      // ?ì—…?¼ìˆ˜ fallback
      const days = d.daysCount || 30; 
      
      // 51???°ì • ë°©ì‹ ?¤ì • ë°˜ì˜
      const count51AsTwoRooms = settings.count51AsTwoRooms !== false; // ê¸°ë³¸ê°?true
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const sold51Acc = Number(d.sold51Acc || 0);
      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51) + sold51Acc;
      
      // ì´?ê°ì‹¤ ëª¨ìˆ˜ ê³„ì‚° (ê³ ì •ê°?
      const physicalRooms = Number(settings.totalRooms) || 175;
      const rooms51Sets = Number(settings.connectingRooms51) || 85;
      const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
      const totalInventory = dailyInventory * days;
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;

      // ?™ì  ë§¤ì¶œ ?©ì‚° ë¡œì§
      const locationGroups = settings.locationGroups || {};
      let leisureSales = 0;
      let motoSales = 0;
      let fnbSales = 0;

      if (d.salesByLocation) {
        Object.keys(d.salesByLocation).forEach(loc => {
          const group = locationGroups[loc] || 'leisure';
          if (group === 'leisure') {
            leisureSales += d.salesByLocation[loc];
          } else if (group === 'fnb') {
            fnbSales += d.salesByLocation[loc];
          }
        });
        motoSales = Number(d.motoTotalRev || 0);
      } else {
        // Fallback for legacy DB
        leisureSales = Number(d.totalLeisureSales || d.leisureSales || 0);
        motoSales = Number(d.motoTotalRev || d.totalMotoSales || d.motoSales || 0);
        fnbSales = Number(d.totalFnbSales || d.fnbSales || 0);
      }

      // ?Œì› ë¶„ì„ ë¡œì§ (rawRoomRecords ê¸°ë°˜)
      let totalMemberRooms = 0;
      let totalGeneralRooms = 0;
      let memberWdRooms = 0;
      let memberWeRooms = 0;
      let generalWdRooms = 0;
      let generalWeRooms = 0;

      const customWeekendsStr = settings?.customWeekends || '';
      const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);

      if (d.rawRoomRecords && Array.isArray(d.rawRoomRecords)) {
         d.rawRoomRecords.forEach(record => {
            const rType = record.rateType || '';
            const mType = record.marketType || '';
            const sType = record.sourceType || '';
            
            // ?Œì› ?ë³„ ?¤ì›Œ?? ?Œì›, ê¸°ëª…, ë¬´ê¸°ëª? ë©¤ë²„
            const isMember = (
              rType.includes('?Œì›') || mType.includes('?Œì›') || sType.includes('?Œì›') || 
              rType.includes('ê¸°ëª…') || mType.includes('ê¸°ëª…') || sType.includes('ê¸°ëª…') ||
              rType.includes('ë©¤ë²„') || mType.includes('ë©¤ë²„') || sType.includes('ë©¤ë²„')
            );

            const [yyyy, mm, dd] = record.date.split('-');
            const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            const day = dateObj.getDay();
            const nextDay = new Date(dateObj);
            nextDay.setDate(dateObj.getDate() + 1);
            
            const isFriOrSat = (day === 5 || day === 6);
            const isNextDayHoliday = isHoliday(nextDay);
            
            const isWeekend = customWeekendsArray.includes(record.date) || isFriOrSat || isNextDayHoliday;

            if (isMember) {
               totalMemberRooms += record.count;
               if (isWeekend) memberWeRooms += record.count;
               else memberWdRooms += record.count;
            } else {
               totalGeneralRooms += record.count;
               if (isWeekend) generalWeRooms += record.count;
               else generalWdRooms += record.count;
            }
         });
      }

      return {
        ...d,
        sold16, sold35, sold51: sold51 + sold51Acc, totalSold,
        occupancyRate: occRate,
        leisureSales,
        motoSales,
        fnbSales,
        totalSales: leisureSales + motoSales + fnbSales,
        totalRoomRevenue: Number(d.totalRoomRevenue || 0),
        totalMemberRooms,
        totalGeneralRooms,
        memberWdRooms,
        memberWeRooms,
        generalWdRooms,
        generalWeRooms,
        analyzedRoomsCount: totalMemberRooms + totalGeneralRooms
      };
    });
  }, [monthlyData, settings]);

  const filteredProcessedData = useMemo(() => {
    if (selectedMonthFilter === 'all') return processedData;
    return processedData.filter(d => {
      const m = d.yearMonth.split('-')[1];
      return m === selectedMonthFilter;
    });
  }, [processedData, selectedMonthFilter]);

  const totalHotelGuests = useMemo(() => {
    if (!filteredProcessedData || filteredProcessedData.length === 0) return 0;
    return filteredProcessedData.reduce((sum, d) => {
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const sold51Acc = Number(d.sold51Acc || 0);
      return sum + (sold16 * 2) + (sold35 * 4) + ((sold51 + sold51Acc) * 6);
    }, 0);
  }, [filteredProcessedData]);

  // ?Œì› ?µê³„
  const memberStats = useMemo(() => {
    const totMem = filteredProcessedData.reduce((a, b) => a + b.totalMemberRooms, 0);
    const totGen = filteredProcessedData.reduce((a, b) => a + b.totalGeneralRooms, 0);
    const totalRooms = totMem + totGen;
    
    const memWd = filteredProcessedData.reduce((a, b) => a + b.memberWdRooms, 0);
    const memWe = filteredProcessedData.reduce((a, b) => a + b.memberWeRooms, 0);
    const genWd = filteredProcessedData.reduce((a, b) => a + b.generalWdRooms, 0);
    const genWe = filteredProcessedData.reduce((a, b) => a + b.generalWeRooms, 0);

    return {
      available: totalRooms > 0,
      totMem,
      totalRooms,
      memberRatio: totalRooms > 0 ? (totMem / totalRooms) * 100 : 0,
      generalRatio: totalRooms > 0 ? (totGen / totalRooms) * 100 : 0,
      memberWdRatio: (memWd + genWd) > 0 ? (memWd / (memWd + genWd)) * 100 : 0,
      generalWdRatio: (memWd + genWd) > 0 ? (genWd / (memWd + genWd)) * 100 : 0,
      memberWeRatio: (memWe + genWe) > 0 ? (memWe / (memWe + genWe)) * 100 : 0,
      generalWeRatio: (memWe + genWe) > 0 ? (genWe / (memWe + genWe)) * 100 : 0,
      memWd, memWe
    };
  }, [filteredProcessedData]);

  // ? íƒ??ë³¸ë????„ì²´ ?ê?ê³„ìˆ˜ ê³„ì‚°
  const activeGlobalCorrelation = useMemo(() => {
    const occArr = filteredProcessedData.map(d => d.occupancyRate);
    const targetArr = filteredProcessedData.map(d => d[activeConf.dataKey]);
    return calculateCorrelation(occArr, targetArr);
  }, [filteredProcessedData, activeConf.dataKey]);

  const motoCorrelations = useMemo(() => {
    if (activeDivision !== 'moto' || motoLogic !== 'new') return null;
    const filtered = filteredProcessedData.filter(d => d.motoGuestRev !== undefined);
    if (filtered.length === 0) return { guestAvailable: false };
    
    const occArr = filtered.map(d => d.occupancyRate || 0);
    
    let sumGuest = 0;
    let sumGeneral = 0;
    let sumOther = 0;
    let sumTotal = 0;
    
    const guestArr = [];
    const generalArr = [];
    const totalArr = [];
    const aggregatedOther = {};
    
    filtered.forEach(d => {
      let gRev = 0;
      let genRev = 0;
      let othRev = 0;
      
      if (d.motoBreakdown) {
        Object.keys(d.motoBreakdown).forEach(cat => {
          if (d.motoBreakdown[cat]) {
            Object.keys(d.motoBreakdown[cat]).forEach(ticket => {
              const rev = d.motoBreakdown[cat][ticket];
              
              let group = settings.motoTicketGroups?.[ticket];
              if (!group) {
                if (ticket.includes('ì½˜ë„') || ticket.includes('ê°ì‹¤')) group = 'guest';
                else if (ticket.includes('?¼ë°˜') || ticket.includes('ì¦í‰êµ°ë?') || ticket.includes('MOU') || ticket.includes('?¨ì²´')) group = 'general';
                else group = 'other';
              }
              
              if (group === 'guest') gRev += rev;
              else if (group === 'general') genRev += rev;
              else {
                othRev += rev;
                aggregatedOther[ticket] = (aggregatedOther[ticket] || 0) + rev;
              }
            });
          }
        });
      } else {
        gRev = d.motoGuestRev || 0;
        genRev = d.motoGeneralRev || 0;
        othRev = (d.motoInternalRev || 0) + (d.motoOtherRev || 0);
      }
      
      const totRev = gRev + genRev + othRev;
      
      guestArr.push(gRev);
      generalArr.push(genRev);
      totalArr.push(totRev);
      
      sumGuest += gRev;
      sumGeneral += genRev;
      sumOther += othRev;
      sumTotal += totRev;
    });

    const guestRatio = sumTotal > 0 ? (sumGuest / sumTotal) * 100 : 0;
    const generalRatio = sumTotal > 0 ? (sumGeneral / sumTotal) * 100 : 0;
    const otherRatio = sumTotal > 0 ? (sumOther / sumTotal) * 100 : 0;

    return {
      guest: calculateCorrelation(occArr, guestArr),
      guestRatio: guestRatio,
      generalRatio: generalRatio,
      otherRatio: otherRatio,
      aggregatedOther: aggregatedOther,
      total: calculateCorrelation(occArr, totalArr),
      guestAvailable: true
    };
  }, [filteredProcessedData, activeDivision, motoLogic]);

  // ? íƒ??ë³¸ë????‰í˜•ë³??ê?ê³„ìˆ˜ ê³„ì‚°
  const activeRoomTypeCorrelations = useMemo(() => {
    const targetArr = filteredProcessedData.map(d => d[activeConf.dataKey]);
    return {
      '16??: calculateCorrelation(filteredProcessedData.map(d => d.sold16), targetArr),
      '35??: calculateCorrelation(filteredProcessedData.map(d => d.sold35), targetArr),
      '51??: calculateCorrelation(filteredProcessedData.map(d => d.sold51), targetArr)
    };
  }, [filteredProcessedData, activeConf.dataKey]);

  // ?ì—…?¥ë³„ ?ê?ê³„ìˆ˜ ê³„ì‚° (ê°ì‹¤ ?ìœ ??ê¸°ì?)
  const locationCorrelations = useMemo(() => {
    const occArr = filteredProcessedData.map(d => d.occupancyRate);
    const locMap = {};
    
    const mapLocationName = (name) => {
      const n = name.replace(/[\s-]+/g, '');
      if (
        n.includes('ë¯¸ë””?´ì•„??) || 
        n.includes('ë¯¸ë””?´ê¸°?í’ˆ') || 
        n.includes('ë¯¸ë””?¬ê¸°?í’ˆ') || 
        n.includes('ë¯¸ë””?´ê¸°?„íŠ¸') || 
        n.includes('ë¯¸ë””?´ì¹´??) ||
        n.includes('ë®¤ì??„ì¹´??) ||
        n.includes('ë¯¸ë””?´ê???)
      ) {
        return 'ë¯¸ë””?´ì•„?¸ì„¼??;
      }
      if (
        n.includes('ëª©ì¥ì²´í—˜') || 
        name.trim() === 'ëª©ì¥' || 
        n.includes('?¼ë£©ë§ì¹´??)
      ) {
        return 'ëª©ì¥';
      }
      return name;
    };

    const locationGroups = settings.locationGroups || {};

    filteredProcessedData.forEach((d, i) => {
      const salesObj = d.salesByLocation || d.leisureSalesByLocation || {};
      Object.entries(salesObj).forEach(([loc, amt]) => {
        const group = locationGroups[loc] || 'leisure';
        if (activeDivision === 'all' || group === activeDivision) {
          const groupedName = mapLocationName(loc);
          if (!locMap[groupedName]) locMap[groupedName] = new Array(filteredProcessedData.length).fill(0);
          locMap[groupedName][i] += amt;
        }
      });
    });

    const results = [];
    Object.keys(locMap).forEach(loc => {
      const dataArr = locMap[loc];
      const totalAmt = dataArr.reduce((sum, val) => sum + val, 0);
      
      if (totalAmt < 1000000 * filteredProcessedData.length) return;

      const corr = calculateCorrelation(occArr, dataArr);
      if (corr !== null && !isNaN(corr)) {
        results.push({ name: loc, correlation: corr });
      }
    });

    return results.sort((a, b) => b.correlation - a.correlation);
  }, [filteredProcessedData, settings.locationGroups, activeDivision]);

  // TrevPAR / RevPAR ê³„ì‚°
  const kpiData = useMemo(() => {
    if (!filteredProcessedData || filteredProcessedData.length === 0) return null;
    
    // settings?ì„œ ìº¡ì²˜ ?ˆì´??ê°€?¸ì˜¤ê¸?(?†ìœ¼ë©?ê¸°ë³¸ê°?
    const capLeisure = (settings.captureRateLeisure ?? 85) / 100;
    const capFnb = (settings.captureRateFnb ?? 75) / 100;
    const capMoto = (settings.captureRateMoto ?? 25) / 100;

    let totalAvailableRooms = 0;
    let totalRoomRev = 0;
    let totalGrossTrev = 0;
    let totalPureTrev = 0;
    let totalSubsidiaryRev = 0;

    filteredProcessedData.forEach(d => {
      const physicalRooms = Number(settings.totalRooms) || 175;
      const rooms51Sets = Number(settings.connectingRooms51) || 85;
      const count51AsTwo = settings.count51AsTwoRooms !== false;
      const dailyInv = count51AsTwo ? physicalRooms : (physicalRooms - rooms51Sets);
      
      const days = d.daysCount || 30; // fallback
      const monthlyInv = dailyInv * days;

      totalAvailableRooms += monthlyInv;
      totalRoomRev += (d.totalRoomRevenue || 0);

      const leisureGross = d.leisureSales || 0;
      const fnbGross = d.fnbSales || 0;
      const motoGross = d.motoSales || 0;

      // ëª¨í† ?„ë ˆ??ë§¤ì¶œ?€ KPI ?°ì •?ì„œ ?œì™¸ (?¬ìš©???”ì²­)
      totalGrossTrev += (d.totalRoomRevenue || 0) + leisureGross + fnbGross;
      totalPureTrev += (d.totalRoomRevenue || 0) + (leisureGross * capLeisure) + (fnbGross * capFnb);
      totalSubsidiaryRev += leisureGross + fnbGross + motoGross;
    });

    if (totalAvailableRooms === 0) return null;

    return {
      revPar: Math.round(totalRoomRev / totalAvailableRooms),
      grossTrevPar: Math.round(totalGrossTrev / totalAvailableRooms),
      pureTrevPar: Math.round(totalPureTrev / totalAvailableRooms),
      capLeisure: capLeisure * 100,
      capFnb: capFnb * 100,
      capMoto: capMoto * 100,
      totalSubsidiaryRev: totalSubsidiaryRev
    };
  }, [filteredProcessedData, settings]);

  // ê°ì‹¤ ?ë§¤ì±„ë„(Market Type) ?°ì´??ì§‘ê³„
  const { channelData, negativeChannels } = useMemo(() => {
    const channelMap = {
      '?¨ë¼??: 0,
      '?¸ë???: 0,
      '?´ì–‘??: 0,
      '?ˆì•½??: 0,
      '?ˆí˜?´ì?': 0,
      'ê¸°í?': 0
    };

    filteredProcessedData.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const market = record.marketType || '';
          const rev = record.revenue || 0;
          
          if (market.includes('?¨ë¼??)) channelMap['?¨ë¼??] += rev;
          else if (market.includes('ê¸°ì—…') || market.includes('?´ì–‘??)) channelMap['?´ì–‘??] += rev;
          else if (market.includes('?¸ë???) || market.includes('?¨ì²´')) channelMap['?¸ë???] += rev;
          else if (market.includes('?ˆì•½??) || market.includes('?„í™”') || market.includes('ë©”ì‹ ?€')) channelMap['?ˆì•½??] += rev;
          else if (market.includes('?ˆí˜?´ì?') || market.includes('APP')) channelMap['?ˆí˜?´ì?'] += rev;
          else channelMap['ê¸°í?'] += rev;
        });
      }
    });

    const arr = Object.entries(channelMap).map(([name, value]) => ({ name, value }));
    return {
      channelData: arr.filter(d => d.value > 0).sort((a, b) => b.value - a.value),
      negativeChannels: arr.filter(d => d.value < 0).sort((a, b) => a.value - b.value)
    };
  }, [filteredProcessedData]);

  // ì±„ë„ë³??‰í˜•ë³?ê°ë‹¨ê°€ (ADR)
  const channelAdrData = useMemo(() => {
    const channelMap = {
      '?¨ë¼??: { '16??: {rev: 0, cnt: 0}, '35??: {rev: 0, cnt: 0}, '51??: {rev: 0, cnt: 0}, '?„ì²´': {rev: 0, cnt: 0} },
      '?¸ë???: { '16??: {rev: 0, cnt: 0}, '35??: {rev: 0, cnt: 0}, '51??: {rev: 0, cnt: 0}, '?„ì²´': {rev: 0, cnt: 0} },
      '?´ì–‘??: { '16??: {rev: 0, cnt: 0}, '35??: {rev: 0, cnt: 0}, '51??: {rev: 0, cnt: 0}, '?„ì²´': {rev: 0, cnt: 0} },
      '?ˆì•½??: { '16??: {rev: 0, cnt: 0}, '35??: {rev: 0, cnt: 0}, '51??: {rev: 0, cnt: 0}, '?„ì²´': {rev: 0, cnt: 0} },
      '?ˆí˜?´ì?': { '16??: {rev: 0, cnt: 0}, '35??: {rev: 0, cnt: 0}, '51??: {rev: 0, cnt: 0}, '?„ì²´': {rev: 0, cnt: 0} },
      'ê¸°í?': { '16??: {rev: 0, cnt: 0}, '35??: {rev: 0, cnt: 0}, '51??: {rev: 0, cnt: 0}, '?„ì²´': {rev: 0, cnt: 0} }
    };

    filteredProcessedData.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const market = record.marketType || '';
          const rev = record.revenue || 0;
          const cnt = record.count || 0;
          const type = record.roomType || '';

          let channelName = 'ê¸°í?';
          if (market.includes('?¨ë¼??)) channelName = '?¨ë¼??;
          else if (market.includes('ê¸°ì—…') || market.includes('?´ì–‘??)) channelName = '?´ì–‘??;
          else if (market.includes('?¸ë???) || market.includes('?¨ì²´')) channelName = '?¸ë???;
          else if (market.includes('?ˆì•½??) || market.includes('?„í™”') || market.includes('ë©”ì‹ ?€')) channelName = '?ˆì•½??;
          else if (market.includes('?ˆí˜?´ì?') || market.includes('APP')) channelName = '?ˆí˜?´ì?';

          let typeName = 'ê¸°í?';
          if (type.includes('16??)) typeName = '16??;
          else if (type.includes('35??)) typeName = '35??;
          else if (type.includes('51??)) typeName = '51??;

          if (typeName !== 'ê¸°í?') {
            channelMap[channelName][typeName].rev += rev;
            channelMap[channelName][typeName].cnt += cnt;
          }
          channelMap[channelName]['?„ì²´'].rev += rev;
          channelMap[channelName]['?„ì²´'].cnt += cnt;
        });
      }
    });

    return Object.entries(channelMap).map(([channel, types]) => {
      return {
        channel,
        '16??: types['16??].cnt > 0 ? types['16??].rev / types['16??].cnt : 0,
        '35??: types['35??].cnt > 0 ? types['35??].rev / types['35??].cnt : 0,
        '51??: types['51??].cnt > 0 ? types['51??].rev / types['51??].cnt : 0,
        '?„ì²´': types['?„ì²´'].cnt > 0 ? types['?„ì²´'].rev / types['?„ì²´'].cnt : 0,
        totalRev: types['?„ì²´'].rev
      };
    }).filter(d => d.totalRev > 0).sort((a, b) => b.totalRev - a.totalRev);
  }, [filteredProcessedData]);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#ef4444', '#64748b'];

  if (processedData.length < 2) {
    return (
      <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
        ?ê?ê´€ê³„ë? ë¶„ì„?˜ë ¤ë©?ìµœì†Œ 2ê°œì›” ?´ìƒ???°ì´?°ê? ?„ìš”?©ë‹ˆ?? ?‘ì??????…ë¡œ?œí•´ ì£¼ì„¸??
      </div>
    );
  }

  const getInterpretation = (r) => {
    if (r === null || isNaN(r)) return 'ë¶„ì„ ë¶ˆê?';
    const abs = Math.abs(r);
    if (abs >= 0.7) return 'ë§¤ìš° ê°•í•œ ?°ê???;
    if (abs >= 0.4) return '?œë ·???°ê???;
    if (abs >= 0.2) return '?½í•œ ?°ê???;
    return 'ê±°ì˜ ë¬´ê???;
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
    
      {/* ?? ìµœìƒ???µì‹¬ ì§€???€??ë°°ë„ˆ */}
      <div className="glass-panel" style={{display: 'flex', flexWrap: 'wrap', overflow: 'hidden', border: '1px solid var(--accent-gold)'}}>
        <div style={{flex: 1, minWidth: '300px', padding: '32px 40px', background: 'rgba(251, 191, 36, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <h2 style={{margin: 0, color: 'var(--accent-gold)', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            ?‘¥ ì´?ë°©ë¬¸ê°?<span style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px'}}>Live from Google</span>
          </h2>
          <div style={{fontSize: '56px', fontWeight: '900', color: 'var(--text-main)', textShadow: '0 0 20px rgba(251,191,36,0.5)'}}>
            {displayVisitors !== null ? <CountUp end={displayVisitors} duration={2} separator="," /> : '...'}
          </div>
          <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '14px'}}>
            {selectedMonthFilter === 'all' ? '?¬í•´ ?„ì²´ ?¬ì—…?¥ì„ ë°©ë¬¸???µí•© ê³ ê° ?„ì  ?? : `${selectedMonthFilter}???????™ì•ˆ ?„ì²´ ?¬ì—…?¥ì„ ë°©ë¬¸???µí•© ê³ ê° ??}
          </p>
          <div style={{marginTop: 'auto', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.2)'}}>
            <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>ë°©ë¬¸ê°?1?¸ë‹¹ ?‰ê·  ?Œë¹„??(?ˆì?+?ìŒ+ëª¨í† )</div>
            <div style={{fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>
              {displayVisitors > 0 && kpiData ? `??{Math.round(kpiData.totalSubsidiaryRev / displayVisitors).toLocaleString()}` : '??'}
            </div>
          </div>
        </div>
        
        <div style={{width: '1px', background: 'var(--border-glass)'}} />

        <div style={{flex: 1, minWidth: '300px', padding: '32px 40px', background: 'rgba(52, 211, 153, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <h2 style={{margin: 0, color: 'var(--accent-emerald)', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            ?›ï¸??„ì  ?™ë°•ê°?<span style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px'}}>DB ê¸°ë°˜ ?°ì‚°</span>
          </h2>
          <div style={{fontSize: '56px', fontWeight: '900', color: 'var(--text-main)', textShadow: '0 0 20px rgba(52,211,153,0.5)'}}>
            <CountUp end={totalHotelGuests} duration={2} separator="," />
          </div>
          <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '14px'}}>
            (16?‰Ã??? + (35?‰Ã??? + (51?‰Ã??? ?„ì  ?©ì‚° ê²°ê³¼
          </p>
        </div>
      </div>

      {/* KPI Dashboard (TrevPAR & RevPAR) */}
      {kpiData && (
        <div className="glass-panel" style={{padding: '24px', display: 'flex', gap: '32px', flexWrap: 'wrap'}}>
          <div style={{flex: '1 1 300px', minWidth: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <h3 style={{margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--accent-gold)'}}>??/span> ê²½ì˜ ?µì‹¬ KPI (?”í‰ê·?
            </h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5', wordBreak: 'keep-all'}}>
              ë°?1ê°œë? ?”ì•˜?????˜ë£¨??ì°½ì¶œ?˜ëŠ” ?‰ê·  ?˜ìµ?…ë‹ˆ?? [?¤ì •]???…ë ¥??'?¬ìˆ™ê°?ë¹„ì¤‘'??ë°”íƒ•?¼ë¡œ ?Œí¬??ë§¤ì¶œ???œì™¸??<strong>?œìˆ˜ ê°ì‹¤ ?°ê³„ ê°€ì¹?Pure TrevPAR)</strong>ë¥?ë¶„ë¦¬?˜ì—¬ ì¸¡ì •?©ë‹ˆ??<br/>
              <span style={{color: 'var(--accent-red)', fontSize: '12px'}}>* ëª¨í† ?„ë ˆ??ë§¤ì¶œ?€ ?±ê²©???¬ë¼ ê°ì‹¤ KPI ?°ì •?ì„œ ?œì™¸?˜ì—ˆ?µë‹ˆ??</span>
            </p>
          </div>
          
          <div style={{flex: '2 1 500px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'start'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '12px', color: 'var(--text-muted)', minHeight: '36px', wordBreak: 'keep-all', display: 'flex', alignItems: 'flex-end'}}>
                RevPAR (ê°ì‹¤ ?˜ìµë§?
              </div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.5px'}}>
                ??CountUp end={kpiData.revPar} formattingFn={formatCurrency} duration={1} preserveValue />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '12px', color: 'var(--text-muted)', minHeight: '36px', wordBreak: 'keep-all', display: 'flex', alignItems: 'flex-end'}}>
                <span><span style={{color: 'var(--accent-emerald)'}}>??/span> ?œìˆ˜ TrevPAR (ê°ì‹¤+?¬ìˆ™ê°?ë¶€?€ë§¤ì¶œ)</span>
              </div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)', letterSpacing: '-0.5px'}}>
                ??CountUp end={kpiData.pureTrevPar} formattingFn={formatCurrency} duration={1} preserveValue />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '12px', color: 'var(--text-muted)', minHeight: '36px', wordBreak: 'keep-all', display: 'flex', alignItems: 'flex-end'}}>
                Gross TrevPAR (?Œí¬???¬í•¨ ?„ì²´)
              </div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.5px'}}>
                ??CountUp end={kpiData.grossTrevPar} formattingFn={formatCurrency} duration={1} preserveValue />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 0. ë³¸ë? ? íƒê¸?ë°??”ë³„ ?„í„° */}
      <div className="glass-panel mobile-wrap" style={{padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <h3 style={{margin: 0}}>ë¶„ì„ ?€??ë³¸ë? ? íƒ:</h3>
          <div className="mobile-wrap" style={{display: 'flex', gap: '12px'}}>
            {Object.entries(divisionConfig).map(([key, conf]) => (
              <button
                key={key}
                onClick={() => setActiveDivision(key)}
                style={{
                  background: activeDivision === key ? conf.color : 'rgba(255,255,255,0.05)',
                  color: activeDivision === key ? '#000' : 'var(--text-main)',
                  border: `1px solid ${activeDivision === key ? 'transparent' : 'rgba(255,255,255,0.2)'}`,
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeDivision === key ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                {conf.title}
              </button>
            ))}
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '8px'}}>
          <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>?”ë³„ ?„í„°:</span>
          <select 
            value={selectedMonthFilter}
            onChange={(e) => setSelectedMonthFilter(e.target.value)}
            style={{background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: 'none', padding: '6px 12px', borderRadius: '4px', outline: 'none', fontWeight: 'bold'}}
          >
            <option value="all" style={{color: 'black'}}>?„ì›” ì¢…í•© ë¶„ì„</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
              <option key={m} value={m} style={{color: 'black'}}>{m}?”ë§Œ ë¶„ì„</option>
            ))}
          </select>
        </div>
      </div>

      {/* ê°ì‹¤ ?¬ìˆ™ê°?? í˜• ?•ë? ë¶„ì„ (?Œì› vs ?¼ë°˜) */}
      {memberStats.available && (
        <div className="glass-panel" style={{padding: '24px', borderLeft: '4px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'}}>
            <div>
              <h3 style={{margin: '0 0 8px 0', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                ?‘¥ ê°ì‹¤ ?¬ìˆ™ê°?? í˜• ?•ë? ë¶„ì„ (?Œì› vs ?¼ë°˜)
              </h3>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0}}>
                ?ë³¸ ?‘ì? ?°ì´?°ì˜ ë§ˆì¼“ì½”ë“œ/?”ê¸ˆ? í˜•??ê¸°ë°˜?¼ë¡œ ?Œì›(ê¸°ëª…/ë¬´ê¸°ëª?ê³??¼ë°˜ê°ì˜ ?ìœ  ë¹„ì¤‘???”ì¼ë³„ë¡œ ?ì„¸ ë¶„ì„?©ë‹ˆ??
              </p>
            </div>
          </div>
          
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px'}}>
            {/* ?„ì²´ ë¹„ìœ¨ */}
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
              <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>ì´??ë§¤ ê°ì‹¤ ì¤??Œì› ë¹„ì¤‘</div>
              <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px'}}>
                <span style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-blue)', lineHeight: 1}}>
                  {memberStats.memberRatio.toFixed(1)}%
                </span>
                <span style={{fontSize: '14px', color: 'var(--text-muted)', paddingBottom: '4px'}}>
                  ({formatCurrency(memberStats.totMem)} / {formatCurrency(memberStats.totalRooms)}??
                </span>
              </div>
              <div style={{width: '100%', height: '8px', background: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex'}}>
                <div style={{width: `${memberStats.memberRatio}%`, background: 'var(--accent-blue)'}} />
                <div style={{width: `${memberStats.generalRatio}%`, background: 'var(--text-muted)'}} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px'}}>
                <span style={{color: 'var(--accent-blue)'}}>?Œì› {memberStats.memberRatio.toFixed(1)}%</span>
                <span style={{color: 'var(--text-muted)'}}>?¼ë°˜ {memberStats.generalRatio.toFixed(1)}%</span>
              </div>
            </div>

            {/* ì£¼ì¤‘ ë¹„ìœ¨ */}
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
              <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>ì£¼ì¤‘(?‰ì¼) ?Œì› ë¹„ì¤‘</div>
              <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px'}}>
                <span style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-emerald)', lineHeight: 1}}>
                  {memberStats.memberWdRatio.toFixed(1)}%
                </span>
                <span style={{fontSize: '14px', color: 'var(--text-muted)', paddingBottom: '4px'}}>
                  ({formatCurrency(memberStats.memWd)}??
                </span>
              </div>
              <div style={{width: '100%', height: '8px', background: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex'}}>
                <div style={{width: `${memberStats.memberWdRatio}%`, background: 'var(--accent-emerald)'}} />
                <div style={{width: `${memberStats.generalWdRatio}%`, background: 'var(--text-muted)'}} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px'}}>
                <span style={{color: 'var(--accent-emerald)'}}>?Œì› {memberStats.memberWdRatio.toFixed(1)}%</span>
                <span style={{color: 'var(--text-muted)'}}>?¼ë°˜ {memberStats.generalWdRatio.toFixed(1)}%</span>
              </div>
            </div>

            {/* ì£¼ë§ ë¹„ìœ¨ */}
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
              <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>ì£¼ë§(ê³µíœ´???¬í•¨) ?Œì› ë¹„ì¤‘</div>
              <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px'}}>
                <span style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-purple)', lineHeight: 1}}>
                  {memberStats.memberWeRatio.toFixed(1)}%
                </span>
                <span style={{fontSize: '14px', color: 'var(--text-muted)', paddingBottom: '4px'}}>
                  ({formatCurrency(memberStats.memWe)}??
                </span>
              </div>
              <div style={{width: '100%', height: '8px', background: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex'}}>
                <div style={{width: `${memberStats.memberWeRatio}%`, background: 'var(--accent-purple)'}} />
                <div style={{width: `${memberStats.generalWeRatio}%`, background: 'var(--text-muted)'}} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px'}}>
                <span style={{color: 'var(--accent-purple)'}}>?Œì› {memberStats.memberWeRatio.toFixed(1)}%</span>
                <span style={{color: 'var(--text-muted)'}}>?¼ë°˜ {memberStats.generalWeRatio.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ëª¨í† ?„ë ˆ???„ìš© ?•ë? ë¶„ì„ ? ê? */}
      {activeDivision === 'moto' && (
        <div className="glass-panel" style={{padding: '16px 24px', borderLeft: '4px solid var(--accent-gold)'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'}}>
            <div>
              <h3 style={{margin: '0 0 8px 0', color: 'var(--accent-gold)'}}>?¯ ëª¨í† ?„ë ˆ???•ë? ë¶„ì„ (?°ì¼“ ê¸°ë°˜)</h3>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0}}>
                ê¸°ì¡´ ?”ë³„ ì´ë§¤ì¶?ì¶”ì´?€ ?‘ì? ?°ì´??ê¸°ë°˜ ê³ ê°? í˜• ?ì„¸ ë¶„ì„???¨ê»˜ ?•ì¸?????ˆìŠµ?ˆë‹¤.
              </p>
            </div>
            <div style={{display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px'}}>
              <button 
                onClick={() => setMotoLogic('current')}
                style={{padding: '8px 16px', borderRadius: '6px', background: motoLogic === 'current' ? 'var(--accent-gold)' : 'transparent', color: motoLogic === 'current' ? '#000' : 'var(--text-main)', border: 'none', cursor: 'pointer', fontWeight: motoLogic === 'current' ? 'bold' : 'normal', transition: 'all 0.2s'}}
              >
                ê¸°ì¡´ ì¶”ì´ ë³´ê¸°
              </button>
              <button 
                onClick={() => setMotoLogic('new')}
                style={{padding: '8px 16px', borderRadius: '6px', background: motoLogic === 'new' ? 'var(--accent-gold)' : 'transparent', color: motoLogic === 'new' ? '#000' : 'var(--text-main)', border: 'none', cursor: 'pointer', fontWeight: motoLogic === 'new' ? 'bold' : 'normal', transition: 'all 0.2s'}}
              >
                ?ì„¸ ë§¤ì¶œ ë¶„ì„ (? ê·œ)
              </button>
            </div>
          </div>

          {motoLogic === 'new' && motoCorrelations && (
            <div style={{marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
              {!motoCorrelations.guestAvailable ? (
                <div style={{padding: '24px', textAlign: 'center', color: 'var(--text-muted)'}}>
                  ?°ì´???…ë¡œ???˜ì´ì§€?ì„œ <strong>ëª¨í† ?„ë ˆ???‘ì? ?Œì¼</strong>???…ë¡œ?œí•´ ì£¼ì„¸??
                  <br/>ì¶”ì¶œ???°ì´?°ê? ?†ì–´ ?•ë? ë¶„ì„???˜í–‰?????†ìŠµ?ˆë‹¤.
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                  {/* ?‘ë? ì¶?ë¹„ì¤‘ ë°??ê?ê´€ê³?ê²°í•© ë¶„ì„ */}
                  <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
                    
                    {/* ?¬ìˆ™ê°??¨ë„ */}
                    <div className="glass-panel" style={{flex: 1, minWidth: '300px', padding: '24px', background: 'rgba(52, 211, 153, 0.05)', border: '1px solid var(--accent-emerald)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin: '0', color: 'var(--accent-emerald)', fontSize: '18px'}}>?¬ìˆ™ê°?ë§¤ì¶œ (ê°ì‹¤?°ê³„)</h4>
                        <div style={{fontSize: '32px', fontWeight: 'bold'}}>{motoCorrelations.guestRatio !== null ? `${motoCorrelations.guestRatio.toFixed(1)}%` : 'N/A'}</div>
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px'}}>
                        ê°ì‹¤???¬ìˆ™?˜ë©° êµ¬ë§¤???°ì¼“ ë¹„ìœ¨ (ì½˜ë„/ê°ì‹¤ ?°ì¼“?©ê³„)
                      </div>

                      <div style={{fontSize: '13px', color: 'var(--accent-emerald)', background: 'rgba(52, 211, 153, 0.1)', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px'}}>
                        ?’¡ <strong>[ì¶”ì²œ]</strong> ???˜ì¹˜({motoCorrelations.guestRatio !== null ? motoCorrelations.guestRatio.toFixed(1) : '0'}%)ë¥?<strong>[?¤ì •] ??˜ 'ëª¨í† ?„ë ˆ??ìº¡ì²˜ ?ˆì´??</strong>???…ë ¥?˜ì‹œë©? ê°€???•í™•???¬ìˆ™ê°??œìˆ˜ TrevPARê°€ ?ë™ ê³„ì‚°?©ë‹ˆ??
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px'}}>
                        <span style={{fontSize: '14px', color: 'var(--text-main)'}}>ê°ì‹¤ ?ìœ ?¨ê³¼???ê?ê³„ìˆ˜ (r)</span>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: (motoCorrelations.guest !== null && motoCorrelations.guest >= 0.4) ? 'var(--accent-emerald)' : 'var(--text-main)'}}>
                          {motoCorrelations.guest !== null ? motoCorrelations.guest.toFixed(3) : 'N/A'}
                        </span>
                      </div>
                      
                      <div style={{fontSize: '13px', padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', lineHeight: '1.5'}}>
                        {motoCorrelations.guest !== null && motoCorrelations.guest >= 0.4 && motoCorrelations.guestRatio < 20 ? (
                          <span>? ï¸ <strong style={{color: 'var(--accent-red)'}}>[?µê³„??ì°©ì‹œ ì£¼ì˜]</strong> ê°ì‹¤ ?ìœ ?¨ê³¼ ?ë¦„?€ ? ì‚¬?˜ë‚˜, ?¬ìˆ™ê°?ë§¤ì¶œ??ì°¨ì??˜ëŠ” ?Œì´ê°€ ?ˆë¬´ ?‘ì•„ ?¤ì§ˆ?ì¸ ë§¤ì¶œ ê²¬ì¸ ?¨ê³¼??ë¯¸ë??©ë‹ˆ??(?ˆìˆ˜ ê°€?¥ì„±).</span>
                        ) : motoCorrelations.guest !== null && motoCorrelations.guest >= 0.4 && motoCorrelations.guestRatio >= 20 ? (
                          <span>??<strong style={{color: 'var(--accent-emerald)'}}>[?µì‹¬ ?™ë ¥]</strong> ê°ì‹¤ ?ìœ ??ì¦ê? ???œë ·?˜ê²Œ ?¨ê»˜ ?¤ë¥´ë©? ë¹„ì¤‘ ?í•œ ? ì˜ë¯¸í•˜??ëª¨í† ?„ë ˆ???±ì¥??? ë“ ?˜ê²Œ ë°›ì³ì£¼ê³  ?ˆìŠµ?ˆë‹¤.</span>
                        ) : motoCorrelations.guest !== null ? (
                          <span style={{color: 'var(--text-muted)'}}>?“‰ ê°ì‹¤ ?ìœ ??ì¦ê°ê³??¬ìˆ™ê°??°ì¼“ ?ë§¤??ê°„ì˜ ? ì˜ë¯¸í•œ ?™ê¸°?”ê? ?•ì¸?˜ì? ?ŠìŠµ?ˆë‹¤.</span>
                        ) : null}
                      </div>
                    </div>

                    {/* ?¼ë°˜ê°??¨ë„ */}
                    <div className="glass-panel" style={{flex: 1, minWidth: '300px', padding: '24px', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid var(--accent-gold)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin: '0', color: 'var(--accent-gold)', fontSize: '18px'}}>?¼ë°˜ê°?ë§¤ì¶œ (?¸ë?? ì…)</h4>
                        <div style={{fontSize: '32px', fontWeight: 'bold'}}>{motoCorrelations.generalRatio !== null ? `${motoCorrelations.generalRatio.toFixed(1)}%` : 'N/A'}</div>
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px'}}>
                        ê°ì‹¤ê³?ë¬´ê????œìˆ˜ ?¸ë? ? ì… ë¹„ìœ¨ (?¼ë°˜/êµ°ë?/MOU/?¨ì²´)
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', opacity: 0.5}}>
                        <span style={{fontSize: '14px', color: 'var(--text-main)'}}>ê°ì‹¤ ?ìœ ?¨ê³¼???ê?ê³„ìˆ˜ (r)</span>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-muted)'}}>
                          ?´ë‹¹?†ìŒ
                        </span>
                      </div>

                      <div style={{fontSize: '13px', padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', lineHeight: '1.5', color: 'var(--text-muted)'}}>
                        ?’¡ ?¸ë? ë§ˆì???ë°?ì§€???˜ìš”???˜í•œ ?…ë¦½???ì—… ?±ê³¼ ì§€?œì…?ˆë‹¤. ê°ì‹¤ ë³€?™ê³¼ ?¸ê³¼ê´€ê³„ê? ?†ìœ¼ë¯€ë¡??°ê³„ ?ê??±ì„ ë¶„ì„?˜ì? ?ŠìŠµ?ˆë‹¤.
                      </div>
                    </div>

                    {/* ê¸°í? ë§¤ì¶œ ?¨ë„ */}
                    <div className="glass-panel" style={{flex: 1, minWidth: '300px', padding: '24px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin: '0', color: 'var(--text-bright)', fontSize: '18px'}}>ê¸°í? ë§¤ì¶œ (ë¯¸ë¶„ë¥?</h4>
                        <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--text-main)'}}>{motoCorrelations.otherRatio !== null ? `${motoCorrelations.otherRatio.toFixed(1)}%` : 'N/A'}</div>
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px'}}>
                        ?¬ìˆ™ê°??¼ë°˜ê°??¤ì›Œ?œë¡œ ë¶„ë¥˜?˜ì? ?Šì? ë§¤ì¶œ (?„ì§??ê¸°í? ??
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', opacity: 0.5}}>
                        <span style={{fontSize: '14px', color: 'var(--text-main)'}}>ê°ì‹¤ ?ìœ ?¨ê³¼???ê?ê³„ìˆ˜ (r)</span>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-muted)'}}>
                          ?´ë‹¹?†ìŒ
                        </span>
                      </div>

                      <div style={{fontSize: '13px', padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', lineHeight: '1.5', color: 'var(--text-muted)'}}>
                        ?’¡ ?„ì§??ë³µì? ?°ì¼“?´ê±°??ëª…ì¹­ êµ¬ë¶„??ë¶ˆëª…?•í•œ ê¸°í? ë§¤ì¶œ?…ë‹ˆ?? ë¶„ì„???µì‹¬???„ë‹ˆë¯€ë¡??ê?ê´€ê³„ì—???œì™¸?©ë‹ˆ??
                      </div>
                      
                      {motoCorrelations.aggregatedOther && Object.keys(motoCorrelations.aggregatedOther).length > 0 && (
                        <div style={{marginTop: '16px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', maxHeight: '120px', overflowY: 'auto'}}>
                          <div style={{marginBottom: '6px', fontWeight: 'bold', color: 'var(--text-muted)'}}>?“Œ ë¯¸ë¶„ë¥??°ì¼“ ?„ì  ì§‘ê³„ ?´ì—­</div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                            {Object.entries(motoCorrelations.aggregatedOther)
                              .sort((a,b) => b[1] - a[1])
                              .map(([k,v]) => (
                              <div key={k} style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px'}}>
                                <span>{k}</span>
                                <span>??new Intl.NumberFormat('ko-KR').format(Math.round(v))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 1. ?ë‹¨ ?”ì•½ ì¹´ë“œ (?„ì²´ ?ë¦„) */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px'}}>
            ?µí•© ?ê?ê³„ìˆ˜ (r)
            <span style={{fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: `${activeConf.color}22`, color: activeConf.color}}>
              {activeConf.title}
            </span>
          </h3>
          <div style={{fontSize: '36px', fontWeight: 'bold', color: activeConf.color}}>
            {activeGlobalCorrelation ? activeGlobalCorrelation.toFixed(3) : 'N/A'}
          </div>
          <div style={{color: 'var(--text-muted)', marginTop: '8px'}}>
            ê°ì‹¤ ?ìœ ????{activeConf.title} ì´ë§¤ì¶?ê°„ì˜ ê´€ê³?br/>
            <strong>{getInterpretation(activeGlobalCorrelation)}</strong>
          </div>
        </div>

        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)'}}>{activeConf.title} ë§¤ì¶œê³?ê°€???°ê? ê¹Šì? ê°ì‹¤ ?‰í˜•</h3>
          <div style={{display: 'flex', gap: '20px', height: '100%', alignItems: 'center'}}>
            {Object.entries(activeRoomTypeCorrelations).map(([type, r]) => (
              <div key={type} style={{flex: 1, background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '18px', fontWeight: 'bold'}}>{type}</div>
                <div style={{fontSize: '24px', color: (r && r > 0.5) ? activeConf.color : 'var(--text-main)', margin: '8px 0'}}>
                  {r ? r.toFixed(2) : '-'}
                </div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{getInterpretation(r)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. ë©”ì¸ ?¸ë Œ??ì°¨íŠ¸ */}
      <div className="glass-panel" style={{padding: '24px', minWidth: 0}}>
        <div style={{marginBottom: '20px'}}>
          <h3 style={{margin: '0 0 8px 0'}}>?”ë³„ ì¶”ì´: ê°ì‹¤ ?ìœ ??vs {activeConf.title} ë§¤ì¶œ</h3>
          <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
            ?’¡ <strong>?´ì„ ê°€?´ë“œ:</strong> ì´ˆë¡?????ìœ ??ê³?ë§¤ì¶œ ? ì˜ ?¤ë¥´?´ë¦¬??ëª¨ìŠµ??ë¹„ìŠ·? ìˆ˜ë¡? ?´ë‹¹ ë³¸ë???ë§¤ì¶œ???¬ìˆ™ê°??˜ì— ?¬ê²Œ ?˜ì¡´?˜ê³  ?ˆìŒ???»í•©?ˆë‹¤.
            <br/>
            <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)'}}>
              (??ì¢Œì¸¡ ?«ì???ìœ ??%), ?°ì¸¡ ?¸ë¡œì¶•ì˜ 'M'?€ ë°±ë§Œ ?¨ìœ„ë¥??»í•©?ˆë‹¤. ?? 800M = 8????
            </span>
          </p>
        </div>
        <div style={{width: '100%', height: '400px', minWidth: 0, minHeight: 0}}>
          <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={filteredProcessedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="yearMonth" stroke="var(--text-muted)" />
              <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <YAxis yAxisId="right" orientation="right" stroke={activeConf.color} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
              <RechartsTooltip 
                contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                formatter={(value, name) => name === '?ìœ ?? ? `${value.toFixed(1)}%` : `??{formatCurrency(value)}`}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="occupancyRate" name="?ìœ ?? stroke="#94a3b8" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
              <Line yAxisId="right" type="monotone" dataKey={activeConf.dataKey} name={`${activeConf.title} ë§¤ì¶œ`} stroke={activeConf.color} strokeWidth={3} dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. ?°ì ??ë°??ì—…??ë¶„ì„ */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
        
        {/* ?‰í˜•ë³??°ì ??*/}
        <div className="glass-panel" style={{padding: '24px', minWidth: 0}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px'}}>
            <div>
              <h3 style={{margin: '0 0 8px 0'}}>?‰í˜•ë³??ë§¤??vs {activeConf.title} ë§¤ì¶œ (?°ì ??</h3>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
                ?’¡ <strong>?´ì„ ê°€?´ë“œ:</strong> ?ë“¤???°ì¸¡ ?ë‹¨(???¼ë¡œ ì¢ê²Œ ë­‰ì³??ë»—ì–´?˜ê°ˆ?˜ë¡, ?´ë‹¹ ?‰í˜•???¬ìˆ™ê°ì´ ?ˆì„ ë§ì´ ?´ë‹¤??ì¦ê±°?…ë‹ˆ??
              </p>
            </div>
            <select 
              value={selectedRoomType} 
              onChange={(e) => setSelectedRoomType(e.target.value)}
              style={{background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: 'none', padding: '6px 12px', borderRadius: '4px', outline: 'none'}}
            >
              <option value="all" style={{color: 'black'}}>?„ì²´ ê°ì‹¤</option>
              <option value="sold16" style={{color: 'black'}}>16??/option>
              <option value="sold35" style={{color: 'black'}}>35??/option>
              <option value="sold51" style={{color: 'black'}}>51??/option>
            </select>
          </div>
          
          <div style={{flex: 1, minHeight: 0, minWidth: 0, width: '100%', height: '300px'}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" dataKey={selectedRoomType === 'all' ? 'totalSold' : selectedRoomType} name="ê°ì‹¤ ?ë§¤(??" stroke="var(--text-muted)" />
                <YAxis type="number" dataKey={activeConf.dataKey} name={`${activeConf.title} ë§¤ì¶œ`} stroke="var(--text-muted)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <ZAxis type="category" dataKey="yearMonth" name="???? />
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                  formatter={(val, name) => name === `${activeConf.title} ë§¤ì¶œ` ? `??{formatCurrency(val)}` : `${val}??}
                />
                <Legend />
                <Scatter name="?”ë³„ ?„í™©" data={filteredProcessedData} fill={activeConf.color} shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ?ì—…?¥ë³„ ?ê?ê´€ê³?TOP */}
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{marginBottom: '20px'}}>{activeConf.title} ???ì—…?¥ë³„ ?ìœ ??ë¯¼ê°??TOP 5</h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>ê°ì‹¤???¬ìˆ™ê°ì´ ë§ì„ ??ê°€??ì§ì ‘?ìœ¼ë¡?ë§¤ì¶œ???°ëŠ” ?ì—…???œìœ„?…ë‹ˆ??</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {locationCorrelations.slice(0, 5).map((loc, idx) => (
              <div key={loc.name} style={{display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px'}}>
                <div style={{width: '24px', fontWeight: 'bold', color: idx === 0 ? activeConf.color : 'var(--text-muted)'}}>{idx + 1}</div>
                <div style={{flex: 1, fontWeight: 'bold'}}>{loc.name}</div>
                <div style={{width: '100px', display: 'flex', alignItems: 'center'}}>
                  <div style={{flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden'}}>
                    <div style={{height: '100%', background: activeConf.color, width: `${Math.max(0, loc.correlation * 100)}%`}}></div>
                  </div>
                </div>
                <div style={{width: '60px', textAlign: 'right', fontWeight: 'bold', color: activeConf.color}}>
                  {loc.correlation.toFixed(2)}
                </div>
              </div>
            ))}
            {locationCorrelations.length === 0 && (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>?´ë‹¹ ë³¸ë????ì—…???°ì´?°ê? ë¶€ì¡±í•©?ˆë‹¤.</div>
            )}
          </div>
        </div>

        {/* ê°ì‹¤ ?ë§¤ì±„ë„ ë¶„ì„ (Pie Chart & Table) */}
        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{marginBottom: '20px'}}>ê°ì‹¤ ?ë§¤ì±„ë„ ?¬ì¸µ ë¶„ì„</h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>ì±„ë„ë³?ë§¤ì¶œ ë¹„ì¤‘ ë°??‰í˜•ë³?ê°ë‹¨ê°€(ADR)ë¥??œëˆˆ??ë¹„êµ?©ë‹ˆ??</p>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
            {/* Pie Chart */}
            <div style={{width: '100%', height: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, minHeight: 0}}>
              <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)'}}>ë§¤ì¶œ ë¹„ì¤‘</h4>
              <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      if (percent < 0.05) return null; // 5% ë¯¸ë§Œ?€ ?¼ë²¨ ?¨ê?
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12px" fontWeight="bold" style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}>
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    outerRadius={95}
                    innerRadius={55}
                    cy="45%"
                    dataKey="value"
                    stroke="rgba(255,255,255,0.1)"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                    formatter={(val) => `??{formatCurrency(val)}`} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              {negativeChannels && negativeChannels.length > 0 && (
                <div style={{marginTop: '10px', fontSize: '11px', color: 'var(--accent-red)', background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: '4px', width: '100%'}}>
                  <strong>? ï¸ ?˜ë¶ˆ/ì¡°ì • ë§ˆì´?ˆìŠ¤ ?´ì—­ (?ê·¸?˜í”„ ë¹„ì¤‘ ?œì™¸??:</strong><br/>
                  {negativeChannels.map(d => `${d.name} (??{formatCurrency(d.value)})`).join(', ')}
                </div>
              )}
            </div>

            {/* ADR Table */}
            <div style={{width: '100%', display: 'flex', flexDirection: 'column'}}>
              <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)', textAlign: 'center'}}>ì±„ë„ë³??‰í˜• ê°ë‹¨ê°€(ADR)</h4>
              <div className="table-scroll-container hide-on-mobile" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right'}}>
                  <thead>
                    <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                      <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)'}}>ì±„ë„ëª?/th>
                      <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>16??/th>
                      <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>35??/th>
                      <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>51??/th>
                      <th style={{padding: '12px', color: 'var(--accent-gold)', borderBottom: '1px solid var(--border-glass)'}}>ì¢…í•©(?‰ê· )</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelAdrData.map((row) => (
                      <tr key={row.channel} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                        <td style={{padding: '12px', textAlign: 'left', fontWeight: 'bold'}}>{row.channel}</td>
                        <td style={{padding: '12px'}}>{row['16??] ? `??{formatCurrency(row['16??])}` : '-'}</td>
                        <td style={{padding: '12px'}}>{row['35??] ? `??{formatCurrency(row['35??])}` : '-'}</td>
                        <td style={{padding: '12px'}}>{row['51??] ? `??{formatCurrency(row['51??])}` : '-'}</td>
                        <td style={{padding: '12px', color: 'var(--accent-gold)', fontWeight: 'bold'}}>
                          {row['?„ì²´'] ? `??{formatCurrency(row['?„ì²´'])}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="show-on-mobile-block" style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {channelAdrData.map((row) => (
                  <div key={row.channel} className="glass-panel" style={{padding: '16px', borderLeft: '4px solid var(--accent-emerald)'}}>
                    <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px'}}>{row.channel}</div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span style={{color: 'var(--text-muted)'}}>16??/span>
                      <span>{row['16??] ? `??{formatCurrency(row['16??])}` : '-'}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span style={{color: 'var(--text-muted)'}}>35??/span>
                      <span>{row['35??] ? `??{formatCurrency(row['35??])}` : '-'}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span style={{color: 'var(--text-muted)'}}>51??/span>
                      <span>{row['51??] ? `??{formatCurrency(row['51??])}` : '-'}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '12px'}}>
                      <span style={{color: 'var(--accent-gold)'}}>ì¢…í•©(?‰ê· )</span>
                      <span style={{color: 'var(--accent-gold)', fontWeight: 'bold'}}>{row['?„ì²´'] ? `??{formatCurrency(row['?„ì²´'])}` : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ì±„ë„ ??ë¶€?€?œì„¤ ê±°ì‹œ???ê?ê´€ê³?(Macro-Correlation) */}
        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{marginBottom: '20px'}}>ì±„ë„ ë¹„ì¤‘ ??ë¶€?€?œì„¤ ë°??„ì²´ë§¤ì¶œ ê±°ì‹œ???ê?ê´€ê³?/h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>?¹ì • ?ˆì•½ ì±„ë„(?¨ë¼?? ?¸ë???????ë§¤ì¶œ ë¹„ì¤‘???’ì•˜???”ì— ê°??ì—…??ë°??„ì²´ë§¤ì¶œ???¼ë§ˆ???¨ê»˜ ?ìŠ¹?ˆëŠ”ì§€ë¥?ë³´ì—¬ì£¼ëŠ” ?ê?ê³„ìˆ˜(-1.0 ~ 1.0)?…ë‹ˆ?? (0.4 ?´ìƒ ?œë ·???°ê?, 0.7 ?´ìƒ ë§¤ìš° ê°•í•œ ?°ê?)</p>
          
          <div className="table-scroll-container hide-on-mobile" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
              <thead>
                <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)'}}>ì±„ë„ëª?/th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>?„ì²´ë§¤ì¶œ (?ê???</th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>?ˆì?ë³¸ë? (?ê???</th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>?ìŒë³¸ë? (?ê???</th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>ëª¨í† ?„ë ˆ??(?ê???</th>
                </tr>
              </thead>
              <tbody>
                {['?¨ë¼??, '?¸ë???, '?´ì–‘??, '?ˆì•½??, '?ˆí˜?´ì?'].map((channel, idx) => {
                  // ì±„ë„ë³??ê?ê³„ìˆ˜ ê³„ì‚°
                  const channelMonthlyRev = filteredProcessedData.map(d => {
                    let total = 0;
                    if (d.rawRoomRecords) {
                      d.rawRoomRecords.forEach(r => {
                        const m = r.marketType || '';
                        if (channel === '?¨ë¼?? && m.includes('?¨ë¼??)) total += r.revenue || 0;
                        else if (channel === '?¸ë??? && (m.includes('?¸ë???) || m.includes('?¨ì²´'))) total += r.revenue || 0;
                        else if (channel === '?´ì–‘?? && (m.includes('ê¸°ì—…') || m.includes('?´ì–‘??))) total += r.revenue || 0;
                        else if (channel === '?ˆì•½?? && (m.includes('?ˆì•½??) || m.includes('?„í™”') || m.includes('ë©”ì‹ ?€'))) total += r.revenue || 0;
                        else if (channel === '?ˆí˜?´ì?' && (m.includes('?ˆí˜?´ì?') || m.includes('APP'))) total += r.revenue || 0;
                      });
                    }
                    return total;
                  });

                  const cTotal = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.totalSales)) || 0;
                  const cLeisure = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.leisureSales)) || 0;
                  const cFnb = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.fnbSales)) || 0;
                  const cMoto = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.motoSales)) || 0;

                  const getColor = (r) => {
                    if (r >= 0.7) return 'var(--accent-emerald)';
                    if (r >= 0.4) return 'var(--accent-gold)';
                    if (r <= -0.4) return 'var(--accent-red)';
                    return 'var(--text-main)';
                  };

                  return (
                    <tr key={channel} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                      <td style={{padding: '12px', textAlign: 'left', fontWeight: 'bold'}}>{channel}</td>
                      <td style={{padding: '12px', color: getColor(cLeisure), fontWeight: cLeisure >= 0.4 ? 'bold' : 'normal'}}>{cLeisure.toFixed(2)}</td>
                      <td style={{padding: '12px', color: getColor(cFnb), fontWeight: cFnb >= 0.4 ? 'bold' : 'normal'}}>{cFnb.toFixed(2)}</td>
                      <td style={{padding: '12px', color: getColor(cMoto), fontWeight: cMoto >= 0.4 ? 'bold' : 'normal'}}>{cMoto.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="show-on-mobile-block" style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {['?¨ë¼??, '?¸ë???, '?´ì–‘??, '?ˆì•½??, '?ˆí˜?´ì?'].map((channel, idx) => {
              const channelMonthlyRev = filteredProcessedData.map(d => {
                let total = 0;
                if (d.rawRoomRecords) {
                  d.rawRoomRecords.forEach(r => {
                    const m = r.marketType || '';
                    if (channel === '?¨ë¼?? && m.includes('?¨ë¼??)) total += r.revenue || 0;
                    else if (channel === '?¸ë??? && (m.includes('?¸ë???) || m.includes('?¨ì²´'))) total += r.revenue || 0;
                    else if (channel === '?´ì–‘?? && (m.includes('ê¸°ì—…') || m.includes('?´ì–‘??))) total += r.revenue || 0;
                    else if (channel === '?ˆì•½?? && (m.includes('?ˆì•½??) || m.includes('?„í™”') || m.includes('ë©”ì‹ ?€'))) total += r.revenue || 0;
                    else if (channel === '?ˆí˜?´ì?' && (m.includes('?ˆí˜?´ì?') || m.includes('APP'))) total += r.revenue || 0;
                  });
                }
                return total;
              });

              const cTotal = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.totalSales)) || 0;
              const cLeisure = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.leisureSales)) || 0;
              const cFnb = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.fnbSales)) || 0;
              const cMoto = calculateCorrelation(channelMonthlyRev, filteredProcessedData.map(d => d.motoSales)) || 0;

              const getColor = (r) => {
                if (r >= 0.7) return 'var(--accent-emerald)';
                if (r >= 0.4) return 'var(--accent-gold)';
                if (r <= -0.4) return 'var(--accent-red)';
                return 'var(--text-main)';
              };

              return (
                <div key={channel} className="glass-panel" style={{padding: '16px', borderLeft: '4px solid var(--accent-blue)'}}>
                  <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px'}}>{channel}</div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <span style={{color: 'var(--text-muted)'}}>?„ì²´ë§¤ì¶œ</span>
                    <span style={{color: getColor(cTotal), fontWeight: cTotal >= 0.4 ? 'bold' : 'normal'}}>{cTotal.toFixed(2)}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <span style={{color: 'var(--text-muted)'}}>?ˆì?ë³¸ë?</span>
                    <span style={{color: getColor(cLeisure), fontWeight: cLeisure >= 0.4 ? 'bold' : 'normal'}}>{cLeisure.toFixed(2)}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <span style={{color: 'var(--text-muted)'}}>?ìŒë³¸ë?</span>
                    <span style={{color: getColor(cFnb), fontWeight: cFnb >= 0.4 ? 'bold' : 'normal'}}>{cFnb.toFixed(2)}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: 'var(--text-muted)'}}>ëª¨í† ?„ë ˆ??/span>
                    <span style={{color: getColor(cMoto), fontWeight: cMoto >= 0.4 ? 'bold' : 'normal'}}>{cMoto.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
