/**
 * revenueUtils.js
 * 앱 전체 컴포넌트에서 공통으로 사용하는 매출 분류/집계 유틸리티입니다.
 * 골프/식음/기타/레저 매출이 컴포넌트마다 다르게 계산되는(Data Discrepancy) 문제를 방지합니다.
 */

export const calculateGroupedSales = (salesObj, locationGroups = {}) => {
  let leisure = 0;
  let fnb = 0;
  let golf = 0;
  let other = 0;
  let moto = 0;

  if (!salesObj || typeof salesObj !== 'object') {
    return { leisure, fnb, golf, other, moto };
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
      else leisure += val;
      return;
    }

    // 2. Fallback 키워드 매칭 (설정이 없어도 자동으로 골프/식당/기타를 걸러냄)
    if (loc.includes('골프') || loc.includes('클럽하우스') || loc.includes('그늘집') || loc === '골프부대') {
      golf += val;
    } else if (loc.includes('기타') || loc === '임대수익') {
      other += val;
    } else if (loc.includes('식당') || loc.includes('BBQ') || loc.includes('조식') || loc.includes('바베큐') || loc.includes('카페') || loc.includes('식음')) {
      fnb += val;
    } else if (loc.includes('모토아레나') || loc.includes('핏스탑')) {
      moto += val;
    } else {
      leisure += val;
    }
  });

  return { leisure, fnb, golf, other, moto };
};
