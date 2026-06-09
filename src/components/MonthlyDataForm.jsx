import React, { useState, useEffect } from 'react';
import { Save, Trash2, Upload, Hotel, Ticket } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'monthly_records'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth)); // sort desc
      setRecords(data);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(`정말 [${id}] 데이터를 삭제하시겠습니까? (객실과 레저 데이터가 모두 삭제됩니다)`)) return;
    try {
      await deleteDoc(doc(db, 'monthly_records', id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleRoomFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        let headerRowIdx = -1;
        for (let i = 0; i < 10; i++) {
          if (data[i] && data[i].includes('일자') && data[i].includes('객실타입')) {
            headerRowIdx = i;
            break;
          }
        }
        
        if (headerRowIdx === -1) return alert('객실 엑셀 양식을 인식할 수 없습니다. "일자", "객실타입" 열이 포함된 파일을 올려주세요.');
        
        const headers = data[headerRowIdx];
        const dateIdx = headers.findIndex(h => h === '일자');
        const typeIdx = headers.findIndex(h => h === '객실타입');
        const countIdx = headers.findIndex(h => h === '객실수');
        const revIdx = headers.findIndex(h => h === '합계');
        
        const roomParsedMap = {};

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[dateIdx]) continue;
          
          let dateVal = row[dateIdx].toString().trim();
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          
          if (dateRegex.test(dateVal)) {
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

            if (!roomType.includes('16평') && !roomType.includes('35평') && !roomType.includes('51평')) {
               continue;
            }

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
        
        const parsedMonthsArray = Object.values(roomParsedMap).map(m => ({
          ...m,
          daysCount: m.uniqueDates.size,
          daysCountWeekday: m.uniqueWeekdayDates.size,
          daysCountWeekend: m.uniqueWeekendDates.size,
          uniqueDates: undefined,
          uniqueWeekdayDates: undefined,
          uniqueWeekendDates: undefined
        }));

        if (parsedMonthsArray.length === 0) {
           return alert('유효한 날짜가 포함된 행을 찾을 수 없습니다.');
        }

        setRoomData(parsedMonthsArray);

      } catch (err) {
        console.error(err);
        alert('객실 엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const handleLeisureFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        let headerRowIdx = -1;
        let dataStartIdx = -1;
        for (let i = 0; i < 15; i++) {
          if (data[i] && data[i][0] && (data[i][0].toString().includes('일자') || data[i][0].toString().includes('Date'))) {
            // Find the row that actually has the location names.
            // Usually it's the row that has 'ROOM' or many columns.
            if (data[i].includes('ROOM') || data[i].includes('합계')) {
                headerRowIdx = i;
                dataStartIdx = i + 1;
                // If the next row is sub-headers (like Food, Beverage), skip it.
                if (data[i+1] && data[i+1].includes('합계')) {
                    dataStartIdx = i + 2;
                }
                break;
            }
          }
        }
        
        if (headerRowIdx === -1) return alert('새로운 레저 엑셀 양식을 인식할 수 없습니다. "영업일자" 및 "ROOM" 열이 포함된 파일을 올려주세요.');
        
        const headers = data[headerRowIdx];
        const dateIdx = 0;
        const sumIdx = headers.findIndex(h => h && h.toString().includes('합계'));
        const roomIdx = headers.findIndex(h => h && h.toString().toUpperCase() === 'ROOM');
        const roomOtherIdx = headers.findIndex(h => h && h.toString().toUpperCase().replace(/\s/g,'') === 'ROOMOTHER');
        
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
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          
          if (dateRegex.test(dateVal)) {
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
            alert('유효한 날짜 데이터를 찾을 수 없습니다.');
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
        alert('레저 엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
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
      alert(`[${roomData.map(d => d.yearMonth).join(', ')}] 객실 데이터가 성공적으로 저장(병합)되었습니다!`);
      setRoomData(null);
    } catch (e) {
      alert('저장 실패: ' + e.message);
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
      alert(`총 ${leisureData.length}개월의 레저 데이터가 성공적으로 저장(병합)되었습니다!`);
      setLeisureData(null);
      setCrossCheckResult(null);
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val || 0);

  return (
    <div className="monthly-data-container">
      <div className="upload-header glass-panel" style={{marginBottom: '20px'}}>
        <h2>엑셀 개별 업로드 시스템</h2>
        <p style={{color: 'var(--text-muted)'}}>객실과 레저 엑셀을 완전히 분리하여 각각 독립적으로 파싱하고 개별 저장합니다. (서로 덮어쓰지 않습니다)</p>
      </div>

      <div className="upload-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
        
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

          {roomData && (
            <div style={{background: 'rgba(52, 211, 153, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-emerald)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-emerald)'}}>파싱 결과 ({roomData.yearMonth})</h4>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                <span>영업일수</span> <strong>{roomData.daysCount}일</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                <span>객실 총 매출</span> <strong style={{color: 'var(--accent-blue)'}}>₩ {formatCurrency(roomData.totalRoomRevenue)}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                <span>16/35/51평 판매량</span> <strong>{roomData.sold16} / {roomData.sold35} / {roomData.sold51} 실</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
                <span>예상 투숙객</span> <strong style={{color: 'var(--accent-emerald)'}}>{formatCurrency((roomData.sold16 * 2) + (roomData.sold35 * 4) + (roomData.sold51 * 6))} 명</strong>
              </div>
              <button className="btn-primary" onClick={handleSaveRoomData} style={{width: '100%', background: 'var(--accent-emerald)', display: 'flex', justifyContent: 'center', gap: '8px'}}>
                <Save size={18} /> 객실 데이터만 DB에 저장
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
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>파싱 결과 (총 {leisureData.length}개월)</h4>
              
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

              <button className="btn-primary" onClick={handleSaveLeisureData} style={{width: '100%', background: 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black'}}>
                <Save size={18} /> 전체 {leisureData.length}개월 레저 데이터 DB에 일괄 저장
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
          <div style={{overflowX: 'auto'}}>
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
        )}
      </div>
    </div>
  );
}
