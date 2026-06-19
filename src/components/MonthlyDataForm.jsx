import React, { useState, useEffect } from 'react';
import { Save, Trash2, Upload, Hotel, Ticket, Lock } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
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

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') {
    // 엑셀 시리얼 넘버 (1900년 1월 1일 기준) -> UTC 자정으로 변환됨
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    // 타임존 문제 방지를 위해 반드시 UTC 기준으로 연월일 추출
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  let str = val.toString().trim();
  // 지원: 2024-05-01, 24. 5. 1, 2024/5/1 등
  const dateRegex = /^\d{2,4}[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}$/;
  if (dateRegex.test(str)) {
    str = str.replace(/[-./\s]+/g, '-');
    let [y, m, d] = str.split('-');
    if (y.length === 2) y = `20${y}`; // 24 -> 2024
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return null;
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
        if (doc.id && String(doc.id).match(/^\d{4}-\d{2}$/)) {
          data.push({ id: doc.id, yearMonth: doc.id, ...doc.data() });
        }
      });
      data.sort((a, b) => (b.id || b.yearMonth || '').localeCompare(a.id || a.yearMonth || '')); // sort desc
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
          
          let dateVal = parseExcelDate(row[dateIdx]);
          
          if (dateVal) {
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

        parsedMonthsArray.forEach(m => {
           if (m.daysCount < 28) {
              toast.warning(`[${m.yearMonth}] 총 영업일수가 ${m.daysCount}일 입니다. 누락된 행이 없는지 확인하세요.`);
           }
        });

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
          
          const rowStr = row.map(c => c ? c.toString().replace(/\s+/g, '') : '').join('').toUpperCase();
          if ((rowStr.includes('일자') || rowStr.includes('날짜') || rowStr.includes('DATE')) && 
              (rowStr.includes('ROOM') || rowStr.includes('합계') || rowStr.includes('객실'))) {
            
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
            roomIdx = headers.findIndex(h => h === 'ROOM' || h === 'ROOMS' || h.includes('객실'));
            roomOtherIdx = headers.findIndex(h => h === 'ROOMOTHER' || h.includes('객실수입'));
            
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
          
          let dateVal = parseExcelDate(row[dateIdx]);
          
          if (dateVal) {
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
        
        const parsedMonthsArray = Object.values(monthlyParsedMap).sort((a, b) => (b.id || b.yearMonth || '').localeCompare(a.id || a.yearMonth || ''));
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
         const existingRecord = records.find(r => r.id === data.yearMonth);
         let dataToSave = { ...data };
         
         if (existingRecord?.crossCheckResult) {
            const parsedRoom = existingRecord.crossCheckResult.parsedRoom;
            const dbRoom = data.totalRoomRevenue;
            const isMatch = Math.abs(dbRoom - parsedRoom) < 1000;
            dataToSave.crossCheckResult = {
               ...existingRecord.crossCheckResult,
               dbRoom,
               isMatch,
               hasRecord: true
            };
         }
         
         const docRef = doc(db, 'monthly_records', data.yearMonth);
         const docSnap = await getDoc(docRef);
         if (docSnap.exists()) {
            await updateDoc(docRef, dataToSave);
         } else {
            await setDoc(docRef, { ...dataToSave, id: data.yearMonth });
         }
      }
      toast.success(`[${roomData.map(d => d.yearMonth).join(', ')}] 객실 데이터가 성공적으로 저장(원자적 업데이트)되었습니다!`);
      setIsRoomSaved(true);
    } catch (e) {
      toast.error('저장 실패: ' + e.message);
    }
  };

  const handleSaveLeisureData = async () => {
    if (!leisureData || !Array.isArray(leisureData)) return;
    try {
      for (const data of leisureData) {
         const existingRecord = records.find(r => r.id === data.yearMonth);
         const dbRoom = existingRecord?.totalRoomRevenue || 0;
         const isMatch = Math.abs(dbRoom - data.crossCheckRoomSum) < 1000;

         const dataToSave = {
            yearMonth: data.yearMonth,
            leisureSales: data.totalLeisureSales,
            leisureRevWd: data.leisureRevWd,
            leisureRevWe: data.leisureRevWe,
            leisureSalesByLocation: data.leisureSalesByLocation,
            salesByLocation: data.salesByLocation,
            salesWdByLocation: data.salesWdByLocation,
            salesWeByLocation: data.salesWeByLocation,
            crossCheckResult: {
               dbRoom: dbRoom,
               parsedRoom: data.crossCheckRoomSum,
               isMatch: isMatch,
               hasRecord: !!existingRecord
            }
         };
         const docRef = doc(db, 'monthly_records', data.yearMonth);
         const docSnap = await getDoc(docRef);
         if (docSnap.exists()) {
            await updateDoc(docRef, dataToSave);
         } else {
            await setDoc(docRef, { ...dataToSave, id: data.yearMonth });
         }
      }
      toast.success(`총 ${leisureData.length}개월의 레저 데이터가 성공적으로 저장(원자적 업데이트)되었습니다!`);
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

    // 파일명에서 년도와 월 추출 (예: 25년 1월, 2025년 1월)
    const yearMatch = file.name.match(/(\d{2,4})년/);
    const monthMatch = file.name.match(/(\d+)월?/);
    
    if (monthMatch) {
      let month = parseInt(monthMatch[1], 10);
      if (month >= 1 && month <= 12) {
        setMotoTargetMonth((prev) => {
          let targetYear = new Date().getFullYear();
          
          if (yearMatch) {
            let y = parseInt(yearMatch[1], 10);
            targetYear = y < 100 ? 2000 + y : y;
          } else if (prev) {
            // 사용자가 이미 연도를 변경해둔 상태라면 그 연도 유지
            targetYear = parseInt(prev.split('-')[0], 10);
          } else {
            const currentMonth = new Date().getMonth() + 1;
            // 만약 현재 1~3월인데, 올리는 엑셀이 10~12월분이라면 작년 데이터일 확률이 높음!
            if (currentMonth <= 3 && month >= 10) {
              targetYear -= 1;
            }
          }
          return `${targetYear}-${month.toString().padStart(2, '0')}`;
        });
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
        let dateColIdx = -1;
        let venueColIdx = -1;

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
              if (cellStr.includes('할인') || cellStr.includes('취소') || cellStr.includes('수수료') || cellStr.includes('부가세') || cellStr.includes('봉사료')) {
                // 수익(Revenue) 컬럼으로 오해하지 않도록 스킵
                continue;
              }
              if (cellStr.includes('영업장') || cellStr.includes('업장명') || cellStr.includes('판매부서')) {
                venueColIdx = j; // 영업장 컬럼 분리용
              }
              if (cellStr.includes('순매출') || cellStr.includes('실매출') || cellStr.includes('결제금액') || cellStr === '합계' || cellStr === '매출' || cellStr === '총합계') {
                revColIdx = j; // 정확한 매출 컬럼 캡처 (순매출, 합계 등)
              }
              if (cellStr.includes('일자') || cellStr.includes('날짜') || cellStr.includes('DATE')) {
                dateColIdx = j;
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
             // 매출액 컬럼 추정 (맨 마지막의 숫자 컬럼) - 상위 5줄 검사하여 안전하게
             for(let j = data[1].length - 1; j >= 0; j--) {
                let valid = false;
                for(let k=1; k<=5 && k<data.length; k++) {
                   const testVal = parseInt(String(data[k][j] || '').replace(/,/g, ''), 10);
                   if (!isNaN(testVal) && testVal > 0) {
                      valid = true;
                      break;
                   }
                }
                if (valid) {
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
        
        const motoParsedMap = {};

        for (let i = dataStartIdx; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          
          let monthKey = motoTargetMonth; // 기본값
          let isWe = false;
          if (dateColIdx !== -1) {
             const dVal = parseExcelDate(row[dateColIdx]);
             if (dVal) {
                 monthKey = dVal.substring(0, 7); // yyyy-mm
                 
                 const [yyyy, mm, dd] = dVal.split('-');
                 const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                 const day = d.getDay();
                 const isSatOrSun = (day === 0 || day === 6);
                 const isTodayHoliday = isHoliday(d);
                 const customWeekendsStr = settings?.customWeekends || '';
                 const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);
                 
                 if (customWeekendsArray.includes(dVal) || isSatOrSun || isTodayHoliday) {
                   isWe = true;
                 }
             }
          }

          if (!motoParsedMap[monthKey]) {
             motoParsedMap[monthKey] = {
                 yearMonth: monthKey,
                 venues: {}
             };
          }

          const mData = motoParsedMap[monthKey];
          const rawVenueName = venueColIdx !== -1 ? String(row[venueColIdx] || '') : '모토아레나';
          const venueName = rawVenueName.trim() || '모토아레나';

          if (!mData.venues[venueName]) {
             mData.venues[venueName] = {
                 guestRev: 0,
                 generalRev: 0,
                 internalRev: 0,
                 otherRev: 0,
                 totalRev: 0,
                 breakdown: { guest: {}, general: {}, internal: {}, other: {} }
             };
          }
          const venueData = mData.venues[venueName];

          const txName = row[txColIdx] != null ? String(row[txColIdx]).trim() : '';
          const rev = parseSafeInt(row[revColIdx]);
          
          if (txName) {
            const upperTx = txName.toUpperCase();
            if (upperTx.includes('TOTAL') || txName.includes('소계') || txName.includes('합계')) continue;
            
            let category = 'other';
            if (txName.includes('콘도') || txName.includes('객실')) {
              venueData.guestRev += rev;
              category = 'guest';
            } else if (txName.includes('일반') || txName.includes('증평군민') || txName.includes('MOU') || txName.includes('단체')) {
              venueData.generalRev += rev;
              category = 'general';
            } else if (txName.includes('임직원') || txName.includes('직원동반')) {
              venueData.internalRev += rev;
              category = 'internal';
            } else {
              venueData.otherRev += rev;
            }
            venueData.totalRev += rev;
            
            if (!venueData.breakdown[category][txName]) venueData.breakdown[category][txName] = 0;
            venueData.breakdown[category][txName] += rev;
          }
        }
        
        const parsedMonthsArray = Object.values(motoParsedMap);
        if (parsedMonthsArray.length === 0) {
            toast.error('유효한 데이터를 찾을 수 없습니다.');
            return;
        }

        setMotoData(parsedMonthsArray);

      } catch (err) {
        console.error(err);
        toast.error('모토아레나 데이터 추출 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(motoFileObj);
  };

  const handleSaveMotoData = async () => {
    if (!motoData || !Array.isArray(motoData)) return;
    try {
      for (const mData of motoData) {
         const docRef = doc(db, 'monthly_records', mData.yearMonth);
         const docSnap = await getDoc(docRef);
         
         const existingRecord = docSnap.exists() ? docSnap.data() : {};
         const savePayload = {
            id: mData.yearMonth,
            venues: {
              ...(existingRecord.venues || {}),
              ...mData.venues
            }
         };
         
         // 호환성을 위해 '모토아레나' 데이터가 있으면 루트 레벨 필드에도 복사
         let moto = null;
         for (const key of Object.keys(mData.venues)) {
           if (key.includes('모토아레나')) {
             moto = mData.venues[key];
             break;
           }
         }
         
         if (moto) {
            savePayload.motoGuestRev = moto.guestRev;
            savePayload.motoGeneralRev = moto.generalRev;
            savePayload.motoInternalRev = moto.internalRev;
            savePayload.motoOtherRev = moto.otherRev;
            savePayload.motoTotalRev = moto.totalRev;
            savePayload.motoBreakdown = moto.breakdown;
         }

         if (docSnap.exists()) {
            await updateDoc(docRef, savePayload);
         } else {
            await setDoc(docRef, savePayload);
         }
      }
      toast.success(`총 ${motoData.length}개월의 부대업장(Ticket) 데이터가 성공적으로 저장(원자적 업데이트)되었습니다!`);
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
        <div style={{background: 'rgba(52, 211, 153, 0.1)', border: '1px solid var(--accent-emerald)', padding: '12px', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px'}}>
          <strong>✅ 부분 덮어쓰기 (병합) 지원:</strong> 동일한 연/월의 데이터를 중복 업로드할 경우, <span style={{color: 'var(--accent-emerald)'}}>해당 항목(객실, 레저, 모토 등)만 최신으로 덮어씌워집니다.</span><br/>
          업로드하지 않은 나머지 항목들은 기존 DB에 안전하게 보존되므로, 수정이 필요한 특정 항목의 엑셀만 다시 업로드해 주시면 됩니다.
        </div>
      </div>

      <div className="upload-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px'}}>
        
        {/* Room Section */}
        <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', padding: '24px', border: roomData ? '2px solid var(--accent-emerald)' : '1px solid var(--border-glass)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <Hotel size={32} color="var(--accent-blue)" />
            <h3 style={{margin: 0}}>1. 객실 일일실적 (Daily)</h3>
          </div>
          <p style={{fontSize:'13px', color:'var(--text-muted)', margin:'-10px 0 16px 0'}}>📌 업로드 파일: 날짜별 가동률 및 판매 객실 수가 기록된 일일실적 엑셀 파일</p>
          <div style={{display:'none'}}>
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
                      <span>예상 투숙객</span> <strong style={{color: 'var(--accent-emerald)'}}>{formatCurrency((data.sold16 * 2.5) + (data.sold35 * 4.5) + (data.sold51 * 6))} 명</strong>
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
            <h3 style={{margin: 0}}>2. 부대시설 일일 매출 통합 (Daily)</h3>
          </div>
          <p style={{fontSize:'13px', color:'var(--text-muted)', margin:'-10px 0 16px 0'}}>📌 업로드 파일: 식음, 레저, 모토 등 전체 영업장의 날짜별 결제 내역 엑셀 파일 (주중/주말 자동 분리용)</p>
          <div style={{display:'none'}}>
          </div>
          
          <label className="btn-primary" style={{cursor: 'pointer', textAlign: 'center', marginBottom: '20px', background: 'var(--accent-purple)'}}>
            <Upload size={18} /> 부대매출(통합) 엑셀 파일 선택
            <input type="file" accept=".xlsx" onChange={handleLeisureFileUpload} style={{display: 'none'}} />
          </label>

          {leisureData && Array.isArray(leisureData) && (
            <div style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>부대매출 추출 결과 (총 {leisureData.length}건)</h4>
              
              <div style={{maxHeight: '300px', overflowY: 'auto', marginBottom: '16px', paddingRight: '8px'}}>
                {leisureData.map(data => {
                  const check = crossCheckResult?.[data.yearMonth];
                  return (
                    <div key={data.yearMonth} style={{marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed rgba(255,255,255,0.2)'}}>
                      <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>{data.yearMonth} 부대업장 전체 매출: ₩{formatCurrency(data.totalLeisureSales)}</div>
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
            <h3 style={{margin: 0}}>3. 영업장별 고객군 분리 매출 처리 (티켓 판매)</h3>
          </div>
          <p style={{fontSize:'13px', color:'var(--text-muted)', margin:'-10px 0 16px 0'}}>📌 업로드 파일: 투숙객/일반객 구분을 위한 상세 품목명(트랜잭션)이 포함된 월간 매출 엑셀 파일</p>
          <div style={{display:'none'}}>
          </div>
          
          <div style={{display: 'flex', gap: '12px', marginBottom: '20px'}}>
            <input 
              type="month" 
              value={motoTargetMonth}
              onChange={e => setMotoTargetMonth(e.target.value)}
              style={{flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-main)'}}
            />
            <label className="btn-primary" style={{cursor: 'pointer', textAlign: 'center', background: 'var(--accent-gold)', color: 'black', flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              <Upload size={18} /> {motoFileObj ? motoFileObj.name : '고객분류용 엑셀(월간) 선택'}
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
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>추출 결과 ({motoData.map(d => d.yearMonth).join(', ')})</h4>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                {motoData.map(mData => (
                  <div key={mData.yearMonth} style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <div style={{fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px'}}>
                      📅 {mData.yearMonth}
                    </div>
                    {Object.entries(mData.venues || {}).map(([venueName, venue]) => (
                       <div key={venueName} style={{background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-gold)'}}>
                         <h5 style={{margin: '0 0 8px 0', color: 'var(--text-main)'}}>{venueName}</h5>
                         <div style={{fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                           <div style={{display: 'flex', justifyContent: 'space-between'}}>
                             <span>투숙객 매출:</span> <strong>₩{formatCurrency(venue.guestRev)}</strong>
                           </div>
                           {venue.breakdown && Object.keys(venue.breakdown.guest).length > 0 && (
                             <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                               {Object.entries(venue.breakdown.guest).map(([k, v]) => `${k} (₩${formatCurrency(v)})`).join(' / ')}
                             </div>
                           )}
                           
                           <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                             <span>일반객 매출:</span> <strong>₩{formatCurrency(venue.generalRev)}</strong>
                           </div>
                           {venue.breakdown && Object.keys(venue.breakdown.general).length > 0 && (
                             <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                               {Object.entries(venue.breakdown.general).map(([k, v]) => `${k} (₩${formatCurrency(v)})`).join(' / ')}
                             </div>
                           )}

                           <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                             <span>임직원 매출:</span> <strong>₩{formatCurrency(venue.internalRev)}</strong>
                           </div>
                           {venue.breakdown && Object.keys(venue.breakdown.internal).length > 0 && (
                             <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                               {Object.entries(venue.breakdown.internal).map(([k, v]) => `${k} (₩${formatCurrency(v)})`).join(' / ')}
                             </div>
                           )}
                           <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '8px'}}>
                             <span style={{color: 'var(--accent-gold)'}}>소계:</span> <strong style={{color: 'var(--accent-gold)'}}>₩{formatCurrency(venue.totalRev)}</strong>
                           </div>
                         </div>
                       </div>
                    ))}
                  </div>
                ))}
              </div>

              <button className="btn-primary" onClick={handleSaveMotoData} disabled={isMotoSaved} style={{width: '100%', background: isMotoSaved ? 'var(--accent-emerald)' : 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black', marginTop: '16px'}}>
                <Save size={18} /> {isMotoSaved ? '✅ 저장 완료' : '해당 월 부대업장(Ticket) DB에 저장'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Health Check 관제탑 */}
      <div className="glass-panel" style={{marginBottom: '20px', padding: '24px', border: '1px solid var(--accent-blue)'}}>
        <h3 style={{marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px'}}>
          📊 월별 데이터 무결성 검증 (Health Check)
        </h3>
        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
          {records.length === 0 ? (
            <div style={{color: 'var(--text-muted)'}}>등록된 데이터가 없습니다.</div>
          ) : (
            [...records].sort((a,b) => (b.id || '').localeCompare(a.id || '')).map(r => {
               const hasA = r.daysCount > 0;
               const hasB = r.leisureSales > 0 || r.leisureRevWd > 0;
               const hasC = r.motoTotalRev > 0;
               const check = r.crossCheckResult;
               const isMatch = check?.isMatch;
               
               let statusColor = 'var(--accent-red)';
               if (hasA && hasB && hasC && isMatch) statusColor = 'var(--accent-emerald)';
               else if (hasA && hasB && hasC && !isMatch) statusColor = 'var(--accent-gold)';
               else if (hasA || hasB || hasC) statusColor = 'var(--accent-gold)';
               
               return (
                 <div key={r.id} style={{background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${statusColor}`, width: '220px'}}>
                   <div style={{fontWeight: 'bold', marginBottom: '8px'}}>{r.id}</div>
                   <div style={{fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                     <div style={{display: 'flex', justifyContent: 'space-between'}}>
                       <span>A(객실):</span> <span>{hasA ? '🟢' : '🔴'}</span>
                     </div>
                     <div style={{display: 'flex', justifyContent: 'space-between'}}>
                       <span>B(부대):</span> <span>{hasB ? '🟢' : '🔴'}</span>
                     </div>
                     <div style={{display: 'flex', justifyContent: 'space-between'}}>
                       <span>C(모토):</span> <span>{hasC ? '🟢' : '🔴'}</span>
                     </div>
                     <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px'}}>
                       <span>Cross-check:</span> 
                       <span>{!hasB ? '➖' : (isMatch ? '🟢 일치' : '🔴 오차')}</span>
                     </div>
                   </div>
                 </div>
               );
            })
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
                  <th>모토 총매출<br/><span style={{fontSize: '12px', color:'var(--text-muted)', fontWeight:'normal'}}>(상세 분석)</span></th>
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
                      <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>16평x2.5, 35평x4.5, 51평x6</div>
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
                            <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', lineHeight: '1.2'}}>
                              {Object.keys(r.motoBreakdown.guest).join(', ')}
                            </div>
                          )}
                          <span style={{color: 'var(--accent-gold)', marginTop: '4px'}}>일반: ₩{formatCurrency(r.motoGeneralRev || 0)}</span>
                          {r.motoBreakdown?.general && Object.keys(r.motoBreakdown.general).length > 0 && (
                            <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', lineHeight: '1.2'}}>
                              {Object.keys(r.motoBreakdown.general).join(', ')}
                            </div>
                          )}
                          {(r.motoInternalRev > 0 || r.motoOtherRev > 0) && (
                            <>
                              <span style={{color: 'var(--text-muted)', marginTop: '4px'}}>기타: ₩{formatCurrency((r.motoInternalRev || 0) + (r.motoOtherRev || 0))}</span>
                              {(r.motoBreakdown?.internal || r.motoBreakdown?.other) && (
                                <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', lineHeight: '1.2'}}>
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
                      <span style={{color: 'var(--accent-gold)'}}>부대업장 총매출</span>
                      <span style={{fontWeight: 'bold'}}>₩{formatCurrency(r.leisureSales || 0)}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}>
                      <span style={{color: 'var(--text-bright)'}}>모토 총매출</span>
                      <span style={{fontWeight: 'bold'}}>₩{formatCurrency(r.motoTotalRev || 0)}</span>
                    </div>
                    {r.motoTotalRev > 0 && (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px'}}>
                         <div style={{display: 'flex', justifyContent: 'space-between'}}>
                           <span style={{color: 'var(--accent-emerald)'}}>투숙: ₩{formatCurrency(r.motoGuestRev || 0)}</span>
                           <span style={{color: 'var(--accent-gold)'}}>일반: ₩{formatCurrency(r.motoGeneralRev || 0)}</span>
                         </div>
                         {(r.motoBreakdown?.guest || r.motoBreakdown?.general) && (
                           <div style={{color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px'}}>
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
