import React, { useState, useMemo, useEffect } from 'react';
import useGoogleSheetVisitors from '../hooks/useGoogleSheetVisitors';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, PieChart, Pie, Cell, ComposedChart, Bar
} from 'recharts';
import CountUpModule from 'react-countup';
const CountUp = CountUpModule.default || CountUpModule;
import { isHoliday } from 'korean-holidays';
import { calculateGroupedSales } from '../utils/revenueUtils';
import { fetchCurrentWeather } from '../utils/weatherUtils';
import { parseSafeNumber, safeAverage, filterOutliers } from '../utils/statUtils';

// 피어슨 상관계수 계산 함수
function calculateCorrelation(xArray, yArray) {
  if (xArray.length !== yArray.length || xArray.length < 2) return null;
  const n = xArray.length;
  // 매출 제곱 시 자바스크립트 최대 정수 한계(9000조) 초과를 막기 위해 1만원 단위로 스케일링
  const normX = xArray.map(v => v / 10000);
  const normY = yArray.map(v => v / 10000);

  const sumX = normX.reduce((a, b) => a + b, 0);
  const sumY = normY.reduce((a, b) => a + b, 0);
  const sumX2 = normX.reduce((a, b) => a + (b * b), 0);
  const sumY2 = normY.reduce((a, b) => a + (b * b), 0);
  const sumXY = normX.reduce((acc, val, i) => acc + (val * normY[i]), 0);

  const numerator = (n * sumXY) - (sumX * sumY);
  const denomInside = (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY);
  if (denomInside <= 0) return 0;
  const denominator = Math.sqrt(denomInside);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

const getInterpretation = (r) => {
  if (r === null || r === undefined) return '분석 불가';
  const abs = Math.abs(r);
  if (abs >= 0.7) return '강한 상관관계';
  if (abs >= 0.3) return '뚜렷한 상관관계';
  return '약한 상관관계';
};

export default function AdvancedAnalytics({ processedData, globalStats, settings }) {
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [activeDivision, setActiveDivision] = useState('all');
  const [motoLogic, setMotoLogic] = useState('new');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  const [isCumulative, setIsCumulative] = useState(false);
  const [isGoogleSheetSyncEnabled, setIsGoogleSheetSyncEnabled] = useState(true);
  const [weatherDataType, setWeatherDataType] = useState('room');
  const [currentWeather, setCurrentWeather] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const { googleSheetData } = useGoogleSheetVisitors();

  // 실시간 날씨 데이터 로드
  useEffect(() => {
    let active = true;
    const loadCurrentWeather = async () => {
      setIsLoadingWeather(true);
      const data = await fetchCurrentWeather();
      if (active && data) {
        setCurrentWeather(data);
      }
      if (active) setIsLoadingWeather(false);
    };
    loadCurrentWeather();
    const interval = setInterval(loadCurrentWeather, 5 * 60 * 1000); // 5분 주기 갱신
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // fallback for legacy cached state like '05'
  useEffect(() => {
    if (selectedMonthFilter !== 'all' && !selectedMonthFilter.includes('-')) {
      setSelectedMonthFilter('all');
    }
  }, [selectedMonthFilter]);

  // Google Visitors data replaced by visitorCalcData logic
  const divisionConfig = useMemo(() => {
    const config = {
      all: { title: '전체통합', dataKey: 'totalSales', color: 'var(--accent-emerald)' }
    };
    
    const groupLabels = {
        leisure: '레저본부',
        fnb: '식음 부문',
        moto: '모토아레나',
        golf: '골프 부문',
        other: '기타 부문'
    };
    const predefinedColors = {
        leisure: 'var(--accent-purple)',
        fnb: 'var(--accent-blue)',
        moto: 'var(--accent-gold)',
        golf: '#22c55e',
        other: '#64748b'
    };
    const colors = ['#f43f5e', '#f97316', '#ef4444', '#14b8a6', '#06b6d4', '#6366f1', '#d946ef'];
    
    const groups = new Set(Object.values(settings?.locationGroups || {}));
    // legacy groups
    groups.add('leisure');
    groups.add('fnb');
    groups.add('moto');
    
    // remove 'exclude' group from creating a tab
    groups.delete('exclude');
    
    const orderMap = {
      fnb: 1,
      leisure: 2,
      moto: 3,
      golf: 4,
      other: 5
    };
    
    const sortedGroups = Array.from(groups).sort((a, b) => {
      const orderA = orderMap[a] || 99;
      const orderB = orderMap[b] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });

    let colorIdx = 0;
    sortedGroups.forEach(group => {
      config[group] = {
        title: groupLabels[group] || `${group.toUpperCase()} 부문`,
        dataKey: group + 'Sales',
        color: predefinedColors[group] || colors[colorIdx++ % colors.length]
      };
    });
    
    return config;
  }, [settings?.locationGroups]);
  const activeConf = divisionConfig[activeDivision] || divisionConfig['all'];

  // 데이터 가공

  // 동적 필터 옵션 생성
  const monthOptions = useMemo(() => {
    const options = [];
    const years = [...new Set(processedData.map(d => (d.yearMonth || '').split('-')[0]))].filter(y => y);
    years.sort((a,b) => b.localeCompare(a)); // 최신 연도부터
    
    years.forEach(year => {
      const yearMonths = processedData.filter(d => (d.yearMonth || '').startsWith(year));
      if (yearMonths.length > 0) {
        options.push({ value: `${year}-all`, label: `${year}년 종합 분석` });
        for (let m = 1; m <= 12; m++) {
          const mm = String(m).padStart(2, '0');
          if (yearMonths.some(d => (d.yearMonth || '').split('-')[1] === mm)) {
            options.push({ value: `${year}-${mm}`, label: `${year}년 ${m}월` });
          }
        }
      }
    });
    return options;
  }, [processedData]);

  const filteredProcessedData = useMemo(() => {
    if (selectedMonthFilter === 'all') return processedData;
    const [selYear, selMonth] = selectedMonthFilter.split('-');
    
    return processedData.filter(d => {
      const [y, m] = (d.yearMonth || '').split('-');
      if (y !== selYear) return false;
      if (selMonth === 'all') return true;
      if (isCumulative) {
        return parseInt(m) <= parseInt(selMonth);
      } else {
        return parseInt(m) === parseInt(selMonth);
      }
    });
  }, [processedData, selectedMonthFilter, isCumulative]);


  const { displayVisitors, hasMissingVisitorData, visitorValidMonths } = useMemo(() => {
    if (!filteredProcessedData || filteredProcessedData.length === 0) {
      return { displayVisitors: 0, hasMissingVisitorData: true, visitorValidMonths: [] };
    }
    
    const carPeopleWeight = settings?.carPeopleWeight !== undefined ? Number(settings.carPeopleWeight) : 3.0;
    const validMonths = [];
    let hasMissing = false;
    
    const count = filteredProcessedData.reduce((sum, d) => {
      let isGoogleSheetValid = false;
      let isDbValid = false;
      let val = 0;
      
      // 1. 구글 시트 연동 켜져있고, 해당 데이터가 2026년도일 때만 구글 시트 데이터 사용
      if (isGoogleSheetSyncEnabled && googleSheetData && googleSheetData.visitors && (d.yearMonth || '').startsWith('2026')) {
         const m = parseInt(d.yearMonth.split('-')[1], 10);
         if (googleSheetData.visitors[m] !== undefined && googleSheetData.visitors[m] !== null && googleSheetData.visitors[m] > 0) {
            isGoogleSheetValid = true;
            val = googleSheetData.visitors[m];
         }
      }
      
      // 2. 그 외 또는 구글 시트에 데이터가 없는 경우 DB 기반 Calculation 사용
      if (!isGoogleSheetValid && d.visitorCalcData) {
        const numTotalVehicles = Number(d.visitorCalcData.totalVehicles);
        if (!isNaN(numTotalVehicles) && numTotalVehicles > 0) {
          isDbValid = true;
          const numEmployeeVehicles = Number(d.visitorCalcData.employeeVehicles) || 0;
          const numGolfGuests = Number(d.visitorCalcData.golfGuests) || 0;
          const netVehicles = Math.max(0, numTotalVehicles - numEmployeeVehicles);
          const estimatedPeople = netVehicles * carPeopleWeight;
          val = Math.max(0, estimatedPeople - numGolfGuests);
        }
      }
      
      if (isGoogleSheetValid || isDbValid) {
        validMonths.push({
          yearMonth: d.yearMonth,
          visitors: val,
          subsidiaryRev: d.totalSales || 0,
          fnbSales: d.fnbSales || 0,
          salesByLocation: d.salesByLocation || d.leisureSalesByLocation || {}
        });
        return sum + val;
      } else {
        hasMissing = true;
        return sum;
      }
    }, 0);
    
    const isSpecificMonthSelected = selectedMonthFilter !== 'all' && !selectedMonthFilter.endsWith('-all');
    const finalMissing = isSpecificMonthSelected ? hasMissing : (validMonths.length === 0);
    
    return { displayVisitors: count, hasMissingVisitorData: finalMissing, visitorValidMonths: validMonths };
  }, [filteredProcessedData, isGoogleSheetSyncEnabled, googleSheetData, settings, selectedMonthFilter]);

  const dateRangeStr = useMemo(() => {
    if (!visitorValidMonths || visitorValidMonths.length === 0) return '';
    const sorted = [...visitorValidMonths].sort((a, b) => (a.yearMonth || '').localeCompare(b.yearMonth || ''));
    if (sorted.length === 1) return `(${sorted[0].yearMonth})`;
    return `(${sorted[0].yearMonth} ~ ${sorted[sorted.length - 1].yearMonth})`;
  }, [visitorValidMonths]);

  const visitorKpiData = useMemo(() => {
    if (!visitorValidMonths || visitorValidMonths.length === 0) return null;
    
    let totalSubsidiaryRev = 0;
    let totalFnbAndPitstopRev = 0;
    
    visitorValidMonths.forEach(d => {
      totalSubsidiaryRev += d.subsidiaryRev;
      
      let pitstopRev = 0;
      Object.entries(d.salesByLocation).forEach(([loc, amt]) => {
        if (loc.includes('핏스탑')) pitstopRev += (Number(amt) || 0);
      });
      
      totalFnbAndPitstopRev += d.fnbSales + pitstopRev;
    });
    
    return {
      totalSubsidiaryRev,
      totalFnbAndPitstopRev
    };
  }, [visitorValidMonths]);

  const totalHotelGuests = useMemo(() => {
    if (!filteredProcessedData || filteredProcessedData.length === 0) return 0;
    
    const weight16 = settings?.guestWeight16 !== undefined ? Number(settings.guestWeight16) : 2.5;
    const weight35 = settings?.guestWeight35 !== undefined ? Number(settings.guestWeight35) : 3.5;
    const weight51 = settings?.guestWeight51 !== undefined ? Number(settings.guestWeight51) : 6.0;
    
    return filteredProcessedData.reduce((sum, d) => {
      if (d.guests !== undefined) return sum + d.guests;
      
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51Combined = Number(d.sold51 || d.connectingSold || 0) + Number(d.sold51Acc || 0);
      return sum + (sold16 * weight16) + (sold35 * weight35) + (sold51Combined * weight51);
    }, 0);
  }, [filteredProcessedData, settings]);

  const seminarGuests = useMemo(() => {
    if (!filteredProcessedData || filteredProcessedData.length === 0) return 0;
    
    const weight16 = settings?.guestWeight16 !== undefined ? Number(settings.guestWeight16) : 2.5;
    const weight35 = settings?.guestWeight35 !== undefined ? Number(settings.guestWeight35) : 3.5;
    const weight51 = settings?.guestWeight51 !== undefined ? Number(settings.guestWeight51) : 6.0;
    
    let seminar = 0;
    filteredProcessedData.forEach(d => {
      if (d.rawRoomRecords && Array.isArray(d.rawRoomRecords)) {
        d.rawRoomRecords.forEach(record => {
          const mType = String(record.marketType || '');
          if (mType.includes('단체영업') || mType.includes('세미나')) {
            const count = Number(record.count || 0);
            const rType = String(record.roomType || '');
            if (rType.includes('16평')) seminar += count * weight16;
            else if (rType.includes('35평')) seminar += count * weight35;
            else if (rType.includes('51평')) seminar += count * weight51;
          }
        });
      }
    });
    return seminar;
  }, [filteredProcessedData, settings]);


  // 선택된 부문의 전체 상관계수 계산
  const activeGlobalCorrelation = useMemo(() => {
    const occArr = filteredProcessedData.map(d => d.occupancyRate);
    const targetArr = filteredProcessedData.map(d => d[activeConf.dataKey]);
    return calculateCorrelation(occArr, targetArr);
  }, [filteredProcessedData, activeConf.dataKey]);

  const isWeatherMerged = useMemo(() => {
    return filteredProcessedData.some(m => 
      m.rawRoomRecords && 
      Array.isArray(m.rawRoomRecords) && 
      m.rawRoomRecords.some(rec => rec.weatherTempMax !== undefined && rec.weatherTempMax !== null)
    );
  }, [filteredProcessedData]);

  // 통합 일별 데이터 (날씨 + 객실 + 레저 + 골프 등)
  const dailyWeatherSalesData = useMemo(() => {
    const dateMap = {};
    const weatherLookup = {};

    filteredProcessedData.forEach(m => {
      if (m.rawRoomRecords && Array.isArray(m.rawRoomRecords)) {
        m.rawRoomRecords.forEach(rec => {
          if (!rec.date) return;
          if (rec.weatherTempMax !== undefined && rec.weatherTempMax !== null) {
            weatherLookup[rec.date] = {
              tempMax: parseSafeNumber(rec.weatherTempMax),
              tempMin: parseSafeNumber(rec.weatherTempMin),
              precipitation: parseSafeNumber(rec.weatherPrecipitation),
              daytimePrecip: rec.weatherDaytimePrecip !== undefined && rec.weatherDaytimePrecip !== null ? parseSafeNumber(rec.weatherDaytimePrecip) : null,
              nighttimePrecip: rec.weatherNighttimePrecip !== undefined && rec.weatherNighttimePrecip !== null ? parseSafeNumber(rec.weatherNighttimePrecip) : null,
              windSpeed: rec.weatherWindSpeed !== undefined && rec.weatherWindSpeed !== null ? parseSafeNumber(rec.weatherWindSpeed) : null,
              code: parseSafeNumber(rec.weatherCode),
              desc: rec.weatherDesc || '정보없음'
            };
          }
        });
      }
    });

    const locationGroups = settings?.locationGroups || {};

    // 1. 객실 매출 처리
    filteredProcessedData.forEach(m => {
      if (m.rawRoomRecords && Array.isArray(m.rawRoomRecords)) {
        m.rawRoomRecords.forEach(rec => {
          if (!rec.date) return;
          const dateStr = rec.date;
          if (!dateMap[dateStr]) {
            const w = weatherLookup[dateStr] || {};
            dateMap[dateStr] = {
              date: dateStr,
              roomRevenue: 0,
              roomsSold: 0,
              leisureRevenue: 0,
              golfRevenue: 0,
              totalRevenue: 0,
              tempMax: w.tempMax !== undefined && w.tempMax !== null ? parseSafeNumber(w.tempMax) : null,
              tempMin: w.tempMin !== undefined && w.tempMin !== null ? parseSafeNumber(w.tempMin) : null,
              precipitation: w.precipitation !== undefined && w.precipitation !== null ? parseSafeNumber(w.precipitation) : null,
              daytimePrecip: w.daytimePrecip !== undefined && w.daytimePrecip !== null ? parseSafeNumber(w.daytimePrecip) : null,
              nighttimePrecip: w.nighttimePrecip !== undefined && w.nighttimePrecip !== null ? parseSafeNumber(w.nighttimePrecip) : null,
              windSpeed: w.windSpeed !== undefined && w.windSpeed !== null ? parseSafeNumber(w.windSpeed) : null,
              code: w.code !== undefined && w.code !== null ? parseSafeNumber(w.code) : null,
              desc: w.desc || '정보없음'
            };
          }
          const revenue = parseSafeNumber(rec.revenue);
          const count = parseSafeNumber(rec.count);
          dateMap[dateStr].roomRevenue += revenue;
          dateMap[dateStr].roomsSold += count;
          dateMap[dateStr].totalRevenue += revenue;
        });
      }
    });

    // 2. 부대업장(레저/골프/식음 등) 매출 처리
    filteredProcessedData.forEach(m => {
      if (m.rawLeisureRecords && Array.isArray(m.rawLeisureRecords)) {
        m.rawLeisureRecords.forEach(rec => {
          if (!rec.date) return;
          const dateStr = rec.date;
          
          if (!dateMap[dateStr]) {
            const w = weatherLookup[dateStr] || {};
            dateMap[dateStr] = {
              date: dateStr,
              roomRevenue: 0,
              roomsSold: 0,
              leisureRevenue: 0,
              golfRevenue: 0,
              totalRevenue: 0,
              tempMax: w.tempMax !== undefined && w.tempMax !== null ? parseSafeNumber(w.tempMax) : null,
              tempMin: w.tempMin !== undefined && w.tempMin !== null ? parseSafeNumber(w.tempMin) : null,
              precipitation: w.precipitation !== undefined && w.precipitation !== null ? parseSafeNumber(w.precipitation) : null,
              daytimePrecip: w.daytimePrecip !== undefined && w.daytimePrecip !== null ? parseSafeNumber(w.daytimePrecip) : null,
              nighttimePrecip: w.nighttimePrecip !== undefined && w.nighttimePrecip !== null ? parseSafeNumber(w.nighttimePrecip) : null,
              windSpeed: w.windSpeed !== undefined && w.windSpeed !== null ? parseSafeNumber(w.windSpeed) : null,
              code: w.code !== undefined && w.code !== null ? parseSafeNumber(w.code) : null,
              desc: w.desc || '정보없음'
            };
          }
          
          if (rec.breakdown) {
            Object.entries(rec.breakdown).forEach(([locName, amt]) => {
              const val = parseSafeNumber(amt);
              const group = locationGroups[locName] || 'leisure';
              
              if (group === 'leisure') {
                dateMap[dateStr].leisureRevenue += val;
              } else if (group === 'golf') {
                dateMap[dateStr].golfRevenue += val;
              }
              // 전체 통합 매출에 합산
              dateMap[dateStr].totalRevenue += val;
            });
          } else {
            const val = parseSafeNumber(rec.revenue);
            dateMap[dateStr].leisureRevenue += val;
            dateMap[dateStr].totalRevenue += val;
          }
        });
      }
    });

    // 기존 차트/카드 호환성용 revenue 바인딩
    return Object.values(dateMap).map(d => {
      let revenue = 0;
      if (weatherDataType === 'room') revenue = d.roomRevenue;
      else if (weatherDataType === 'golf') revenue = d.golfRevenue;
      else if (weatherDataType === 'leisure') revenue = d.leisureRevenue;
      else revenue = d.totalRevenue;
      return {
        ...d,
        revenue
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredProcessedData, weatherDataType, settings?.locationGroups]);

  const weatherStats = useMemo(() => {
    const rawValidData = dailyWeatherSalesData.filter(d => d.tempMax !== null && d.desc !== '정보없음').map(d => {
      // 골프/레저의 경우 주간 강수량(daytimePrecip)을 우선 사용
      const useDaytime = (weatherDataType === 'golf' || weatherDataType === 'leisure');
      const effPrecip = (useDaytime && d.daytimePrecip !== null) ? d.daytimePrecip : d.precipitation;
      return { ...d, precipitation: effPrecip };
    });
    if (rawValidData.length === 0) return null;
    
    // IQR (사분위수) 기반 아웃라이어 필터링 함수
    const filterOutliers = (dataList, key = 'revenue') => {
      if (dataList.length < 4) return dataList; // 데이터가 너무 적으면 필터링 생략
      const values = dataList.map(d => d[key]).sort((a, b) => a - b);
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      return dataList.filter(d => d[key] >= lowerBound && d[key] <= upperBound);
    };

    // 1. 주말 및 평일 데이터 임시 분리
    const isRoomWeekend = (dateObj) => {
      const day = dateObj.getDay();
      const nextDay = new Date(dateObj);
      nextDay.setDate(dateObj.getDate() + 1);
      return day === 5 || day === 6 || isHoliday(nextDay);
    };

    const isNormalWeekend = (dateObj) => {
      const day = dateObj.getDay();
      return day === 0 || day === 6 || isHoliday(dateObj);
    };

    const isWeekendByConfig = (dateStr) => {
      const [yyyy, mm, dd] = dateStr.split('-');
      const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (weatherDataType === 'room') {
        return isRoomWeekend(dateObj);
      }
      return isNormalWeekend(dateObj);
    };

    const rawWeekendList = rawValidData.filter(d => isWeekendByConfig(d.date));
    const rawWeekdayList = rawValidData.filter(d => !isWeekendByConfig(d.date));

    const getSeason = (dateStr) => {
      const [yyyy, mm, dd] = dateStr.split('-');
      const month = parseInt(mm, 10);
      if (month >= 3 && month <= 5) return '봄 (3~5월)';
      if (month >= 6 && month <= 8) return '여름 (6~8월)';
      if (month >= 9 && month <= 11) return '가을 (9~11월)';
      return '겨울 (12~2월)';
    };

    const seasonsList = ['봄 (3~5월)', '여름 (6~8월)', '가을 (9~11월)', '겨울 (12~2월)'];

    // 2. 계절별로 분리한 후 독립적으로 평일/주말 아웃라이어 필터링 (성수기 맑은날 삭제 방지)
    let cleanWeekdayListGlobal = [];
    let cleanWeekendListGlobal = [];

    seasonsList.forEach(seasonLabel => {
      const seasonWeekdays = rawWeekdayList.filter(d => getSeason(d.date) === seasonLabel);
      const seasonWeekends = rawWeekendList.filter(d => getSeason(d.date) === seasonLabel);
      cleanWeekdayListGlobal = [...cleanWeekdayListGlobal, ...filterOutliers(seasonWeekdays, 'revenue')];
      cleanWeekendListGlobal = [...cleanWeekendListGlobal, ...filterOutliers(seasonWeekends, 'revenue')];
    });

    // 3. 날씨 분석(상관계수, 일평균 카드)에 쓰일 글로벌 정제 데이터셋 구성
    const cleanValidData = [...cleanWeekdayListGlobal, ...cleanWeekendListGlobal];

    const revenues = cleanValidData.map(d => d.revenue);
    const temps = cleanValidData.map(d => d.tempMax);
    const precipitations = cleanValidData.map(d => d.precipitation);
    
    const tempCorr = calculateCorrelation(temps, revenues);
    const precipCorr = calculateCorrelation(precipitations, revenues);
    
    const descGroup = {};
    cleanValidData.forEach(d => {
      const desc = d.desc || '기타';
      if (!descGroup[desc]) {
        descGroup[desc] = {
          desc,
          totalRevenue: 0,
          totalRoomsSold: 0,
          daysCount: 0
        };
      }
      descGroup[desc].totalRevenue += d.revenue;
      descGroup[desc].totalRoomsSold += d.roomsSold;
      descGroup[desc].daysCount += 1;
    });
    
    const descList = Object.values(descGroup).map(g => ({
      desc: g.desc,
      avgRevenue: g.daysCount > 0 ? g.totalRevenue / g.daysCount : 0,
      avgRoomsSold: g.daysCount > 0 ? g.totalRoomsSold / g.daysCount : 0,
      daysCount: g.daysCount
    })).sort((a, b) => b.avgRevenue - a.avgRevenue);
    
    const weekendValidData = cleanWeekendListGlobal;

    const RAIN_THRESHOLD = 3.0; // 3.0mm 이상을 실질적인 우천일로 정의 (미량 강수로 인한 통계 희석 방지)

    let weekendPrecipCorr = null;
    let weekendRainyStats = null;

    if (weekendValidData.length >= 2) {
      const wkRevenues = weekendValidData.map(d => d.revenue);
      const wkPrecips = weekendValidData.map(d => d.precipitation);
      weekendPrecipCorr = calculateCorrelation(wkPrecips, wkRevenues);

      const rainyWeekend = weekendValidData.filter(d => parseSafeNumber(d.precipitation) >= RAIN_THRESHOLD);
      const clearWeekend = weekendValidData.filter(d => parseSafeNumber(d.precipitation) < RAIN_THRESHOLD);

      weekendRainyStats = {
        totalDays: weekendValidData.length,
        rainyDaysCount: rainyWeekend.length,
        clearDaysCount: clearWeekend.length,
        avgRainyRevenue: safeAverage(rainyWeekend.map(d => d.revenue), false),
        avgClearRevenue: safeAverage(clearWeekend.map(d => d.revenue), false),
      };
    }

    const getRainStats = (dataList, key = 'revenue') => {
      const rainy = dataList.filter(d => parseSafeNumber(d.precipitation) >= RAIN_THRESHOLD);
      const clear = dataList.filter(d => parseSafeNumber(d.precipitation) < RAIN_THRESHOLD);
      return {
        clearDays: clear.length,
        clearAvgRev: safeAverage(clear.map(d => d[key]), false),
        clearAvgRooms: safeAverage(clear.map(d => d.roomsSold), false),
        rainyDays: rainy.length,
        rainyAvgRev: safeAverage(rainy.map(d => d[key]), false),
        rainyAvgRooms: safeAverage(rainy.map(d => d.roomsSold), false),
      };
    };

    const overallRainStats = getRainStats(cleanValidData);
    const weekdayValidData = cleanWeekdayListGlobal;
    const weekdayRainStats = getRainStats(weekdayValidData);
    const weekendRainStats = getRainStats(weekendValidData);

    const sectors = [
      { key: 'totalRevenue', name: '전체 통합 매출' },
      { key: 'roomRevenue', name: '객실 매출' },
      { key: 'leisureRevenue', name: '레저본부 매출' },
      { key: 'golfRevenue', name: '골프 매출' }
    ];

    const sectorRainStats = {};
    sectors.forEach(sec => {
      const key = sec.key;
      let normalizedYearData = [];
      const seasonStatsMap = {};

      seasonsList.forEach(seasonLabel => {
        const seasonWeekdays = rawWeekdayList.filter(d => getSeason(d.date) === seasonLabel);
        const seasonWeekends = rawWeekendList.filter(d => getSeason(d.date) === seasonLabel);

        // 계절/부문별 독립 IQR 적용
        const cleanWeekday = filterOutliers(seasonWeekdays, key);
        const cleanWeekend = filterOutliers(seasonWeekends, key);

        // 주말 정규화 (평일화) 프리미엄 비율 계산
        const wkdayAvg = safeAverage(cleanWeekday.filter(d => parseSafeNumber(d.precipitation) < RAIN_THRESHOLD).map(d => d[key]), false);
        const wkndAvg = safeAverage(cleanWeekend.filter(d => parseSafeNumber(d.precipitation) < RAIN_THRESHOLD).map(d => d[key]), false);

        let weekendRatio = 1;
        if (wkdayAvg > 0 && wkndAvg > 0) {
          weekendRatio = wkndAvg / wkdayAvg;
        }

        // 주말 매출을 비율로 나누어 평일화
        const normalizedWeekday = cleanWeekday.map(d => ({ ...d, _normRev: parseSafeNumber(d[key]) }));
        const normalizedWeekend = cleanWeekend.map(d => ({ ...d, _normRev: parseSafeNumber(d[key]) / weekendRatio }));

        const cleanSeasonOverall = [...normalizedWeekday, ...normalizedWeekend];
        normalizedYearData = [...normalizedYearData, ...cleanSeasonOverall];

        seasonStatsMap[seasonLabel] = getRainStats(cleanSeasonOverall, '_normRev');
      });

      sectorRainStats[key] = {
        name: sec.name,
        overall: getRainStats(normalizedYearData, '_normRev'),
        weekday: getRainStats(normalizedYearData.filter(d => !isWeekendByConfig(d.date)), '_normRev'),
        weekend: getRainStats(normalizedYearData.filter(d => isWeekendByConfig(d.date)), '_normRev'),
        seasons: [
          { label: '봄 (3~5월)', stats: seasonStatsMap['봄 (3~5월)'] },
          { label: '여름 (6~8월)', stats: seasonStatsMap['여름 (6~8월)'] },
          { label: '가을 (9~11월)', stats: seasonStatsMap['가을 (9~11월)'] },
          { label: '겨울 (12~2월)', stats: seasonStatsMap['겨울 (12~2월)'] }
        ]
      };
    });

    return {
      tempCorr,
      precipCorr,
      descList,
      totalValidDays: cleanValidData.length,
      weekendPrecipCorr,
      weekendRainyStats,
      overallRainStats,
      weekdayRainStats,
      weekendRainStats,
      sectorRainStats
    };
  }, [dailyWeatherSalesData]);

  const weatherYearComparisonData = useMemo(() => {
    const dateWeather = {};
    processedData.forEach(m => {
      if (m.rawRoomRecords && Array.isArray(m.rawRoomRecords)) {
        m.rawRoomRecords.forEach(rec => {
          if (!rec.date) return;
          if (rec.weatherTempMax !== undefined && rec.weatherTempMax !== null) {
            dateWeather[rec.date] = {
              tempMax: Number(rec.weatherTempMax),
              tempMin: Number(rec.weatherTempMin),
              precipitation: rec.weatherPrecipitation !== undefined && rec.weatherPrecipitation !== null ? Number(rec.weatherPrecipitation) : 0,
            };
          }
        });
      }
    });

    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const comparison = months.map(mm => {
      const data2025 = { avgTemp: null, rainyDays: 0, totalRevenue: 0, hasData: false };
      const data2026 = { avgTemp: null, rainyDays: 0, totalRevenue: 0, hasData: false };

      const record2025 = processedData.find(d => d.yearMonth === `2025-${mm}`);
      const record2026 = processedData.find(d => d.yearMonth === `2026-${mm}`);

      const processYearData = (record, targetData, yearStr) => {
        if (!record) return;
        targetData.totalRevenue = (record.totalRoomRevenue || 0) + (record.totalSales || 0);
        targetData.hasData = true;

        const datesInMonth = Object.keys(dateWeather).filter(d => d.startsWith(`${yearStr}-${mm}`));
        if (datesInMonth.length > 0) {
          let tempSum = 0;
          let tempCount = 0;
          let rainDays = 0;
          datesInMonth.forEach(dateStr => {
            const w = dateWeather[dateStr];
            if (w.tempMax !== null && w.tempMin !== null && !isNaN(w.tempMax) && !isNaN(w.tempMin)) {
              tempSum += (w.tempMax + w.tempMin) / 2;
              tempCount++;
            }
            if (w.precipitation > 0) {
              rainDays++;
            }
          });
          targetData.avgTemp = tempCount > 0 ? tempSum / tempCount : null;
          targetData.rainyDays = rainDays;
        }
      };

      processYearData(record2025, data2025, '2025');
      processYearData(record2026, data2026, '2026');

      return {
        month: `${parseInt(mm)}월`,
        monthVal: mm,
        2025: data2025,
        2026: data2026
      };
    }).filter(item => item['2025'].hasData || item['2026'].hasData);

    return comparison;
  }, [processedData]);

  const weatherInsights = useMemo(() => {
    const insights = [];
    weatherYearComparisonData.forEach(item => {
      const d25 = item['2025'];
      const d26 = item['2026'];
      if (d25.hasData && d26.hasData) {
        const revDiff = d26.totalRevenue - d25.totalRevenue;
        const revDiffPct = d25.totalRevenue > 0 ? (revDiff / d25.totalRevenue) * 100 : 0;
        const rainDiff = d26.rainyDays - d25.rainyDays;
        
        let weatherCompare = '';
        if (rainDiff < 0) {
          weatherCompare = `비 온 날이 ${Math.abs(rainDiff)}일 줄어 더 맑고 좋은 날씨를 보였습니다.`;
        } else if (rainDiff > 0) {
          weatherCompare = `비 온 날이 ${rainDiff}일 늘어나 더 궂은 날씨였습니다.`;
        } else {
          weatherCompare = `비 온 날이 ${d25.rainyDays}일로 동일했습니다.`;
        }

        const tempDiff = d26.avgTemp !== null && d25.avgTemp !== null ? d26.avgTemp - d25.avgTemp : 0;
        const tempCompare = tempDiff > 0 ? `평균 기온은 ${tempDiff.toFixed(1)}°C 상승했습니다.` : `평균 기온은 ${Math.abs(tempDiff).toFixed(1)}°C 하락했습니다.`;

        const revStatus = revDiff > 0 
          ? `매출은 ₩${formatCurrency(revDiff)} (${revDiffPct.toFixed(1)}% ▲) 증가했습니다.`
          : `매출은 ₩${formatCurrency(Math.abs(revDiff))} (${Math.abs(revDiffPct).toFixed(1)}% ▼) 감소했습니다.`;

        let impactInterpretation = '';
        if (rainDiff < 0 && revDiff > 0) {
          impactInterpretation = `맑은 날씨가 야외 레저 및 골프, 리조트 방문을 활성화시켜 매출 성장에 긍정적인 영향을 준 것으로 보입니다.`;
        } else if (rainDiff > 0 && revDiff < 0) {
          impactInterpretation = `비 온 날의 증가와 궂은 기상이 야외 레저 활동 및 콘도 예약을 제한하여 매출에 부정적인 영향을 준 것으로 분석됩니다.`;
        } else if (rainDiff < 0 && revDiff < 0) {
          impactInterpretation = `강수일수 감소 등 기상 여건은 우호적이었으나 매출이 감소하여, 날씨 외의 외부 요인(경기, 주말 분포 등)이 주된 작용을 한 것으로 보입니다.`;
        } else {
          impactInterpretation = `기상 변동폭 대비 매출이 안정적으로 유지되거나 타 요인들과 복합적으로 작용하여 상쇄된 것으로 판단됩니다.`;
        }

        insights.push({
          month: item.month,
          text: `📅 **${item.month} 분석:** 25년 대비 26년 ${weatherCompare} ${tempCompare} 이 기간 동안 ${revStatus} ${impactInterpretation}`
        });
      }
    });
    return insights;
  }, [weatherYearComparisonData]);

  const motoCorrelations = useMemo(() => {
    if (activeDivision !== 'moto' || motoLogic !== 'new') return null;
    const filtered = filteredProcessedData.filter(d => d.motoGuestRev !== undefined);
    if (filtered.length === 0) return { guestAvailable: false };
    
    const occArr = filtered.map(d => d.occupancyRate || 0);
    
    let sumGuest = 0;
    let sumGeneral = 0;
    let sumOther = 0;
    let sumTotal = 0;
    
    const guestArr = [];
    const generalArr = [];
    const totalArr = [];
    const aggregatedOther = {};
    
    filtered.forEach(d => {
      let gRev = 0;
      let genRev = 0;
      let othRev = 0;
      
      // 항상 비율이 곱해져 보정된 motoGuestRev, motoGeneralRev를 사용함.
      gRev = d.motoGuestRev || 0;
      genRev = d.motoGeneralRev || 0;
      
      const excel2Total = Number(d.motoTotalRev || 0);
      const otherRatio = excel2Total > 0 ? (Number(d.motoInternalRev || 0) + Number(d.motoOtherRev || 0)) / excel2Total : 0;
      othRev = Math.round((d.motoSales || 0) * otherRatio);

      
      const totRev = gRev + genRev + othRev;
      
      guestArr.push(gRev);
      generalArr.push(genRev);
      totalArr.push(totRev);
      
      sumGuest += gRev;
      sumGeneral += genRev;
      sumOther += othRev;
      sumTotal += totRev;
    });

    const guestRatio = sumTotal > 0 ? (sumGuest / sumTotal) * 100 : 0;
    const generalRatio = sumTotal > 0 ? (sumGeneral / sumTotal) * 100 : 0;
    const otherRatio = sumTotal > 0 ? (sumOther / sumTotal) * 100 : 0;

    return {
      guest: calculateCorrelation(occArr, guestArr),
      guestRatio: guestRatio,
      generalRatio: generalRatio,
      otherRatio: otherRatio,
      aggregatedOther: aggregatedOther,
      total: calculateCorrelation(occArr, totalArr),
      guestAvailable: true
    };
  }, [filteredProcessedData, activeDivision, motoLogic]);

  // 선택된 부문의 평형별 상관계수 계산
  const activeRoomTypeCorrelations = useMemo(() => {
    const targetArr = filteredProcessedData.map(d => d[activeConf.dataKey]);
    return {
      '16평': calculateCorrelation(filteredProcessedData.map(d => d.sold16), targetArr),
      '35평': calculateCorrelation(filteredProcessedData.map(d => d.sold35), targetArr),
      '51평': calculateCorrelation(filteredProcessedData.map(d => d.sold51 + (d.sold51Acc || 0)), targetArr)
    };
  }, [filteredProcessedData, activeConf.dataKey]);

  // 영업장별 상관계수 계산 (객실 점유율 기준)
  const locationCorrelations = useMemo(() => {
    const occArr = filteredProcessedData.map(d => d.occupancyRate);
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

    filteredProcessedData.forEach((d, i) => {
      const salesObj = d.salesByLocation || d.leisureSalesByLocation || {};
      Object.entries(salesObj).forEach(([loc, amt]) => {
        const group = locationGroups[loc] || 'leisure';
        if (activeDivision === 'all' || group === activeDivision) {
          const groupedName = mapLocationName(loc);
          if (!locMap[groupedName]) locMap[groupedName] = new Array(filteredProcessedData.length).fill(0);
          locMap[groupedName][i] += amt;
        }
      });
    });

    const results = [];
    Object.keys(locMap).forEach(loc => {
      const dataArr = locMap[loc];
      const totalAmt = dataArr.reduce((sum, val) => sum + val, 0);
      
      if (totalAmt < 1000000 * filteredProcessedData.length) return;

      const corr = calculateCorrelation(occArr, dataArr);
      if (corr !== null && !isNaN(corr)) {
        results.push({ name: loc, correlation: corr });
      }
    });

    return results.sort((a, b) => b.correlation - a.correlation);
  }, [filteredProcessedData, settings.locationGroups, activeDivision]);

  // TrevPAR / RevPAR 계산
  const kpiData = useMemo(() => {
    if (!filteredProcessedData || filteredProcessedData.length === 0) return null;
    
    // settings에서 캡처 레이트 가져오기 (없으면 기본값)
    const capLeisure = (settings.captureRateLeisure ?? 85) / 100;
    const capFnb = (settings.captureRateFnb ?? 75) / 100;
    const capMoto = (settings.captureRateMoto ?? 25) / 100;

    let totalAvailableRooms = 0;
    let totalRoomRev = 0;
    let totalGrossTrev = 0;
    let totalPureTrev = 0;
    let totalSubsidiaryRev = 0;
    let totalFnbAndPitstopRev = 0;

    filteredProcessedData.forEach(d => {
      const physicalRooms = Number(settings.totalRooms) || 175;
      const rooms51Sets = Number(settings.connectingRooms51) || 85;
      const count51AsTwo = settings.count51AsTwoRooms !== false;
      const dailyInv = count51AsTwo ? physicalRooms : (physicalRooms - rooms51Sets);
      
      const days = d.daysCount || 30; // fallback
      const monthlyInv = dailyInv * days;

      totalAvailableRooms += monthlyInv;
      totalRoomRev += (d.totalRoomRevenue || 0);

      const leisureGross = d.leisureSales || 0;
      const fnbGross = d.fnbSales || 0;
      const motoGross = d.motoSales || 0;
      const otherGross = d.otherSales || 0;

      let pitstopRev = 0;
      if (d.salesByLocation || d.leisureSalesByLocation) {
        const salesObj = d.salesByLocation || d.leisureSalesByLocation || {};
        Object.entries(salesObj).forEach(([loc, amt]) => {
          if (loc.includes('핏스탑')) pitstopRev += (Number(amt) || 0);
        });
      }

      // 모토아레나 및 사용자 정의(Dynamic) 그룹 매출을 KPI 산정에 포함
      const dynamicGrossSum = Math.max(0, (d.totalSales || 0) - (leisureGross + fnbGross + motoGross + otherGross));
      
      totalGrossTrev += (d.totalRoomRevenue || 0) + (d.totalSales || 0); // 기존 4대 매출 + 커스텀 그룹 자동 합산
      // 모토아레나는 캡쳐율 추정이 아닌 실제 투숙객 데이터(motoGuestRev)가 우선이나, 없을 경우 capMoto 적용
      totalPureTrev += (d.totalRoomRevenue || 0) + (leisureGross * capLeisure) + (fnbGross * capFnb) + (d.motoGuestRev || (motoGross * capMoto)) + otherGross + dynamicGrossSum;
      totalSubsidiaryRev += (d.totalSales || 0);
      totalFnbAndPitstopRev += fnbGross + pitstopRev;
    });

    if (totalAvailableRooms === 0) return null;

    return {
      revPar: Math.round(totalRoomRev / totalAvailableRooms),
      grossTrevPar: Math.round(totalGrossTrev / totalAvailableRooms),
      pureTrevPar: Math.round(totalPureTrev / totalAvailableRooms),
      capLeisure: capLeisure * 100,
      capFnb: capFnb * 100,
      capMoto: capMoto * 100,
      totalSubsidiaryRev: totalSubsidiaryRev,
      totalFnbAndPitstopRev: totalFnbAndPitstopRev
    };
  }, [filteredProcessedData, settings]);

  if (processedData.length < 2) {
    return (
      <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
        상관관계를 분석하려면 최소 2개월 이상의 데이터가 필요합니다. 엑셀을 더 업로드해 주세요.
      </div>
    );
  }

  const getTempInterpretation = (r) => {
    if (r === null || isNaN(r)) return { title: '분석 불가', desc: '데이터가 부족하여 해석할 수 없습니다.' };
    if (r >= 0.4) return { title: '더울수록 매출 증가 🔥', desc: '기온이 올라갈수록 매출도 뚜렷하게 증가하는 경향이 있습니다. (여름철 매출 호조)' };
    if (r >= 0.2) return { title: '따뜻할수록 약간 증가', desc: '기온 상승이 매출에 긍정적인 영향을 미치는 편입니다.' };
    if (r <= -0.4) return { title: '추울수록 매출 증가 ❄️', desc: '기온이 낮아질수록 오히려 매출이 뚜렷하게 증가합니다. (겨울철 매출 호조)' };
    if (r <= -0.2) return { title: '서늘할수록 약간 증가', desc: '기온이 떨어질 때 매출이 소폭 상승하는 경향이 있습니다.' };
    return { title: '기온과 큰 상관없음', desc: '날씨가 덥든 춥든 매출에 큰 영향을 주지 않습니다.' };
  };

  const getPrecipInterpretation = (r) => {
    if (r === null || isNaN(r)) return { title: '분석 불가', desc: '데이터가 부족하여 해석할 수 없습니다.' };
    if (r <= -0.4) return { title: '비 올 때 타격 극심 ☔', desc: '비가 많이 올수록 매출이 심각하게 감소합니다. 강력한 우천 대비책이 필요합니다.' };
    if (r <= -0.2) return { title: '비 올 때 타격 있음 ☂️', desc: '비가 오면 매출이 눈에 띄게 감소하는 경향이 있습니다.' };
    if (r >= 0.4) return { title: '비 올 때 오히려 증가 📈', desc: '비가 올 때 오히려 매출이 크게 증가하는 특수한 패턴을 보입니다.' };
    if (r >= 0.2) return { title: '비 올 때 소폭 증가', desc: '우천 시 방문객이 집중되거나 실내 시설 수요가 상승하는 경향이 있습니다.' };
    return { title: '비 와도 타격 없음 🛡️', desc: '비가 많이 오든 적게 오든 매출이 탄력적으로 잘 방어됩니다.' };
  };

  const weatherLabel = weatherDataType === 'room' ? '객실 매출' : weatherDataType === 'golf' ? '골프 매출' : '레저 매출';

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
      
      <div>
        <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '15px'}}>숙박객 유입이 부문별 매출에 미치는 영향 분석</p>
      </div>

      {/* 0. 부문 선택기 및 월별 필터 */}
      <div className="glass-panel mobile-wrap" style={{padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <h3 style={{margin: 0}}>분석 대상 부문 선택:</h3>
          <div className="mobile-wrap" style={{display: 'flex', gap: '12px'}}>
            {Object.entries(divisionConfig).map(([key, conf]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveDivision(key);
                  if (key === 'moto') setMotoLogic('new');
                }}
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

        <div style={{display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '8px', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>월별 필터:</span>
            <select 
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              style={{background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: 'none', padding: '6px 12px', borderRadius: '4px', outline: 'none', fontWeight: 'bold'}}
            >
              <option value="all" style={{color: 'black'}}>전체 연도 종합 분석</option>
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value} style={{color: 'black'}}>{opt.label}</option>
              ))}
            </select>
          </div>

          {selectedMonthFilter !== 'all' && !selectedMonthFilter.endsWith('-all') && (
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginLeft: '8px'}}>
              <input type="checkbox" checked={isCumulative} onChange={(e) => setIsCumulative(e.target.checked)} style={{display: 'none'}} />
              <div style={{position: 'relative', width: '40px', height: '20px', background: isCumulative ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.2)', borderRadius: '10px', transition: '0.3s'}}>
                <div style={{position: 'absolute', top: '2px', left: isCumulative ? '22px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: '0.3s'}} />
              </div>
              <span style={{fontSize: '13px', color: isCumulative ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>누적 데이터 보기 (1월부터 합산)</span>
            </label>
          )}
        </div>
      </div>

      {/* 🚀 최상단 핵심 지표 대형 배너 */}
      <div className="glass-panel" style={{display: 'flex', flexWrap: 'wrap', overflow: 'hidden', border: '1px solid var(--accent-gold)'}}>
        <div style={{flex: 1, minWidth: '300px', padding: '32px 40px', background: 'rgba(251, 191, 36, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'}}>
            <h2 style={{margin: 0, color: 'var(--accent-gold)', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '12px'}}>
              👥 총 방문객 <span style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px'}}>
                {isGoogleSheetSyncEnabled ? 'Google Sheet 연동' : 'Calculated'}
              </span>
            </h2>
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', padding: '4px 12px', borderRadius: '20px'}}>
              <input type="checkbox" checked={isGoogleSheetSyncEnabled} onChange={(e) => setIsGoogleSheetSyncEnabled(e.target.checked)} style={{display: 'none'}} />
              <span style={{fontSize: '12px', color: isGoogleSheetSyncEnabled ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>구글 시트 연동</span>
              <div style={{position: 'relative', width: '32px', height: '16px', background: isGoogleSheetSyncEnabled ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.2)', borderRadius: '8px', transition: '0.3s'}}>
                <div style={{position: 'absolute', top: '2px', left: isGoogleSheetSyncEnabled ? '18px' : '2px', width: '12px', height: '12px', background: 'white', borderRadius: '50%', transition: '0.3s'}} />
              </div>
            </label>
          </div>
          <div style={{fontSize: '48px', fontWeight: '900', color: 'var(--text-main)', textShadow: '0 0 20px rgba(251,191,36,0.5)'}}>
            {displayVisitors !== null ? <CountUp end={displayVisitors} duration={2} separator="," /> : '...'}
          </div>
          <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '14px'}}>
            {selectedMonthFilter === 'all' ? '전체 기간 리조트 통합 고객 수 (골프장 제외)' : (selectedMonthFilter.endsWith('-all') ? `${selectedMonthFilter.split('-')[0]}년 리조트 통합 고객 수` : `${selectedMonthFilter.split('-')[0]}년 ${isCumulative ? `1~${parseInt(selectedMonthFilter.split('-')[1])}월 누적` : `${parseInt(selectedMonthFilter.split('-')[1])}월`} 리조트 고객 수`)} {dateRangeStr}
          </p>
          <div style={{marginTop: 'auto', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.2)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px'}}>방문객 1인당 평균 소비액</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', opacity: 0.7}}>(골프 및 숙박비 제외 / 부대매출 합산)</div>
              </div>
              <div style={{fontSize: '20px', fontWeight: 'bold', color: hasMissingVisitorData ? 'var(--text-muted)' : 'var(--accent-gold)'}}>
                {hasMissingVisitorData ? <span style={{fontSize: '14px'}}>N/A (데이터 누락)</span> : (displayVisitors > 0 && visitorKpiData ? `₩${Math.round(visitorKpiData.totalSubsidiaryRev / displayVisitors).toLocaleString()}` : '₩0')}
              </div>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px'}}>1인당 식음비</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', opacity: 0.7}}>(식음 + 핏스탑 특별 합산 기준)</div>
              </div>
              <div style={{fontSize: '18px', fontWeight: 'bold', color: hasMissingVisitorData ? 'var(--text-muted)' : 'var(--accent-emerald)'}}>
                {hasMissingVisitorData ? <span style={{fontSize: '14px'}}>N/A (데이터 누락)</span> : (displayVisitors > 0 && visitorKpiData ? `₩${Math.round(visitorKpiData.totalFnbAndPitstopRev / displayVisitors).toLocaleString()}` : '₩0')}
              </div>
            </div>
          </div>
        </div>
        
        <div style={{width: '1px', background: 'var(--border-glass)'}} />

        <div style={{flex: 1, minWidth: '300px', padding: '32px 40px', background: 'rgba(52, 211, 153, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative'}}>
          <h2 style={{margin: 0, color: 'var(--accent-emerald)', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            🛏️ {isCumulative || selectedMonthFilter === 'all' || selectedMonthFilter.endsWith('-all') ? '누적 숙박객' : '월간 숙박객'} <span style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px'}}>DB 기반 연산</span>
          </h2>
          <div style={{fontSize: '48px', fontWeight: '900', color: 'var(--text-main)', textShadow: '0 0 20px rgba(52,211,153,0.5)'}}>
            <CountUp end={totalHotelGuests} duration={2} separator="," />
          </div>
          <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '14px'}}>
            (16평×2.5인) + (35평×4.5인) + (51평×6인) {isCumulative || selectedMonthFilter === 'all' || selectedMonthFilter.endsWith('-all') ? '누적' : '당월'} 합산 결과 {dateRangeStr}
          </p>

          <div style={{position: 'absolute', right: '40px', bottom: '32px', background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
            <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>이 중 단체/세미나 고객</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>
              <CountUp end={seminarGuests} duration={2} separator="," /> <span style={{fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal'}}>명</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Dashboard (TrevPAR & RevPAR) */}
      {kpiData && (
        <div className="glass-panel" style={{padding: '24px', display: 'flex', gap: '32px', flexWrap: 'wrap'}}>
          <div style={{flex: '1 1 300px', minWidth: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <h3 style={{margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--accent-gold)'}}>⚡</span> 경영 핵심 KPI (월평균)
            </h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5', wordBreak: 'keep-all'}}>
              방 1개를 팔았을 때 하루에 창출되는 평균 수익입니다. [설정]에 입력된 '투숙객 비중'을 바탕으로 워크인 매출을 제외한 <strong>순수 객실 연계 가치(Pure TrevPAR)</strong>를 분리하여 측정합니다.<br/>
              <span style={{color: 'var(--accent-gold)', fontSize: '12px'}}>* 모토아레나는 판매상품 구분으로 계산된 낮은 상관관계가 반영되었습니다.(골프관련매출제외)</span>
            </p>
          </div>
          
          <div style={{flex: '2 1 500px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'start'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '14px', color: 'var(--text-muted)', minHeight: '60px', wordBreak: 'keep-all', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'}}>
                <div>
                  RevPAR<br/>
                  <span style={{fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.2', display: 'inline-block', marginTop: '2px'}}>
                    Revenue Per Available Room<br/>
                    (객실 판매로만 거둔 객실당 수익)
                  </span>
                </div>
              </div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.5px'}}>
                ₩<CountUp end={kpiData.revPar} formattingFn={formatCurrency} duration={1} preserveValue />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '14px', color: 'var(--text-muted)', minHeight: '60px', wordBreak: 'keep-all', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'}}>
                <div>
                  <span style={{color: 'var(--accent-emerald)'}}>●</span> 순수 TrevPAR<br/>
                  <span style={{fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.2', display: 'inline-block', marginTop: '2px'}}>
                    Total Revenue Per Available Room<br/>
                    (투숙객이 지출한 객실당 총수익)
                  </span>
                </div>
              </div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)', letterSpacing: '-0.5px'}}>
                ₩<CountUp end={kpiData.pureTrevPar} formattingFn={formatCurrency} duration={1} preserveValue />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '14px', color: 'var(--text-muted)', minHeight: '60px', wordBreak: 'keep-all', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'}}>
                <div>
                  Gross TrevPAR<br/>
                  <span style={{fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.2', display: 'inline-block', marginTop: '2px'}}>
                    Gross Total Revenue Per Available Room<br/>
                    (비투숙객 포함 호텔 전체 객실당 총수익)
                  </span>
                </div>
              </div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.5px'}}>
                ₩<CountUp end={kpiData.grossTrevPar} formattingFn={formatCurrency} duration={1} preserveValue />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 회원 유형 정밀 분석 UI (ChannelAnalysis로 이동됨) */}

      {/* 모토아레나 전용 정밀 분석 토글 */}
      {activeDivision === 'moto' && (
        <div className="glass-panel" style={{padding: '16px 24px', borderLeft: '4px solid var(--accent-gold)'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'}}>
            <div>
              <h3 style={{margin: '0 0 8px 0', color: 'var(--accent-gold)'}}>🎯 모토아레나 정밀 분석 (티켓 기반)</h3>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0}}>
                기존 월별 총매출 추이와 엑셀 데이터 기반 고객유형 상세 분석을 함께 확인할 수 있습니다.
              </p>
            </div>
            <div style={{display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px'}}>
              <button 
                onClick={() => setMotoLogic('current')}
                style={{padding: '8px 16px', borderRadius: '6px', background: motoLogic === 'current' ? 'var(--accent-gold)' : 'transparent', color: motoLogic === 'current' ? '#000' : 'var(--text-main)', border: 'none', cursor: 'pointer', fontWeight: motoLogic === 'current' ? 'bold' : 'normal', transition: 'all 0.2s'}}
              >
                기존 추이 보기
              </button>
              <button 
                onClick={() => setMotoLogic('new')}
                style={{padding: '8px 16px', borderRadius: '6px', background: motoLogic === 'new' ? 'var(--accent-gold)' : 'transparent', color: motoLogic === 'new' ? '#000' : 'var(--text-main)', border: 'none', cursor: 'pointer', fontWeight: motoLogic === 'new' ? 'bold' : 'normal', transition: 'all 0.2s'}}
              >
                상세 매출 분석
              </button>
            </div>
          </div>

          {motoLogic === 'new' && motoCorrelations && (
            <div style={{marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
              {!motoCorrelations.guestAvailable ? (
                <div style={{padding: '24px', textAlign: 'center', color: 'var(--text-muted)'}}>
                  데이터 업로드 페이지에서 <strong>모토아레나 엑셀 파일</strong>을 업로드해 주세요.
                  <br/>추출된 데이터가 없어 정밀 분석을 수행할 수 없습니다.
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                  {/* 양대 축 비중 및 상관관계 결합 분석 */}
                  <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
                    
                    {/* 투숙객 패널 */}
                    <div className="glass-panel" style={{flex: 1, minWidth: '300px', padding: '24px', background: 'rgba(52, 211, 153, 0.05)', border: '1px solid var(--accent-emerald)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin: '0', color: 'var(--accent-emerald)', fontSize: '18px'}}>투숙객 매출 (객실연계)</h4>
                        <div style={{fontSize: '32px', fontWeight: 'bold'}}>{(motoCorrelations.guestRatio !== null && motoCorrelations.guestRatio !== undefined && typeof motoCorrelations.guestRatio === 'number') ? `${motoCorrelations.guestRatio.toFixed(1)}%` : 'N/A'}</div>
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px'}}>
                        객실에 투숙하며 구매한 티켓 비율 (콘도/객실 티켓합계)
                      </div>

                      <div style={{fontSize: '13px', color: 'var(--accent-emerald)', background: 'rgba(52, 211, 153, 0.1)', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px'}}>
                        💡 <strong>[추천]</strong> 이 수치({(motoCorrelations.guestRatio !== null && motoCorrelations.guestRatio !== undefined && typeof motoCorrelations.guestRatio === 'number') ? motoCorrelations.guestRatio.toFixed(1) : '0'}%)를 <strong>[설정] 탭의 '모토아레나 캡처 레이트'</strong>에 입력하시면, 가장 정확한 투숙객 순수 TrevPAR가 자동 계산됩니다.
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px'}}>
                        <span style={{fontSize: '14px', color: 'var(--text-main)'}}>객실 점유율과의 상관계수 (r)</span>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: (motoCorrelations.guest !== null && motoCorrelations.guest >= 0.4) ? 'var(--accent-emerald)' : 'var(--text-main)'}}>
                          {typeof motoCorrelations.guest === 'number' ? motoCorrelations.guest.toFixed(3) : 'N/A'}
                        </span>
                      </div>
                      
                      <div style={{fontSize: '13px', padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', lineHeight: '1.5'}}>
                        {motoCorrelations.guest !== null && motoCorrelations.guest >= 0.4 && motoCorrelations.guestRatio < 20 ? (
                          <span>⚠️ <strong style={{color: 'var(--accent-red)'}}>[통계적 착시 주의]</strong> 객실 점유율과 흐름은 유사하나, 투숙객 매출이 차지하는 파이가 너무 작아 실질적인 매출 견인 효과는 미미합니다 (허수 가능성).</span>
                        ) : motoCorrelations.guest !== null && motoCorrelations.guest >= 0.4 && motoCorrelations.guestRatio >= 20 ? (
                          <span>✅ <strong style={{color: 'var(--accent-emerald)'}}>[핵심 동력]</strong> 객실 점유율 증가 시 뚜렷하게 함께 오르며, 비중 또한 유의미하여 모토아레나 성장을 든든하게 받쳐주고 있습니다.</span>
                        ) : motoCorrelations.guest !== null ? (
                          <span style={{color: 'var(--text-muted)'}}>📉 객실 점유율 증감과 투숙객 티켓 판매량 간의 유의미한 동기화가 확인되지 않습니다.</span>
                        ) : null}
                      </div>
                    </div>

                    {/* 일반객 패널 */}
                    <div className="glass-panel" style={{flex: 1, minWidth: '300px', padding: '24px', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid var(--accent-gold)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin: '0', color: 'var(--accent-gold)', fontSize: '18px'}}>일반객 매출 (외부유입)</h4>
                        <div style={{fontSize: '32px', fontWeight: 'bold'}}>{(motoCorrelations.generalRatio !== null && motoCorrelations.generalRatio !== undefined && typeof motoCorrelations.generalRatio === 'number') ? `${motoCorrelations.generalRatio.toFixed(1)}%` : 'N/A'}</div>
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px'}}>
                        객실과 무관한 순수 외부 유입 비율 (일반/군민/MOU/단체)
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', opacity: 0.5}}>
                        <span style={{fontSize: '14px', color: 'var(--text-main)'}}>객실 점유율과의 상관계수 (r)</span>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-muted)'}}>
                          해당없음
                        </span>
                      </div>

                      <div style={{fontSize: '13px', padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', lineHeight: '1.5', color: 'var(--text-muted)'}}>
                        💡 외부 마케팅 및 지역 수요에 의한 독립적 영업 성과 지표입니다. 객실 변동과 인과관계가 없으므로 연계 상관성을 분석하지 않습니다.
                      </div>
                    </div>

                    {/* 기타 매출 패널 */}
                    <div className="glass-panel" style={{flex: 1, minWidth: '300px', padding: '24px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin: '0', color: 'var(--text-bright)', fontSize: '18px'}}>기타 매출 (미분류)</h4>
                        <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--text-main)'}}>{(motoCorrelations.otherRatio !== null && motoCorrelations.otherRatio !== undefined && typeof motoCorrelations.otherRatio === 'number') ? `${motoCorrelations.otherRatio.toFixed(1)}%` : 'N/A'}</div>
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px'}}>
                        투숙객/일반객 키워드로 분류되지 않은 매출 (임직원/기타 등)
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', opacity: 0.5}}>
                        <span style={{fontSize: '14px', color: 'var(--text-main)'}}>객실 점유율과의 상관계수 (r)</span>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-muted)'}}>
                          해당없음
                        </span>
                      </div>

                      <div style={{fontSize: '13px', padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', lineHeight: '1.5', color: 'var(--text-muted)'}}>
                        💡 임직원 복지 티켓이거나 명칭 구분이 불명확한 기타 매출입니다. 분석의 핵심이 아니므로 상관관계에서 제외됩니다.
                      </div>
                      
                      {motoCorrelations.aggregatedOther && Object.keys(motoCorrelations.aggregatedOther).length > 0 && (
                        <div style={{marginTop: '16px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', maxHeight: '120px', overflowY: 'auto'}}>
                          <div style={{marginBottom: '6px', fontWeight: 'bold', color: 'var(--text-muted)'}}>📌 미분류 티켓 누적 집계 내역</div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                            {Object.entries(motoCorrelations.aggregatedOther)
                              .sort((a,b) => b[1] - a[1])
                              .map(([k,v]) => (
                              <div key={k} style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px'}}>
                                <span>{k}</span>
                                <span>₩{new Intl.NumberFormat('ko-KR').format(Math.round(v))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 1. 상단 요약 카드 (전체 흐름) */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
        <div className="glass-panel" style={{padding: '24px'}}>
          <h3 style={{margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px'}}>
            통합 상관계수 (r)
            <select
              value={activeDivision}
              onChange={(e) => setActiveDivision(e.target.value)}
              style={{
                fontSize: '12px', 
                padding: '2px 24px 2px 8px', 
                borderRadius: '12px', 
                background: `${activeConf.color}22 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${encodeURIComponent(activeConf.color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>') no-repeat right 6px center`,
                color: activeConf.color,
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                appearance: 'none'
              }}
            >
              {Object.entries(divisionConfig).map(([key, conf]) => (
                <option key={key} value={key} style={{color: 'black'}}>
                  {conf.title}
                </option>
              ))}
            </select>
          </h3>
          <div style={{fontSize: '36px', fontWeight: 'bold', color: activeConf.color}}>
            {typeof activeGlobalCorrelation === 'number' ? activeGlobalCorrelation.toFixed(3) : 'N/A'}
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
                  {typeof r === 'number' ? r.toFixed(2) : '-'}
                </div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{getInterpretation(r)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 메인 트렌드 차트 */}
      <div className="glass-panel" style={{padding: '24px', minWidth: 0}}>
        <div style={{marginBottom: '20px'}}>
          <h3 style={{margin: '0 0 8px 0'}}>월별 추이: 객실 점유율 vs {activeConf.title} 매출</h3>
          <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
            💡 <strong>해석 가이드:</strong> 초록색 선(점유율)과 매출 선의 오르내리는 모습이 비슷할수록, 해당 부문의 매출이 투숙객 수에 크게 의존하고 있음을 뜻합니다.
            <br/>
            <span style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)'}}>
              (※ 좌측 숫자는 리조트 전체 통합 객실 점유율(%)을 의미하며, 우측 세로축의 'M'은 백만 단위를 뜻합니다. 예: 800M = 8억 원)
            </span>
          </p>
        </div>
        <div style={{width: '100%', height: '400px', minWidth: 0, minHeight: 0}}>
          <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={filteredProcessedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="yearMonth" stroke="var(--text-muted)" />
              <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(v) => typeof v === 'number' ? `${v.toFixed(0)}%` : ''} />
              <YAxis yAxisId="right" orientation="right" stroke={activeConf.color} tickFormatter={(v) => typeof v === 'number' ? `${(v/1000000).toFixed(0)}M` : ''} />
              <RechartsTooltip 
                contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                formatter={(value, name) => name === '점유율' ? `${typeof value === 'number' ? value.toFixed(1) : value}%` : `₩${formatCurrency(value)}`}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="occupancyRate" name="점유율" stroke="#94a3b8" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
              <Line yAxisId="right" type="monotone" dataKey={activeConf.dataKey} name={`${activeConf.title} 매출`} stroke={activeConf.color} strokeWidth={3} dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. 산점도 및 영업장 분석 */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
        
        {/* 평형별 산점도 */}
        <div className="glass-panel" style={{padding: '24px', minWidth: 0}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px'}}>
            <div>
              <h3 style={{margin: '0 0 8px 0'}}>평형별 판매량 vs {activeConf.title} 매출 (산점도)</h3>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4'}}>
                💡 <strong>해석 가이드:</strong> 점들이 우측 상단(↗)으로 좁게 뭉쳐서 뻗어나갈수록, 해당 평형의 투숙객이 돈을 많이 쓴다는 증거입니다.
                <br/>
                <span style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)'}}>
                  (※ 가로축(X)은 객실 판매량(실)을 나타내며, 세로축(Y)의 'M'은 백만 단위의 매출을 뜻합니다. 예: 800M = 8억 원)
                </span>
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
          
          <div style={{flex: 1, minHeight: 0, minWidth: 0, width: '100%', height: '300px'}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" dataKey={selectedRoomType === 'all' ? 'totalSold' : selectedRoomType} name="객실 판매(실)" stroke="var(--text-muted)" />
                <YAxis type="number" dataKey={activeConf.dataKey} name={`${activeConf.title} 매출`} stroke="var(--text-muted)" tickFormatter={(v) => typeof v === 'number' ? `${(v/1000000).toFixed(0)}M` : ''} />
                <ZAxis type="category" dataKey="yearMonth" name="연/월" />
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                  formatter={(val, name) => name === `${activeConf.title} 매출` ? `₩${formatCurrency(val)}` : `${val}실`}
                />
                <Legend />
                <Scatter name="월별 현황" data={filteredProcessedData} fill={activeConf.color} shape="circle" />
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
                    <div style={{height: '100%', background: activeConf.color, width: `${Math.max(0, loc.correlation * 100)}%`}}></div>
                  </div>
                </div>
                <div style={{width: '60px', textAlign: 'right', fontWeight: 'bold', color: activeConf.color}}>
                  {typeof loc.correlation === 'number' ? loc.correlation.toFixed(2) : 'N/A'}
                </div>
              </div>
            ))}
            {locationCorrelations.length === 0 && (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>해당 부문의 영업장 데이터가 부족합니다.</div>
            )}
          </div>
        </div>



      </div>

      {/* 4. 날씨 & 매출 상관관계 분석 */}
      <div className="glass-panel" style={{padding: '24px', marginTop: '20px'}}>
        <style>{`
          @keyframes live-pulse {
            0% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.5; }
          }
        `}</style>
        
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
              <h3 style={{margin: 0}}>🌤️ 날씨 및 일별 매출 상관관계 분석</h3>
              
              {/* 실시간 날씨 위젯 */}
              {currentWeather && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: 'var(--text-main)',
                  boxShadow: '0 0 10px rgba(0,0,0,0.2)'
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                    animation: 'live-pulse 2s infinite'
                  }}></span>
                  <span style={{color: 'var(--accent-emerald)', fontWeight: 'bold', fontSize: '11px'}}>LIVE</span>
                  <span style={{color: 'rgba(255,255,255,0.2)'}}>|</span>
                  <span>벨포레 현재: <strong>{currentWeather.desc}</strong> ({currentWeather.temp}°C)</span>
                  <span style={{fontSize: '10px', color: 'var(--text-muted)'}}>
                    ({currentWeather.time ? currentWeather.time.split('T')[1] : ''} 기준)
                  </span>
                </div>
              )}
            </div>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0'}}>
              일자별 최고기온, 강수량 데이터와 당일 매출의 피어슨 상관계수를 분석합니다.
            </p>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
            {/* 분석 대상 전환 토글 단추 */}
            <div style={{display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)'}}>
              <button
                onClick={() => setWeatherDataType('room')}
                style={{
                  background: weatherDataType === 'room' ? 'var(--accent-emerald)' : 'transparent',
                  color: weatherDataType === 'room' ? '#000' : 'var(--text-main)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                객실 매출
              </button>
              <button
                onClick={() => setWeatherDataType('leisure')}
                style={{
                  background: weatherDataType === 'leisure' ? 'var(--accent-purple)' : 'transparent',
                  color: weatherDataType === 'leisure' ? '#000' : 'var(--text-main)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                레저본부 매출
              </button>
              <button
                onClick={() => setWeatherDataType('golf')}
                style={{
                  background: weatherDataType === 'golf' ? '#22c55e' : 'transparent',
                  color: weatherDataType === 'golf' ? '#000' : 'var(--text-main)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                골프 매출
              </button>
            </div>

            {weatherStats && (
              <div style={{fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-muted)'}}>
                분석 대상: 총 {weatherStats.totalValidDays}일
              </div>
            )}
          </div>
        </div>

        {((weatherDataType === 'leisure' || weatherDataType === 'golf') && (!dailyWeatherSalesData || dailyWeatherSalesData.length === 0 || !dailyWeatherSalesData.some(d => d.revenue > 0))) ? (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)', 
            border: '1px solid var(--accent-gold)', 
            borderRadius: '12px', 
            padding: '24px', 
            textAlign: 'center',
            color: 'var(--text-main)'
          }}>
            <p style={{margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold'}}>일별 {weatherDataType === 'golf' ? '골프' : '레저'} 매출 데이터가 없습니다.</p>
            <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)'}}>
              {weatherDataType === 'golf' ? '골프' : '레저본부'} 날씨 매출 분석을 시작하려면 <strong>[설정] ➡️ [데이터 업로드]</strong> 탭으로 이동하여 <strong>레저 실적 엑셀 파일</strong>을 다시 업로드해 주세요.<br/>
              재업로드 시 데이터베이스에 일별 상세 실적(분류별 영업장 데이터)이 추가되어 날씨 분석이 실시간으로 제공됩니다.
            </p>
          </div>
        ) : (!isWeatherMerged || !weatherStats) ? (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)', 
            border: '1px solid var(--accent-gold)', 
            borderRadius: '12px', 
            padding: '24px', 
            textAlign: 'center',
            color: 'var(--text-main)'
          }}>
            <p style={{margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold'}}>날씨 데이터가 아직 병합되지 않았습니다.</p>
            <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)'}}>
              날씨 분석을 시작하려면 <strong>[설정]</strong> 탭으로 이동하여 <strong>과거 날씨 데이터 소급 적용 (과거 데이터 마이그레이션)</strong>을 실행해 주세요.<br/>
              또는 날씨 정보가 추가된 새 객실 실적 파일을 업로드하시면 자동으로 날씨가 동기화됩니다.
            </p>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            {/* 상관계수 및 날씨별 비교 카드 그리드 */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px'}}>
              
              {/* 기온 상관계수 카드 */}
              <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px'}}>
                <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>최고기온 vs {weatherLabel} 상관관계</div>
                <div style={{display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px'}}>
                  <span style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>
                    {typeof weatherStats.tempCorr === 'number' ? weatherStats.tempCorr.toFixed(3) : 'N/A'}
                  </span>
                  <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>(r)</span>
                </div>
                <div style={{fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)'}}>
                  해석: {getTempInterpretation(weatherStats.tempCorr).title}
                </div>
                <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0', lineHeight: '1.4'}}>
                  {getTempInterpretation(weatherStats.tempCorr).desc}
                </p>
              </div>

              {/* 강수량 상관계수 카드 */}
              <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px'}}>
                <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>강수량 vs {weatherLabel} 상관관계</div>
                <div style={{display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px'}}>
                  <span style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>
                    {typeof weatherStats.precipCorr === 'number' ? weatherStats.precipCorr.toFixed(3) : 'N/A'}
                  </span>
                  <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>(r)</span>
                </div>
                <div style={{fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)'}}>
                  해석: {getPrecipInterpretation(weatherStats.precipCorr).title}
                </div>
                <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0', lineHeight: '1.4'}}>
                  {getPrecipInterpretation(weatherStats.precipCorr).desc}
                </p>
              </div>

              {/* 주말/공휴일 우천 영향 분석 카드 */}
              <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px'}}>
                <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>주말/공휴일 강수량 vs {weatherLabel}</div>
                <div style={{display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px'}}>
                  <span style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-coral)'}}>
                    {typeof weatherStats.weekendPrecipCorr === 'number' ? weatherStats.weekendPrecipCorr.toFixed(3) : 'N/A'}
                  </span>
                  <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>(r)</span>
                </div>
                <div style={{fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '10px'}}>
                  해석: {getPrecipInterpretation(weatherStats.weekendPrecipCorr).title}
                </div>
                {weatherStats.weekendRainyStats ? (
                  <div style={{fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', color: 'var(--text-muted)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span>☀️ 맑은 주말/공휴일 ({weatherStats.weekendRainyStats.clearDaysCount}일) 평균:</span>
                      <strong style={{color: 'var(--text-main)'}}>₩{formatCurrency(weatherStats.weekendRainyStats.avgClearRevenue)}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '2px'}}>
                      <span>☔ 비 온 주말/공휴일 ({weatherStats.weekendRainyStats.rainyDaysCount}일) 평균:</span>
                      <strong style={{color: 'var(--accent-coral)'}}>
                        {weatherStats.weekendRainyStats.rainyDaysCount > 0 ? `₩${formatCurrency(weatherStats.weekendRainyStats.avgRainyRevenue)}` : '비 온 날 없음'}
                      </strong>
                    </div>
                    {weatherStats.weekendRainyStats.rainyDaysCount > 0 && weatherStats.weekendRainyStats.avgClearRevenue > 0 && (
                      <div style={{textAlign: 'right', marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px', color: 'var(--accent-coral)', fontWeight: 'bold'}}>
                        비 올 시 일평균 매출 {((1 - (weatherStats.weekendRainyStats.avgRainyRevenue / weatherStats.weekendRainyStats.avgClearRevenue)) * 100).toFixed(1)}% 감소
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>주말/공휴일 데이터가 충분하지 않습니다.</div>
                )}
              </div>

              {/* 날씨 유형별 통계 카드 */}
              <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px'}}>
                <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>날씨 상태별 일평균 {weatherDataType === 'room' ? '객실 매출 및 판매량' : weatherLabel}</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  {weatherStats.descList.map((g) => (
                    <div key={g.desc} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <span style={{fontWeight: 'bold', minWidth: '60px'}}>{g.desc}</span>
                        <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>({g.daysCount}일)</span>
                      </div>
                      <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
                        <div style={{textAlign: 'right'}}>
                          <div style={{fontSize: '13px', fontWeight: 'bold'}}>₩{formatCurrency(g.avgRevenue)}</div>
                          <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>일평균 매출</div>
                        </div>
                        {weatherDataType === 'room' && (
                          <div style={{textAlign: 'right', minWidth: '80px'}}>
                            <div style={{fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>{typeof g.avgRoomsSold === 'number' ? g.avgRoomsSold.toFixed(1) : '0.0'}실</div>
                            <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>일평균 판매</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* 우천 여부 비교 표 */}
            <div style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginTop: '20px'}}>
              <h4 style={{margin: '0 0 8px 0', color: 'var(--accent-coral)'}}>🌧️ 실질적 우천 여부(비/눈 온 날 vs 맑음/미량 강수)에 따른 일평균 매출 비교</h4>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0'}}>
                미량의 이슬비로 인한 통계 왜곡을 방지하기 위해 일일 강수량 3.0mm 이상을 실질적 우천일(비/눈 온 날)로 정의하고, 그 미만(3.0mm 미만)을 맑음/미량 강수일로 구분하여 주중, 주말/공휴일, 전체 기간의 일평균 매출을 4대 핵심 부문별로 나누어 대조 분석합니다.
              </p>
              
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
                  <thead>
                    <tr style={{background: 'rgba(255, 255, 255, 0.05)', borderBottom: '2px solid rgba(255,255,255,0.1)'}}>
                      <th style={{padding: '10px 6px', color: 'var(--text-muted)', textAlign: 'left', width: '150px'}} colSpan="2">구분</th>
                      <th style={{padding: '10px 6px', color: 'var(--accent-emerald)'}} colSpan="2">맑음 / 미량 강수 ({"< 3mm"})</th>
                      <th style={{padding: '10px 6px', color: 'var(--accent-coral)'}} colSpan="2">비 / 눈 온 날 ({">= 3mm"})</th>
                      <th style={{padding: '10px 6px', color: 'var(--text-bright)'}} colSpan="2">강수 시 매출 차이</th>
                    </tr>
                    <tr style={{background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '11px'}}>
                      <th style={{padding: '6px', textAlign: 'left', color: 'var(--text-muted)'}}>부문</th>
                      <th style={{padding: '6px', textAlign: 'left', color: 'var(--text-muted)'}}>분류</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일수</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일평균 매출</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일수</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일평균 매출</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>변동액</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'totalRevenue', title: '전체 통합 매출', color: 'var(--accent-gold)' },
                      { key: 'roomRevenue', title: '객실 매출', color: 'var(--accent-emerald)' },
                      { key: 'leisureRevenue', title: '레저본부 매출', color: 'var(--accent-purple)' },
                      { key: 'golfRevenue', title: '골프 매출', color: '#22c55e' }
                    ].map(sec => {
                      const sectorData = weatherStats.sectorRainStats?.[sec.key];
                      if (!sectorData) return null;
                      
                      const subRows = [
                        { label: '전체 기간 (Overall)', stats: sectorData.overall },
                        { label: '주중 (Weekdays)', stats: sectorData.weekday },
                        { label: '주말/공휴일 (Weekends & Holidays)', stats: sectorData.weekend }
                      ];
                      
                      return subRows.map((sub, subIdx) => {
                        const s = sub.stats;
                        if (!s) return null;
                        const diff = s.rainyAvgRev - s.clearAvgRev;
                        const pct = s.clearAvgRev > 0 ? (diff / s.clearAvgRev) * 100 : 0;
                        
                        return (
                          <tr 
                            key={`${sec.key}-${sub.label}`} 
                            style={{
                              borderBottom: subIdx === 2 ? '2px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.03)',
                              background: subIdx === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                            }}
                          >
                            {subIdx === 0 && (
                              <td 
                                rowSpan="3" 
                                style={{
                                  padding: '12px 10px', 
                                  textAlign: 'left', 
                                  fontWeight: 'bold', 
                                  color: sec.color,
                                  borderRight: '1px solid rgba(255,255,255,0.05)',
                                  verticalAlign: 'middle',
                                  background: 'rgba(255,255,255,0.02)'
                                }}
                              >
                                {sec.title}
                              </td>
                            )}
                            <td style={{padding: '12px 10px', textAlign: 'left', fontWeight: subIdx === 0 ? 'bold' : 'normal'}}>{sub.label}</td>
                            <td style={{padding: '12px 6px'}}>{s.clearDays}일</td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: 'var(--text-main)'}}>₩{formatCurrency(s.clearAvgRev)}</td>
                            <td style={{padding: '12px 6px'}}>{s.rainyDays}일</td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: 'var(--text-main)'}}>
                              {s.rainyDays > 0 ? `₩${formatCurrency(s.rainyAvgRev)}` : '-'}
                            </td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: diff < 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'}}>
                              {s.rainyDays > 0 ? `${diff > 0 ? '+' : ''}₩${formatCurrency(diff)}` : '-'}
                            </td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: diff < 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'}}>
                              {s.rainyDays > 0 ? `${pct.toFixed(1)}%` : '-'}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 계절(시즌)별 우천 타격 분석 표 */}
            <div style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginTop: '20px'}}>
              <h4 style={{margin: '0 0 8px 0', color: 'var(--accent-purple)'}}>🌸🌻🍁❄️ 계절(시즌)별 우천 타격 심층 분석</h4>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0'}}>
                여름 성수기의 장마철과 겨울 비수기의 맑은 날이 혼합되어 발생하는 통계적 왜곡을 방지하기 위해, 사계절(봄/여름/가을/겨울)로 그룹화하여 동 시즌 내에서의 우천 타격률을 대조 분석합니다.
              </p>
              
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
                  <thead>
                    <tr style={{background: 'rgba(255, 255, 255, 0.05)', borderBottom: '2px solid rgba(255,255,255,0.1)'}}>
                      <th style={{padding: '10px 6px', color: 'var(--text-muted)', textAlign: 'left', width: '150px'}} colSpan="2">구분</th>
                      <th style={{padding: '10px 6px', color: 'var(--accent-emerald)'}} colSpan="2">해당 시즌 맑은 날</th>
                      <th style={{padding: '10px 6px', color: 'var(--accent-coral)'}} colSpan="2">해당 시즌 비/눈 온 날</th>
                      <th style={{padding: '10px 6px', color: 'var(--text-bright)'}} colSpan="2">시즌 내 우천 타격</th>
                    </tr>
                    <tr style={{background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '11px'}}>
                      <th style={{padding: '6px', textAlign: 'left', color: 'var(--text-muted)'}}>부문</th>
                      <th style={{padding: '6px', textAlign: 'left', color: 'var(--text-muted)'}}>시즌</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일수</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일평균 매출</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일수</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>일평균 매출</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>변동액</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'totalRevenue', title: '전체 통합 매출', color: 'var(--accent-gold)' },
                      { key: 'roomRevenue', title: '객실 매출', color: 'var(--accent-emerald)' },
                      { key: 'leisureRevenue', title: '레저본부 매출', color: 'var(--accent-purple)' },
                      { key: 'golfRevenue', title: '골프 매출', color: '#22c55e' }
                    ].map(sec => {
                      const sectorData = weatherStats.sectorRainStats?.[sec.key];
                      if (!sectorData || !sectorData.seasons) return null;
                      
                      return sectorData.seasons.map((seasonItem, seasonIdx) => {
                        const s = seasonItem.stats;
                        if (!s || (s.clearDays === 0 && s.rainyDays === 0)) return null;
                        
                        const diff = s.rainyAvgRev - s.clearAvgRev;
                        const pct = s.clearAvgRev > 0 ? (diff / s.clearAvgRev) * 100 : 0;
                        
                        return (
                          <tr 
                            key={`${sec.key}-${seasonItem.label}`} 
                            style={{
                              borderBottom: seasonIdx === sectorData.seasons.length - 1 ? '2px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.03)',
                              background: 'transparent'
                            }}
                          >
                            {seasonIdx === 0 && (
                              <td 
                                rowSpan={sectorData.seasons.filter(si => si.stats.clearDays > 0 || si.stats.rainyDays > 0).length} 
                                style={{
                                  padding: '12px 10px', 
                                  textAlign: 'left', 
                                  fontWeight: 'bold', 
                                  color: sec.color,
                                  borderRight: '1px solid rgba(255,255,255,0.05)',
                                  verticalAlign: 'middle',
                                  background: 'rgba(255,255,255,0.02)'
                                }}
                              >
                                {sec.title}
                              </td>
                            )}
                            <td style={{padding: '12px 10px', textAlign: 'left'}}>{seasonItem.label}</td>
                            <td style={{padding: '12px 6px'}}>{s.clearDays}일</td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: 'var(--text-main)'}}>₩{formatCurrency(s.clearAvgRev)}</td>
                            <td style={{padding: '12px 6px'}}>{s.rainyDays}일</td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: 'var(--text-main)'}}>
                              {s.rainyDays > 0 ? `₩${formatCurrency(s.rainyAvgRev)}` : '-'}
                            </td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: diff < 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'}}>
                              {s.rainyDays > 0 ? `${diff > 0 ? '+' : ''}₩${formatCurrency(diff)}` : '-'}
                            </td>
                            <td style={{padding: '12px 6px', fontWeight: 'bold', color: diff < 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'}}>
                              {s.rainyDays > 0 ? `${pct.toFixed(1)}%` : '-'}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 일별 매출-기온/강수량 혼합 차트 */}
            <div style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px'}}>
                <h4 style={{margin: 0}}>📈 일별 매출 - 기온/강수량 추이 혼합 차트 ({weatherLabel})</h4>
                <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>
                  * 하단 차트에서 일자별 매출액(막대)과 최고기온(선)을 오버레이하여 기상 변동에 따른 즉각적인 매출 탄력성을 시각화합니다.
                </div>
              </div>
              
              <div style={{width: '100%', height: '350px'}}>
                <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                  <ComposedChart data={dailyWeatherSalesData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => val.substring(5)} />
                    <YAxis yAxisId="left" stroke={weatherDataType === 'room' ? 'var(--accent-emerald)' : weatherDataType === 'golf' ? '#22c55e' : 'var(--accent-purple)'} tickFormatter={(v) => typeof v === 'number' ? `${(v/1000000).toFixed(1)}M` : ''} label={{ value: `${weatherLabel} (백만)`, angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 12 } }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--accent-gold)" tickFormatter={(v) => typeof v === 'number' ? `${v}°C` : ''} label={{ value: '최고기온 (°C)', angle: 90, position: 'insideRight', style: { fill: 'var(--text-muted)', fontSize: 12 } }} />
                    <RechartsTooltip 
                      contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                      formatter={(value, name) => {
                        if (name === '매출') return `₩${formatCurrency(value)}`;
                        if (name === '최고기온') return typeof value === 'number' ? `${value.toFixed(1)}°C` : 'N/A';
                        if (name === '강수량') return typeof value === 'number' ? `${value.toFixed(1)}mm` : 'N/A';
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="매출" fill={weatherDataType === 'room' ? 'rgba(16, 185, 129, 0.6)' : weatherDataType === 'golf' ? 'rgba(34, 197, 94, 0.6)' : 'rgba(168, 85, 247, 0.6)'} barSize={16} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="tempMax" name="최고기온" stroke="var(--accent-gold)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2025 vs 2026 전년동월 대비 날씨 및 매출 비교 표 */}
            <div style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginTop: '20px'}}>
              <h4 style={{margin: '0 0 8px 0', color: 'var(--accent-emerald)'}}>📊 2025년 vs 2026년 날씨 & 전체매출 전년 대비(YoY) 비교</h4>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 20px 0'}}>
                전년 동월 대비 기온 변화와 비 온 날(강수일수)이 리조트 전체 통합 매출(객실 매출 + 부대업장 매출) 변동에 미친 연관성을 대조 분석합니다.
              </p>

              {/* 비교 테이블 */}
              <div style={{overflowX: 'auto', marginBottom: '20px'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
                  <thead>
                    <tr style={{background: 'rgba(255, 255, 255, 0.05)', borderBottom: '2px solid rgba(255,255,255,0.1)'}}>
                      <th style={{padding: '10px 6px', color: 'var(--text-muted)'}} rowSpan="2">월</th>
                      <th style={{padding: '10px 6px', color: 'var(--accent-gold)', borderRight: '1px solid rgba(255,255,255,0.15)'}} colSpan="3">2025년</th>
                      <th style={{padding: '10px 6px', color: 'var(--accent-blue)', borderRight: '1px solid rgba(255,255,255,0.15)'}} colSpan="3">2026년</th>
                      <th style={{padding: '10px 6px', color: 'var(--text-bright)'}} colSpan="2">전체매출 변동 (YoY)</th>
                    </tr>
                    <tr style={{background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '11px'}}>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>평균기온</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>비 온 날</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)', borderRight: '1px solid rgba(255,255,255,0.15)'}}>전체매출</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>평균기온</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>비 온 날</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)', borderRight: '1px solid rgba(255,255,255,0.15)'}}>전체매출</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>변동액</th>
                      <th style={{padding: '6px', color: 'var(--text-muted)'}}>변동률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weatherYearComparisonData.map(item => {
                      const d25 = item['2025'];
                      const d26 = item['2026'];
                      const rev25 = d25.hasData ? d25.totalRevenue : 0;
                      const rev26 = d26.hasData ? d26.totalRevenue : 0;
                      const diff = rev26 - rev25;
                      const diffPct = rev25 > 0 ? (diff / rev25) * 100 : 0;
                      
                      return (
                        <tr key={item.month} style={{borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s'}} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{padding: '10px 6px', fontWeight: 'bold'}}>{item.month}</td>
                          
                          {/* 2025 */}
                          <td style={{padding: '10px 6px'}}>{d25.hasData && d25.avgTemp !== null ? `${d25.avgTemp.toFixed(1)}°C` : '-'}</td>
                          <td style={{padding: '10px 6px'}}>{d25.hasData ? `${d25.rainyDays}일` : '-'}</td>
                          <td style={{padding: '10px 6px', borderRight: '1px solid rgba(255,255,255,0.15)'}}>{d25.hasData ? `₩${formatCurrency(d25.totalRevenue)}` : '-'}</td>
                          
                          {/* 2026 */}
                          <td style={{padding: '10px 6px'}}>{d26.hasData && d26.avgTemp !== null ? `${d26.avgTemp.toFixed(1)}°C` : '-'}</td>
                          <td style={{padding: '10px 6px'}}>{d26.hasData ? `${d26.rainyDays}일` : '-'}</td>
                          <td style={{padding: '10px 6px', borderRight: '1px solid rgba(255,255,255,0.15)'}}>{d26.hasData ? `₩${formatCurrency(d26.totalRevenue)}` : '-'}</td>
                          
                          {/* 변동 */}
                          <td style={{padding: '10px 6px', fontWeight: 'bold', color: !d25.hasData || !d26.hasData ? 'var(--text-muted)' : (diff > 0 ? 'var(--accent-emerald)' : 'var(--accent-red)')}}>
                            {!d25.hasData || !d26.hasData ? '-' : `${diff > 0 ? '+' : ''}₩${formatCurrency(diff)}`}
                          </td>
                          <td style={{padding: '10px 6px', fontWeight: 'bold', color: !d25.hasData || !d26.hasData ? 'var(--text-muted)' : (diff > 0 ? 'var(--accent-emerald)' : 'var(--accent-red)')}}>
                            {!d25.hasData || !d26.hasData ? '-' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diffPct).toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* AI/정밀 데이터 분석 인사이트 코멘트 영역 */}
              {weatherInsights.length > 0 && (
                <div style={{background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px'}}>
                  <div style={{fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <span>💡</span> <strong>날씨-매출 연계 주요 관측 인사이트:</strong>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.5'}}>
                    {weatherInsights.map((insight, idx) => (
                      <div key={idx} style={{fontSize: '12px', color: 'var(--text-muted)'}}>
                        {insight.text.split('**').map((chunk, i) => i % 2 === 1 ? <strong key={i} style={{color: 'var(--accent-gold)'}}>{chunk}</strong> : chunk)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
