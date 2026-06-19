const fs = require('fs');
const path = 'src/components/MonthlyDataForm.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix venueColIdx
content = content.replace(
  `              if (cellStr.includes('일자') || cellStr.includes('날짜') || cellStr.includes('DATE')) {
                dateColIdx = j;
              }
            }`,
  `              if (cellStr.includes('일자') || cellStr.includes('날짜') || cellStr.includes('DATE')) {
                dateColIdx = j;
              }
              if (cellStr.includes('영업장') || cellStr.includes('매장')) {
                venueColIdx = j;
              }
            }`
);

// 2. Fix motoData rendering
const oldUIMoto = `{motoData && (
            <div style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
              <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>추출 결과 ({motoData.yearMonth})</h4>
              
              <div style={{marginBottom: '16px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span>투숙객 매출:</span> <strong>₩{formatCurrency(motoData.motoGuestRev)}</strong>
                </div>
                {motoData.breakdown && Object.keys(motoData.breakdown.guest).length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                    {Object.entries(motoData.breakdown.guest).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                  </div>
                )}
                
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                  <span>일반객 매출:</span> <strong>₩{formatCurrency(motoData.motoGeneralRev)}</strong>
                </div>
                {motoData.breakdown && Object.keys(motoData.breakdown.general).length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                    {Object.entries(motoData.breakdown.general).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                  </div>
                )}

                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                  <span>임직원 매출:</span> <strong>₩{formatCurrency(motoData.motoInternalRev)}</strong>
                </div>
                {motoData.breakdown && Object.keys(motoData.breakdown.internal).length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                    {Object.entries(motoData.breakdown.internal).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
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
          )}`;

const newUIMoto = `{motoData && motoData.length > 0 && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              {motoData.map((mData, idx) => (
                <div key={idx} style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
                  <h4 style={{margin: '0 0 12px 0', color: 'var(--accent-gold)'}}>추출 결과 ({mData.yearMonth})</h4>
                  
                  <div style={{marginBottom: '16px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span>투숙객 매출:</span> <strong>₩{formatCurrency(mData.motoGuestRev)}</strong>
                    </div>
                    {mData.breakdown && Object.keys(mData.breakdown.guest).length > 0 && (
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                        {Object.entries(mData.breakdown.guest).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                      </div>
                    )}
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                      <span>일반객 매출:</span> <strong>₩{formatCurrency(mData.motoGeneralRev)}</strong>
                    </div>
                    {mData.breakdown && Object.keys(mData.breakdown.general).length > 0 && (
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                        {Object.entries(mData.breakdown.general).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                      </div>
                    )}

                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                      <span>임직원 매출:</span> <strong>₩{formatCurrency(mData.motoInternalRev)}</strong>
                    </div>
                    {mData.breakdown && Object.keys(mData.breakdown.internal).length > 0 && (
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                        {Object.entries(mData.breakdown.internal).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                      </div>
                    )}
                    <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '8px'}}>
                      <span style={{color: 'var(--accent-gold)'}}>총 추출 합계:</span> <strong style={{color: 'var(--accent-gold)'}}>₩{formatCurrency(mData.motoTotalRev)}</strong>
                    </div>
                  </div>
                </div>
              ))}
              
              <button className="btn-primary" onClick={handleSaveMotoData} disabled={isMotoSaved} style={{width: '100%', background: isMotoSaved ? 'var(--accent-emerald)' : 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black'}}>
                <Save size={18} /> {isMotoSaved ? '✅ 저장 완료' : \`총 \${motoData.length}개월 모토아레나 DB에 일괄 저장\`}
              </button>
            </div>
          )}`;
          
content = content.replace(oldUIMoto, newUIMoto);

// 3. Fix handleMotoFileSelect year bug
const oldMotoSelect = `    // 파일명에서 1~12월 숫자 추출
    const match = file.name.match(/(\\d+)월?/);
    if (match) {
      let month = parseInt(match[1], 10);
      if (month >= 1 && month <= 12) {
        let year = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        // 만약 현재 1~3월인데, 올리는 엑셀이 10~12월분이라면 작년 데이터일 확률이 높음!
        if (currentMonth <= 3 && month >= 10) {
          year -= 1;
        }
        setMotoTargetMonth(\`\${year}-\${month.toString().padStart(2, '0')}\`);
      }
    }`;
const newMotoSelect = `    // 파일명에서 연도 및 월 추출
    let parsedYear = null;
    let parsedMonth = null;
    const yearMatch = file.name.match(/(\\d{4})[_-]?(?:년)?/);
    if (yearMatch) parsedYear = parseInt(yearMatch[1], 10);
    const monthMatch = file.name.match(/(\\d{1,2})월/);
    if (monthMatch) parsedMonth = parseInt(monthMatch[1], 10);

    if (parsedMonth >= 1 && parsedMonth <= 12) {
      let year = parsedYear;
      if (!year) {
        if (motoTargetMonth) {
          year = parseInt(motoTargetMonth.split('-')[0], 10);
        } else {
          year = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;
          if (currentMonth <= 3 && parsedMonth >= 10) {
            year -= 1;
          }
        }
      }
      setMotoTargetMonth(\`\${year}-\${parsedMonth.toString().padStart(2, '0')}\`);
    }`;

content = content.replace(oldMotoSelect, newMotoSelect);

// 4. Fix handleSaveRoomData ghost data merge
const oldSaveRoom = `         await setDoc(doc(db, 'monthly_records', data.yearMonth), dataToSave, { merge: true });`;
const newSaveRoom = `         let finalSaveData = { ...(existingRecord || {}), ...dataToSave, id: data.yearMonth };
         await setDoc(doc(db, 'monthly_records', data.yearMonth), finalSaveData);`;
content = content.replace(oldSaveRoom, newSaveRoom);

// 5. Fix handleSaveLeisureData ghost data merge
const oldSaveLeisure = `         await setDoc(doc(db, 'monthly_records', data.yearMonth), dataToSave, { merge: true });`;
const newSaveLeisure = `         let finalSaveData = { ...(existingRecord || {}), ...dataToSave, id: data.yearMonth };
         await setDoc(doc(db, 'monthly_records', data.yearMonth), finalSaveData);`;
content = content.replace(oldSaveLeisure, newSaveLeisure);

// 6. Fix handleSaveMotoData ghost data merge
const oldSaveMoto = `         await setDoc(doc(db, 'monthly_records', mData.yearMonth), {
           motoGuestRev: mData.motoGuestRev,
           motoGeneralRev: mData.motoGeneralRev,
           motoInternalRev: mData.motoInternalRev,
           motoOtherRev: mData.motoOtherRev,
           motoTotalRev: mData.motoTotalRev,
           motoBreakdown: mData.breakdown
         }, { merge: true });`;
const newSaveMoto = `         const existingRecord = records.find(r => r.id === mData.yearMonth) || {};
         await setDoc(doc(db, 'monthly_records', mData.yearMonth), {
           ...existingRecord,
           id: mData.yearMonth,
           motoGuestRev: mData.motoGuestRev,
           motoGeneralRev: mData.motoGeneralRev,
           motoInternalRev: mData.motoInternalRev,
           motoOtherRev: mData.motoOtherRev,
           motoTotalRev: mData.motoTotalRev,
           motoBreakdown: mData.breakdown
         });`;
content = content.replace(oldSaveMoto, newSaveMoto);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully refactored ' + path);
