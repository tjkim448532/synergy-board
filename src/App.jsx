import React, { useState } from 'react'
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
  
  const getSettings = () => {
    const saved = localStorage.getItem('synergy_settings');
    return saved ? JSON.parse(saved) : { totalRooms: 500, connectingRooms51: 50 };
  };

  const getMonthlyData = () => {
    const saved = localStorage.getItem('synergy_monthly_data');
    return saved ? JSON.parse(saved) : [];
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
        const settings = getSettings();
        const data = getMonthlyData();
        
        let avgOccupancy = '0.0%';
        if (data.length > 0) {
          let totalInventory = 0;
          let totalSold = 0;
          
          data.forEach(d => {
            if (calculationMode === 'physical') {
              totalInventory += Number(settings.totalRooms);
              totalSold += (Number(d.standardSold) + (Number(d.connectingSold) * 2));
            } else {
              totalInventory += (Number(settings.totalRooms) - Number(settings.connectingRooms51));
              totalSold += (Number(d.standardSold) + Number(d.connectingSold));
            }
          });
          
          avgOccupancy = ((totalSold / totalInventory) * 100).toFixed(1) + '%';
        }

        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2>대시보드 개요</h2>
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
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>1,845,000,000</div>
              </div>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>매출 상관계수 (r)</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>0.86</div>
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
            <CorrelationAnalytics calculationMode={calculationMode} onModeChange={setCalculationMode} />
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
