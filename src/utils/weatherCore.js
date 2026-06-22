/**
 * weatherCore.js
 * 날씨 4대 고급 로직(풍속 페널티, 장마 피로도, 대체재 풍선효과, 평일/주말 정규화)을
 * 앱 전반(시뮬레이터, 14일 예측, 통계)에 통일되게 적용하기 위한 코어 엔진입니다.
 */
import { isRoomWeekend, isLeisureWeekend } from './revenueUtils';

const parseAmount = (val) => {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  const str = String(val).replace(/,/g, '').trim();
  const num = Number(str);
  return isNaN(num) ? 0 : Math.round(num);
};

const safeAverage = (arr, round = true) => {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((acc, val) => acc + parseAmount(val), 0);
  const avg = sum / arr.length;
  return round ? Math.round(avg) : avg;
};

const getUpperBound = (dataList) => {
  const nonZero = dataList.filter(v => v > 0).sort((a, b) => a - b);
  if (nonZero.length < 4) return Infinity;
  const q1 = nonZero[Math.floor(nonZero.length * 0.25)];
  const q3 = nonZero[Math.floor(nonZero.length * 0.75)];
  const iqr = q3 - q1;
  return q3 + 1.5 * iqr;
};

// 이상치 제거 (IQR)
const filterOutliers = (dataList, upperBound = null) => {
  if (upperBound !== null) return dataList.filter(v => v <= upperBound);
  const bound = getUpperBound(dataList);
  return dataList.filter(v => v <= bound);
};

/**
 * 전역 데이터에서 날씨 통계(평일/주말 맑음, 강풍, 장마, 대체재) 모델을 사전 빌드합니다.
 */
