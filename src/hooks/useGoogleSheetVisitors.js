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
          setGoogleSheetData(monthlyDataObj);
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
