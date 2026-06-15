import React, { useState, useEffect } from 'react';
import { Upload, Save, Ticket, Users, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Settings.css';

const parseSafeInt = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Math.floor(val);
  const str = val.toString().replace(/,/g, '').trim();
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : parsed;
};

// 엑셀 날짜 파싱 (1900년 기준 시리얼 넘버 또는 YYYY-MM-DD)
const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  let str = val.toString().trim();
  const dateRegex = /^\d{2,4}[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}$/;
  if (dateRegex.test(str)) {
    str = str.replace(/[-./\s]+/g, '-');
    let [y, m, d] = str.split('-');
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return null;
};

export default function LeisureTicketManager({ settings, setSettings, uniqueLocations }) {
  const [fileObj, setFileObj] = useState(null);
  
  // 파싱 단계 상태
  const [rawJsonData, setRawJsonData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  
  // 컬럼 매핑 상태
  const [selectedNameCol, setSelectedNameCol] = useState(0);
  const [selectedQtyCol, setSelectedQtyCol] = useState(1);
  const [selectedDateCol, setSelectedDateCol] = useState(-1);

  // 추출 결과
  const [parsedData, setParsedData] = useState(null);
  const [yearMonth, setYearMonth] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // 현재 설정에 저장된 레저 티켓 룰
  const rules = settings.leisureTicketRules || {};

  // 레저본부 소속 영업장 리스트 추출
  const leisureVenues = uniqueLocations.filter(loc => {
    const group = (settings.locationGroups && settings.locationGroups[loc]) || 'leisure';
    return group === 'leisure';
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setFileObj(file);
    setRawJsonData(null);
    setHeaders([]);
    setParsedData(null);
    setIsSaved(false);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
          return toast.error('데이터가 비어있습니다.');
        }

        // 헤더 로우 찾기
        let foundHeaderIdx = -1;
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
          const row = jsonData[i] || [];
          const strRow = row.map(c => String(c || '').trim());
          if (strRow.some(c => c.includes('상품') || c.includes('티켓') || c.includes('품목') || c.includes('영업장'))) {
            foundHeaderIdx = i;
            break;
          }
        }

        if (foundHeaderIdx === -1) {
          foundHeaderIdx = 0;
        }

        const extHeaders = jsonData[foundHeaderIdx].map((h, idx) => h ? String(h).trim() : `(이름 없는 열 ${idx + 1})`);
        
        let dateIdx = extHeaders.findIndex(h => h.includes('일자') || h.includes('날짜'));
        let nameIdx = extHeaders.findIndex(h => h.includes('상품') || h.includes('티켓') || h.includes('품목'));
        let qtyIdx = extHeaders.findIndex(h => h === '수량' || h.includes('판매수량') || h.includes('인원'));

        setHeaderRowIdx(foundHeaderIdx);
        setHeaders(extHeaders);
        setRawJsonData(jsonData);
        
        setSelectedDateCol(dateIdx);
        setSelectedNameCol(nameIdx !== -1 ? nameIdx : 0);
        setSelectedQtyCol(qtyIdx !== -1 ? qtyIdx : (extHeaders.length > 1 ? 1 : 0));

      } catch (err) {
        console.error(err);
        toast.error('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; // 초기화
  };

  const executeExtraction = () => {
    if (!rawJsonData || headers.length === 0) return;

    try {
      const rawRecords = [];
      const ticketCounts = {};
      let detectedMonth = '';

      for (let i = headerRowIdx + 1; i < rawJsonData.length; i++) {
        const row = rawJsonData[i];
        if (!row || row.length === 0) continue;

        const tName = String(row[selectedNameCol] || '').trim();
        if (!tName || tName === '소계' || tName === '합계' || tName === '총계') continue;

        const qty = parseSafeInt(row[selectedQtyCol]);
        if (qty <= 0) continue;

        let dateStr = null;
        if (selectedDateCol !== -1) {
          dateStr = parseExcelDate(row[selectedDateCol]);
        }

        if (dateStr && !detectedMonth) {
          detectedMonth = dateStr.substring(0, 7); // YYYY-MM
        }

        rawRecords.push({ ticket: tName, qty, date: dateStr });
        ticketCounts[tName] = (ticketCounts[tName] || 0) + qty;
      }

      if (!detectedMonth) {
        const now = new Date();
        detectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        toast('날짜(영업일자) 열을 찾을 수 없어 이번 달 기준으로 추출합니다.');
      }

      if (Object.keys(ticketCounts).length === 0) {
        toast.error('추출된 티켓 데이터가 없습니다. 열 선택이 올바른지 확인해주세요.');
        return;
      }

      setYearMonth(detectedMonth);
      setParsedData({
        records: rawRecords,
        summary: ticketCounts
      });

    } catch (err) {
      console.error(err);
      toast.error('데이터 파싱 중 오류가 발생했습니다.');
    }
  };

  const updateRule = (ticket, field, value) => {
    setSettings(prev => ({
      ...prev,
      leisureTicketRules: {
        ...(prev.leisureTicketRules || {}),
        [ticket]: {
          ...((prev.leisureTicketRules && prev.leisureTicketRules[ticket]) || { venue: '', count: 1, exclude: false }),
          [field]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!parsedData || !yearMonth) return;

    const venueVisitors = {}; 

    parsedData.records.forEach(r => {
      const rule = rules[r.ticket];
      if (!rule || rule.exclude || !rule.venue) return;

      const peopleCount = r.qty * (Number(rule.count) || 1);
      venueVisitors[rule.venue] = (venueVisitors[rule.venue] || 0) + peopleCount;
    });

    try {
      await setDoc(doc(db, 'monthly_records', yearMonth), {
        leisureTicketUsage: venueVisitors
      }, { merge: true });

      await setDoc(doc(db, 'config', 'mainSettings'), {
        leisureTicketRules: rules
      }, { merge: true });

      toast.success(`${yearMonth} 레저본부 이용객 데이터가 성공적으로 저장되었습니다!`);
      setIsSaved(true);
    } catch (e) {
      console.error(e);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '24px', marginTop: '16px'}}>
      
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
        <Ticket color="var(--accent-emerald)" size={24} />
        <h3 style={{margin: 0, fontSize: '18px', color: 'var(--text-main)'}}>매월 레저본부 티켓 이용객 엑셀 업로드 및 그룹핑</h3>
      </div>
      
      <p style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px'}}>
        매월 판매된 레저 티켓 엑셀을 업로드하여, 엑셀의 구조를 파악하고 티켓명과 수량 데이터를 추출합니다.
      </p>

      <div style={{display: 'flex', gap: '12px', marginBottom: '24px'}}>
        <label className="btn-primary" style={{cursor: 'pointer', flex: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
          <Upload size={18} /> {fileObj ? fileObj.name : '레저 티켓 엑셀 파일 선택'}
          <input type="file" accept=".xlsx" onChange={handleFileUpload} style={{display: 'none'}} />
        </label>
      </div>

      {headers.length > 0 && !parsedData && (
        <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px dashed var(--accent-emerald)', marginBottom: '24px'}}>
          <h4 style={{margin: '0 0 16px 0', color: 'var(--accent-emerald)'}}>엑셀 열(Column) 선택</h4>
          <p style={{color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px 0'}}>
            티켓명과 수량 데이터가 들어있는 엑셀의 열(칸)을 각각 선택해주세요.
          </p>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px'}}>
            <div>
              <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px'}}>티켓명 열</label>
              <select 
                value={selectedNameCol} 
                onChange={(e) => setSelectedNameCol(Number(e.target.value))}
                style={{width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none'}}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i} style={{color: 'black'}}>{i + 1}. {h}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px'}}>수량 열</label>
              <select 
                value={selectedQtyCol} 
                onChange={(e) => setSelectedQtyCol(Number(e.target.value))}
                style={{width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none'}}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i} style={{color: 'black'}}>{i + 1}. {h}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px'}}>영업일자 열 (선택)</label>
              <select 
                value={selectedDateCol} 
                onChange={(e) => setSelectedDateCol(Number(e.target.value))}
                style={{width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none'}}
              >
                <option value={-1} style={{color: 'black'}}>-- 선택 안함 (이번 달로 가정) --</option>
                {headers.map((h, i) => (
                  <option key={i} value={i} style={{color: 'black'}}>{i + 1}. {h}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn-primary" onClick={executeExtraction} style={{width: '100%', background: 'var(--accent-blue)', display: 'flex', justifyContent: 'center', gap: '8px'}}>
            <ArrowRight size={18} /> 설정한 열로 데이터 추출하기
          </button>
        </div>
      )}

      {parsedData && (
        <div style={{marginTop: '24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h4 style={{margin: 0, color: 'var(--accent-emerald)'}}>추출 결과 및 규칙 설정 ({yearMonth})</h4>
            <div style={{fontSize: '14px', color: 'var(--text-muted)'}}>
              추출된 고유 티켓 종: <strong style={{color: 'var(--text-main)'}}>{Object.keys(parsedData.summary).length}</strong>개
            </div>
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left'}}>
              <thead>
                <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                  <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>티켓명 (엑셀 항목)</th>
                  <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>판매 수량</th>
                  <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>분류할 레저 영업장</th>
                  <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>1장당 인원수</th>
                  <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>제외 여부</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(parsedData.summary).sort((a,b) => b[1] - a[1]).map(([ticketName, qty]) => {
                  const rule = rules[ticketName] || { venue: '', count: 1, exclude: false };
                  const isExcluded = rule.exclude;
                  
                  return (
                    <tr key={ticketName} style={{borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: isExcluded ? 0.5 : 1}}>
                      <td style={{padding: '12px 16px', fontWeight: 'bold'}}>{ticketName}</td>
                      <td style={{padding: '12px 16px'}}>{qty.toLocaleString()}장</td>
                      <td style={{padding: '12px 16px'}}>
                        <select 
                          value={rule.venue || ''} 
                          onChange={(e) => updateRule(ticketName, 'venue', e.target.value)}
                          disabled={isExcluded}
                          style={{
                            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                            color: 'white', padding: '6px 8px', borderRadius: '4px', width: '100%', outline: 'none'
                          }}
                        >
                          <option value="" style={{color: 'black'}}>-- 영업장 선택 --</option>
                          {leisureVenues.map(loc => (
                            <option key={loc} value={loc} style={{color: 'black'}}>{loc}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{padding: '12px 16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input 
                            type="number" 
                            min="1" 
                            value={rule.count || 1}
                            onChange={(e) => updateRule(ticketName, 'count', Number(e.target.value))}
                            disabled={isExcluded}
                            style={{
                              width: '60px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                              color: 'white', padding: '6px', borderRadius: '4px', outline: 'none', textAlign: 'center'
                            }}
                          />
                          <span style={{fontSize: '12px'}}>명</span>
                        </div>
                      </td>
                      <td style={{padding: '12px 16px', textAlign: 'center'}}>
                        <label style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
                          <input 
                            type="checkbox" 
                            checked={rule.exclude || false}
                            onChange={(e) => updateRule(ticketName, 'exclude', e.target.checked)}
                            style={{width: '18px', height: '18px', cursor: 'pointer'}}
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{background: 'rgba(52, 211, 153, 0.1)', padding: '16px', borderRadius: '8px', marginTop: '24px', border: '1px solid var(--accent-emerald)'}}>
            <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Users size={18} /> 최종 산출 결과 요약 ({yearMonth})
            </h4>
            <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
              {Object.entries(parsedData.records.reduce((acc, r) => {
                const rule = rules[r.ticket];
                if (rule && !rule.exclude && rule.venue) {
                  acc[rule.venue] = (acc[rule.venue] || 0) + (r.qty * (Number(rule.count) || 1));
                }
                return acc;
              }, {})).map(([vName, total]) => (
                <div key={vName} style={{background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '8px', minWidth: '150px'}}>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>{vName} 이용객</div>
                  <strong style={{fontSize: '18px', color: 'var(--accent-emerald)'}}>{total.toLocaleString()}명</strong>
                </div>
              ))}
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={isSaved}
            style={{
              width: '100%', marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px',
              background: isSaved ? 'var(--accent-emerald)' : 'var(--accent-emerald)', color: '#000'
            }}
          >
            <Save size={20} /> {isSaved ? '저장 완료 (DB 적용됨)' : '산출된 이용객 수 저장 및 매핑 룰 업데이트'}
          </button>
        </div>
      )}

    </div>
  );
}
