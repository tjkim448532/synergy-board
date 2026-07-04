import { useEffect } from 'react';

/**
 * 모니터 해상도에 맞춰 전체 UI를 자동으로 확대/축소하는 훅
 * @param {number} baseWidth 디자인 기준 가로 해상도 (기본 1920px)
 */
export default function useAutoScale(baseWidth = 1920) {
  useEffect(() => {
    function handleResize() {
      const windowWidth = window.innerWidth;

      // 1024px 이하의 태블릿/모바일은 스케일링 무시 (CSS 미디어 쿼리의 반응형 레이아웃 작동)
      if (windowWidth <= 1024) {
        document.documentElement.style.zoom = 1;
        return;
      }

      // 화면 비율 계산
      const scale = windowWidth / baseWidth;

      // 너무 작아지거나 너무 커지는 것을 방지 (예: 최대 1.5배, 최소 0.7배)
      const clampedScale = Math.min(Math.max(scale, 0.7), 1.5);

      // 전체 HTML 문서를 줌인/줌아웃
      // (참고: zoom은 Chrome/Edge/Safari 등 WebKit 계열에서 완벽하게 작동합니다.)
      document.documentElement.style.zoom = clampedScale;
    }

    // 초기 로딩 시 및 창 크기 변경 시 적용
    handleResize();
    window.addEventListener('resize', handleResize);

    // 클린업: 훅이 해제될 때 리스너 제거 및 줌 초기화
    return () => {
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.zoom = 1;
    };
  }, [baseWidth]);
}
