import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Calendar, Activity } from 'lucide-react';

export default function BookingPaceChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('room');
  
  // 기본 날짜: 최근 7일
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchPaceData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://belleforet-data.vercel.app/api/v3/synergy/analytics/booking-pace?startDate=${startDate}&endDate=${endDate}`);
        const json = await res.json();
        
        const dataArray = Array.isArray(json) ? json : json.data || [];
        
        // 취소 데이터를 음수로 변환하여 양방향 차트용 데이터 생성
        const mappedData = dataArray.map(d => ({
          date: d.date.slice(5), // MM-DD 포맷
          newRoom: d.newBookings?.room || 0,
          newGolf: d.newBookings?.golf || 0,
          cancelRoom: -(d.canceledBookings?.room || 0), 
          cancelGolf: -(d.canceledBookings?.golf || 0),
        }));
        
        setData(mappedData);
      } catch (error) {
        console.error('Failed to fetch booking pace', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPaceData();
  }, [startDate, endDate]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 w-full transition-all duration-300 hover:shadow-md" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Activity style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
            예약/취소 발생 트래픽 (Booking Pace)
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            일자별 순수 예약 유입량 및 취소량 시계열 추이
          </p>
        </div>
        
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <select 
            style={{ background: 'transparent', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)', border: 'none', outline: 'none', padding: '0 8px', cursor: 'pointer' }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="room" style={{ color: '#000' }}>객실 (Room)</option>
            <option value="golf" style={{ color: '#000' }}>골프 (Golf)</option>
          </select>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', fontSize: '14px', color: 'var(--text-muted)' }}>
            <Calendar style={{ width: '16px', height: '16px' }} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', cursor: 'pointer', colorScheme: 'dark' }} />
            <span>~</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', cursor: 'pointer', colorScheme: 'dark' }} />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div style={{ width: '100%', height: '350px' }}>
        {loading ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            데이터를 불러오는 중입니다...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                contentStyle={{ background: '#1e293b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', color: '#fff' }}
                formatter={(value) => Math.abs(value)} // 툴팁에서는 음수를 양수로 표기
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
              
              {category === 'room' ? (
                <>
                  <Bar dataKey="newRoom" name="신규 예약 (+)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="cancelRoom" name="예약 취소 (-)" fill="#f43f5e" radius={[0, 0, 4, 4]} barSize={30} />
                </>
              ) : (
                <>
                  <Bar dataKey="newGolf" name="신규 예약 (+)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="cancelGolf" name="예약 취소 (-)" fill="#f43f5e" radius={[0, 0, 4, 4]} barSize={30} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
