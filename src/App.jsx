import React, { useState, useEffect } from 'react'
import { LayoutDashboard, TrendingUp, Upload, Settings as SettingsIcon, Play, FileSpreadsheet } from 'lucide-react'
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import DashboardLayout from './components/DashboardLayout'
import PieChart3D from './components/PieChart3D'
import ValidationMaster from './components/ValidationMaster'
import PresentationView from './components/PresentationView'
import BigQueryConsole from './components/BigQueryConsole'
import Settings from './components/Settings'
import MonthlyDataForm from './components/MonthlyDataForm'
import CorrelationAnalytics from './components/CorrelationAnalytics'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [presentationMode, setPresentationMode] = useState(false)
  const [calculationMode, setCalculationMode] = useState('physical') // 'physical' or 'sales'
  const [selectedMonth, setSelectedMonth] = useState('ALL')
  const [settings, setSettings] = useState({ totalRooms: 500, connectingRooms51: 50 });
  const [allData, setAllData] = useState([]);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'config', 'mainSettings'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    const unsubData = onSnapshot(collection(db, 'monthly_records'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
      setAllData(data);
    });

    return () => {
      unsubSettings();
      unsubData();
    };
  }, []);

  const calculateCorrelation = (data, calcMode, settings) => {
    if (data.length < 2) return null;
    
    const mapped = data.map(d => {
      let occupancy = 0;
      if (calcMode === 'physical') {
        const inventory = Number(settings.totalRooms);
        const sold = Number(d.standardSold) + (Number(d.connectingSold) * 2);
        occupancy = inventory > 0 ? (sold / inventory) * 100 : 0;
      } else {
        const inventory = Number(settings.totalRooms) - Number(settings.connectingRooms51);
        const sold = Number(d.standardSold) + Number(d.connectingSold);
        occupancy = inventory > 0 ? (sold / inventory) * 100 : 0;
      }
      return { occupancyRate: occupancy, leisureSales: d.leisureSales };
    });

    const n = mapped.length;
    const sumX = mapped.reduce((acc, val) => acc + val.occupancyRate, 0);
    const sumY = mapped.reduce((acc, val) => acc + val.leisureSales, 0);
    const sumX2 = mapped.reduce((acc, val) => acc + (val.occupancyRate * val.occupancyRate), 0);
    const sumY2 = mapped.reduce((acc, val) => acc + (val.leisureSales * val.leisureSales), 0);
    const sumXY = mapped.reduce((acc, val) => acc + (val.occupancyRate * val.leisureSales), 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;
    return numerator / denominator;
  };

  const slides = [
    (
      <div key="slide1" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px', color: 'var(--accent-gold)' }}>경영진 요약 보고</h1>
        <p style={{ fontSize: '24px', color: 'var(--text-muted)' }}>콘도 객실 점유율 및 레저 매출 상관관계 분석</p>
      </div>
    ),
    (
      <div key="slide2" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '40px' }}>매출 기여도</h2>
        <PieChart3D tilt={45} depth={40} />
      </div>
    ),
    (
      <div key="slide3" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '40px' }}>레저본부 성과 및 검증 마스터</h2>
        <div style={{ flex: 1, width: '100%' }}>
          <ValidationMaster />
        </div>
      </div>
    )
  ];

  if (presentationMode) {
    return <PresentationView slides={slides} onClose={() => setPresentationMode(false)} />
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'overview': {
        const availableMonths = Array.from(new Set(allData.map(d => d.yearMonth))).sort().reverse();
        const filteredData = selectedMonth === 'ALL' ? allData : allData.filter(d => d.yearMonth === selectedMonth);
        
        let avgOccupancy = '0.0%';
        let totalSales = 0;
        let correlation = null;

        if (filteredData.length > 0) {
          let totalInventory = 0;
          let totalSold = 0;
          
          filteredData.forEach(d => {
            if (calculationMode === 'physical') {
              totalInventory += Number(settings.totalRooms);
              totalSold += (Number(d.standardSold) + (Number(d.connectingSold) * 2));
            } else {
              totalInventory += (Number(settings.totalRooms) - Number(settings.connectingRooms51));
              totalSold += (Number(d.standardSold) + Number(d.connectingSold));
            }
            totalSales += Number(d.leisureSales);
          });
          
          avgOccupancy = ((totalSold / totalInventory) * 100).toFixed(1) + '%';
          correlation = calculateCorrelation(filteredData, calculationMode, settings);
        }

        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                <h2 style={{margin: 0}}>대시보드 개요</h2>
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: '6px', outline: 'none'}}
                >
                  <option value="ALL" style={{color: 'black'}}>통합 전체 기간</option>
                  {availableMonths.map(m => <option key={m} value={m} style={{color: 'black'}}>{m}</option>)}
                </select>
              </div>
              <div style={{display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '8px'}}>
                <button 
                  onClick={() => setCalculationMode('physical')}
                  style={{padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: calculationMode === 'physical' ? 'var(--accent-blue)' : 'transparent', color: calculationMode === 'physical' ? 'white' : 'var(--text-muted)'}}
                >물리 객실 기준 (51평=2실)</button>
                <button 
                  onClick={() => setCalculationMode('sales')}
                  style={{padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: calculationMode === 'sales' ? 'var(--accent-blue)' : 'transparent', color: calculationMode === 'sales' ? 'white' : 'var(--text-muted)'}}
                >판매 객실 기준 (51평=1실)</button>
              </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>평균 객실 점유율</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>{avgOccupancy}</div>
              </div>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>레저본부 총 매출</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>
                  {new Intl.NumberFormat('ko-KR').format(totalSales)}
                </div>
              </div>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>매출 상관계수 (r)</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>
                  {correlation !== null ? correlation.toFixed(3) : 'N/A'}
                </div>
              </div>
            </div>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px'}}>
              <PieChart3D />
            </div>
          </div>
        )
      case 'analytics':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px'}}>
            <CorrelationAnalytics 
              calculationMode={calculationMode} 
              onModeChange={setCalculationMode} 
              monthlyData={allData}
              settings={settings}
            />
          </div>
        )
      case 'upload':
        return (
          <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto'}}>
            <div className="glass-panel" style={{flexShrink: 0}}>
              <MonthlyDataForm />
            </div>
            <div className="glass-panel" style={{flex: 1, minHeight: '400px'}}>
              <ValidationMaster />
            </div>
          </div>
        )
      case 'db':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px'}}>
            <BigQueryConsole />
          </div>
        )
      case 'settings':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px'}}>
            <Settings />
          </div>
        )
      default:
        return null;
    }
  }

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onPresentationMode={() => setPresentationMode(true)}
    >
      {renderContent()}
    </DashboardLayout>
  )
}

export default App
