import React from 'react';
import { Upload, Settings, PieChart, TrendingUp, BookOpen, Building } from 'lucide-react';
import './DashboardLayout.css';

const SIDEBAR_MENU = [
  { id: 'prediction', icon: TrendingUp, label: '매출 예측 시뮬레이터' },
  { id: 'new-business', icon: Building, label: '신규 사업 시뮬레이터' },
  { id: 'analytics', icon: PieChart, label: '상관관계 분석' },
  { id: 'logic', icon: BookOpen, label: '분석 로직 가이드' },
  { id: 'accuracy-tasks', icon: BookOpen, label: '데이터 정확도 핵심과제' },
  { id: 'upload', icon: Upload, label: '데이터 업로드' },
  { id: 'settings', icon: Settings, label: '설정' }
];

export default function DashboardLayout({ children, activeTab, setActiveTab }) {
  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="glass-panel sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">S</div>
          <h2>시너지 리포트</h2>
        </div>
        
        <nav className="sidebar-nav">
          {SIDEBAR_MENU.map((menu) => {
            const Icon = menu.icon;
            return (
              <button
                key={menu.id}
                className={`nav-item ${activeTab === menu.id ? 'active' : ''}`}
                onClick={() => setActiveTab(menu.id)}
              >
                <Icon size={20} />
                <span>{menu.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="glass-panel topbar">
          <h1>{SIDEBAR_MENU.find(m => m.id === activeTab)?.label || '대시보드'}</h1>
          <div className="user-profile">
            <div className="avatar">D</div>
            <span>디지탈지원</span>
          </div>
        </header>
        
        <div className="content-area">
          {children}
        </div>
      </main>
    </div>
  );
}
