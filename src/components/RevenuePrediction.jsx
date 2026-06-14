import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';
import CountUpModule from 'react-countup';
const CountUp = CountUpModule.default || CountUpModule;

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function RevenuePrediction({ monthlyData, settings }) {
  const [targetWeekdayOcc, setTargetWeekdayOcc] = useState(50);
  const [targetWeekendOcc, setTargetWeekendOcc] = useState(80);
  const [initialized, setInitialized] = useState(false);
  const [selectedRefMonth, setSelectedRefMonth] = useState('latest');

  // 1. 데이터 가공 및 기초 통계
  const { processedData, globalStats } = useMemo(() => {
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
    let totalGuestsAll = 0;
    
    let total16All = 0;
    let total35All = 0;
    let total51ConnVirtualAll = 0;
    let total51AccVirtualAll = 0;

    const data = [...monthlyData].sort((a, b) => (a.yearMonth || '').localeCompare(b.yearMonth || '')).map(d => {
      const days = d.daysCount || 30;
      const daysWd = d.daysCountWeekday || 22;
      const daysWe = d.daysCountWeekend || 8;
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      
      const guests = (sold16 * 2) + (sold35 * 4) + (sold51 * 6);
      
      const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
      const physicalRooms = Number(settings.totalRooms) || 175;
      const rooms51Sets = Number(settings.connectingRooms51) || 85;
      const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
      
      const totalInventory = dailyInventory * days;
      const invWd = dailyInventory * daysWd;
      const invWe = dailyInventory * daysWe;

      const sold51Acc = Number(d.sold51Acc || 0);
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
      
      const locationGroups = settings.locationGroups || {};
      let leisureSales = 0;
      let motoSales = 0;
      let lRevWd = 0;
      let lRevWe = 0;
      let mRevWd = 0;
      let mRevWe = 0;
      let fnbSales = 0;
      let fRevWd = 0;
      let fRevWe = 0;

      if (d.salesByLocation) {
        Object.keys(d.salesByLocation).forEach(loc => {
          const group = locationGroups[loc] || 'leisure';
          if (group === 'leisure') {
            leisureSales += d.salesByLocation[loc];
            if (d.salesWdByLocation && d.salesWdByLocation[loc]) lRevWd += d.salesWdByLocation[loc];
            if (d.salesWeByLocation && d.salesWeByLocation[loc]) lRevWe += d.salesWeByLocation[loc];
          } else if (group === 'moto') {
            motoSales += d.salesByLocation[loc];
            if (d.salesWdByLocation && d.salesWdByLocation[loc]) mRevWd += d.salesWdByLocation[loc];
            if (d.salesWeByLocation && d.salesWeByLocation[loc]) mRevWe += d.salesWeByLocation[loc];
          } else if (group === 'fnb') {
            fnbSales += d.salesByLocation[loc];
            if (d.salesWdByLocation && d.salesWdByLocation[loc]) fRevWd += d.salesWdByLocation[loc];
            if (d.salesWeByLocation && d.salesWeByLocation[loc]) fRevWe += d.salesWeByLocation[loc];
          }
        });
      } else {
        // Fallback for legacy DB
        leisureSales = Number(d.leisureSales || 0);
        lRevWd = d.leisureRevWd !== undefined ? Number(d.leisureRevWd) : null;
        lRevWe = d.leisureRevWe !== undefined ? Number(d.leisureRevWe) : null;
      }
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;
      const occWd = invWd > 0 ? (soldWd / invWd) * 100 : 0;
      const occWe = invWe > 0 ? (soldWe / invWe) * 100 : 0;

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
      totalGuestsAll += guests;
      
      total16All += sold16;
      total35All += sold35;
      total51ConnVirtualAll += (count51AsTwoRooms ? sold51 * 2 : sold51);
      total51AccVirtualAll += sold51Acc;

      return {
        yearMonth: d.yearMonth,
        occupancyRate: occRate,
        occWd,
        occWe,
        totalRoomRevenue,
        revWd,
        revWe,
        leisureSales,
        motoSales,
        fnbSales,
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
    
    const physicalRooms = Number(settings.totalRooms) || 175;
    const rooms51Sets = Number(settings.connectingRooms51) || 85;
    const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
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

  // 2. 선형 회귀 알고리즘 (Least Squares)
  const { regWd, regWe, regLeisureWd, regLeisureWe, regLeisureTotal, regMotoWd, regMotoWe, regMotoTotal, regFnbWd, regFnbWe, regFnbTotal, regOverallRoom } = useMemo(() => {
    const calcRegression = (xKey, yKey) => {
      const points = processedData.filter(d => d[yKey] > 0);
      const n = points.length;
      
      if (n === 0) return { slope: 0, intercept: 0 };
      if (n === 1) {
        const p = points[0];
        const slope = p[xKey] > 0 ? p[yKey] / p[xKey] : 0;
        return { slope, intercept: 0 };
      }

      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      points.forEach(p => {
        const x = p[xKey];
        const y = p[yKey];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });

      const denominator = (n * sumX2 - sumX * sumX);
      if (denominator === 0) return { slope: 0, intercept: sumY / n };
      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;
      return { slope, intercept };
    };

    return {
      regWd: calcRegression('occWd', 'revWd'),
      regWe: calcRegression('occWe', 'revWe'),
      regLeisureWd: calcRegression('occWd', 'lRevWd'),
      regLeisureWe: calcRegression('occWe', 'lRevWe'),
      regLeisureTotal: calcRegression('occupancyRate', 'leisureSales'),
      regMotoWd: calcRegression('occWd', 'mRevWd'),
      regMotoWe: calcRegression('occWe', 'mRevWe'),
      regMotoTotal: calcRegression('occupancyRate', 'motoSales'),
      regFnbWd: calcRegression('occWd', 'fRevWd'),
      regFnbWe: calcRegression('occWe', 'fRevWe'),
      regFnbTotal: calcRegression('occupancyRate', 'fnbSales'),
      regOverallRoom: calcRegression('occupancyRate', 'totalRoomRevenue')
    };
  }, [processedData]);

  // 첫 로드 시 슬라이더 기본값을 실제 누적 평균값으로 세팅
  React.useEffect(() => {
    if (!initialized && processedData.length > 0) {
      if (globalStats.globalWdOccRate > 0) setTargetWeekdayOcc(Math.round(globalStats.globalWdOccRate));
      if (globalStats.globalWeOccRate > 0) setTargetWeekendOcc(Math.round(globalStats.globalWeOccRate));
      setInitialized(true);
    }
  }, [processedData, globalStats, initialized]);

  // 1. 기존 선형 회귀 목표 매출 (과거 추세선)
  const expRevWd = Math.max(0, regWd.slope * targetWeekdayOcc + regWd.intercept);
  const expRevWe = Math.max(0, regWe.slope * targetWeekendOcc + regWe.intercept);
  const expectedRoomRevenue = expRevWd + expRevWe;

  // 2. 평형별 목표 객단가(Target ADR) 반영 매출
  const expSoldWd = (targetWeekdayOcc / 100) * (globalStats.dailyInventory * globalStats.avgWdDays);
  const expSoldWe = (targetWeekendOcc / 100) * (globalStats.dailyInventory * globalStats.avgWeDays);
  const totalExpectedSoldRooms = expSoldWd + expSoldWe;
  
  const vExpected16 = totalExpectedSoldRooms * globalStats.mix16Virtual;
  const vExpected35 = totalExpectedSoldRooms * globalStats.mix35Virtual;
  const vExpected51Conn = totalExpectedSoldRooms * globalStats.mix51ConnVirtual;
  const vExpected51Acc = totalExpectedSoldRooms * globalStats.mix51AccVirtual;

  const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
  const physicalExpected16 = vExpected16;
  const physicalExpected35 = vExpected35;
  const physicalExpected51 = (count51AsTwoRooms ? vExpected51Conn / 2 : vExpected51Conn) + vExpected51Acc;

  const targetAdr16 = Number(settings.targetAdr16) || 0;
  const targetAdr35 = Number(settings.targetAdr35) || 0;
  const targetAdr51 = Number(settings.targetAdr51) || 0;
  
  const hasTargetAdr = targetAdr16 > 0 || targetAdr35 > 0 || targetAdr51 > 0;
  let targetAdrRoomRevenue = 0;
  if (hasTargetAdr) {
    targetAdrRoomRevenue = (physicalExpected16 * targetAdr16) + (physicalExpected35 * targetAdr35) + (physicalExpected51 * targetAdr51);
  }

  // 레저 목표 계산
  const targetTotalOcc = ((targetWeekdayOcc * globalStats.avgWdDays) + (targetWeekendOcc * globalStats.avgWeDays)) / (globalStats.avgWdDays + globalStats.avgWeDays);
  
  let expectedLeisureRevenue = 0;
  let expLeisureWd = 0;
  let expLeisureWe = 0;
  
  let expectedMotoRevenue = 0;
  let expMotoWd = 0;
  let expMotoWe = 0;
  
  let expectedFnbRevenue = 0;
  let expFnbWd = 0;
  let expFnbWe = 0;
  
  // 데이터에 주중/주말 분리 레저 매출이 하나라도 있다면 분리 예측 사용, 아니면 통합 예측 사용
  const hasSplitLeisure = processedData.some(d => d.lRevWd !== null);
  
  if (hasSplitLeisure) {
    expLeisureWd = Math.max(0, regLeisureWd.slope * targetWeekdayOcc + regLeisureWd.intercept);
    expLeisureWe = Math.max(0, regLeisureWe.slope * targetWeekendOcc + regLeisureWe.intercept);
    expectedLeisureRevenue = expLeisureWd + expLeisureWe;

    expectedMotoRevenue = Math.max(0, regMotoTotal.slope * targetTotalOcc + regMotoTotal.intercept);

    expFnbWd = Math.max(0, regFnbWd.slope * targetWeekdayOcc + regFnbWd.intercept);
    expFnbWe = Math.max(0, regFnbWe.slope * targetWeekendOcc + regFnbWe.intercept);
    expectedFnbRevenue = expFnbWd + expFnbWe;
  } else {
    expectedLeisureRevenue = Math.max(0, regLeisureTotal.slope * targetTotalOcc + regLeisureTotal.intercept);
    expectedMotoRevenue = Math.max(0, regMotoTotal.slope * targetTotalOcc + regMotoTotal.intercept);
    expectedFnbRevenue = Math.max(0, regFnbTotal.slope * targetTotalOcc + regFnbTotal.intercept);
  }
  
  const expectedTotalRevenue = expectedRoomRevenue + expectedLeisureRevenue + expectedMotoRevenue + expectedFnbRevenue;
  const targetAdrTotalRevenue = targetAdrRoomRevenue + expectedLeisureRevenue + expectedMotoRevenue + expectedFnbRevenue;

  const expectedGuests = totalExpectedSoldRooms * globalStats.avgGuestsPerSoldRoom;

  // 차트용 데이터 (전체 점유율 대비 트렌드)
  const chartData = useMemo(() => {
    const data = processedData.map(d => ({
      ...d,
      actualRoomRevenue: d.totalRoomRevenue,
      actualLeisureRevenue: d.leisureSales,
      trendRoom: null,
      trendLeisure: null
    }));

    data.push({
      yearMonth: '예측선 시작점',
      occupancyRate: 0,
      trendRoom: Math.max(0, regOverallRoom.intercept),
      trendLeisure: Math.max(0, regLeisureTotal.intercept),
      trendMoto: Math.max(0, regMotoTotal.intercept)
    });
    data.push({
      yearMonth: '예측선 끝점',
      occupancyRate: 100,
      trendRoom: regOverallRoom.slope * 100 + regOverallRoom.intercept,
      trendLeisure: regLeisureTotal.slope * 100 + regLeisureTotal.intercept,
      trendMoto: regMotoTotal.slope * 100 + regMotoTotal.intercept
    });
    
    data.push({
      yearMonth: '현재 타겟',
      occupancyRate: targetTotalOcc,
      trendRoom: expectedRoomRevenue,
      trendLeisure: expectedLeisureRevenue,
      trendMoto: expectedMotoRevenue,
      isTarget: true
    });

    return data.sort((a, b) => a.occupancyRate - b.occupancyRate);
  }, [processedData, regOverallRoom, regLeisureTotal, regMotoTotal, targetTotalOcc, expectedRoomRevenue, expectedLeisureRevenue, expectedMotoRevenue]);

  const monthOptions = useMemo(() => {
    return [...processedData].map(d => d.yearMonth).sort((a, b) => b.localeCompare(a));
  }, [processedData]);

  const refData = useMemo(() => {
    if (processedData.length === 0) return null;
    if (selectedRefMonth === 'all') {
      return {
        label: `전체 누적 (${processedData.length}개월)`,
        totalRev: globalStats.totalRoomRevenue + globalStats.totalLeisureRevenue + globalStats.totalFnbRevenue,
        occRate: globalStats.totalOccupancyRate,
        wdOccRate: globalStats.globalWdOccRate,
        weOccRate: globalStats.globalWeOccRate,
        occLabel: '누적 평균 점유율'
      };
    } else {
      const targetMonth = selectedRefMonth === 'latest' ? processedData[processedData.length - 1].yearMonth : selectedRefMonth;
      const monthRow = processedData.find(d => d.yearMonth === targetMonth) || processedData[processedData.length - 1];
      return {
        label: `선택 마감 실적 (${monthRow.yearMonth})`,
        totalRev: monthRow.totalRoomRevenue + monthRow.leisureSales + monthRow.fnbSales,
        occRate: monthRow.occupancyRate,
        wdOccRate: monthRow.occWd,
        weOccRate: monthRow.occWe,
        occLabel: '해당 월 점유율'
      };
    }
  }, [processedData, globalStats, selectedRefMonth]);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* 1. 과거 실적 조회 */}
      <div className="glass-panel" style={{padding: '40px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.7) 100%)', border: '1px solid rgba(255,255,255,0.1)'}}>
        <h2 style={{color: 'var(--text-main)', marginBottom: '8px', textAlign: 'center', fontSize: '28px'}}>과거 실적 및 누적 데이터 조회</h2>
        <p style={{fontSize: '16px', color: 'var(--text-muted)', marginBottom: '40px', textAlign: 'center'}}>
          이전 달의 마감 실적을 확인하거나, 전체 기간의 누적 평균 점유율 및 합계 매출을 조회할 수 있습니다.
        </p>

        <div style={{display: 'flex', justifyContent: 'center', marginBottom: '20px'}}>
          <select 
            value={selectedRefMonth} 
            onChange={(e) => setSelectedRefMonth(e.target.value)}
            style={{background: 'rgba(255,255,255,0.1)', color: 'var(--accent-emerald)', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '8px', outline: 'none', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold'}}
          >
            <option value="latest" style={{color: 'black'}}>가장 최근 마감월</option>
            <option value="all" style={{color: 'black'}}>전체 누적 통합</option>
            {monthOptions.map(m => (
              <option key={m} value={m} style={{color: 'black'}}>{m}</option>
            ))}
          </select>
        </div>
        
        {refData && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid var(--accent-emerald)', 
            borderRadius: '12px', 
            padding: '24px', 
            display: 'flex', 
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{textAlign: 'center', flex: '1', minWidth: '250px', maxWidth: '100%'}}>
              <div style={{color: 'var(--accent-emerald)', fontSize: '16px', marginBottom: '8px', fontWeight: 'bold'}}>📌 {refData.label}</div>
              <div className="responsive-stat-value">
                객실+레저+식음 총매출 <span style={{fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'normal', verticalAlign: 'middle'}}>(모토 제외)</span>: <span style={{color: 'var(--accent-gold)'}}>₩ {formatCurrency(refData.totalRev)}</span>
              </div>
            </div>
            <div className="mobile-no-border" style={{textAlign: 'center', flex: '1', minWidth: '150px', maxWidth: '100%', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px'}}>
              <div style={{color: 'var(--accent-emerald)', fontSize: '16px', marginBottom: '8px', fontWeight: 'bold'}}>{refData.occLabel}</div>
              <div className="responsive-stat-value">
                {refData.occRate.toFixed(1)}%
              </div>
              <div style={{display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px'}}>
                <div style={{fontSize: '14px'}}>
                  <span style={{color: 'var(--text-muted)'}}>주중: </span>
                  <span style={{color: 'var(--accent-blue)', fontWeight: 'bold'}}>{refData.wdOccRate.toFixed(1)}%</span>
                </div>
                <div style={{fontSize: '14px'}}>
                  <span style={{color: 'var(--text-muted)'}}>주말: </span>
                  <span style={{color: 'var(--accent-purple)', fontWeight: 'bold'}}>{refData.weOccRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. 미래 목표 시뮬레이터 */}
      <div className="glass-panel" style={{padding: '40px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.9) 100%)', border: '1px solid var(--accent-gold)'}}>
        <h2 style={{color: 'var(--accent-gold)', marginBottom: '8px', textAlign: 'center', fontSize: '28px'}}>차월 목표 매출 프리젠테이션 보드</h2>
        <p style={{fontSize: '16px', color: 'var(--text-muted)', marginBottom: '40px', textAlign: 'center'}}>
          슬라이더를 조작하여 목표 주중 및 주말 점유율에 따른 예상 매출과 투숙객 수를 시뮬레이션 합니다.
        </p>

        <div style={{display: 'flex', gap: '40px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap'}}>
          <div style={{flex: '1', minWidth: '250px', maxWidth: '400px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
              <span style={{fontSize: '20px'}}>목표 주중 점유율</span>
              <span style={{fontWeight: 'bold', fontSize: '28px', color: 'var(--accent-blue)'}}>{targetWeekdayOcc}%</span>
            </div>
            <input 
              className="custom-handle-slider"
              type="range" min="0" max="100" step="1" 
              value={targetWeekdayOcc} 
              onChange={(e) => setTargetWeekdayOcc(Number(e.target.value))}
              style={{'--accent-color': 'var(--accent-blue)'}}
            />
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right'}}>
              (실제 누적 평균: {globalStats.globalWdOccRate.toFixed(1)}%)
            </div>
          </div>
          <div style={{flex: '1', minWidth: '250px', maxWidth: '400px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
              <span style={{fontSize: '20px'}}>목표 주말 점유율</span>
              <span style={{fontWeight: 'bold', fontSize: '28px', color: 'var(--accent-purple)'}}>{targetWeekendOcc}%</span>
            </div>
            <input 
              className="custom-handle-slider"
              type="range" min="0" max="100" step="1" 
              value={targetWeekendOcc} 
              onChange={(e) => setTargetWeekendOcc(Number(e.target.value))}
              style={{'--accent-color': 'var(--accent-purple)'}}
            />
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right'}}>
              (실제 누적 평균: {globalStats.globalWeOccRate.toFixed(1)}%)
            </div>
          </div>
        </div>

        <div style={{textAlign: 'center', marginBottom: '40px', fontSize: '18px', color: 'var(--text-muted)'}}>
          <span style={{marginRight: '20px'}}>종합 예상 점유율: <strong style={{color: 'var(--accent-emerald)', fontSize: '22px'}}>{targetTotalOcc.toFixed(1)}%</strong></span>
          <span>해당 점유율 달성 시 예상 투숙객: <strong style={{color: 'white', fontSize: '22px'}}><CountUp end={expectedGuests} formattingFn={formatCurrency} duration={0.6} preserveValue /> 명</strong></span>
        </div>

        <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: '20px', maxWidth: '1200px', margin: '0 auto'}}>
          <div style={{flex: '1 1 240px', background: 'rgba(0,0,0,0.3)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
            <div>
              <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '16px'}}>예상 객실 매출</div>
              
              {hasTargetAdr ? (
                <div style={{display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center'}}>
                  <div style={{flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.2)'}}>
                    <div style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px'}}>과거 추세선 기준</div>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-muted)'}}>
                      ₩ <CountUp end={expectedRoomRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
                    </div>
                  </div>
                  
                  <div style={{color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '20px'}}>VS</div>
                  
                  <div style={{flex: 1, padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid var(--accent-emerald)', position: 'relative'}}>
                    <div style={{position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-emerald)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                      목표 객단가 달성 시
                    </div>
                    <div style={{fontSize: '13px', color: 'var(--accent-emerald)', marginBottom: '8px', marginTop: '4px'}}>전략 목표 기준</div>
                    <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>
                      ₩ <CountUp end={targetAdrRoomRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
                    </div>
                    <div style={{fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '8px'}}>
                      추가수익: +₩{formatCurrency(targetAdrRoomRevenue - expectedRoomRevenue)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="responsive-large-number" style={{color: 'var(--accent-blue)', whiteSpace: 'nowrap'}}>
                    ₩ <CountUp end={expectedRoomRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
                  </div>
                </>
              )}
            </div>
            
            {!hasTargetAdr && (
              <div style={{marginTop: '16px'}}>
                <div style={{fontSize: '14px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <span>주중 ₩{formatCurrency(expRevWd)}</span>
                  <span>주말 ₩{formatCurrency(expRevWe)}</span>
                </div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', wordBreak: 'keep-all', lineHeight: '1.4'}}>
                  * 설정에서 목표 객단가를 입력하시면 전략적 시뮬레이션이 가능합니다.
                </div>
              </div>
            )}
          </div>
          
          <div style={{flex: '1 1 240px', background: 'rgba(0,0,0,0.3)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
            <div>
              <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '16px'}}>예상 레저본부 매출</div>
              <div className="responsive-large-number" style={{color: 'var(--accent-purple)', whiteSpace: 'nowrap'}}>
                ₩ <CountUp end={expectedLeisureRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
              </div>
            </div>
            <div style={{marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {hasSplitLeisure 
                ? <><span>주중 ₩{formatCurrency(expLeisureWd)}</span><span>주말 ₩{formatCurrency(expLeisureWe)}</span></>
                : <span>(종합 점유율 {targetTotalOcc.toFixed(1)}% 기준 예측)</span>}
            </div>
          </div>
          
          {/* 예상 모토아레나 매출 */}
          <div style={{flex: '1 1 240px', background: 'rgba(0,0,0,0.3)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
            <div>
              <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '16px'}}>예상 모토아레나 매출</div>
              <div className="responsive-large-number" style={{color: 'var(--accent-gold)', whiteSpace: 'nowrap'}}>
                ₩ <CountUp end={expectedMotoRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
              </div>
            </div>
            <div style={{marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <span>(종합 점유율 {targetTotalOcc.toFixed(1)}% 기준 예측)</span>
            </div>
          </div>

          {/* 예상 식음본부 매출 */}
          <div style={{flex: '1 1 240px', background: 'rgba(0,0,0,0.3)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
            <div>
              <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '16px'}}>예상 식음본부 매출</div>
              <div className="responsive-large-number" style={{color: 'var(--accent-blue)', whiteSpace: 'nowrap'}}>
                ₩ <CountUp end={expectedFnbRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
              </div>
            </div>
            <div style={{marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {hasSplitLeisure 
                ? <><span>주중 ₩{formatCurrency(expFnbWd)}</span><span>주말 ₩{formatCurrency(expFnbWe)}</span></>
                : <span>(종합 점유율 {targetTotalOcc.toFixed(1)}% 기준 예측)</span>}
            </div>
          </div>
        </div>

        <div style={{maxWidth: '1200px', margin: '20px auto 0', background: 'rgba(251, 191, 36, 0.1)', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '2px solid var(--accent-gold)'}}>
          <div style={{color: 'var(--accent-gold)', fontSize: '24px', marginBottom: '16px', fontWeight: 'bold'}}>차월 총 예상 수익 (Total Revenue)</div>
          <div className="responsive-huge-number">
            ₩ <CountUp end={hasTargetAdr ? targetAdrTotalRevenue : expectedTotalRevenue} formattingFn={formatCurrency} duration={0.6} preserveValue />
          </div>
          {hasTargetAdr && (
            <div style={{color: 'var(--text-muted)', fontSize: '16px', marginTop: '12px'}}>
              (과거 추세선 기준 총매출액: ₩ {formatCurrency(expectedTotalRevenue)})
            </div>
          )}
        </div>
      </div>

      {/* 2. 누적 요약 및 차트 */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px'}}>
        
        {/* 누적 실적 카드 */}
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px'}}>전체 누적 데이터 현황</h3>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
            <span style={{color: 'var(--text-muted)'}}>평균 전체 점유율</span>
            <span style={{fontWeight: 'bold', fontSize: '18px'}}>{globalStats.totalOccupancyRate.toFixed(1)}%</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
            <span style={{color: 'var(--text-muted)'}}>- 평균 주중 점유율</span>
            <span style={{fontWeight: 'bold', fontSize: '15px', color: 'var(--accent-blue)'}}>{globalStats.globalWdOccRate.toFixed(1)}%</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px'}}>
            <span style={{color: 'var(--text-muted)'}}>- 평균 주말 점유율</span>
            <span style={{fontWeight: 'bold', fontSize: '15px', color: 'var(--accent-purple)'}}>{globalStats.globalWeOccRate.toFixed(1)}%</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
            <span style={{color: 'var(--text-muted)'}}>총 객실 누적 매출</span>
            <span style={{fontWeight: 'bold', color: 'var(--accent-blue)'}}>₩ {formatCurrency(globalStats.totalRoomRevenue)}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
            <span style={{color: 'var(--text-muted)'}}>총 레저 누적 매출</span>
            <span style={{fontWeight: 'bold', color: 'var(--accent-purple)'}}>₩ {formatCurrency(globalStats.totalLeisureRevenue)}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
            <span style={{color: 'var(--text-muted)'}}>총 모토 누적 매출</span>
            <span style={{fontWeight: 'bold', color: 'var(--accent-gold)'}}>₩ {formatCurrency(globalStats.totalMotoRevenue)}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: 'var(--text-muted)'}}>총 식음 누적 매출</span>
            <span style={{fontWeight: 'bold', color: 'var(--accent-emerald)'}}>₩ {formatCurrency(globalStats.totalFnbRevenue)}</span>
          </div>
        </div>

        {/* 회귀 분석 차트 */}
        <div className="glass-panel" style={{padding: '24px', minWidth: 0}}>
          <div style={{marginBottom: '20px'}}>
            <h3 style={{margin: '0 0 8px 0'}}>전체 점유율 vs 통합 매출 예측 트렌드 (객실/레저)</h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
              💡 <strong>해석 가이드:</strong> 둥근 점들은 <strong>'과거의 실제 성적'</strong>을 나타내고, 직선(---)은 AI가 과거 데이터를 바탕으로 그어놓은 <strong>'미래 매출 예측 궤도'</strong>입니다.
              <br/>
              <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)'}}>
                (※ 세로축의 'M'은 백만 단위를 뜻합니다. 예: 800M = 8억 원)
              </span>
            </p>
          </div>
          <div style={{width: '100%', height: '400px', minWidth: 0, minHeight: 0}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" dataKey="occupancyRate" name="종합 점유율" stroke="var(--text-muted)" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <YAxis yAxisId="left" type="number" stroke="var(--accent-blue)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <YAxis yAxisId="right" orientation="right" type="number" stroke="var(--accent-purple)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                  formatter={(val, name) => [ `₩${formatCurrency(val)}`, name ]}
                  labelFormatter={(label) => `종합 점유율: ${Number(label).toFixed(1)}%`}
                />
                <Legend />
                
                <Scatter yAxisId="left" dataKey="actualRoomRevenue" name="실제 객실매출" fill="var(--accent-blue)" />
                <Scatter yAxisId="right" dataKey="actualLeisureRevenue" name="실제 레저매출" fill="var(--accent-purple)" />
                
                <Line yAxisId="left" connectNulls={true} type="monotone" dataKey="trendRoom" name="객실 예측선" stroke="var(--accent-blue)" strokeWidth={2} dot={false} activeDot={false} strokeDasharray="5 5" />
                <Line yAxisId="right" connectNulls={true} type="monotone" dataKey="trendLeisure" name="레저 예측선" stroke="var(--accent-purple)" strokeWidth={2} dot={false} activeDot={false} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
