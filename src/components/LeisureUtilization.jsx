import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { PieChart, Activity, Users, Target } from 'lucide-react';

export default function LeisureUtilization({ monthlyData, settings }) {
  // 이번달 혹은 가장 최근 달의 데이터 가져오기 (가장 마지막 데이터)
  const latestData = [...monthlyData].sort((a, b) => (a.id > b.id ? -1 : 1))[0];

  const analysisResult = useMemo(() => {
    if (!latestData) return null;

    // 총 방문객 (골프 제외) 산출 로직 (메인 대시보드와 동일)
    const { 
      totalRooms = 175, 
      connectingRooms51 = 85, 
      count51AsTwoRooms = true 
    } = settings || {};

    const physicalRooms = Number(totalRooms);
    const rooms51Sets = Number(connectingRooms51);
    const dailyInventory = count51AsTwoRooms ? physicalRooms : (physicalRooms - rooms51Sets);

    const calcTotalRoomSold = (data) => {
      const wDayCnt = parseSafeInt(data.weekdayCount);
      const wEndCnt = parseSafeInt(data.weekendCount);
      if (wDayCnt > 0 || wEndCnt > 0) {
        return (parseSafeInt(data.roomSoldWd) + parseSafeInt(data.roomSoldWe));
      }
      return 0; // 데이터 불충분
    };

    const parseSafeInt = (v) => {
      const num = parseInt(v, 10);
      return isNaN(num) ? 0 : num;
    };

    const d = latestData;
    const daysInMonth = parseSafeInt(d.weekdayCount) + parseSafeInt(d.weekendCount);
    let totalRoomsToSell = daysInMonth * dailyInventory;
    let totalSold = calcTotalRoomSold(d);

    // 투숙객 산출 (목표 예약률 화면의 평균값 참조)
    const totalGuests = Math.round(totalSold * 2.5); // 임의 평균 투숙인원 2.5명 (정확한건 roomTypeBreakdown 필요하나 간단히)
    // 좀 더 정교하게: 전체 합산 고객 수 (골프 제외)
    let totalVisitors = totalGuests;

    // 모토아레나 일반객 합산
    if (d.motoGeneralRev > 0) {
      // 일반객 티켓 데이터가 있다면 인원 파악 가능. 없다면 매출로 추정
      // 이 예제에서는 d.motoGeneralRev / 35000 등 추정. (메인 대시보드의 totalVisitors 사용 권장)
      totalVisitors += Math.round(d.motoGeneralRev / 35000);
    }
    
    // 하지만 가장 정확한 것은 Context 등에서 전달받은 displayVisitors를 쓰는 것.
    // 여기서는 최신 달의 totalVisitors를 대략적으로 구하거나, 
    // 혹은 d.leisureTicketUsage 가 있다면 그 데이터를 시각화합니다.

    const usage = d.leisureTicketUsage || {};
    
    const chartData = Object.entries(usage).map(([venue, count]) => {
      return {
        name: venue,
        visitors: count,
        // 전체 방문객 수치가 있다면 rate 산출. 일단 절대 수치로만 보여줍니다.
        // rate: totalVisitors > 0 ? (count / totalVisitors) * 100 : 0
      };
    }).sort((a, b) => b.visitors - a.visitors);

    const totalLeisureVisitors = chartData.reduce((acc, curr) => acc + curr.visitors, 0);

    return {
      month: d.id,
      chartData,
      totalLeisureVisitors
    };
  }, [latestData, settings]);

  if (!analysisResult) {
    return (
      <div style={{padding: '24px', color: 'var(--text-muted)'}}>
        데이터가 없습니다.
      </div>
    );
  }

  const { month, chartData, totalLeisureVisitors } = analysisResult;

  return (
    <div style={{padding: '24px'}}>
      <div style={{marginBottom: '32px'}}>
        <h2 style={{fontSize: '28px', margin: '0 0 8px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px'}}>
          <Activity color="var(--accent-emerald)" /> 레저본부 영업장별 이용률 분석
        </h2>
        <p style={{color: 'var(--text-muted)', margin: 0}}>
          {month} 기준 - 업로드된 티켓 엑셀을 기반으로 산출된 영업장별 실제 이용객 수입니다.
        </p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px'}}>
        <div className="glass-panel" style={{padding: '24px'}}>
          <div style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Users size={16} /> 총 레저본부 이용객
          </div>
          <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--text-main)'}}>
            {totalLeisureVisitors.toLocaleString()}명
          </div>
        </div>

        <div className="glass-panel" style={{padding: '24px'}}>
          <div style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Target size={16} /> 가장 인기 있는 영업장
          </div>
          <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--accent-emerald)'}}>
            {chartData.length > 0 ? chartData[0].name : '-'}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{padding: '24px'}}>
        <h3 style={{margin: '0 0 24px 0', color: 'var(--text-main)'}}>영업장별 이용객 수 순위</h3>
        
        {chartData.length === 0 ? (
          <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px'}}>
            해당 월({month})의 레저 티켓 데이터가 업로드되지 않았습니다.<br/>
            [설정] &gt; [레저본부 이용률 (티켓 인원수 매핑)] 메뉴에서 엑셀을 업로드해주세요.
          </div>
        ) : (
          <div style={{height: '400px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.5)" />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.8)" width={120} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--accent-emerald)' }}
                  formatter={(value) => [`${value.toLocaleString()}명`, '이용객']}
                />
                <Bar dataKey="visitors" radius={[0, 4, 4, 0]}>
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
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>이용객 수</th>
                <th style={{padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right'}}>비중</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={d.name} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '12px 8px', color: i === 0 ? 'var(--accent-emerald)' : 'inherit'}}>#{i + 1}</td>
                  <td style={{padding: '12px 8px', fontWeight: 'bold'}}>{d.name}</td>
                  <td style={{padding: '12px 8px', textAlign: 'right'}}>{d.visitors.toLocaleString()}명</td>
                  <td style={{padding: '12px 8px', textAlign: 'right'}}>{((d.visitors / totalLeisureVisitors) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
