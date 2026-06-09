import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function RevenuePrediction({ monthlyData, settings }) {
  const [targetWeekdayOcc, setTargetWeekdayOcc] = useState(50);
  const [targetWeekendOcc, setTargetWeekendOcc] = useState(80);
  const [initialized, setInitialized] = useState(false);

  // 1. 데이터 가공 및 기초 통계
  const { processedData, globalStats } = useMemo(() => {
    let totalSoldAll = 0;
    let totalInventoryAll = 0;
    let totalSoldWdAll = 0;
    let totalInvWdAll = 0;
    let totalSoldWeAll = 0;
    let totalInvWeAll = 0;
    let totalRoomRevenueAll = 0;
    let totalLeisureRevenueAll = 0;
    let totalGuestsAll = 0;

    const data = [...monthlyData].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)).map(d => {
      const days = d.daysCount || 30;
      const daysWd = d.daysCountWeekday || 22;
      const daysWe = d.daysCountWeekend || 8;
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      
      const guests = (sold16 * 2) + (sold35 * 4) + (sold51 * 6);
      
      const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
      const physicalRooms = Number(settings.totalRooms) || 500;
      const rooms51Sets = Number(settings.connectingRooms51) || 50;
      const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
      
      const totalInventory = dailyInventory * days;
      const invWd = dailyInventory * daysWd;
      const invWe = dailyInventory * daysWe;

      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51);
      const soldWd = Number(d.soldWeekday || 0);
      const soldWe = Number(d.soldWeekend || 0);

      const totalRoomRevenue = Number(d.totalRoomRevenue || 0);
      const revWd = Number(d.revWeekday || 0);
      const revWe = Number(d.revWeekend || 0);
      
      const leisureSales = Number(d.leisureSales || 0);
      const lRevWd = d.leisureRevWd !== undefined ? Number(d.leisureRevWd) : null;
      const lRevWe = d.leisureRevWe !== undefined ? Number(d.leisureRevWe) : null;
      
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
      totalGuestsAll += guests;

      return {
        yearMonth: d.yearMonth,
        occupancyRate: occRate,
        occWd,
        occWe,
        totalRoomRevenue,
        revWd,
        revWe,
        leisureSales,
        lRevWd,
        lRevWe
      };
    });

    const globalOccRate = totalInventoryAll > 0 ? (totalSoldAll / totalInventoryAll) * 100 : 0;
    const globalWdOccRate = totalInvWdAll > 0 ? (totalSoldWdAll / totalInvWdAll) * 100 : 0;
    const globalWeOccRate = totalInvWeAll > 0 ? (totalSoldWeAll / totalInvWeAll) * 100 : 0;
    const avgGuestsPerSoldRoom = totalSoldAll > 0 ? totalGuestsAll / totalSoldAll : 0;
    
    const physicalRooms = Number(settings.totalRooms) || 500;
    const rooms51Sets = Number(settings.connectingRooms51) || 50;
    const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
    const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
    
    const avgWdDays = 22;
    const avgWeDays = 8;

    return { 
      processedData: data, 
      globalStats: {
        totalOccupancyRate: globalOccRate,
        globalWdOccRate,
        globalWeOccRate,
        totalRoomRevenue: totalRoomRevenueAll,
        totalLeisureRevenue: totalLeisureRevenueAll,
        avgGuestsPerSoldRoom,
        dailyInventory,
        avgWdDays,
        avgWeDays
      }
    };
  }, [monthlyData, settings]);

  // 2. 선형 회귀 알고리즘 (Least Squares)
  const { regWd, regWe, regLeisureWd, regLeisureWe, regLeisureTotal, regOverallRoom } = useMemo(() => {
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

  // 목표 매출 계산
  const expRevWd = Math.max(0, regWd.slope * targetWeekdayOcc + regWd.intercept);
  const expRevWe = Math.max(0, regWe.slope * targetWeekendOcc + regWe.intercept);
  const expectedRoomRevenue = expRevWd + expRevWe;

  // 레저 목표 계산
  const targetTotalOcc = ((targetWeekdayOcc * globalStats.avgWdDays) + (targetWeekendOcc * globalStats.avgWeDays)) / (globalStats.avgWdDays + globalStats.avgWeDays);
  
  let expectedLeisureRevenue = 0;
  let expLeisureWd = 0;
  let expLeisureWe = 0;
  
  // 데이터에 주중/주말 분리 레저 매출이 하나라도 있다면 분리 예측 사용, 아니면 통합 예측 사용
  const hasSplitLeisure = processedData.some(d => d.lRevWd !== null);
  
  if (hasSplitLeisure) {
    expLeisureWd = Math.max(0, regLeisureWd.slope * targetWeekdayOcc + regLeisureWd.intercept);
    expLeisureWe = Math.max(0, regLeisureWe.slope * targetWeekendOcc + regLeisureWe.intercept);
    expectedLeisureRevenue = expLeisureWd + expLeisureWe;
  } else {
    expectedLeisureRevenue = Math.max(0, regLeisureTotal.slope * targetTotalOcc + regLeisureTotal.intercept);
  }
  
  const expectedTotalRevenue = expectedRoomRevenue + expectedLeisureRevenue;

  const expSoldWd = (targetWeekdayOcc / 100) * (globalStats.dailyInventory * globalStats.avgWdDays);
  const expSoldWe = (targetWeekendOcc / 100) * (globalStats.dailyInventory * globalStats.avgWeDays);
  const expectedGuests = (expSoldWd + expSoldWe) * globalStats.avgGuestsPerSoldRoom;

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
      trendLeisure: Math.max(0, regLeisureTotal.intercept)
    });
    data.push({
      yearMonth: '예측선 끝점',
      occupancyRate: 100,
      trendRoom: regOverallRoom.slope * 100 + regOverallRoom.intercept,
      trendLeisure: regLeisureTotal.slope * 100 + regLeisureTotal.intercept
    });
    
    data.push({
      yearMonth: '현재 타겟',
      occupancyRate: targetTotalOcc,
      trendRoom: expectedRoomRevenue,
      trendLeisure: expectedLeisureRevenue,
      isTarget: true
    });

    return data.sort((a, b) => a.occupancyRate - b.occupancyRate);
  }, [processedData, regOverallRoom, regLeisureTotal, targetTotalOcc, expectedRoomRevenue, expectedLeisureRevenue]);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* 1. 요약 및 프리젠테이션 시뮬레이터 */}
      <div className="glass-panel" style={{padding: '40px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.9) 100%)', border: '1px solid var(--accent-gold)'}}>
        <h2 style={{color: 'var(--accent-gold)', marginBottom: '8px', textAlign: 'center', fontSize: '28px'}}>차월 목표 매출 프리젠테이션 보드</h2>
        <p style={{fontSize: '16px', color: 'var(--text-muted)', marginBottom: '40px', textAlign: 'center'}}>
          주중 및 주말 점유율 변화에 따른 과거 매출 트렌드를 분석하여 객실 및 레저본부의 예상 수익을 계산합니다.
        </p>
        
        <div style={{display: 'flex', gap: '40px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap'}}>
          <div style={{flex: '1', minWidth: '300px', maxWidth: '400px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
              <span style={{fontSize: '20px'}}>목표 주중 점유율</span>
              <span style={{fontWeight: 'bold', fontSize: '28px', color: 'var(--accent-blue)'}}>{targetWeekdayOcc}%</span>
            </div>
            <input 
              type="range" min="0" max="100" step="1" 
              value={targetWeekdayOcc} 
              onChange={(e) => setTargetWeekdayOcc(Number(e.target.value))}
              style={{width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer', height: '12px'}}
            />
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right'}}>
              (실제 누적 평균: {globalStats.globalWdOccRate.toFixed(1)}%)
            </div>
          </div>
          <div style={{flex: '1', minWidth: '300px', maxWidth: '400px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
              <span style={{fontSize: '20px'}}>목표 주말 점유율</span>
              <span style={{fontWeight: 'bold', fontSize: '28px', color: 'var(--accent-purple)'}}>{targetWeekendOcc}%</span>
            </div>
            <input 
              type="range" min="0" max="100" step="1" 
              value={targetWeekendOcc} 
              onChange={(e) => setTargetWeekendOcc(Number(e.target.value))}
              style={{width: '100%', accentColor: 'var(--accent-purple)', cursor: 'pointer', height: '12px'}}
            />
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right'}}>
              (실제 누적 평균: {globalStats.globalWeOccRate.toFixed(1)}%)
            </div>
          </div>
        </div>

        <div style={{textAlign: 'center', marginBottom: '40px', fontSize: '18px', color: 'var(--text-muted)'}}>
          <span style={{marginRight: '20px'}}>종합 예상 점유율: <strong style={{color: 'var(--accent-emerald)', fontSize: '22px'}}>{targetTotalOcc.toFixed(1)}%</strong></span>
          <span>해당 점유율 달성 시 예상 투숙객: <strong style={{color: 'white', fontSize: '22px'}}>{formatCurrency(expectedGuests)} 명</strong></span>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1000px', margin: '0 auto'}}>
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'}}>
            <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '12px'}}>예상 객실 매출</div>
            <div style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>
              ₩ {formatCurrency(expectedRoomRevenue)}
            </div>
            <div style={{fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px'}}>
              (주중 ₩{formatCurrency(expRevWd)} + 주말 ₩{formatCurrency(expRevWe)})
            </div>
          </div>
          
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'}}>
            <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '12px'}}>예상 레저본부 매출</div>
            <div style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-purple)'}}>
              ₩ {formatCurrency(expectedLeisureRevenue)}
            </div>
            <div style={{fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px'}}>
              {hasSplitLeisure 
                ? `(주중 ₩${formatCurrency(expLeisureWd)} + 주말 ₩${formatCurrency(expLeisureWe)})` 
                : `(종합 점유율 ${targetTotalOcc.toFixed(1)}% 기준 예측)`}
            </div>
          </div>
        </div>

        <div style={{maxWidth: '1000px', margin: '20px auto 0', background: 'rgba(251, 191, 36, 0.1)', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '2px solid var(--accent-gold)'}}>
          <div style={{color: 'var(--accent-gold)', fontSize: '24px', marginBottom: '16px', fontWeight: 'bold'}}>차월 총 예상 수익 (Total Revenue)</div>
          <div style={{fontSize: '64px', fontWeight: '900', color: 'var(--text-main)', textShadow: '0 4px 12px rgba(0,0,0,0.5)'}}>
            ₩ {formatCurrency(expectedTotalRevenue)}
          </div>
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
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: 'var(--text-muted)'}}>총 레저 누적 매출</span>
            <span style={{fontWeight: 'bold', color: 'var(--accent-purple)'}}>₩ {formatCurrency(globalStats.totalLeisureRevenue)}</span>
          </div>
        </div>

        {/* 회귀 분석 차트 */}
        <div className="glass-panel" style={{padding: '24px', height: '450px', display: 'flex', flexDirection: 'column'}}>
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
          <div style={{flex: 1, minHeight: 0, width: '100%'}}>
            <ResponsiveContainer width="100%" height="100%">
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
