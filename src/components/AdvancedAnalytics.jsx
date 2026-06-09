import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, PieChart, Pie, Cell
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
  const [activeDivision, setActiveDivision] = useState('leisure');

  const divisionConfig = {
    leisure: { title: '레저본부', dataKey: 'leisureSales', color: 'var(--accent-purple)' },
    fnb: { title: '식음본부', dataKey: 'fnbSales', color: 'var(--accent-blue)' },
    moto: { title: '모토아레나', dataKey: 'motoSales', color: 'var(--accent-gold)' }
  };
  const activeConf = divisionConfig[activeDivision];

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
      const sold51Acc = Number(d.sold51Acc || 0);
      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51) + sold51Acc;
      
      // 총 객실 모수 계산 (고정값)
      const physicalRooms = Number(settings.totalRooms) || 175;
      const rooms51Sets = Number(settings.connectingRooms51) || 85;
      const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
      const totalInventory = dailyInventory * days;
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;

      // 동적 매출 합산 로직
      const locationGroups = settings.locationGroups || {};
      let leisureSales = 0;
      let motoSales = 0;
      let fnbSales = 0;

      if (d.salesByLocation) {
        Object.keys(d.salesByLocation).forEach(loc => {
          const group = locationGroups[loc] || 'leisure';
          if (group === 'leisure') {
            leisureSales += d.salesByLocation[loc];
          } else if (group === 'moto') {
            motoSales += d.salesByLocation[loc];
          } else if (group === 'fnb') {
            fnbSales += d.salesByLocation[loc];
          }
        });
      } else {
        // Fallback for legacy DB
        leisureSales = Number(d.totalLeisureSales || d.leisureSales || 0);
      }

      return {
        ...d,
        sold16, sold35, sold51: sold51 + sold51Acc, totalSold,
        occupancyRate: occRate,
        leisureSales,
        motoSales,
        fnbSales,
        totalRoomRevenue: Number(d.totalRoomRevenue || 0)
      };
    });
  }, [monthlyData, settings]);

  // 선택된 본부의 전체 상관계수 계산
  const activeGlobalCorrelation = useMemo(() => {
    const occArr = processedData.map(d => d.occupancyRate);
    const targetArr = processedData.map(d => d[activeConf.dataKey]);
    return calculateCorrelation(occArr, targetArr);
  }, [processedData, activeConf.dataKey]);

  // 선택된 본부의 평형별 상관계수 계산
  const activeRoomTypeCorrelations = useMemo(() => {
    const targetArr = processedData.map(d => d[activeConf.dataKey]);
    return {
      '16평': calculateCorrelation(processedData.map(d => d.sold16), targetArr),
      '35평': calculateCorrelation(processedData.map(d => d.sold35), targetArr),
      '51평': calculateCorrelation(processedData.map(d => d.sold51), targetArr)
    };
  }, [processedData, activeConf.dataKey]);

  // 영업장별 상관계수 계산 (객실 점유율 기준)
  const locationCorrelations = useMemo(() => {
    const occArr = processedData.map(d => d.occupancyRate);
    const locMap = {};
    
    const mapLocationName = (name) => {
      const n = name.replace(/[\s-]+/g, '');
      if (
        n.includes('미디어아트') || 
        n.includes('미디어기념품') || 
        n.includes('미디여기념품') || 
        n.includes('미디어기프트') || 
        n.includes('미디어카페') ||
        n.includes('뮤지엄카페') ||
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

    const locationGroups = settings.locationGroups || {};

    processedData.forEach((d, i) => {
      const salesObj = d.salesByLocation || d.leisureSalesByLocation || {};
      Object.entries(salesObj).forEach(([loc, amt]) => {
        const group = locationGroups[loc] || 'leisure';
        if (group === activeDivision) {
          const groupedName = mapLocationName(loc);
          if (!locMap[groupedName]) locMap[groupedName] = new Array(processedData.length).fill(0);
          locMap[groupedName][i] += amt;
        }
      });
    });

    const results = [];
    Object.keys(locMap).forEach(loc => {
      const dataArr = locMap[loc];
      const totalAmt = dataArr.reduce((sum, val) => sum + val, 0);
      
      if (totalAmt < 1000000 * processedData.length) return;

      const corr = calculateCorrelation(occArr, dataArr);
      if (corr !== null && !isNaN(corr)) {
        results.push({ name: loc, correlation: corr });
      }
    });

    return results.sort((a, b) => b.correlation - a.correlation);
  }, [processedData, settings.locationGroups, activeDivision]);

  // 객실 판매채널(Market Type) 데이터 집계
  const channelData = useMemo(() => {
    const channelMap = {
      '온라인': 0,
      '세미나': 0,
      '휴양소': 0,
      '예약실': 0,
      '홈페이지': 0,
      '기타': 0
    };

    monthlyData.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const market = record.marketType || '';
          const rev = record.revenue || 0;
          
          if (market.includes('온라인')) channelMap['온라인'] += rev;
          else if (market.includes('기업') || market.includes('휴양소')) channelMap['휴양소'] += rev;
          else if (market.includes('세미나') || market.includes('단체')) channelMap['세미나'] += rev;
          else if (market.includes('예약실') || market.includes('전화') || market.includes('메신저')) channelMap['예약실'] += rev;
          else if (market.includes('홈페이지') || market.includes('APP')) channelMap['홈페이지'] += rev;
          else channelMap['기타'] += rev;
        });
      }
    });

    return Object.entries(channelMap)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthlyData]);

  // 채널별 평형별 객단가 (ADR)
  const channelAdrData = useMemo(() => {
    const channelMap = {
      '온라인': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '세미나': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '휴양소': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '예약실': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '홈페이지': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '기타': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} }
    };

    monthlyData.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const market = record.marketType || '';
          const rev = record.revenue || 0;
          const cnt = record.count || 0;
          const type = record.roomType || '';

          let channelName = '기타';
          if (market.includes('온라인')) channelName = '온라인';
          else if (market.includes('기업') || market.includes('휴양소')) channelName = '휴양소';
          else if (market.includes('세미나') || market.includes('단체')) channelName = '세미나';
          else if (market.includes('예약실') || market.includes('전화') || market.includes('메신저')) channelName = '예약실';
          else if (market.includes('홈페이지') || market.includes('APP')) channelName = '홈페이지';

          let typeName = '기타';
          if (type.includes('16평')) typeName = '16평';
          else if (type.includes('35평')) typeName = '35평';
          else if (type.includes('51평')) typeName = '51평';

          if (typeName !== '기타') {
            channelMap[channelName][typeName].rev += rev;
            channelMap[channelName][typeName].cnt += cnt;
          }
          channelMap[channelName]['전체'].rev += rev;
          channelMap[channelName]['전체'].cnt += cnt;
        });
      }
    });

    return Object.entries(channelMap).map(([channel, types]) => {
      return {
        channel,
        '16평': types['16평'].cnt > 0 ? types['16평'].rev / types['16평'].cnt : 0,
        '35평': types['35평'].cnt > 0 ? types['35평'].rev / types['35평'].cnt : 0,
        '51평': types['51평'].cnt > 0 ? types['51평'].rev / types['51평'].cnt : 0,
        '전체': types['전체'].cnt > 0 ? types['전체'].rev / types['전체'].cnt : 0,
        totalRev: types['전체'].rev
      };
    }).filter(d => d.totalRev > 0).sort((a, b) => b.totalRev - a.totalRev);
  }, [monthlyData]);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#ef4444', '#64748b'];

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
      
      {/* 0. 본부 선택기 */}
      <div className="glass-panel" style={{padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px'}}>
        <h3 style={{margin: 0}}>분석 대상 본부 선택:</h3>
        <div style={{display: 'flex', gap: '12px'}}>
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

      {/* 1. 상단 요약 카드 (전체 흐름) */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)'}}>통합 상관계수 (r)</h3>
          <div style={{fontSize: '36px', fontWeight: 'bold', color: activeConf.color}}>
            {activeGlobalCorrelation ? activeGlobalCorrelation.toFixed(3) : 'N/A'}
          </div>
          <div style={{color: 'var(--text-muted)', marginTop: '8px'}}>
            객실 점유율 ↔ {activeConf.title} 총매출 간의 관계<br/>
            <strong>{getInterpretation(activeGlobalCorrelation)}</strong>
          </div>
        </div>

        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)'}}>{activeConf.title} 매출과 가장 연관 깊은 객실 평형</h3>
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

      {/* 2. 메인 트렌드 차트 */}
      <div className="glass-panel" style={{padding: '24px'}}>
        <div style={{marginBottom: '20px'}}>
          <h3 style={{margin: '0 0 8px 0'}}>월별 추이: 객실 점유율 vs {activeConf.title} 매출</h3>
          <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
            💡 <strong>해석 가이드:</strong> 초록색 선(점유율)과 매출 선의 오르내리는 모습이 비슷할수록, 해당 본부의 매출이 투숙객 수에 크게 의존하고 있음을 뜻합니다.
            <br/>
            <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)'}}>
              (※ 좌측 숫자는 점유율(%), 우측 세로축의 'M'은 백만 단위를 뜻합니다. 예: 800M = 8억 원)
            </span>
          </p>
        </div>
        <div style={{width: '100%', height: '400px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="yearMonth" stroke="var(--text-muted)" />
              <YAxis yAxisId="left" stroke="var(--accent-emerald)" tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <YAxis yAxisId="right" orientation="right" stroke={activeConf.color} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
              <RechartsTooltip 
                contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                formatter={(value, name) => name === '점유율' ? `${value.toFixed(1)}%` : `₩${formatCurrency(value)}`}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="occupancyRate" name="점유율" stroke="var(--accent-emerald)" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
              <Line yAxisId="right" type="monotone" dataKey={activeConf.dataKey} name={`${activeConf.title} 매출`} stroke={activeConf.color} strokeWidth={3} dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. 산점도 및 영업장 분석 */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
        
        {/* 평형별 산점도 */}
        <div className="glass-panel" style={{padding: '24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px'}}>
            <div>
              <h3 style={{margin: '0 0 8px 0'}}>평형별 판매량 vs {activeConf.title} 매출 (산점도)</h3>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
                💡 <strong>해석 가이드:</strong> 점들이 우측 상단(↗)으로 좁게 뭉쳐서 뻗어나갈수록, 해당 평형의 투숙객이 돈을 많이 쓴다는 증거입니다.
              </p>
            </div>
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
          
          <div style={{flex: 1, minHeight: 0, width: '100%', height: '300px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" dataKey={selectedRoomType === 'all' ? 'totalSold' : selectedRoomType} name="객실 판매(실)" stroke="var(--text-muted)" />
                <YAxis type="number" dataKey={activeConf.dataKey} name={`${activeConf.title} 매출`} stroke="var(--text-muted)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <ZAxis type="category" dataKey="yearMonth" name="연/월" />
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                  formatter={(val, name) => name === `${activeConf.title} 매출` ? `₩${formatCurrency(val)}` : `${val}실`}
                />
                <Scatter data={processedData} fill={activeConf.color} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 영업장별 상관관계 TOP */}
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{marginBottom: '20px'}}>{activeConf.title} 내 영업장별 점유율 민감도 TOP 5</h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>객실에 투숙객이 많을 때 가장 직접적으로 매출이 뛰는 영업장 순위입니다.</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {locationCorrelations.slice(0, 5).map((loc, idx) => (
              <div key={loc.name} style={{display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px'}}>
                <div style={{width: '24px', fontWeight: 'bold', color: idx === 0 ? activeConf.color : 'var(--text-muted)'}}>{idx + 1}</div>
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
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>해당 본부의 영업장 데이터가 부족합니다.</div>
            )}
          </div>
        </div>

        {/* 객실 판매채널 분석 (Pie Chart & Table) */}
        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{marginBottom: '20px'}}>객실 판매채널 심층 분석</h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>채널별 매출 비중 및 평형별 객단가(ADR)를 한눈에 비교합니다.</p>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
            {/* Pie Chart */}
            <div style={{width: '100%', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)'}}>매출 비중</h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={90}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.1)"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                    formatter={(val) => `₩${formatCurrency(val)}`} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* ADR Table */}
            <div style={{width: '100%', display: 'flex', flexDirection: 'column'}}>
              <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)', textAlign: 'center'}}>채널별 평형 객단가(ADR)</h4>
              <div style={{overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right'}}>
                  <thead>
                    <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                      <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)'}}>채널명</th>
                      <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>16평</th>
                      <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>35평</th>
                      <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>51평</th>
                      <th style={{padding: '12px', color: 'var(--accent-gold)', borderBottom: '1px solid var(--border-glass)'}}>종합(평균)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelAdrData.map((row, idx) => (
                      <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                        <td style={{padding: '12px', textAlign: 'left', fontWeight: 'bold'}}>{row.channel}</td>
                        <td style={{padding: '12px'}}>{row['16평'] ? `₩${formatCurrency(row['16평'])}` : '-'}</td>
                        <td style={{padding: '12px'}}>{row['35평'] ? `₩${formatCurrency(row['35평'])}` : '-'}</td>
                        <td style={{padding: '12px'}}>{row['51평'] ? `₩${formatCurrency(row['51평'])}` : '-'}</td>
                        <td style={{padding: '12px', color: 'var(--accent-gold)', fontWeight: 'bold'}}>
                          {row['전체'] ? `₩${formatCurrency(row['전체'])}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 채널 ↔ 부대시설 거시적 상관관계 (Macro-Correlation) */}
        <div className="glass-panel" style={{padding: '24px', gridColumn: 'span 2'}}>
          <h3 style={{marginBottom: '20px'}}>채널 비중 ↔ 부대시설 매출 거시적 상관관계</h3>
          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>특정 예약 채널(온라인, 세미나 등)의 매출 비중이 높았던 월에 각 영업장(레저, 식음, 모토아레나)의 총매출이 얼마나 함께 상승했는지를 보여주는 상관계수(-1.0 ~ 1.0)입니다. (0.4 이상 뚜렷한 연관, 0.7 이상 매우 강한 연관)</p>
          
          <div style={{overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
              <thead>
                <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)'}}>채널명</th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>레저본부 (상관도)</th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>식음본부 (상관도)</th>
                  <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>모토아레나 (상관도)</th>
                </tr>
              </thead>
              <tbody>
                {['온라인', '세미나', '휴양소', '예약실', '홈페이지'].map((channel, idx) => {
                  // 채널별 상관계수 계산
                  const channelMonthlyRev = processedData.map(d => {
                    let total = 0;
                    if (d.rawRoomRecords) {
                      d.rawRoomRecords.forEach(r => {
                        const m = r.marketType || '';
                        if (channel === '온라인' && m.includes('온라인')) total += r.revenue || 0;
                        else if (channel === '세미나' && (m.includes('세미나') || m.includes('단체'))) total += r.revenue || 0;
                        else if (channel === '휴양소' && (m.includes('기업') || m.includes('휴양소'))) total += r.revenue || 0;
                        else if (channel === '예약실' && (m.includes('예약실') || m.includes('전화') || m.includes('메신저'))) total += r.revenue || 0;
                        else if (channel === '홈페이지' && (m.includes('홈페이지') || m.includes('APP'))) total += r.revenue || 0;
                      });
                    }
                    return total;
                  });

                  const cLeisure = calculateCorrelation(channelMonthlyRev, processedData.map(d => d.leisureSales)) || 0;
                  const cFnb = calculateCorrelation(channelMonthlyRev, processedData.map(d => d.fnbSales)) || 0;
                  const cMoto = calculateCorrelation(channelMonthlyRev, processedData.map(d => d.motoSales)) || 0;

                  const getColor = (r) => {
                    if (r >= 0.7) return 'var(--accent-emerald)';
                    if (r >= 0.4) return 'var(--accent-gold)';
                    if (r <= -0.4) return 'var(--accent-red)';
                    return 'var(--text-main)';
                  };

                  return (
                    <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
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
        </div>

      </div>
    </div>
  );
}
