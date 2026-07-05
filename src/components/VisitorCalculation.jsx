import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Car, UserMinus, UserCheck, Calendar, FileText } from 'lucide-react';
import { parseSafeNumber } from '../utils/statUtils';

export default function VisitorCalculation({ processedData, globalStats, settings }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Set default month
  useEffect(() => {
    if (processedData && processedData.length > 0 && !selectedMonth) {
      // Sort by yearMonth descending and pick first
      const sorted = [...processedData].sort((a, b) => (b.id || b.yearMonth || '').localeCompare(a.id || a.yearMonth || ''));
      setSelectedMonth(sorted[0].yearMonth);
    }
  }, [processedData, selectedMonth]);

  const targetDoc = useMemo(() => {
    if (!selectedMonth || !processedData) return null;
    return processedData.find(d => d.yearMonth === selectedMonth);
  }, [selectedMonth, processedData]);

  // Calculate Staying Guests directly from the processedData (set by backend)
  const stayingGuests = useMemo(() => {
    if (!targetDoc) return 0;
    return targetDoc.guests || 0;
  }, [targetDoc]);

  // Backend now provides accurate data. No more carPeopleWeight math.
  const numTotalVehicles = parseSafeNumber(targetDoc?.visitorData?.totalVehicles);
  const numEmployeeVehicles = parseSafeNumber(targetDoc?.visitorData?.employeeVehicles);
  const numGolfGuests = parseSafeNumber(targetDoc?.visitorData?.golfGuests);
  const netVehicles = Math.max(0, numTotalVehicles - numEmployeeVehicles);

  // Use leisureVisitorBreakdown to calculate actual visitors (backend provided)
  const totalVisitors = useMemo(() => {
    if (!targetDoc?.leisureVisitorBreakdown) return 0;
    return targetDoc.leisureVisitorBreakdown.reduce((sum, item) => sum + (Number(item.visitors) || 0), 0);
  }, [targetDoc]);

  const estimatedPeople = totalVisitors; // Display actual visitors instead of estimated
  const walkInGuests = Math.max(0, totalVisitors - stayingGuests - numGolfGuests);

  const getVisitorStatsForDoc = (docData) => {
    const sGuests = docData.guests || 0;
    let nTotalVehicles = 0;
    let nEmployeeVehicles = 0;
    let nGolfGuests = 0;
    
    if (docData.visitorData) {
      nTotalVehicles = parseSafeNumber(docData.visitorData.totalVehicles);
      nEmployeeVehicles = parseSafeNumber(docData.visitorData.employeeVehicles);
      nGolfGuests = parseSafeNumber(docData.visitorData.golfGuests);
    }

    const nVehicles = Math.max(0, nTotalVehicles - nEmployeeVehicles);
    
    let tVisitors = 0;
    if (docData.leisureVisitorBreakdown) {
      tVisitors = docData.leisureVisitorBreakdown.reduce((sum, item) => sum + (Number(item.visitors) || 0), 0);
    }
    
    const estPeople = tVisitors;
    const wInGuests = Math.max(0, tVisitors - sGuests - nGolfGuests);

    return {
      numTotalVehicles: nTotalVehicles,
      numEmployeeVehicles: nEmployeeVehicles,
      numGolfGuests: nGolfGuests,
      stayingGuests: sGuests,
      netVehicles: nVehicles,
      estimatedPeople: estPeople,
      totalVisitors: tVisitors,
      walkInGuests: wInGuests
    };
  };

  const monthlyStats = useMemo(() => {
    if (!processedData) return [];
    return [...processedData].sort((a, b) => (b.id || b.yearMonth || '').localeCompare(a.id || a.yearMonth || '')).map(d => ({
      yearMonth: d.yearMonth,
      ...getVisitorStatsForDoc(d)
    }));
  }, [processedData]);

  const totals = useMemo(() => {
    return monthlyStats.reduce((acc, curr) => {
      acc.numTotalVehicles += curr.numTotalVehicles;
      acc.numEmployeeVehicles += curr.numEmployeeVehicles;
      acc.numGolfGuests += curr.numGolfGuests;
      acc.stayingGuests += curr.stayingGuests;
      acc.netVehicles += curr.netVehicles;
      acc.estimatedPeople += curr.estimatedPeople;
      acc.totalVisitors += curr.totalVisitors;
      acc.walkInGuests += curr.walkInGuests;
      return acc;
    }, {
      numTotalVehicles: 0,
      numEmployeeVehicles: 0,
      numGolfGuests: 0,
      stayingGuests: 0,
      netVehicles: 0,
      estimatedPeople: 0,
      totalVisitors: 0,
      walkInGuests: 0
    });
  }, [monthlyStats]);

  const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num);

  return (
    <div className="visitor-calc-container">
      <div className="section-header" style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <Users size={32} color="var(--accent-blue)" />
          실측 방문객 분석
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          차량 관제 시스템 및 부대시설 포스기, 예약 시스템의 실측 데이터를 기반으로 전체 방문객 및 순수 워크인(Walk-in) 인원을 분석합니다.
        </p>
      </div>

      {/* ⚠️ 추정치 주의 배너 */}
      <div className="glass-panel" style={{
        padding: '16px 24px', 
        marginBottom: '24px', 
        background: 'rgba(245, 158, 11, 0.1)', 
        border: '1px solid rgba(245, 158, 11, 0.3)', 
        borderRadius: '8px',
        color: 'var(--accent-gold)',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span>⚠️ 자동 연동 안내: 본 화면의 지표는 프론트엔드의 가중치 연산 없이 100% 백엔드의 데이터 원시값을 그대로 연동하여 정확한 지표를 제공합니다.</span>
      </div>

      {/* Month Selection */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={24} color="var(--accent-blue)" />
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>기준 월 선택:</span>
        </div>
        <select 
          className="date-select" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ width: '200px' }}
        >
          {processedData && processedData.map(d => (
            <option key={d.yearMonth} value={d.yearMonth}>{d.yearMonth}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Read-only Data Section */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-blue)' }}>
            <FileText size={20} />
            기초 실측 데이터 (자동 연동)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>전체 입차 차량 수 (대)</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-light)' }}>{formatNumber(numTotalVehicles)} 대</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>직원 및 업무 차량 수 (대)</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-light)' }}>{formatNumber(numEmployeeVehicles)} 대</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>골프 고객 수 (명)</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-light)' }}>{formatNumber(numGolfGuests)} 명</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>숙박객 수 (명)</span>
              <strong style={{ fontSize: '18px', color: 'var(--accent-emerald)' }}>{formatNumber(stayingGuests)} 명</strong>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <motion.div 
            className="glass-panel" 
            style={{ padding: '24px', background: 'rgba(0,0,0,0.3)' }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>1단계: 총 방문객 확인 (백엔드 실측치)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '16px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Car size={16} /> 순수 입차 차량
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>(전체 차량 - 직원 차량)</div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatNumber(netVehicles)} 대</div>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '16px', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} /> 실측 기반 총 유입 인원
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>(백엔드 제공 총 방문객 실측치)</div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>{formatNumber(estimatedPeople)} 명</div>
            </div>
          </motion.div>

          <motion.div 
            className="glass-panel" 
            style={{ padding: '24px', background: 'rgba(0,0,0,0.3)' }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>2단계: 부대시설/객실 방문객 통합 산출</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '16px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserMinus size={16} /> 총 방문객
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>(백엔드 연동 실측 총 인원)</div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-light)' }}>{formatNumber(totalVisitors)} 명</div>
            </div>
          </motion.div>

          <motion.div 
            className="glass-panel" 
            style={{ padding: '32px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div style={{ color: 'var(--accent-emerald)', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>최종 도출 결과</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '20px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={24} color="var(--accent-emerald)" /> 외부 유입 순수 고객
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>총 방문객에서 숙박객과 골프 고객을 제외한 순수 워크인(Walk-in) 고객입니다.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '40px', fontWeight: 'bold', color: walkInGuests < 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)', textShadow: `0 0 20px ${walkInGuests < 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` }}>
                  {formatNumber(walkInGuests)} 명
                </div>
                {walkInGuests < 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--accent-coral)', marginTop: '4px' }}>
                     [안내] 데이터가 누락되었거나 연산 오차가 있을 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Monthly Stats Table */}
      <div className="glass-panel" style={{ padding: '32px', marginTop: '32px' }}>
        <h3 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-blue)' }}>
          <FileText size={20} />
          월별 방문객 현황 및 총 합산 결과
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>월(Month)</th>
                <th style={{ padding: '12px', color: 'var(--text-muted)' }}>전체 차량</th>
                <th style={{ padding: '12px', color: 'var(--text-muted)' }}>직원 차량</th>
                <th style={{ padding: '12px', color: 'var(--text-muted)' }}>순수 차량</th>
                <th style={{ padding: '12px', color: 'var(--accent-purple)' }}>실측 인원</th>
                <th style={{ padding: '12px', color: 'var(--text-muted)' }}>골프 고객</th>
                <th style={{ padding: '12px', color: 'var(--text-light)', fontWeight: 'bold' }}>총 방문객</th>
                <th style={{ padding: '12px', color: 'var(--text-muted)' }}>숙박객</th>
                <th style={{ padding: '12px', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>순수 워크인</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.map(stat => (
                <tr key={stat.yearMonth} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{stat.yearMonth}</td>
                  <td style={{ padding: '12px' }}>{formatNumber(stat.numTotalVehicles)}</td>
                  <td style={{ padding: '12px' }}>{formatNumber(stat.numEmployeeVehicles)}</td>
                  <td style={{ padding: '12px' }}>{formatNumber(stat.netVehicles)}</td>
                  <td style={{ padding: '12px', color: 'var(--accent-purple)' }}>{formatNumber(stat.estimatedPeople)}</td>
                  <td style={{ padding: '12px' }}>{formatNumber(stat.numGolfGuests)}</td>
                  <td style={{ padding: '12px', color: 'var(--text-light)', fontWeight: 'bold' }}>{formatNumber(stat.totalVisitors)}</td>
                  <td style={{ padding: '12px' }}>{formatNumber(stat.stayingGuests)}</td>
                  <td style={{ padding: '12px', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>{formatNumber(stat.walkInGuests)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(59, 130, 246, 0.1)', fontWeight: 'bold', borderTop: '2px solid rgba(59, 130, 246, 0.3)' }}>
                <td style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--accent-blue)' }}>총 합산</td>
                <td style={{ padding: '16px 12px', color: 'var(--text-light)' }}>{formatNumber(totals.numTotalVehicles)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--text-light)' }}>{formatNumber(totals.numEmployeeVehicles)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--text-light)' }}>{formatNumber(totals.netVehicles)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--accent-purple)' }}>{formatNumber(totals.estimatedPeople)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--text-light)' }}>{formatNumber(totals.numGolfGuests)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--text-light)', fontSize: '18px' }}>{formatNumber(totals.totalVisitors)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--text-light)' }}>{formatNumber(totals.stayingGuests)}</td>
                <td style={{ padding: '16px 12px', color: 'var(--accent-emerald)', fontSize: '18px' }}>{formatNumber(totals.walkInGuests)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
