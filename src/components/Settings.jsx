import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const [settings, setSettings] = useState({
    resortName: '벨포레 리조트',
    totalRooms: 500,
    connectingRooms51: 50
  });

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('synergy_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('synergy_settings', JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>기본 정보 설정</h2>
        <p className="settings-desc">콘도의 총 객실 수 등 변동성이 적은 기본 정보를 설정하고 DB 초기값으로 저장합니다.</p>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label htmlFor="resortName">리조트명</label>
          <input 
            type="text" 
            id="resortName" 
            name="resortName" 
            value={settings.resortName} 
            onChange={handleChange} 
            placeholder="예: 프리미엄 리조트"
          />
        </div>

        <div className="form-group">
          <label htmlFor="totalRooms">고정 총 객실 수 (물리적 객실 기준)</label>
          <input 
            type="number" 
            id="totalRooms" 
            name="totalRooms" 
            value={settings.totalRooms} 
            onChange={handleChange} 
            placeholder="예: 500"
          />
        </div>

        <div className="form-group">
          <label htmlFor="connectingRooms51">51평형(커넥팅 룸) 세트 수</label>
          <input 
            type="number" 
            id="connectingRooms51" 
            name="connectingRooms51" 
            value={settings.connectingRooms51} 
            onChange={handleChange} 
            placeholder="예: 50"
          />
          <small style={{color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px'}}>
            * 51평형 1세트는 물리적 객실 2개로 구성됩니다. 점유율 동적 계산 시 기준 데이터로 사용됩니다.
          </small>
        </div>

        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave}>
            <Save size={18} /> 설정 저장하기
          </button>
          {isSaved && <span className="save-message">정상적으로 저장되었습니다.</span>}
        </div>
      </div>
    </div>
  );
}
