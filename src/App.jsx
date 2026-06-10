import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import DashboardLayout from './components/DashboardLayout'
import Settings from './components/Settings'
import MonthlyDataForm from './components/MonthlyDataForm'
import AdvancedAnalytics from './components/AdvancedAnalytics'
import RevenuePrediction from './components/RevenuePrediction'
import LogicGuide from './components/LogicGuide'
import DataAccuracyTasks from './components/DataAccuracyTasks'
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import './App.css'

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -10 }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.3
};

function App() {
  const [activeTab, setActiveTab] = useState('analytics')
  const [settings, setSettings] = useState({});
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
          <motion.div key="prediction" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <RevenuePrediction monthlyData={allData} settings={settings} />
          </motion.div>
        )
      case 'analytics':
        return (
          <motion.div key="analytics" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <AdvancedAnalytics monthlyData={allData} settings={settings} />
          </motion.div>
        )
      case 'logic':
        return (
          <motion.div key="logic" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <LogicGuide settings={settings} />
          </motion.div>
        )
      case 'accuracy-tasks':
        return (
          <motion.div key="accuracy-tasks" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <DataAccuracyTasks />
          </motion.div>
        )
      case 'upload':
        return (
          <motion.div key="upload" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{height: '100%', padding: '32px', overflowY: 'auto'}}>
            <MonthlyDataForm settings={settings} />
          </motion.div>
        )
      case 'settings':
        return (
          <motion.div key="settings" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{height: '100%', padding: '32px'}}>
            <Settings monthlyData={allData} />
          </motion.div>
        )
      default:
        return null;
    }
  }

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: 'var(--accent-emerald)',
              secondary: '#fff',
            },
          },
        }}
      />
      <DashboardLayout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
      >
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </DashboardLayout>
    </>
  )
}

export default App
