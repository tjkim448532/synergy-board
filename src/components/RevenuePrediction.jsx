import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function RevenuePrediction({ monthlyData, settings }) {
  const [targetOccupancy, setTargetOccupancy] = useState(50);

  // 1. 데이터 가공 및 기초 통계
  const { processedData, globalStats } = useMemo(() => {
    let totalSoldAll = 0;
    let totalInventoryAll = 0;
    let totalRoomRevenueAll = 0;
    let totalLeisureRevenueAll = 0;

    const data = [...monthlyData].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)).map(d => {
      const days = d.daysCount || 30;
      const totalInventory = (Number(settings.totalRooms) || 500) * days;
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const totalSold = sold16 + sold35 + sold51;
      const totalRoomRevenue = Number(d.totalRoomRevenue || 0);
      const leisureSales = Number(d.leisureSales || 0);
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;

      totalSoldAll += totalSold;
      totalInventoryAll += totalInventory;
      totalRoomRevenueAll += totalRoomRevenue;
      totalLeisureRevenueAll += leisureSales;

      return {
        yearMonth: d.yearMonth,
        occupancyRate: occRate,
        totalRoomRevenue: totalRoomRevenue,
        leisureSales: leisureSales
      };
    });

    const globalOccRate = totalInventoryAll > 0 ? (totalSoldAll / totalInventoryAll) * 100 : 0;

    return { 
      processedData: data, 
      globalStats: {
        totalOccupancyRate: globalOccRate,
        totalRoomRevenue: totalRoomRevenueAll,
        totalLeisureRevenue: totalLeisureRevenueAll
      }
    };
  }, [monthlyData, settings]);

  // 2. 선형 회귀 알고리즘 (Least Squares) - 객실 & 레저 각각 계산
  const { roomRegression, leisureRegression } = useMemo(() => {
    const calcRegression = (yKey) => {
      const points = processedData.filter(d => d[yKey] > 0);
      const n = points.length;
      
      if (n === 0) return { slope: 0, intercept: 0 };
      if (n === 1) {
        const p = points[0];
        const slope = p.occupancyRate > 0 ? p[yKey] / p.occupancyRate : 0;
        return { slope, intercept: 0 };
      }

      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      points.forEach(p => {
        const x = p.occupancyRate;
        const y = p[yKey];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });

      const denominator = (n * sumX2 - sumX * sumX);
      if (denominator === 0) {
        return { slope: 0, intercept: sumY / n };
      }

      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;

      return { slope, intercept };
    };

    return {
      roomRegression: calcRegression('totalRoomRevenue'),
      leisureRegression: calcRegression('leisureSales')
    };
  }, [processedData]);

  // 목표 매출 계산
  const expectedRoomRevenue = Math.max(0, roomRegression.slope * targetOccupancy + roomRegression.intercept);
  const expectedLeisureRevenue = Math.max(0, leisureRegression.slope * targetOccupancy + leisureRegression.intercept);
  const expectedTotalRevenue = expectedRoomRevenue + expectedLeisureRevenue;

  // 차트용 데이터 (점 + 선)
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
      trendRoom: Math.max(0, roomRegression.intercept),
      trendLeisure: Math.max(0, leisureRegression.intercept)
    });
    data.push({
      yearMonth: '예측선 끝점',
      occupancyRate: 100,
      trendRoom: roomRegression.slope * 100 + roomRegression.intercept,
      trendLeisure: leisureRegression.slope * 100 + leisureRegression.intercept
    });
    
    data.push({
      yearMonth: '현재 타겟',
      occupancyRate: targetOccupancy,
      trendRoom: expectedRoomRevenue,
      trendLeisure: expectedLeisureRevenue,
      isTarget: true
    });

    return data.sort((a, b) => a.occupancyRate - b.occupancyRate);
  }, [processedData, roomRegression, leisureRegression, targetOccupancy, expectedRoomRevenue, expectedLeisureRevenue]);


  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* 1. 요약 및 프리젠테이션 시뮬레이터 */}
      <div className="glass-panel" style={{padding: '40px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.9) 100%)', border: '1px solid var(--accent-gold)'}}>
        <h2 style={{color: 'var(--accent-gold)', marginBottom: '8px', textAlign: 'center', fontSize: '28px'}}>차월 목표 매출 프리젠테이션 보드</h2>
        <p style={{fontSize: '16px', color: 'var(--text-muted)', marginBottom: '40px', textAlign: 'center'}}>
          과거의 점유율 대비 매출 트렌드 변화율을 학습하여 객실 및 레저본부의 예상 수익을 계산합니다.
        </p>
        
        <div style={{maxWidth: '800px', margin: '0 auto', marginBottom: '40px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
            <span style={{fontSize: '20px'}}>목표 객실 점유율 (Occupancy)</span>
            <span style={{fontWeight: 'bold', fontSize: '32px', color: 'var(--accent-emerald)'}}>{targetOccupancy}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" step="1" 
            value={targetOccupancy} 
            onChange={(e) => setTargetOccupancy(Number(e.target.value))}
            style={{width: '100%', accentColor: 'var(--accent-emerald)', cursor: 'pointer', height: '12px'}}
          />
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1000px', margin: '0 auto'}}>
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'}}>
            <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '12px'}}>예상 객실 매출</div>
            <div style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>
              ₩ {formatCurrency(expectedRoomRevenue)}
            </div>
          </div>
          
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'}}>
            <div style={{color: 'var(--text-muted)', fontSize: '18px', marginBottom: '12px'}}>예상 레저본부 매출</div>
            <div style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-purple)'}}>
              ₩ {formatCurrency(expectedLeisureRevenue)}
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
            <span style={{color: 'var(--text-muted)'}}>평균 객실 점유율</span>
            <span style={{fontWeight: 'bold', fontSize: '18px'}}>{globalStats.totalOccupancyRate.toFixed(1)}%</span>
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
        <div className="glass-panel" style={{padding: '24px', height: '400px'}}>
          <h3 style={{marginBottom: '20px'}}>점유율 vs 통합 매출 예측 트렌드 (객실/레저)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" dataKey="occupancyRate" name="점유율" stroke="var(--text-muted)" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <YAxis yAxisId="left" type="number" stroke="var(--accent-blue)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
              <YAxis yAxisId="right" orientation="right" type="number" stroke="var(--accent-purple)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
              
              <RechartsTooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                formatter={(val, name) => [ `₩${formatCurrency(val)}`, name ]}
                labelFormatter={(label) => `점유율: ${Number(label).toFixed(1)}%`}
              />
              <Legend />
              
              {/* 실제 데이터 산점도 */}
              <Scatter yAxisId="left" dataKey="actualRoomRevenue" name="실제 객실매출" fill="var(--accent-blue)" />
              <Scatter yAxisId="right" dataKey="actualLeisureRevenue" name="실제 레저매출" fill="var(--accent-purple)" />
              
              {/* 회귀선 (예측선) */}
              <Line yAxisId="left" type="monotone" dataKey="trendRoom" name="객실 예측선" stroke="var(--accent-blue)" strokeWidth={2} dot={false} activeDot={false} strokeDasharray="5 5" />
              <Line yAxisId="right" type="monotone" dataKey="trendLeisure" name="레저 예측선" stroke="var(--accent-purple)" strokeWidth={2} dot={false} activeDot={false} strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

      </div>

    </div>
  );
}
