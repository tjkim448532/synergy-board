const fs = require('fs');
const path = 'src/components/MonthlyDataForm.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update handleExtractMotoData logic
const oldExtract1 = `          if (!motoParsedMap[monthKey]) {
             motoParsedMap[monthKey] = {
                 yearMonth: monthKey,
                 motoGuestRev: 0,
                 motoGeneralRev: 0,
                 motoInternalRev: 0,
                 motoOtherRev: 0,
                 motoTotalRev: 0,
                 breakdown: { guest: {}, general: {}, internal: {}, other: {} }
             };
          }

          const mData = motoParsedMap[monthKey];
          const venueName = venueColIdx !== -1 ? String(row[venueColIdx] || '') : '모토아레나';
          if (venueColIdx !== -1 && !venueName.includes('모토아레나')) continue;

          const txName = row[txColIdx];
          const rev = parseSafeInt(row[revColIdx]);
          
          if (typeof txName === 'string') {
            const upperTx = txName.toUpperCase();
            if (upperTx.includes('TOTAL') || txName.includes('소계') || txName.includes('합계')) continue;
            
            let category = 'other';
            if (txName.includes('콘도') || txName.includes('객실')) {
              mData.motoGuestRev += rev;
              category = 'guest';
            } else if (txName.includes('일반') || txName.includes('증평군민') || txName.includes('MOU') || txName.includes('단체')) {
              mData.motoGeneralRev += rev;
              category = 'general';
            } else if (txName.includes('임직원') || txName.includes('직원동반')) {
              mData.motoInternalRev += rev;
              category = 'internal';
            } else {
              mData.motoOtherRev += rev;
            }
            mData.motoTotalRev += rev;
            
            if (!mData.breakdown[category][txName]) mData.breakdown[category][txName] = 0;
            mData.breakdown[category][txName] += rev;
          }`;

const newExtract1 = `          if (!motoParsedMap[monthKey]) {
             motoParsedMap[monthKey] = {
                 yearMonth: monthKey,
                 venues: {}
             };
          }

          const mData = motoParsedMap[monthKey];
          const venueName = venueColIdx !== -1 ? String(row[venueColIdx] || '').trim() : '모토아레나';
          if (!venueName) continue;
          
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
          const vData = mData.venues[venueName];

          const txName = row[txColIdx];
          const rev = parseSafeInt(row[revColIdx]);
          
          if (typeof txName === 'string') {
            const upperTx = txName.toUpperCase();
            if (upperTx.includes('TOTAL') || txName.includes('소계') || txName.includes('합계')) continue;
            
            let category = 'other';
            if (txName.includes('콘도') || txName.includes('객실')) {
              vData.guestRev += rev;
              category = 'guest';
            } else if (txName.includes('일반') || txName.includes('증평군민') || txName.includes('MOU') || txName.includes('단체')) {
              vData.generalRev += rev;
              category = 'general';
            } else if (txName.includes('임직원') || txName.includes('직원동반')) {
              vData.internalRev += rev;
              category = 'internal';
            } else {
              vData.otherRev += rev;
            }
            vData.totalRev += rev;
            
            if (!vData.breakdown[category][txName]) vData.breakdown[category][txName] = 0;
            vData.breakdown[category][txName] += rev;
          }`;

content = content.replace(oldExtract1, newExtract1);

// 2. Update handleSaveMotoData
const oldSaveMoto = `  const handleSaveMotoData = async () => {
    if (!motoData || !Array.isArray(motoData)) return;
    try {
      for (const mData of motoData) {
         const existingRecord = records.find(r => r.id === mData.yearMonth) || {};
         await setDoc(doc(db, 'monthly_records', mData.yearMonth), {
           ...existingRecord,
           id: mData.yearMonth,
           motoGuestRev: mData.motoGuestRev,
           motoGeneralRev: mData.motoGeneralRev,
           motoInternalRev: mData.motoInternalRev,
           motoOtherRev: mData.motoOtherRev,
           motoTotalRev: mData.motoTotalRev,
           motoBreakdown: mData.breakdown
         });
      }
      toast.success(\`총 \${motoData.length}개월의 모토아레나 데이터가 성공적으로 저장(병합)되었습니다!\`);
      setIsMotoSaved(true);
    } catch (e) {
      toast.error('저장 실패: ' + e.message);
    }
  };`;

