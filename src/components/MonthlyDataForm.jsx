import React, { useState, useEffect } from 'react';
import { Save, Trash2, Upload, Hotel, Ticket, Lock } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './MonthlyDataForm.css';

import { isHoliday } from 'korean-holidays';

const parseSafeInt = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Math.floor(val);
  const str = val.toString().replace(/,/g, '').trim();
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export default function MonthlyDataForm({ settings }) {
  const [records, setRecords] = useState([]);
  
  // 개별 상태로 분리
  const [roomData, setRoomData] = useState(null);
  const [leisureData, setLeisureData] = useState(null);
  const [crossCheckResult, setCrossCheckResult] = useState(null);
  
  const [motoData, setMotoData] = useState(null);
  const [motoTargetMonth, setMotoTargetMonth] = useState('');
  const [motoFileObj, setMotoFileObj] = useState(null);

  const [isRoomSaved, setIsRoomSaved] = useState(false);
  const [isLeisureSaved, setIsLeisureSaved] = useState(false);
  const [isMotoSaved, setIsMotoSaved] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '5025') {
      setIsAuthenticated(true);
    } else {
      toast.error('비밀번호가 일치하지 않습니다.');
      setPin('');
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'monthly_records'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => (b.yearMonth || '').localeCompare(a.yearMonth || '')); // sort desc
      setRecords(data);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id) => {
    toast((t) => (
      <div>
        <p style={{margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold'}}>해당 월의 통합 실적(객실, 레저 등)을 모두 삭제하시겠습니까?</p>
        <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-glass)', background: 'transparent', color: 'white'}}
          >취소</button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteDoc(doc(db, 'monthly_records', id));
                toast.success('삭제 완료되었습니다.');
              } catch (e) {
                toast.error('삭제 실패: ' + e.message);
              }
            }} 
            style={{padding: '6px 12px', borderRadius: '4px', background: 'var(--accent-red)', color: 'white', border: 'none'}}
          >삭제하기</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleRoomFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsRoomSaved(false);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        
        let headerRowIdx = -1;
        let dateIdx = -1, typeIdx = -1, countIdx = -1, revIdx = -1;
        let rateIdx = -1, marketIdx = -1, sourceIdx = -1, agencyIdx = -1;

        for (let i = 0; i < 15; i++) {
          const row = data[i];
          if (!row) continue;
          
          const rowStr = row.map(c => c ? c.toString().replace(/\s+/g, '') : '').join('');
          if ((rowStr.includes('일자') || rowStr.includes('날짜') || rowStr.includes('Date')) && 
              (rowStr.includes('객실타입') || rowStr.includes('룸타입'))) {
            headerRowIdx = i;
            const headers = row.map(h => h ? h.toString().replace(/\s+/g, '') : '');
            
            const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
            
            dateIdx = findCol(['일자', '날짜', 'Date']);
            typeIdx = findCol(['객실타입', '룸타입']);
            countIdx = findCol(['객실수', '판매객실', '객실판매']);
            revIdx = findCol(['합계', '실매출', '매출액']);
            rateIdx = findCol(['요금타입', 'RateType']);
            marketIdx = findCol(['마켓타입', '마켓구분']);
            sourceIdx = findCol(['소스타입', '소스구분']);
            agencyIdx = findCol(['거래처', '에이전시']);
            break;
          }
        }
        
        if (headerRowIdx === -1 || dateIdx === -1 || typeIdx === -1) {
          return toast.error('객실 엑셀 양식을 인식할 수 없습니다. "일자", "객실타입" 열이 포함된 파일을 올려주세요.');
        }
        
        const roomParsedMap = {};

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[dateIdx]) continue;
          
          let dateVal = row[dateIdx].toString().trim();
          const dateRegex = /^\d{4}[-./]\d{2}[-./]\d{2}$/;
          
          if (dateRegex.test(dateVal)) {
            dateVal = dateVal.replace(/[./]/g, '-');
            const [yyyy, mm, dd] = dateVal.split('-');
            const monthKey = `${yyyy}-${mm}`;
            
            if (!roomParsedMap[monthKey]) {
              roomParsedMap[monthKey] = {
                yearMonth: monthKey,
                uniqueDates: new Set(),
                uniqueWeekdayDates: new Set(),
                uniqueWeekendDates: new Set(),
                sold16: 0, sold35: 0, sold51: 0, sold51Acc: 0,
                revenue16: 0, revenue35: 0, revenue51: 0, revenue51Acc: 0,
                totalRoomRevenue: 0,
                soldWeekday: 0, soldWeekend: 0,
                revWeekday: 0, revWeekend: 0
              };
            }
            
            const monthData = roomParsedMap[monthKey];
            monthData.uniqueDates.add(dateVal);
            
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            const day = d.getDay();
            const nextDay = new Date(d);
            nextDay.setDate(d.getDate() + 1);
            
            const isFriOrSat = (day === 5 || day === 6);
            const isNextDayHoliday = isHoliday(nextDay);
            
            const customWeekendsStr = settings?.customWeekends || '';
            const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);
            
            let isWeekend = false;
            if (customWeekendsArray.includes(dateVal) || isFriOrSat || isNextDayHoliday) {
              isWeekend = true;
            }
            
            if (isWeekend) monthData.uniqueWeekendDates.add(dateVal);
            else monthData.uniqueWeekdayDates.add(dateVal);
            
            const roomType = row[typeIdx] ? row[typeIdx].toString().trim() : '';
            const count = parseSafeInt(row[countIdx]);
            const rev = parseSafeInt(row[revIdx]);

            // 모든 객실 합계를 구하기 위해 continue 조건 제거

            if (!monthData.rawRoomRecords) {
                monthData.rawRoomRecords = [];
            }
            monthData.rawRoomRecords.push({
                date: dateVal,
                roomType: roomType,
                count: count,
                revenue: rev,
                rateType: rateIdx !== -1 && row[rateIdx] ? row[rateIdx].toString().trim() : '',
                marketType: marketIdx !== -1 && row[marketIdx] ? row[marketIdx].toString().trim() : '',
                sourceType: sourceIdx !== -1 && row[sourceIdx] ? row[sourceIdx].toString().trim() : '',
                agency: agencyIdx !== -1 && row[agencyIdx] ? row[agencyIdx].toString().trim() : ''
            });

            monthData.totalRoomRevenue += rev;
            if (isWeekend) {
              monthData.soldWeekend += count;
              monthData.revWeekend += rev;
            } else {
              monthData.soldWeekday += count;
              monthData.revWeekday += rev;
            }
            
            if (roomType.includes('16평')) {
              monthData.sold16 += count; monthData.revenue16 += rev;
            } else if (roomType.includes('35평')) {
              monthData.sold35 += count; monthData.revenue35 += rev;
            } else if (roomType.includes('51평')) {
              if (roomType.includes('장애') || roomType.includes('휠체어')) {
                monthData.sold51Acc += count; monthData.revenue51Acc += rev;
              } else {
                monthData.sold51 += count; monthData.revenue51 += rev;
              }
            }
          }
        }
        
        const parsedMonthsArray = Object.values(roomParsedMap).map(m => {
          const newObj = {
            ...m,
            daysCount: m.uniqueDates.size,
            daysCountWeekday: m.uniqueWeekdayDates.size,
            daysCountWeekend: m.uniqueWeekendDates.size
          };
          delete newObj.uniqueDates;
          delete newObj.uniqueWeekdayDates;
          delete newObj.uniqueWeekendDates;
          return newObj;
        });

        if (parsedMonthsArray.length === 0) {
           return toast.error('유효한 날짜가 포함된 행을 찾을 수 없습니다.');
        }

        setRoomData(parsedMonthsArray);

      } catch (err) {
        console.error(err);
        toast.error('객실 데이터 추출 중 오류가 발생했습니다.');
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const handleLeisureFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLeisureSaved(false);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        
        let headerRowIdx = -1;
        let dataStartIdx = -1;
        let dateIdx = -1;
        let sumIdx = -1;
        let roomIdx = -1;
        let roomOtherIdx = -1;

        for (let i = 0; i < 15; i++) {
          const row = data[i];
          if (!row) continue;
          
          const rowStr = row.map(c => c ? c.toString().replace(/\s+/g, '') : '').join('');
          if ((rowStr.includes('일자') || rowStr.includes('날짜') || rowStr.includes('Date')) && 
              (rowStr.includes('ROOM') || rowStr.includes('합계'))) {
            
            headerRowIdx = i;
            dataStartIdx = i + 1;
            
            // If the next row is sub-headers (like Food, Beverage), skip it.
            const nextRowStr = data[i+1] ? data[i+1].map(c => c ? c.toString().replace(/\s+/g, '') : '').join('') : '';
            if (nextRowStr.includes('합계')) {
                dataStartIdx = i + 2;
            }
            
            const headers = row.map(h => h ? h.toString().replace(/\s+/g, '').toUpperCase() : '');
            
            dateIdx = headers.findIndex(h => h.includes('일자') || h.includes('날짜') || h.includes('DATE'));
            sumIdx = headers.findIndex(h => h.includes('합계') || h.includes('TOTAL'));
            roomIdx = headers.findIndex(h => h === 'ROOM');
            roomOtherIdx = headers.findIndex(h => h === 'ROOMOTHER');
            
            // If date is not found in header, maybe it's the first column implicitly
            if (dateIdx === -1) dateIdx = 0;
            break;
          }
        }
        
        if (headerRowIdx === -1) return toast.error('새로운 레저 엑셀 양식을 인식할 수 없습니다. "영업일자" 및 "ROOM" 열이 포함된 파일을 올려주세요.');
        
        const headers = data[headerRowIdx];
        
        const monthlyParsedMap = {};

        const mapLocationName = (name) => {
          const n = name.replace(/[\s-]+/g, '');
          if (
            n.includes('미디어아트') || 
            n.includes('미디어기념품') || 
            n.includes('미디여기념품') || 
            n.includes('미디어기프트') || 
            n.includes('미디어카페') ||
            n.includes('뮤지엄카페') ||
            n.includes('미디어가페')
          ) {
            return '미디어아트센터';
          }
          if (
            n.includes('목장체험') || 
            name.trim() === '목장' || 
            n.includes('얼룩말카페') ||
            n.includes('벨포레목장')
          ) {
            return '목장';
          }
          return name;
        };

        const excludedCols = ['영업일자', '일자', 'ROOM', 'ROOM OTHER', 'ROOMOTHER', '합계'];
        const locationCols = [];
        for (let j = 1; j < headers.length; j++) {
            if (j === sumIdx || j === roomIdx) continue;
            const colName = headers[j] ? headers[j].toString().trim() : '';
            if (!colName || excludedCols.includes(colName.toUpperCase().replace(/\s+/g, ''))) continue;
            locationCols.push({ index: j, name: mapLocationName(colName) });
        }

        let firstDateStr = '';

        for (let i = dataStartIdx; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[dateIdx]) continue;
          
          let dateVal = row[dateIdx].toString().trim();
          const dateRegex = /^\d{4}[-./]\d{2}[-./]\d{2}$/;
          
          if (dateRegex.test(dateVal)) {
            dateVal = dateVal.replace(/[./]/g, '-');
            if (!firstDateStr) firstDateStr = dateVal;
            const [yyyy, mm, dd] = dateVal.split('-');
            const monthKey = `${yyyy}-${mm}`;
            
            if (!monthlyParsedMap[monthKey]) {
                monthlyParsedMap[monthKey] = {
                    yearMonth: monthKey,
                    totalLeisureSales: 0,
                    leisureRevWd: 0,
                    leisureRevWe: 0,
                    leisureSalesByLocation: {},
                    salesByLocation: {},
                    salesWdByLocation: {},
                    salesWeByLocation: {},
                    crossCheckRoomSum: 0
                };
            }
            
            const monthData = monthlyParsedMap[monthKey];

            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            const day = d.getDay();
            
            // 레저 주말: 토(6), 일(0) 및 당일 공휴일
            const isSatOrSun = (day === 0 || day === 6);
            const isTodayHoliday = isHoliday(d);
            const customWeekendsStr = settings?.customWeekends || '';
            const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);
            
            let isWe = false;
            if (customWeekendsArray.includes(dateVal) || isSatOrSun || isTodayHoliday) {
              isWe = true;
            }

            let rowLeisureSum = 0;
            locationCols.forEach(col => {
                const val = parseSafeInt(row[col.index]);
                if (!isNaN(val)) {
                    monthData.leisureSalesByLocation[col.name] = (monthData.leisureSalesByLocation[col.name] || 0) + val;
                    monthData.salesByLocation[col.name] = (monthData.salesByLocation[col.name] || 0) + val;
                    
                    if (isWe) {
                        monthData.salesWeByLocation[col.name] = (monthData.salesWeByLocation[col.name] || 0) + val;
                    } else {
                        monthData.salesWdByLocation[col.name] = (monthData.salesWdByLocation[col.name] || 0) + val;
                    }
                    rowLeisureSum += val;
                }
            });

            monthData.totalLeisureSales += rowLeisureSum;
            if (isWe) {
              monthData.leisureRevWe += rowLeisureSum;
            } else {
              monthData.leisureRevWd += rowLeisureSum;
            }

            if (roomIdx !== -1 || roomOtherIdx !== -1) {
                const roomVal = roomIdx !== -1 ? parseSafeInt(row[roomIdx]) : 0;
                const roomOtherVal = roomOtherIdx !== -1 ? parseSafeInt(row[roomOtherIdx]) : 0;
                
                const validRoom = isNaN(roomVal) ? 0 : roomVal;
                const validOther = isNaN(roomOtherVal) ? 0 : roomOtherVal;
                
                monthData.crossCheckRoomSum += (validRoom + validOther);
            }
          }
        }
        
        const parsedMonthsArray = Object.values(monthlyParsedMap).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
        if (parsedMonthsArray.length === 0) {
            toast.error('유효한 날짜 데이터를 찾을 수 없습니다.');
            return;
        }

        // 교차 검증 로직 적용 (각 월별로)
        const crossCheckResults = {};
        parsedMonthsArray.forEach(monthData => {
            const existingRecord = records.find(r => r.id === monthData.yearMonth);
            if (existingRecord && existingRecord.totalRoomRevenue) {
                const dbRoom = existingRecord.totalRoomRevenue;
                // 기존 객실 데이터와 (ROOM + ROOM OTHER)의 합이 거의 일치하는지 (1000원 미만 오차 허용)
                const isMatch = Math.abs(dbRoom - monthData.crossCheckRoomSum) < 1000; 
                crossCheckResults[monthData.yearMonth] = {
                    hasRecord: true,
                    dbRoom,
                    parsedRoom: monthData.crossCheckRoomSum,
                    isMatch
                };
            } else {
                crossCheckResults[monthData.yearMonth] = {
                    hasRecord: false,
                    parsedRoom: monthData.crossCheckRoomSum
                };
            }
        });

        setCrossCheckResult(crossCheckResults);
        setLeisureData(parsedMonthsArray);

      } catch (err) {
        console.error(err);
        toast.error('레저 데이터 추출 중 오류가 발생했습니다.');
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveRoomData = async () => {
    if (!roomData || !Array.isArray(roomData)) return;
    try {
      for (const data of roomData) {
        await setDoc(doc(db, 'monthly_records', data.yearMonth), data, { merge: true });
      }
      toast.success(`[${roomData.map(d => d.yearMonth).join(', ')}] 객실 데이터가 성공적으로 저장(병합)되었습니다!`);
      setIsRoomSaved(true);
    } catch (e) {
      toast.error('저장 실패: ' + e.message);
    }
  };

  const handleSaveLeisureData = async () => {
    if (!leisureData || !Array.isArray(leisureData)) return;
    try {
      for (const data of leisureData) {
         // monthData object includes crossCheckRoomSum which we don't strictly need in DB, but it's fine.
         const dataToSave = {
            yearMonth: data.yearMonth,
            leisureSales: data.totalLeisureSales,
            leisureRevWd: data.leisureRevWd,
            leisureRevWe: data.leisureRevWe,
            leisureSalesByLocation: data.leisureSalesByLocation,
            salesByLocation: data.salesByLocation,
            salesWdByLocation: data.salesWdByLocation,
            salesWeByLocation: data.salesWeByLocation
         };
         await setDoc(doc(db, 'monthly_records', data.yearMonth), dataToSave, { merge: true });
      }
      toast.success(`총 ${leisureData.length}개월의 레저 데이터가 성공적으로 저장(병합)되었습니다!`);
      setIsLeisureSaved(true);
    } catch (e) {
      toast.error('저장 실패: ' + e.message);
    }
  };

  const handleMotoFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMotoFileObj(file);
    setMotoData(null);
    setIsMotoSaved(false);

    // 파일명에서 1~12월 숫자 추출
    const match = file.name.match(/(\d+)월?/);
    if (match) {
      let month = parseInt(match[1], 10);
      if (month >= 1 && month <= 12) {
        let year = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        // 만약 현재 1~3월인데, 올리는 엑셀이 10~12월분이라면 작년 데이터일 확률이 높음!
        if (currentMonth <= 3 && month >= 10) {
          year -= 1;
        }
        setMotoTargetMonth(`${year}-${month.toString().padStart(2, '0')}`);
      }
    }
  };

  const handleExtractMotoData = () => {
    if (!motoFileObj) return;

    if (!motoTargetMonth) {
      toast.error('추출 전에 대상 월(연/월)을 먼저 선택해주세요.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        
        let guestRev = 0;
        let generalRev = 0;
        let internalRev = 0;
        let otherRev = 0;
        let totalRev = 0;
        
        const breakdown = { guest: {}, general: {}, internal: {}, other: {} };

        let headerRowIdx = -1;
        let txColIdx = -1;
        let revColIdx = -1;

        // 헤더 행 찾기 (더 넓은 범위의 키워드 검색)
        for (let i = 0; i < 15; i++) {
          const r = data[i];
          if (!r) continue;
          const rStr = r.join(' ').replace(/\s+/g, '');
          
          if (rStr.includes('트랜잭션명') || rStr.includes('상품명') || rStr.includes('메뉴명') || rStr.includes('매출구분') || rStr.includes('품목명') || rStr.includes('아이템')) {
            headerRowIdx = i;
            for (let j = 0; j < r.length; j++) {
              const cellStr = r[j] ? r[j].toString().replace(/\s+/g, '') : '';
              if (cellStr.includes('트랜잭션명') || cellStr.includes('상품명') || cellStr.includes('메뉴명') || cellStr.includes('매출구분') || cellStr.includes('품목명') || cellStr.includes('아이템')) {
                txColIdx = j;
              }
              if (cellStr.includes('실매출') || cellStr.includes('결제금액') || cellStr.includes('매출') || cellStr.includes('합계')) {
                revColIdx = j;
              }
            }
            break;
          }
        }

        // 만약 정규 헤더를 못 찾았다면, 데이터 행에서 '콘도', '객실', '일반' 등의 키워드가 가장 많이 나오는 컬럼을 찾아 txColIdx로 추정
        if (txColIdx === -1) {
          const colScores = {};
          for (let i = 0; i < Math.min(data.length, 50); i++) {
            if (!data[i]) continue;
            for (let j = 0; j < data[i].length; j++) {
              const val = String(data[i][j] || '');
              if (val.includes('콘도') || val.includes('객실') || val.includes('일반') || val.includes('단체') || val.includes('MOU')) {
                colScores[j] = (colScores[j] || 0) + 1;
              }
            }
          }
          let bestCol = -1;
          let maxScore = 0;
          for (const [col, score] of Object.entries(colScores)) {
            if (score > maxScore) {
              maxScore = score;
              bestCol = Number(col);
            }
          }
          
          if (bestCol !== -1) {
             txColIdx = bestCol;
             headerRowIdx = 1; // 대략 두 번째 줄부터 데이터라고 가정
             // 매출액 컬럼 추정 (맨 마지막의 숫자 컬럼)
             for(let j = data[1].length - 1; j >= 0; j--) {
                const testVal = parseInt(String(data[1][j] || '').replace(/,/g, ''), 10);
                if (!isNaN(testVal)) {
                   revColIdx = j;
                   break;
                }
             }
          } else {
             // 최후의 수단 (기존 하드코딩)
             headerRowIdx = 1;
             txColIdx = 3;
             revColIdx = 8;
          }
        }

        const dataStartIdx = headerRowIdx + 1;

        for (let i = dataStartIdx; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          
          const txName = row[txColIdx];
          const rev = parseSafeInt(row[revColIdx]);
          if (typeof txName === 'string') {
            if (txName.includes('TOTAL') || txName === 'TOTAL') continue;
            
            let category = 'other';
            if (txName.includes('콘도') || txName.includes('객실')) {
              guestRev += rev;
              category = 'guest';
            } else if (txName.includes('일반') || txName.includes('증평군민') || txName.includes('MOU') || txName.includes('단체')) {
              generalRev += rev;
              category = 'general';
            } else if (txName.includes('임직원') || txName.includes('직원동반')) {
              internalRev += rev;
              category = 'internal';
            } else {
              otherRev += rev;
            }
            totalRev += rev;
            
            if (!breakdown[category][txName]) breakdown[category][txName] = 0;
            breakdown[category][txName] += rev;
          }
        }
        
        setMotoData({
          yearMonth: motoTargetMonth,
          motoGuestRev: guestRev,
          motoGeneralRev: generalRev,
          motoInternalRev: internalRev,
          motoOtherRev: otherRev,
          motoTotalRev: totalRev,
          breakdown
        });

      } catch (err) {
        console.error(err);
        toast.error('모토아레나 데이터 추출 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(motoFileObj);
  };

  const handleSaveMotoData = async () => {
    if (!motoData) return;
    try {
      await setDoc(doc(db, 'monthly_records', motoData.yearMonth), {
        motoGuestRev: motoData.motoGuestRev,
        motoGeneralRev: motoData.motoGeneralRev,
        motoInternalRev: motoData.motoInternalRev,
        motoOtherRev: motoData.motoOtherRev,
        motoTotalRev: motoData.motoTotalRev,
        motoBreakdown: motoData.breakdown
      }, { merge: true });
      toast.success(`[${motoData.yearMonth}] 모토아레나 데이터가 성공적으로 저장(병합)되었습니다!`);
      setIsMotoSaved(true);
    } catch (e) {
      toast.error('저장 실패: ' + e.message);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

  if (!isAuthenticated) {
    return (
      <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <form onSubmit={handlePinSubmit} className="glass-panel" style={{padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', width: '100%', maxWidth: '400px', margin: '0 16px'}}>
          <div style={{background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%'}}>
            <Lock size={32} color="var(--accent-gold)" />
          </div>
          <h2 style={{margin: 0}}>관리자 권한 필요</h2>
          <p style={{color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontSize: '14px'}}>
            데이터 업로드 및 삭제는 관리자만 접근할 수 있습니다.
          </p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="비밀번호 4자리"
            style={{
              padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', 
              background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '20px', 
              textAlign: 'center', width: '100%', letterSpacing: '4px'
            }}
            autoFocus
          />
          <button type="submit" className="btn-primary" style={{width: '100%', padding: '12px'}}>
            잠금 해제
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="monthly-data-container">
      <div className="upload-header glass-panel" style={{marginBottom: '20px'}}>
        <h2>엑셀 개별 업로드 시스템</h2>
        <p style={{color: 'var(--text-muted)', marginBottom: '10px'}}>티켓 이름 기준으로 자동 분류하여 데이터를 추출합니다. (서버에 저장되지 않습니다)</p>
        <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-red)', padding: '12px', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px'}}>
          <strong>⚠️ 데이터 덮어쓰기 주의:</strong> 동일한 연/월(예: 2026-06)의 데이터를 중복 업로드하면, <span style={{color: 'var(--accent-red)'}}>기존 데이터가 모두 삭제되고 완전히 덮어씌워집니다.</span><br/>
          반드시 1일부터 말일까지 취합된 <strong>'해당 월 전체 통합 엑셀 파일'</strong>을 월말에 한 번만 업로드해 주세요!
        </div>
      </div>

      <div className="upload-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px'}}>
        
        {/* Room Section */}
        <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', padding: '24px', border: roomData ? '2px solid var(--accent-emerald)' : '1px solid var(--border-glass)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <Hotel size={32} color="var(--accent-blue)" />
            <h3 style={{margin: 0}}>1. 객실 매출 처리</h3>
          </div>
          
          <label className="btn-primary" style={{cursor: 'pointer', textAlign: 'center', marginBottom: '20px'}}>
            <Upload size={18} /> 객실 엑셀 파일 선택
            <input type="file" accept=".xlsx" onChange={handleRoomFileUpload} style={{display: 'none'}} />
          </label>

          {roomData && Array.isArray(roomData) && (
            <div style={{background: 'rgba(52, 211, 153, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-emerald)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-emerald)'}}>데이터 추출 결과 (총 {roomData.length}건)</h4>
              <div style={{maxHeight: '300px', overflowY: 'auto', marginBottom: '16px', paddingRight: '8px'}}>
                {roomData.map(data => (
                  <div key={data.yearMonth} style={{marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed rgba(255,255,255,0.2)'}}>
                    <h5 style={{margin: '0 0 8px 0', color: 'var(--text-bright)'}}>{data.yearMonth}</h5>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span>영업일수</span> <strong>{data.daysCount}일</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span>객실 총 매출</span> <strong style={{color: 'var(--accent-blue)'}}>₩ {formatCurrency(data.totalRoomRevenue)}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span>16/35/51평 판매량</span> <strong>{data.sold16} / {data.sold35} / {data.sold51} 실</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span>예상 투숙객</span> <strong style={{color: 'var(--accent-emerald)'}}>{formatCurrency((data.sold16 * 2) + (data.sold35 * 4) + (data.sold51 * 6))} 명</strong>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={handleSaveRoomData} disabled={isRoomSaved} style={{width: '100%', background: isRoomSaved ? 'var(--accent-emerald)' : 'var(--accent-blue)', display: 'flex', justifyContent: 'center', gap: '8px'}}>
                <Save size={18} /> {isRoomSaved ? '✅ 저장 완료' : '객실 데이터 DB에 저장'}
              </button>
            </div>
          )}
        </div>

        {/* Leisure Section */}
        <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', padding: '24px', border: leisureData ? '2px solid var(--accent-gold)' : '1px solid var(--border-glass)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <Ticket size={32} color="var(--accent-purple)" />
            <h3 style={{margin: 0}}>2. 레저 매출 처리</h3>
          </div>
          
          <label className="btn-primary" style={{cursor: 'pointer', textAlign: 'center', marginBottom: '20px', background: 'var(--accent-purple)'}}>
            <Upload size={18} /> 레저 엑셀 파일 선택
            <input type="file" accept=".xlsx" onChange={handleLeisureFileUpload} style={{display: 'none'}} />
          </label>

          {leisureData && Array.isArray(leisureData) && (
            <div style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>레저 추출 결과 (총 {leisureData.length}건)</h4>
              
              <div style={{maxHeight: '300px', overflowY: 'auto', marginBottom: '16px', paddingRight: '8px'}}>
                {leisureData.map(data => {
                  const check = crossCheckResult?.[data.yearMonth];
                  return (
                    <div key={data.yearMonth} style={{marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed rgba(255,255,255,0.2)'}}>
                      <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>{data.yearMonth} 레저 매출: ₩{formatCurrency(data.totalLeisureSales)}</div>
                      {/* 교차 검증 UI */}
                      {check && (
                          <div style={{
                              padding: '12px', borderRadius: '6px',
                              background: check.hasRecord && !check.isMatch ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                              border: `1px solid ${check.hasRecord && !check.isMatch ? 'var(--accent-red)' : 'var(--accent-emerald)'}`
                          }}>
                              <div style={{fontWeight: 'bold', marginBottom: '4px', color: check.hasRecord && !check.isMatch ? 'var(--accent-red)' : 'var(--accent-emerald)'}}>
                                  ✓ 객실 매출 교차 검증 ({data.yearMonth})
                              </div>
                              {!check.hasRecord ? (
                                  <div style={{fontSize: '13px'}}>DB에 객실 데이터가 없음 (현재 엑셀 ROOM(+OTHER) 합: ₩{formatCurrency(check.parsedRoom)})</div>
                              ) : check.isMatch ? (
                                  <div style={{fontSize: '13px'}}>
                                      <strong>일치함!</strong> (DB 객실: ₩{formatCurrency(check.dbRoom)} / 현재 엑셀 ROOM(+OTHER) 합: ₩{formatCurrency(check.parsedRoom)})
                                  </div>
                              ) : (
                                  <div style={{fontSize: '13px'}}>
                                      <strong>불일치 주의!</strong> 
                                      <br/>- DB 객실총매출: ₩{formatCurrency(check.dbRoom)}
                                      <br/>- 이번 엑셀 ROOM(+OTHER) 합: ₩{formatCurrency(check.parsedRoom)}
                                  </div>
                              )}
                          </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button className="btn-primary" onClick={handleSaveLeisureData} disabled={isLeisureSaved} style={{width: '100%', background: isLeisureSaved ? 'var(--accent-emerald)' : 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black'}}>
                <Save size={18} /> {isLeisureSaved ? '✅ 저장 완료' : `전체 ${leisureData.length}개월 레저 데이터 DB에 일괄 저장`}
              </button>
            </div>
          )}
        </div>

        {/* Moto Arena Section */}
        <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', padding: '24px', border: motoData ? '2px solid var(--accent-gold)' : '1px solid var(--border-glass)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <span style={{fontSize: '32px'}}>🏎️</span>
            <h3 style={{margin: 0}}>3. 모토아레나 티켓 매출 처리</h3>
          </div>
          
          <div style={{display: 'flex', gap: '12px', marginBottom: '20px'}}>
            <input 
              type="month" 
              value={motoTargetMonth}
              onChange={e => setMotoTargetMonth(e.target.value)}
              style={{flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-main)'}}
            />
            <label className="btn-primary" style={{cursor: 'pointer', textAlign: 'center', background: 'var(--accent-gold)', color: 'black', flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              <Upload size={18} /> {motoFileObj ? motoFileObj.name : '모토아레나 엑셀 선택'}
              <input type="file" accept=".xlsx" onChange={handleMotoFileSelect} style={{display: 'none'}} />
            </label>
          </div>

          {motoFileObj && !motoData && (
            <button className="btn-primary" onClick={handleExtractMotoData} style={{width: '100%', marginBottom: '20px', background: 'rgba(59, 130, 246, 0.9)', display: 'flex', justifyContent: 'center', gap: '8px'}}>
              🔍 선택된 엑셀에서 모토아레나 데이터 추출하기
            </button>
          )}

          {motoData && (
            <div style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>추출 결과 ({motoData.yearMonth})</h4>
              
              <div style={{marginBottom: '16px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span>투숙객 매출:</span> <strong>₩{formatCurrency(motoData.motoGuestRev)}</strong>
                </div>
                {motoData.breakdown && Object.keys(motoData.breakdown.guest).length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                    {Object.entries(motoData.breakdown.guest).map(([k, v]) => `${k} (₩${formatCurrency(v)})`).join(' / ')}
                  </div>
                )}
                
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                  <span>일반객 매출:</span> <strong>₩{formatCurrency(motoData.motoGeneralRev)}</strong>
                </div>
                {motoData.breakdown && Object.keys(motoData.breakdown.general).length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                    {Object.entries(motoData.breakdown.general).map(([k, v]) => `${k} (₩${formatCurrency(v)})`).join(' / ')}
                  </div>
                )}

                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                  <span>임직원 매출:</span> <strong>₩{formatCurrency(motoData.motoInternalRev)}</strong>
                </div>
                {motoData.breakdown && Object.keys(motoData.breakdown.internal).length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                    {Object.entries(motoData.breakdown.internal).map(([k, v]) => `${k} (₩${formatCurrency(v)})`).join(' / ')}
                  </div>
                )}
                <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '8px'}}>
                  <span style={{color: 'var(--accent-gold)'}}>총 추출 합계:</span> <strong style={{color: 'var(--accent-gold)'}}>₩{formatCurrency(motoData.motoTotalRev)}</strong>
                </div>
              </div>

              <button className="btn-primary" onClick={handleSaveMotoData} disabled={isMotoSaved} style={{width: '100%', background: isMotoSaved ? 'var(--accent-emerald)' : 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black'}}>
                <Save size={18} /> {isMotoSaved ? '✅ 저장 완료' : '해당 월 모토아레나 DB에 저장'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* History Table */}
      <div className="list-section glass-panel">
        <h3>월별 실적 히스토리 (병합 결과)</h3>
        {records.length === 0 ? (
          <div className="empty-state">등록된 월별 실적이 없습니다. 위 폼을 통해 엑셀을 업로드해 주세요.</div>
        ) : (
          <>
          <div className="table-scroll-container hide-on-mobile">
            <table className="records-table" style={{minWidth: '800px'}}>
              <thead>
                <tr>
                  <th>연/월 (영업일)</th>
                  <th>16평 / 35평 / 51평</th>
                  <th>예상 투숙객</th>
                  <th>주중(객실/레저) 실적</th>
                  <th>주말(객실/레저) 실적</th>
                  <th>객실 총매출</th>
                  <th>레저 총매출</th>
                  <th>모토 총매출<br/><span style={{fontSize:'10px', color:'var(--text-muted)', fontWeight:'normal'}}>(상세 분석)</span></th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const s16 = r.sold16 || r.standardSold || 0;
                  const s35 = r.sold35 || 0;
                  const s51 = r.sold51 || r.connectingSold || 0;
                  const estimatedGuests = (s16 * 2) + (s35 * 4) + (s51 * 6);
                  return (
                  <tr key={r.id}>
                    <td>
                      {r.yearMonth}
                      <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>
                        총 {r.daysCount || 0}일 (주중 {r.daysCountWeekday || 0}일 / 주말 {r.daysCountWeekend || 0}일)
                      </div>
                    </td>
                    <td>
                      <div style={{fontSize: '12px'}}>{formatCurrency(s16)} / {formatCurrency(s35)} / {formatCurrency(s51)} 실</div>
                    </td>
                    <td>
                      <div style={{fontWeight: 'bold', color: 'var(--accent-emerald)'}}>{formatCurrency(estimatedGuests)}명</div>
                      <div style={{fontSize: '10px', color: 'var(--text-muted)'}}>16평x2, 35평x4, 51평x6</div>
                    </td>
                    <td>
                      <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>객: {formatCurrency(r.soldWeekday || 0)}실</div>
                      <div style={{fontSize: '12px', color: 'var(--accent-blue)'}}>객: ₩{formatCurrency(r.revWeekday || 0)}</div>
                      {r.leisureRevWd !== undefined && (
                        <div style={{fontSize: '12px', color: 'var(--accent-gold)', marginTop: '4px'}}>레: ₩{formatCurrency(r.leisureRevWd)}</div>
                      )}
                    </td>
                    <td>
                      <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>객: {formatCurrency(r.soldWeekend || 0)}실</div>
                      <div style={{fontSize: '12px', color: 'var(--accent-purple)'}}>객: ₩{formatCurrency(r.revWeekend || 0)}</div>
                      {r.leisureRevWe !== undefined && (
                        <div style={{fontSize: '12px', color: 'var(--accent-gold)', marginTop: '4px'}}>레: ₩{formatCurrency(r.leisureRevWe)}</div>
                      )}
                    </td>
                    <td style={{color: 'var(--accent-blue)', fontWeight: 'bold'}}>₩ {formatCurrency(r.totalRoomRevenue || 0)}</td>
                    <td style={{color: 'var(--accent-gold)', fontWeight: 'bold'}}>₩ {formatCurrency(r.leisureSales || 0)}</td>
                    <td style={{color: 'var(--text-main)', fontSize: '12px'}}>
                      <div style={{fontWeight: 'bold', fontSize: '14px'}}>₩ {formatCurrency(r.motoTotalRev || 0)}</div>
                      {r.motoTotalRev > 0 && (
                        <div style={{marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px'}}>
                          <span style={{color: 'var(--accent-emerald)'}}>투숙: ₩{formatCurrency(r.motoGuestRev || 0)}</span>
                          {r.motoBreakdown?.guest && Object.keys(r.motoBreakdown.guest).length > 0 && (
                            <div style={{fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', lineHeight: '1.2'}}>
                              {Object.keys(r.motoBreakdown.guest).join(', ')}
                            </div>
                          )}
                          <span style={{color: 'var(--accent-gold)', marginTop: '4px'}}>일반: ₩{formatCurrency(r.motoGeneralRev || 0)}</span>
                          {r.motoBreakdown?.general && Object.keys(r.motoBreakdown.general).length > 0 && (
                            <div style={{fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', lineHeight: '1.2'}}>
                              {Object.keys(r.motoBreakdown.general).join(', ')}
                            </div>
                          )}
                          {(r.motoInternalRev > 0 || r.motoOtherRev > 0) && (
                            <>
                              <span style={{color: 'var(--text-muted)', marginTop: '4px'}}>기타: ₩{formatCurrency((r.motoInternalRev || 0) + (r.motoOtherRev || 0))}</span>
                              {(r.motoBreakdown?.internal || r.motoBreakdown?.other) && (
                                <div style={{fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', lineHeight: '1.2'}}>
                                  {[...(Object.keys(r.motoBreakdown?.internal || {})), ...(Object.keys(r.motoBreakdown?.other || {}))].join(', ')}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn-delete" onClick={() => handleDelete(r.id)} title="이 달의 객실/레저 데이터 모두 삭제">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          <div className="show-on-mobile-block" style={{display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px'}}>
            {records.map(r => {
              const s16 = r.sold16 || r.standardSold || 0;
              const s35 = r.sold35 || 0;
              const s51 = r.sold51 || r.connectingSold || 0;
              const estimatedGuests = (s16 * 2) + (s35 * 4) + (s51 * 6);
              return (
                <div key={r.id} className="glass-panel" style={{padding: '16px', position: 'relative', borderLeft: '4px solid var(--accent-emerald)'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '12px'}}>
                    <div>
                      <div style={{fontSize: '16px', fontWeight: 'bold'}}>{r.yearMonth}</div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>총 {r.daysCount || 0}일 (주중 {r.daysCountWeekday || 0}일 / 주말 {r.daysCountWeekend || 0}일)</div>
                    </div>
                    <button className="btn-delete" onClick={() => handleDelete(r.id)} style={{padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)'}}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: 'var(--text-muted)'}}>판매 객실 (16/35/51)</span>
                      <span>{formatCurrency(s16)} / {formatCurrency(s35)} / {formatCurrency(s51)}실</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: 'var(--text-muted)'}}>예상 투숙객</span>
                      <span style={{color: 'var(--accent-emerald)', fontWeight: 'bold'}}>{formatCurrency(estimatedGuests)}명</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px'}}>
                      <span style={{color: 'var(--accent-blue)'}}>객실 총매출</span>
                      <span style={{fontWeight: 'bold'}}>₩{formatCurrency(r.totalRoomRevenue || 0)}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: 'var(--accent-gold)'}}>레저 총매출</span>
                      <span style={{fontWeight: 'bold'}}>₩{formatCurrency(r.leisureSales || 0)}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}>
                      <span style={{color: 'var(--text-bright)'}}>모토 총매출</span>
                      <span style={{fontWeight: 'bold'}}>₩{formatCurrency(r.motoTotalRev || 0)}</span>
                    </div>
                    {r.motoTotalRev > 0 && (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px'}}>
                         <div style={{display: 'flex', justifyContent: 'space-between'}}>
                           <span style={{color: 'var(--accent-emerald)'}}>투숙: ₩{formatCurrency(r.motoGuestRev || 0)}</span>
                           <span style={{color: 'var(--accent-gold)'}}>일반: ₩{formatCurrency(r.motoGeneralRev || 0)}</span>
                         </div>
                         {(r.motoBreakdown?.guest || r.motoBreakdown?.general) && (
                           <div style={{color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '2px'}}>
                             {[...(Object.keys(r.motoBreakdown?.guest || {})), ...(Object.keys(r.motoBreakdown?.general || {}))].slice(0, 3).join(', ')}...
                           </div>
                         )}
                         {(r.motoInternalRev > 0 || r.motoOtherRev > 0) && (
                            <div style={{display: 'flex', justifyContent: 'flex-start', marginTop: '4px'}}>
                              <span style={{color: 'var(--text-muted)'}}>기타: ₩{formatCurrency((r.motoInternalRev || 0) + (r.motoOtherRev || 0))}</span>
                            </div>
                         )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
