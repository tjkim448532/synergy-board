import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import DashboardLayout from './components/DashboardLayout'
import Settings from './components/Settings'
import MonthlyDataForm from './components/MonthlyDataForm'
import AdvancedAnalytics from './components/AdvancedAnalytics'
import DivisionSales from './components/DivisionSales'
import ChannelAnalysis from './components/ChannelAnalysis'
import RevenuePrediction from './components/RevenuePrediction'
import LogicGuide from './components/LogicGuide'
import DataAccuracyTasks from './components/DataAccuracyTasks'
import NewBusinessTraining from './components/NewBusinessTraining'
import VisitorCalculation from './components/VisitorCalculation'
import LeisureUtilization from './components/LeisureUtilization'
import ManagementStrategy from './components/ManagementStrategy'
import WeatherForecastAnalytics from './components/WeatherForecastAnalytics'
import WeatherAnalytics from './components/WeatherAnalytics'
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import useProcessedData from './hooks/useProcessedData';
import useBackendData from './hooks/useBackendData';
import useAutoScale from './hooks/useAutoScale';
import './App.css'

// 백엔드 연동 스위치 (백엔드 API 개발이 완료되면 true로 변경하세요)
const USE_BACKEND_API = true;

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
  useAutoScale(); // 전체 모니터 해상도 자동 스케일링 훅
  
  const [activeTab, setActiveTab] = useState('analytics')
  const [settings, setSettings] = useState({});
  const [allData, setAllData] = useState([]);

  // 백엔드 API 연동을 위한 날짜 구간 (필요 시 UI에서 동적 변경 가능)
  const [apiStartDate] = useState('2026-01-01');
  const [apiEndDate] = useState('2026-12-31');
  const [ssoDate, setSsoDate] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const date = urlParams.get('date');
    if (date) return date;
    return sessionStorage.getItem('sso_date') || null;
  });

  const { data: backendData, loading: apiLoading, error: apiError } = useBackendData(
    USE_BACKEND_API ? apiStartDate : null, 
    USE_BACKEND_API ? apiEndDate : null,
    ssoDate
  );

  const { processedData, globalStats } = useProcessedData(
    USE_BACKEND_API ? backendData : allData, 
    settings
  );

  useEffect(() => {
    // SSO 자동 로그인용 URL 토큰 및 날짜 파싱
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const targetDate = urlParams.get('date');
    
    let shouldCleanUrl = false;
    
    if (token) {
      sessionStorage.setItem('sso_token', token);
      shouldCleanUrl = true;
    }
    
    if (targetDate) {
      sessionStorage.setItem('sso_date', targetDate);
      shouldCleanUrl = true;
    }

    if (shouldCleanUrl) {
      // 토큰 및 날짜 캡처 후 URL에서 제거 (보안 및 깔끔한 주소창 유지)
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'config', 'mainSettings'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    return () => {
      unsubSettings();
    };
  }, []);

  const renderContent = () => {
    switch(activeTab) {
      case 'strategy':
        return (
          <motion.div key="strategy" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{padding: '32px'}}>
            <ManagementStrategy processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'prediction':
        return (
          <motion.div key="prediction" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <RevenuePrediction processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'analytics':
        return (
          <motion.div key="analytics" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <AdvancedAnalytics processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'weather-stats':
        return (
          <motion.div key="weather-stats" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <WeatherAnalytics processedData={processedData} settings={settings} />
          </motion.div>
        )
      case 'weather-forecast':
        return (
          <motion.div key="weather-forecast" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <WeatherForecastAnalytics processedData={processedData} settings={settings} />
          </motion.div>
        )
      case 'division-sales':
        return (
          <motion.div key="division-sales" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <DivisionSales processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'leisure-utilization':
        return (
          <motion.div key="leisure-utilization" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <LeisureUtilization processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'channel-analysis':
        return (
          <motion.div key="channel-analysis" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <ChannelAnalysis processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'new-business':
        return (
          <motion.div key="new-business" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <NewBusinessTraining processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'visitor-calc':
        return (
          <motion.div key="visitor-calc" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <VisitorCalculation processedData={processedData} globalStats={globalStats} settings={settings} />
          </motion.div>
        )
      case 'new-business-soccer':
        return (
          <motion.div key="new-business-soccer" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '48px', textAlign: 'center'}}>
            <h2 style={{fontSize: '24px', marginBottom: '16px'}}>⚽ 축구장 신규 사업 시뮬레이터</h2>
            <p style={{color: 'var(--text-muted)'}}>현재 축구장 모델링 데이터를 수집 및 분석 중입니다. 향후 업데이트를 기대해 주세요!</p>
          </motion.div>
        )
      case 'logic':
        return (
          <motion.div key="logic" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <LogicGuide settings={settings} />
          </motion.div>
        )
      case 'accuracy-tasks':
        return (
          <motion.div key="accuracy-tasks" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
            <DataAccuracyTasks />
          </motion.div>
        )

      case 'settings':
        return (
          <motion.div key="settings" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="glass-panel" style={{padding: '32px'}}>
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