export const buildWeatherCoreStats = (processedData, settings, RAIN_THRESHOLD = 3.0, WIND_THRESHOLD = 10.0) => {
  const coreStats = {
    global: {
      consecutiveRain: { clearAvg: 0, day1Avg: 0, day2Avg: 0, day3plusAvg: 0 },
      wind: { highWindAvgRev: 0, normalWindAvgRev: 0 },
      substitutionStats: []
    },
    facilities: {} // facility별 평일/주말 맑은 날 평균, 우천 평균
  };

  const excludeKeywords = ['가족석', '스윙카', '전동킥보드', '1회권', '3회권', '5회권', '2회권'];
  
  const getWeekendResolver = (group) => (dateStr) => {
    if (group === 'room') return isRoomWeekend(dateStr, settings?.customWeekends || []);
    return isLeisureWeekend(dateStr, settings?.customWeekends || []);
  };

  const weatherMap = {};
  const dailyTotalRevMap = {};

  // 1. 날씨 정보 매핑 및 일일 총매출 병합 (rawRoomRecords & rawLeisureRecords 기준)
  processedData.forEach(m => {
    if (m.rawRoomRecords) {
      m.rawRoomRecords.forEach(rec => {
        if (rec.date) {
          const precip = rec.weatherDaytimePrecip !== undefined && rec.weatherDaytimePrecip !== null ? Number(rec.weatherDaytimePrecip) : Number(rec.weatherPrecipitation || 0);
          const wind = rec.weatherWindSpeed !== undefined && rec.weatherWindSpeed !== null ? Number(rec.weatherWindSpeed) : 0;
          
          if (!weatherMap[rec.date]) {
            weatherMap[rec.date] = { 
              precipitation: precip, 
              windSpeed: wind, 
              isRainy: precip >= RAIN_THRESHOLD, 
              isWindy: wind >= WIND_THRESHOLD,
              isRoomWeekend: isRoomWeekend(rec.date, settings?.customWeekends || []),
              isLeisureWeekend: isLeisureWeekend(rec.date, settings?.customWeekends || [])
            };
          }
          if (!dailyTotalRevMap[rec.date]) dailyTotalRevMap[rec.date] = 0;
          dailyTotalRevMap[rec.date] += parseAmount(rec.revenue);
        }
      });
    }

    // 부대업장(Leisure) 데이터도 일일 총매출에 합산
    if (m.rawLeisureRecords) {
      m.rawLeisureRecords.forEach(rec => {
        if (rec.date) {
          if (!dailyTotalRevMap[rec.date]) dailyTotalRevMap[rec.date] = 0;
          if (rec.breakdown) {
            Object.values(rec.breakdown).forEach(amount => {
              dailyTotalRevMap[rec.date] += parseAmount(amount);
            });
          }
        }
      });
    }
  });

  const allDaysRevs = Object.keys(dailyTotalRevMap).map(date => {
    return {
      date,
      ...(weatherMap[date] || { isRainy: false, isWindy: false, isRoomWeekend: false }),
      revenue: dailyTotalRevMap[date]
    };
  }).filter(d => d.precipitation !== undefined); // 날씨 데이터가 있는 날만 필터링

  // 2. 심슨의 역설(Simpson's Paradox) 방지 - 요일 편향 정규화
  // 전역 집계용(global) 통계는 전체 매출의 다수를 차지하는 Room 기준을 디폴트로 사용
  const wdAllRevs = allDaysRevs.filter(d => !d.isRoomWeekend).map(d => d.revenue);
  const weAllRevs = allDaysRevs.filter(d => d.isRoomWeekend).map(d => d.revenue);
  
  const wdUpperBound = getUpperBound(wdAllRevs);
  const weUpperBound = getUpperBound(weAllRevs);

  const wdClearRevs = allDaysRevs.filter(d => !d.isRoomWeekend && !d.isRainy && !d.isWindy && d.revenue <= wdUpperBound).map(d => d.revenue);
  const weClearRevs = allDaysRevs.filter(d => d.isRoomWeekend && !d.isRainy && !d.isWindy && d.revenue <= weUpperBound).map(d => d.revenue);
  
  const wdClearAvg = safeAverage(wdClearRevs);
  const weClearAvg = safeAverage(weClearRevs);
  const globalClearAvg = safeAverage([...wdClearRevs, ...weClearRevs]); // UI 표시용 공통 기준값

  allDaysRevs.sort((a,b) => a.date.localeCompare(b.date));
  let consRain = 0;
  let lastDateObj = null;
  
  const rainRatioGroup = { day1: [], day2: [], day3plus: [] };
  const windRatioGroup = { high: [] };

  allDaysRevs.forEach(d => {
    // 1. 이상치 상한선을 초과한 비정상적인 데이터(폭증 등)는 분석에서 완전 제외하여 신뢰성 확보
    const upperBound = d.isRoomWeekend ? weUpperBound : wdUpperBound;
    if (d.revenue > upperBound) return;

    // 전역 집계용이므로 Room 기준 디폴트 사용
    const baseline = d.isRoomWeekend ? weClearAvg : wdClearAvg;
    if (baseline === 0) return;
    
    const ratio = d.revenue / baseline;
    const currentObj = new Date(d.date);

    // 날짜 갭 확인 (결측치 날짜 건너뛰기로 인해 가짜 연속우천 카운트 방지)
    if (lastDateObj) {
      const diffDays = (currentObj - lastDateObj) / (1000 * 60 * 60 * 24);
      if (diffDays > 1.5) consRain = 0;
    }
    lastDateObj = currentObj;

    // 장마
    if (d.isRainy) {
      consRain++;
      if (consRain === 1) rainRatioGroup.day1.push(ratio);
      else if (consRain === 2) rainRatioGroup.day2.push(ratio);
      else rainRatioGroup.day3plus.push(ratio);
    } else {
      consRain = 0;
    }
    // 강풍
    if (d.isWindy) windRatioGroup.high.push(ratio);
  });

  const getAdjAvg = (ratioArr) => {
    if (ratioArr.length === 0) return globalClearAvg; // 표본이 없으면 평소값 반환 (-100% 오류 방지)
    const avgRatio = ratioArr.reduce((a,b) => a + b, 0) / ratioArr.length;
    return Math.round(globalClearAvg * avgRatio);
  };

  coreStats.global.consecutiveRain = {
    clearAvg: globalClearAvg,
    day1Avg: getAdjAvg(rainRatioGroup.day1),
    day2Avg: getAdjAvg(rainRatioGroup.day2),
    day3plusAvg: getAdjAvg(rainRatioGroup.day3plus)
  };
  coreStats.global.wind = {
    normalWindAvgRev: globalClearAvg,
    highWindAvgRev: getAdjAvg(windRatioGroup.high)
  };

  // 3. Facility 별 주중/주말 및 우천 매출 (생존자 편향 해결)
  const facilityData = {};
  
  // 3-1. 시설별 활성 월(Active Months) 파악
  // 비가 와서 0원을 기록한 날(결측치)을 평균에 포함하되, 계절성 장기 휴장(겨울 워터파크 등)으로 
  // 발생한 0원을 제외하기 위해 "해당 월에 단 하루라도 영업했는지"를 먼저 추적합니다.
  const activeMonths = {}; 
  processedData.forEach(m => {
    if (m.rawLeisureRecords) {
      m.rawLeisureRecords.forEach(rec => {
        if (!rec.date) return;
        const monthKey = rec.date.substring(0, 7); // 'YYYY-MM'
        if (rec.breakdown) {
          Object.entries(rec.breakdown).forEach(([fac, amount]) => {
            const val = parseAmount(amount);
            if (val > 0) {
              const group = settings?.locationGroups?.[fac] || 'leisure';
              const isExcluded = excludeKeywords.some(keyword => fac.includes(keyword)) || group === 'fnb';
              if (!isExcluded || fac.includes('모토아레나')) {
                if (!activeMonths[fac]) activeMonths[fac] = new Set();
                activeMonths[fac].add(monthKey);
              }
            }
          });
        }
      });
    }
  });

  // 3-2. 일별 집계 (우천 휴장/매출 0원 반영)
  processedData.forEach(m => {
    if (m.rawLeisureRecords) {
      m.rawLeisureRecords.forEach(rec => {
        if (!rec.date || !weatherMap[rec.date]) return;
        const w = weatherMap[rec.date];
        const monthKey = rec.date.substring(0, 7);

        Object.keys(activeMonths).forEach(fac => {
          // 해당 시설이 이번 달에 한 번이라도 오픈한 경우에만(시즌 중) 집계
          if (activeMonths[fac].has(monthKey)) {
            if (!facilityData[fac]) {
              facilityData[fac] = {
                wdAll: [], weAll: [],
                wdClear: [], wdRainy: [], weClear: [], weRainy: [], 
                group: settings?.locationGroups?.[fac] || 'leisure'
              };
            }
            
            // 결측치(휴장)일 경우 0원으로 강제 기록하여 비로 인한 매출 타격이 0이 되는 것을 평균에 끌어내림
            const val = rec.breakdown && rec.breakdown[fac] ? parseAmount(rec.breakdown[fac]) : 0;
            const facGroup = settings?.locationGroups?.[fac] || 'leisure';
            const isThisWeekend = facGroup === 'room' ? w.isRoomWeekend : w.isLeisureWeekend;
            
            if (isThisWeekend) {
              facilityData[fac].weAll.push(val);
              if (w.isRainy) facilityData[fac].weRainy.push(val);
              else facilityData[fac].weClear.push(val);
            } else {
              facilityData[fac].wdAll.push(val);
              if (w.isRainy) facilityData[fac].wdRainy.push(val);
              else facilityData[fac].wdClear.push(val);
            }
          }
        });
      });
    }
  });

  // 4. Facility Stats 및 풍선효과 종합
  const subStats = [];
  Object.entries(facilityData).forEach(([fac, vals]) => {
    const wdBound = getUpperBound(vals.wdAll);
    const weBound = getUpperBound(vals.weAll);

    const wdClearAvg = safeAverage(filterOutliers(vals.wdClear, wdBound));
    const wdRainyAvg = safeAverage(filterOutliers(vals.wdRainy, wdBound));
    const weClearAvg = safeAverage(filterOutliers(vals.weClear, weBound));
    const weRainyAvg = safeAverage(filterOutliers(vals.weRainy, weBound));

    // 전체 맑은날 vs 비오는날 (풍선효과 탐지용) - 심슨의 역설 제거
    // 주말/평일 비중 편향을 없애기 위해 비율의 평균을 사용
    let wdRatio = 1, weRatio = 1;
    let validRatios = 0;
    let sumRatio = 0;
    
    if (wdClearAvg > 0) {
      wdRatio = wdRainyAvg / wdClearAvg;
      sumRatio += wdRatio;
      validRatios++;
    }
    if (weClearAvg > 0) {
      weRatio = weRainyAvg / weClearAvg;
      sumRatio += weRatio;
      validRatios++;
    }
    
    const avgRatio = validRatios > 0 ? sumRatio / validRatios : 1;

    let overallClearAvg = 0;
    if (wdClearAvg > 0 && weClearAvg > 0) {
      overallClearAvg = (wdClearAvg * 5 + weClearAvg * 2) / 7;
    } else if (wdClearAvg > 0) {
      overallClearAvg = wdClearAvg;
    } else if (weClearAvg > 0) {
      overallClearAvg = weClearAvg;
    }
    
    const overallRainyAvg = overallClearAvg * avgRatio;
    
    const tag = settings?.weatherTags?.[fac] || '야외 어트랙션';
    
    if (overallClearAvg > 0) {
      const impact = (avgRatio - 1) * 100;
      const isOutdoorTag = ['야외 어트랙션', '야외 트랙', '공중/동력', '골프장'].includes(tag);
      
      // 진짜 풍선효과: 1% 이상 오르고 야외 관련 태그가 아닐 때만 (통계적 노이즈/생존자 편향 차단)
      if (impact > 1 && !isOutdoorTag && vals.group !== 'exclude') { 
        subStats.push({ loc: fac, clearAvg: overallClearAvg, rainyAvg: overallRainyAvg, impact });
      }
    }

    coreStats.facilities[fac] = {
      group: vals.group,
      tag: settings?.weatherTags?.[fac] || '야외 어트랙션',
      wdClearAvg, wdRainyAvg, weClearAvg, weRainyAvg,
      overallClearAvg, overallRainyAvg,
      wdPenalty: wdClearAvg > 0 ? (wdRainyAvg - wdClearAvg) / wdClearAvg : 0,
      wePenalty: weClearAvg > 0 ? (weRainyAvg - weClearAvg) / weClearAvg : 0,
      overallPenalty: avgRatio - 1
    };
  });
  
  subStats.sort((a,b) => b.impact - a.impact);
  coreStats.global.substitutionStats = subStats;

  return coreStats;
};

