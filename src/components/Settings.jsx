import React from 'react';

export default function Settings({ settings }) {
  return (
    <div className="glass-panel" style={{padding: '32px'}}>
      <h2 style={{color: '#f8fafc', marginBottom: '16px'}}>시스템 설정 (Read-Only)</h2>
      <p style={{color: '#94a3b8', marginBottom: '24px'}}>
        [V5 업데이트] 목표치(예산) 업로드 및 업장 맵핑 설정은 더 이상 프론트엔드에서 수동으로 엑셀 업로드할 수 없습니다. 
        모든 데이터는 MariaDB에서 Vercel API를 통해 100% 자동으로 동기화됩니다. 
        설정값 변경이 필요하신 경우 백엔드 팀에 수정을 요청해 주십시오.
      </p>
      <pre style={{background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '8px', color: '#cbd5e1', overflowX: 'auto'}}>
        {JSON.stringify(settings, null, 2)}
      </pre>
    </div>
  );
}
