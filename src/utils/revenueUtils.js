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

// [V5 Rule 3] O(1) 매핑 딕셔너리 사용 (NO STRING MATCHING)
const uiGroupDictionary = {
  'GOLF': 'golf', '골프': 'golf', '클럽하우스': 'golf', '그늘집': 'golf', '골프부대': 'golf', '그린피': 'golf', '프로샵': 'golf',
  'FNB': 'fnb', '식당': 'fnb', 'BBQ': 'fnb', '조식': 'fnb', '바베큐': 'fnb', '카페': 'fnb', '식음': 'fnb', 'BHC': 'fnb', '멕시카나': 'fnb', '편의점': 'fnb', 'CU': 'fnb', '쿠치나': 'fnb', '연회장': 'fnb', '벨포레홀': 'fnb', '벼루재촌': 'fnb', '밤밤': 'fnb', '남도예담': 'fnb', '브리스킷': 'fnb', '투썸': 'fnb', '레스토랑': 'fnb', '스타트하우스': 'fnb', '딜라이트': 'fnb',
  'OTHER': 'other', '기타': 'other', '임대수익': 'other', '주차': 'other', '대여품': 'other',
  'MOTO': 'moto', '모토아레나': 'moto', '핏스탑': 'moto'
};

export const getDefaultGroup = (loc) => {
  return uiGroupDictionary[loc] || 'leisure';
};

export const calculateGroupedSales = (salesObj, locationGroups = {}, venueCategories = {}) => {
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
      else if (mappedGroup === 'exclude') {
        // [사각지대 방어] 표출은 숨기되 총매출 합계에선 누락되지 않도록 은밀히 합산
        dynamicGroups['hiddenRevenue'] = (dynamicGroups['hiddenRevenue'] || 0) + val;
      }
      else {
        // Dynamic group
        dynamicGroups[mappedGroup] = (dynamicGroups[mappedGroup] || 0) + val;
      }
      return;
    }

    // 1.5 백엔드 공식 categoryCode 최우선 매핑 (V3 규격 반영)
    const cat = venueCategories[loc];
    if (cat) {
      if (cat === 'FNB' || cat === 'BANQUET') { fnb += val; return; }
      if (cat === 'GOLF') { golf += val; return; }
      if (cat === 'MOTO') { moto += val; return; }
      if (cat === 'TICKET') { leisure += val; return; }
      if (cat === 'OTHER') { other += val; return; }
    }

  // 2. 백엔드 Enum 매핑 우선 적용 완료. (더 이상 텍스트 기반 Fallback 휴리스틱을 사용하지 않음)
    else if (fallback === 'moto') moto += val;
    else leisure += val;
  });

  return { leisure, fnb, golf, other, moto, dynamicGroups };
};

// [V5 Rule 3] O(1) 매핑 딕셔너리 사용 (NO STRING MATCHING)
const uiWeatherDictionary = {
  '미디어아트': '실내/F&B', 'VR': '실내/F&B', '실내': '실내/F&B', '전시': '실내/F&B',
  '수영': '물놀이/수영장', '워터': '물놀이/수영장', '스파': '물놀이/수영장',
  '골프': '골프장',
  '눈썰매': '겨울 시설', '스노우': '겨울 시설',
  '루지': '야외 트랙', '카트': '야외 트랙'
};

export const getDefaultWeatherTag = (loc, group) => {
  if (group === 'fnb') return '실내/F&B';
  return uiWeatherDictionary[loc] || '야외 어트랙션';
};
