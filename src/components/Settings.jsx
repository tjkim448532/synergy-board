import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const [settings, setSettings] = useState({
    resortName: '프리미엄 리조트',
    totalRooms: 500,
    baseOccupancyRate: 70
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
          <label htmlFor="totalRooms">총 객실 수</label>
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
          <label htmlFor="baseOccupancyRate">목표 평균 점유율 (%)</label>
          <input 
            type="number" 
            id="baseOccupancyRate" 
            name="baseOccupancyRate" 
            value={settings.baseOccupancyRate} 
            onChange={handleChange} 
            placeholder="예: 70"
          />
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
