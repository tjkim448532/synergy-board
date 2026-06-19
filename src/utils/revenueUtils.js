/**
 * revenueUtils.js
 * 앱 전체 컴포넌트에서 공통으로 사용하는 매출 분류/집계 유틸리티입니다.
 * 골프/식음/기타/레저 매출이 컴포넌트마다 다르게 계산되는(Data Discrepancy) 문제를 방지합니다.
 */

export const getDefaultGroup = (loc) => {
  if (loc.includes('골프') || loc.includes('클럽하우스') || loc.includes('그늘집') || loc === '골프부대' || loc.includes('그린피') || loc.includes('프로샵')) {
    return 'golf';
  } else if (loc.includes('식당') || loc.includes('BBQ') || loc.includes('조식') || loc.includes('바베큐') || loc.includes('카페') || loc.includes('식음') || loc.includes('BHC') || loc.includes('멕시카나') || loc.includes('편의점') || loc.includes('CU') || loc.includes('쿠치나') || loc.includes('연회장') || loc.includes('벨포레홀') || loc.includes('벼루재촌') || loc.includes('밤밤') || loc.includes('남도예담') || loc.includes('브리스킷') || loc.includes('투썸') || loc.includes('레스토랑') || loc.includes('스타트하우스') || loc.includes('딜라이트')) {
    return 'fnb';
  } else if (loc.includes('기타') || loc === '임대수익' || loc.includes('주차') || loc.includes('대여품')) {
    return 'other';
  } else if (loc.includes('모토아레나') || loc.includes('핏스탑')) {
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
