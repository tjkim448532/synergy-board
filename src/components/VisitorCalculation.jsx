import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Car, UserMinus, UserCheck, Save, Calendar, FileText } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { parseSafeNumber } from '../utils/statUtils';

export default function VisitorCalculation({ processedData, globalStats, settings }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // States for inputs
  const [totalVehicles, setTotalVehicles] = useState('');
  const [employeeVehicles, setEmployeeVehicles] = useState('');
  const [golfGuests, setGolfGuests] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Set default month
  useEffect(() => {
    if (processedData && processedData.length > 0 && !selectedMonth) {
      // Sort by yearMonth descending and pick first
      const sorted = [...processedData].sort((a, b) => (b.id || b.yearMonth || '').localeCompare(a.id || a.yearMonth || ''));
      setSelectedMonth(sorted[0].yearMonth);
    }
  }, [processedData, selectedMonth]);

  // Load saved data when month changes
  useEffect(() => {
    if (selectedMonth && processedData) {
      const targetData = processedData.find(d => d.yearMonth === selectedMonth);
      if (targetData && targetData.visitorCalcData) {
        setTotalVehicles(targetData.visitorCalcData.totalVehicles || '');
        setEmployeeVehicles(targetData.visitorCalcData.employeeVehicles || '');
        setGolfGuests(targetData.visitorCalcData.golfGuests || '');
      } else {
        setTotalVehicles('');
        setEmployeeVehicles('');
        setGolfGuests('');
      }
    }
  }, [selectedMonth, processedData]);

  const targetDoc = useMemo(() => {
    if (!selectedMonth || !processedData) return null;
    return processedData.find(d => d.yearMonth === selectedMonth);
  }, [selectedMonth, processedData]);

  // Calculate Staying Guests directly from the processedData (just like AdvancedAnalytics)
  const stayingGuests = useMemo(() => {
    if (!targetDoc) return 0;
    if (targetDoc.guests !== undefined) return targetDoc.guests;
    
    const weight16 = settings?.guestWeight16 !== undefined ? parseSafeNumber(settings.guestWeight16) : 2.5;
    const weight35 = settings?.guestWeight35 !== undefined ? parseSafeNumber(settings.guestWeight35) : 3.5;
    const weight51 = settings?.guestWeight51 !== undefined ? parseSafeNumber(settings.guestWeight51) : 6.0;
    
    const sold16 = parseSafeNumber(targetDoc.sold16 || targetDoc.standardSold);
    const sold35 = parseSafeNumber(targetDoc.sold35);
    const sold51 = parseSafeNumber(targetDoc.sold51 || targetDoc.connectingSold);
    const sold51Acc = parseSafeNumber(targetDoc.sold51Acc);
    
    return Math.round((sold16 * weight16) + (sold35 * weight35) + ((sold51 + sold51Acc) * weight51));
  }, [targetDoc, settings]);

  const carPeopleWeight = settings?.carPeopleWeight !== undefined ? parseSafeNumber(settings.carPeopleWeight) : 3.0;

  // Derived calculations
  const numTotalVehicles = parseSafeNumber(totalVehicles);
  const numEmployeeVehicles = parseSafeNumber(employeeVehicles);
  const numGolfGuests = parseSafeNumber(golfGuests);

  const netVehicles = Math.max(0, numTotalVehicles - numEmployeeVehicles);
  const estimatedPeople = netVehicles * carPeopleWeight;
  const totalVisitors = estimatedPeople - numGolfGuests;
  const walkInGuests = totalVisitors - stayingGuests;

  const getStayingGuestsForDoc = (docData) => {
    if (docData.guests !== undefined) return docData.guests;
    
    const weight16 = settings?.guestWeight16 !== undefined ? parseSafeNumber(settings.guestWeight16) : 2.5;
    const weight35 = settings?.guestWeight35 !== undefined ? parseSafeNumber(settings.guestWeight35) : 3.5;
    const weight51 = settings?.guestWeight51 !== undefined ? parseSafeNumber(settings.guestWeight51) : 6.0;
    
    const sold16 = parseSafeNumber(docData.sold16 || docData.standardSold);
    const sold35 = parseSafeNumber(docData.sold35);
    const sold51Combined = parseSafeNumber(docData.sold51 || docData.connectingSold);
    const sold51Acc = parseSafeNumber(docData.sold51Acc);
    
    return Math.round((sold16 * weight16) + (sold35 * weight35) + ((sold51Combined + sold51Acc) * weight51));
  };

  const getVisitorStatsForDoc = (docData) => {
    const sGuests = getStayingGuestsForDoc(docData);
    let nTotalVehicles = 0;
    let nEmployeeVehicles = 0;
    let nGolfGuests = 0;
    
    if (docData.visitorCalcData) {
      nTotalVehicles = parseSafeNumber(docData.visitorCalcData.totalVehicles);
      nEmployeeVehicles = parseSafeNumber(docData.visitorCalcData.employeeVehicles);
      nGolfGuests = parseSafeNumber(docData.visitorCalcData.golfGuests);
    }

    const nVehicles = Math.max(0, nTotalVehicles - nEmployeeVehicles);
    const estPeople = nVehicles * carPeopleWeight;
    const tVisitors = estPeople - nGolfGuests;
    const wInGuests = tVisitors - sGuests;

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

  const handleSave = async () => {
    if (!targetDoc || !targetDoc.id) {
      toast.error('저장할 월별 데이터를 찾을 수 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'monthly_records', targetDoc.id);
      await updateDoc(docRef, {
        visitorCalcData: {
          totalVehicles: numTotalVehicles,
          employeeVehicles: numEmployeeVehicles,
          golfGuests: numGolfGuests
        }
      });
      toast.success(`${selectedMonth} 방문객 기록이 저장되었습니다!`);
    } catch (err) {
      console.error("Save error:", err);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num);

  return (
    <div className="visitor-calc-container">
      <div className="section-header" style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <Users size={32} color="var(--accent-blue)" />
          전체 방문객 수 역산 (Walk-in 도출)
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          차량 입차 기록과 기숙사/직원 차량, 그리고 골프/숙박 고객 데이터를 역산하여 리조트를 방문한 순수 워크인(Walk-in) 고객을 도출합니다.
        </p>
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
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={isSaving || !selectedMonth}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Save size={18} />
          {isSaving ? '저장 중...' : '계산 결과 저장'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Input Section */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-blue)' }}>
            <FileText size={20} />
            기초 데이터 입력
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>전체 입차 차량 수 (대)</label>
              <input 
                type="number" 
                className="input-field" 
                value={totalVehicles} 
                onChange={e => setTotalVehicles(e.target.value)} 
                placeholder="예: 5000"
                style={{ width: '100%', fontSize: '18px', padding: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>직원 및 업무 차량 수 (대)</label>
              <input 
                type="number" 
                className="input-field" 
                value={employeeVehicles} 
                onChange={e => setEmployeeVehicles(e.target.value)} 
                placeholder="예: 800"
                style={{ width: '100%', fontSize: '18px', padding: '12px' }}
              />
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>골프 고객 수 (명)</label>
              <input 
                type="number" 
                className="input-field" 
                value={golfGuests} 
                onChange={e => setGolfGuests(e.target.value)} 
                placeholder="예: 1500"
                style={{ width: '100%', fontSize: '18px', padding: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>숙박객 수 (명) <span style={{fontSize: '12px', color: 'var(--accent-emerald)'}}>(*자동 연동됨)</span></label>
              <div style={{ 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px dashed rgba(255,255,255,0.2)', 
                padding: '12px', 
                borderRadius: '8px',
                fontSize: '18px',
                color: 'var(--text-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{selectedMonth || '월 미선택'} 숙박객:</span>
                <strong style={{color: 'var(--accent-emerald)'}}>{formatNumber(stayingGuests)} 명</strong>
              </div>
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
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>1단계: 순수 입차 차량 및 방문 인원 추산</div>
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
                  <Users size={16} /> 차량 탑승 인원 추산
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>(순수 입차 차량 × 3명)</div>
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
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>2단계: 복합 리조트 총 방문객 계산</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '16px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserMinus size={16} /> 총 방문객
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>(차량 탑승 인원 - 골프 고객)</div>
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
                  <UserCheck size={24} color="var(--accent-emerald)" /> 순수 워크인(Walk-in) 고객
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>총 방문객에서 숙박객({formatNumber(stayingGuests)}명)을 제외한 외부 유입 순수 고객입니다.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '40px', fontWeight: 'bold', color: walkInGuests < 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)', textShadow: `0 0 20px ${walkInGuests < 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` }}>
                  {formatNumber(walkInGuests)} 명
                </div>
                {walkInGuests < 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--accent-coral)', marginTop: '4px' }}>
                    ⚠️ [경고] 워크인이 음수입니다. [설정] 탭의 객실당 투숙 인원 가중치가 너무 높게 잡혀있을 수 있습니다.
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
                <th style={{ padding: '12px', color: 'var(--accent-purple)' }}>추산 인원</th>
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
