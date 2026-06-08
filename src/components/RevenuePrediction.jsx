import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val || 0);

export default function RevenuePrediction({ monthlyData, settings }) {
  const [targetOccupancy, setTargetOccupancy] = useState(50);

  // 1. 데이터 가공 및 기초 통계
  const { processedData, globalStats } = useMemo(() => {
    let totalSoldAll = 0;
    let totalInventoryAll = 0;
    let totalRevenueAll = 0;

    const data = [...monthlyData].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)).map(d => {
      const days = d.daysCount || 30;
      const totalInventory = (Number(settings.totalRooms) || 500) * days;
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const totalSold = sold16 + sold35 + sold51;
      const totalRoomRevenue = Number(d.totalRoomRevenue || 0);
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;

      totalSoldAll += totalSold;
      totalInventoryAll += totalInventory;
      totalRevenueAll += totalRoomRevenue;

      return {
        yearMonth: d.yearMonth,
        occupancyRate: occRate,
        totalRoomRevenue: totalRoomRevenue,
      };
    });

    const globalOccRate = totalInventoryAll > 0 ? (totalSoldAll / totalInventoryAll) * 100 : 0;

    return { 
      processedData: data, 
      globalStats: {
        totalOccupancyRate: globalOccRate,
        totalRevenue: totalRevenueAll
      }
    };
  }, [monthlyData, settings]);

  // 2. 선형 회귀 알고리즘 (Least Squares)
  const regressionModel = useMemo(() => {
    const points = processedData.filter(d => d.totalRoomRevenue > 0);
    const n = points.length;
    
    if (n === 0) return { slope: 0, intercept: 0, isFallback: true };
    if (n === 1) {
      // 데이터가 1개뿐이면 단순 비례식 (원점 통과)
      const p = points[0];
      const slope = p.occupancyRate > 0 ? p.totalRoomRevenue / p.occupancyRate : 0;
      return { slope, intercept: 0, isFallback: true };
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    points.forEach(p => {
      const x = p.occupancyRate;
      const y = p.totalRoomRevenue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) {
      return { slope: 0, intercept: sumY / n, isFallback: true };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept, isFallback: false };
  }, [processedData]);

  // 목표 매출 계산
  const expectedRevenue = Math.max(0, regressionModel.slope * targetOccupancy + regressionModel.intercept);

  // 차트용 데이터 (점 + 선)
  const chartData = useMemo(() => {
    // 산점도를 위한 원본 데이터
    const data = processedData.map(d => ({
      ...d,
      actualRevenue: d.totalRoomRevenue, // 점으로 찍힐 실제 데이터
      trendRevenue: null // 추세선 데이터는 나중에
    }));

    // 추세선을 그리기 위해 양 끝점(0%와 100%) 가상 데이터 추가
    data.push({
      yearMonth: '예측선 시작점',
      occupancyRate: 0,
      actualRevenue: null,
      trendRevenue: Math.max(0, regressionModel.intercept)
    });
    data.push({
      yearMonth: '예측선 끝점',
      occupancyRate: 100,
      actualRevenue: null,
      trendRevenue: regressionModel.slope * 100 + regressionModel.intercept
    });
    
    // 현재 타겟 목표점 추가
    data.push({
      yearMonth: '현재 타겟',
      occupancyRate: targetOccupancy,
      actualRevenue: null,
      trendRevenue: expectedRevenue,
      isTarget: true
    });

    return data.sort((a, b) => a.occupancyRate - b.occupancyRate);
  }, [processedData, regressionModel, targetOccupancy, expectedRevenue]);


  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* 1. 요약 및 시뮬레이터 컨트롤 */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px'}}>
        
        {/* 전체 실적 요약 카드 */}
        <div className="glass-panel" style={{padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <h3 style={{color: 'var(--text-muted)', marginBottom: '16px'}}>전체 누적 실적 요약 (모든 데이터 합산)</h3>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <div style={{fontSize: '16px'}}>총 누적 객실 점유율</div>
            <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>
              {globalStats.totalOccupancyRate.toFixed(1)}%
            </div>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px'}}>
            <div style={{fontSize: '16px'}}>총 누적 객실 매출</div>
            <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>
              ₩ {formatCurrency(globalStats.totalRevenue)}
            </div>
          </div>
        </div>

        {/* AI 매출 예측 시뮬레이터 */}
        <div className="glass-panel" style={{padding: '24px', background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)', border: '1px solid var(--accent-emerald)'}}>
          <h3 style={{color: 'var(--accent-emerald)', marginBottom: '8px'}}>AI 목표 점유율 기반 매출 예측 시뮬레이터</h3>
          <p style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px'}}>
            과거의 점유율 대비 매출 트렌드(단가 상승률 포함)를 학습한 알고리즘입니다. 목표 점유율을 조정해 보세요.
          </p>
          
          <div style={{marginBottom: '24px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
              <span>목표 객실 점유율 설정</span>
              <span style={{fontWeight: 'bold', fontSize: '18px', color: 'var(--text-main)'}}>{targetOccupancy}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" step="1" 
              value={targetOccupancy} 
              onChange={(e) => setTargetOccupancy(Number(e.target.value))}
              style={{width: '100%', accentColor: 'var(--accent-emerald)', cursor: 'pointer'}}
            />
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center'}}>
            <div style={{color: 'var(--text-muted)', marginBottom: '8px'}}>점유율 {targetOccupancy}% 도달 시 예상 객실 총 매출액</div>
            <div style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>
              ₩ {formatCurrency(expectedRevenue)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 월별 리스트 및 차트 */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px'}}>
        
        {/* 월별 세부 실적 리스트 */}
        <div className="glass-panel" style={{padding: '24px', maxHeight: '500px', overflowY: 'auto'}}>
          <h3 style={{marginBottom: '16px', position: 'sticky', top: 0, background: 'var(--bg-card)', paddingBottom: '10px', zIndex: 1}}>월별 객실 실적 분석</h3>
          {processedData.length === 0 ? (
            <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>데이터가 없습니다.</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {processedData.map(d => (
                <div key={d.yearMonth} style={{background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px'}}>
                  <div style={{fontWeight: 'bold', fontSize: '18px', marginBottom: '8px'}}>{d.yearMonth}</div>
                  <div style={{display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px'}}>
                    <span>점유율</span>
                    <span style={{color: 'var(--accent-emerald)', fontWeight: 'bold'}}>{d.occupancyRate.toFixed(1)}%</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px'}}>
                    <span>객실 매출</span>
                    <span style={{color: 'var(--accent-blue)', fontWeight: 'bold'}}>₩{formatCurrency(d.totalRoomRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 회귀 분석 차트 */}
        <div className="glass-panel" style={{padding: '24px', height: '500px'}}>
          <h3 style={{marginBottom: '20px'}}>점유율 vs 매출 분포 및 예측 모델 곡선</h3>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" dataKey="occupancyRate" name="점유율" stroke="var(--text-muted)" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <YAxis type="number" dataKey="actualRevenue" name="객실 매출" stroke="var(--text-muted)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
              
              <RechartsTooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                formatter={(val, name) => [ `₩${formatCurrency(val)}`, name === 'actualRevenue' ? '실제 매출' : '예측 매출' ]}
                labelFormatter={(label) => `점유율: ${Number(label).toFixed(1)}%`}
              />
              <Legend />
              
              {/* 실제 데이터 산점도 */}
              <Scatter dataKey="actualRevenue" name="실제 월별 매출" fill="var(--accent-blue)" />
              
              {/* 회귀선 (예측선) */}
              <Line type="monotone" dataKey="trendRevenue" name="AI 예측 트렌드 라인" stroke="var(--accent-emerald)" strokeWidth={2} dot={false} activeDot={false} strokeDasharray="5 5" />
              
              {/* 현재 타겟팅 중인 점 */}
              <Scatter data={chartData.filter(d => d.isTarget)} dataKey="trendRevenue" name="현재 타겟 지점" fill="var(--accent-gold)" shape="star" />

            </ComposedChart>
          </ResponsiveContainer>
        </div>

      </div>

    </div>
  );
}
