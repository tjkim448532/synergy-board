import React, { useState } from 'react';
import { LayoutDashboard, PieChart, Upload, Database, Settings, Presentation } from 'lucide-react';
import './DashboardLayout.css';

const SIDEBAR_MENU = [
  { id: 'overview', icon: LayoutDashboard, label: '대시보드 개요' },
  { id: 'analytics', icon: PieChart, label: '상관관계 분석' },
  { id: 'upload', icon: Upload, label: '데이터 업로드' },
  { id: 'db', icon: Database, label: 'DB 콘솔' },
  { id: 'settings', icon: Settings, label: '설정' }
];

export default function DashboardLayout({ children, activeTab, setActiveTab, onPresentationMode }) {
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

        <div className="sidebar-footer">
          <button className="nav-item presentation-btn" onClick={onPresentationMode}>
            <Presentation size={20} />
            <span>프레젠테이션 시작</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="glass-panel topbar">
          <h1>{SIDEBAR_MENU.find(m => m.id === activeTab)?.label || '대시보드'}</h1>
          <div className="user-profile">
            <div className="avatar">A</div>
            <span>관리자</span>
          </div>
        </header>
        
        <div className="content-area">
          {children}
        </div>
      </main>
    </div>
  );
}
