/**
 * weatherCore.js
 * 날씨 4대 고급 로직(풍속 페널티, 장마 피로도, 대체재 풍선효과, 평일/주말 정규화)을
 * 앱 전반(시뮬레이터, 14일 예측, 통계)에 통일되게 적용하기 위한 코어 엔진입니다.
 */
import { isRoomWeekend, isLeisureWeekend } from './revenueUtils.js';

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
          const maxHourlyPrecip = rec.maxHourlyPrecip !== undefined && rec.maxHourlyPrecip !== null ? Number(rec.maxHourlyPrecip) : 0;
          const wind = rec.weatherWindSpeed !== undefined && rec.weatherWindSpeed !== null ? Number(rec.weatherWindSpeed) : 0;
          const code = rec.weatherCode !== undefined && rec.weatherCode !== null ? Number(rec.weatherCode) : 0;
          const tempMax = rec.weatherTempMax !== undefined && rec.weatherTempMax !== null ? Number(rec.weatherTempMax) : 20;
          const tempMin = rec.weatherTempMin !== undefined && rec.weatherTempMin !== null ? Number(rec.weatherTempMin) : 10;
          
          if (!weatherMap[rec.date]) {
            weatherMap[rec.date] = { 
              precipitation: precip, 
              maxHourlyPrecip: maxHourlyPrecip,
              windSpeed: wind, 
              isRainy: precip >= RAIN_THRESHOLD || maxHourlyPrecip >= RAIN_THRESHOLD, 
              isWindy: wind >= WIND_THRESHOLD,
              isRoomWeekend: isRoomWeekend(rec.date, settings?.customWeekends || []),
              isLeisureWeekend: isLeisureWeekend(rec.date, settings?.customWeekends || []),
              code: code,
              isSnowy: [71,73,75,77,85,86].includes(code),
              tempMax: tempMax,
              tempMin: tempMin
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
  
  const rainRatioWd = { day1: [], day2: [], day3plus: [] };
  const rainRatioWe = { day1: [], day2: [], day3plus: [] };
  const windRatioWd = { high: [] };
  const windRatioWe = { high: [] };

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
      const group = d.isRoomWeekend ? rainRatioWe : rainRatioWd;
      if (consRain === 1) group.day1.push(ratio);
      else if (consRain === 2) group.day2.push(ratio);
      else group.day3plus.push(ratio);
    } else {
      consRain = 0;
    }
    // 강풍
    if (d.isWindy) {
      if (d.isRoomWeekend) windRatioWe.high.push(ratio);
      else windRatioWd.high.push(ratio);
    }
  });

  const getAdjAvg = (ratioArr, clearBaseline) => {
    if (ratioArr.length === 0) return clearBaseline; // 표본이 없으면 평소값 반환 (-100% 오류 방지)
    const avgRatio = ratioArr.reduce((a,b) => a + b, 0) / ratioArr.length;
    return Math.round(clearBaseline * avgRatio);
  };

  coreStats.global.consecutiveRain = {
    wd: {
      clearAvg: wdClearAvg,
      day1Avg: getAdjAvg(rainRatioWd.day1, wdClearAvg),
      day2Avg: getAdjAvg(rainRatioWd.day2, wdClearAvg),
      day3plusAvg: getAdjAvg(rainRatioWd.day3plus, wdClearAvg)
    },
    we: {
      clearAvg: weClearAvg,
      day1Avg: getAdjAvg(rainRatioWe.day1, weClearAvg),
      day2Avg: getAdjAvg(rainRatioWe.day2, weClearAvg),
      day3plusAvg: getAdjAvg(rainRatioWe.day3plus, weClearAvg)
    }
  };
  coreStats.global.wind = {
    wd: {
      normalWindAvgRev: wdClearAvg,
      highWindAvgRev: getAdjAvg(windRatioWd.high, wdClearAvg)
    },
    we: {
      normalWindAvgRev: weClearAvg,
      highWindAvgRev: getAdjAvg(windRatioWe.high, weClearAvg)
    }
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
                wdSnow: [], weSnow: [],
                wdHeatwave: [], weHeatwave: [],
                wdColdwave: [], weColdwave: [],
                wdExtremeRain10: [], weExtremeRain10: [],
                wdExtremeRain5: [], weExtremeRain5: [],
                wdWindy: [], weWindy: [],
                tier: [],
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
              
              if (w.isSnowy) facilityData[fac].weSnow.push(val);
              if (w.tempMax >= 33) facilityData[fac].weHeatwave.push(val);
              if (w.tempMax <= 5 || w.tempMin <= -5) facilityData[fac].weColdwave.push(val);
              if (w.maxHourlyPrecip >= 10) facilityData[fac].weExtremeRain10.push(val);
              else if (w.maxHourlyPrecip >= 5) facilityData[fac].weExtremeRain5.push(val);
              if (w.isWindy) facilityData[fac].weWindy.push(val);
            } else {
              facilityData[fac].wdAll.push(val);
              if (w.isRainy) facilityData[fac].wdRainy.push(val);
              else facilityData[fac].wdClear.push(val);
              
              if (w.isSnowy) facilityData[fac].wdSnow.push(val);
              if (w.tempMax >= 33) facilityData[fac].wdHeatwave.push(val);
              if (w.tempMax <= 5 || w.tempMin <= -5) facilityData[fac].wdColdwave.push(val);
              if (w.maxHourlyPrecip >= 10) facilityData[fac].wdExtremeRain10.push(val);
              else if (w.maxHourlyPrecip >= 5) facilityData[fac].wdExtremeRain5.push(val);
              if (w.isWindy) facilityData[fac].wdWindy.push(val);
            }
            facilityData[fac].tier.push(val);
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
    
    const wdSnowAvg = safeAverage(vals.wdSnow);
    const weSnowAvg = safeAverage(vals.weSnow);
    const wdHeatwaveAvg = safeAverage(vals.wdHeatwave);
    const weHeatwaveAvg = safeAverage(vals.weHeatwave);
    const wdColdwaveAvg = safeAverage(vals.wdColdwave);
    const weColdwaveAvg = safeAverage(vals.weColdwave);
    const wdExtremeRain10Avg = safeAverage(vals.wdExtremeRain10);
    const weExtremeRain10Avg = safeAverage(vals.weExtremeRain10);
    const wdExtremeRain5Avg = safeAverage(vals.wdExtremeRain5);
    const weExtremeRain5Avg = safeAverage(vals.weExtremeRain5);
    const wdWindyAvg = safeAverage(vals.wdWindy);
    const weWindyAvg = safeAverage(vals.weWindy);
    const tierAvg = safeAverage(vals.tier);

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
        subStats.push({ 
          loc: fac, 
          clearAvg: overallClearAvg, 
          rainyAvg: overallRainyAvg, 
          impact,
          wdClearAvg, wdRainyAvg, wdPenalty: (wdClearAvg > 0 ? (wdRainyAvg - wdClearAvg) / wdClearAvg * 100 : 0),
          weClearAvg, weRainyAvg, wePenalty: (weClearAvg > 0 ? (weRainyAvg - weClearAvg) / weClearAvg * 100 : 0)
        });
      }
    }

    coreStats.facilities[fac] = {
      group: vals.group,
      tag: settings?.weatherTags?.[fac] || '야외 어트랙션',
      wdClearAvg, wdRainyAvg, weClearAvg, weRainyAvg,
      overallClearAvg, overallRainyAvg,
      wdPenalty: wdClearAvg > 0 ? (wdRainyAvg - wdClearAvg) / wdClearAvg : 0,
      wePenalty: weClearAvg > 0 ? (weRainyAvg - weClearAvg) / weClearAvg : 0,
      overallPenalty: avgRatio - 1,
      
      wdSnowPenalty: (vals.wdSnow.length > 0 && wdClearAvg > 0) ? (wdSnowAvg - wdClearAvg) / wdClearAvg : null,
      weSnowPenalty: (vals.weSnow.length > 0 && weClearAvg > 0) ? (weSnowAvg - weClearAvg) / weClearAvg : null,
      
      wdHeatwavePenalty: (vals.wdHeatwave.length > 0 && wdClearAvg > 0) ? (wdHeatwaveAvg - wdClearAvg) / wdClearAvg : null,
      weHeatwavePenalty: (vals.weHeatwave.length > 0 && weClearAvg > 0) ? (weHeatwaveAvg - weClearAvg) / weClearAvg : null,
      
      wdColdwavePenalty: (vals.wdColdwave.length > 0 && wdClearAvg > 0) ? (wdColdwaveAvg - wdClearAvg) / wdClearAvg : null,
      weColdwavePenalty: (vals.weColdwave.length > 0 && weClearAvg > 0) ? (weColdwaveAvg - weClearAvg) / weClearAvg : null,
      
      wdExtremeRain10Penalty: (vals.wdExtremeRain10.length > 0 && wdClearAvg > 0) ? (wdExtremeRain10Avg - wdClearAvg) / wdClearAvg : null,
      weExtremeRain10Penalty: (vals.weExtremeRain10.length > 0 && weClearAvg > 0) ? (weExtremeRain10Avg - weClearAvg) / weClearAvg : null,
      
      wdExtremeRain5Penalty: (vals.wdExtremeRain5.length > 0 && wdClearAvg > 0) ? (wdExtremeRain5Avg - wdClearAvg) / wdClearAvg : null,
      weExtremeRain5Penalty: (vals.weExtremeRain5.length > 0 && weClearAvg > 0) ? (weExtremeRain5Avg - weClearAvg) / weClearAvg : null,
      
      wdWindyPenalty: (vals.wdWindy.length > 0 && wdClearAvg > 0) ? (wdWindyAvg - wdClearAvg) / wdClearAvg : null,
      weWindyPenalty: (vals.weWindy.length > 0 && weClearAvg > 0) ? (weWindyAvg - weClearAvg) / weClearAvg : null
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
  const isSnowy = forecastWeather.isSnowy || [71,73,75,77,85,86].includes(forecastWeather.code);
  const isRainy = forecastWeather.precipitation >= RAIN_THRESHOLD && !isSnowy;
  const maxHourlyPrecip = forecastWeather.maxHourlyPrecip || 0;
  const isWindy = forecastWeather.windSpeedMax >= WIND_THRESHOLD;
  const consRainDays = forecastWeather.consecutiveRainCount || (isRainy ? 1 : 0);
  const tempMax = forecastWeather.tempMax || 20;
  const tempMin = forecastWeather.tempMin || 10;

  const clearBaseline = customBaseline !== null ? customBaseline : (isWeekend ? fStat.weClearAvg : fStat.wdClearAvg);
  if (clearBaseline === 0) return { expectedRevenue: 0, clearBaseline: 0, variance: 0, decreaseRate: 0, tags: [] };

  let expectedRevenue = clearBaseline;
  const tags = [];

  // 통계 기반 페널티 적용 헬퍼
  const applyPenalty = (penalty, label, fallbackPenalty = 0, fallbackLabel = '') => {
    const finalPenalty = penalty !== null ? penalty : fallbackPenalty;
    const finalLabel = penalty !== null ? label : fallbackLabel;
    
    if (finalPenalty !== 0) {
      expectedRevenue = expectedRevenue * (1 + finalPenalty);
      const sign = finalPenalty > 0 ? '+' : '';
      tags.push(`${finalLabel}(${sign}${(finalPenalty * 100).toFixed(1)}%)`);
      return true;
    }
    return false;
  };

  const baseRainPenalty = isWeekend ? fStat.wePenalty : fStat.wdPenalty;
  const snowPenalty = isWeekend ? fStat.weSnowPenalty : fStat.wdSnowPenalty;
  const extremeRain10Penalty = isWeekend ? fStat.weExtremeRain10Penalty : fStat.wdExtremeRain10Penalty;
  const extremeRain5Penalty = isWeekend ? fStat.weExtremeRain5Penalty : fStat.wdExtremeRain5Penalty;
  const heatwavePenalty = isWeekend ? fStat.weHeatwavePenalty : fStat.wdHeatwavePenalty;
  const coldwavePenalty = isWeekend ? fStat.weColdwavePenalty : fStat.wdColdwavePenalty;
  const windyPenalty = isWeekend ? fStat.weWindyPenalty : fStat.wdWindyPenalty;

  // 1. 강설 (Snow)
  if (isSnowy) {
    applyPenalty(snowPenalty, '강설 통계반영', baseRainPenalty, '강설(우천대체) 통계반영');
  }
  // 2. 강우 (Rain)
  else if (isRainy || maxHourlyPrecip > 0) {
    let applied = false;
    if (maxHourlyPrecip >= 10) {
      applied = applyPenalty(extremeRain10Penalty, '호우 통계반영', extremeRain5Penalty !== null ? extremeRain5Penalty : baseRainPenalty, '호우(폭우대체) 통계반영');
    } else if (maxHourlyPrecip >= 5) {
      applied = applyPenalty(extremeRain5Penalty, '폭우 통계반영', baseRainPenalty, '폭우(우천대체) 통계반영');
    }
    
    if (!applied) {
      const isPositive = baseRainPenalty > 0;
      applyPenalty(baseRainPenalty, isPositive ? '풍선효과 통계반영' : '우천 통계반영');
    }

    // 장마 피로도 추가 페널티 적용 (야외 한정, 전역 통계 기반)
    if (consRainDays >= 2 && expectedRevenue < clearBaseline && ['야외 어트랙션', '야외 트랙', '공중/동력', '골프장'].includes(tag)) {
      const gStats = isWeekend ? coreStats.global.consecutiveRain.we : coreStats.global.consecutiveRain.wd;
      const globalClear = gStats.clearAvg;
      const gDay1 = gStats.day1Avg;
      const gDay2 = gStats.day2Avg;
      const gDay3 = gStats.day3plusAvg;
      
      if (globalClear > 0 && gDay1 > 0) {
        let fatigueRatio = 1;
        if (consRainDays === 2 && gDay2 > 0) fatigueRatio = gDay2 / gDay1;
        if (consRainDays >= 3 && gDay3 > 0) fatigueRatio = gDay3 / gDay1;
        
        if (fatigueRatio < 1 && fatigueRatio > 0.5) { 
          const additionalPenalty = 1 - fatigueRatio;
          expectedRevenue = expectedRevenue * (1 - additionalPenalty);
          tags.push(`장마피로도 통계반영`);
        }
      }
    }
  }

  // 3. 강풍 (Wind)
  if (isWindy && expectedRevenue > 0) {
    const wStats = isWeekend ? coreStats.global.wind.we : coreStats.global.wind.wd;
    const normalWind = wStats.normalWindAvgRev;
    const highWind = wStats.highWindAvgRev;
    const globalWindPenalty = (normalWind > 0 && highWind < normalWind) ? (highWind - normalWind) / normalWind : 0;
    
    applyPenalty(windyPenalty, '강풍 통계반영', globalWindPenalty, '강풍(전역) 통계반영');
  }

  // 4. 기온 (Temperature)
  if (tempMax >= 33 && expectedRevenue > 0) {
    applyPenalty(heatwavePenalty, '폭염 통계반영');
  } else if ((tempMax <= 5 || tempMin <= -5) && expectedRevenue > 0) {
    applyPenalty(coldwavePenalty, '한파 통계반영');
  }

  const variance = expectedRevenue - clearBaseline;
  const decreaseRate = (variance / clearBaseline) * 100;

  return { expectedRevenue, clearBaseline, variance, decreaseRate, tags };
};
