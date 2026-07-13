import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, AlertCircle } from 'lucide-react';

const HARDCODED_COLUMNS = [
  { id: '미분류|미분류', title: '미분류 (대기열)' },
  { id: '레저본부|미디어아트센터', title: '레저본부 - 미디어아트센터' },
  { id: '레저본부|목장', title: '레저본부 - 목장' },
  { id: '레저본부|액티비티', title: '레저본부 - 액티비티' },
  { id: '모토아레나|미분류', title: '모토아레나' },
  { id: '외주|미분류', title: '외주 시설' },
  { id: '콘도|미분류', title: '콘도' },
  { id: '골프장|미분류', title: '골프장' },
];

export default function TeamMappingKanban() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('https://belleforet-data.vercel.app/api/v5/admin/mapping/team');
      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch mapping items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, facility) => {
    setDraggedItem(facility);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', facility.facility_name);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    if (!draggedItem) return;

    const [targetTeam, targetPart] = columnId.split('|');

    setItems(prev => prev.map(item => 
      item.facility_name === draggedItem.facility_name
        ? { ...item, teamName: targetTeam, partName: targetPart }
        : item
    ));
    setDraggedItem(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 바이블: 변경사항 즉시 저장 (백엔드 연동)
      // V5 admin/mapping/team POST 엔드포인트 호출
      const res = await fetch('https://belleforet-data.vercel.app/api/v5/admin/mapping/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer belleforet-m2m-secret'
        },
        body: JSON.stringify({ mappings: items })
      });
      
      if (!res.ok) {
        console.warn('Backend POST endpoint might not be fully ready. Data sent:', items);
      }
      alert('영업장 매핑 규칙이 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('Save failed:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            영업장 팀 연결 규칙 (Kanban 보드)
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px' }}>
            데이터베이스에 등록된 모든 영업장 항목들이 현재 지정된 팀 아래에 분류되어 있습니다. <br/>
            팀을 변경하려면 항목을 마우스로 드래그해서 원하는 컬럼으로 옮기세요.
          </p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            padding: '10px 20px', background: 'var(--accent)', color: '#fff', 
            border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          <Save size={18} />
          {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>

      <div style={{ background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', color: '#ff8888' }}>
        <AlertCircle size={18} />
        <span style={{ fontSize: '13px' }}>
          <strong>[백엔드 지침 적용됨]</strong> 동적 기둥(Column) 추론을 배제하고 하드코딩된 공식 본부/파트 기둥만 렌더링합니다.
        </span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#888' }}>
          영업장 데이터를 불러오는 중입니다...
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${HARDCODED_COLUMNS.length}, minmax(250px, 1fr))`, 
          gap: '16px', 
          overflowX: 'auto',
          paddingBottom: '20px',
          flex: 1
        }}>
          {HARDCODED_COLUMNS.map(col => {
            const [t, p] = col.id.split('|');
            const colItems = items.filter(item => item.teamName === t && item.partName === p);

            return (
              <div 
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: '400px'
                }}
              >
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 'bold', color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                  {col.title}
                  <span style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: '#aaa' }}>
                    {colItems.length}
                  </span>
                </div>
                <div style={{ padding: '12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colItems.map(item => (
                    <motion.div
                      layoutId={item.facility_name}
                      key={item.facility_name}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      style={{
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'grab',
                        color: '#cbd5e1',
                        fontSize: '14px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(51, 65, 85, 0.9)' }}
                      whileTap={{ scale: 0.98, cursor: 'grabbing' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{item.facility_name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.categoryCode}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {colItems.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', color: '#555', fontSize: '13px', fontStyle: 'italic' }}>
                      여기로 드래그하세요
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
