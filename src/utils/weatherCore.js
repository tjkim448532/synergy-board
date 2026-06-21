/**
 * weatherCore.js
 * 날씨 4대 고급 로직(풍속 페널티, 장마 피로도, 대체재 풍선효과, 평일/주말 정규화)을
 * 앱 전반(시뮬레이터, 14일 예측, 통계)에 통일되게 적용하기 위한 코어 엔진입니다.
 */

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

// 이상치 제거 (IQR)
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
  
  const isHoliday = (dateObj) => {
    const month = dateObj.getMonth() + 1;
    const date = dateObj.getDate();
    const holiStr = `${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const holidays = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
    return holidays.includes(holiStr);
  };

  const isWeekendByConfig = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const isSatSun = (day === 0 || day === 6);
    const custom = settings?.customWeekends || [];
    return isSatSun || isHoliday(d) || custom.includes(dateStr);
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
              isWeekend: isWeekendByConfig(rec.date) 
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
      ...(weatherMap[date] || { isRainy: false, isWindy: false }),
      revenue: dailyTotalRevMap[date]
    };
  }).filter(d => d.precipitation !== undefined); // 날씨 데이터가 있는 날만 필터링

  // 2. 심슨의 역설(Simpson's Paradox) 방지 - 요일 편향 정규화
  // 평일과 주말의 기본 매출 단가가 크게 다르므로, 단순 합산 시 "주말에 비가 많이 온 경우" 
  // 비오는 날 평균이 맑은 날보다 높아지는 역전 현상이 발생합니다.
  // 이를 막기 위해 각 날짜를 자신의 요일 기준(Baseline) 대비 비율(Ratio)로 환산하여 집계합니다.
  const wdClearRevs = allDaysRevs.filter(d => !d.isWeekend && !d.isRainy && !d.isWindy).map(d => d.revenue);
  const weClearRevs = allDaysRevs.filter(d => d.isWeekend && !d.isRainy && !d.isWindy).map(d => d.revenue);
  
  const wdClearAvg = safeAverage(filterOutliers(wdClearRevs));
  const weClearAvg = safeAverage(filterOutliers(weClearRevs));
  const globalClearAvg = safeAverage(filterOutliers([...wdClearRevs, ...weClearRevs])); // UI 표시용 공통 기준값

  allDaysRevs.sort((a,b) => a.date.localeCompare(b.date));
  let consRain = 0;
  
  const rainRatioGroup = { day1: [], day2: [], day3plus: [] };
  const windRatioGroup = { high: [] };

  allDaysRevs.forEach(d => {
    const baseline = d.isWeekend ? weClearAvg : wdClearAvg;
    if (baseline === 0) return;
    
    const ratio = d.revenue / baseline;

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
    if (ratioArr.length === 0) return 0;
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

  // 3. Facility 별 주중/주말 및 우천 매출
  const facilityData = {};
  processedData.forEach(m => {
    if (m.rawLeisureRecords) {
      m.rawLeisureRecords.forEach(rec => {
        if (!rec.date || !weatherMap[rec.date]) return;
        const w = weatherMap[rec.date];

        if (rec.breakdown) {
          Object.entries(rec.breakdown).forEach(([fac, amount]) => {
            const group = settings?.locationGroups?.[fac] || 'leisure';
            const isExcluded = excludeKeywords.some(keyword => fac.includes(keyword)) || group === 'fnb';
            if (isExcluded && !fac.includes('모토아레나')) return;

            if (!facilityData[fac]) {
              facilityData[fac] = {
                wdClear: [], wdRainy: [], weClear: [], weRainy: [], group
              };
            }
            const val = parseAmount(amount);
            if (val > 0) {
              if (w.isWeekend) {
                if (w.isRainy) facilityData[fac].weRainy.push(val);
                else facilityData[fac].weClear.push(val);
              } else {
                if (w.isRainy) facilityData[fac].wdRainy.push(val);
                else facilityData[fac].wdClear.push(val);
              }
            }
          });
        }
      });
    }
  });

  // 4. Facility Stats 및 풍선효과 종합
  const subStats = [];
  Object.entries(facilityData).forEach(([fac, vals]) => {
    const wdClearAvg = safeAverage(filterOutliers(vals.wdClear));
    const wdRainyAvg = safeAverage(filterOutliers(vals.wdRainy));
    const weClearAvg = safeAverage(filterOutliers(vals.weClear));
    const weRainyAvg = safeAverage(filterOutliers(vals.weRainy));

    // 전체 맑은날 vs 비오는날 (풍선효과 탐지용) - 심슨의 역설 제거
    // 주말/평일 비중 편향을 없애기 위해 비율의 평균을 사용
    const wdRatio = wdClearAvg > 0 ? (wdRainyAvg / wdClearAvg) : 1;
    const weRatio = weClearAvg > 0 ? (weRainyAvg / weClearAvg) : 1;
    const avgRatio = (wdRatio + weRatio) / 2;

    const overallClearAvg = (wdClearAvg + weClearAvg) / 2; 
    const overallRainyAvg = overallClearAvg * avgRatio;
    
    if (overallClearAvg > 0) {
      const impact = (avgRatio - 1) * 100;
      if (impact > 0) { // 비올 때 실질적으로 오르는 경우 (진짜 풍선효과)
        subStats.push({ loc: fac, clearAvg: overallClearAvg, rainyAvg: overallRainyAvg, impact });
      }
    }

    coreStats.facilities[fac] = {
      group: vals.group,
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

  const isRainy = forecastWeather.precipitation >= RAIN_THRESHOLD;
  const isWindy = forecastWeather.windSpeedMax >= WIND_THRESHOLD;
  const consRainDays = forecastWeather.consecutiveRainCount || (isRainy ? 1 : 0);

  // 1. 기본 베이스라인: 평일이면 평일 맑음 평균, 주말이면 주말 맑음 평균! (핵심 개선)
  const clearBaseline = customBaseline !== null ? customBaseline : (isWeekend ? fStat.weClearAvg : fStat.wdClearAvg);
  if (clearBaseline === 0) return { expectedRevenue: 0, clearBaseline: 0, variance: 0, decreaseRate: 0, tags: [] };

  let expectedRevenue = clearBaseline;
  const tags = [];

  // 2. 우천 페널티 적용 (주중/주말 분리 페널티)
  if (isRainy) {
    const baseRainPenalty = isWeekend ? fStat.wePenalty : fStat.wdPenalty;
    expectedRevenue = clearBaseline * (1 + baseRainPenalty);
    tags.push('우천반영');

    // 3. 장마 피로도 추가 페널티 적용 (Global 비율 참조)
    if (consRainDays >= 2) {
      const globalClear = coreStats.global.consecutiveRain.clearAvg;
      const gDay1 = coreStats.global.consecutiveRain.day1Avg;
      const gDay2 = coreStats.global.consecutiveRain.day2Avg;
      const gDay3 = coreStats.global.consecutiveRain.day3plusAvg;
      
      if (globalClear > 0 && gDay1 > 0) {
        let fatigueRatio = 1;
        if (consRainDays === 2 && gDay2 > 0) fatigueRatio = gDay2 / gDay1;
        if (consRainDays >= 3 && gDay3 > 0) fatigueRatio = gDay3 / gDay1;
        
        if (fatigueRatio < 1 && fatigueRatio > 0.5) { // 하락하는 추세라면
          const additionalPenalty = 1 - fatigueRatio;
          expectedRevenue = expectedRevenue * (1 - additionalPenalty);
          tags.push(`장마피로도(${consRainDays}일차)`);
        }
      }
    }

    // 4. 대체재(풍선효과) 검증
    const subEffect = coreStats.global.substitutionStats.find(s => s.loc === facilityName);
    if (subEffect && subEffect.impact > 0) {
      // 풍선효과가 확인된 시설은 우천 시 오히려 상승!
      expectedRevenue = clearBaseline * (1 + (subEffect.impact / 100));
      tags.push('풍선효과(매출상승)');
    }
  }

  // 5. 강풍 페널티 (바람 10m/s 이상 시 전체 매출의 하락 비율 적용)
  if (isWindy && expectedRevenue > 0) {
    const normalWind = coreStats.global.wind.normalWindAvgRev;
    const highWind = coreStats.global.wind.highWindAvgRev;
    if (normalWind > 0 && highWind < normalWind) {
      const windDropRatio = (normalWind - highWind) / normalWind; // e.g. 0.15 (15% drop)
      expectedRevenue = expectedRevenue * (1 - windDropRatio);
      tags.push('강풍타격');
    }
  }

  const variance = expectedRevenue - clearBaseline;
  const decreaseRate = (variance / clearBaseline) * 100;

  return { expectedRevenue, clearBaseline, variance, decreaseRate, tags };
};
