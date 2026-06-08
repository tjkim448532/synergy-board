import React, { useState, useEffect } from 'react'
import DashboardLayout from './components/DashboardLayout'
import Settings from './components/Settings'
import MonthlyDataForm from './components/MonthlyDataForm'
import AdvancedAnalytics from './components/AdvancedAnalytics'
import RevenuePrediction from './components/RevenuePrediction'
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const [settings, setSettings] = useState({ totalRooms: 500, connectingRooms51: 50 });
  const [allData, setAllData] = useState([]);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'config', 'mainSettings'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    const unsubData = onSnapshot(collection(db, 'monthly_records'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setAllData(data);
    });

    return () => {
      unsubSettings();
      unsubData();
    };
  }, []);

  const renderContent = () => {
    switch(activeTab) {
      case 'prediction':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <RevenuePrediction monthlyData={allData} settings={settings} />
          </div>
        )
      case 'analytics':
        return (
          <div className="glass-panel" style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <AdvancedAnalytics monthlyData={allData} settings={settings} />
          </div>
        )
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
