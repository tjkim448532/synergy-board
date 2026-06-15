import React, { useState } from 'react';
import { Upload, Save, Ticket, Users, ArrowRight } from 'lucide-react';
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

// Removed parseExcelDate

export default function LeisureTicketManager({ settings, setSettings, uniqueLocations }) {
  const [fileObj, setFileObj] = useState(null);
  
  // 파싱 단계 상태
  const [rawJsonData, setRawJsonData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  
  // 컬럼 매핑 상태
  const [selectedVenueCol, setSelectedVenueCol] = useState(0);
  const [selectedNameCol, setSelectedNameCol] = useState(1);
  const [selectedQtyCol, setSelectedQtyCol] = useState(2);
  
  const [autoExtractFlag, setAutoExtractFlag] = useState(false);

  // 추출 결과
  const [parsedData, setParsedData] = useState(null);
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // 기본적으로 전월
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isSaved, setIsSaved] = useState(false);

  // 현재 설정에 저장된 레저 티켓 룰
  const rules = settings.leisureTicketRules || {};

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

        let foundHeaderIdx = -1;
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
          const row = jsonData[i] || [];
          const strRow = row.map(c => String(c || '').trim());
          if (strRow.some(c => c.includes('트랜잭션') || c.includes('상품') || c.includes('티켓') || c.includes('영업장'))) {
            foundHeaderIdx = i;
            break;
          }
        }

        if (foundHeaderIdx === -1) foundHeaderIdx = 0;

        const extHeaders = jsonData[foundHeaderIdx].map((h, idx) => h ? String(h).trim() : `(이름 없는 열 ${idx + 1})`);
        
        const savedMapping = settings.leisureColMapping;
        let venueIdx = -1, nameIdx = -1, qtyIdx = -1;

        if (savedMapping) {
          venueIdx = savedMapping.venueCol < extHeaders.length ? savedMapping.venueCol : -1;
          nameIdx = savedMapping.nameCol < extHeaders.length ? savedMapping.nameCol : -1;
          qtyIdx = savedMapping.qtyCol < extHeaders.length ? savedMapping.qtyCol : -1;
        }

        if (venueIdx === -1) venueIdx = extHeaders.findIndex(h => h.includes('영업장') || h.includes('사업장'));
        if (nameIdx === -1) nameIdx = extHeaders.findIndex(h => h.includes('트랜잭션') || h.includes('상품') || h.includes('티켓') || h.includes('품목'));
        if (qtyIdx === -1) qtyIdx = extHeaders.findIndex(h => h === '수량' || h.includes('판매수량') || h.includes('인원'));

        setHeaderRowIdx(foundHeaderIdx);
        setHeaders(extHeaders);
        setRawJsonData(jsonData);
        
        setSelectedVenueCol(venueIdx !== -1 ? venueIdx : 0);
        setSelectedNameCol(nameIdx !== -1 ? nameIdx : (extHeaders.length > 1 ? 1 : 0));
        setSelectedQtyCol(qtyIdx !== -1 ? qtyIdx : (extHeaders.length > 2 ? 2 : 0));

        if (savedMapping) {
          setAutoExtractFlag(true);
        }

      } catch (err) {
        console.error(err);
        toast.error('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; 
  };

  React.useEffect(() => {
    if (autoExtractFlag && rawJsonData && headers.length > 0) {
      executeExtraction();
      setAutoExtractFlag(false);
    }
  }, [autoExtractFlag, rawJsonData, headers]);

  const executeExtraction = () => {
    if (!rawJsonData || headers.length === 0) return;

    try {
      const rawRecords = [];
      const ticketCounts = {}; // { [venue___ticketName]: { venue, ticket, qty } }

      for (let i = headerRowIdx + 1; i < rawJsonData.length; i++) {
        const row = rawJsonData[i];
        if (!row || row.length === 0) continue;

        const vName = String(row[selectedVenueCol] || '').trim();
        const tName = String(row[selectedNameCol] || '').trim();
        
        if (!vName || vName === '소계' || vName === '합계' || vName === '총계' || vName.includes('TOTAL')) continue;
        if (!tName || tName === '소계' || tName === '합계' || tName === '총계') continue;

        const qty = parseSafeInt(row[selectedQtyCol]);
        if (qty === 0) continue; // 수량이 0인 경우는 패스하지만, 마이너스는 취소표일수도 있으므로 일단 포함(절대값 처리 안함)

        const compositeKey = `${vName}___${tName}`;

        rawRecords.push({ venue: vName, ticket: tName, qty });
        
        if (!ticketCounts[compositeKey]) {
          ticketCounts[compositeKey] = { venue: vName, ticket: tName, qty: 0 };
        }
        ticketCounts[compositeKey].qty += qty;
      }

      if (Object.keys(ticketCounts).length === 0) {
        toast.error('추출된 데이터가 없습니다. 열 선택이 올바른지 확인해주세요.');
        return;
      }

      setParsedData({
        records: rawRecords,
        summary: ticketCounts
      });

    } catch (err) {
      console.error(err);
      toast.error('데이터 파싱 중 오류가 발생했습니다.');
    }
  };

  const updateRule = (compositeKey, field, value) => {
    setSettings(prev => ({
      ...prev,
      leisureTicketRules: {
        ...(prev.leisureTicketRules || {}),
        [compositeKey]: {
          ...((prev.leisureTicketRules && prev.leisureTicketRules[compositeKey]) || { count: 1, exclude: false }),
          [field]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!parsedData || !yearMonth) return;

    const venueVisitors = {}; 

    parsedData.records.forEach(r => {
      const compositeKey = `${r.venue}___${r.ticket}`;
      const rule = rules[compositeKey] || { count: 1, exclude: false };
      
      if (rule.exclude) return;

      const peopleCount = r.qty * (Number(rule.count) || 1);
      venueVisitors[r.venue] = (venueVisitors[r.venue] || 0) + peopleCount;
    });

    try {
      await setDoc(doc(db, 'monthly_records', yearMonth), {
        leisureTicketUsage: venueVisitors
      }, { merge: true });

      const colMapping = {
        venueCol: selectedVenueCol,
        nameCol: selectedNameCol,
        qtyCol: selectedQtyCol
      };

      await setDoc(doc(db, 'config', 'mainSettings'), {
        leisureTicketRules: rules,
        leisureColMapping: colMapping
      }, { merge: true });

      setSettings(prev => ({
        ...prev,
        leisureTicketRules: rules,
        leisureColMapping: colMapping
      }));

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
        <h3 style={{margin: 0, fontSize: '18px', color: 'var(--text-main)'}}>매월 레저본부 티켓 이용객 엑셀 업로드</h3>
      </div>
      
      <p style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px'}}>
        매월 다운로드하신 레저본부 엑셀 파일을 업로드하여 영업장과 트랜잭션명(티켓명), 수량을 추출합니다.
      </p>

      <div style={{display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-end'}}>
        <div style={{flex: 1}}>
          <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px'}}>적용 월 선택</label>
          <input 
            type="month" 
            value={yearMonth} 
            onChange={(e) => setYearMonth(e.target.value)} 
            style={{width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none', height: '42px', boxSizing: 'border-box'}} 
          />
        </div>
        <div style={{flex: 2}}>
          <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px'}}>엑셀 파일 업로드</label>
          <label className="btn-primary" style={{cursor: 'pointer', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', height: '42px', margin: 0, boxSizing: 'border-box'}}>
            <Upload size={18} /> {fileObj ? fileObj.name : '레저 엑셀 파일 선택'}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{display: 'none'}} />
          </label>
        </div>
      </div>

      {headers.length > 0 && !parsedData && (
        <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px dashed var(--accent-emerald)', marginBottom: '24px'}}>
          <h4 style={{margin: '0 0 16px 0', color: 'var(--accent-emerald)'}}>엑셀 열(Column) 선택</h4>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px', alignItems: 'flex-end'}}>
            <div>
              <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>영업장 열</label>
              <select 
                value={selectedVenueCol} 
                onChange={(e) => setSelectedVenueCol(Number(e.target.value))}
                style={{width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none'}}
              >
                {headers.map((h, i) => <option key={i} value={i} style={{color: 'black'}}>{i + 1}. {h}</option>)}
              </select>
            </div>

            <div>
              <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>트랜잭션명(티켓) 열</label>
              <select 
                value={selectedNameCol} 
                onChange={(e) => setSelectedNameCol(Number(e.target.value))}
                style={{width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none'}}
              >
                {headers.map((h, i) => <option key={i} value={i} style={{color: 'black'}}>{i + 1}. {h}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>수량 열</label>
              <select 
                value={selectedQtyCol} 
                onChange={(e) => setSelectedQtyCol(Number(e.target.value))}
                style={{width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none'}}
              >
                {headers.map((h, i) => <option key={i} value={i} style={{color: 'black'}}>{i + 1}. {h}</option>)}
              </select>
            </div>
          </div>

          <button className="btn-primary" onClick={executeExtraction} style={{width: '100%', background: 'var(--accent-blue)', display: 'flex', justifyContent: 'center', gap: '8px'}}>
            <ArrowRight size={18} /> 위 설정으로 데이터 추출하기
          </button>
        </div>
      )}

      {parsedData && (
        <div style={{marginTop: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start'}}>
          
          <div style={{flex: 2}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
              <h4 style={{margin: 0, color: 'var(--text-main)'}}>트랜잭션 목록 및 룰 설정 ({yearMonth})</h4>
              <button 
                className="btn-secondary" 
                onClick={() => setParsedData(null)}
                style={{fontSize: '12px', padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer'}}
              >
                엑셀 열(Column) 다시 선택하기
              </button>
            </div>
            <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'auto', maxHeight: '600px', border: '1px solid rgba(255,255,255,0.05)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left'}}>
                <thead style={{position: 'sticky', top: 0, background: 'rgba(15,23,42,0.95)', zIndex: 1}}>
                  <tr>
                    <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>영업장</th>
                    <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>트랜잭션명</th>
                    <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right'}}>수량</th>
                    <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center'}}>1건당 인원수</th>
                    <th style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center'}}>인원 집계 제외</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(parsedData.summary).sort((a,b) => {
                    if (a[1].venue === b[1].venue) return b[1].qty - a[1].qty;
                    return (a[1].venue || '').localeCompare(b[1].venue || '');
                  }).map(([compositeKey, data]) => {
                    const rule = rules[compositeKey] || { count: 1, exclude: false };
                    const isExcluded = rule.exclude;
                    
                    return (
                      <tr key={compositeKey} style={{borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: isExcluded ? 0.4 : 1}}>
                        <td style={{padding: '10px 16px', color: 'var(--accent-blue)'}}>{data.venue}</td>
                        <td style={{padding: '10px 16px', fontWeight: 'bold'}}>{data.ticket}</td>
                        <td style={{padding: '10px 16px', textAlign: 'right'}}>{data.qty.toLocaleString()}</td>
                        <td style={{padding: '10px 16px', textAlign: 'center'}}>
                          <input 
                            type="number" 
                            min="1" 
                            value={rule.count || 1}
                            onChange={(e) => updateRule(compositeKey, 'count', Number(e.target.value))}
                            disabled={isExcluded}
                            style={{
                              width: '50px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                              color: 'white', padding: '4px', borderRadius: '4px', outline: 'none', textAlign: 'center'
                            }}
                          />
                        </td>
                        <td style={{padding: '10px 16px', textAlign: 'center'}}>
                          <label style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
                            <input 
                              type="checkbox" 
                              checked={rule.exclude || false}
                              onChange={(e) => updateRule(compositeKey, 'exclude', e.target.checked)}
                              style={{width: '16px', height: '16px', cursor: 'pointer'}}
                            />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{flex: 1, minWidth: '300px', position: 'sticky', top: '24px'}}>
            <div style={{background: 'rgba(52, 211, 153, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid var(--accent-emerald)'}}>
              <h4 style={{margin: '0 0 16px 0', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Users size={18} /> 그룹별 최종 집계 ({yearMonth})
              </h4>
              <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', wordBreak: 'keep-all'}}>
                왼쪽 표에서 설정한 룰에 따라 각 영업장별 실제 사람 수가 실시간으로 집계됩니다.
              </p>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {Object.entries(parsedData.records.reduce((acc, r) => {
                  const compositeKey = `${r.venue}___${r.ticket}`;
                  const rule = rules[compositeKey] || { count: 1, exclude: false };
                  if (!rule.exclude) {
                    acc[r.venue] = (acc[r.venue] || 0) + (r.qty * (Number(rule.count) || 1));
                  }
                  return acc;
                }, {})).sort((a,b) => b[1] - a[1]).map(([vName, total]) => (
                  <div key={vName} style={{background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'}}>
                    <div style={{fontSize: '13px', color: 'var(--text-main)', wordBreak: 'keep-all'}}>{vName}</div>
                    <strong style={{fontSize: '16px', color: 'var(--accent-emerald)', whiteSpace: 'nowrap'}}>{total.toLocaleString()}명</strong>
                  </div>
                ))}
              </div>

              <button 
                className="btn-primary" 
                onClick={handleSave}
                disabled={isSaved}
                style={{
                  width: '100%', marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px',
                  background: isSaved ? 'var(--accent-emerald)' : 'var(--accent-emerald)', color: '#000',
                  padding: '12px'
                }}
              >
                <Save size={18} /> {isSaved ? '저장 완료' : '위 인원수로 산출 및 저장'}
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
