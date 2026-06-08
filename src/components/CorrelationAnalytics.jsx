import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';

export default function CorrelationAnalytics({ calculationMode, onModeChange, monthlyData, settings }) {


  // Calculate dynamic occupancy
  const data = monthlyData.map(d => {
    let occupancy = 0;
    if (calculationMode === 'physical') {
      const inventory = Number(settings.totalRooms);
      const sold = Number(d.standardSold) + (Number(d.connectingSold) * 2);
      occupancy = inventory > 0 ? (sold / inventory) * 100 : 0;
    } else {
      const inventory = Number(settings.totalRooms) - Number(settings.connectingRooms51);
      const sold = Number(d.standardSold) + Number(d.connectingSold);
      occupancy = inventory > 0 ? (sold / inventory) * 100 : 0;
    }
    return {
      ...d,
      occupancyRate: Number(occupancy.toFixed(1))
    };
  });

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (data) => {
    if (data.length < 2) return null;
    const n = data.length;
    const sumX = data.reduce((acc, val) => acc + val.occupancyRate, 0);
    const sumY = data.reduce((acc, val) => acc + val.leisureSales, 0);
    const sumX2 = data.reduce((acc, val) => acc + (val.occupancyRate * val.occupancyRate), 0);
    const sumY2 = data.reduce((acc, val) => acc + (val.leisureSales * val.leisureSales), 0);
    const sumXY = data.reduce((acc, val) => acc + (val.occupancyRate * val.leisureSales), 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;
    return numerator / denominator;
  };

  const correlation = calculateCorrelation(data);

  if (data.length === 0) {
    return (
      <div className="glass-panel" style={{ height: '100%', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>데이터가 충분하지 않습니다. 월별 데이터를 먼저 업로드해 주세요.</p>
      </div>
    );
  }

  // Format data for Scatter
  const scatterData = data.map(d => ({
    x: d.occupancyRate,
    y: d.leisureSales,
    name: d.yearMonth
  }));

  const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val) + '원';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>매월 변화 트렌드 (객실 점유율 vs 레저본부 매출)</h3>
          <div style={{display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '8px'}}>
            <button 
              onClick={() => onModeChange('physical')}
              style={{padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: calculationMode === 'physical' ? 'var(--accent-blue)' : 'transparent', color: calculationMode === 'physical' ? 'white' : 'var(--text-muted)'}}
            >물리 객실 기준 (51평=2실)</button>
            <button 
              onClick={() => onModeChange('sales')}
              style={{padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: calculationMode === 'sales' ? 'var(--accent-blue)' : 'transparent', color: calculationMode === 'sales' ? 'white' : 'var(--text-muted)'}}
            >판매 객실 기준 (51평=1실)</button>
          </div>
        </div>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="yearMonth" stroke="#888" />
              <YAxis yAxisId="left" stroke="#10b981" domain={['dataMin - 10', 'dataMax + 10']} />
              <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tickFormatter={(val) => (val / 100000000) + '억'} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                formatter={(value, name) => {
                  if (name === '레저본부 매출') return [formatCurrency(value), name];
                  return [value + '%', name];
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="occupancyRate" name="객실 점유율" stroke="#10b981" activeDot={{ r: 8 }} />
              <Line yAxisId="right" type="monotone" dataKey="leisureSales" name="레저본부 매출" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>점유율-매출 상관관계 (산점도)</h3>
          {correlation !== null && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--accent-gold)', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
              상관계수 (r) = {correlation.toFixed(3)}
            </div>
          )}
        </div>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" dataKey="x" name="객실 점유율" unit="%" stroke="#888" domain={['dataMin - 5', 'dataMax + 5']} />
              <YAxis type="number" dataKey="y" name="레저본부 매출" stroke="#888" tickFormatter={(val) => (val / 100000000) + '억'} />
              <ZAxis type="category" dataKey="name" name="연/월" />
              <RechartsTooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                formatter={(value, name) => {
                    if (name === '레저본부 매출') return [formatCurrency(value), name];
                    if (name === '객실 점유율') return [value + '%', name];
                    return [value, name];
                }}
              />
              <Scatter name="Correlation" data={scatterData} fill="var(--accent-gold)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
