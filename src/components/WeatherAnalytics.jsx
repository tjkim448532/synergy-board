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
        <div className="glass-panel" style={{flex: '1', minWidth: '300px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <Wind size={24} color="var(--accent-blue)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>1. 강풍 타격 (10m/s 이상) 통계</h3>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{color: 'var(--text-muted)'}}>평소 (정상 풍속) 평균 매출</span>
              <strong style={{fontSize: '18px'}}>₩{formatCurrency(wStat.normalWindAvgRev)}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{color: 'var(--text-muted)'}}>강풍 발생 (10m/s↑) 평균 매출</span>
              <strong style={{fontSize: '18px', color: 'var(--accent-coral)'}}>₩{formatCurrency(wStat.highWindAvgRev)}</strong>
            </div>
            
            {wStat.normalWindAvgRev > 0 && wStat.highWindAvgRev < wStat.normalWindAvgRev && (
              <div style={{marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center'}}>
                평소 대비 <strong style={{color: 'var(--accent-coral)'}}>{((wStat.highWindAvgRev - wStat.normalWindAvgRev) / wStat.normalWindAvgRev * 100).toFixed(1)}% 하락</strong>
              </div>
            )}
          </div>
        </div>

        {/* 2. 장마/연속 강수 타격 카드 */}
        <div className="glass-panel" style={{flex: '1', minWidth: '300px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <CloudRain size={24} color="var(--accent-purple)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>2. 장마(연속 비) 누적 피로도</h3>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{color: 'var(--text-muted)'}}>맑은 날 평균 매출</span>
              <strong>₩{formatCurrency(fStat.clearAvg)}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
              <span style={{color: 'var(--text-muted)'}}>우천 1일차</span>
              <strong style={{color: 'var(--accent-gold)'}}>₩{formatCurrency(fStat.day1Avg)}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
              <span style={{color: 'var(--text-muted)'}}>연속 우천 2일차</span>
              <strong style={{color: 'var(--accent-gold)'}}>₩{formatCurrency(fStat.day2Avg)}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px'}}>
              <span style={{color: 'var(--text-muted)'}}>장마 (3일 이상 연속 우천)</span>
              <strong style={{color: 'var(--accent-coral)'}}>₩{formatCurrency(fStat.day3plusAvg)}</strong>
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
                <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)'}}>{sub.loc}</div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)'}}>
                  <span>맑은 날: ₩{formatCurrency(sub.clearAvg)}</span>
                  <span>비오는 날: <span style={{color: 'var(--accent-emerald)'}}>₩{formatCurrency(sub.rainyAvg)}</span></span>
                </div>
                <div style={{marginTop: '4px', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>
                  우천 시 {sub.impact.toFixed(1)}% 매출 상승!
                </div>
              </div>
            )) : (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>
                우천 시 매출이 상승하는 대체재 시설이 아직 발견되지 않았습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
