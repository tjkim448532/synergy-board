import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { isHoliday } from 'korean-holidays';
import { parseSafeNumber, safeRate, calculateCorrelation } from '../utils/statUtils';
import { isRoomWeekend } from '../utils/revenueUtils';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

const PIE_COLORS = ['#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#ef4444', '#64748b'];

// 마켓 타입을 주요 채널로 정규화하는 헬퍼 함수 (V4 API 대응)
const normalizeMarketType = (market) => {
  if (!market) return '기타';
  const m = market.toUpperCase();
  if (m.includes('온라인') || m.includes('OTA') || m.includes('AGODA') || m.includes('야놀자') || m.includes('여기어때')) return '온라인';
  if (m.includes('기업') || m.includes('휴양소') || m.includes('법인')) return '휴양소';
  if (m.includes('세미나') || m.includes('단체') || m.includes('MICE') || m.includes('행사')) return '세미나';
  if (m.includes('예약실') || m.includes('전화') || m.includes('메신저') || m.includes('분양회원') || m.includes('회원')) return '예약실';
  if (m.includes('홈페이지') || m.includes('APP') || m.includes('자사채널') || m.includes('다이렉트')) return '홈페이지';
  return '기타';
};

// 룸 타입을 정규화하는 헬퍼 함수
const normalizeRoomType = (type) => {
  if (!type) return '기타';
  if (type.includes('16평')) return '16평';
  if (type.includes('35평')) return '35평';
  if (type.includes('51평')) return '51평';
  return '기타';
};

