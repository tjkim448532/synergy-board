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
  const upperBound = Math.max(q3 + 1.5 * iqr, q3 * 1.2);
  
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

/**
 * 피어슨 상관계수 (Pearson Correlation Coefficient)
 * 큰 숫자(매출액 등) 제곱 시 발생하는 JS의 부동소수점 오버플로 및 
 * Catastrophic Cancellation(정밀도 손실) 방지를 위해 평균 중심화(Mean-Centering) 방식을 사용합니다.
 */
export const calculateCorrelation = (xArray, yArray) => {
  if (!xArray || !yArray || xArray.length !== yArray.length || xArray.length < 4) return null;
  const n = xArray.length;
  
  const meanX = xArray.reduce((a, b) => a + b, 0) / n;
  const meanY = yArray.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = xArray[i] - meanX;
    // 매출액 단위가 수십억일 수 있으므로 편차 계산 시 10000 단위로 스케일다운하여 오버플로 사전 차단
    const dy = (yArray[i] - meanY) / 10000; 
    const dxScaled = dx / 100; // X(객실수/점유율 등)도 일부 스케일 다운
    
    numerator += dxScaled * dy;
    sumSqX += dxScaled * dxScaled;
    sumSqY += dy * dy;
  }
  
  if (sumSqX <= 0 || sumSqY <= 0) return null;
  return numerator / Math.sqrt(sumSqX * sumSqY);
};

/**
 * 심슨의 역설 방지용 주중/주말 보정 상관계수 산출
 * 주중과 주말 데이터를 분리하여 상관계수를 각각 계산한 후, 두 값을 평균냅니다.
 * 데이터 세트가 혼합되어 발생하는 범주형 변수(요일)에 의한 거품을 제거합니다.
 */
export const getAdjustedCorrelation = (xArray, yArray, isWeekendArray) => {
  if (!xArray || !yArray || !isWeekendArray || xArray.length !== yArray.length || xArray.length !== isWeekendArray.length) return null;
  
  const wdX = [], wdY = [], weX = [], weY = [];
  for (let i = 0; i < xArray.length; i++) {
    if (isWeekendArray[i]) {
      weX.push(xArray[i]);
      weY.push(yArray[i]);
    } else {
      wdX.push(xArray[i]);
      wdY.push(yArray[i]);
    }
  }
  
  const wdCorr = calculateCorrelation(wdX, wdY);
  const weCorr = calculateCorrelation(weX, weY);
  
  const isValidWd = wdCorr !== null && !isNaN(wdCorr);
  const isValidWe = weCorr !== null && !isNaN(weCorr);
  
  if (isValidWd && isValidWe) {
    return (wdCorr + weCorr) / 2;
  }
  if (isValidWd) return wdCorr;
  if (isValidWe) return weCorr;
  
  return null;
};

/**
 * 단순 선형 회귀 알고리즘 (OLS: Ordinary Least Squares)
 * 매출 예측을 위한 선형 회귀선의 기울기(slope)와 절편(intercept)을 구합니다.
 * 피어슨 상관계수와 동일하게 평균 중심화(Mean-Centering) 방식을 사용하여 숫자 오버플로를 방지합니다.
 */
export const calculateLinearRegression = (points, xKey, yKey) => {
  const validPoints = (points || []).filter(p => p[yKey] !== 0 && p[yKey] !== null && p[yKey] !== undefined);
  const n = validPoints.length;
  
  if (n === 0) return { slope: 0, intercept: 0, r: 0, avgYPerX: 0 };
  if (n === 1) {
    const p = validPoints[0];
    const slope = p[xKey] > 0 ? p[yKey] / p[xKey] : 0;
    return { slope, intercept: 0, r: 1, avgYPerX: slope };
  }

  const sumX = validPoints.reduce((sum, p) => sum + p[xKey], 0);
  const sumY = validPoints.reduce((sum, p) => sum + p[yKey], 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  
  let covXY = 0;
  let varX = 0;
  let varY = 0;

  validPoints.forEach(p => {
    // JS MAX_SAFE_INTEGER 한계를 초과하는 제곱연산 방지를 위해 스케일링 후 복원 로직 적용
    const dx = p[xKey] - meanX;
    const dy = (p[yKey] - meanY) / 10000;  // Y 스케일다운
    const dxScaled = dx / 100;             // X 스케일다운
    
    covXY += dxScaled * dy;
    varX += dxScaled * dxScaled;
    varY += dy * dy;
  });

  // slope = (covXY / varX) * (scaleY / scaleX) = (covXY / varX) * (10000 / 100) = (covXY / varX) * 100
  const slope = varX > 1e-12 ? (covXY / varX) * 100 : 0;
  const intercept = meanY - slope * meanX;
  
  const r = (varX > 1e-12 && varY > 1e-12) ? covXY / Math.sqrt(varX * varY) : 0;
  const avgYPerX = sumX > 0 ? sumY / sumX : 0;

  return { slope, intercept, r, avgYPerX };
};

// 근사 정규분포 CDF (p-value 계산용)
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

// Pure JS Matrix Operations
const transpose = (matrix) => matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));

