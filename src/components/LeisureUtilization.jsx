import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Target, Ticket } from 'lucide-react';

export default function LeisureUtilization({ processedData, globalStats, settings }) {
  const sortedMonths = [...processedData].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  const [selectedPeriod, setSelectedPeriod] = useState(sortedMonths.length > 0 ? sortedMonths[0].id : 'all');

  const analysisResult = useMemo(() => {
    if (processedData.length === 0) return null;

    const aggregatedUsage = {};
    const targetData = selectedPeriod === 'all' ? processedData : processedData.filter(d => d.id === selectedPeriod);
    
    targetData.forEach(d => {
      const visitors = d.leisureVisitorBreakdown || [];
      visitors.forEach(item => {
        // 객실 투숙객은 레저 영업장 통계에서 제외합니다.
        if (item.venue && item.venue !== '객실') {
          aggregatedUsage[item.venue] = (aggregatedUsage[item.venue] || 0) + (Number(item.visitors) || 0);
        }
      });
    });

    const totalTicketsSold = Object.values(aggregatedUsage).reduce((acc, curr) => acc + curr, 0);

    const chartData = Object.entries(aggregatedUsage).map(([venue, count]) => {
      return {
        name: venue,
        ticketsSold: count,
        share: totalTicketsSold > 0 ? (count / totalTicketsSold) * 100 : 0
      };
    }).sort((a, b) => b.ticketsSold - a.ticketsSold);

    return {
      chartData,
      totalTicketsSold
    };
  }, [processedData, selectedPeriod]);

  if (!analysisResult) {
    return (
      <div style={{padding: '24px', color: 'var(--text-muted)'}}>
        데이터가 없습니다.
      </div>
    );
  }

  const { chartData, totalTicketsSold } = analysisResult;

  return (
    <div style={{padding: '24px'}}>
      <div style={{marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
        <div>
          <h2 style={{fontSize: '28px', margin: '0 0 8px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <Activity color="var(--accent-emerald)" /> 레저본부 영업장별 티켓 판매 및 비중 분석
          </h2>
          <p style={{color: 'var(--text-muted)', margin: 0}}>
            레저본부 산하 각 영업장의 실제 티켓 판매 실적과 전체 레저 판매 내 비중을 분석합니다 (100% 실측치).
          </p>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <label style={{color: 'var(--text-muted)', fontSize: '14px'}}>조회 기간:</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{padding: '8px 12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', outline: 'none', minWidth: '150px'}}
          >
            <option value="all" style={{color: 'black'}}>전체 누적</option>
            {sortedMonths.map(m => (
              <option key={m.id} value={m.id} style={{color: 'black'}}>{m.id}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px'}}>
        <div className="glass-panel" style={{padding: '24px', borderLeft: '4px solid var(--accent-blue)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '8px'}}>
            <Ticket size={16} /> 총 레저 티켓 판매량 (실측)
          </div>
          <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '8px'}}>
            {totalTicketsSold.toLocaleString()}건
          </div>
          <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px'}}>
            * 실제 판매가 기록된 레저본부 티켓 판매 수량의 총합
          </div>
        </div>

        <div className="glass-panel" style={{padding: '24px'}}>
          <div style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Target size={16} /> 최다 판매 영업장
          </div>
          <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>
            {chartData.length > 0 ? `${chartData[0].name} (${chartData[0].ticketsSold.toLocaleString()}건, 비중 ${chartData[0].share.toFixed(1)}%)` : '-'}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{padding: '24px'}}>
        <h3 style={{margin: '0 0 24px 0', color: 'var(--text-main)'}}>영업장별 티켓 판매량(건) 및 비중(%)</h3>
        
        {chartData.length === 0 ? (
          <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px'}}>
            해당 기간의 레저 티켓 데이터가 업로드되지 않았습니다.
          </div>
        ) : (
          <div style={{height: '400px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 80, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.5)" unit="건" />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.8)" width={120} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--accent-emerald)' }}
                  formatter={(value, name, props) => {
                    if (name === 'ticketsSold') return [`${value.toLocaleString()}건`, '티켓 판매량'];
                    if (name === 'share') return [`${value.toFixed(1)}%`, '레저 내 판매 비중'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="ticketsSold" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--accent-emerald)' : 'var(--accent-blue)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="glass-panel" style={{padding: '24px', marginTop: '24px'}}>
          <h3 style={{margin: '0 0 16px 0', color: 'var(--text-main)'}}>데이터 상세</h3>
          <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px'}}>
            <thead>
              <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)'}}>순위</th>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)'}}>영업장명</th>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>티켓 판매량(건)</th>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>레저본부 내 판매 비중</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={d.name} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '12px 8px', color: i === 0 ? 'var(--accent-emerald)' : 'inherit'}}>#{i + 1}</td>
                  <td style={{padding: '12px 8px', fontWeight: 'bold'}}>{d.name}</td>
                  <td style={{padding: '12px 8px', textAlign: 'right'}}>{d.ticketsSold.toLocaleString()}건</td>
                  <td style={{padding: '12px 8px', textAlign: 'right', color: 'var(--accent-emerald)', fontWeight: 'bold'}}>{d.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