export default function ChannelAnalysis({ processedData, globalStats, settings }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');

  // fallback for legacy cached state like '05'
  useEffect(() => {
    if (selectedMonthFilter !== 'all' && !selectedMonthFilter.includes('-')) {
      setSelectedMonthFilter('all');
    }
  }, [selectedMonthFilter]);

  // 동적 필터 옵션 생성
  const monthOptions = useMemo(() => {
    const options = [];
    const validData = processedData;
    const years = [...new Set(validData.map(d => (d.yearMonth || '').split('-')[0]))].filter(y => y);
    years.sort((a,b) => b.localeCompare(a));
    
    years.forEach(year => {
      const yearMonths = validData.filter(d => (d.yearMonth || '').startsWith(year));
      if (yearMonths.length > 0) {
        options.push({ value: `${year}-all`, label: `${year}년 종합 분석` });
        for (let m = 1; m <= 12; m++) {
          const mm = String(m).padStart(2, '0');
          if (yearMonths.some(d => (d.yearMonth || '').split('-')[1] === mm)) {
            options.push({ value: `${year}-${mm}`, label: `${year}년 ${m}월 누적 (1~${m}월)` });
          }
        }
      }
    });
    return options;
  }, [processedData]);

  // Filter out recent months like AdvancedAnalytics does
  const filteredProcessedData = useMemo(() => {
    return processedData.filter(d => {
      if (selectedMonthFilter !== 'all') {
        const [selYear, selMonth] = selectedMonthFilter.split('-');
        const [y, m] = (d.yearMonth || '').split('-');
        if (y !== selYear) return false;
        if (selMonth !== 'all' && parseInt(m) > parseInt(selMonth)) return false;
      }
      return true;
    }).sort((a, b) => (a.id || a.yearMonth || '').localeCompare(b.id || b.yearMonth || ''));
  }, [processedData, selectedMonthFilter]);

  const divisionConfig = useMemo(() => {
    const config = {
      all: { title: '전체통합', dataKey: 'totalSales', color: 'var(--accent-emerald)' }
    };
    
    const locationGroups = settings.locationGroups || {};
    const groups = new Set(Object.values(locationGroups));
    groups.delete('exclude');
    groups.delete('golf');
    groups.delete('other');

    if (groups.has('leisure')) config.leisure = { title: '레저본부', dataKey: 'leisureSales', color: 'var(--accent-purple)' };
    if (groups.has('fnb')) config.fnb = { title: '식음 부문', dataKey: 'fnbSales', color: 'var(--accent-blue)' };
    if (groups.has('moto')) config.moto = { title: '모토아레나', dataKey: 'motoSales', color: 'var(--accent-gold)' };
    if (groups.has('golf')) config.golf = { title: '골프 부문', dataKey: 'golfSales', color: 'var(--accent-purple)' };
    if (groups.has('other')) config.other = { title: '기타 부문', dataKey: 'otherSales', color: '#94a3b8' };
    
    return config;
  }, [settings.locationGroups]);

  // We need to map data to include dataKey sums so correlation works
  const processedDataWithSales = filteredProcessedData;

  // 1. Overview 데이터 (기존 로직)
  const { channelData, negativeChannels, channelAdrData } = useMemo(() => {
    const channelMap = { '온라인': 0, '세미나': 0, '휴양소': 0, '예약실': 0, '홈페이지': 0, '기타': 0 };
    const adrMap = {
      '온라인': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '세미나': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '휴양소': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '예약실': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '홈페이지': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} },
      '기타': { '16평': {rev: 0, cnt: 0}, '35평': {rev: 0, cnt: 0}, '51평': {rev: 0, cnt: 0}, '전체': {rev: 0, cnt: 0} }
    };

    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const rev = parseSafeNumber(record.revenue);
          const cnt = parseSafeNumber(record.count);
          const channelName = normalizeMarketType(record.marketType);
          const typeName = normalizeRoomType(record.roomType);

          channelMap[channelName] += rev;

          if (typeName !== '기타') {
            adrMap[channelName][typeName].rev += rev;
            adrMap[channelName][typeName].cnt += cnt;
          }
          adrMap[channelName]['전체'].rev += rev;
          adrMap[channelName]['전체'].cnt += cnt;
        });
      }
    });

    const arr = Object.entries(channelMap).map(([name, value]) => ({ name, value }));
    const adrArr = Object.entries(adrMap).map(([channel, types]) => {
      return {
        channel,
        '16평': safeRate(types['16평'].rev, types['16평'].cnt),
        '35평': safeRate(types['35평'].rev, types['35평'].cnt),
        '51평': safeRate(types['51평'].rev, types['51평'].cnt),
        '전체': safeRate(types['전체'].rev, types['전체'].cnt),
        totalRev: types['전체'].rev
      };
    }).filter(d => d.totalRev > 0).sort((a, b) => b.totalRev - a.totalRev);

    return {
      channelData: arr.filter(d => d.value > 0).sort((a, b) => b.value - a.value),
      negativeChannels: arr.filter(d => d.value < 0).sort((a, b) => a.value - b.value),
      channelAdrData: adrArr
    };
  }, [processedDataWithSales]);

  // 2. 세부 거래처(Agency) Top 10 랭킹 보드
  const agencyData = useMemo(() => {
    const agencyMap = {};
    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const agency = record.agency?.trim() || '미지정/직접예약';
          if (record.revenue > 0) {
            agencyMap[agency] = (agencyMap[agency] || 0) + record.revenue;
          }
        });
      }
    });
    return Object.entries(agencyMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15); // Top 15
  }, [processedDataWithSales]);

  // 3. 채널별 주중/주말 실적 편차 분석
  const weekendData = useMemo(() => {
    const customWeekendsStr = settings?.customWeekends || '';
    const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);
    
    const channelMap = {};

    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          if (!record.date) return;
          const channelName = normalizeMarketType(record.marketType);
          if (!channelMap[channelName]) channelMap[channelName] = { 주중: 0, 주말: 0 };
          
          let isWeekend = false;
          try {
            isWeekend = isRoomWeekend(record.date, customWeekendsArray);
          } catch(e) {}

          if (isWeekend) {
            channelMap[channelName].주말 += record.revenue || 0;
          } else {
            channelMap[channelName].주중 += record.revenue || 0;
          }
        });
      }
    });

    return Object.entries(channelMap).map(([channel, data]) => {
      const total = data.주중 + data.주말;
      return {
        channel,
        주중: data.주중 > 0 ? data.주중 : 0,
        주말: data.주말 > 0 ? data.주말 : 0,
        주중비율: total > 0 ? (data.주중 / total * 100).toFixed(1) : 0,
        주말비율: total > 0 ? (data.주말 / total * 100).toFixed(1) : 0,
        total
      };
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  }, [processedDataWithSales, settings]);

  // 4. 요금제(Rate Type) ↔ 판매채널 교차 분석
  const rateTypeData = useMemo(() => {
    const rateMap = {};
    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const channelName = normalizeMarketType(record.marketType);
          const rateType = record.rateType?.trim() || '미지정';
          if (record.revenue > 0) {
            if (!rateMap[channelName]) rateMap[channelName] = {};
            rateMap[channelName][rateType] = (rateMap[channelName][rateType] || 0) + record.revenue;
          }
        });
      }
    });

    // 채널별 Top 3 요금제 추출
    const result = {};
    Object.keys(rateMap).forEach(channel => {
      const sortedRates = Object.entries(rateMap[channel])
        .map(([name, rev]) => ({ name, rev }))
        .sort((a, b) => b.rev - a.rev)
        .slice(0, 3);
      result[channel] = sortedRates;
    });
    return result;
  }, [processedDataWithSales]);

  // 5. 고질적인 취소/환불(마이너스 매출) 리스크 추적
  const cancelData = useMemo(() => {
    const cancelMap = {};
    let totalCancel = 0;
    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          if (record.revenue < 0) {
            const channelName = normalizeMarketType(record.marketType);
            const amount = Math.abs(record.revenue);
            cancelMap[channelName] = (cancelMap[channelName] || 0) + amount;
            totalCancel += amount;
          }
        });
      }
    });

    return Object.entries(cancelMap)
      .map(([channel, amount]) => ({ channel, 환불액: amount, 비중: totalCancel > 0 ? (amount/totalCancel*100).toFixed(1) : 0 }))
      .sort((a, b) => b.환불액 - a.환불액);
  }, [processedDataWithSales]);

  // 6. 평형(Room Type)별 주력 판매 채널 분석
  const roomToChannelData = useMemo(() => {
    const roomMap = {
      '16평': { '온라인': 0, '세미나': 0, '휴양소': 0, '예약실': 0, '홈페이지': 0, '기타': 0 },
      '35평': { '온라인': 0, '세미나': 0, '휴양소': 0, '예약실': 0, '홈페이지': 0, '기타': 0 },
      '51평': { '온라인': 0, '세미나': 0, '휴양소': 0, '예약실': 0, '홈페이지': 0, '기타': 0 }
    };

    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          const typeName = normalizeRoomType(record.roomType);
          const channelName = normalizeMarketType(record.marketType);
          if (typeName !== '기타' && record.revenue > 0) {
            roomMap[typeName][channelName] += record.revenue;
          }
        });
      }
    });

    return Object.entries(roomMap).map(([room, channels]) => {
      return { room, ...channels };
    });
  }, [processedDataWithSales]);

  // 7. 회원 vs 일반 (회원 비율 분석)
  const memberStats = useMemo(() => {
    let totMem = 0;
    let totGen = 0;
    let memWd = 0;
    let memWe = 0;
    let genWd = 0;
    let genWe = 0;

    const customWeekendsStr = settings?.customWeekends || '';
    const customWeekendsArray = customWeekendsStr.split(',').map(s => s.trim()).filter(s => s);

    processedDataWithSales.forEach(month => {
      if (month.rawRoomRecords) {
        month.rawRoomRecords.forEach(record => {
          if (!record.date) return;
          const cnt = record.count || 0;
          if (cnt <= 0) return;

          const rateType = record.rateType || '';
          const isNonMember = rateType.includes('비회원');
          const isMember = !isNonMember && (
            rateType.includes('회원') || 
            rateType.includes('정회원') || 
            rateType.includes('구좌') || 
            rateType.includes('기명') || 
            rateType.includes('무기명')
          );

          let isWeekend = false;
          try {
            const dateObj = new Date(record.date);
            const dayOfWeek = dateObj.getDay();
            const isFriOrSat = dayOfWeek === 5 || dayOfWeek === 6;
            
            const nextDay = new Date(dateObj);
            nextDay.setDate(dateObj.getDate() + 1);
            const isNextDayHoliday = isHoliday(nextDay);

            if (customWeekendsArray.includes(record.date) || isFriOrSat || isNextDayHoliday) {
              isWeekend = true;
            }
          } catch(e) {}

          if (isMember) {
            totMem += cnt;
            if (isWeekend) memWe += cnt;
            else memWd += cnt;
          } else {
            totGen += cnt;
            if (isWeekend) genWe += cnt;
            else genWd += cnt;
          }
        });
      }
    });

    const totalRooms = totMem + totGen;
    const totalWd = memWd + genWd;
    const totalWe = memWe + genWe;

    return {
      available: totalRooms > 0,
      totalRooms,
      totMem,
      memberRatio: totalRooms > 0 ? (totMem / totalRooms) * 100 : 0,
      generalRatio: totalRooms > 0 ? (totGen / totalRooms) * 100 : 0,
      memWd,
      memberWdRatio: totalWd > 0 ? (memWd / totalWd) * 100 : 0,
      generalWdRatio: totalWd > 0 ? (genWd / totalWd) * 100 : 0,
      memWe,
      memberWeRatio: totalWe > 0 ? (memWe / totalWe) * 100 : 0,
      generalWeRatio: totalWe > 0 ? (genWe / totalWe) * 100 : 0,
    };
  }, [processedDataWithSales, settings]);

  // Render Tabs
  const TABS = [
    { id: 'overview', label: '📊 전체 개요' },
    { id: 'agency', label: '🏆 거래처 랭킹' },
    { id: 'weekend', label: '📅 주중/주말 편차' },
    { id: 'rate', label: '🎫 요금제 분석' },
    { id: 'room', label: '🏨 평형별 채널비중' },
    { id: 'cancel', label: '⚠️ 환불 리스크' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* 객실 투숙객 유형 정밀 분석 (회원 vs 일반) */}
            {memberStats.available && (
              <div className="glass-panel" style={{marginBottom: '40px', padding: '24px', borderLeft: '4px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: '1 / -1'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'}}>
                  <div>
                    <h3 style={{margin: '0 0 8px 0', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                      👥 객실 투숙객 유형 정밀 분석 (회원 vs 일반)
                    </h3>
                    <p style={{fontSize: '13px', color: 'var(--text-muted)', margin: 0}}>
                      원본 엑셀 데이터의 <b>'요금타입(Rate Type)'</b> 컬럼만을 기준으로 회원과 일반객(비회원)을 분리합니다.<br/>
                      <span style={{color: 'var(--accent-blue)'}}>[회원 판별 기준]</span> '회원', '정회원', '구좌', '기명', '무기명' 키워드 포함 시 회원으로 간주 (단, '비회원' 텍스트 포함 시 비회원으로 처리)
                    </p>
                  </div>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px'}}>
                  {/* 전체 비율 */}
                  <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>총 판매 객실 중 회원 비중</div>
                    <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px'}}>
                      <span style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-blue)', lineHeight: 1}}>
                        {memberStats.memberRatio.toFixed(1)}%
                      </span>
                      <span style={{fontSize: '14px', color: 'var(--text-muted)', paddingBottom: '4px'}}>
                        ({formatCurrency(memberStats.totMem)} / {formatCurrency(memberStats.totalRooms)}실)
                      </span>
                    </div>
                    <div style={{width: '100%', height: '8px', background: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex'}}>
                      <div style={{width: `${memberStats.memberRatio}%`, background: 'var(--accent-blue)'}} />
                      <div style={{width: `${memberStats.generalRatio}%`, background: 'var(--text-muted)'}} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px'}}>
                      <span style={{color: 'var(--accent-blue)'}}>회원 {memberStats.memberRatio.toFixed(1)}%</span>
                      <span style={{color: 'var(--text-muted)'}}>일반 {memberStats.generalRatio.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* 주중 비율 */}
                  <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>주중(평일) 회원 비중</div>
                    <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px'}}>
                      <span style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-emerald)', lineHeight: 1}}>
                        {memberStats.memberWdRatio.toFixed(1)}%
                      </span>
                      <span style={{fontSize: '14px', color: 'var(--text-muted)', paddingBottom: '4px'}}>
                        ({formatCurrency(memberStats.memWd)}실)
                      </span>
                    </div>
                    <div style={{width: '100%', height: '8px', background: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex'}}>
                      <div style={{width: `${memberStats.memberWdRatio}%`, background: 'var(--accent-emerald)'}} />
                      <div style={{width: `${memberStats.generalWdRatio}%`, background: 'var(--text-muted)'}} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px'}}>
                      <span style={{color: 'var(--accent-emerald)'}}>회원 {memberStats.memberWdRatio.toFixed(1)}%</span>
                      <span style={{color: 'var(--text-muted)'}}>일반 {memberStats.generalWdRatio.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* 주말 비율 */}
                  <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px'}}>주말(공휴일 포함) 회원 비중</div>
                    <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px'}}>
                      <span style={{fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-purple)', lineHeight: 1}}>
                        {memberStats.memberWeRatio.toFixed(1)}%
                      </span>
                      <span style={{fontSize: '14px', color: 'var(--text-muted)', paddingBottom: '4px'}}>
                        ({formatCurrency(memberStats.memWe)}실)
                      </span>
                    </div>
                    <div style={{width: '100%', height: '8px', background: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex'}}>
                      <div style={{width: `${memberStats.memberWeRatio}%`, background: 'var(--accent-purple)'}} />
                      <div style={{width: `${memberStats.generalWeRatio}%`, background: 'var(--text-muted)'}} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px'}}>
                      <span style={{color: 'var(--accent-purple)'}}>회원 {memberStats.memberWeRatio.toFixed(1)}%</span>
                      <span style={{color: 'var(--text-muted)'}}>일반 {memberStats.generalWeRatio.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* 거시적 상관관계 */}
            <div style={{marginBottom: '40px'}}>
              <h3 style={{marginBottom: '20px'}}>채널 비중 ↔ 부대시설 및 전체매출 거시적 상관관계</h3>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px'}}>특정 예약 채널의 매출 비중이 높았던 월에 각 영업장 및 전체매출이 얼마나 함께 상승했는지를 보여주는 상관계수입니다. (0.4 이상 뚜렷한 연관, 0.7 이상 매우 강한 연관)</p>
              <div className="table-scroll-container hide-on-mobile" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
                  <thead>
                    <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                      <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)'}}>채널명</th>
                      {Object.entries(divisionConfig).map(([key, conf]) => (
                        <th key={key} style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>{conf.title} (상관도)</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['온라인', '세미나', '휴양소', '예약실', '홈페이지'].map((channel, idx) => {
                      const channelMonthlyRev = processedDataWithSales.map(d => {
                        let total = 0;
                        if (d.rawRoomRecords) {
                          d.rawRoomRecords.forEach(r => {
                            if (normalizeMarketType(r.marketType) === channel) total += r.revenue || 0;
                          });
                        }
                        return total;
                      });

                      const correlations = {};
                      Object.entries(divisionConfig).forEach(([key, conf]) => {
                        correlations[key] = calculateCorrelation(channelMonthlyRev, processedDataWithSales.map(d => d[conf.dataKey] || 0)) || 0;
                      });

                      const getColor = (r) => {
                        if (r >= 0.7) return 'var(--accent-emerald)';
                        if (r >= 0.4) return 'var(--accent-gold)';
                        if (r <= -0.4) return 'var(--accent-red)';
                        return 'var(--text-main)';
                      };

                      return (
                        <tr key={channel} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                          <td style={{padding: '12px', textAlign: 'left', fontWeight: 'bold'}}>{channel}</td>
                          {Object.entries(divisionConfig).map(([key, conf]) => (
                            <td key={key} style={{padding: '12px', color: getColor(correlations[key]), fontWeight: correlations[key] >= 0.4 ? 'bold' : 'normal'}}>
                              {correlations[key].toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
              {/* Pie Chart */}
              <div style={{width: '100%', height: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, minHeight: 0}}>
                <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)'}}>매출 비중</h4>
                <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        if (percent < 0.05) return null; // 5% 미만은 라벨 숨김
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12px" fontWeight="bold" style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}>
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      }}
                      outerRadius={120}
                      innerRadius={70}
                      cy="45%"
                      dataKey="value"
                      stroke="rgba(255,255,255,0.1)"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                      formatter={(val) => `₩${formatCurrency(val)}`} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* ADR Table */}
              <div style={{width: '100%', display: 'flex', flexDirection: 'column'}}>
                <h4 style={{margin: '0 0 10px 0', color: 'var(--text-main)', textAlign: 'center'}}>채널별 평형 객단가(ADR)</h4>
                <div className="table-scroll-container hide-on-mobile" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right'}}>
                    <thead>
                      <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)'}}>채널명</th>
                        <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>16평</th>
                        <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>35평</th>
                        <th style={{padding: '12px', color: 'var(--accent-gold)', borderBottom: '1px solid var(--border-glass)'}}>종합(평균)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelAdrData.map((row) => (
                        <tr key={row.channel} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                          <td style={{padding: '12px', textAlign: 'left', fontWeight: 'bold'}}>{row.channel}</td>
                          <td style={{padding: '12px'}}>{row['16평'] ? `₩${formatCurrency(row['16평'])}` : '-'}</td>
                          <td style={{padding: '12px'}}>{row['35평'] ? `₩${formatCurrency(row['35평'])}` : '-'}</td>
                          <td style={{padding: '12px', color: 'var(--accent-gold)', fontWeight: 'bold'}}>
                            {row['전체'] ? `₩${formatCurrency(row['전체'])}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </>
        );

      case 'agency':
        return (
          <div>
            <h3 style={{marginBottom: '10px'}}>세부 거래처(Agency) 매출 랭킹 Top 15</h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px'}}>
              B2B 및 OTA 대행사별 실제 매출 기여도를 상세히 파악합니다. '미지정/직접예약'은 워크인이나 자사 홈페이지 예약일 확률이 높습니다.
            </p>
            <div style={{height: '500px', width: '100%', minWidth: 0, minHeight: 0}}>
              <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={agencyData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => `₩${(val/10000).toFixed(0)}만`} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" width={120} tick={{fill: '#e2e8f0', fontSize: 12}} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                    formatter={(val) => `₩${formatCurrency(val)}`}
                  />
                  <Bar dataKey="revenue" fill="var(--accent-blue)" radius={[0, 4, 4, 0]}>
                    {agencyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'weekend':
        return (
          <div>
            <h3 style={{marginBottom: '10px'}}>채널별 주중/주말 실적 편차</h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px'}}>
              채널별로 주중과 주말 매출 발생 비율을 비교하여, 주말 의존도가 높은 채널과 주중 방어율이 높은 채널을 구분합니다.
            </p>
            <div style={{height: '400px', width: '100%', minWidth: 0, minHeight: 0}}>
              <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={weekendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="channel" stroke="#94a3b8" />
                  <YAxis tickFormatter={(val) => `₩${(val/10000).toFixed(0)}만`} stroke="#94a3b8" />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                    formatter={(val) => `₩${formatCurrency(val)}`}
                  />
                  <Legend />
                  <Bar dataKey="주중" stackId="a" fill="var(--accent-purple)" name="주중 매출" />
                  <Bar dataKey="주말" stackId="a" fill="var(--accent-gold)" name="주말 매출" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="table-scroll-container" style={{marginTop: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
                <thead>
                  <tr style={{background: 'rgba(255,255,255,0.05)'}}>
                    <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>채널명</th>
                    <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>주중 매출</th>
                    <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)'}}>주말 매출</th>
                    <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-purple)'}}>주중 비중</th>
                    <th style={{padding: '12px', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-gold)'}}>주말 비중</th>
                  </tr>
                </thead>
                <tbody>
                  {weekendData.map((row) => (
                    <tr key={row.channel} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                      <td style={{padding: '12px', fontWeight: 'bold'}}>{row.channel}</td>
                      <td style={{padding: '12px'}}>₩{formatCurrency(row.주중)}</td>
                      <td style={{padding: '12px'}}>₩{formatCurrency(row.주말)}</td>
                      <td style={{padding: '12px', color: 'var(--accent-purple)', fontWeight: 'bold'}}>{row.주중비율}%</td>
                      <td style={{padding: '12px', color: 'var(--accent-gold)', fontWeight: 'bold'}}>{row.주말비율}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'rate':
        return (
          <div>
            <h3 style={{marginBottom: '10px'}}>요금제(Rate Type) ↔ 판매채널 교차 분석</h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px'}}>
              각 마켓 채널별로 어떤 요금제/패키지가 가장 많이 팔렸는지 Top 3를 보여줍니다.
            </p>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
              {Object.keys(rateTypeData).sort().map(channel => (
                <div key={channel} className="glass-panel" style={{padding: '20px', background: 'rgba(255,255,255,0.03)'}}>
                  <h4 style={{marginTop: 0, color: 'var(--accent-emerald)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>{channel} 채널 주력 요금제</h4>
                  {rateTypeData[channel].length > 0 ? (
                    <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                      {rateTypeData[channel].map((rate, i) => (
                        <li key={rate.name} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? '1px dashed rgba(255,255,255,0.05)' : 'none'}}>
                          <span style={{color: 'var(--text-main)', fontSize: '13px'}}>{i+1}. {rate.name}</span>
                          <span style={{fontWeight: 'bold', fontSize: '13px'}}>₩{formatCurrency(rate.rev)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>데이터 없음</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'room':
        return (
          <div>
            <h3 style={{marginBottom: '10px'}}>평형(Room Type)별 주력 판매 채널 역추적</h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px'}}>
              특정 평형을 가장 많이 팔아치우는 1등 공신 채널을 확인합니다. 남아도는 평형을 채우기 위해 어떤 채널을 공략할지 결정할 수 있습니다.
            </p>
            <div style={{height: '400px', width: '100%', minWidth: 0, minHeight: 0}}>
              <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={roomToChannelData} layout="vertical" margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => `₩${(val/10000).toFixed(0)}만`} stroke="#94a3b8" />
                  <YAxis dataKey="room" type="category" stroke="#94a3b8" tick={{fontSize: 14, fontWeight: 'bold'}} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)'}}
                    formatter={(val) => `₩${formatCurrency(val)}`}
                  />
                  <Legend />
                  <Bar dataKey="온라인" stackId="a" fill={PIE_COLORS[0]} />
                  <Bar dataKey="세미나" stackId="a" fill={PIE_COLORS[1]} />
                  <Bar dataKey="휴양소" stackId="a" fill={PIE_COLORS[2]} />
                  <Bar dataKey="예약실" stackId="a" fill={PIE_COLORS[3]} />
                  <Bar dataKey="홈페이지" stackId="a" fill={PIE_COLORS[4]} />
                  <Bar dataKey="기타" stackId="a" fill={PIE_COLORS[5]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'cancel':
        return (
          <div>
            <h3 style={{marginBottom: '10px', color: 'var(--accent-red)'}}>고질적인 취소/환불 리스크 (마이너스 매출)</h3>
            <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px'}}>
              시스템상 마이너스 매출(환불, 노쇼 조정 등)이 유독 많이 발생하는 채널을 추적하여 리스크를 관리합니다.
            </p>
            
            {cancelData.length === 0 ? (
              <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
                마이너스 매출 내역이 없습니다.
              </div>
            ) : (
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px'}}>
                <div style={{height: '300px', width: '100%', minWidth: 0, minHeight: 0}}>
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={cancelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="channel" stroke="#94a3b8" />
                      <YAxis tickFormatter={(val) => `₩${(val/10000).toFixed(0)}만`} stroke="#94a3b8" />
                      <RechartsTooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--accent-red)'}}
                        formatter={(val) => `₩${formatCurrency(val)}`}
                      />
                      <Bar dataKey="환불액" fill="var(--accent-red)" radius={[4, 4, 0, 0]} name="취소/환불 총액" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="table-scroll-container" style={{background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center'}}>
                    <thead>
                      <tr style={{background: 'rgba(239,68,68,0.1)'}}>
                        <th style={{padding: '12px', borderBottom: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)'}}>채널명</th>
                        <th style={{padding: '12px', borderBottom: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)'}}>총 환불액</th>
                        <th style={{padding: '12px', borderBottom: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)'}}>전체 환불 중 비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelData.map((row) => (
                        <tr key={row.channel} style={{borderBottom: '1px solid rgba(239,68,68,0.1)'}}>
                          <td style={{padding: '12px', fontWeight: 'bold'}}>{row.channel}</td>
                          <td style={{padding: '12px'}}>₩{formatCurrency(row.환불액)}</td>
                          <td style={{padding: '12px', fontWeight: 'bold', color: 'var(--accent-red)'}}>{row.비중}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100vw'}}>
      <div className="glass-panel" style={{padding: '24px'}}>
        <h2 style={{marginTop: '0', color: 'var(--accent-blue)', fontSize: '24px', marginBottom: '8px'}}>객실 판매채널 심층 분석</h2>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px'}}>
          <p style={{fontSize: '14px', color: 'var(--text-muted)', margin: 0}}>
            업로드된 객실 로데이터의 Agency, Rate Type, 예약 일자 등을 활용하여 다각도 채널 분석을 제공합니다.
          </p>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '8px'}}>
            <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>월별 필터:</span>
            <select 
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              style={{background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: 'none', padding: '6px 12px', borderRadius: '4px', outline: 'none', fontWeight: 'bold'}}
            >
              <option value="all" style={{color: 'black'}}>전체 연도 종합 분석</option>
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value} style={{color: 'black'}}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '30px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '15px'}}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-main)',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                transition: 'all 0.2s',
                boxShadow: activeTab === tab.id ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div style={{minHeight: '400px'}}>
          {renderTabContent()}
        </div>

      </div>
    </div>
  );
}
