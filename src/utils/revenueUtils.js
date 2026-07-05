/**
 * revenueUtils.js
 * 앱 전체 컴포넌트에서 공통으로 사용하는 매출 분류/집계 유틸리티입니다.
 * 골프/식음/기타/레저 매출이 컴포넌트마다 다르게 계산되는(Data Discrepancy) 문제를 방지합니다.
 */
import { isHoliday } from 'korean-holidays';

export const isRoomWeekend = (dateStr, customWeekendsArray = []) => {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return false;
  
  const day = d.getDay();
  // 호스피탈리티 업계 주말: 금요일(5), 토요일(6)
  const isFriOrSat = (day === 5 || day === 6);
  
  // 공휴일 전날(체크인 날)은 주말로 간주
  const nextDay = new Date(d);
  nextDay.setDate(d.getDate() + 1);
  const isNextDayHoliday = isHoliday(nextDay);
  
  return customWeekendsArray.includes(dateStr) || isFriOrSat || isNextDayHoliday;
};

export const isLeisureWeekend = (dateStr, customWeekendsArray = []) => {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return false;
  
  const day = d.getDay();
  // 레저 업계 주말: 토요일(6), 일요일(0)
  const isSatOrSun = (day === 0 || day === 6);
  
  // 공휴일 당일은 주말로 간주
  const isTodayHoliday = isHoliday(d);
  
  return customWeekendsArray.includes(dateStr) || isSatOrSun || isTodayHoliday;
};

export const isHospitalityWeekend = isRoomWeekend;

export const getDefaultGroup = (loc) => {
  if (loc === 'GOLF' || loc.includes('골프') || loc.includes('클럽하우스') || loc.includes('그늘집') || loc === '골프부대' || loc.includes('그린피') || loc.includes('프로샵')) {
    return 'golf';
  } else if (loc === 'FNB' || loc.includes('식당') || loc.includes('BBQ') || loc.includes('조식') || loc.includes('바베큐') || loc.includes('카페') || loc.includes('식음') || loc.includes('BHC') || loc.includes('멕시카나') || loc.includes('편의점') || loc.includes('CU') || loc.includes('쿠치나') || loc.includes('연회장') || loc.includes('벨포레홀') || loc.includes('벼루재촌') || loc.includes('밤밤') || loc.includes('남도예담') || loc.includes('브리스킷') || loc.includes('투썸') || loc.includes('레스토랑') || loc.includes('스타트하우스') || loc.includes('딜라이트')) {
    return 'fnb';
  } else if (loc === 'OTHER' || loc.includes('기타') || loc === '임대수익' || loc.includes('주차') || loc.includes('대여품')) {
    return 'other';
  } else if (loc === 'MOTO' || loc.includes('모토아레나') || loc.includes('핏스탑')) {
    return 'moto';
  } else {
    return 'leisure';
  }
};

export const calculateGroupedSales = (salesObj, locationGroups = {}) => {
  let leisure = 0;
  let fnb = 0;
  let golf = 0;
  let other = 0;
  let moto = 0;
  let dynamicGroups = {};

  if (!salesObj || typeof salesObj !== 'object') {
    return { leisure, fnb, golf, other, moto, dynamicGroups };
  }

  Object.entries(salesObj).forEach(([loc, amt]) => {
    const val = Number(amt) || 0;
    
    // 1. 사용자 설정(locationGroups) 최우선 매핑
    const mappedGroup = locationGroups[loc];
    if (mappedGroup) {
      if (mappedGroup === 'golf') golf += val;
      else if (mappedGroup === 'fnb') fnb += val;
      else if (mappedGroup === 'other') other += val;
      else if (mappedGroup === 'moto') moto += val;
      else if (mappedGroup === 'leisure') leisure += val;
      else if (mappedGroup === 'exclude') { /* Do nothing */ }
      else {
        // Dynamic group
        dynamicGroups[mappedGroup] = (dynamicGroups[mappedGroup] || 0) + val;
      }
      return;
    }

    // 2. Fallback 키워드 매칭
    const fallback = getDefaultGroup(loc);
    if (fallback === 'golf') golf += val;
    else if (fallback === 'fnb') fnb += val;
    else if (fallback === 'other') other += val;
    else if (fallback === 'moto') moto += val;
    else leisure += val;
  });

  return { leisure, fnb, golf, other, moto, dynamicGroups };
};

export const getDefaultWeatherTag = (loc, group) => {
  if (loc.includes('미디어아트') || loc.includes('VR') || loc.includes('실내') || loc.includes('전시')) {
    return '실내/F&B';
  }
  if (group === 'fnb') {
    return '실내/F&B';
  }
  if (loc.includes('수영') || loc.includes('워터') || loc.includes('스파')) {
    return '물놀이/수영장';
  }
  if (loc.includes('골프')) {
    return '골프장';
  }
  if (loc.includes('눈썰매') || loc.includes('스노우')) {
    return '겨울 시설';
  }
  if (loc.includes('루지') || loc.includes('카트')) {
    return '야외 트랙';
  }
  return '야외 어트랙션';
};
