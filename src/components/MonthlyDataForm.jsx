import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
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

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('ko-KR').format(val);
  };

  return (
    <div className="monthly-data-container">
      <div className="form-section glass-panel">
        <h3>신규 월별 실적 기록</h3>
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
