import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import CountUpModule from 'react-countup';
const CountUp = CountUpModule.default || CountUpModule;
import { Building2, Calculator, ArrowRight } from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(Math.round(val || 0));

export default function NewBusinessTraining({ monthlyData, settings }) {
  // Input states
  const [newRooms, setNewRooms] = useState(200);
  const [targetOcc, setTargetOcc] = useState(60);
  
  // Base Historical Metrics
  const baseMetrics = useMemo(() => {
    let totRev = 0;
    let totSold = 0;
    let totLeisure = 0;
    let totMotoGuest = 0;
    let totMotoTotal = 0;
    let totFnb = 0;
    
    const locationGroups = settings.locationGroups || {};

    monthlyData.forEach(d => {
      const sold16 = Number(d.sold16 || d.standardSold || 0);
      const sold35 = Number(d.sold35 || 0);
      const sold51 = Number(d.sold51 || d.connectingSold || 0);
      const sold51Acc = Number(d.sold51Acc || 0);
      
      const count51AsTwoRooms = settings.count51AsTwoRooms !== false;
      const totalSold = sold16 + sold35 + (count51AsTwoRooms ? sold51 * 2 : sold51) + sold51Acc;
      
      totSold += totalSold;
      totRev += Number(d.totalRoomRevenue || 0);
      
      let leisureSales = 0;
      let fnbSales = 0;
      
      if (d.salesByLocation) {
        Object.keys(d.salesByLocation).forEach(loc => {
          const group = locationGroups[loc] || 'leisure';
          if (group === 'leisure') leisureSales += d.salesByLocation[loc];
          else if (group === 'fnb') fnbSales += d.salesByLocation[loc];
        });
      } else {
        leisureSales += Number(d.totalLeisureSales || d.leisureSales || 0);
        fnbSales += Number(d.totalFnbSales || d.fnbSales || 0);
      }
      
      // Calculate Moto Arena Guest Revenue dynamically based on groupings
      let mGuestRev = 0;
      let mTotalRev = 0;
      if (d.motoBreakdown) {
        Object.keys(d.motoBreakdown).forEach(cat => {
          if (d.motoBreakdown[cat]) {
            Object.keys(d.motoBreakdown[cat]).forEach(ticket => {
              const rev = d.motoBreakdown[cat][ticket];
              mTotalRev += rev;
              let group = settings.motoTicketGroups?.[ticket];
              if (!group) {
                if (ticket.includes('ì½˜ë„') || ticket.includes('ê°ì‹¤')) group = 'guest';
                else if (ticket.includes('?¼ë°˜') || ticket.includes('ì¦í‰êµ°ë?') || ticket.includes('MOU') || ticket.includes('?¨ì²´')) group = 'general';
                else group = 'other';
              }
              if (group === 'guest') mGuestRev += rev;
            });
          }
        });
      } else {
        mGuestRev = Number(d.motoGuestRev || 0); // fallback to legacy
        mTotalRev = Number(d.motoTotalRev || d.totalMotoSales || d.motoSales || 0);
      }
      
      totLeisure += leisureSales;
      totMotoGuest += mGuestRev;
      totMotoTotal += mTotalRev;
      totFnb += fnbSales;
    });

    return {
      avgAdr: totSold > 0 ? totRev / totSold : 150000,
      leisurePerRoom: totSold > 0 ? totLeisure / totSold : 0,
      motoPerRoom: totSold > 0 ? totMotoGuest / totSold : 0,
      fnbPerRoom: totSold > 0 ? totFnb / totSold : 0,
      totRev,
      totLeisure,
      totMoto: totMotoTotal,
      totFnb,
      monthsCount: monthlyData.length || 1
    };
  }, [monthlyData, settings]);

  const [customAdr, setCustomAdr] = useState(null);
  
  // The actual ADR to use
  const activeAdr = customAdr !== null ? customAdr : Math.round(baseMetrics.avgAdr);

  // Simulation Calculations
  // Assuming 365 days a year for annual calculation
  const annualAvailableRooms = newRooms * 365;
  const annualSoldRooms = annualAvailableRooms * (targetOcc / 100);
  
  const expectedRoomRev = annualSoldRooms * activeAdr;
  const rawLeisureRev = annualSoldRooms * baseMetrics.leisurePerRoom;
  const rawMotoRev = annualSoldRooms * baseMetrics.motoPerRoom;
  const rawFnbRev = annualSoldRooms * baseMetrics.fnbPerRoom;

  const calculateCapaLimit = (rawExpected, totalHistorical, capaStr) => {
    if (!capaStr || isNaN(Number(capaStr))) return { value: rawExpected, isCapped: false };
    const capa = Number(capaStr);
    if (capa <= 0 || capa >= 100) {
      if (capa >= 100) return { value: 0, isCapped: true };
      return { value: rawExpected, isCapped: false };
    }
    
    // Annualized current revenue based on historical data
    const currentAnnualRev = (totalHistorical / baseMetrics.monthsCount) * 12;
    if (currentAnnualRev === 0) return { value: rawExpected, isCapped: false };

    const maxAnnualCapacity = currentAnnualRev / (capa / 100);
    const remainingCapacity = Math.max(0, maxAnnualCapacity - currentAnnualRev);
    
    const isCapped = rawExpected > remainingCapacity;
    return { 
      value: isCapped ? remainingCapacity : rawExpected, 
      isCapped
    };
  };

  const leisureSim = calculateCapaLimit(rawLeisureRev, baseMetrics.totLeisure, settings.capaLeisure);
  const motoSim = calculateCapaLimit(rawMotoRev, baseMetrics.totMoto, settings.capaMoto);
  const fnbSim = calculateCapaLimit(rawFnbRev, baseMetrics.totFnb, settings.capaFnb);

  const expectedLeisureRev = leisureSim.value;
  const expectedMotoRev = motoSim.value;
  const expectedFnbRev = fnbSim.value;
  
  const expectedTotalRev = expectedRoomRev + expectedLeisureRev + expectedMotoRev + expectedFnbRev;

  const chartData = [
    { name: 'ê°ì‹¤ ë§¤ì¶œ', value: expectedRoomRev, color: 'var(--accent-blue)' },
    { name: '?ìŒ(F&B)', value: expectedFnbRev, color: '#ef4444' }, // Red-ish for F&B
    { name: 'ëª¨í† ?„ë ˆ??, value: expectedMotoRev, color: 'var(--accent-gold)' },
    { name: '?ˆì?/ê¸°í?', value: expectedLeisureRev, color: 'var(--accent-emerald)' }
  ].filter(d => d.value > 0);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
      
      {/* Header */}
      <div className="glass-panel" style={{position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--accent-emerald)', minHeight: '220px', display: 'flex', alignItems: 'flex-end'}}>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url("/training-center.png")', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0}}></div>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.4) 50%, transparent 100%)', zIndex: 1}}></div>
        <div style={{padding: '32px 32px 24px 32px', position: 'relative', zIndex: 2, width: '100%'}}>
          <h2 style={{margin: '0 0 12px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
            <Building2 size={28} color="var(--accent-emerald)" /> ? ê·œ ?¬ì—… ?œë??ˆì´??(?°ìˆ˜??
          </h2>
          <p style={{margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '15px', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.8)'}}>
            ê¸°ì¡´ ì½˜ë„???´ì˜ ?°ì´??ê°ë‹¨ê°€ ë°??¬ìˆ™ê°ë‹¹ ë¶€?€ë§¤ì¶œ ì°½ì¶œ??ë¥?ë² ì´?¤ë¡œ, ?°ìˆ˜????? ê·œ ê°ì‹¤??ì¶”ê??˜ì—ˆ????ë°œìƒ?˜ëŠ” <strong style={{color: '#fff'}}>?°ê°„ ?ˆìƒ ?Œìƒ ì´ë§¤ì¶?/strong>???œë??ˆì´???©ë‹ˆ?? 
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="glass-panel" style={{padding: '32px'}}>
        <h3 style={{margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)'}}>
          <Calculator size={20} /> ?œë??ˆì´???¤ì • (?°ê°„ ê¸°ì?)
        </h3>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px'}}>
          
          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>ì¶”ê? ê±´ë¦½ ê°ì‹¤ ??/label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                value={newRooms === 0 ? '' : newRooms} 
                onChange={e => setNewRooms(Number(e.target.value))}
                style={{width: '100px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '18px', fontWeight: 'bold'}}
              />
              <span style={{color: 'var(--text-muted)'}}>??/span>
            </div>
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>?ˆìƒ ëª©í‘œ ?ìœ ??/label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input 
                type="number" 
                value={targetOcc === 0 ? '' : targetOcc} 
                onChange={e => setTargetOcc(Number(e.target.value))}
                style={{width: '100px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '18px', fontWeight: 'bold'}}
              />
              <span style={{color: 'var(--text-muted)'}}>%</span>
            </div>
            <div style={{fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '8px'}}>
              ?°ê°„ ?ˆìƒ ?ë§¤ ê°ì‹¤: {formatCurrency(annualSoldRooms)}??            </div>
          </div>

          <div style={{background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <label style={{display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '14px'}}>ê°ë‹¨ê°€ (ADR)</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--text-muted)'}}>??/span>
              <input 
                type="number" 
                value={activeAdr === 0 ? '' : activeAdr} 
                onChange={e => setCustomAdr(Number(e.target.value))}
                style={{width: '140px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', color: 'var(--accent-blue)', fontSize: '18px', fontWeight: 'bold'}}
              />
            </div>
            <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', display: 'flex', justifyContent: 'space-between'}}>
              <span>*ê¸°ë³¸ê°? ê¸°ì¡´ ì½˜ë„ ?‰ê· ì¹?/span>
              {customAdr !== null && (
                <button 
                  onClick={() => setCustomAdr(null)}
                  style={{background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline'}}
                >
                  ì´ˆê¸°??                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Results Section */}
      <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
        
        {/* Top summary cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
          
          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '4px solid rgba(255,255,255,0.2)'}}>
            <div style={{fontSize: '16px', color: 'var(--text-muted)', marginBottom: '8px'}}>ê¸°ì¡´ ?°ê°„ ?µí•© ë§¤ì¶œ (ê³¼ê±° ?‰ê·  ê¸°ì?)</div>
            <div style={{fontSize: '36px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px'}}>
              ??CountUp end={(baseMetrics.totRev + baseMetrics.totLeisure + baseMetrics.totMoto + baseMetrics.totFnb) / baseMetrics.monthsCount * 12} duration={1} separator="," preserveValue />
            </div>
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>?…ë¡œ?œëœ ?°ì´?°ë? ë°”íƒ•?¼ë¡œ ???˜ì‚°???„ì¬ ë§¤ì¶œ ê·œëª¨</div>
          </div>

          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '4px solid var(--accent-gold)'}}>
            <div style={{fontSize: '16px', color: 'var(--accent-gold)', marginBottom: '8px', fontWeight: 'bold'}}>? ê·œ ?œì„¤(?°ìˆ˜?? ?Œìƒ ë§¤ì¶œ</div>
            <div style={{fontSize: '36px', fontWeight: '900', color: 'var(--accent-gold)', letterSpacing: '-1px'}}>
              + ??CountUp end={expectedTotalRev} duration={1} separator="," preserveValue />
            </div>
            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>? ê·œ ê°ì‹¤ ì¶”ê?ë¡??¸í•´ ?œìˆ˜?˜ê²Œ ì¦ê??˜ëŠ” ?ˆìƒ ë§¤ì¶œ??/div>
          </div>

          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', borderTop: '4px solid var(--accent-blue)'}}>
            <div style={{fontSize: '16px', color: 'var(--accent-blue)', marginBottom: '8px', fontWeight: 'bold'}}>ë¯¸ë˜ ì¢…í•© ?°ê°„ ?ˆìƒ ë§¤ì¶œ</div>
            <div style={{fontSize: '42px', fontWeight: '900', color: '#fff', letterSpacing: '-1px'}}>
              ??CountUp end={((baseMetrics.totRev + baseMetrics.totLeisure + baseMetrics.totMoto + baseMetrics.totFnb) / baseMetrics.monthsCount * 12) + expectedTotalRev} duration={1} separator="," preserveValue />
            </div>
            <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '8px'}}>ê¸°ì¡´ ë§¤ì¶œ + ? ê·œ ?œì„¤ ?Œìƒ ë§¤ì¶œ</div>
          </div>

        </div>

        {/* Detailed Breakdown */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px'}}>
          <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <h3 style={{margin: '0 0 24px 0', color: 'var(--text-main)'}}>? ê·œ ?œì„¤(?°ìˆ˜?? ?Œìƒ ë§¤ì¶œ ?¸ë??´ì—­</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-blue)'}} />
                <span>ê°ì‹¤ ë§¤ì¶œ</span>
              </div>
              <strong style={{fontSize: '18px'}}>??formatCurrency(expectedRoomRev)}</strong>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444'}} />
                <span>?ìŒ(F&B) ë§¤ì¶œ</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <strong style={{fontSize: '18px', color: fnbSim.isCapped ? '#ef4444' : 'inherit'}}>??formatCurrency(expectedFnbRev)}</strong>
                {fnbSim.isCapped && <div style={{fontSize: '11px', color: '#ef4444', marginTop: '4px'}}>*Capa ?í•œ ?„ë‹¬ (ì´ˆê³¼ë¶?ë²„ë¦¼)</div>}
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-gold)'}} />
                <span>ëª¨í† ?„ë ˆ??ë§¤ì¶œ</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <strong style={{fontSize: '18px', color: motoSim.isCapped ? 'var(--accent-gold)' : 'inherit'}}>??formatCurrency(expectedMotoRev)}</strong>
                {motoSim.isCapped && <div style={{fontSize: '11px', color: 'var(--accent-gold)', marginTop: '4px'}}>*Capa ?í•œ ?„ë‹¬ (ì´ˆê³¼ë¶?ë²„ë¦¼)</div>}
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <div style={{width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-emerald)'}} />
                <span>?ˆì?/ê¸°í? ë§¤ì¶œ</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <strong style={{fontSize: '18px', color: leisureSim.isCapped ? 'var(--accent-emerald)' : 'inherit'}}>??formatCurrency(expectedLeisureRev)}</strong>
                {leisureSim.isCapped && <div style={{fontSize: '11px', color: 'var(--accent-emerald)', marginTop: '4px'}}>*Capa ?í•œ ?„ë‹¬ (ì´ˆê³¼ë¶?ë²„ë¦¼)</div>}
              </div>
            </div>

          </div>
        </div>

        {/* Chart */}
        <div className="glass-panel" style={{padding: '32px', minWidth: 0}}>
          <h3 style={{margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-muted)'}}>?ˆìƒ ë§¤ì¶œ ë¹„ì¤‘</h3>
          <div style={{width: '100%', height: '350px', minWidth: 0, minHeight: 0}}>
            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => `??{formatCurrency(value)}`}
                  contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-glass)', borderRadius: '8px'}}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        </div>

      </div>
    </div>
  );
}
