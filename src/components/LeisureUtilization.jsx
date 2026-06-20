import React, { useState, useMemo } from 'react';
import useGoogleSheetVisitors from '../hooks/useGoogleSheetVisitors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Users, Target, UserCheck } from 'lucide-react';
import { parseSafeNumber, safeRate } from '../utils/statUtils';

export default function LeisureUtilization({ processedData, globalStats, settings }) {
  const sortedMonths = [...processedData].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  const [selectedPeriod, setSelectedPeriod] = useState(sortedMonths.length > 0 ? sortedMonths[0].id : 'all');
  const [isGoogleSheetSyncEnabled, setIsGoogleSheetSyncEnabled] = useState(true);
  const { googleSheetData } = useGoogleSheetVisitors();

  const analysisResult = useMemo(() => {
    if (processedData.length === 0) return null;

    const carPeopleWeight = settings?.carPeopleWeight !== undefined ? parseSafeNumber(settings.carPeopleWeight) : 3.0;

    const getMonthTotalVisitors = (d) => {
      let v = 0;
      if (d.visitorCalcData) {
        const netVehicles = Math.max(0, parseSafeNumber(d.visitorCalcData.totalVehicles) - parseSafeNumber(d.visitorCalcData.employeeVehicles));
        v = Math.max(0, netVehicles * carPeopleWeight - parseSafeNumber(d.visitorCalcData.golfGuests));
      } else {
        const { totalRooms = 175, connectingRooms51 = 85, count51AsTwoRooms = true } = settings || {};
        const dailyInventory = count51AsTwoRooms ? parseSafeNumber(totalRooms) : (parseSafeNumber(totalRooms) - parseSafeNumber(connectingRooms51));
        const daysWd = parseSafeNumber(d.daysCountWeekdayLeisure || d.daysCountWeekday);
        const daysWe = parseSafeNumber(d.daysCountWeekendLeisure || d.daysCountWeekend);
        const daysInMonth = daysWd + daysWe;
        let roomSold = 0;
        if (daysInMonth > 0) roomSold = parseSafeNumber(d.soldWd || d.soldWeekday) + parseSafeNumber(d.soldWe || d.soldWeekend);
        v = Math.round(roomSold * (globalStats?.avgGuestsPerSoldRoom || 2.5));
        if (d.motoGeneralRev > 0) v += Math.round(d.motoGeneralRev / 35000);
      }
      return v;
    };

    let aggregatedTotalVisitors = 0;
    let sheetUtilizationRates = null;
    
    if (isGoogleSheetSyncEnabled && googleSheetData) {
      if (selectedPeriod === 'all') {
        aggregatedTotalVisitors = Object.values(googleSheetData.visitors || {}).reduce((a, b) => a + b, 0);
      } else {
        const selM = parseInt(selectedPeriod.split('-')[1], 10);
        aggregatedTotalVisitors = (googleSheetData.visitors || {})[selM] || 0;
      }
      sheetUtilizationRates = googleSheetData.utilizationRates;
    } else {
      const targetData = selectedPeriod === 'all' ? processedData : processedData.filter(d => d.id === selectedPeriod);
      targetData.forEach(d => {
        aggregatedTotalVisitors += getMonthTotalVisitors(d);
      });
    }

    const aggregatedUsage = {};
    
    if (isGoogleSheetSyncEnabled && sheetUtilizationRates) {
      // 구글 시트에서 이용률(%)을 가져와서 이용객 수를 계산 (총 방문객 수 * 이용률)
      Object.entries(sheetUtilizationRates).forEach(([venue, rates]) => {
        if (selectedPeriod === 'all') {
          // 전체 누적: 각 월별 (해당 월 총방문객 * 해당 월 이용률)을 합산해야 정확함
          let totalV = 0;
          for(let m=1; m<=12; m++) {
            const mVisit = (googleSheetData.visitors || {})[m] || 0;
            const mRate = (rates[m] || 0) / 100;
            totalV += mVisit * mRate;
          }
          aggregatedUsage[venue] = Math.round(totalV);
        } else {
          // 특정 월
          const selM = parseInt(selectedPeriod.split('-')[1], 10);
          const mRate = (rates[selM] || 0) / 100;
          aggregatedUsage[venue] = Math.round(aggregatedTotalVisitors * mRate);
        }
      });
    } else {
      const targetData2 = selectedPeriod === 'all' ? processedData : processedData.filter(d => d.id === selectedPeriod);
      targetData2.forEach(d => {
        const usage = d.leisureTicketUsage || {};
        Object.entries(usage).forEach(([venue, count]) => {
          aggregatedUsage[venue] = (aggregatedUsage[venue] || 0) + count;
        });
      });
    }

    const chartData = Object.entries(aggregatedUsage).map(([venue, count]) => {
      return {
        name: venue,
        visitors: count,
        rate: safeRate(count, aggregatedTotalVisitors) * 100
      };
    }).sort((a, b) => b.visitors - a.visitors);

    const totalLeisureVisitors = chartData.reduce((acc, curr) => acc + curr.visitors, 0);

    return {
      aggregatedTotalVisitors,
      chartData,
      totalLeisureVisitors
    };
  }, [processedData, selectedPeriod, settings, isGoogleSheetSyncEnabled, googleSheetData]);

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
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '8px'}}>
            <UserCheck size={16} /> 총 리조트 방문객 (이용 가능 모수)
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', padding: '4px 12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginLeft: 'auto'}}>
              <input type="checkbox" checked={isGoogleSheetSyncEnabled} onChange={(e) => setIsGoogleSheetSyncEnabled(e.target.checked)} style={{display: 'none'}} />
              <span style={{fontSize: '12px', color: isGoogleSheetSyncEnabled ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>구글 시트 연동</span>
              <div style={{position: 'relative', width: '32px', height: '16px', background: isGoogleSheetSyncEnabled ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.2)', borderRadius: '8px', transition: '0.3s'}}>
                <div style={{position: 'absolute', top: '2px', left: isGoogleSheetSyncEnabled ? '18px' : '2px', width: '12px', height: '12px', background: 'white', borderRadius: '50%', transition: '0.3s'}} />
              </div>
            </label>
          </div>
          <div style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '8px'}}>
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
