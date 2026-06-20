import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import CountUpModule from 'react-countup';
const CountUp = CountUpModule.default || CountUpModule;
import { Building2, Calculator, ArrowRight } from 'lucide-react';
import { calculateGroupedSales } from '../utils/revenueUtils';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function NewBusinessTraining({ processedData, globalStats, settings }) {
  // Input states
  const [newRooms, setNewRooms] = useState(200);
  const [targetOcc, setTargetOcc] = useState(60);
  const [dataBasis, setDataBasis] = useState('all');
  
  // Base Historical Metrics
  const baseMetrics = useMemo(() => {
    let totRev = 0;
    let totSold = 0;
    let totLeisure = 0;
    let totMotoGuest = 0;
    let totMotoTotal = 0;
    let totFnb = 0;
    let totOther = 0;
    let totGolf = 0;

    const pointsLeisure = [];
    const pointsMoto = [];
    const pointsFnb = [];

    const validData = (processedData || []).filter(d => {
      const idStr = String(d.id || d.yearMonth || "");
      if (!idStr.match(/^\d{4}-\d{2}$/)) return false;
      if (dataBasis === '2025') return idStr.startsWith('2025');
      if (dataBasis === '2026') return idStr.startsWith('2026');
      return idStr.startsWith('2025') || idStr.startsWith('2026');
    });

    validData.forEach(d => {
      const totalSold = d.totalSold || 0;
      totSold += totalSold;
      totRev += d.totalRoomRevenue || 0;

      let mGuestRev = 0;
      let mTotalRev = d.motoSales || 0;
      const excel2Total = Number(d.motoTotalRev || 0);
      if (excel2Total > 0 && mTotalRev > 0) {
        const guestRatio = Number(d.motoGuestRev || 0) / excel2Total;
        mGuestRev = Math.round(mTotalRev * guestRatio);
      } else if (mTotalRev > 0) {
        mGuestRev = Math.round(mTotalRev * ((settings?.captureRateMoto ?? 25) / 100));
      }

      const dynamicGrossSum = Math.max(0, (d.totalSales || 0) - ((d.leisureSales||0) + (d.fnbSales||0) + (d.motoSales||0) + (d.otherSales||0)));

      totLeisure += d.leisureSales || 0;
      totMotoGuest += mGuestRev;
      totMotoTotal += mTotalRev;
      totFnb += d.fnbSales || 0;
      totOther += (d.otherSales || 0) + dynamicGrossSum;
      totGolf += d.golfSales || 0;

      if (totalSold > 0) {
         if (d.leisureSales > 0) pointsLeisure.push({ x: totalSold, y: d.leisureSales });
         if (mGuestRev > 0) pointsMoto.push({ x: totalSold, y: mGuestRev });
         if (d.fnbSales > 0) pointsFnb.push({ x: totalSold, y: d.fnbSales });
      }
    });

    const calcR = (points) => {
      const n = points.length;
      if (n < 2) return 0;
      const sumX = points.reduce((acc, p) => acc + p.x, 0);
      const sumY = points.reduce((acc, p) => acc + p.y, 0);
      const sumXY = points.reduce((acc, p) => acc + (p.x * p.y), 0);
      const sumX2 = points.reduce((acc, p) => acc + (p.x * p.x), 0);
      const sumY2 = points.reduce((acc, p) => acc + (p.y * p.y), 0);
      const numerator = (n * sumXY) - (sumX * sumY);
      const denomInside = (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY);
      if (denomInside <= 0) return 0;
      return numerator / Math.sqrt(denomInside);
    };

    const validLeisure = calcR(pointsLeisure) >= 0.5;
    const validMoto = calcR(pointsMoto) >= 0.5;
    const validFnb = calcR(pointsFnb) >= 0.5;

    return {
      avgAdr: totSold > 0 ? totRev / totSold : 150000,
      leisurePerRoom: (totSold > 0 && validLeisure) ? totLeisure / totSold : 0,
      motoPerRoom: (totSold > 0 && validMoto) ? totMotoGuest / totSold : 0,
      fnbPerRoom: (totSold > 0 && validFnb) ? totFnb / totSold : 0,
      totRev,
      totLeisure,
      totMoto: totMotoTotal,
      totFnb,
      totOther,
      monthsCount: validData.length || 1,
      validLeisure,
      validMoto,
      validFnb
    };
  }, [processedData, settings, dataBasis]);

  const [customAdr, setCustomAdr] = useState(null);
  
  // The actual ADR to use
  const activeAdr = customAdr !== null ? customAdr : Math.round(baseMetrics.avgAdr);

  // Simulation Calculations
  // Assuming 365 days a year for annual calculation
  const annualAvailableRooms = newRooms * 365;
  const annualSoldRooms = annualAvailableRooms * (targetOcc / 100);
  
  const expectedRoomRev = annualSoldRooms * activeAdr;
  const rawLeisureRev = annualSoldRooms * baseMetrics.leisurePerRoom;
  const rawMotoRev = annualSoldRooms * baseMetrics.motoPerRoom;
  const rawFnbRev = annualSoldRooms * baseMetrics.fnbPerRoom;

  const calculateCapaLimit = (rawExpected, totalHistorical, capaStr) => {
    const capa = Number(capaStr);
    if (isNaN(capa) || capa <= 0) return { value: rawExpected, isCapped: false };
    
    const currentAnnualRev = (totalHistorical / baseMetrics.monthsCount) * 12;
    if (currentAnnualRev === 0) return { value: rawExpected, isCapped: false };

    const maxAnnualCapacity = currentAnnualRev / (capa / 100);
    const remainingCapacity = Math.max(0, maxAnnualCapacity - currentAnnualRev);
    
    const isCapped = rawExpected > remainingCapacity || capa >= 100;
    return { 
      value: isCapped ? remainingCapacity : rawExpected, 
      isCapped
    };
  };

  const leisureSim = calculateCapaLimit(rawLeisureRev, baseMetrics.totLeisure, settings.capaLeisure);
  const motoSim = calculateCapaLimit(rawMotoRev, baseMetrics.totMoto, settings.capaMoto);
  const fnbSim = calculateCapaLimit(rawFnbRev, baseMetrics.totFnb, settings.capaFnb);

  const expectedLeisureRev = leisureSim.value;
  const expectedMotoRev = motoSim.value;
  const expectedFnbRev = fnbSim.value;
  
  const expectedTotalRev = expectedRoomRev + expectedLeisureRev + expectedMotoRev + expectedFnbRev;

  const excludedFromBaseline = ['골프'];
  let baselineTotal = baseMetrics.totRev + baseMetrics.totOther;

  if (baseMetrics.validLeisure) {
    baselineTotal += baseMetrics.totLeisure;
  } else if (baseMetrics.totLeisure > 0) {
    excludedFromBaseline.push('레저(상관관계 미달)');
  }

  if (baseMetrics.validMoto) {
    baselineTotal += baseMetrics.totMoto;
  } else if (baseMetrics.totMoto > 0) {
    excludedFromBaseline.push('모토아레나(상관관계 미달)');
  }

  if (baseMetrics.validFnb) {
    baselineTotal += baseMetrics.totFnb;
  } else if (baseMetrics.totFnb > 0) {
    excludedFromBaseline.push('식음(상관관계 미달)');
  }

  const annualizedBaseline = (baselineTotal / baseMetrics.monthsCount) * 12;

  const chartData = [
    { name: '객실 매출', value: expectedRoomRev, color: 'var(--accent-blue)' },
    { name: '식음(F&B)', value: expectedFnbRev, color: '#ef4444' }, // Red-ish for F&B
    { name: '모토아레나', value: expectedMotoRev, color: 'var(--accent-gold)' },
    { name: '레저/기타', value: expectedLeisureRev, color: 'var(--accent-emerald)' }
  ].filter(d => d.value > 0);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* Header */}
      <div className="glass-panel" style={{position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--accent-emerald)', minHeight: '220px', display: 'flex', alignItems: 'flex-end'}}>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url("/training-center.png")', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0}}></div>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.4) 50%, transparent 100%)', zIndex: 1}}></div>
        <div style={{padding: '32px 32px 24px 32px', position: 'relative', zIndex: 2, width: '100%'}}>
          <h2 style={{margin: '0 0 12px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
            <Building2 size={28} color="var(--accent-emerald)" /> 신규 사업 시뮬레이터 (연수원)
          </h2>
          <p style={{margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '15px', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.8)'}}>
            기존 콘도의 운영 데이터(객단가 및 투숙객당 부대매출 창출액)를 베이스로, 연수원 등 신규 객실이 추가되었을 때 발생하는 <strong style={{color: '#fff'}}>연간 예상 파생 총매출</strong>을 시뮬레이션 합니다. 
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="glass-panel" style={{padding: '32px'}}>
        <h3 style={{margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)'}}>
          <Calculator size={20} /> 시뮬레이션 설정 (연간 기준)
        </h3>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px'}}>
          
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>추가 건립 객실 수</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                value={newRooms === 0 ? '' : newRooms} 
                onChange={e => setNewRooms(Number(e.target.value))}
                style={{width: '100px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '18px', fontWeight: 'bold'}}
              />
              <span style={{color: 'var(--text-muted)'}}>실</span>
            </div>
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>예상 목표 점유율</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                value={targetOcc === 0 ? '' : targetOcc} 
                onChange={e => setTargetOcc(Number(e.target.value))}
                style={{width: '100px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '18px', fontWeight: 'bold'}}
              />
              <span style={{color: 'var(--text-muted)'}}>%</span>
            </div>
            <div style={{fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '8px'}}>
              연간 예상 판매 객실: {formatCurrency(annualSoldRooms)}실
            </div>
          </div>
          
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>객단가 (ADR)</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--text-muted)'}}>₩</span>
              <input 
                type="number" 
                value={customAdr !== null ? customAdr : Math.round(baseMetrics.avgAdr)} 
                onChange={e => setCustomAdr(e.target.value ? Number(e.target.value) : null)}
                placeholder={Math.round(baseMetrics.avgAdr).toString()}
                style={{width: '120px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '18px', fontWeight: 'bold'}}
              />
            </div>
            <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px'}}>
              *기본값: 기존 콘도 평균치
            </div>
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>데이터 산출 기준 (상관관계)</label>
            <select 
              value={dataBasis} 
              onChange={e => setDataBasis(e.target.value)}
              style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '16px', fontWeight: 'bold', outline: 'none'}}
            >
              <option value="all" style={{background: '#1e293b'}}>전체 통합 데이터 (25+26년)</option>
              <option value="2025" style={{background: '#1e293b'}}>25년 마감 데이터 기준</option>
              <option value="2026" style={{background: '#1e293b'}}>26년 최신 데이터 기준</option>
            </select>
            <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px'}}>
              시뮬레이션 상관관계 지수의 기준 년도를 선택합니다.
            </div>
          </div>

        </div>
      </div>

      {/* Results Section */}
      <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
        
        {/* Top summary cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
          
          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '4px solid rgba(255,255,255,0.2)'}}>
            <div style={{fontSize: '16px', color: 'var(--text-muted)', marginBottom: '8px'}}>기존 연간 통합 매출 (과거 평균 기준)</div>
            <div style={{fontSize: '36px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px'}}>
              ₩<CountUp end={annualizedBaseline} duration={1} separator="," preserveValue />
            </div>
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>업로드된 데이터를 바탕으로 연 환산한 현재 매출 규모</div>
            <div style={{fontSize: '12px', color: 'var(--accent-red)', marginTop: '6px'}}>
              *제외된 매출: {excludedFromBaseline.join(', ')}
            </div>
          </div>

          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '4px solid var(--accent-gold)'}}>
            <div style={{fontSize: '16px', color: 'var(--accent-gold)', marginBottom: '8px', fontWeight: 'bold'}}>신규 창출 매출 (Newly Generated Revenue)</div>
            <div style={{fontSize: '36px', fontWeight: '900', color: 'var(--accent-gold)', letterSpacing: '-1px'}}>
              + ₩<CountUp end={expectedTotalRev} duration={1} separator="," preserveValue />
            </div>
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>신규 객실 추가로 인해 순수하게 증가하는 예상 매출액</div>
            <div style={{fontSize: '12px', color: 'var(--accent-red)', marginTop: '6px'}}>
              *제외된 부대매출 창출: {excludedFromBaseline.join(', ')}
            </div>
          </div>

          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '4px solid var(--accent-blue)'}}>
            <div style={{fontSize: '16px', color: 'var(--accent-blue)', marginBottom: '8px', fontWeight: 'bold'}}>미래 종합 연간 예상 매출</div>
            <div style={{fontSize: '36px', fontWeight: '900', color: 'var(--accent-blue)', letterSpacing: '-1px'}}>
              ₩<CountUp end={annualizedBaseline + expectedTotalRev} duration={1} separator="," preserveValue />
            </div>
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>기존 매출 + 신규 창출 매출</div>
            <div style={{fontSize: '12px', color: 'var(--accent-red)', marginTop: '6px'}}>
              *완전 제외된 영업장: {excludedFromBaseline.join(', ')}
            </div>
          </div>

        </div>

        {/* Detailed Breakdown */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px'}}>
          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <h3 style={{margin: '0 0 24px 0', color: 'var(--text-main)'}}>신규 창출 매출 (Newly Generated Revenue) 세부내역</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-blue)'}} />
                <span>객실 매출</span>
              </div>
              <strong style={{fontSize: '18px'}}>₩{formatCurrency(expectedRoomRev)}</strong>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444'}} />
                <span>식음(F&B) 매출</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <strong style={{fontSize: '18px', color: !baseMetrics.validFnb ? 'var(--text-muted)' : fnbSim.isCapped ? '#ef4444' : 'inherit'}}>₩{formatCurrency(expectedFnbRev)}</strong>
                {!baseMetrics.validFnb && <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>*상관관계 지수 미달 (제외됨)</div>}
                {baseMetrics.validFnb && fnbSim.isCapped && <div style={{fontSize: '12px', color: '#ef4444', marginTop: '4px'}}>*Capa 상한 도달 (초과분 버림)</div>}
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-gold)'}} />
                <span>모토아레나 매출</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <strong style={{fontSize: '18px', color: !baseMetrics.validMoto ? 'var(--text-muted)' : motoSim.isCapped ? 'var(--accent-gold)' : 'inherit'}}>₩{formatCurrency(expectedMotoRev)}</strong>
                {!baseMetrics.validMoto && <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>*상관관계 지수 미달 (제외됨)</div>}
                {baseMetrics.validMoto && motoSim.isCapped && <div style={{fontSize: '12px', color: 'var(--accent-gold)', marginTop: '4px'}}>*Capa 상한 도달 (초과분 버림)</div>}
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-emerald)'}} />
                <span>레저/기타 매출</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <strong style={{fontSize: '18px', color: !baseMetrics.validLeisure ? 'var(--text-muted)' : leisureSim.isCapped ? 'var(--accent-emerald)' : 'inherit'}}>₩{formatCurrency(expectedLeisureRev)}</strong>
                {!baseMetrics.validLeisure && <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>*상관관계 지수 미달 (제외됨)</div>}
                {baseMetrics.validLeisure && leisureSim.isCapped && <div style={{fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '4px'}}>*Capa 상한 도달 (초과분 버림)</div>}
              </div>
            </div>

          </div>
        </div>

        {/* Chart */}
        <div className="glass-panel" style={{padding: '32px', minWidth: 0}}>
          <h3 style={{margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-muted)'}}>예상 매출 비중</h3>
          <div style={{width: '100%', height: '350px', minWidth: 0, minHeight: 0}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => `₩${formatCurrency(value)}`}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)', borderRadius: '8px'}}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        </div>

      </div>
    </div>
  );
}
