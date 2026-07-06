import React, { useState, useEffect } from 'react';
import { ThermometerSun, Send, TrendingDown } from 'lucide-react';

export default function WeatherThresholdWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchThreshold = async () => {
      try {
        // Mock Data
        setTimeout(() => {
          setData({
            optimalTemperature: 24.5,
            declineRatePerDegree: 4.2,
            equation: "y = -1.2x² + 58.8x + 1000"
          });
          setLoading(false);
        }, 800);
      } catch (error) {
        console.error('Failed to fetch thresholds', error);
      }
    };

    fetchThreshold();
  }, []);

  const handlePromotionTrigger = () => {
    alert('CRM 시스템과 연동하여 취소 방지 프로모션 알림톡 발송 큐(Queue)에 등록되었습니다.');
  };

  if (loading || !data) {
    return (
      <div style={{ width: '100%', maxWidth: '380px', height: '240px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        AI 예측 모델 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'relative', 
      overflow: 'hidden', 
      width: '100%', 
      maxWidth: '380px', 
      borderRadius: '16px', 
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)', 
      padding: '24px', 
      color: '#fff',
      height: '100%'
    }}>
      
      {/* Header */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '8px' }}>
            <ThermometerSun style={{ width: '20px', height: '20px', color: '#34d399' }} />
          </div>
          <h3 style={{ fontWeight: '600', fontSize: '14px', color: '#ecfdf5', margin: 0 }}>
            스마트 기온 예측 모델
          </h3>
        </div>
        <div style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
          <span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: '#34d399', opacity: 0.7, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></span>
          <span style={{ position: 'relative', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
        </div>
      </div>

      {/* Key Metric */}
      <div style={{ position: 'relative', zIndex: 10, marginTop: '8px', marginBottom: '24px' }}>
        <p style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: '500', marginBottom: '4px', margin: 0 }}>⛳ 골프장 매출 극대화 최적 기온</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '36px', fontWeight: '800', background: 'linear-gradient(to right, #6ee7b7, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {data.optimalTemperature}℃
          </span>
        </div>
        
        {/* Insight Detail */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <TrendingDown style={{ width: '16px', height: '16px', color: '#fb7185', marginTop: '2px', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: '1.5' }}>
              임계점 초과 시 <strong style={{ color: '#fb7185' }}>1℃ 당 {data.declineRatePerDegree}%</strong>의 급격한 예약 취소 및 매출 하락 모델링 (R² 확보).
            </p>
            <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px', display: 'block' }}>{data.equation}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button 
        onClick={handlePromotionTrigger}
        style={{ 
          position: 'relative', 
          zIndex: 10, 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px', 
          background: '#10b981', 
          color: '#022c22', 
          fontWeight: 'bold', 
          padding: '12px 16px', 
          borderRadius: '12px', 
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s',
          boxShadow: '0 0 15px rgba(16,185,129,0.3)'
        }}
        onMouseOver={e => e.currentTarget.style.background = '#34d399'}
        onMouseOut={e => e.currentTarget.style.background = '#10b981'}
      >
        <Send style={{ width: '16px', height: '16px' }} />
        취소 방지 알림톡 발송 장전
      </button>
    </div>
  );
}
