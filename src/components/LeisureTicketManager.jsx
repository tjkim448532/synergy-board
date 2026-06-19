import React from 'react';
import { Ticket, Users } from 'lucide-react';
import './Settings.css';

export default function LeisureTicketManager({ settings, setSettings, uniqueLeisureTickets }) {
  const rules = settings.leisureTicketRules || {};

  const updateRule = (compositeKey, field, value) => {
    setSettings(prev => ({
      ...prev,
      leisureTicketRules: {
        ...(prev.leisureTicketRules || {}),
        [compositeKey]: {
          ...(prev.leisureTicketRules?.[compositeKey] || { count: 1, exclude: false, customVenue: '' }),
          [field]: value
        }
      }
    }));
  };

  return (
    <div style={{color: 'var(--text-main)'}}>
      <div style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px'}}>
        {(!uniqueLeisureTickets || uniqueLeisureTickets.length === 0) ? (
          <div style={{color: 'rgba(255,255,255,0.5)', textAlign: 'center'}}>업로드된 레저본부 티켓 데이터가 없습니다.</div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                  <th style={{textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500'}}>영업장</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500'}}>티켓명</th>
                  <th style={{textAlign: 'center', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', width: '120px'}}>집계 그룹명 변경</th>
                  <th style={{textAlign: 'center', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', width: '100px'}}>1장당 인원수</th>
                  <th style={{textAlign: 'center', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', width: '80px'}}>집계 제외</th>
                </tr>
              </thead>
              <tbody>
                {uniqueLeisureTickets.map(compositeKey => {
                  const [venue, ticket] = compositeKey.split('___');
                  const rule = rules[compositeKey] || { count: 1, exclude: false, customVenue: '' };
                  
                  return (
                    <tr key={compositeKey} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                      <td style={{padding: '10px 16px', fontSize: '13px'}}>{venue}</td>
                      <td style={{padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <Ticket size={14} style={{color: 'var(--accent-emerald)'}} />
                        {ticket}
                      </td>
                      <td style={{padding: '10px 16px', textAlign: 'center'}}>
                        <input 
                          type="text" 
                          placeholder="기본(영업장명)"
                          value={rule.customVenue || ''}
                          onChange={(e) => updateRule(compositeKey, 'customVenue', e.target.value)}
                          style={{
                            width: '100px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', 
                            color: 'white', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontSize: '12px'
                          }}
                        />
                      </td>
                      <td style={{padding: '10px 16px', textAlign: 'center'}}>
                        <input 
                          type="number" 
                          min="1"
                          value={rule.count || 1}
                          onChange={(e) => updateRule(compositeKey, 'count', Number(e.target.value))}
                          style={{
                            width: '60px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', 
                            color: 'white', padding: '4px', borderRadius: '4px', outline: 'none', textAlign: 'center'
                          }}
                        />
                      </td>
                      <td style={{padding: '10px 16px', textAlign: 'center'}}>
                        <label style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
                          <input 
                            type="checkbox" 
                            checked={rule.exclude || false}
                            onChange={(e) => updateRule(compositeKey, 'exclude', e.target.checked)}
                            style={{width: '16px', height: '16px', cursor: 'pointer'}}
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
