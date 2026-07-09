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
        
        // [V5 Bible] "여러 개의 API를 부를 필요 없이, 이 API 하나만 호출하면 모든 데이터가 세팅됩니다."
        const detailUrl = `https://belleforet-data.vercel.app/api/v5/dashboard/revenue-summary?date=${targetDate}`;
        
        const res = await fetch(detailUrl, { 
          headers: { Authorization: 'Bearer belleforet-m2m-secret' } 
        });
        
        if (!res.ok) {
          throw new Error('V5 Revenue Summary API failed: ' + res.statusText);
        }
        
        const json = await res.json();
        
        // 프론트엔드 가공 없이 백엔드 JSON(summary, salesByCategory, salesByFacility, dailyTrends, weather)을 그대로 주입
        if (json.status === 'SUCCESS' && json.data) {
          setData(json.data);
        } else {
          setData(json); // fallback
        }
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
