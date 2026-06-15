import React, { useState } from 'react';
import { Upload, Settings, PieChart, TrendingUp, BookOpen, Building, ChevronDown, BarChart2 } from 'lucide-react';
import './DashboardLayout.css';

const SIDEBAR_MENU = [
  { id: 'analytics', icon: PieChart, label: '상관관계 분석' },
  { id: 'division-sales', icon: BarChart2, label: '부문별 매출 분석' },
  { id: 'channel-analysis', icon: PieChart, label: '객실판매채널 심층분석' },
  { id: 'prediction', icon: TrendingUp, label: '목표 예약률 기반 매출 시뮬레이터' },
  { 
    id: 'new-business-parent', 
    icon: Building, 
    label: '신규 사업 시뮬레이터',
    subItems: [
      { id: 'new-business', label: '연수원' },
      { id: 'new-business-soccer', label: '축구장(준비중)' }
    ]
  },
  { 
    id: 'settings-parent', 
    icon: Settings, 
    label: '설정',
    subItems: [
      { id: 'settings', label: '기본 설정' },
      { id: 'logic', label: '분석 로직 및 검증 보고서' },
      { id: 'accuracy-tasks', label: '데이터 정확도 핵심과제' },
      { id: 'upload', label: '데이터 업로드' }
    ]
  }
];

export default function DashboardLayout({ children, activeTab, setActiveTab }) {
  const [expandedMenus, setExpandedMenus] = useState(['new-business-parent']);

  const toggleExpand = (menuId) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]
    );
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="glass-panel sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">S</div>
          <h2>시너지</h2>
        </div>
        
        <nav className="sidebar-nav">
          {SIDEBAR_MENU.map((menu) => {
            const Icon = menu.icon;
            
            if (menu.subItems) {
              const isExpanded = expandedMenus.includes(menu.id);
              const hasActiveChild = menu.subItems.some(sub => sub.id === activeTab);
              
              return (
                <div key={menu.id} className="nav-item-group">
                  <button
                    className={`nav-item-header ${hasActiveChild ? 'active-group' : ''}`}
                    onClick={() => toggleExpand(menu.id)}
                  >
                    <div className="nav-item-header-content">
                      <Icon size={20} />
                      <span>{menu.label}</span>
                    </div>
                    <ChevronDown size={16} className={`chevron-icon ${isExpanded ? 'expanded' : ''}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="sub-nav">
                      {menu.subItems.map(sub => (
                        <button
                          key={sub.id}
                          className={`sub-nav-item ${activeTab === sub.id ? 'active' : ''}`}
                          onClick={() => setActiveTab(sub.id)}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

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
          <h1>{
            SIDEBAR_MENU.find(m => m.id === activeTab)?.label || 
            SIDEBAR_MENU.flatMap(m => m.subItems || []).find(sub => sub.id === activeTab)?.label || 
            '대시보드'
          }</h1>
          <div className="user-profile">
            <div className="avatar">L</div>
            <span>레져본부</span>
          </div>
        </header>
        
        <div className="content-area">
          {children}
        </div>
      </main>
    </div>
  );
}