/**
 * 특정 영업장의 특정 일자(예보) 기대매출을 코어 모델 기반으로 시뮬레이션합니다.
 * @param {string} facilityName - 영업장명
 * @param {boolean} isWeekend - 대상일이 주말인지
 * @param {object} forecastWeather - { precipitation, windSpeedMax, consecutiveRainCount }
 * @param {object} coreStats - buildWeatherCoreStats에서 리턴받은 객체
 */
export const predictWeatherImpact = (facilityName, isWeekend, forecastWeather, coreStats, customBaseline = null, RAIN_THRESHOLD = 3.0, WIND_THRESHOLD = 10.0) => {
  const fStat = coreStats.facilities[facilityName];
  if (!fStat) return { expectedRevenue: 0, clearBaseline: customBaseline || 0, variance: 0, decreaseRate: 0, tags: [] };

  const tag = fStat.tag || '야외 어트랙션';
  const isRainy = forecastWeather.precipitation >= RAIN_THRESHOLD;
  const maxHourlyPrecip = forecastWeather.maxHourlyPrecip || 0;
  const isWindy = forecastWeather.windSpeedMax >= WIND_THRESHOLD;
  const consRainDays = forecastWeather.consecutiveRainCount || (isRainy ? 1 : 0);
  const tempMax = forecastWeather.tempMax || 20;
  const tempMin = forecastWeather.tempMin || 10;

  const clearBaseline = customBaseline !== null ? customBaseline : (isWeekend ? fStat.weClearAvg : fStat.wdClearAvg);
  if (clearBaseline === 0) return { expectedRevenue: 0, clearBaseline: 0, variance: 0, decreaseRate: 0, tags: [] };

  let expectedRevenue = clearBaseline;
  const tags = [];

  // 1. 강수량 (Hourly Rainfall) 기준 도메인 룰 반영
  if (isRainy || maxHourlyPrecip > 0) {
    if (tag === '야외 어트랙션' || tag === '야외 트랙' || tag === '공중/동력') {
      if (maxHourlyPrecip >= 10) {
        expectedRevenue = expectedRevenue * 0.3; // 70% 감소
        tags.push('호우 통제(-70%)');
      } else if (maxHourlyPrecip >= 5) {
        expectedRevenue = expectedRevenue * 0.6; // 40% 감소
        tags.push('우천 운영차질(-40%)');
      } else if (maxHourlyPrecip >= 0.1 || isRainy) {
        expectedRevenue = expectedRevenue * 0.85; // 15% 감소
        tags.push('우천 예약취소(-15%)');
      }
    } else if (tag === '골프장') {
      if (maxHourlyPrecip >= 5) {
        expectedRevenue = expectedRevenue * 0.15; // 85% 감소
        tags.push('호우 전면취소(-85%)');
      } else if (maxHourlyPrecip >= 2) {
        expectedRevenue = expectedRevenue * 0.55; // 45% 감소
        tags.push('우천 라운딩차질(-45%)');
      } else if (maxHourlyPrecip >= 0.1 || isRainy) {
        expectedRevenue = expectedRevenue * 0.85; // 15% 감소
        tags.push('우천 노쇼(-15%)');
      }
    } else if (tag === '실내/F&B') {
      if (maxHourlyPrecip >= 10) {
        expectedRevenue = expectedRevenue * 1.15; // 15% 상승
        tags.push('실내 특수(+15%)');
      } else {
        // 기존 통계적 풍선효과 적용
        const subEffect = coreStats.global.substitutionStats.find(s => s.loc === facilityName);
        if (subEffect && subEffect.impact > 0) {
          expectedRevenue = expectedRevenue * (1 + (subEffect.impact / 100));
          tags.push('풍선효과(매출상승)');
        }
      }
    } else {
      // 기타 카테고리(물놀이, 겨울시설 등)는 기존 통계적 페널티 적용
      const baseRainPenalty = isWeekend ? fStat.wePenalty : fStat.wdPenalty;
      expectedRevenue = expectedRevenue * (1 + baseRainPenalty);
      tags.push('우천 통계반영');
    }

    // 장마 피로도 추가 페널티 적용 (야외 한정)
    if (consRainDays >= 2 && expectedRevenue < clearBaseline && ['야외 어트랙션', '야외 트랙', '공중/동력', '골프장'].includes(tag)) {
      const globalClear = coreStats.global.consecutiveRain.clearAvg;
      const gDay1 = coreStats.global.consecutiveRain.day1Avg;
      const gDay2 = coreStats.global.consecutiveRain.day2Avg;
      const gDay3 = coreStats.global.consecutiveRain.day3plusAvg;
      
      if (globalClear > 0 && gDay1 > 0) {
        let fatigueRatio = 1;
        if (consRainDays === 2 && gDay2 > 0) fatigueRatio = gDay2 / gDay1;
        if (consRainDays >= 3 && gDay3 > 0) fatigueRatio = gDay3 / gDay1;
        
        if (fatigueRatio < 1 && fatigueRatio > 0.5) { 
          const additionalPenalty = 1 - fatigueRatio;
          expectedRevenue = expectedRevenue * (1 - additionalPenalty);
          tags.push(`장마피로도(${consRainDays}일차)`);
        }
      }
    }
  }

  // 2. 강풍 페널티 (Wind Speed)
  if (isWindy && expectedRevenue > 0) {
    if (tag === '공중/동력' && forecastWeather.windSpeedMax >= 15) {
      expectedRevenue = 0;
      tags.push('강풍 전면운휴(-100%)');
    } else {
      const normalWind = coreStats.global.wind.normalWindAvgRev;
      const highWind = coreStats.global.wind.highWindAvgRev;
      if (normalWind > 0 && highWind < normalWind) {
        const windDropRatio = (normalWind - highWind) / normalWind;
        expectedRevenue = expectedRevenue * (1 - windDropRatio);
        tags.push('강풍 타격');
      }
    }
  }

  // 3. 기온 (Temperature) 믹스 변화
  if (tempMax >= 33 && expectedRevenue > 0) {
    if (tag === '물놀이/수영장') {
      expectedRevenue = expectedRevenue * 1.5; 
      tags.push('폭염 특수(+50%)');
    } else if (tag === '야외 어트랙션' || tag === '야외 트랙') {
      expectedRevenue = expectedRevenue * 0.7; 
      tags.push('폭염 야외기피(-30%)');
    }
  } else if ((tempMax <= 5 || tempMin <= -5) && expectedRevenue > 0) {
    if (tag === '겨울 시설') {
      expectedRevenue = expectedRevenue * 1.3; 
      tags.push('겨울 특수(+30%)');
    } else if (tag === '야외 어트랙션' || tag === '야외 트랙' || tag === '물놀이/수영장') {
      expectedRevenue = expectedRevenue * 0.6; 
      tags.push('한파 야외기피(-40%)');
    } else if (tag === '실내/F&B') {
      expectedRevenue = expectedRevenue * 1.1; 
      tags.push('한파 실내선호(+10%)');
    }
  }

  const variance = expectedRevenue - clearBaseline;
  const decreaseRate = (variance / clearBaseline) * 100;

  return { expectedRevenue, clearBaseline, variance, decreaseRate, tags };
};
