// src/utils/statUtils.js

/**
 * 어떤 형태의 값이 들어와도 안전하게 숫자로 파싱합니다.
 * 콤마(,), 공백 등을 제거하며, 숫자가 아닐 경우 0을 반환합니다.
 */
export const parseSafeNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  const trimmed = val.toString().trim();
  // 괄호 (100) 형태나 마이너스 처리
  const isNegative = /^\(.*\)$/.test(trimmed) || /-\s*$/.test(trimmed) || trimmed.startsWith('-');
  const cleaned = trimmed.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? 0 : (isNegative ? -num : num);
};

/**
 * IQR (Interquartile Range) 방식을 사용하여 배열 내의 극단적 이상치를 제거합니다.
 * 데이터 개수가 너무 적을 경우(4개 미만) 필터링 없이 그대로 반환합니다.
 */
export const filterOutliers = (dataList) => {
  if (!dataList || dataList.length < 4) return dataList;
  // 올바른 숫자 비교 정렬
  const values = [...dataList].sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return dataList.filter(v => v >= lowerBound && v <= upperBound);
};

/**
 * 데이터 배열의 평균을 안전하게 구합니다.
 * 빈 배열일 경우 0을 반환하며, useIQR이 true면 이상치를 배제한 후 평균을 산출합니다.
 */
export const safeAverage = (dataArray, useIQR = true) => {
  if (!dataArray || dataArray.length === 0) return 0;
  
  const validData = useIQR ? filterOutliers(dataArray) : dataArray;
  if (validData.length === 0) return 0;
  
  const sum = validData.reduce((acc, val) => acc + val, 0);
  return sum / validData.length;
};

/**
 * 분모가 0이 되는 것을 방지하는 안전한 비율(나눗셈) 계산 함수입니다.
 */
export const safeRate = (numerator, denominator) => {
  const num = parseSafeNumber(numerator);
  const den = parseSafeNumber(denominator);
  
  if (den === 0) return 0;
  return num / den;
};
