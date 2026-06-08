import React, { useState } from 'react'
import DashboardLayout from './components/DashboardLayout'
import Settings from './components/Settings'
import MonthlyDataForm from './components/MonthlyDataForm'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('upload')

  const renderContent = () => {
    switch(activeTab) {
      case 'upload':
        return (
          <div style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <MonthlyDataForm />
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
    >
      {renderContent()}
    </DashboardLayout>
  )
}

export default App
