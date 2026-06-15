import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Users, Target, UserCheck } from 'lucide-react';

export default function LeisureUtilization({ monthlyData, settings }) {
  const sortedMonths = [...monthlyData].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  const [selectedPeriod, setSelectedPeriod] = useState(sortedMonths.length > 0 ? sortedMonths[0].id : 'all');

  const analysisResult = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const parseSafeInt = (v) => {
      const num = parseInt(v, 10);
      return isNaN(num) ? 0 : num;
    };

    const getMonthTotalVisitors = (d) => {
      let v = 0;
      if (d.visitorCalcData) {
        const netVehicles = Math.max(0, parseSafeInt(d.visitorCalcData.totalVehicles) - parseSafeInt(d.visitorCalcData.employeeVehicles));
        v = Math.max(0, netVehicles * 3 - parseSafeInt(d.visitorCalcData.golfGuests));
      } else {
        const { totalRooms = 175, connectingRooms51 = 85, count51AsTwoRooms = true } = settings || {};
        const dailyInventory = count51AsTwoRooms ? Number(totalRooms) : (Number(totalRooms) - Number(connectingRooms51));
        const daysInMonth = parseSafeInt(d.weekdayCount) + parseSafeInt(d.weekendCount);
        let roomSold = 0;
        if (daysInMonth > 0) roomSold = parseSafeInt(d.roomSoldWd) + parseSafeInt(d.roomSoldWe);
        v = Math.round(roomSold * 2.5);
        if (d.motoGeneralRev > 0) v += Math.round(d.motoGeneralRev / 35000);
      }
      return v;
    };

    let aggregatedTotalVisitors = 0;
    const aggregatedUsage = {};

    const targetData = selectedPeriod === 'all' ? monthlyData : monthlyData.filter(d => d.id === selectedPeriod);

    targetData.forEach(d => {
      aggregatedTotalVisitors += getMonthTotalVisitors(d);
      const usage = d.leisureTicketUsage || {};
      Object.entries(usage).forEach(([venue, count]) => {
        aggregatedUsage[venue] = (aggregatedUsage[venue] || 0) + count;
      });
    });

    const chartData = Object.entries(aggregatedUsage).map(([venue, count]) => {
      return {
        name: venue,
        visitors: count,
        rate: aggregatedTotalVisitors > 0 ? (count / aggregatedTotalVisitors) * 100 : 0
      };
    }).sort((a, b) => b.visitors - a.visitors);

    const totalLeisureVisitors = chartData.reduce((acc, curr) => acc + curr.visitors, 0);

    return {
      aggregatedTotalVisitors,
      chartData,
      totalLeisureVisitors
    };
  }, [monthlyData, settings, selectedPeriod]);

  if (!analysisResult) {
    return (
      <div style={{padding: '24px', color: 'var(--text-muted)'}}>
        데이터가 없습니다.
      </div>
    );
  }

  const { aggregatedTotalVisitors, chartData, totalLeisureVisitors } = analysisResult;

  return (
    <div style={{padding: '24px'}}>
      <div style={{marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
        <div>
          <h2 style={{fontSize: '28px', margin: '0 0 8px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <Activity color="var(--accent-emerald)" /> 레저본부 영업장별 이용률 분석
          </h2>
          <p style={{color: 'var(--text-muted)', margin: 0}}>
            전체 리조트 방문객(모수) 대비 각 영업장을 이용한 고객의 비율을 분석합니다.
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
          <div style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <UserCheck size={16} /> 총 리조트 방문객 (이용 가능 모수)
          </div>
          <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--text-main)'}}>
            {aggregatedTotalVisitors.toLocaleString()}명
          </div>
          <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px'}}>
            * 골프장 이용객 제외
          </div>
        </div>

        <div className="glass-panel" style={{padding: '24px'}}>
          <div style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Target size={16} /> 가장 높은 이용률 영업장
          </div>
          <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>
            {chartData.length > 0 ? `${chartData[0].name} (${chartData[0].rate.toFixed(1)}%)` : '-'}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{padding: '24px'}}>
        <h3 style={{margin: '0 0 24px 0', color: 'var(--text-main)'}}>영업장별 이용률(%) 및 이용객 수</h3>
        
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
                <XAxis type="number" domain={[0, 'dataMax + 5']} stroke="rgba(255,255,255,0.5)" unit="%" />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.8)" width={120} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--accent-emerald)' }}
                  formatter={(value, name, props) => {
                    if (name === 'rate') return [`${value.toFixed(1)}%`, '총 방문객 대비 이용률'];
                    return [`${value.toLocaleString()}명`, name];
                  }}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
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
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>이용객 수(건)</th>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>총 방문객 대비 이용률</th>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>레저본부 내 비중</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={d.name} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '12px 8px', color: i === 0 ? 'var(--accent-emerald)' : 'inherit'}}>#{i + 1}</td>
                  <td style={{padding: '12px 8px', fontWeight: 'bold'}}>{d.name}</td>
                  <td style={{padding: '12px 8px', textAlign: 'right'}}>{d.visitors.toLocaleString()}건</td>
                  <td style={{padding: '12px 8px', textAlign: 'right', color: 'var(--accent-emerald)', fontWeight: 'bold'}}>{d.rate.toFixed(1)}%</td>
                  <td style={{padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)'}}>{((d.visitors / totalLeisureVisitors) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
