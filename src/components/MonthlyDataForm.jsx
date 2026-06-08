import React, { useState, useEffect } from 'react';
import { Save, Trash2, Upload, Hotel, Ticket } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './MonthlyDataForm.css';

export default function MonthlyDataForm() {
  const [records, setRecords] = useState([]);
  const [stagedData, setStagedData] = useState({
    yearMonth: '',
    daysCount: 0,
    sold16: 0,
    sold35: 0,
    sold51: 0,
    revenue16: 0,
    revenue35: 0,
    revenue51: 0,
    totalRoomRevenue: 0,
    leisureSales: 0,
    leisureSalesByLocation: {}
  });
  
  const [roomUploaded, setRoomUploaded] = useState(false);
  const [leisureUploaded, setLeisureUploaded] = useState(false);

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
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
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
        
        if (headerRowIdx === -1) return alert('객실 엑셀 양식을 인식할 수 없습니다. "일자", "객실타입", "객실수", "합계" 열이 포함된 파일을 올려주세요.');
        
        const headers = data[headerRowIdx];
        const dateIdx = headers.findIndex(h => h === '일자');
        const typeIdx = headers.findIndex(h => h === '객실타입');
        const countIdx = headers.findIndex(h => h === '객실수');
        const revIdx = headers.findIndex(h => h === '합계');
        
        let monthStr = '';
        let sold16 = 0;
        let sold35 = 0;
        let sold51 = 0;
        let revenue16 = 0;
        let revenue35 = 0;
        let revenue51 = 0;
        let totalRoomRevenue = 0;
        const uniqueDates = new Set();

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[dateIdx]) continue;
          
          let dateVal = row[dateIdx].toString().trim();
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (dateRegex.test(dateVal)) {
            uniqueDates.add(dateVal);
            if (!monthStr) {
              const parts = dateVal.split('-');
              monthStr = `${parts[0]}-${parts[1]}`;
            }
          }
          
          const roomType = row[typeIdx] ? row[typeIdx].toString() : '';
          const count = parseInt(row[countIdx], 10) || 0;
          const rev = parseInt(row[revIdx], 10) || 0;

          totalRoomRevenue += rev;
          
          if (roomType.includes('16평')) {
            sold16 += count;
            revenue16 += rev;
          } else if (roomType.includes('35평')) {
            sold35 += count;
            revenue35 += rev;
          } else if (roomType.includes('51평')) {
            sold51 += count;
            revenue51 += rev;
          }
        }
        
        setStagedData(prev => ({ 
          ...prev, 
          yearMonth: monthStr || prev.yearMonth, 
          daysCount: uniqueDates.size,
          sold16, sold35, sold51, 
          revenue16, revenue35, revenue51, 
          totalRoomRevenue 
        }));
        setRoomUploaded(true);
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
            // 영업장 열이 있는 행을 우선적으로 찾음
            if (data[i].includes('영업장')) break;
          }
        }
        
        if (headerRowIdx === -1) return alert('레저 엑셀 양식을 인식할 수 없습니다. "합계" 열이 포함된 파일을 올려주세요.');
        
        const headers = data[headerRowIdx];
        const sumIdx = headers.findIndex(h => h === '합계');
        const locIdx = headers.findIndex(h => h === '영업장');
        
        let totalLeisureSales = 0;
        let leisureSalesByLocation = {};

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          
          const sumVal = parseInt(row[sumIdx], 10);
          if (isNaN(sumVal)) continue;

          if (locIdx !== -1 && row[locIdx]) {
            const locName = row[locIdx].toString().trim();
            
            // TOTAL, 합계, 소계 행은 중복 계산을 막기 위해 건너뜁니다
            if (locName.toUpperCase().includes('TOTAL') || locName.includes('합계') || locName.includes('소계')) {
              continue;
            }

            leisureSalesByLocation[locName] = (leisureSalesByLocation[locName] || 0) + sumVal;
            totalLeisureSales += sumVal;
          } else if (locIdx === -1) {
            // 영업장 열이 아예 없는 예외적인 경우에만 무조건 더함 (하지만 총계행 중복 위험 있음)
            totalLeisureSales += sumVal;
          }
        }
        
        setStagedData(prev => ({ ...prev, leisureSales: totalLeisureSales, leisureSalesByLocation }));
        setLeisureUploaded(true);
      } catch (err) {
        console.error(err);
        alert('레저 엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const handleFinalSave = async () => {
    if (!stagedData.yearMonth) {
      const manualMonth = prompt('인식된 연/월이 없습니다. 수동으로 입력해주세요 (예: 2026-01)', '');
      if (!manualMonth) return;
      stagedData.yearMonth = manualMonth;
    }
    
    try {
      await setDoc(doc(db, 'monthly_records', stagedData.yearMonth), stagedData);
      setStagedData({ 
        yearMonth: '', daysCount: 0, 
        sold16: 0, sold35: 0, sold51: 0, 
        revenue16: 0, revenue35: 0, revenue51: 0, totalRoomRevenue: 0, 
        leisureSales: 0, leisureSalesByLocation: {} 
      });
      setRoomUploaded(false);
      setLeisureUploaded(false);
      alert('데이터가 성공적으로 저장되었습니다!');
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val || 0);

  return (
    <div className="monthly-data-container">
      <div className="upload-header glass-panel" style={{marginBottom: '20px'}}>
        <h2>2-Track 엑셀 업로드 시스템</h2>
        <p style={{color: 'var(--text-muted)'}}>객실 매출 엑셀과 레저 매출 엑셀을 각각 업로드하면 하나로 취합되어 저장됩니다.</p>
      </div>

      <div className="upload-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
        {/* Room Upload */}
        <div className={`glass-panel upload-box ${roomUploaded ? 'success' : ''}`} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', border: roomUploaded ? '2px solid var(--accent-emerald)' : '1px dashed var(--border-glass)'}}>
          <Hotel size={48} color={roomUploaded ? 'var(--accent-emerald)' : 'var(--accent-blue)'} style={{marginBottom: '20px'}} />
          <h3 style={{marginBottom: '10px'}}>1. 객실 매출 엑셀 올리기</h3>
          <p style={{color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center'}}>PMS에서 다운받은 일별 객실 매출 엑셀</p>
          <label className="btn-primary" style={{cursor: 'pointer'}}>
            <Upload size={18} /> 파일 선택
            <input type="file" accept=".xlsx" onChange={handleRoomFileUpload} style={{display: 'none'}} />
          </label>
        </div>

        {/* Leisure Upload */}
        <div className={`glass-panel upload-box ${leisureUploaded ? 'success' : ''}`} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', border: leisureUploaded ? '2px solid var(--accent-gold)' : '1px dashed var(--border-glass)'}}>
          <Ticket size={48} color={leisureUploaded ? 'var(--accent-gold)' : 'var(--accent-purple)'} style={{marginBottom: '20px'}} />
          <h3 style={{marginBottom: '10px'}}>2. 레저 매출 엑셀 올리기</h3>
          <p style={{color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center'}}>포스에서 다운받은 레저본부 트랜잭션 엑셀</p>
          <label className="btn-primary" style={{cursor: 'pointer', background: 'var(--accent-purple)'}}>
            <Upload size={18} /> 파일 선택
            <input type="file" accept=".xlsx" onChange={handleLeisureFileUpload} style={{display: 'none'}} />
          </label>
        </div>
      </div>

      {/* Staged Data Preview */}
      {(roomUploaded || leisureUploaded) && (
        <div className="glass-panel" style={{marginBottom: '20px', padding: '24px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid var(--accent-emerald)'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h3 style={{color: 'var(--accent-emerald)', margin: 0}}>파싱 결과 미리보기</h3>
            <button className="btn-primary" onClick={handleFinalSave} style={{background: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Save size={18} /> 이대로 DB에 저장하기
            </button>
          </div>
          
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px'}}>
            <div className="stat-card" style={{flex: '1 1 120px'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>대상 연/월</div>
              <div style={{fontSize: '24px', fontWeight: 'bold'}}>
                {stagedData.yearMonth || '미인식'}
                {stagedData.daysCount > 0 && <span style={{fontSize: '14px', marginLeft: '6px', color: 'var(--text-muted)', fontWeight: 'normal'}}>({stagedData.daysCount}일)</span>}
              </div>
            </div>

            <div className="stat-card" style={{flex: '1 1 150px'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>16평 실적</div>
              <div style={{fontSize: '20px', fontWeight: 'bold'}}>{formatCurrency(stagedData.sold16)}실</div>
              <div style={{fontSize: '14px', color: 'var(--accent-blue)', marginTop: '4px'}}>₩ {formatCurrency(stagedData.revenue16)}</div>
            </div>

            <div className="stat-card" style={{flex: '1 1 150px'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>35평 실적</div>
              <div style={{fontSize: '20px', fontWeight: 'bold'}}>{formatCurrency(stagedData.sold35)}실</div>
              <div style={{fontSize: '14px', color: 'var(--accent-blue)', marginTop: '4px'}}>₩ {formatCurrency(stagedData.revenue35)}</div>
            </div>

            <div className="stat-card" style={{flex: '1 1 150px'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>51평 실적</div>
              <div style={{fontSize: '20px', fontWeight: 'bold'}}>{formatCurrency(stagedData.sold51)}실</div>
              <div style={{fontSize: '14px', color: 'var(--accent-blue)', marginTop: '4px'}}>₩ {formatCurrency(stagedData.revenue51)}</div>
            </div>

            <div className="stat-card" style={{flex: '1 1 200px'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>객실 총 매출</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>₩ {formatCurrency(stagedData.totalRoomRevenue)}</div>
            </div>

            <div className="stat-card" style={{flex: '1 1 300px'}}>
              <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>레저 총 매출</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>₩ {formatCurrency(stagedData.leisureSales)}</div>
              {Object.keys(stagedData.leisureSalesByLocation || {}).length > 0 && (
                <div style={{marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                  {Object.entries(stagedData.leisureSalesByLocation).map(([loc, amt]) => (
                    <span key={loc} style={{fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '3px 6px', borderRadius: '4px', color: '#ccc'}}>
                      {loc}: {formatCurrency(amt)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="list-section glass-panel">
        <h3>월별 실적 히스토리</h3>
        {records.length === 0 ? (
          <div className="empty-state">등록된 월별 실적이 없습니다. 위 폼을 통해 엑셀을 업로드해 주세요.</div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table className="records-table" style={{minWidth: '800px'}}>
              <thead>
                <tr>
                  <th>연/월 (영업일)</th>
                  <th>16평 (실/매출)</th>
                  <th>35평 (실/매출)</th>
                  <th>51평 (실/매출)</th>
                  <th>객실 총매출</th>
                  <th>레저본부 총매출</th>
                  <th>레저 상세 내역</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{r.yearMonth} <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>{r.daysCount ? `(${r.daysCount}일)` : ''}</span></td>
                    <td>
                      <div>{formatCurrency(r.sold16 || r.standardSold)}실</div>
                      <div style={{fontSize: '12px', color: 'var(--accent-blue)'}}>₩{formatCurrency(r.revenue16 || 0)}</div>
                    </td>
                    <td>
                      <div>{formatCurrency(r.sold35 || 0)}실</div>
                      <div style={{fontSize: '12px', color: 'var(--accent-blue)'}}>₩{formatCurrency(r.revenue35 || 0)}</div>
                    </td>
                    <td>
                      <div>{formatCurrency(r.sold51 || r.connectingSold)}실</div>
                      <div style={{fontSize: '12px', color: 'var(--accent-blue)'}}>₩{formatCurrency(r.revenue51 || 0)}</div>
                    </td>
                    <td style={{color: 'var(--accent-blue)', fontWeight: 'bold'}}>₩ {formatCurrency(r.totalRoomRevenue || 0)}</td>
                    <td style={{color: 'var(--accent-gold)', fontWeight: 'bold'}}>₩ {formatCurrency(r.leisureSales || 0)}</td>
                    <td style={{fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={r.leisureSalesByLocation ? Object.entries(r.leisureSalesByLocation).map(([loc, amt]) => `${loc}(${formatCurrency(amt)})`).join(', ') : '-'}>
                      {r.leisureSalesByLocation ? Object.entries(r.leisureSalesByLocation).map(([loc, amt]) => `${loc}: ${formatCurrency(amt)}`).join(', ') : '-'}
                    </td>
                    <td>
                      <button className="btn-delete" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
