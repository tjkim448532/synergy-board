import React, { useState, useEffect } from 'react';
import { Upload, Save, Ticket, Users, AlertCircle, Trash2 } from 'lucide-react';
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
    setParsedData(null);
    setIsSaved(false);
    e.target.value = null; // 초기화
  };

  const extractData = () => {
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
          return toast.error('데이터가 비어있습니다.');
        }

        // 헤더 로우 찾기
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
          const row = jsonData[i] || [];
          const strRow = row.map(c => String(c || '').trim());
          if (strRow.some(c => c.includes('상품') || c.includes('티켓') || c.includes('품목') || c.includes('영업장'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          // Fallback: 첫번째 데이터 행을 헤더라고 가정
          headerRowIdx = 0;
        }

        const headers = jsonData[headerRowIdx].map(h => String(h || '').trim());
        
        let dateColIdx = headers.findIndex(h => h.includes('일자') || h.includes('날짜'));
        let nameColIdx = headers.findIndex(h => h.includes('상품') || h.includes('티켓') || h.includes('품목'));
        let qtyColIdx = headers.findIndex(h => h === '수량' || h.includes('판매수량') || h.includes('인원'));

        if (nameColIdx === -1) nameColIdx = 0; // fallback
        if (qtyColIdx === -1) qtyColIdx = headers.length > 1 ? 1 : 0; // fallback

        const rawRecords = [];
        const ticketCounts = {};
        let detectedMonth = '';

        for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const tName = String(row[nameColIdx] || '').trim();
          if (!tName || tName === '소계' || tName === '합계' || tName === '총계') continue;

          const qty = parseSafeInt(row[qtyColIdx]);
          if (qty <= 0) continue;

          let dateStr = null;
          if (dateColIdx !== -1) {
            dateStr = parseExcelDate(row[dateColIdx]);
          }

          if (dateStr && !detectedMonth) {
            detectedMonth = dateStr.substring(0, 7); // YYYY-MM
          }

          rawRecords.push({ ticket: tName, qty, date: dateStr });
          ticketCounts[tName] = (ticketCounts[tName] || 0) + qty;
        }

        if (!detectedMonth) {
          // 날짜 컬럼이 없다면 현재 달력을 기준으로 하거나 유저에게 입력받아야 함. 일단 임시로 이번달 사용.
          const now = new Date();
          detectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          toast('날짜(영업일자) 열을 찾을 수 없어 이번 달 기준으로 추출합니다.');
        }

        setYearMonth(detectedMonth);
        setParsedData({
          records: rawRecords,
          summary: ticketCounts
        });

      } catch (err) {
        console.error(err);
        toast.error('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(fileObj);
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

    // 1. 계산 및 병합
    const venueVisitors = {}; // { [venueName]: totalVisitors }

    parsedData.records.forEach(r => {
      const rule = rules[r.ticket];
      if (!rule || rule.exclude || !rule.venue) return; // 룰이 없거나 제외된 티켓은 패스

      const peopleCount = r.qty * (Number(rule.count) || 1);
      venueVisitors[rule.venue] = (venueVisitors[rule.venue] || 0) + peopleCount;
    });

    try {
      // 2. 월간 DB에 저장 (merge: true)
      await setDoc(doc(db, 'monthly_records', yearMonth), {
        leisureTicketUsage: venueVisitors
      }, { merge: true });

      // 3. 설정에 저장된 룰 DB 업데이트 (설정 영구 저장)
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
        매월 판매된 레저 티켓 엑셀을 업로드하여, 티켓별 <strong>인정 인원 수</strong>와 <strong>소속 영업장</strong>을 연결(매핑)합니다.
      </p>

      <div style={{display: 'flex', gap: '12px', marginBottom: '24px'}}>
        <label className="btn-primary" style={{cursor: 'pointer', flex: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
          <Upload size={18} /> {fileObj ? fileObj.name : '레저 티켓 엑셀 파일 선택'}
          <input type="file" accept=".xlsx" onChange={handleFileUpload} style={{display: 'none'}} />
        </label>
        {fileObj && !parsedData && (
          <button className="btn-primary" onClick={extractData} style={{flex: 1, background: 'var(--accent-blue)'}}>
            엑셀 파싱 및 티켓 목록 추출
          </button>
        )}
      </div>

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
