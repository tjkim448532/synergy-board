import React from 'react';
import { 
  Building2, 
  SplitSquareHorizontal, 
  BarChart3, 
  TrendingUp, 
  Info,
  CheckCircle2,
  Calculator,
  CalendarDays
} from 'lucide-react';
import './LogicGuide.css';

export default function LogicGuide() {
  return (
    <div className="logic-guide-container">
      <div className="guide-header glass-panel">
        <div className="header-icon-wrapper">
          <Calculator size={32} className="text-emerald" />
        </div>
        <div>
          <h2>분석 로직 가이드</h2>
          <p className="text-muted" style={{marginTop: '8px'}}>
            시너지 보드가 어떻게 점유율을 계산하고 매출을 예측하는지, 수학적 원리와 데이터 처리 로직을 직관적으로 설명합니다.
          </p>
        </div>
      </div>

      <div className="guide-cards">
        
        {/* Card 1: 물리적 객실 인벤토리 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <Building2 size={24} />
            </div>
            <h3>1. 물리적 객실 모수 통제</h3>
          </div>
          <div className="card-body">
            <p>
              오류를 방지하기 위해 엑셀 데이터나 외부 링크에 의존하지 않고, <strong>가장 정확한 물리적 수치를 시스템 엔진(코드) 자체에 영구적으로 고정</strong>시켰습니다.
            </p>
            <div className="formula-box">
              <div className="formula-item">
                <span className="label">총 객실 수</span>
                <span className="value text-accent">175 실</span>
              </div>
              <div className="formula-item">
                <span className="label">51평형(커넥팅)</span>
                <span className="value text-accent">85 세트</span>
              </div>
            </div>
            <div className="alert-box info">
              <Info size={16} />
              <span>어떤 데이터를 업로드하든, 모든 점유율 분모의 근간은 이 175실에서 출발합니다.</span>
            </div>
          </div>
        </div>

        {/* Card 2: 51평형 점유율 산정 방식 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <SplitSquareHorizontal size={24} />
            </div>
            <h3>2. 51평형(커넥팅 룸) 산정 스위치</h3>
          </div>
          <div className="card-body">
            <p>
              [설정] 탭의 <strong>'51평형 점유율 산정 방식'</strong> 옵션에 따라 일일 총 객실(분모)과 판매 객실(분자)이 유기적으로 연동되어 변환됩니다.
            </p>
            
            <div className="toggle-explanation">
              <div className="toggle-state active">
                <h4>방 2개로 산정 시 (기본)</h4>
                <ul>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>분모(인벤토리):</strong> 175실 전체</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>분자(판매량):</strong> 16평 + 35평 + (51평 예약 × 2)</li>
                </ul>
              </div>
              
              <div className="toggle-state">
                <h4>방 1개로 산정 시</h4>
                <ul>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>분모(인벤토리):</strong> 90실 (175실 - 85세트)</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>분자(판매량):</strong> 16평 + 35평 + (51평 예약 × 1)</li>
                </ul>
              </div>
            </div>
            
            <div className="alert-box success">
              <Info size={16} />
              <span>
                <strong>💡 장애인 객실 예외 처리:</strong> 51평형 예약 중 '장애' 또는 '휠체어' 키워드가 포함된 예약은 물리적 단일 키(Key)이므로 <strong>스위치 설정과 무관하게 무조건 1객실로만 카운트</strong>되도록 스마트 분류 로직이 적용되어 있습니다.
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: 주중/주말 보정 로직 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <CalendarDays size={24} />
            </div>
            <h3>3. 주중/주말 가중치 분배 알고리즘</h3>
          </div>
          <div className="card-body">
            <p>
              엑셀 업로드 시 주중/주말로 쪼개지는 예약 건수(Raw Data)는 51평형 예약이 방 1개로 기록되어 점유율이 과소평가되는 현상이 발생했습니다. 이를 해결하기 위해 <strong>비례 배분(Proportional Scaling) 알고리즘</strong>이 적용되었습니다.
            </p>
            <div className="formula-box vertical">
              <div className="math-step">
                <span className="step-num">Step 1</span>
                <div>
                  <strong>보정 계수(Multiplier) 산출</strong>
                  <code>(16평+35평+51평×2) ÷ (총 예약 건수)</code>
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2</span>
                <div>
                  <strong>주중 점유율 계산</strong>
                  <code>(주중 예약 건수 × 보정 계수) ÷ 주중 인벤토리</code>
                </div>
              </div>
            </div>
            <div className="alert-box success">
              <CheckCircle2 size={16} />
              <span>이 보정을 통해 주중/주말 점유율의 가중 평균이 전체 월평균 점유율과 수학적으로 100% 완벽하게 일치하게 됩니다.</span>
            </div>
          </div>
        </div>

        {/* Card 4: 선형 회귀 예측 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <TrendingUp size={24} />
            </div>
            <h3>4. 선형 회귀(Linear Regression) 기반 예측</h3>
          </div>
          <div className="card-body">
            <p>
              [매출 예측 시뮬레이터]의 타겟 예측선은 단순한 평균이 아닌, 과거 누적 데이터를 바탕으로 한 <strong>기계학습 통계 모델(최소제곱법 선형 회귀)</strong>을 따릅니다.
            </p>
            <div className="visual-diagram">
              <div className="diagram-dot dot-1"></div>
              <div className="diagram-dot dot-2"></div>
              <div className="diagram-dot dot-3"></div>
              <div className="diagram-dot dot-4"></div>
              <div className="diagram-line"></div>
              <span className="diagram-label x-axis">목표 점유율 (X)</span>
              <span className="diagram-label y-axis">예상 매출 (Y)</span>
            </div>
            <p className="text-small text-muted" style={{marginTop: '12px', lineHeight: '1.5'}}>
              과거 데이터(점)들의 오차 제곱합을 최소화하는 최적의 추세선(y = ax + b)을 도출하여, 사용자가 주중/주말 슬라이더를 조작해 목표 점유율을 맞추면 해당 추세선 위에 위치하는 예상 매출값을 실시간으로 반환합니다.
            </p>
          </div>
        </div>

      </div>

      <div className="guide-cards" style={{marginTop: '24px'}}>
        {/* Card 5: 평형별 목표 객단가(ADR) 예측 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle">
              <BarChart3 size={24} />
            </div>
            <h3>5. 목표 객단가(Target ADR) 예측 모델 (수익 관리 기법)</h3>
          </div>
          <div className="card-body">
            <p>
              [설정] 메뉴에서 <strong>평형별 목표 객단가</strong>를 입력하면, 단순 선형 회귀를 넘어선 <strong>'가중 평균 기반 수익 관리(Yield Management)'</strong> 알고리즘이 가동되어 전략적 예상 매출을 계산합니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">Step 1: 과거 판매 비중(Room Mix) 추출</span>
                <div style={{color: 'var(--text-muted)'}}>
                  전체 누적 엑셀 데이터에서 16평, 35평, 51평이 각각 몇 퍼센트 비율로 팔렸는지 역사적 비중을 계산합니다. (예: 16평 45%, 35평 40%, 51평 15%)
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2: 타겟 점유율 객실 할당</span>
                <div style={{color: 'var(--text-muted)'}}>
                  사용자가 슬라이더로 목표 점유율을 지정하면 산출되는 <code>예상 총 판매 객실 수</code>를 Step 1의 판매 비중에 따라 분배합니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 3: 평형별 매출 합산</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>(16평 예상판매량 × 16평 목표단가) + (35평 예상판매량 × 35평 목표단가) + (51평 예상판매량 × 51평 목표단가)</code>
                </div>
              </div>
            </div>
            
            <div className="alert-box info" style={{marginTop: '16px'}}>
              <Info size={16} />
              <span>
                과거의 "할인 프로모션" 등으로 인해 낮아진 평균 단가를 벗어나, <strong>"점유율을 조금 포기하더라도 제값을 다 받으면 수익이 얼마나 개선되는지(추가수익)"</strong>를 과거 추세선과 비교 분석할 수 있게 해줍니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
