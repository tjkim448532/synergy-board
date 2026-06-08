import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';

// 피어슨 상관계수 계산 함수
function calculateCorrelation(xArray, yArray) {
  if (xArray.length !== yArray.length || xArray.length < 2) return null;
  const n = xArray.length;
  const sumX = xArray.reduce((a, b) => a + b, 0);
  const sumY = yArray.reduce((a, b) => a + b, 0);
  const sumX2 = xArray.reduce((a, b) => a + (b * b), 0);
  const sumY2 = yArray.reduce((a, b) => a + (b * b), 0);
  const sumXY = xArray.reduce((acc, val, i) => acc + (val * yArray[i]), 0);

  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val || 0);

export default function AdvancedAnalytics({ monthlyData, settings }) {
  const [selectedRoomType, setSelectedRoomType] = useState('all');

  // 데이터 가공
  const processedData = useMemo(() => {
    // 오래된 순으로 정렬 (그래프용)
    const sorted = [...monthlyData].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    return sorted.map(d => {
      // 영업일수 fallback
      const days = d.daysCount || 30; 
      
      // 51평 산정 방식 설정 반영
      const count51AsTwoRooms = settings.count51AsTwoRooms !== false; // 기본값 true
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51);
      
      // 총 객실 모수 계산
      const physicalRooms = Number(settings.totalRooms) || 500;
      const rooms51Sets = Number(settings.connectingRooms51) || 50;
      const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
      const totalInventory = dailyInventory * days;
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;

      return {
        ...d,
        sold16, sold35, sold51, totalSold,
        occupancyRate: occRate,
        leisureSales: Number(d.leisureSales || 0),
        totalRoomRevenue: Number(d.totalRoomRevenue || 0)
      };
    });
  }, [monthlyData, settings]);

  // 전체 상관계수 계산
  const globalCorrelation = useMemo(() => {
    const occArr = processedData.map(d => d.occupancyRate);
    const leiArr = processedData.map(d => d.leisureSales);
    return calculateCorrelation(occArr, leiArr);
  }, [processedData]);

  // 평형별 상관계수 계산
  const roomTypeCorrelations = useMemo(() => {
    const leiArr = processedData.map(d => d.leisureSales);
    return {
      '16평': calculateCorrelation(processedData.map(d => d.sold16), leiArr),
      '35평': calculateCorrelation(processedData.map(d => d.sold35), leiArr),
      '51평': calculateCorrelation(processedData.map(d => d.sold51), leiArr)
    };
  }, [processedData]);

  // 영업장별 상관계수 계산 (객실 점유율 기준)
  const locationCorrelations = useMemo(() => {
    const occArr = processedData.map(d => d.occupancyRate);
    const locMap = {};
    
    const mapLocationName = (name) => {
      const n = name.replace(/\s+/g, '');
      if (
        n.includes('미디어아트') || 
        n.includes('미디어기념품') || 
        n.includes('미디여기념품') || 
        n.includes('미디어기프트') || 
        n.includes('미디어카페') ||
        n.includes('미디어가페')
      ) {
        return '미디어아트센터';
      }
      if (
        n.includes('목장체험') || 
        name.trim() === '목장' || 
        n.includes('얼룩말카페')
      ) {
        return '목장';
      }
      return name;
    };

    // 모든 영업장 수집 및 병합
    processedData.forEach(d => {
      if (d.leisureSalesByLocation) {
        Object.keys(d.leisureSalesByLocation).forEach(loc => {
          const groupedName = mapLocationName(loc);
          if (!locMap[groupedName]) locMap[groupedName] = new Array(processedData.length).fill(0);
        });
      }
    });

    // 배열 채우기 (동일 그룹으로 묶이는 영업장들의 금액은 합산)
    processedData.forEach((d, i) => {
      if (d.leisureSalesByLocation) {
        Object.entries(d.leisureSalesByLocation).forEach(([loc, amt]) => {
          const groupedName = mapLocationName(loc);
          locMap[groupedName][i] += amt;
        });
      }
    });

    const results = [];
    Object.keys(locMap).forEach(loc => {
      const corr = calculateCorrelation(occArr, locMap[loc]);
      if (corr !== null && !isNaN(corr)) {
        results.push({ name: loc, correlation: corr });
      }
    });

    return results.sort((a, b) => b.correlation - a.correlation);
  }, [processedData]);


  if (processedData.length < 2) {
    return (
      <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
        상관관계를 분석하려면 최소 2개월 이상의 데이터가 필요합니다. 엑셀을 더 업로드해 주세요.
      </div>
    );
  }

  const getInterpretation = (r) => {
    if (r === null || isNaN(r)) return '분석 불가';
    const abs = Math.abs(r);
    if (abs >= 0.7) return '매우 강한 연관성';
    if (abs >= 0.4) return '뚜렷한 연관성';
    if (abs >= 0.2) return '약한 연관성';
    return '거의 무관함';
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      
      {/* 1. 상단 요약 카드 (전체 흐름) */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)'}}>통합 상관계수 (r)</h3>
          <div style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>
            {globalCorrelation ? globalCorrelation.toFixed(3) : 'N/A'}
          </div>
          <div style={{color: 'var(--text-muted)', marginTop: '8px'}}>
            객실 점유율 ↔ 레저 총매출 간의 관계<br/>
            <strong>{getInterpretation(globalCorrelation)}</strong>
          </div>
        </div>

        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)'}}>레저 매출과 가장 연관 깊은 객실 평형</h3>
          <div style={{display: 'flex', gap: '20px', height: '100%', alignItems: 'center'}}>
            {Object.entries(roomTypeCorrelations).map(([type, r]) => (
              <div key={type} style={{flex: 1, background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '18px', fontWeight: 'bold'}}>{type}</div>
                <div style={{fontSize: '24px', color: (r && r > 0.5) ? 'var(--accent-emerald)' : 'var(--text-main)', margin: '8px 0'}}>
                  {r ? r.toFixed(2) : '-'}
                </div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{getInterpretation(r)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 메인 트렌드 차트 */}
      <div className="glass-panel" style={{padding: '24px', height: '400px'}}>
        <h3 style={{marginBottom: '20px'}}>월별 추이: 객실 점유율 vs 레저 총매출</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="yearMonth" stroke="var(--text-muted)" />
            <YAxis yAxisId="left" stroke="var(--accent-emerald)" tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--accent-gold)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
            <RechartsTooltip 
              contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
              formatter={(value, name) => name === '점유율' ? `${value.toFixed(1)}%` : `₩${formatCurrency(value)}`}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="occupancyRate" name="점유율" stroke="var(--accent-emerald)" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
            <Line yAxisId="right" type="monotone" dataKey="leisureSales" name="레저 매출" stroke="var(--accent-gold)" strokeWidth={3} dot={{r: 4}} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 3. 산점도 및 영업장 분석 */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
        
        {/* 평형별 산점도 */}
        <div className="glass-panel" style={{padding: '24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h3 style={{margin: 0}}>평형별 판매량 vs 레저매출 (산점도)</h3>
            <select 
              value={selectedRoomType} 
              onChange={(e) => setSelectedRoomType(e.target.value)}
              style={{background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: 'none', padding: '6px 12px', borderRadius: '4px', outline: 'none'}}
            >
              <option value="all" style={{color: 'black'}}>전체 객실</option>
              <option value="sold16" style={{color: 'black'}}>16평</option>
              <option value="sold35" style={{color: 'black'}}>35평</option>
              <option value="sold51" style={{color: 'black'}}>51평</option>
            </select>
          </div>
          
          <div style={{height: '300px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" dataKey={selectedRoomType === 'all' ? 'totalSold' : selectedRoomType} name="객실 판매(실)" stroke="var(--text-muted)" />
                <YAxis type="number" dataKey="leisureSales" name="레저 매출" stroke="var(--text-muted)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <ZAxis type="category" dataKey="yearMonth" name="연/월" />
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                  formatter={(val, name) => name === '레저 매출' ? `₩${formatCurrency(val)}` : `${val}실`}
                />
                <Scatter data={processedData} fill="var(--accent-blue)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 영업장별 상관관계 TOP */}
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{marginBottom: '20px'}}>영업장별 점유율 민감도 TOP 5</h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>객실에 투숙객이 많을 때 가장 직접적으로 매출이 뛰는 영업장 순위입니다.</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {locationCorrelations.slice(0, 5).map((loc, idx) => (
              <div key={loc.name} style={{display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px'}}>
                <div style={{width: '24px', fontWeight: 'bold', color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-muted)'}}>{idx + 1}</div>
                <div style={{flex: 1, fontWeight: 'bold'}}>{loc.name}</div>
                <div style={{width: '100px', display: 'flex', alignItems: 'center'}}>
                  <div style={{flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden'}}>
                    <div style={{height: '100%', background: 'var(--accent-emerald)', width: `${Math.max(0, loc.correlation * 100)}%`}}></div>
                  </div>
                </div>
                <div style={{width: '60px', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>
                  {loc.correlation.toFixed(2)}
                </div>
              </div>
            ))}
            {locationCorrelations.length === 0 && (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>영업장 상세 데이터가 부족합니다.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
