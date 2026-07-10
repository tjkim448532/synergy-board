import { useState, useEffect } from 'react';

// [V5 Rule 1, 2, 3] 단일 진실 공급원(SSOT) 아키텍처에 따른 프론트엔드 파이프라인 전면 개편
// 이전의 모든 transformPolymorphicData, reduce, Array 합산 로직 전면 폐기
export default function useBackendData(startDate, endDate, targetDate) {
  // startDate, endDate는 V3/V4 하위 호환성을 위해 시그니처만 남겨두고, 
  // 실제 호출은 오직 targetDate 단일 스냅샷에 의존합니다.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // [V5 Bible v2.0] "revenue-summary와 matrix-weekly 두 가지 필수 API 병렬 호출"
        const summaryUrl = `https://belleforet-data.vercel.app/api/v5/dashboard/revenue-summary?date=${targetDate}`;
        const matrixUrl = `https://belleforet-data.vercel.app/api/v5/dashboard/matrix-weekly?date=${targetDate}`;
        
        const [summaryRes, matrixRes] = await Promise.all([
          fetch(summaryUrl, { headers: { Authorization: 'Bearer belleforet-m2m-secret' } }),
          fetch(matrixUrl, { headers: { Authorization: 'Bearer belleforet-m2m-secret' } })
        ]);
        
        if (!summaryRes.ok) throw new Error('V5 Revenue Summary API failed: ' + summaryRes.statusText);
        if (!matrixRes.ok) throw new Error('V5 Matrix Weekly API failed: ' + matrixRes.statusText);
        
        const summaryJson = await summaryRes.json();
        const matrixJson = await matrixRes.json();
        
        // 프론트엔드 가공 없이 백엔드 JSON 데이터를 그대로 주입 (matrixWeekly 추가)
        let mergedData = {};
        if (summaryJson.status === 'SUCCESS' && summaryJson.data) {
          mergedData = { ...summaryJson.data };
        } else {
          mergedData = { ...summaryJson };
        }
        
        // matrix-weekly 데이터 병합
        if (matrixJson.status === 'SUCCESS' && matrixJson.data) {
          mergedData.matrixWeekly = matrixJson.data;
        } else {
          mergedData.matrixWeekly = Array.isArray(matrixJson) ? matrixJson : [];
        }

        setData(mergedData);
      } catch (err) {
        console.error("V5 Backend API Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (targetDate) {
      fetchData();
    }
  }, [targetDate]);

  return { data, loading, error };
}
