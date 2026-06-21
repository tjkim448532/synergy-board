import React, { useEffect, useState } from 'react';
import { fetchFutureForecast } from '../utils/weatherUtils';
import { CloudRain, Wind, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WeatherAlertBanner() {
  const [forecast, setForecast] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const loadForecast = async () => {
      const data = await fetchFutureForecast();
      if (data && data.length > 0) {
        setForecast(data);
        analyzeAlerts(data);
      }
    };
    loadForecast();
  }, []);

  const analyzeAlerts = (data) => {
    const newAlerts = [];
    
    // 주말 필터 (토, 일)
    const upcomingWeekends = data.filter(d => {
      const dateObj = new Date(d.date);
      const day = dateObj.getDay();
      return day === 0 || day === 6; // 일, 토
    });

    upcomingWeekends.forEach(d => {
      const isRainy = d.precipitation >= 3.0;
      const isWindy = d.windSpeedMax >= 10.0;
      
      if (isRainy || isWindy) {
        let msg = `다가오는 주말(${d.date.substring(5)})에 `;
        if (isRainy && isWindy) msg += `강한 비(${d.precipitation}mm)와 강풍(${d.windSpeedMax}m/s)`;
        else if (isRainy) msg += `비(${d.precipitation}mm)`;
        else msg += `강풍(${d.windSpeedMax}m/s)`;
        
        msg += ` 예보가 있습니다. 골프 및 야외 매출에 큰 타격(-25% 이상)이 예상되므로 선결제 유도 및 실내 프로모션을 준비하세요.`;
        
        newAlerts.push({ date: d.date, msg, isRainy, isWindy });
      }
    });

    setAlerts(newAlerts);
  };

  if (alerts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          margin: '0 32px 16px 32px',
          padding: '16px 20px',
          background: 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(245,158,11,0.1) 100%)',
          border: '1px solid var(--accent-red)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '15px'}}>
          <AlertTriangle size={20} />
          미래 기상 예측 AI 알람 (Dynamic Alert)
        </div>
        {alerts.map((alert, i) => (
          <div key={i} style={{fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px'}}>
            {alert.isRainy ? <CloudRain size={16} color="var(--accent-purple)"/> : <Wind size={16} color="var(--accent-blue)"/>}
            <span>{alert.msg}</span>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
