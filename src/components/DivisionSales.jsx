import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { calculateGroupedSales } from '../utils/revenueUtils';

const CHART_COLORS = {
  leisure: 'var(--accent-emerald)',
  fnb: 'var(--accent-blue)',
  moto: 'var(--accent-gold)',
  golf: 'var(--accent-purple)',
  other: '#94a3b8',
  room: '#ec4899' // Pink color for room sales
};

const DIVISION_NAMES = {
  leisure: '레저본부',
  fnb: '식음 부문',
  moto: '모토아레나',
  golf: '골프 부문',
  other: '기타 부문',
  room: '객실 부문'
};

export default function DivisionSales({ processedData: globalProcessedData, globalStats, settings }) {
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'cumulative'

  // Process data to calculate sales by division per month
  const processedData = useMemo(() => {
    if (!globalProcessedData || globalProcessedData.length === 0) return [];

    // Sort chronologically and filter out invalid rows
    const sortedData = [...globalProcessedData]
      .filter(m => {
        const idStr = String(m.id || m.yearMonth || '');
        return idStr.match(/^\d{4}-\d{2}$/);
      })
      .sort((a, b) => (a.id || a.yearMonth || '').localeCompare(b.id || b.yearMonth || ''));
    
    let cumLeisure = 0;
    let cumFnb = 0;
    let cumMoto = 0;
    let cumGolf = 0;
    let cumOther = 0;
    let cumRoom = 0;

    return sortedData.map(month => {
      let leisureSales = month.leisureSales || 0;
      let fnbSales = month.fnbSales || 0;
      let motoSales = month.motoSales || 0;
      let golfSales = month.golfSales || 0;
      let otherSales = month.otherSales || 0;
      let roomSales = month.totalRoomRevenue || 0;

      cumLeisure += leisureSales;
      cumFnb += fnbSales;
      cumMoto += motoSales;
      cumGolf += golfSales;
      cumOther += otherSales;
      cumRoom += roomSales;

      return {
        month: month.yearMonth || month.id,
        
        // Monthly values
        leisure: leisureSales,
        fnb: fnbSales,
        moto: motoSales,
        golf: golfSales,
        other: otherSales,
        room: roomSales,
        total: leisureSales + fnbSales + motoSales + golfSales + otherSales + roomSales,
        grandTotal: leisureSales + fnbSales + motoSales + golfSales + otherSales + roomSales,

        // Cumulative values
        cumLeisure,
        cumFnb,
        cumMoto,
        cumGolf,
        cumOther,
        cumRoom,
        cumTotal: cumLeisure + cumFnb + cumMoto + cumGolf + cumOther + cumRoom
      };
    });
  }, [globalProcessedData, settings.locationGroups]);

    const yoyData = useMemo(() => {
    if (!globalProcessedData || globalProcessedData.length === 0) return [];
    
    const arr = [];
    for (let i = 1; i <= 12; i++) {
      arr.push({ monthStr: String(i).padStart(2, '0'), month: `${i}월`, '2024': 0, '2025': 0, '2026': 0 });
    }

    globalProcessedData.forEach(d => {
      const idStr = String(d.id || d.yearMonth || '');
      const match = idStr.match(/^(\d{4})-(\d{2})$/);
      if (match) {
        const year = match[1];
        const m = match[2];
        const total = Number(d.totalRevenue || 0);
        const row = arr.find(x => x.monthStr === m);
        if (row && (year === '2024' || year === '2025' || year === '2026')) {
           row[year] += total;
        }
      }
    });

    let cum24=0, cum25=0, cum26=0;
    return arr.map(row => {
      cum24 += row['2024'];
      cum25 += row['2025'];
      cum26 += row['2026'];
      return {
        ...row,
        cum2024: cum24,
        cum2025: cum25,
        cum2026: cum26
      };
    });
  }, [globalProcessedData]);

  if (!processedData || processedData.length === 0) {
    return (
      <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
        데이터가 없습니다. 데이터를 업로드해 주세요.
      </div>
    );
  }

  // Helper formatter for currency
  const formatCurrency = (value) => `₩${(value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '30px'}}>
      {/* Header and Toggle */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <h2 style={{margin: '0 0 8px 0', fontSize: '24px'}}>부문별 매출 분석</h2>
          <p style={{margin: 0, color: 'var(--text-muted)'}}>설정된 부문 기준에 따라 각 부문의 매출 기여도를 분석합니다.</p>
        </div>
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${viewMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setViewMode('monthly')}
          >
            월별 매출
          </button>
          <button 
            className={`tab-btn ${viewMode === 'cumulative' ? 'active' : ''}`}
            onClick={() => setViewMode('cumulative')}
          >
            누적 매출
          </button>
        </div>
      </div>

      <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
        {/* Main Chart Section */}
        <div className="chart-card" style={{flex: '2 1 600px', padding: '20px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-glass)'}}>
          <h3 style={{margin: '0 0 20px 0'}}>
            {viewMode === 'monthly' ? '월별 부문 매출 추이' : '월 누적 부문 매출 추이'}
          </h3>
          <div style={{height: '350px', width: '100%', minWidth: 0, minHeight: 0}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
              {viewMode === 'monthly' ? (
                <BarChart data={processedData} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis tickFormatter={formatCurrency} stroke="#94a3b8" />
                  <RechartsTooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', color: '#000' }}
                  />
                  <Legend />
                  <Bar dataKey="room" stackId="a" fill={CHART_COLORS.room} name={DIVISION_NAMES.room} />
                  <Bar dataKey="leisure" stackId="a" fill={CHART_COLORS.leisure} name={DIVISION_NAMES.leisure} />
                  <Bar dataKey="fnb" stackId="a" fill={CHART_COLORS.fnb} name={DIVISION_NAMES.fnb} />
                  <Bar dataKey="moto" stackId="a" fill={CHART_COLORS.moto} name={DIVISION_NAMES.moto} />
                  <Bar dataKey="golf" stackId="a" fill={CHART_COLORS.golf} name={DIVISION_NAMES.golf} />
                  <Bar dataKey="other" stackId="a" fill={CHART_COLORS.other} name={DIVISION_NAMES.other} />
                </BarChart>
              ) : (
                <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis tickFormatter={formatCurrency} stroke="#94a3b8" />
                  <RechartsTooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', color: '#000' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="cumRoom" stackId="1" stroke={CHART_COLORS.room} fill={CHART_COLORS.room} name={DIVISION_NAMES.room} />
                  <Area type="monotone" dataKey="cumLeisure" stackId="1" stroke={CHART_COLORS.leisure} fill={CHART_COLORS.leisure} name={DIVISION_NAMES.leisure} />
                  <Area type="monotone" dataKey="cumFnb" stackId="1" stroke={CHART_COLORS.fnb} fill={CHART_COLORS.fnb} name={DIVISION_NAMES.fnb} />
                  <Area type="monotone" dataKey="cumMoto" stackId="1" stroke={CHART_COLORS.moto} fill={CHART_COLORS.moto} name={DIVISION_NAMES.moto} />
                  <Area type="monotone" dataKey="cumGolf" stackId="1" stroke={CHART_COLORS.golf} fill={CHART_COLORS.golf} name={DIVISION_NAMES.golf} />
                  <Area type="monotone" dataKey="cumOther" stackId="1" stroke={CHART_COLORS.other} fill={CHART_COLORS.other} name={DIVISION_NAMES.other} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* YoY Chart Section */}
        <div className="chart-card" style={{flex: '1 1 400px', padding: '20px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-glass)'}}>
          <h3 style={{margin: '0 0 20px 0'}}>
            연도별 총매출 비교 (YoY)
          </h3>
          <div style={{height: '350px', width: '100%', minWidth: 0, minHeight: 0}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
              {viewMode === 'monthly' ? (
                <LineChart data={yoyData} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis tickFormatter={formatCurrency} stroke="#94a3b8" />
                  <RechartsTooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', color: '#000' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="2025" stroke="var(--accent-emerald)" strokeWidth={3} dot={{r: 4}} name="2025년" />
                  <Line type="monotone" dataKey="2026" stroke="var(--accent-gold)" strokeWidth={3} dot={{r: 4}} name="2026년" />
                </LineChart>
              ) : (
                <LineChart data={yoyData} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis tickFormatter={formatCurrency} stroke="#94a3b8" />
                  <RechartsTooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', color: '#000' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cum2025" stroke="var(--accent-emerald)" strokeWidth={3} dot={{r: 4}} name="2025년 (누적)" />
                  <Line type="monotone" dataKey="cum2026" stroke="var(--accent-gold)" strokeWidth={3} dot={{r: 4}} name="2026년 (누적)" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Table Section */}
      <div className="table-scroll-container" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>월 (Month)</th>
              <th>
                <div style={{marginBottom: '4px'}}>총매출</div>
                <span style={{fontSize: '12px', color:'var(--text-muted)', fontWeight:'normal', display:'block'}}>(골프포함)</span>
              </th>

              <th style={{color: CHART_COLORS.room}}>{DIVISION_NAMES.room}</th>
              <th style={{color: CHART_COLORS.leisure}}>{DIVISION_NAMES.leisure}</th>
              <th style={{color: CHART_COLORS.fnb}}>{DIVISION_NAMES.fnb}</th>
              <th style={{color: CHART_COLORS.moto}}>{DIVISION_NAMES.moto}</th>
              <th style={{color: CHART_COLORS.golf}}>{DIVISION_NAMES.golf}</th>
              <th style={{color: CHART_COLORS.other}}>{DIVISION_NAMES.other}</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, idx) => (
              <tr key={idx}>
                <td>{row.month}</td>
                <td style={{fontWeight: 'bold', color: 'var(--accent-gold)'}}>
                  {viewMode === 'monthly' ? formatCurrency(row.grandTotal) : formatCurrency(row.cumTotal)}
                </td>

                <td>{viewMode === 'monthly' ? formatCurrency(row.room) : formatCurrency(row.cumRoom)}</td>
                <td>{viewMode === 'monthly' ? formatCurrency(row.leisure) : formatCurrency(row.cumLeisure)}</td>
                <td>{viewMode === 'monthly' ? formatCurrency(row.fnb) : formatCurrency(row.cumFnb)}</td>
                <td>{viewMode === 'monthly' ? formatCurrency(row.moto) : formatCurrency(row.cumMoto)}</td>
                <td>{viewMode === 'monthly' ? formatCurrency(row.golf) : formatCurrency(row.cumGolf)}</td>
                <td>{viewMode === 'monthly' ? formatCurrency(row.other) : formatCurrency(row.cumOther)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