const multiply = (a, b) => {
  const aRows = a.length, aCols = a[0].length, bCols = b[0].length;
  const m = new Array(aRows);
  for (let r = 0; r < aRows; ++r) {
    m[r] = new Array(bCols);
    for (let c = 0; c < bCols; ++c) {
      m[r][c] = 0;
      for (let i = 0; i < aCols; ++i) {
        m[r][c] += a[r][i] * b[i][c];
      }
    }
  }
  return m;
};

// Gauss-Jordan Elimination for Matrix Inverse
const inverse = (matrix) => {
  let m = matrix.length;
  let identity = [];
  let aug = [];
  
  for (let i = 0; i < m; i++) {
    identity[i] = [];
    aug[i] = [];
    for (let j = 0; j < m; j++) {
      identity[i][j] = (i === j) ? 1 : 0;
      aug[i][j] = matrix[i][j];
    }
  }
  
  for (let i = 0; i < m; i++) {
    let pivot = aug[i][i];
    if (pivot === 0) return null; // Singular matrix
    
    for (let j = 0; j < m; j++) {
      aug[i][j] /= pivot;
      identity[i][j] /= pivot;
    }
    
    for (let k = 0; k < m; k++) {
      if (k !== i) {
        let factor = aug[k][i];
        for (let j = 0; j < m; j++) {
          aug[k][j] -= factor * aug[i][j];
          identity[k][j] -= factor * identity[i][j];
        }
      }
    }
  }
  return identity;
};

/**
 * 다중 선형 회귀 분석 (OLS) - Pure JS
 * @param {number[]} y 종속 변수 배열
 * @param {number[][]} X 독립 변수 2차원 배열 (첫번째 열은 1)
 * @returns {object|null} { coefficients, pValues, R2 }
 */
export const calculateMultipleRegression = (y, X) => {
  if (!y || !X || y.length < 4 || y.length !== X.length) return null;
  
  try {
    for (let i = 0; i < n; i++) {
      const diff = yArray[i] - meanY;
      totalSumSq += diff * diff;
    }
    
    const R2 = totalSumSq === 0 ? 0 : 1 - (sumSqErr / totalSumSq);
    
    // 분산 = SSE / (n - k)
    const variance = sumSqErr / (n - k);
    
    const coefficients = B.valueOf().map(r => r[0]);
    const pValues = [];
    
    for (let i = 0; i < k; i++) {
      // 대각원소가 음수나 0이 나오는 매우 극단적인 매트릭스 예외처리
      const diag = XTX_inv.get([i, i]);
      if (diag <= 0) {
        pValues.push(1.0); // 유의미성 없음으로 처리
        continue;
      }
      
      const standardError = Math.sqrt(variance * diag);
      const tStat = coefficients[i] / standardError;
      
      // t-분포를 정규분포로 근사하여 p-value 도출 (n >= 30 에서 유효)
      const p = 2 * (1 - normalCDF(Math.abs(tStat)));
      pValues.push(p);
    }
    
    return { coefficients, pValues, R2 };
  } catch (err) {
    console.warn("MRA Error: matrix inversion failed", err);
    return null; // 역행렬을 구할 수 없는 경우 (다중공선성 등)
  }
};
