import React, { useState } from 'react';
import { Ticket, ChevronDown, ChevronUp } from 'lucide-react';
import './Settings.css';

export default function LeisureTicketManager({ settings, setSettings, uniqueLeisureTickets }) {
  const rules = settings.leisureTicketRules || {};
  const [expandedVenues, setExpandedVenues] = useState({});

  const toggleVenue = (venue) => {
    setExpandedVenues(prev => ({
      ...prev,
      [venue]: !prev[venue]
    }));
  };

  const updateRule = (compositeKey, field, value) => {
    setSettings(prev => ({
      ...prev,
      leisureTicketRules: {
        ...(prev.leisureTicketRules || {}),
        [compositeKey]: {
          ...(prev.leisureTicketRules?.[compositeKey] || { count: 1, exclude: true, customVenue: '' }),
          [field]: value
        }
      }
    }));
  };

  // 영업장별로 티켓 그룹핑
  const groupedTickets = (uniqueLeisureTickets || []).reduce((acc, compositeKey) => {
    const [venue, ticket] = compositeKey.split('___');
    if (!acc[venue]) acc[venue] = [];
    acc[venue].push({ ticket, compositeKey });
    return acc;
  }, {});

  return (
    <div style={{color: 'var(--text-main)'}}>
      {Object.keys(groupedTickets).length === 0 ? (
        <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)'}}>
          업로드된 영업장 트랜잭션 데이터가 없습니다.
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {Object.entries(groupedTickets).map(([venue, tickets]) => {
            const isExpanded = expandedVenues[venue];
            // 해당 영업장에서 현재 산출에 포함된(exclude=false) 티켓 수 계산
            const includedCount = tickets.filter(t => {
              const rule = rules[t.compositeKey];
              // 기본값은 exclude: true 이므로, 명시적으로 exclude가 false인 것만 포함
              return rule && rule.exclude === false;
            }).length;

            return (
              <div key={venue} style={{background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-glass)', overflow: 'hidden'}}>
                {/* 아코디언 헤더 */}
                <div 
                  onClick={() => toggleVenue(venue)}
                  style={{
                    padding: '16px 20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <h4 style={{margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-main)'}}>{venue}</h4>
                    <span style={{fontSize: '12px', background: 'rgba(52, 211, 153, 0.2)', color: 'var(--accent-emerald)', padding: '2px 8px', borderRadius: '12px'}}>
                      포함 중: {includedCount} / {tickets.length}개
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={18} style={{color: 'var(--text-muted)'}}/> : <ChevronDown size={18} style={{color: 'var(--text-muted)'}}/>}
                </div>

                {/* 아코디언 내용 */}
                {isExpanded && (
                  <div style={{padding: '0 20px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{overflowX: 'auto', marginTop: '16px'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                          <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                            <th style={{textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500'}}>트랜잭션(품목)명</th>
                            <th style={{textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', width: '120px'}}>이용객 산출에 포함</th>
                            <th style={{textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', width: '100px'}}>1장당 인원수</th>
                            <th style={{textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', width: '140px'}}>집계 그룹명 덮어쓰기</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tickets.map(({ ticket, compositeKey }) => {
                            const rule = rules[compositeKey] || { count: 1, exclude: true, customVenue: '' };
                            const isIncluded = !rule.exclude;
                            
                            return (
                              <tr key={compositeKey} style={{borderBottom: '1px solid rgba(255,255,255,0.05)', background: isIncluded ? 'rgba(52, 211, 153, 0.05)' : 'transparent'}}>
                                <td style={{padding: '10px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: isIncluded ? 'var(--text-main)' : 'var(--text-muted)'}}>
                                  <Ticket size={14} style={{color: isIncluded ? 'var(--accent-emerald)' : 'var(--text-muted)'}} />
                                  {ticket}
                                </td>
                                <td style={{padding: '10px 12px', textAlign: 'center'}}>
                                  <label style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px', fontSize: '13px', color: isIncluded ? 'var(--accent-emerald)' : 'var(--text-muted)'}}>
                                    <input 
                                      type="checkbox" 
                                      checked={isIncluded}
                                      onChange={(e) => updateRule(compositeKey, 'exclude', !e.target.checked)}
                                      style={{width: '16px', height: '16px', cursor: 'pointer'}}
                                    />
                                    {isIncluded ? '포함' : '제외'}
                                  </label>
                                </td>
                                <td style={{padding: '10px 12px', textAlign: 'center'}}>
                                  <input 
                                    type="number" 
                                    min="1"
                                    value={rule.count || 1}
                                    onChange={(e) => updateRule(compositeKey, 'count', Number(e.target.value))}
                                    disabled={!isIncluded}
                                    style={{
                                      width: '60px', background: isIncluded ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)', 
                                      color: isIncluded ? 'white' : 'rgba(255,255,255,0.3)', padding: '4px', borderRadius: '4px', outline: 'none', textAlign: 'center'
                                    }}
                                  />
                                </td>
                                <td style={{padding: '10px 12px', textAlign: 'center'}}>
                                  <input 
                                    type="text" 
                                    placeholder="기본(영업장명)"
                                    value={rule.customVenue || ''}
                                    onChange={(e) => updateRule(compositeKey, 'customVenue', e.target.value)}
                                    disabled={!isIncluded}
                                    style={{
                                      width: '120px', background: isIncluded ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)', 
                                      color: isIncluded ? 'white' : 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontSize: '12px'
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
