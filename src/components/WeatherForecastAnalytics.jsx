import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CloudRain, Sun, AlertTriangle, Users, TrendingDown, ArrowRight } from 'lucide-react';
import { buildWeatherCoreStats, predictWeatherImpact } from '../utils/weatherCore';

const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Math.round(val).toLocaleString();
};

const isHoliday = (dateObj) => {
  const month = dateObj.getMonth() + 1;
  const date = dateObj.getDate();
  const holiStr = `${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  
  // 한국 주요 공휴일 목록
  const holidays = [
    '01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'
  ];
  return holidays.includes(holiStr);
};

export default function WeatherForecastAnalytics({ processedData, settings }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 날짜 초기화 (내일)
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // 날씨 예보 Fetch
  useEffect(() => {
    if (!selectedDate) return;
    
    const fetchForecast = async () => {
      setLoading(true);
      setError('');
      try {
        const targetObj = new Date(selectedDate);
        const twoDaysAgo = new Date(targetObj);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const y2 = twoDaysAgo.getFullYear();
        const m2 = String(twoDaysAgo.getMonth() + 1).padStart(2, '0');
        const d2 = String(twoDaysAgo.getDate()).padStart(2, '0');
        const startStr = `${y2}-${m2}-${d2}`;

        // 안성(팜랜드/시너지 기준) 위경도 대략 37.0079, 127.2797
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=37.0079&longitude=127.2797&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=Asia%2FSeoul&start_date=${startStr}&end_date=${selectedDate}&wind_speed_unit=ms`);
        if (!res.ok) throw new Error('날씨 예보를 가져오는데 실패했습니다.');
        
        const data = await res.json();
        if (data && data.daily) {
          const pList = data.daily.precipitation_sum;
          const wList = data.daily.windspeed_10m_max;
          const tIdx = data.daily.time.indexOf(selectedDate);
          
          if (tIdx !== -1) {
            let consRain = 0;
            if (pList[tIdx] >= 3.0) {
              consRain = 1;
              if (tIdx >= 1 && pList[tIdx - 1] >= 3.0) {
                consRain = 2;
                if (tIdx >= 2 && pList[tIdx - 2] >= 3.0) {
                  consRain = 3;
                }
              }
            }
            setForecastData({
              tempMax: data.daily.temperature_2m_max[tIdx],
              tempMin: data.daily.temperature_2m_min[tIdx],
              precipitation: pList[tIdx],
              windSpeedMax: wList[tIdx] || 0,
              code: data.daily.weathercode[tIdx],
              consecutiveRainCount: consRain
            });
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchForecast();
  }, [selectedDate]);

  // 과거 데이터 기반 시뮬레이션
  const simulationResults = useMemo(() => {
    if (!processedData || processedData.length === 0 || !selectedDate) return null;
    
    // 코어 엔진을 통해 전체 날씨 통계(평일/주말 및 고급 변수) 빌드
    const coreStats = buildWeatherCoreStats(processedData, settings);

    const [yyyy, mm, dd] = selectedDate.split('-');
    const targetDateObj = new Date(selectedDate);
    const day = targetDateObj.getDay();
    const isWeekendOrHoliday = day === 0 || day === 6 || isHoliday(targetDateObj) || (settings?.customWeekends || []).includes(selectedDate);

    // 사용자가 선택한 미래의 달(mm)과 요일 특성(평일/휴일)에 맞는 Baseline 산출
    const targetMonthRecords = processedData.filter(d => d.yearMonth.endsWith(`-${mm}`));
    const facilityBaseline = {};
    const excludeKeywords = ['가족석', '스윙카', '전동킥보드', '1회권', '3회권', '5회권', '2회권'];
    
    const RAIN_THRESHOLD = 3.0;

    targetMonthRecords.forEach(m => {
      if (m.rawLeisureRecords && Array.isArray(m.rawLeisureRecords)) {
        m.rawLeisureRecords.forEach(rec => {
          if (!rec.date) return;
          const recDateObj = new Date(rec.date);
          const recDay = recDateObj.getDay();
          const recIsWkEnd = recDay === 0 || recDay === 6 || isHoliday(recDateObj) || (settings?.customWeekends || []).includes(rec.date);
          
          if (recIsWkEnd === isWeekendOrHoliday) {
            let precipitation = 0;
            const rmRec = (m.rawRoomRecords || []).find(r => r.date === rec.date);
            if (rmRec) {
              precipitation = rmRec.weatherDaytimePrecip !== undefined && rmRec.weatherDaytimePrecip !== null 
                ? Number(rmRec.weatherDaytimePrecip) : Number(rmRec.weatherPrecipitation || 0);
            }
            
            if (precipitation < RAIN_THRESHOLD) {
              Object.entries(rec.breakdown || {}).forEach(([facilityName, amount]) => {
                const group = settings?.locationGroups?.[facilityName] || 'leisure';
                const isExcluded = excludeKeywords.some(keyword => facilityName.includes(keyword)) || group === 'fnb';
                if (isExcluded && !facilityName.includes('모토아레나')) return;

                if (!facilityBaseline[facilityName]) {
                  facilityBaseline[facilityName] = { group, vals: [] };
                }
                const val = typeof amount === 'number' ? Math.round(amount) : parseInt(String(amount).replace(/,/g, ''), 10) || 0;
                if (val > 0) facilityBaseline[facilityName].vals.push(val);
              });
            }
          }
        });
      }
    });

    const isForecastRainy = forecastData && forecastData.precipitation >= RAIN_THRESHOLD;

    const filterOutliers = (dataList) => {
      const values = [...dataList].sort((a, b) => a - b);
      if (values.length < 4) return values;
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      return values.filter(v => v >= lowerBound && v <= upperBound);
    };

    const results = Object.keys(facilityBaseline).map(facName => {
      const fb = facilityBaseline[facName];
      const filteredVals = filterOutliers(fb.vals);
      
      const clearAvg = filteredVals.length > 0 ? filteredVals.reduce((a, b) => a + b, 0) / filteredVals.length : 0;
      
      const forecastParam = {
        precipitation: forecastData ? forecastData.precipitation : 0,
        windSpeedMax: forecastData ? forecastData.windSpeedMax : 0,
        consecutiveRainCount: forecastData ? forecastData.consecutiveRainCount : 0
      };

      const coreImpact = predictWeatherImpact(facName, isWeekendOrHoliday, forecastParam, coreStats, clearAvg);
      
      const expectedRevenue = coreImpact.expectedRevenue;
      const variance = coreImpact.variance;
      const decreaseRate = coreImpact.decreaseRate;
      const tags = coreImpact.tags || [];
      
      let recommendation = "정상 인력 배치";
      let severity = "normal";

      if (isForecastRainy) {
        if (decreaseRate <= -50) {
          recommendation = "타격 극심 (50%+ 하락): 야외 알바 최소화 및 실내 보조 전환 강력 권장";
          severity = "high";
        } else if (decreaseRate <= -20) {
          recommendation = "타격 심함 (20%+ 하락): 아르바이트 조기 퇴근 등 인력 축소 운영 필요";
          severity = "medium";
        } else if (decreaseRate < -5) {
          recommendation = "타격 예상 (소폭 하락): 기상 상황에 따른 유연한 인력 운영 필요";
          severity = "low";
        } else if (decreaseRate > 0) {
          recommendation = "수요 증가 (풍선효과): 평소 이상의 인력 및 준비물 유지 권장";
          severity = "positive";
        } else {
          recommendation = "타격 없음/탄력 방어: 정상 인력 유지 권장";
          severity = "positive";
        }
      }

      return {
        name: facName,
        group: fb.group,
        clearAvg,
        rainyAvg: coreImpact.expectedRevenue,
        expectedRevenue,
        variance,
        decreaseRate,
        recommendation,
        severity,
        tags
      };
    });

    results.sort((a, b) => b.expectedRevenue - a.expectedRevenue);

    return {
      date: selectedDate,
      isWeekendOrHoliday,
      isForecastRainy,
      month: mm,
      results,
      weatherParam: {
         wind: forecastData ? forecastData.windSpeedMax : 0,
         precip: forecastData ? forecastData.precipitation : 0
      }
    };
  }, [processedData, selectedDate, forecastData, settings]);

  return (
    <div className="weather-forecast-container" style={{color: 'var(--text-main)'}}>
      <div style={{marginBottom: '24px'}}>
        <h2 style={{fontSize: '24px', margin: '0 0 8px 0'}}>날씨 예상 매출 및 알바 인력 배치 시뮬레이터</h2>
        <p style={{color: 'var(--text-muted)', margin: 0}}>
          특정 미래 날짜를 지정하면 기상청(Open-Meteo) 예보를 불러오고, 과거 동월 유사 조건(평/휴일)의 데이터를 분석하여 영업장별 예상 매출 타격치와 인력 운영 가이드를 제공합니다.
        </p>
      </div>

      <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '24px'}}>
        {/* 입력 및 예보 카드 */}
        <div className="glass-panel" style={{flex: '1', minWidth: '300px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
            <Calendar size={20} color="var(--accent-blue)" />
            <h3 style={{margin: 0, fontSize: '18px'}}>날짜 선택 및 날씨 예보</h3>
          </div>
          
          <div style={{marginBottom: '24px'}}>
            <label style={{display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>기준 일자 (향후 14일 이내)</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', 
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', 
                color: '#fff', fontSize: '16px'
              }}
            />
          </div>

          {loading ? (
            <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>날씨 정보를 불러오는 중...</div>
          ) : error ? (
            <div style={{color: 'var(--accent-coral)', textAlign: 'center', padding: '20px'}}>{error}</div>
          ) : forecastData ? (
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center'}}>
              <div style={{display: 'flex', justifyContent: 'center', marginBottom: '12px'}}>
                {forecastData.precipitation >= 3.0 ? (
                  <CloudRain size={48} color="var(--accent-coral)" />
                ) : (
                  <Sun size={48} color="var(--accent-gold)" />
                )}
              </div>
              <div style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '8px'}}>
                예상 강수량: <span style={{color: forecastData.precipitation >= 3.0 ? 'var(--accent-coral)' : 'var(--text-bright)'}}>{forecastData.precipitation.toFixed(1)}mm</span>
              </div>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>
                최고 기온: {forecastData.tempMax}°C / 최저 기온: {forecastData.tempMin}°C
              </div>
            </div>
          ) : null}
        </div>

        {/* 요약 카드 */}
        {simulationResults && (
          <div className="glass-panel" style={{flex: '1', minWidth: '300px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>분석 기준 모델</div>
            <div style={{fontSize: '20px', fontWeight: 'bold', marginBottom: '20px'}}>
              과거 <span style={{color: 'var(--accent-blue)'}}>{simulationResults.month}월</span>의 <span style={{color: 'var(--accent-gold)'}}>{simulationResults.isWeekendOrHoliday ? '주말 및 공휴일' : '평일'}</span> 패턴
            </div>
            
            <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>예상 임팩트 요약</div>
            <div style={{fontSize: '16px', fontWeight: 'bold', color: simulationResults.isForecastRainy ? 'var(--accent-coral)' : 'var(--accent-emerald)', lineHeight: '1.5'}}>
              {simulationResults.isForecastRainy ? (
                <span style={{display: 'flex', alignItems: 'flex-start', gap: '8px'}}>
                  <AlertTriangle size={20} style={{marginTop: '2px'}}/> 
                  <span>3.0mm 이상 우천 예상.<br/>야외 중심 영업장(레저본부)의 치명적인 매출 급감이 우려됩니다. 인력 축소를 권장합니다.</span>
                </span>
              ) : (
                <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <Sun size={20}/> 맑음 또는 미량 강수 예상. 평이한 야외 매출이 달성될 것으로 기대됩니다.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 분석 리스트 표 */}
      {simulationResults && simulationResults.results.length > 0 && (
        <div className="glass-panel" style={{padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
          <h3 style={{margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Users size={20} color="var(--accent-purple)" /> 
            영업장별 예상 매출 및 알바 인력 배치 가이드
          </h3>
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px'}}>
              <thead>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                  <th style={{padding: '12px', color: 'var(--text-muted)'}}>영업장명</th>
                  <th style={{padding: '12px', color: 'var(--text-muted)'}}>맑은 날 기대매출 (A)</th>
                  <th style={{padding: '12px', color: 'var(--text-muted)'}}>우천 시 평균 (B)</th>
                  <th style={{padding: '12px', color: 'var(--text-bright)'}}>예보 반영 예상액</th>
                  <th style={{padding: '12px', color: 'var(--text-muted)'}}>예상 증감액</th>
                  <th style={{padding: '12px', color: 'var(--text-muted)'}}>인력 운영 가이드라인</th>
                </tr>
              </thead>
              <tbody>
                {simulationResults.results.map((fac, idx) => (
                  <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}}>
                    <td style={{padding: '12px', fontWeight: 'bold'}}>{fac.name}</td>
                    <td style={{padding: '12px', color: 'var(--text-muted)'}}>₩{formatCurrency(fac.clearAvg)}</td>
                    <td style={{padding: '12px', color: 'var(--text-muted)'}}>₩{formatCurrency(fac.rainyAvg)}</td>
                    <td style={{padding: '12px', fontWeight: 'bold', color: simulationResults.isForecastRainy && fac.decreaseRate < 0 ? 'var(--accent-coral)' : 'var(--text-main)'}}>
                      ₩{formatCurrency(fac.expectedRevenue)}
                    </td>
                    <td style={{padding: '12px'}}>
                      {fac.variance < 0 ? (
                        <span style={{color: 'var(--accent-coral)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                          <TrendingDown size={14} /> ₩{formatCurrency(Math.abs(fac.variance))}
                          <span style={{fontSize: '11px'}}>({fac.decreaseRate.toFixed(1)}%)</span>
                        </span>
                      ) : (
                        <span style={{color: 'var(--text-muted)'}}>-</span>
                      )}
                    </td>
                    <td style={{padding: '12px'}}>
                      <span style={{
                        display: 'inline-block',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        background: fac.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 
                                   fac.severity === 'medium' ? 'rgba(245, 158, 11, 0.2)' : 
                                   fac.severity === 'low' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: fac.severity === 'high' ? '#fca5a5' : 
                               fac.severity === 'medium' ? '#fcd34d' : 
                               fac.severity === 'low' ? '#fef08a' : 'var(--text-muted)'
                      }}>
                        {fac.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {simulationResults.results.length === 0 && (
            <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
              분석할 수 있는 과거 동일 조건(평/휴일, {simulationResults.month}월)의 매출 데이터가 부족합니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