const newSaveMoto = `  const handleSaveMotoData = async () => {
    if (!motoData || !Array.isArray(motoData)) return;
    try {
      for (const mData of motoData) {
         const existingRecord = records.find(r => r.id === mData.yearMonth) || {};
         const savePayload = {
           ...existingRecord,
           id: mData.yearMonth,
           venues: {
             ...(existingRecord.venues || {}),
             ...mData.venues
           }
         };
         
         // Backward compatibility for Moto Arena
         const moto = mData.venues['모토아레나'];
         if (moto) {
           savePayload.motoGuestRev = moto.guestRev;
           savePayload.motoGeneralRev = moto.generalRev;
           savePayload.motoInternalRev = moto.internalRev;
           savePayload.motoOtherRev = moto.otherRev;
           savePayload.motoTotalRev = moto.totalRev;
           savePayload.motoBreakdown = moto.breakdown;
         }

         await setDoc(doc(db, 'monthly_records', mData.yearMonth), savePayload);
      }
      toast.success(\`총 \${motoData.length}개월의 데이터가 성공적으로 저장(병합)되었습니다!\`);
      setIsMotoSaved(true);
    } catch (e) {
      toast.error('저장 실패: ' + e.message);
    }
  };`;

content = content.replace(oldSaveMoto, newSaveMoto);

// 3. Update UI section title
content = content.replace(
  `<h3 style={{margin: 0}}>3. 고객군 분리 매출 처리 (모토아레나)</h3>`,
  `<h3 style={{margin: 0}}>3. 영업장별 고객군 분리 매출 처리 (티켓 판매)</h3>`
);

// 4. Update UI rendering
const oldUI = `{motoData && motoData.length > 0 && (
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

const newUI = `{motoData && motoData.length > 0 && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              {motoData.map((mData, idx) => (
                <div key={idx} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                  <h4 style={{margin: '0', color: 'var(--accent-gold)', borderBottom: '1px solid rgba(251, 191, 36, 0.3)', paddingBottom: '8px'}}>추출 결과 ({mData.yearMonth})</h4>
                  {Object.entries(mData.venues).map(([venueName, vData]) => (
                    <div key={venueName} style={{background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-gold)'}}>
                      <h5 style={{margin: '0 0 12px 0', color: 'var(--text-bright)', fontSize: '16px'}}>{venueName}</h5>
                      <div style={{marginBottom: '16px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <span>투숙객 매출:</span> <strong>₩{formatCurrency(vData.guestRev)}</strong>
                        </div>
                        {vData.breakdown && Object.keys(vData.breakdown.guest).length > 0 && (
                          <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                            {Object.entries(vData.breakdown.guest).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                          </div>
                        )}
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                          <span>일반객 매출:</span> <strong>₩{formatCurrency(vData.generalRev)}</strong>
                        </div>
                        {vData.breakdown && Object.keys(vData.breakdown.general).length > 0 && (
                          <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                            {Object.entries(vData.breakdown.general).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                          </div>
                        )}

                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px'}}>
                          <span>임직원 매출:</span> <strong>₩{formatCurrency(vData.internalRev)}</strong>
                        </div>
                        {vData.breakdown && Object.keys(vData.breakdown.internal).length > 0 && (
                          <div style={{fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px'}}>
                            {Object.entries(vData.breakdown.internal).map(([k, v]) => \`\${k} (₩\${formatCurrency(v)})\`).join(' / ')}
                          </div>
                        )}
                        <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '8px'}}>
                          <span style={{color: 'var(--accent-gold)'}}>총 추출 합계:</span> <strong style={{color: 'var(--accent-gold)'}}>₩{formatCurrency(vData.totalRev)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              
              <button className="btn-primary" onClick={handleSaveMotoData} disabled={isMotoSaved} style={{width: '100%', background: isMotoSaved ? 'var(--accent-emerald)' : 'var(--accent-gold)', display: 'flex', justifyContent: 'center', gap: '8px', color: 'black'}}>
                <Save size={18} /> {isMotoSaved ? '✅ 저장 완료' : \`해당 결과 DB에 일괄 저장\`}
              </button>
            </div>
          )}`;

content = content.replace(oldUI, newUI);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully refactored venues in ' + path);
