import { useMemo } from 'react';

// [V5 Rule 1, 2, 3] 단일 진실 공급원(SSOT) 아키텍처 적용
// 모든 임의 덧셈 연산, 배열 중첩 루프(Cartesian Product), 상태 누적 코드를 영구 삭제했습니다.
// 오직 백엔드에서 전달된 원본 스냅샷(v5Data)만 UI 렌더링용 프로퍼티로 변환하여 덮어쓰기(Proxy) 합니다.
export default function useProcessedData(v5Data, settings) {
  return useMemo(() => {
    if (!v5Data || !v5Data.summary) {
      return { processedData: [], globalStats: {} };
    }

    const { summary, salesByCategory, salesByFacility, dailyTrends, weather, matrixWeekly } = v5Data;

    // 카테고리별 매출을 O(1) Dictionary로 빠른 조회를 위해 변환 (순회 합산이 아님, 스냅샷 파싱)
    const categoryMap = {};
    if (Array.isArray(salesByCategory)) {
      salesByCategory.forEach(item => {
        categoryMap[item.category] = Number(item.sales || 0);
      });
    }

    const totalRoomRevenue = categoryMap['객실'] || 0;
    const totalFnbRevenue = categoryMap['식음'] || 0;
    const totalGolfRevenue = categoryMap['골프'] || 0;
    const totalLeisureRevenue = categoryMap['티켓'] || 0;
    const totalOtherRevenue = categoryMap['기타'] || 0;
    const totalMotoRevenue = categoryMap['모토아레나'] || 0;

    // 단일 진실 공급원 필드 활용
    const totalRevenue = summary.totalRevenue || 0;
    const totalRooms = summary.totalRooms || 0;
    const totalGuests = summary.totalRoomCap || summary.totalGuests || 0;
    const totalGolfTeams = summary.totalGolfTeams || 0;

    // 기본 가용 객실 수 (fallback 180)
    const dailyInventory = summary.totalInventory || 180;
    const globalOccRate = dailyInventory > 0 ? (totalRooms / dailyInventory) * 100 : 0;
    const avgGuestsPerSoldRoom = totalRooms > 0 ? totalGuests / totalRooms : 0;

    // V5 프론트엔드는 더 이상 데이터를 가공하지 않으며 백엔드 객체를 그대로 UI 계층에 전달합니다.
    return { 
      // UI 차트들이 배열을 요구하는 경우 dailyTrends를 넘겨줌
      processedData: Array.isArray(dailyTrends) ? dailyTrends : [], 
      globalStats: {
        totalOccupancyRate: globalOccRate,
        totalRoomRevenue,
        totalLeisureRevenue,
        totalMotoRevenue,
        totalFnbRevenue,
        totalOtherRevenue,
        totalGolfRevenue,
        totalRevenue, // 최상위 총매출 (UI 바인딩용)
        avgGuestsPerSoldRoom,
        dailyInventory,
        totalRooms,
        totalGuests,
        totalGolfTeams,
        salesByFacility: salesByFacility || [],
        matrixWeekly: matrixWeekly || [],
        salesByCategory: salesByCategory || []
      }
    };
  }, [v5Data, settings]);
}
