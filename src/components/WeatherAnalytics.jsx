import React, { useMemo } from 'react';
import { Wind, CloudRain, Activity } from 'lucide-react';
import { buildWeatherCoreStats } from '../utils/weatherCore';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function WeatherAnalytics({ processedData, settings }) {
  
  const coreStats = useMemo(() => {
    if (!processedData || processedData.length === 0) return null;
    return buildWeatherCoreStats(processedData, settings);
  }, [processedData, settings]);

  if (!coreStats) return <div style={{color: 'var(--text-muted)'}}>데이터 로딩 중...</div>;

  const wStat = coreStats.global.wind;
  const fStat = coreStats.global.consecutiveRain;
  const subStats = coreStats.global.substitutionStats;

  const rainPenaltyStats = useMemo(() => {
    if (!coreStats) return [];
    const penalties = [];
    Object.entries(coreStats.facilities).forEach(([fac, stat]) => {
      // 1% 이상 매출이 하락한 곳만 (노이즈 방지)
      if (stat.overallPenalty < -0.01 && stat.group !== 'exclude') {
        penalties.push({
          loc: fac,
          clearAvg: stat.overallClearAvg,
          rainyAvg: stat.overallRainyAvg,
          impact: stat.overallPenalty * 100,
          wdClearAvg: stat.wdClearAvg,
          wdRainyAvg: stat.wdRainyAvg,
          wdPenalty: stat.wdPenalty * 100,
          weClearAvg: stat.weClearAvg,
          weRainyAvg: stat.weRainyAvg,
          wePenalty: stat.wePenalty * 100
        });
      }
    });
    // 매출 규모(clearAvg)가 큰 순서대로 정렬하여 상위 7개 매장만 추출
    const top7ByRevenue = penalties.sort((a,b) => b.clearAvg - a.clearAvg).slice(0, 7);
    // 추출된 7개 매장 내에서 타격이 큰 순서대로 다시 정렬 (선택 사항)
    return top7ByRevenue.sort((a,b) => a.impact - b.impact);
  }, [coreStats]);

  return (
    <div style={{color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '24px'}}>
      <div style={{marginBottom: '16px'}}>
        <h2 style={{fontSize: '24px', margin: '0 0 8px 0'}}>날씨 변수별 과거 매출 임팩트(타격/수혜) 통계</h2>
        <p style={{color: 'var(--text-muted)', margin: 0}}>
          단순한 맑음/비 구분 외에, 풍속(강풍), 장마(연속 강수), 대체재(비올 때 오히려 오르는 매장) 등 
          고급 날씨 변수가 매출에 미친 영향을 분석합니다.
        </p>
      </div>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: '20px'}}>
        
        {/* 1. 강풍 타격 카드 */}
        <div className="glass-panel" style={{flex: '1', minWidth: '400px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <Wind size={24} color="var(--accent-blue)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>1. 강풍 타격 (10m/s 이상) 통계</h3>
          </div>
          
          <div style={{display: 'flex', gap: '20px'}}>
            {/* 주중 */}
            <div style={{flex: 1}}>
              <h4 style={{color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px', marginTop: 0}}>주중</h4>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>평소 매출</span>
                  <strong style={{fontSize: '15px'}}>₩{formatCurrency(wStat.wd.normalWindAvgRev)}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>강풍시 매출</span>
                  <strong style={{fontSize: '15px', color: 'var(--accent-coral)'}}>₩{formatCurrency(wStat.wd.highWindAvgRev)}</strong>
                </div>
                {wStat.wd.normalWindAvgRev > 0 && wStat.wd.highWindAvgRev < wStat.wd.normalWindAvgRev && (
                  <div style={{marginTop: '4px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', textAlign: 'center', fontSize: '13px'}}>
                    <strong style={{color: 'var(--accent-coral)'}}>{((wStat.wd.highWindAvgRev - wStat.wd.normalWindAvgRev) / wStat.wd.normalWindAvgRev * 100).toFixed(1)}% 하락</strong>
                  </div>
                )}
              </div>
            </div>
            
            {/* 주말 */}
            <div style={{flex: 1}}>
              <h4 style={{color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px', marginTop: 0}}>주말</h4>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>평소 매출</span>
                  <strong style={{fontSize: '15px'}}>₩{formatCurrency(wStat.we.normalWindAvgRev)}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>강풍시 매출</span>
                  <strong style={{fontSize: '15px', color: 'var(--accent-coral)'}}>₩{formatCurrency(wStat.we.highWindAvgRev)}</strong>
                </div>
                {wStat.we.normalWindAvgRev > 0 && wStat.we.highWindAvgRev < wStat.we.normalWindAvgRev && (
                  <div style={{marginTop: '4px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', textAlign: 'center', fontSize: '13px'}}>
                    <strong style={{color: 'var(--accent-coral)'}}>{((wStat.we.highWindAvgRev - wStat.we.normalWindAvgRev) / wStat.we.normalWindAvgRev * 100).toFixed(1)}% 하락</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. 장마/연속 강수 타격 카드 */}
        <div className="glass-panel" style={{flex: '1', minWidth: '400px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <CloudRain size={24} color="var(--accent-purple)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>2. 장마(연속 비) 누적 피로도</h3>
          </div>
          
          <div style={{display: 'flex', gap: '20px'}}>
            {/* 주중 */}
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <h4 style={{color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '4px', marginTop: 0}}>주중</h4>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>맑은 날</span>
                <strong style={{fontSize: '14px'}}>₩{formatCurrency(fStat.wd.clearAvg)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>우천 1일차</span>
                <strong style={{color: 'var(--accent-gold)', fontSize: '14px'}}>₩{formatCurrency(fStat.wd.day1Avg)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>2일차 연속</span>
                <strong style={{color: 'var(--accent-gold)', fontSize: '14px'}}>₩{formatCurrency(fStat.wd.day2Avg)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>장마(3일↑)</span>
                <strong style={{color: 'var(--accent-coral)', fontSize: '14px'}}>₩{formatCurrency(fStat.wd.day3plusAvg)}</strong>
              </div>
            </div>

            {/* 주말 */}
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <h4 style={{color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '4px', marginTop: 0}}>주말</h4>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>맑은 날</span>
                <strong style={{fontSize: '14px'}}>₩{formatCurrency(fStat.we.clearAvg)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>우천 1일차</span>
                <strong style={{color: 'var(--accent-gold)', fontSize: '14px'}}>₩{formatCurrency(fStat.we.day1Avg)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>2일차 연속</span>
                <strong style={{color: 'var(--accent-gold)', fontSize: '14px'}}>₩{formatCurrency(fStat.we.day2Avg)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>장마(3일↑)</span>
                <strong style={{color: 'var(--accent-coral)', fontSize: '14px'}}>₩{formatCurrency(fStat.we.day3plusAvg)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 대체재(풍선효과) 탐지 카드 */}
        <div className="glass-panel" style={{flex: '1', minWidth: '300px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <Activity size={24} color="var(--accent-emerald)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>3. 비올 때 오르는 매장 (풍선효과)</h3>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {subStats.length > 0 ? subStats.map((sub, i) => (
              <div key={i} style={{padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)'}}>
                <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between'}}>
                  {sub.loc}
                  <span style={{color: 'var(--accent-emerald)', fontSize: '14px'}}>전체 시너지: {sub.impact.toFixed(1)}%↑</span>
                </div>
                
                {/* 주중 */}
                {sub.wdClearAvg > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px'}}>
                  <span>[주중] 맑은 날: ₩{formatCurrency(sub.wdClearAvg)} <span style={{opacity: 0.5}}>→</span> 비: ₩{formatCurrency(sub.wdRainyAvg)}</span>
                  <strong style={{color: sub.wdPenalty > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>
                    {sub.wdPenalty > 0 ? '+' : ''}{sub.wdPenalty.toFixed(1)}%
                  </strong>
                </div>
                )}
                
                {/* 주말 */}
                {sub.weClearAvg > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)'}}>
                  <span>[주말] 맑은 날: ₩{formatCurrency(sub.weClearAvg)} <span style={{opacity: 0.5}}>→</span> 비: ₩{formatCurrency(sub.weRainyAvg)}</span>
                  <strong style={{color: sub.wePenalty > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>
                    {sub.wePenalty > 0 ? '+' : ''}{sub.wePenalty.toFixed(1)}%
                  </strong>
                </div>
                )}
              </div>
            )) : (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>
                우천 시 매출이 상승하는 대체재 시설이 아직 발견되지 않았습니다.
              </div>
            )}
          </div>
        </div>

        {/* 4. 우천 시 타격 매장 카드 */}
        <div className="glass-panel" style={{flex: '1', minWidth: '300px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <CloudRain size={24} color="var(--accent-coral)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>4. 비올 때 타격받는 매장 (우천 페널티)</h3>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px'}}>
            {rainPenaltyStats.length > 0 ? rainPenaltyStats.map((sub, i) => (
              <div key={i} style={{padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)'}}>
                <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between'}}>
                  {sub.loc}
                  <span style={{color: 'var(--accent-coral)', fontSize: '14px'}}>전체 타격: {Math.abs(sub.impact).toFixed(1)}%↓</span>
                </div>
                
                {/* 주중 */}
                {sub.wdClearAvg > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px'}}>
                  <span>[주중] 맑은 날: ₩{formatCurrency(sub.wdClearAvg)} <span style={{opacity: 0.5}}>→</span> 비: ₩{formatCurrency(sub.wdRainyAvg)}</span>
                  <strong style={{color: sub.wdPenalty < 0 ? 'var(--accent-coral)' : 'var(--text-muted)'}}>
                    {sub.wdPenalty > 0 ? '+' : ''}{sub.wdPenalty.toFixed(1)}%
                  </strong>
                </div>
                )}
                
                {/* 주말 */}
                {sub.weClearAvg > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)'}}>
                  <span>[주말] 맑은 날: ₩{formatCurrency(sub.weClearAvg)} <span style={{opacity: 0.5}}>→</span> 비: ₩{formatCurrency(sub.weRainyAvg)}</span>
                  <strong style={{color: sub.wePenalty < 0 ? 'var(--accent-coral)' : 'var(--text-muted)'}}>
                    {sub.wePenalty > 0 ? '+' : ''}{sub.wePenalty.toFixed(1)}%
                  </strong>
                </div>
                )}
              </div>
            )) : (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>
                우천 시 뚜렷하게 매출이 하락하는 시설이 데이터에 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
