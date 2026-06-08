import React, { useState } from 'react'
import DashboardLayout from './components/DashboardLayout'
import PieChart3D from './components/PieChart3D'
import ValidationMaster from './components/ValidationMaster'
import PresentationView from './components/PresentationView'
import BigQueryConsole from './components/BigQueryConsole'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [presentationMode, setPresentationMode] = useState(false)

  const slides = [
    (
      <div key="slide1" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px', color: 'var(--accent-gold)' }}>Executive Summary</h1>
        <p style={{ fontSize: '24px', color: 'var(--text-muted)' }}>Condo Occupancy vs Leisure Sales Correlation</p>
      </div>
    ),
    (
      <div key="slide2" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '40px' }}>Revenue Contribution</h2>
        <PieChart3D tilt={45} depth={40} />
      </div>
    ),
    (
      <div key="slide3" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '40px' }}>Leisure Department Efficiency & Master Grid</h2>
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
      case 'overview':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
            <h2>Executive Dashboard Overview</h2>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>Avg. Occupancy</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>74.2%</div>
              </div>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>Total Leisure Sales</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>1,845,000,000</div>
              </div>
              <div className="glass-panel" style={{padding: '20px'}}>
                <div style={{color: 'var(--text-muted)'}}>Sales Correlation (r)</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)'}}>0.86</div>
              </div>
            </div>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px'}}>
              <PieChart3D />
            </div>
          </div>
        )
      case 'analytics':
        return <div className="glass-panel" style={{height: '100%', padding: '32px'}}><h2>Correlation Analytics (Coming Soon)</h2></div>
      case 'upload':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px'}}>
            <ValidationMaster />
          </div>
        )
      case 'db':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px'}}>
            <BigQueryConsole />
          </div>
        )
      case 'settings':
        return <div className="glass-panel" style={{height: '100%', padding: '32px'}}><h2>Settings (Coming Soon)</h2></div>
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
