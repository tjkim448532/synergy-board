import React, { useState, useEffect } from 'react';
import { Save, Link as LinkIcon, RefreshCw, Lock } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Papa from 'papaparse';
import './Settings.css';

export default function Settings({ monthlyData }) {
  const [settings, setSettings] = useState({
    resortName: '시너지 리조트',
    totalRooms: 175,
    connectingRooms51: 85,
    count51AsTwoRooms: true,
    customWeekends: '',
    targetAdr16: 0,
    targetAdr35: 0,
    targetAdr51: 0,
    locationGroups: {}
  });

  const [uniqueLocations, setUniqueLocations] = useState([]);

  const [sheetUrl, setSheetUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '5025') {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 일치하지 않습니다.');
      setPin('');
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'config', 'mainSettings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (monthlyData && monthlyData.length > 0) {
      const locSet = new Set();
      monthlyData.forEach(month => {
        if (month.salesByLocation) Object.keys(month.salesByLocation).forEach(loc => locSet.add(loc));
        if (month.leisureSalesByLocation) Object.keys(month.leisureSalesByLocation).forEach(loc => locSet.add(loc)); // legacy
      });
      setUniqueLocations(Array.from(locSet).sort());
    }
  }, [monthlyData]);

  const handleLocationGroupChange = (loc, group) => {
    setSettings(prev => ({
      ...prev,
      locationGroups: {
        ...(prev.locationGroups || {}),
        [loc]: group
      }
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: (name === 'resortName' || name === 'customWeekends') ? value : Number(value)
    }));
  };

  const handleSave = async () => {
    try {
      const docRef = doc(db, 'config', 'mainSettings');
      await setDoc(docRef, settings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("설정 저장에 실패했습니다.");
    }
  };

  const handleSyncFromSheet = async () => {
    if (!sheetUrl) return alert('구글 시트 링크를 입력해주세요.');
    setIsSyncing(true);
    try {
      const match = sheetUrl.match(/\/d\/(.*?)(\/|$)/);
      if (!match) {
        throw new Error('유효한 구글 시트 링크가 아닙니다.');
      }
      const spreadsheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
      
      Papa.parse(csvUrl, {
        download: true,
        header: true,
        complete: async function(results) {
          const data = results.data;
          const totalRooms = data.filter(row => row['호수']).length;
          const connectingPairs = data.filter(row => row['결합시평형'] === '51평' || row['결합시평형']?.includes('51')).length / 2;
          
          if (totalRooms === 0) {
            alert('데이터를 추출할 수 없습니다. 시트의 첫 번째 행에 "호수", "결합시평형" 열이 있는지 확인해주세요.');
            setIsSyncing(false);
            return;
          }
          
          const newSettings = {
            ...settings,
            totalRooms: totalRooms,
            connectingRooms51: connectingPairs
          };
          
          setSettings(newSettings);
          const docRef = doc(db, 'config', 'mainSettings');
          await setDoc(docRef, newSettings);
          
          alert(`연동 성공!\n- 총 객실 수: ${totalRooms}실\n- 51평 세트: ${connectingPairs}세트\n(DB에 자동 저장되었습니다)`);
          setIsSyncing(false);
          setSheetUrl('');
        },
        error: function(err) {
          console.error(err);
          alert('시트 데이터를 불러오는데 실패했습니다. 시트 접근 권한이 "링크가 있는 모든 사용자"로 공개되어 있는지 확인해 주세요.');
          setIsSyncing(false);
        }
      });
    } catch (e) {
      alert(e.message);
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <div style={{padding: '32px', color: 'white'}}>설정 불러오는 중...</div>;
  }

  // 과거 평균 객단가 계산 (참고용)
  let sumSold16 = 0, sumRev16 = 0;
  let sumSold35 = 0, sumRev35 = 0;
  let sumSold51 = 0, sumRev51 = 0;

  if (monthlyData && monthlyData.length > 0) {
    monthlyData.forEach(d => {
      sumSold16 += (d.sold16 || 0);
      sumRev16 += (d.revenue16 || 0);
      sumSold35 += (d.sold35 || 0);
      sumRev35 += (d.revenue35 || 0);
      sumSold51 += (d.sold51 || 0) + (d.sold51Acc || 0);
      sumRev51 += (d.revenue51 || 0) + (d.revenue51Acc || 0);
    });
  }

  const avgAdr16 = sumSold16 > 0 ? Math.round(sumRev16 / sumSold16) : 0;
  const avgAdr35 = sumSold35 > 0 ? Math.round(sumRev35 / sumSold35) : 0;
  const avgAdr51 = sumSold51 > 0 ? Math.round(sumRev51 / sumSold51) : 0;

  if (!isAuthenticated) {
    return (
      <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <form onSubmit={handlePinSubmit} className="glass-panel" style={{padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', width: '100%', maxWidth: '400px', margin: '0 16px'}}>
          <div style={{background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%'}}>
            <Lock size={32} color="var(--accent-gold)" />
          </div>
          <h2 style={{margin: 0}}>관리자 권한 필요</h2>
          <p style={{color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontSize: '14px'}}>
            환경 설정은 시스템 전체에 영향을 미치므로 관리자만 접근할 수 있습니다.
          </p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="비밀번호 4자리"
            style={{
              padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', 
              background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '20px', 
              textAlign: 'center', width: '100%', letterSpacing: '4px'
            }}
            autoFocus
          />
          <button type="submit" className="btn-primary" style={{width: '100%', padding: '12px'}}>
            잠금 해제
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>기본 정보 설정</h2>
        <p className="settings-desc">콘도의 총 객실 수 등 변동성이 적은 기본 정보를 설정하고 DB 초기값으로 저장합니다.</p>
      </div>

      <div className="settings-card glass-panel">
        <h3 style={{marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
          기본 설정
        </h3>
        <div className="form-group">
          <label htmlFor="resortName">리조트 이름</label>
          <input 
            type="text" 
            id="resortName" 
            name="resortName" 
            value={settings.resortName || ''} 
            onChange={handleChange} 
            placeholder="예: 시너지 리조트"
          />
        </div>

        <div className="form-group">
          <label>객실 인벤토리 고정값</label>
          <div style={{color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px'}}>
            총 객실 수는 <strong>175실</strong>, 51평형(커넥팅) 세트는 <strong>85세트</strong>로 고정되어 있습니다. (장애인 객실 5실 별도)
          </div>
        </div>



        <div className="form-group">
          <label>51평형(커넥팅 룸) 점유율 산정 방식</label>
          <div style={{display: 'flex', gap: '20px', marginTop: '8px'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal'}}>
              <input 
                type="radio" 
                name="count51AsTwoRooms" 
                checked={settings.count51AsTwoRooms !== false} 
                onChange={() => setSettings(p => ({...p, count51AsTwoRooms: true}))}
                style={{width: '18px', height: '18px', accentColor: 'var(--accent-emerald)'}}
              />
              방 2개로 산정 (물리적 객실 기준)
            </label>
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal'}}>
              <input 
                type="radio" 
                name="count51AsTwoRooms" 
                checked={settings.count51AsTwoRooms === false} 
                onChange={() => setSettings(p => ({...p, count51AsTwoRooms: false}))}
                style={{width: '18px', height: '18px', accentColor: 'var(--accent-emerald)'}}
              />
              방 1개로 산정 (단일 판매 단위 기준)
            </label>
          </div>
          <small style={{color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px', display: 'block'}}>
            * 방 2개로 산정 시: 점유율 분모(총 객실)는 설정된 '고정 총 객실 수'를 그대로 사용하며, 판매 객실 수는 51평 판매량 × 2로 계산합니다.<br/>
            * 방 1개로 산정 시: 점유율 분모는 '고정 총 객실 수 - 51평 세트 수'로 줄어들며, 판매 객실 수는 51평 판매량 × 1로 계산합니다.
          </small>
        </div>

        <h3 style={{marginBottom: '20px', marginTop: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
          휴일 및 특수 주말 설정
        </h3>
        <div className="form-group">
          <label htmlFor="customWeekends">특수 주말 (공휴일 전날 등) 지정</label>
          <p style={{color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px'}}>
            금, 토요일이 아니더라도 주말로 간주하여 점유율을 계산할 날짜를 쉼표(,)로 구분하여 입력하세요. (예: 공휴일 전날)
          </p>
          <textarea 
            id="customWeekends" 
            name="customWeekends" 
            value={settings.customWeekends || ''} 
            onChange={handleChange} 
            placeholder="예: 2026-05-04, 2026-09-23"
            style={{width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.05)', color: 'white', resize: 'vertical'}}
          />
        </div>

        <h3 style={{marginBottom: '20px', marginTop: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
          투숙객 매출 비중 설정 (Capture Rate)
        </h3>
        <p className="settings-desc" style={{marginBottom: '16px'}}>
          각 부대시설 총매출 중 '객실 투숙객'이 결제한 비중(%)을 설정합니다. 워크인(비투숙객) 매출을 제외한 <strong>순수 객실 연계 매출(순수 TrevPAR)</strong> 산출에 사용됩니다.
        </p>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="form-group" style={{flex: 1, minWidth: '200px'}}>
            <label htmlFor="captureRateLeisure">레저본부 투숙객 비중 (%)</label>
            <input 
              type="number" 
              id="captureRateLeisure" 
              name="captureRateLeisure" 
              value={settings.captureRateLeisure ?? 90} 
              onChange={handleChange} 
              placeholder="예: 90"
              min="0" max="100"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '200px'}}>
            <label htmlFor="captureRateFnb">식음본부 투숙객 비중 (%)</label>
            <input 
              type="number" 
              id="captureRateFnb" 
              name="captureRateFnb" 
              value={settings.captureRateFnb ?? 80} 
              onChange={handleChange} 
              placeholder="예: 80"
              min="0" max="100"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '200px'}}>
            <label htmlFor="captureRateMoto">모토아레나 투숙객 비중 (%)</label>
            <input 
              type="number" 
              id="captureRateMoto" 
              name="captureRateMoto" 
              value={settings.captureRateMoto ?? 30} 
              onChange={handleChange} 
              placeholder="예: 30"
              min="0" max="100"
            />
          </div>
        </div>

        <h3 style={{marginBottom: '20px', marginTop: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
          목표 객단가(Target ADR) 설정
        </h3>
        <p className="settings-desc" style={{marginBottom: '16px'}}>
          매출 예측(시뮬레이션) 시 사용될 평형별 목표 객단가를 설정합니다. 빈칸이거나 0일 경우 과거 추세선 모델만 사용됩니다.
        </p>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="form-group" style={{flex: 1, minWidth: '200px'}}>
            <label htmlFor="targetAdr16">16평형 목표 객단가</label>
            <div style={{color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px'}}>과거 평균: {avgAdr16.toLocaleString()}원</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                id="targetAdr16" 
                name="targetAdr16" 
                value={settings.targetAdr16 || ''} 
                onChange={handleChange} 
                placeholder="예: 120000"
              />
              <span>원</span>
            </div>
          </div>

          <div className="form-group" style={{flex: 1, minWidth: '200px'}}>
            <label htmlFor="targetAdr35">35평형 목표 객단가</label>
            <div style={{color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px'}}>과거 평균: {avgAdr35.toLocaleString()}원</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                id="targetAdr35" 
                name="targetAdr35" 
                value={settings.targetAdr35 || ''} 
                onChange={handleChange} 
                placeholder="예: 180000"
              />
              <span>원</span>
            </div>
          </div>

          <div className="form-group" style={{flex: 1, minWidth: '200px'}}>
            <label htmlFor="targetAdr51">51평형 목표 객단가</label>
            <div style={{color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px'}}>과거 평균: {avgAdr51.toLocaleString()}원</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                id="targetAdr51" 
                name="targetAdr51" 
                value={settings.targetAdr51 || ''} 
                onChange={handleChange} 
                placeholder="예: 250000"
              />
              <span>원</span>
            </div>
          </div>
        </div>

        <h3 style={{marginBottom: '20px', marginTop: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
          영업장 그룹핑 설정 (동적 분리)
        </h3>
        <p className="settings-desc" style={{marginBottom: '16px'}}>
          데이터베이스에 기록된 모든 영업장을 어떤 본부 매출로 합산할지 결정합니다. '제외'를 선택하면 통계에서 완전히 무시됩니다.
        </p>

        <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px'}}>
          {uniqueLocations.length === 0 ? (
            <div style={{color: 'var(--text-muted)', textAlign: 'center'}}>데이터가 아직 업로드되지 않았습니다.</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {uniqueLocations.map(loc => {
                const currentGroup = (settings.locationGroups && settings.locationGroups[loc]) || 'leisure';
                return (
                  <div key={loc} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
                    <strong style={{fontSize: '16px', flex: 1}}>{loc}</strong>
                    <div style={{display: 'flex', gap: '16px'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: currentGroup === 'leisure' ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'leisure'}
                          onChange={() => handleLocationGroupChange(loc, 'leisure')}
                          style={{accentColor: 'var(--accent-emerald)'}}
                        /> 레저 본부
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: currentGroup === 'fnb' ? 'var(--accent-blue)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'fnb'}
                          onChange={() => handleLocationGroupChange(loc, 'fnb')}
                          style={{accentColor: 'var(--accent-blue)'}}
                        /> 식음 본부
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: currentGroup === 'moto' ? 'var(--accent-gold)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'moto'}
                          onChange={() => handleLocationGroupChange(loc, 'moto')}
                          style={{accentColor: 'var(--accent-gold)'}}
                        /> 모토아레나
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: currentGroup === 'exclude' ? '#ef4444' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'exclude'}
                          onChange={() => handleLocationGroupChange(loc, 'exclude')}
                          style={{accentColor: '#ef4444'}}
                        /> 제외
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="settings-actions" style={{marginTop: '40px'}}>
          <button className="btn-save" onClick={handleSave}>
            <Save size={18} /> 설정 저장하기
          </button>
          {isSaved && <span className="save-message">정상적으로 저장되었습니다.</span>}
        </div>
      </div>
    </div>
  );
}
