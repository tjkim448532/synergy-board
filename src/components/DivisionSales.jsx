import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';

const CHART_COLORS = {
  leisure: 'var(--accent-emerald)',
  fnb: 'var(--accent-blue)',
  moto: 'var(--accent-gold)',
  golf: 'var(--accent-purple)',
  other: '#94a3b8',
  room: '#ec4899' // Pink color for room sales
};

const DIVISION_NAMES = {
  leisure: '레저 부문',
  fnb: '식음 부문',
  moto: '모토아레나',
  golf: '골프 부문',
  other: '기타 부문',
  room: '객실 부문'
};

export default function DivisionSales({ monthlyData, settings }) {
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'cumulative'

  // Process data to calculate sales by division per month
  const processedData = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];

    // Sort chronologically
    const sortedData = [...monthlyData].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    let cumLeisure = 0;
    let cumFnb = 0;
    let cumMoto = 0;
    let cumGolf = 0;
    let cumOther = 0;
    let cumRoom = 0;

    return sortedData.map(month => {
      let leisureSales = 0;
      let fnbSales = 0;
      let motoSales = 0;
      let golfSales = 0;
      let otherSales = 0;
      let excludeSales = 0;
      let roomSales = month.totalRoomRevenue || month.roomRevenue || 0;

      // Group sales by location
      if (month.salesByLocation) {
        Object.keys(month.salesByLocation).forEach(loc => {
          const group = (settings.locationGroups && settings.locationGroups[loc]) || 'leisure';
          const sales = month.salesByLocation[loc] || 0;
          
          if (group === 'leisure') leisureSales += sales;
          else if (group === 'fnb') fnbSales += sales;
          else if (group === 'moto') motoSales += sales;
          else if (group === 'golf') golfSales += sales;
          else if (group === 'other') otherSales += sales;
          else if (group === 'exclude') excludeSales += sales;
        });
      } else {
        // Fallback for old data structure if needed
        leisureSales = Number(month.totalLeisureSales || month.leisureSales || 0);
      }

      // Add to cumulative totals
      cumLeisure += leisureSales;
      cumFnb += fnbSales;
      cumMoto += motoSales;
      cumGolf += golfSales;
      cumOther += otherSales;
      cumRoom += roomSales;

      return {
        month: month.yearMonth,
        
        // Monthly values
        leisure: leisureSales,
        fnb: fnbSales,
        moto: motoSales,
        golf: golfSales,
        other: otherSales,
        room: roomSales,
        total: leisureSales + fnbSales + motoSales + golfSales + otherSales + roomSales,
        grandTotal: leisureSales + fnbSales + motoSales + golfSales + otherSales + excludeSales + roomSales,

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
  }, [monthlyData, settings.locationGroups]);

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

      {/* Chart Section */}
      <div className="chart-card" style={{padding: '20px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-glass)'}}>
        <h3 style={{margin: '0 0 20px 0'}}>
          {viewMode === 'monthly' ? '월별 부문 매출 추이' : '월 누적 부문 매출 추이'}
        </h3>
        <div style={{height: '400px', width: '100%', minWidth: 0, minHeight: 0}}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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

      {/* Data Table Section */}
      <div className="table-scroll-container" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>월 (Month)</th>
              <th>
                <div style={{marginBottom: '4px'}}>리조트 총매출</div>
                <span style={{fontSize:'11px', color:'var(--text-muted)', fontWeight:'normal', display:'block'}}>(객실+부대+제외)</span>
              </th>
              <th>
                <div style={{marginBottom: '4px'}}>부문 총매출</div>
                <span style={{fontSize:'11px', color:'var(--text-muted)', fontWeight:'normal', display:'block'}}>(제외업장 제외)</span>
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
                  {viewMode === 'monthly' ? formatCurrency(row.grandTotal) : '-'}
                </td>
                <td style={{fontWeight: 'bold', color: 'var(--text-main)'}}>
                  {viewMode === 'monthly' ? formatCurrency(row.total) : formatCurrency(row.cumTotal)}
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
