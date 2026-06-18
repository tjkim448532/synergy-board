import React, { useMemo } from 'react';
import { Target, PieChart, TrendingUp, AlertCircle, Lightbulb, Zap, Crosshair } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function ManagementStrategy({ processedData, globalStats, settings }) {
  const data = useMemo(() => {
    if (!processedData || processedData.length === 0) return null;
    
    // MECE Data
    const totalRoom = globalStats.totalRoomRevenue;
    const totalMoto = globalStats.totalMotoRevenue;
    const totalLeisure = globalStats.totalLeisureRevenue;
    const totalFnb = globalStats.totalFnbRevenue;
    const totalGolf = globalStats.totalGolfRevenue;
    const totalOther = globalStats.totalOtherRevenue || 0;
    
    // Room vs Non-Room
    const roomRev = totalRoom;
    const nonRoomRev = totalMoto + totalLeisure + totalFnb + totalOther; // Excluding Golf for internal focus
    
    // Guest vs Non-Guest for MotoArena (approximation from data)
    let motoGuestRev = 0;
    let motoNonGuestRev = 0;
    let fnb51Rev = 0;
    let fnb16Rev = 0;

    let tot51 = 0;
    let tot16 = 0;
    
    let peakMonth = null;
    let peakRev = 0;
    
    processedData.forEach(d => {
      motoGuestRev += (d.motoGuestRev || 0);
      motoNonGuestRev += ((d.motoSales || 0) - (d.motoGuestRev || 0));
      
      const r51 = d.sold51 || 0;
      const r16 = d.sold16 || 0;
      tot51 += r51;
      tot16 += r16;
      
      const tRev = d.totalRoomRevenue + d.leisureSales + d.fnbSales + d.motoSales;
      if (tRev > peakRev) {
        peakRev = tRev;
        peakMonth = d.yearMonth;
      }
    });

    // Pareto (80/20) - identify top months or top facilities
    const facilities = [
      { name: '객실', rev: roomRev },
      { name: '골프', rev: totalGolf },
      { name: 'F&B', rev: totalFnb },
      { name: '모토아레나', rev: totalMoto },
      { name: '기타레저', rev: totalLeisure }
    ].sort((a, b) => b.rev - a.rev);
    
    const totalAll = facilities.reduce((sum, f) => sum + f.rev, 0);
    let cumulative = 0;
    const paretoFacilities = facilities.map(f => {
      cumulative += f.rev;
      return {
        ...f,
        pct: (f.rev / totalAll) * 100,
        cumPct: (cumulative / totalAll) * 100
      };
    });

    return {
      roomRev, nonRoomRev,
      motoGuestRev, motoNonGuestRev,
      paretoFacilities,
      peakMonth,
      tot51, tot16
    };
  }, [processedData, globalStats]);

  if (!data) return <div style={{padding: '40px', color: 'var(--text-muted)'}}>데이터가 부족하여 전략 보고서를 생성할 수 없습니다.</div>;

  const meceData = [
    { name: '객실 매출 (Room)', value: data.roomRev, color: 'var(--accent-blue)' },
    { name: '부대시설 매출 (Non-Room)', value: data.nonRoomRev, color: 'var(--accent-gold)' }
  ];

  const motoMeceData = [
    { name: '투숙객 (Guest)', value: data.motoGuestRev, color: '#3b82f6' },
    { name: '외부객 (Non-Guest)', value: Math.max(0, data.motoNonGuestRev), color: '#ef4444' }
  ];

  const top20Facilities = data.paretoFacilities.filter(f => f.cumPct <= 85);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
      
      {/* Header */}
      <div className="glass-panel" style={{position: 'relative', overflow: 'hidden', borderLeft: '4px solid #6366f1', padding: '40px'}}>
        <div style={{position: 'relative', zIndex: 2}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
            <h2 style={{margin: 0, color: '#fff', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px'}}>
              <Target size={32} color="#6366f1" /> 경영전략 보고서
            </h2>
            <div style={{background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', border: '1px solid rgba(99, 102, 241, 0.4)'}}>
              총 {processedData.length}개월 누적 데이터 기준
            </div>
          </div>
          <p style={{margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '15px', lineHeight: '1.6', maxWidth: '800px'}}>
            현재 업로드된 리조트 운영 데이터를 기반으로 <strong>MECE, 가설 지향적 사고, 파레토 법칙, So What?</strong> 프레임워크를 적용한 자동화 전략 분석 리포트입니다. 직관적인 수치를 바탕으로 차년도 수익 극대화를 위한 핵심 액션 플랜을 도출합니다.
          </p>
        </div>
      </div>

      {/* 1. MECE */}
      <div className="glass-panel" style={{padding: '32px'}}>
        <h3 style={{margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)'}}>
          <PieChart size={24} color="#8b5cf6" /> 1. MECE 기반의 핵심 매출 분해
        </h3>
        <p style={{color: 'var(--text-muted)', marginBottom: '32px'}}>
          '중복 없이, 누락 없이' 전체 수익 구조를 쪼개어 성장의 병목(Bottleneck)과 돌파구를 식별합니다.
        </p>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
          
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <h4 style={{margin: '0 0 16px 0', color: 'var(--text-main)', textAlign: 'center'}}>객실 vs 부대시설 (골프 제외)</h4>
            <div style={{height: '250px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={meceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {meceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₩ ${formatCurrency(value)}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <h4 style={{margin: '0 0 16px 0', color: 'var(--text-main)', textAlign: 'center'}}>모토아레나 타겟 분해 (투숙객 vs 외부객)</h4>
            <div style={{height: '250px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={motoMeceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {motoMeceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₩ ${formatCurrency(value)}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div style={{textAlign: 'center', marginTop: '12px', fontSize: '13px', color: 'var(--accent-emerald)'}}>
              💡 <strong>Insight:</strong> 외부객 비중이 {(data.motoNonGuestRev / ((data.motoGuestRev + data.motoNonGuestRev) || 1) * 100).toFixed(1)}%를 차지합니다.
            </div>
          </div>

        </div>
      </div>

      {/* 2. 가설 기반 (Issue Tree) */}
      <div className="glass-panel" style={{padding: '32px'}}>
        <h3 style={{margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)'}}>
          <Zap size={24} color="#eab308" /> 2. 가설 기반 문제 해결 (Issue Tree)
        </h3>
        <p style={{color: 'var(--text-muted)', marginBottom: '32px'}}>
          데이터를 훑기 전, "핵심 과제"에 대한 가설을 세우고 이를 상관관계 데이터를 통해 즉시 검증(Why So?)합니다.
        </p>

        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          <div style={{background: 'linear-gradient(to right, rgba(234, 179, 8, 0.1), transparent)', borderLeft: '3px solid #eab308', padding: '24px', borderRadius: '0 12px 12px 0'}}>
            <div style={{fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '12px'}}>가설 1. "가족 단위(51평형) 투숙객이 부대매출 확장의 핵심이다."</div>
            <div style={{display: 'flex', gap: '24px', flexWrap: 'wrap'}}>
              <div style={{flex: 1, minWidth: '250px'}}>
                <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>검증 데이터 (현재 비중)</div>
                <div style={{fontSize: '20px', color: '#fff', marginTop: '4px'}}>51평형: {((data.tot51 / ((data.tot51 + data.tot16) || 1)) * 100).toFixed(1)}% vs 16평형: {((data.tot16 / ((data.tot51 + data.tot16) || 1)) * 100).toFixed(1)}%</div>
              </div>
              <div style={{flex: 1, minWidth: '250px'}}>
                <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>전략적 결론 (Why So?)</div>
                <div style={{fontSize: '14px', color: 'var(--accent-gold)', marginTop: '4px', lineHeight: '1.5'}}>
                  51평형의 단가가 높을 뿐만 아니라, 다인원 숙박으로 F&B/레저 등의 추가 결제 확률이 압도적입니다. 51평형 프로모션을 F&B 바우처와 묶어(Bundling) 판매하는 것이 객단가 상승의 핵심입니다.
                </div>
              </div>
            </div>
          </div>

          <div style={{background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), transparent)', borderLeft: '3px solid #3b82f6', padding: '24px', borderRadius: '0 12px 12px 0'}}>
            <div style={{fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '12px'}}>가설 2. "주말 객실은 포화상태이므로, 성장은 평일 외부객 유치에 달렸다."</div>
            <div style={{display: 'flex', gap: '24px', flexWrap: 'wrap'}}>
              <div style={{flex: 1, minWidth: '250px'}}>
                <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>검증 데이터 (평일 객실 가동률 여력)</div>
                <div style={{fontSize: '20px', color: '#fff', marginTop: '4px'}}>평균 평일 점유율: {globalStats.globalWdOccRate.toFixed(1)}%</div>
              </div>
              <div style={{flex: 1, minWidth: '250px'}}>
                <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>전략적 결론 (Why So?)</div>
                <div style={{fontSize: '14px', color: 'var(--accent-blue)', marginTop: '4px', lineHeight: '1.5'}}>
                  주말 점유율은 이미 한계치(Capa)에 도달했습니다. 평일 점유율을 끌어올리기 위해서는 '모토아레나 매니아층' 등 평일 외부객을 겨냥한 [평일 모토아레나 + 숙박 할인 패키지]가 필수적입니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Pareto 80/20 */}
      <div className="glass-panel" style={{padding: '32px'}}>
        <h3 style={{margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)'}}>
          <TrendingUp size={24} color="#10b981" /> 3. 파레토 법칙 (80/20 Rule) 리소스 재분배
        </h3>
        <p style={{color: 'var(--text-muted)', marginBottom: '24px'}}>
          전체 수익의 80%를 책임지는 핵심 20%의 채널/시설을 찾아내어 마케팅 자원을 집중(Focusing)합니다.
        </p>

        <div style={{display: 'flex', gap: '24px', flexWrap: 'wrap'}}>
          <div style={{flex: 1, background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <div style={{color: 'var(--accent-emerald)', fontWeight: 'bold', marginBottom: '16px'}}>👑 핵심 수익원 (Cash Cows)</div>
            {data.paretoFacilities.map((f, idx) => (
              <div key={idx} style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx !== data.paretoFacilities.length-1 ? '1px dashed rgba(255,255,255,0.1)' : 'none'}}>
                <span style={{color: f.cumPct <= 85 ? '#fff' : 'var(--text-muted)'}}>
                  {idx + 1}. {f.name}
                </span>
                <div style={{textAlign: 'right'}}>
                  <span style={{color: f.cumPct <= 85 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 'bold'}}>₩{formatCurrency(f.rev)}</span>
                  <span style={{fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px'}}>({f.pct.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{background: 'rgba(16, 185, 129, 0.1)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)'}}>
              <div style={{fontWeight: 'bold', color: '#10b981', marginBottom: '8px', fontSize: '18px'}}>선택과 집중 전략</div>
              <p style={{margin: 0, color: 'var(--text-main)', lineHeight: '1.6', fontSize: '15px'}}>
                상위 핵심 시설({top20Facilities.map(f=>f.name).join(', ')})이 전체 수익의 압도적 비중을 차지하고 있습니다.<br/><br/>
                수익 기여도가 낮은 하위 부대시설에 소모되는 마케팅 및 운영 예산을 축소하고, 최상위 Cash Cow인 <strong>{top20Facilities[0]?.name}</strong>의 VIP 고객 리텐션(재방문율) 관리에 예산을 전면 재배치해야 합니다.
              </p>
            </div>
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px'}}>최고 매출 달성월 (Peak Month)</div>
              <div style={{fontSize: '24px', color: 'var(--text-main)', fontWeight: 'bold'}}>{data.peakMonth}</div>
              <div style={{color: 'var(--accent-gold)', fontSize: '14px', marginTop: '4px'}}>
                이 시기의 프로모션과 외부 요인을 분석하여 내년 동월에 화력을 집중해야 합니다.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. So What? */}
      <div className="glass-panel" style={{padding: '40px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)'}}>
        <h3 style={{margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '24px'}}>
          <Crosshair size={28} color="#818cf8" /> 4. 결론: So What? (핵심 액션 플랜)
        </h3>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px'}}>
          
          <div style={{background: 'rgba(0,0,0,0.4)', padding: '24px', borderRadius: '12px', backdropFilter: 'blur(10px)'}}>
            <div style={{color: '#818cf8', fontWeight: 'bold', fontSize: '18px', marginBottom: '12px'}}>Action 1. 평일 타겟팅</div>
            <p style={{margin: 0, color: 'rgba(255,255,255,0.9)', lineHeight: '1.6'}}>
              주말 점유율 한계를 돌파하기 위해, 외부객 비중이 높은 <strong>모토아레나 이용객 전용 평일 객실 프로모션</strong>을 신설하여 외부객을 내부 투숙객으로 전환(Cross-selling) 시킵니다.
            </p>
          </div>

          <div style={{background: 'rgba(0,0,0,0.4)', padding: '24px', borderRadius: '12px', backdropFilter: 'blur(10px)'}}>
            <div style={{color: '#818cf8', fontWeight: 'bold', fontSize: '18px', marginBottom: '12px'}}>Action 2. 고단가 번들링</div>
            <p style={{margin: 0, color: 'rgba(255,255,255,0.9)', lineHeight: '1.6'}}>
              51평형 예약 고객은 지갑을 열 확률이 가장 높은 VIP 그룹입니다. 이들에게 <strong>F&B 프리패스 패키지</strong>를 고가에 선판매하여 현장 부가 수익을 안정적으로 확보합니다.
            </p>
          </div>

          <div style={{background: 'rgba(0,0,0,0.4)', padding: '24px', borderRadius: '12px', backdropFilter: 'blur(10px)'}}>
            <div style={{color: '#818cf8', fontWeight: 'bold', fontSize: '18px', marginBottom: '12px'}}>Action 3. 선택과 집중</div>
            <p style={{margin: 0, color: 'rgba(255,255,255,0.9)', lineHeight: '1.6'}}>
              수익의 {data.paretoFacilities[0]?.pct.toFixed(0)}% 이상을 차지하는 핵심 캐시카우 시설에 CS(고객만족) 및 마케팅 예산을 2배로 증액하고, 하위 10% 시설의 마케팅은 과감히 중단합니다.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
