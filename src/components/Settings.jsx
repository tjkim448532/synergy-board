import React, { useState, useEffect } from 'react';
import useGoogleSheetVisitors from '../hooks/useGoogleSheetVisitors';
import { Save, Link as LinkIcon, RefreshCw, Lock, ChevronDown, ChevronUp, AlertCircle, TrendingUp, Key, ArrowRight, Shield, DownloadCloud, UploadCloud, PieChart, Activity, Briefcase, Copy, FileText, CheckCircle2, CloudSun } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import LeisureTicketManager from './LeisureTicketManager';
import './Settings.css';
import { getDefaultGroup, calculateGroupedSales } from '../utils/revenueUtils';
import { fetchWeatherForRange } from '../utils/weatherUtils';

const SectionCard = ({ title, description, isExpanded, onToggle, children, actions }) => (
  <div className="settings-card glass-panel" style={{marginBottom: '20px', padding: 0}}>
    <div 
      style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '24px'}}
      onClick={onToggle}
    >
      <div>
        <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '18px'}}>{title}</h3>
        {description && <p style={{margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5'}}>{description}</p>}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
        {actions}
        {isExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
      </div>
    </div>
    {isExpanded && (
      <div style={{padding: '0 24px 24px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px'}}>
        {children}
      </div>
    )}
  </div>
);

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
    locationGroups: {},
    guestWeight16: 2.5,
    guestWeight35: 3.5,
    guestWeight51: 6.0,
    carPeopleWeight: 3.0
  });

  const [uniqueLocations, setUniqueLocations] = useState([]);
  const [uniqueMotoTickets, setUniqueMotoTickets] = useState([]);

  const [sheetUrl, setSheetUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');

  const [expandedSections, setExpandedSections] = useState({
    visitorValidation: true,
    basic: true,
    weekend: false,
    capture: false,
    adr: false,
    advanced: false,
    moto: false,
    capa: false,
    report: true,
    leisureTicket: false,
    weights: false,
    weatherMigration: false
  });

  const [promptCopied, setPromptCopied] = useState(false);
  const [isMigratingWeather, setIsMigratingWeather] = useState(false);

  const toggleSection = (sec) => setExpandedSections(p => ({...p, [sec]: !p[sec]}));

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '5025') {
      setIsAuthenticated(true);
    } else {
      toast.error('비밀번호가 일치하지 않습니다.');
      setPin('');
    }
  };

  const handleWeatherMigration = async () => {
    if (!monthlyData || monthlyData.length === 0) {
      toast.error('마이그레이션할 기존 데이터가 없습니다.');
      return;
    }
    
    setIsMigratingWeather(true);
    const toastId = toast.loading('기존 데이터의 날씨 정보 소급 적용을 시작합니다...');
    
    try {
      let successCount = 0;
      for (const m of monthlyData) {
        if (!m.rawRoomRecords || m.rawRoomRecords.length === 0) continue;
        
        let minDate = null;
        let maxDate = null;
        m.rawRoomRecords.forEach(rec => {
          if (rec.date) {
            if (!minDate || rec.date < minDate) minDate = rec.date;
            if (!maxDate || rec.date > maxDate) maxDate = rec.date;
          }
        });
        
        if (minDate && maxDate) {
          const weatherMap = await fetchWeatherForRange(minDate, maxDate);
          
          const tempMap = {};
          m.rawRoomRecords.forEach(rec => {
            const dateVal = rec.date;
            if (!dateVal) return;
            const roomType = rec.roomType || '';
            const rateType = rec.rateType || '';
            const marketType = rec.marketType || '';
            const agency = rec.agency || '';
            const count = Number(rec.count || 0);
            const rev = Number(rec.revenue || 0);
            const isCancel = rev < 0;
            
            const groupKey = `${dateVal}||${roomType}||${rateType}||${marketType}||${agency}||${isCancel}`;
            if (!tempMap[groupKey]) {
              tempMap[groupKey] = {
                date: dateVal,
                roomType,
                rateType,
                marketType,
                agency,
                count: 0,
                revenue: 0
              };
            }
            tempMap[groupKey].count += count;
            tempMap[groupKey].revenue += rev;
          });
          
          const aggregatedRecords = Object.values(tempMap).filter(rec => rec.count !== 0 || rec.revenue !== 0);
          
          const updatedRawRoomRecords = aggregatedRecords.map(rec => {
            const w = weatherMap[rec.date] || {};
            return {
              ...rec,
              weatherTempMax: w.tempMax !== undefined ? w.tempMax : null,
              weatherTempMin: w.tempMin !== undefined ? w.tempMin : null,
              weatherPrecipitation: w.precipitation !== undefined ? w.precipitation : null,
              weatherDaytimePrecip: w.daytimePrecip !== undefined ? w.daytimePrecip : null,
              weatherNighttimePrecip: w.nighttimePrecip !== undefined ? w.nighttimePrecip : null,
              weatherCode: w.code !== undefined ? w.code : null,
              weatherDesc: w.desc !== undefined ? w.desc : '정보없음'
            };
          });
          
          const docRef = doc(db, 'monthly_records', m.id || m.yearMonth);
          await updateDoc(docRef, { rawRoomRecords: updatedRawRoomRecords });
          successCount++;
        }
      }
      toast.success(`총 ${successCount}개 월의 날씨 데이터가 성공적으로 소급 적용되었습니다.`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('마이그레이션 중 오류가 발생했습니다: ' + err.message, { id: toastId });
    } finally {
      setIsMigratingWeather(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'config', 'mainSettings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const loadedData = docSnap.data();
          if (Array.isArray(loadedData.customWeekends)) {
            loadedData.customWeekends = loadedData.customWeekends.join(', ');
          }
          if (loadedData.guestWeight16 === undefined) loadedData.guestWeight16 = 2.5;
          if (loadedData.guestWeight35 === undefined) loadedData.guestWeight35 = 3.5;
          if (loadedData.guestWeight51 === undefined) loadedData.guestWeight51 = 6.0;
          if (loadedData.carPeopleWeight === undefined) loadedData.carPeopleWeight = 3.0;
          setSettings(loadedData);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const [uniqueLeisureTickets, setUniqueLeisureTickets] = useState([]);

  useEffect(() => {
    if (monthlyData && monthlyData.length > 0) {
      const locSet = new Set();
      const motoSet = new Set();
      const leisureTicketSet = new Set();
      
      monthlyData.forEach(month => {
        if (month.salesByLocation) Object.keys(month.salesByLocation).forEach(loc => locSet.add(loc));
        if (month.leisureSalesByLocation) Object.keys(month.leisureSalesByLocation).forEach(loc => locSet.add(loc)); // legacy
        
        if (month.motoBreakdown) {
          Object.keys(month.motoBreakdown).forEach(category => {
            if (month.motoBreakdown[category]) {
              Object.keys(month.motoBreakdown[category]).forEach(ticket => motoSet.add(ticket));
            }
          });
        }

        if (month.venues) {
          Object.entries(month.venues).forEach(([venue, data]) => {
            if (data.tickets && venue !== '모토아레나' && venue !== 'ROOM' && venue !== 'ROOM OTHER' && venue !== '합계') {
              Object.keys(data.tickets).forEach(ticket => leisureTicketSet.add(`${venue}___${ticket}`));
            }
          });
        }
      });
      
      setUniqueLocations(Array.from(locSet).sort());
      setUniqueMotoTickets(Array.from(motoSet).sort());
      setUniqueLeisureTickets(Array.from(leisureTicketSet).sort());
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

  const handleMotoTicketGroupChange = (ticket, group) => {
    setSettings(prev => ({
      ...prev,
      motoTicketGroups: {
        ...(prev.motoTicketGroups || {}),
        [ticket]: group
      }
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    const totalRooms = Number(settings.totalRooms) || 0;
    const connectingRooms51 = Number(settings.connectingRooms51) || 0;
    if (totalRooms < 0 || connectingRooms51 < 0) {
      toast.error("방의 개수는 음수가 될 수 없습니다.");
      return;
    }
    if (totalRooms < connectingRooms51) {
      toast.error("총 객실 수는 51평 세트 수보다 크거나 같아야 합니다.");
      return;
    }
    try {
      const payload = { ...settings };
      if (typeof payload.customWeekends === 'string') {
        payload.customWeekends = payload.customWeekends.split(',').map(s => s.trim()).filter(s => s);
      }
      
      const numFields = [
        'totalRooms', 'connectingRooms51', 'targetAdr16', 'targetAdr35', 'targetAdr51',
        'guestWeight16', 'guestWeight35', 'guestWeight51', 'carPeopleWeight',
        'captureRateLeisure', 'captureRateFnb', 'captureRateMoto',
        'capaLeisure', 'capaMoto', 'capaFnb'
      ];
      numFields.forEach(field => {
        if (payload[field] !== undefined) {
          const num = Number(payload[field]);
          payload[field] = isNaN(num) ? 0 : num;
        }
      });

      const docRef = doc(db, 'config', 'mainSettings');
      await setDoc(docRef, payload);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      toast.success("설정이 저장되었습니다.");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("설정 저장에 실패했습니다.");
    }
  };

  const handleSyncFromSheet = async () => {
    if (!sheetUrl) return toast.error('구글 시트 링크를 입력해주세요.');
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
            toast.error('데이터를 추출할 수 없습니다. 시트의 첫 번째 행에 "호수", "결합시평형" 열이 있는지 확인해주세요.');
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
          
          toast.success(`연동 성공!\n- 총 객실 수: ${totalRooms}실\n- 51평 세트: ${connectingPairs}세트\n(DB에 자동 저장되었습니다)`);
          setIsSyncing(false);
          setSheetUrl('');
        },
        error: function(err) {
          console.error(err);
          toast.error('시트 데이터를 불러오는데 실패했습니다. 시트 접근 권한이 "링크가 있는 모든 사용자"로 공개되어 있는지 확인해 주세요.');
          setIsSyncing(false);
        }
      });
    } catch (error) {
      console.error("Error reading sheet:", error);
      toast.error('오류가 발생했습니다: ' + error.message);
      setIsSyncing(false);
    }
  };

  const handleAiEstimate = () => {
    if (!monthlyData || monthlyData.length < 2) {
      toast.error("상관관계를 분석하기 위해 최소 2개월 이상의 데이터가 필요합니다.");
      return;
    }

    const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
    const physicalRooms = Number(settings.totalRooms) || 175;
    const rooms51Sets = Number(settings.connectingRooms51) || 85;
    const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);
    const locationGroups = settings.locationGroups || {};

    let dataPoints = monthlyData.map(d => {
      const [year, month] = d.id.split('-');
      const days = new Date(year, month, 0).getDate();
      const totalInventory = dailyInventory * days;

      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const sold51Acc = Number(d.sold51Acc || 0);
      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51) + sold51Acc;
      
      const occRate = totalInventory > 0 ? (totalSold / totalInventory) * 100 : 0;

      let leisureSales = 0;
      let motoSales = 0;
      let fnbSales = 0;

      if (d.salesByLocation || d.leisureSalesByLocation || d.venues) {
        const salesObj = { ...(d.salesByLocation || d.leisureSalesByLocation || {}) };
        
        if (d.motoTotalRev && !salesObj['모토아레나']) {
          salesObj['모토아레나(티켓)'] = Number(d.motoTotalRev);
        }

        if (d.venues && !salesObj['모토아레나']) {
          Object.entries(d.venues).forEach(([vName, vData]) => {
            const ignoreList = ['모토아레나', 'ROOM', 'ROOM OTHER', '합계'];
            if (!ignoreList.includes(vName) && !salesObj[vName]) { 
              salesObj[`${vName}(티켓)`] = Number(vData.totalRev || 0);
            }
          });
        }

        const calculated = calculateGroupedSales(salesObj, locationGroups);
        leisureSales = calculated.leisure;
        motoSales = calculated.moto || 0;
        fnbSales = calculated.fnb;
      } else {
        leisureSales = Number(d.totalLeisureSales || d.leisureSales || 0);
        motoSales = Number(d.motoSales || d.motoTotalRev || d.totalMotoSales || 0);
        fnbSales = Number(d.fnbSales || d.totalFnbSales || 0);
      }

      return { occRate, leisureSales, motoSales, fnbSales };
    });

    const calculateCaptureRate = (yKey) => {
      const n = dataPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      dataPoints.forEach(p => {
        sumX += p.occRate;
        sumY += p[yKey];
        sumXY += p.occRate * p[yKey];
        sumX2 += p.occRate * p.occRate;
      });

      const denominator = (n * sumX2 - sumX * sumX);
      if (denominator === 0) return null;
      
      const slope = (n * sumXY - sumX * sumY) / denominator;
      
      const avgOcc = sumX / n;
      const avgY = sumY / n;
      
      if (avgY <= 0) return 0;
      
      let captureRate = (slope * avgOcc) / avgY;
      captureRate = Math.max(0, Math.min(1, captureRate));
      return Math.round(captureRate * 100);
    };

    const estLeisure = calculateCaptureRate('leisureSales');
    const estFnb = calculateCaptureRate('fnbSales');
    const estMoto = calculateCaptureRate('motoSales');

    if (estLeisure === null) {
      toast.error("데이터 편차가 부족하여 회귀 분석을 수행할 수 없습니다.");
      return;
    }

    if (window.confirm(`📊 [AI 데이터 기반 추정 결과]\n\n업로드된 전체 엑셀 데이터를 선형 회귀 분석한 결과, 다음의 투숙객 매출 비중(Capture Rate)이 가장 통계적으로 유력합니다:\n\n- 레저본부 투숙객 비중: ${estLeisure}%\n- 식음 부문 투숙객 비중: ${estFnb}%\n- 모토아레나 투숙객 비중: ${estMoto}%\n\n이 추정값을 설정에 덮어쓰고 적용하시겠습니까?`)) {
      setSettings(prev => ({
        ...prev,
        captureRateLeisure: estLeisure,
        captureRateFnb: estFnb,
        captureRateMoto: estMoto
      }));
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
      <div className="settings-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <h2>기본 정보 설정</h2>
          <p className="settings-desc">콘도의 총 객실 수 등 분석 기준값을 설정하고 DB에 저장합니다.</p>
        </div>
        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave} style={{padding: '10px 20px', fontSize: '15px'}}>
            <Save size={18} /> 전체 설정 저장하기
          </button>
          {isSaved && <span className="save-message" style={{display: 'block', marginTop: '8px', textAlign: 'right'}}>정상적으로 저장되었습니다.</span>}
        </div>
      </div>

      <SectionCard
        title="기본 설정"
        description="리조트명, 고정 객실 수 및 51평형 점유율 산정 방식을 설정합니다."
        isExpanded={expandedSections.basic}
        onToggle={() => toggleSection('basic')}
      >
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
      </SectionCard>

      <SectionCard
        title="투숙객 및 차량 가중치 설정"
        description="평형별 예상 투숙객 및 차량당 탑승 인원 가중치를 설정합니다."
        isExpanded={expandedSections.weights}
        onToggle={() => toggleSection('weights')}
      >
        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="guestWeight16">16평형 투숙객 가중치 (명/실)</label>
            <input 
              type="number" 
              step="0.1"
              id="guestWeight16" 
              name="guestWeight16" 
              value={settings.guestWeight16 ?? 2.5} 
              onChange={handleChange} 
              placeholder="기본값: 2.5"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="guestWeight35">35평형 투숙객 가중치 (명/실)</label>
            <input 
              type="number" 
              step="0.1"
              id="guestWeight35" 
              name="guestWeight35" 
              value={settings.guestWeight35 ?? 3.5} 
              onChange={handleChange} 
              placeholder="기본값: 3.5"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="guestWeight51">51평형 투숙객 가중치 (명/실)</label>
            <input 
              type="number" 
              step="0.1"
              id="guestWeight51" 
              name="guestWeight51" 
              value={settings.guestWeight51 ?? 6.0} 
              onChange={handleChange} 
              placeholder="기본값: 6.0"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="carPeopleWeight">차량당 탑승 인원 가중치 (명/대)</label>
            <input 
              type="number" 
              step="0.1"
              id="carPeopleWeight" 
              name="carPeopleWeight" 
              value={settings.carPeopleWeight ?? 3.0} 
              onChange={handleChange} 
              placeholder="기본값: 3.0"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="휴일 및 특수 주말 설정"
        description="금, 토요일이 아니더라도 주말로 간주하여 점유율을 계산할 날짜를 지정합니다."
        isExpanded={expandedSections.weekend}
        onToggle={() => toggleSection('weekend')}
      >
        <div className="form-group">
          <textarea 
            id="customWeekends" 
            name="customWeekends" 
            value={settings.customWeekends || ''} 
            onChange={handleChange} 
            placeholder="예: 2026-05-04, 2026-09-23"
            style={{width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.05)', color: 'white', resize: 'vertical'}}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="투숙객 매출 비중 설정 (Capture Rate)"
        description="각 부대시설 총매출 중 '객실 투숙객'이 결제한 비중(%)을 설정합니다. (순수 TrevPAR 산출용)"
        isExpanded={expandedSections.capture}
        onToggle={() => toggleSection('capture')}
        actions={
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); handleAiEstimate(); }} 
            className="action-button primary" 
            style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', fontSize: '13px'}}
          >
            <RefreshCw size={14} /> AI 추정
          </button>
        }
      >
        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="captureRateLeisure">레저본부 투숙객 비중 (%)</label>
            <input 
              type="number" 
              id="captureRateLeisure" 
              name="captureRateLeisure" 
              value={settings.captureRateLeisure ?? 85} 
              onChange={handleChange} 
              placeholder="예: 90"
              min="0" max="100"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="captureRateFnb">식음 부문 투숙객 비중 (%)</label>
            <input 
              type="number" 
              id="captureRateFnb" 
              name="captureRateFnb" 
              value={settings.captureRateFnb ?? 75} 
              onChange={handleChange} 
              placeholder="예: 80"
              min="0" max="100"
            />
          </div>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
            <label htmlFor="captureRateMoto">모토아레나 투숙객 비중 (%)</label>
            <input 
              type="number" 
              id="captureRateMoto" 
              name="captureRateMoto" 
              value={settings.captureRateMoto ?? 25} 
              onChange={handleChange} 
              placeholder="예: 30"
              min="0" max="100"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="목표 객단가(Target ADR) 설정"
        description="매출 예측(시뮬레이션) 시 사용될 평형별 목표 객단가를 설정합니다. 빈칸일 경우 추세선 모델이 자동 적용됩니다."
        isExpanded={expandedSections.adr}
        onToggle={() => toggleSection('adr')}
      >
        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
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
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
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
          <div className="form-group" style={{flex: 1, minWidth: '150px'}}>
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
      </SectionCard>

      <SectionCard
        title="영업장 그룹핑 설정 (동적 분리)"
        description="데이터베이스에 기록된 모든 영업장을 어떤 부문 매출로 합산할지 결정합니다."
        isExpanded={expandedSections.location}
        onToggle={() => toggleSection('location')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left: Editor */}
          <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px'}}>
          {uniqueLocations.length === 0 ? (
            <div style={{color: 'var(--text-muted)', textAlign: 'center'}}>데이터가 아직 업로드되지 않았습니다.</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {uniqueLocations.map(loc => {
                const currentGroup = (settings.locationGroups && settings.locationGroups[loc]) || getDefaultGroup(loc);
                return (
                  <div key={loc} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
                    <strong style={{fontSize: '16px', flex: '1 1 150px'}}>{loc}</strong>
                    <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap', flex: '2 1 auto'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', color: currentGroup === 'leisure' ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          value="leisure"
                          checked={currentGroup === 'leisure'}
                          onChange={() => handleLocationGroupChange(loc, 'leisure')}
                          style={{accentColor: 'var(--accent-emerald)'}}
                        /> 레저본부
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', color: currentGroup === 'fnb' ? 'var(--accent-blue)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'fnb'}
                          onChange={() => handleLocationGroupChange(loc, 'fnb')}
                          style={{accentColor: 'var(--accent-blue)'}}
                        /> 식음 부문
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', color: currentGroup === 'moto' ? 'var(--accent-gold)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'moto'}
                          onChange={() => handleLocationGroupChange(loc, 'moto')}
                          style={{accentColor: 'var(--accent-gold)'}}
                        /> 모토아레나
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', color: currentGroup === 'golf' ? '#22c55e' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'golf'}
                          onChange={() => handleLocationGroupChange(loc, 'golf')}
                          style={{accentColor: '#22c55e'}}
                        /> 골프 부문
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', color: currentGroup === 'other' ? '#64748b' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${loc}`} 
                          checked={currentGroup === 'other'}
                          onChange={() => handleLocationGroupChange(loc, 'other')}
                          style={{accentColor: '#64748b'}}
                        /> 기타 부문
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', color: currentGroup === 'exclude' ? '#ef4444' : 'var(--text-muted)'}}>
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

          {/* Right: Preview Pane */}
          {uniqueLocations.length > 0 && (
            <div style={{background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px', position: 'sticky', top: '20px'}}>
              <h4 style={{marginTop: 0, marginBottom: '16px', color: 'var(--text-bright)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                👁️ 그룹핑 결과 미리보기
              </h4>
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                {[
                  { id: 'leisure', title: '레저본부', color: 'var(--accent-emerald)' },
                  { id: 'fnb', title: '식음 부문', color: 'var(--accent-blue)' },
                  { id: 'moto', title: '모토아레나', color: 'var(--accent-gold)' },
                  { id: 'golf', title: '골프 부문', color: '#22c55e' },
                  { id: 'other', title: '기타 부문', color: '#64748b' },
                  { id: 'exclude', title: '제외됨', color: '#ef4444' }
                ].map(group => {
                  const items = uniqueLocations.filter(loc => {
                    const g = (settings.locationGroups && settings.locationGroups[loc]) || getDefaultGroup(loc);
                    return g === group.id;
                  });
                  
                  if (items.length === 0) return null;
                  
                  return (
                    <div key={group.id}>
                      <div style={{fontSize: '13px', color: group.color, fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between'}}>
                        <span>{group.title}</span>
                        <span style={{background: `${group.color}20`, padding: '2px 8px', borderRadius: '10px', fontSize: '12px'}}>{items.length}곳</span>
                      </div>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                        {items.map(item => (
                          <span key={item} style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${group.color}40`, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-main)'}}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="모토아레나 티켓 그룹핑 설정 (동적 분리)"
        description="모토아레나 티켓 매출을 어떤 분류로 합산할지 결정합니다. (자동 분류 규칙 적용 중)"
        isExpanded={expandedSections.moto}
        onToggle={() => toggleSection('moto')}
      >
        <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px'}}>
          {uniqueMotoTickets.length === 0 ? (
            <div style={{color: 'rgba(255,255,255,0.5)', textAlign: 'center'}}>업로드된 모토아레나 티켓 데이터가 없습니다.</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {uniqueMotoTickets.map(ticket => {
                let group = 'other';
                if (settings.motoTicketGroups?.[ticket]) {
                  group = settings.motoTicketGroups[ticket];
                } else {
                  if (ticket.includes('콘도') || ticket.includes('객실') || ticket.includes('패키지')) {
                    group = 'guest';
                  } else if (ticket.includes('일반') || ticket.includes('증평') || ticket.includes('단체')) {
                    group = 'general';
                  }
                }
                
                return (
                  <div key={ticket} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
                    <strong style={{fontSize: '15px', flex: 1, color: 'var(--text-bright)'}}>{ticket}</strong>
                    <div style={{display: 'flex', gap: '16px'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: group === 'guest' ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${ticket}`}
                          checked={group === 'guest'}
                          onChange={() => handleMotoTicketGroupChange(ticket, 'guest')}
                          style={{accentColor: 'var(--accent-emerald)'}}
                        />
                        투숙객
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: group === 'general' ? 'var(--accent-blue)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${ticket}`}
                          checked={group === 'general'}
                          onChange={() => handleMotoTicketGroupChange(ticket, 'general')}
                          style={{accentColor: 'var(--accent-blue)'}}
                        />
                        비투숙객
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: group === 'other' ? 'var(--accent-coral)' : 'var(--text-muted)'}}>
                        <input 
                          type="radio" 
                          name={`group_${ticket}`}
                          checked={group === 'other'}
                          onChange={() => handleMotoTicketGroupChange(ticket, 'other')}
                          style={{accentColor: 'var(--accent-coral)'}}
                        />
                        기타
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="신규 사업 시뮬레이터 가동률(Capa) 설정"
        description="현재 각 시설의 가동률을 설정하여, 신규 객실 증가에 따른 창출 매출 상한선을 제한합니다."
        isExpanded={expandedSections.capa}
        onToggle={() => toggleSection('capa')}
      >
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'}}>
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px'}}>
            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-muted)'}}>식음(F&B) 부문 가동률</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                name="capaFnb"
                value={settings.capaFnb || ''} 
                onChange={handleChange}
                placeholder="예: 80"
                min="0" max="100"
                style={{width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff'}}
              />
              <span style={{color: 'var(--text-muted)'}}>%</span>
            </div>
          </div>
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px'}}>
            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-muted)'}}>레저본부 가동률</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                name="capaLeisure"
                value={settings.capaLeisure || ''} 
                onChange={handleChange}
                placeholder="예: 70"
                min="0" max="100"
                style={{width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff'}}
              />
              <span style={{color: 'var(--text-muted)'}}>%</span>
            </div>
          </div>
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px'}}>
            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-muted)'}}>모토아레나 가동률</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                name="capaMoto"
                value={settings.capaMoto || ''} 
                onChange={handleChange}
                placeholder="예: 60"
                min="0" max="100"
                style={{width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff'}}
              />
              <span style={{color: 'var(--text-muted)'}}>%</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="영업장별 사용인원 축출 설정"
        description="영업장별로 판매된 트랜잭션 중, 실제 이용객 수를 산출할 기준 트랜잭션을 선택합니다."
        isExpanded={expandedSections.leisureTicket}
        onToggle={() => toggleSection('leisureTicket')}
      >
        <LeisureTicketManager 
          settings={settings} 
          setSettings={setSettings} 
          uniqueLocations={uniqueLocations} 
          uniqueLeisureTickets={uniqueLeisureTickets}
        />
      </SectionCard>

      <SectionCard
        title="AI 경영 보고서 프롬프트 추출 (PPT 생성용)"
        description="현재 데이터를 기반으로 ChatGPT, Claude, Gamma(PPT) 등에 붙여넣을 수 있는 맥킨지 스타일의 프롬프트를 복사합니다."
        isExpanded={expandedSections.report}
        onToggle={() => toggleSection('report')}
      >
        <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <p style={{color: 'var(--text-muted)', fontSize: '14px', margin: 0}}>
              아래 버튼을 클릭하여 전체 실적과 맥킨지 스타일 전략 제안이 결합된 프롬프트를 복사하세요.<br/>
              복사한 텍스트를 AI 툴에 붙여넣으면 즉시 5장짜리 경영 보고서용 슬라이드를 생성할 수 있습니다.
            </p>
            <button 
              onClick={() => {
                const totalRooms = monthlyData.reduce((acc, m) => acc + (Number(m.totalRoomRevenue) || 0), 0);
                const avgOcc = (monthlyData.reduce((acc, m) => acc + (Number(m.occupancyRate) || 0), 0) / (monthlyData.length || 1)).toFixed(1);
                const lCap = settings.captureRateLeisure || 0;
                const fCap = settings.captureRateFnb || 0;
                const mCap = settings.captureRateMoto || 0;

                const prompt = `당신은 세계 최고의 전략 컨설팅 펌(맥킨지)의 수석 경영 컨설턴트입니다. 
아래 제공된 우리 리조트의 실제 경영 데이터와 분석 인사이트를 바탕으로, 경영진 보고용 5슬라이드짜리 전략 프레젠테이션(PPT) 대본과 슬라이드 구성을 작성해 주세요. 
전문적이고 단호한 어조로, 데이터에 근거한 인사이트를 제시해야 합니다.

[1. 핵심 실적 요약 데이터]
- 최근 누적 평균 객실 가동률: ${avgOcc}%
- 최근 총 객실 매출액: ${totalRooms.toLocaleString()}원

[2. 투숙객 캡쳐율 (Capture Rate) 데이터]
- 레저본부 투숙객 캡쳐율: ${lCap}%
- 식음(F&B) 부문 투숙객 캡쳐율: ${fCap}%
- 모토아레나 투숙객 캡쳐율: ${mCap}%

[3. 구글 및 맥킨지 관점의 경영진 제안 및 전략 방향성]
- 포트폴리오 믹스 최적화 제안: "레저본부의 점유율이 80%를 넘어서는 병목 구간(주말)에서, 식음(F&B) 및 모토아레나로의 전환율 추세를 보았을 때 투숙객의 추가 지출(Share of Wallet)을 유도하기 위한 패키징 전략 재설계가 시급합니다."
- 신사업(연수원 등) 타당성: "기존 데이터의 주중/주말 매출 상관관계를 통해 볼 때, 신사업(B2B 연수원)의 도입은 주중 공실률을 채우는 핵심 '캐시카우' 역할을 할 것이며, 이는 전체 리조트의 BEP(손익분기점) 달성 시기를 앞당길 가장 강력한 레버리지입니다."
- 디지털 트랜스포메이션 방향: "현재의 인메모리 대시보드 구조에서 나아가, 구글 Cloud Functions 기반의 서버리스 데이터 파이프라인(ETL)을 구축하여 예측 모델의 정확도를 BigQuery ML 수준으로 고도화해야 합니다."

[요청 사항]
1. 위 내용을 바탕으로 Gamma(AI PPT 서비스)에 바로 붙여넣을 수 있는 마크다운 형태의 슬라이드 구성을 짜주세요.
2. 슬라이드는 1) Executive Summary 2) 실적 현황 3) 부문별 캡쳐율 분석 4) 맥킨지 전략 제안 5) Next Steps 로 구성해주세요.
`;
                navigator.clipboard.writeText(prompt);
                setPromptCopied(true);
                setTimeout(() => setPromptCopied(false), 2000);
                toast.success('AI 보고서 프롬프트가 복사되었습니다!');
              }}
              style={{
                background: promptCopied ? '#22c55e' : 'var(--accent-blue)', 
                color: '#fff', 
                border: 'none', 
                padding: '10px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              {promptCopied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              {promptCopied ? '복사 완료!' : 'AI 프롬프트 복사하기'}
            </button>
          </div>
          
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', fontFamily: 'monospace'}}>
            {`[미리보기]\n당신은 세계 최고의 전략 컨설팅 펌(맥킨지)의 수석 경영 컨설턴트입니다. 아래 제공된 우리 리조트의 실제 경영 데이터와 분석 인사이트를 바탕으로... (클릭 시 전체 텍스트 복사)`}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="날씨 데이터 소급 적용 (과거 데이터 마이그레이션)"
        description="데이터베이스에 이미 등록된 과거 매출 데이터의 날짜별 날씨(기온, 강수량, 하늘상태) 정보를 Open-Meteo API에서 가져와 소급 적용합니다."
        isExpanded={expandedSections.weatherMigration}
        onToggle={() => toggleSection('weatherMigration')}
      >
        <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <p style={{color: 'var(--text-muted)', fontSize: '14px', margin: 0}}>
              마이그레이션 시, 벨포레 증평 좌표 기준의 역사 날씨 정보를 조회하여 각 객실 일자별 레코드에 병합합니다.<br/>
              인터넷 데이터 조회 속도로 인해 데이터 량에 따라 최대 수십 초가 소요될 수 있습니다.
            </p>
            <button 
              onClick={handleWeatherMigration}
              disabled={isMigratingWeather}
              style={{
                background: 'var(--accent-blue)', 
                color: '#fff', 
                border: 'none', 
                padding: '10px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                opacity: isMigratingWeather ? 0.6 : 1
              }}
            >
              <CloudSun size={18} />
              {isMigratingWeather ? '마이그레이션 진행 중...' : '과거 날씨 데이터 소급 적용'}
            </button>
          </div>
        </div>
      </SectionCard>

    </div>
  );
}
