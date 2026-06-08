import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Upload } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import './MonthlyDataForm.css';

export default function MonthlyDataForm() {
  const [records, setRecords] = useState([]);
  const [newRecord, setNewRecord] = useState({
    yearMonth: '',
    standardSold: '',
    connectingSold: '',
    leisureSales: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'monthly_records'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
      setRecords(data);
    });
    return () => unsub();
  }, []);

  const handleAdd = async () => {
    if (!newRecord.yearMonth || !newRecord.standardSold || !newRecord.connectingSold || !newRecord.leisureSales) return;
    
    const id = Date.now().toString();
    const docData = {
      yearMonth: newRecord.yearMonth,
      standardSold: parseInt(newRecord.standardSold, 10),
      connectingSold: parseInt(newRecord.connectingSold, 10),
      leisureSales: parseInt(newRecord.leisureSales.replace(/,/g, ''), 10)
    };
    
    try {
      await setDoc(doc(db, 'monthly_records', id), docData);
      setNewRecord({ yearMonth: '', standardSold: '', connectingSold: '', leisureSales: '' });
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("데이터 저장 실패");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'monthly_records', id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        const headers = data[0];
        if (!headers) return alert('엑셀 파일이 비어있습니다.');
        
        let dateIdx = headers.findIndex(h => h && h.toString().match(/날짜|연\/월|기준월|년월|Date/));
        let stdIdx = headers.findIndex(h => h && h.toString().match(/일반/));
        let connIdx = headers.findIndex(h => h && h.toString().match(/51평|커넥팅/));
        let salesIdx = headers.findIndex(h => h && h.toString().match(/레저|매출/));
        
        if (dateIdx === -1 || stdIdx === -1 || connIdx === -1 || salesIdx === -1) {
          alert('엑셀 열 제목을 인식할 수 없습니다.\n첫 번째 줄(헤더)에 "날짜", "일반", "51평", "매출" 단어가 포함되어야 합니다.\n예: A열[날짜], B열[일반 판매], C열[51평 판매], D열[매출]');
          return;
        }

        let addedCount = 0;
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[dateIdx]) continue;
          
          let dateStr = row[dateIdx].toString();
          if (!isNaN(dateStr) && Number(dateStr) > 30000) {
             const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
             dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          } else {
             const match = dateStr.match(/(\d+)[^0-9]+(\d+)/);
             if (match) {
               let y = match[1];
               if (y.length === 2) y = '20' + y;
               let m = match[2].padStart(2, '0');
               dateStr = `${y}-${m}`;
             }
          }

          const stdSold = parseInt(row[stdIdx], 10) || 0;
          const connSold = parseInt(row[connIdx], 10) || 0;
          const salesStr = row[salesIdx] ? row[salesIdx].toString().replace(/,/g, '') : '0';
          const leisureSales = parseInt(salesStr, 10) || 0;

          const id = Date.now().toString() + i;
          await setDoc(doc(db, 'monthly_records', id), {
            yearMonth: dateStr,
            standardSold: stdSold,
            connectingSold: connSold,
            leisureSales: leisureSales
          });
          addedCount++;
        }
        
        alert(`성공적으로 ${addedCount}개의 월별 실적 데이터를 업로드했습니다.`);
      } catch (err) {
        console.error(err);
        alert('엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('ko-KR').format(val);
  };

  return (
    <div className="monthly-data-container">
      <div className="form-section glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
          <h3 style={{margin: 0}}>엑셀 자동 업로드</h3>
          <label style={{cursor: 'pointer', background: 'var(--accent-emerald)', padding: '8px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'}}>
            <Upload size={18} />
            .xlsx 엑셀 파일 선택
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{display: 'none'}} />
          </label>
        </div>

        <h3 style={{marginTop: '10px'}}>수동 데이터 추가</h3>
        <div className="input-group-row">
          <div className="input-group">
            <label>해당 연/월</label>
            <input 
              type="month" 
              value={newRecord.yearMonth} 
              onChange={e => setNewRecord({...newRecord, yearMonth: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label>일반 객실 판매 수</label>
            <input 
              type="number" 
              placeholder="예: 300" 
              value={newRecord.standardSold} 
              onChange={e => setNewRecord({...newRecord, standardSold: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label>51평(커넥팅) 판매 수</label>
            <input 
              type="number" 
              placeholder="예: 20" 
              value={newRecord.connectingSold} 
              onChange={e => setNewRecord({...newRecord, connectingSold: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label>레저본부 총 매출 (₩)</label>
            <input 
              type="text" 
              placeholder="예: 1500000000" 
              value={newRecord.leisureSales} 
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                if(val) {
                    setNewRecord({...newRecord, leisureSales: new Intl.NumberFormat('ko-KR').format(val)});
                } else {
                    setNewRecord({...newRecord, leisureSales: ''});
                }
              }} 
            />
          </div>
          <button className="btn-add" onClick={handleAdd}>
            <Plus size={18} /> 추가
          </button>
        </div>
      </div>

      <div className="list-section glass-panel">
        <h3>월별 실적 히스토리</h3>
        {records.length === 0 ? (
          <div className="empty-state">등록된 월별 실적이 없습니다. 위 폼을 통해 기록을 추가해 주세요.</div>
        ) : (
          <table className="records-table">
            <thead>
              <tr>
                <th>연/월</th>
                <th>일반실 판매</th>
                <th>51평 판매</th>
                <th>레저본부 매출</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{r.yearMonth}</td>
                  <td>{r.standardSold}실</td>
                  <td>{r.connectingSold}실</td>
                  <td>{formatCurrency(r.leisureSales)}</td>
                  <td>
                    <button className="btn-delete" onClick={() => handleDelete(r.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
