import { useState, useEffect } from 'react';

export default function useGoogleSheetVisitors() {
  const [googleSheetData, setGoogleSheetData] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    const fetchGoogleSheet = async () => {
      setIsSyncing(true);
      try {
        const url = 'https://docs.google.com/spreadsheets/d/1wlNrE_FvXCYNGfyvIYxEidYLKoEas4pidWe0Z9e_2xs/export?format=csv&gid=1933764837';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        const lines = csvText.split('\n');
        
        // 대표님 요청에 따라 '리조트 총 방문객' 대신 '레저본부 방문객' 라인을 타겟으로 함
        const targetLine = lines.find(line => line.includes('레저본부 방문객'));
        
        if (targetLine) {
          const cells = [];
          let currentCell = '';
          let inQuotes = false;
          for(let i=0; i<targetLine.length; i++){
            const char = targetLine[i];
            if(char === '"'){
              inQuotes = !inQuotes;
            } else if(char === ',' && !inQuotes){
              cells.push(currentCell.trim());
              currentCell = '';
            } else {
              currentCell += char;
            }
          }
          cells.push(currentCell.trim());

          const monthlyDataObj = {};
          // 1월부터 12월까지의 실적 데이터 추출 (인덱스는 6부터 시작하여 3칸씩 뜀)
          for(let m=1; m<=12; m++) {
            const idx = 6 + (m - 1) * 3;
            if (cells[idx]) {
              monthlyDataObj[m] = parseInt(cells[idx].replace(/,/g, ''), 10) || 0;
            } else {
              monthlyDataObj[m] = 0;
            }
          }
          
          // 이용률 실적 파싱
          const utilizationRates = {};
          let inUtilizationSection = false;
          
          for (let l of lines) {
            if (l.includes('월별 이용률 목표')) {
              inUtilizationSection = true;
              continue;
            }
            if (inUtilizationSection) {
              if (l.includes('월별 매출 목표')) break; // 다음 섹션 만나면 중단
              
              const parts = [];
              let current = '';
              let inQ = false;
              for(let i=0; i<l.length; i++){
                const c = l[i];
                if(c === '"') inQ = !inQ;
                else if(c === ',' && !inQ) { parts.push(current.trim()); current = ''; }
                else current += c;
              }
              parts.push(current.trim());
              
              const venueName = parts[1];
              if (venueName && venueName !== '업장' && venueName !== '') {
                utilizationRates[venueName] = {};
                // 전체 실적 (인덱스 3)
                utilizationRates[venueName]['all'] = parseFloat((parts[3] || '0').replace('%', '')) || 0;
                
                // 월별 실적 (인덱스는 1월이 6, 2월이 9 ...)
                for(let m=1; m<=12; m++) {
                  const idx = 6 + (m - 1) * 3;
                  if (parts[idx]) {
                    utilizationRates[venueName][m] = parseFloat((parts[idx] || '0').replace('%', '')) || 0;
                  } else {
                    utilizationRates[venueName][m] = 0;
                  }
                }
              }
            }
          }

          setGoogleSheetData({ visitors: monthlyDataObj, utilizationRates });
          setSyncError(null);
        } else {
          throw new Error("구글 시트에서 '레저본부 방문객' 행을 찾을 수 없습니다.");
        }
      } catch (error) {
        setSyncError(error.message);
        console.error('Failed to fetch Google Sheet data', error);
      } finally {
        setIsSyncing(false);
      }
    };
    fetchGoogleSheet();
  }, []);

  return { googleSheetData, isSyncing, syncError };
}
