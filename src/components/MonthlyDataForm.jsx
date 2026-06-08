import React, { useState, useEffect } from 'react';
import { Save, Trash2, Upload, Hotel, Ticket } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './MonthlyDataForm.css';

import { isHoliday } from 'korean-holidays';

export default function MonthlyDataForm({ settings }) {
  const [records, setRecords] = useState([]);
  
  // 개별 상태로 분리
  const [roomData, setRoomData] = useState(null);
  const [leisureData, setLeisureData] = useState(null);

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
        
        let monthStr = '';
        let sold16 = 0, sold35 = 0, sold51 = 0;
        let revenue16 = 0, revenue35 = 0, revenue51 = 0;
        let totalRoomRevenue = 0;
        
        let soldWeekday = 0, soldWeekend = 0;
        let revWeekday = 0, revWeekend = 0;
        
        const uniqueDates = new Set();
        const uniqueWeekdayDates = new Set();
        const uniqueWeekendDates = new Set();

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[dateIdx]) continue;
          
          let dateVal = row[dateIdx].toString().trim();
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          
          let isWeekend = false;
          
          if (dateRegex.test(dateVal)) {
            uniqueDates.add(dateVal);
            if (!monthStr) {
              const parts = dateVal.split('-');
              monthStr = `${parts[0]}-${parts[1]}`;
            }
            
            // 1. 날짜 파싱
            const [yyyy, mm, dd] = dateVal.split('-');
            // 다음날 계산 (공휴일 전날인지 확인하기 위해)
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            const day = d.getDay();
            
            const nextDay = new Date(d);
            nextDay.setDate(d.getDate() + 1);
            
            // 2. 주말 및 공휴일 조건
            const isFriOrSat = (day === 5 || day === 6);
            // 한국의 공휴일인지 확인 (다음날이 공휴일이면 오늘은 주말 요금)
            const isNextDayHoliday = isHoliday(nextDay);
            
            // 사용자 지정 특수 주말/공휴일 체크 (기존 기능 유지)
            const customWeekendsStr = settings?.customWeekends || '';
            const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);
            
            if (customWeekendsArray.includes(dateVal) || isFriOrSat || isNextDayHoliday) {
              isWeekend = true;
            } else {
              isWeekend = false;
            }
            
            if (isWeekend) {
              uniqueWeekendDates.add(dateVal);
            } else {
              uniqueWeekdayDates.add(dateVal);
            }
          }
          
          const roomType = row[typeIdx] ? row[typeIdx].toString() : '';
          const count = parseInt(row[countIdx], 10) || 0;
          const rev = parseInt(row[revIdx], 10) || 0;

          totalRoomRevenue += rev;
          if (isWeekend) {
            soldWeekend += count;
            revWeekend += rev;
          } else {
            soldWeekday += count;
            revWeekday += rev;
          }
          
          if (roomType.includes('16평')) {
            sold16 += count; revenue16 += rev;
          } else if (roomType.includes('35평')) {
            sold35 += count; revenue35 += rev;
          } else if (roomType.includes('51평')) {
            sold51 += count; revenue51 += rev;
          }
        }
        
        if (!monthStr) {
          monthStr = prompt('연/월을 자동으로 인식하지 못했습니다. 수동으로 입력해주세요 (예: 2026-01)', '');
          if (!monthStr) return;
        }

        setRoomData({
          yearMonth: monthStr,
          daysCount: uniqueDates.size,
          daysCountWeekday: uniqueWeekdayDates.size,
          daysCountWeekend: uniqueWeekendDates.size,
          sold16, sold35, sold51,
          revenue16, revenue35, revenue51,
          totalRoomRevenue,
          soldWeekday, soldWeekend,
          revWeekday, revWeekend
        });

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
        for (let i = 0; i < 10; i++) {
          if (data[i] && data[i].includes('합계')) {
            headerRowIdx = i;
            if (data[i].includes('영업장')) break;
          }
        }
        
        if (headerRowIdx === -1) return alert('레저 엑셀 양식을 인식할 수 없습니다. "합계" 열이 포함된 파일을 올려주세요.');
        
        const headers = data[headerRowIdx];
        const sumIdx = headers.findIndex(h => h === '합계');
        const locIdx = headers.findIndex(h => h === '영업장');
        const dateIdx = headers.findIndex(h => h === '일자');
        
        let totalLeisureSales = 0;
        let leisureRevWd = 0;
        let leisureRevWe = 0;
        let leisureSalesByLocation = {};

        const uniqueDates = new Set();
        const uniqueWdDates = new Set();
        const uniqueWeDates = new Set();

        const mapLocationName = (name) => {
          const n = name.replace(/\s+/g, '');
          if (
            n.includes('미디어아트') || 
            n.includes('미디어기념품') || 
            n.includes('미디여기념품') || 
            n.includes('미디어기프트') || 
            n.includes('미디어카페') ||
            n.includes('미디어가페')
          ) {
            return '미디어아트센터';
          }
          if (
            n.includes('목장체험') || 
            name.trim() === '목장' || 
            n.includes('얼룩말카페')
          ) {
            return '목장';
          }
          return name;
        };

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          
          const sumVal = parseInt(row[sumIdx], 10);
          if (isNaN(sumVal)) continue;

          let isDataRow = false;

          if (locIdx !== -1 && row[locIdx]) {
            const locName = row[locIdx].toString().trim();
            if (locName.toUpperCase().includes('TOTAL') || locName.includes('합계') || locName.includes('소계')) {
              continue;
            }
            const groupedName = mapLocationName(locName);
            leisureSalesByLocation[groupedName] = (leisureSalesByLocation[groupedName] || 0) + sumVal;
            totalLeisureSales += sumVal;
            isDataRow = true;
          } else if (locIdx === -1) {
            totalLeisureSales += sumVal;
            isDataRow = true;
          }

          if (isDataRow && dateIdx !== -1 && row[dateIdx]) {
            let dateVal = row[dateIdx].toString().trim();
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (dateRegex.test(dateVal)) {
              uniqueDates.add(dateVal);
              const [yyyy, mm, dd] = dateVal.split('-');
              const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
              const day = d.getDay();
              
              // 레저 주말: 토(6), 일(0) 및 당일 공휴일 (객실의 공휴일 전날과 다름)
              const isSatOrSun = (day === 0 || day === 6);
              const isTodayHoliday = isHoliday(d);
              
              const customWeekendsStr = settings?.customWeekends || '';
              const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);
              
              let isWe = false;
              if (customWeekendsArray.includes(dateVal) || isSatOrSun || isTodayHoliday) {
                isWe = true;
              }

              if (isWe) {
                uniqueWeDates.add(dateVal);
                leisureRevWe += sumVal;
              } else {
                uniqueWdDates.add(dateVal);
                leisureRevWd += sumVal;
              }
            }
          }
        }
        
        // 날짜 파싱이 전혀 안되었다면 전체를 주중/주말로 어떻게 나눌지 알 수 없음
        if (dateIdx === -1 || uniqueDates.size === 0) {
          console.warn("레저 엑셀에 유효한 '일자' 열이 없어서 주중/주말 분리가 불가능합니다.");
        }
        
        const monthStr = prompt('레저 매출의 연/월을 입력해주세요 (예: 2026-01)', '');
        if (!monthStr) return;

        setLeisureData({
          yearMonth: monthStr,
          leisureSales: totalLeisureSales,
          leisureRevWd: leisureRevWd,
          leisureRevWe: leisureRevWe,
          leisureSalesByLocation
        });

      } catch (err) {
        console.error(err);
        alert('레저 엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveRoomData = async () => {
    if (!roomData) return;
    try {
      await setDoc(doc(db, 'monthly_records', roomData.yearMonth), roomData, { merge: true });
      alert(`[${roomData.yearMonth}] 객실 데이터가 성공적으로 저장(병합)되었습니다!`);
      setRoomData(null);
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  };

  const handleSaveLeisureData = async () => {
    if (!leisureData) return;
    try {
      await setDoc(doc(db, 'monthly_records', leisureData.yearMonth), leisureData, { merge: true });
      alert(`[${leisureData.yearMonth}] 레저 데이터가 성공적으로 저장(병합)되었습니다!`);
      setLeisureData(null);
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

          {leisureData && (
            <div style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>파싱 결과 ({leisureData.yearMonth})</h4>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
                <span>레저 총 매출</span> <strong style={{color: 'var(--accent-gold)', fontSize: '20px'}}>₩ {formatCurrency(leisureData.leisureSales)}</strong>
              </div>
              <button className="btn-primary" onClick={handleSaveLeisureData} style={{width: '100%', background: 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black'}}>
                <Save size={18} /> 레저 데이터만 DB에 저장
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
