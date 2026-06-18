import React from 'react';
import { 
  Building2, 
  SplitSquareHorizontal, 
  BarChart3, 
  TrendingUp, 
  Info,
  CheckCircle2,
  Calculator,
  CalendarDays,
  Search
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
        
        {/* Card 0: 엑셀 데이터 파이프라인 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginBottom: '12px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <Search size={24} className="text-emerald" style={{color: '#10b981'}} />
            </div>
            <h3>0. 데이터 파이프라인 (엑셀 추출 및 정제 로직)</h3>
          </div>
          <div className="card-body">
            <p>
              시너지 보드는 정확도 높은 교차 분석을 위해 성격이 다른 <strong>총 3종류의 엑셀 파일</strong>을 업로드받아 병합(Merge)합니다. 각 파일의 스키마 구조와 어떤 데이터를 어떻게 긁어와서 이용하는지 명확히 정의합니다.
            </p>
            
            <div className="toggle-explanation" style={{marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
              
              {/* File A */}
              <div className="toggle-state active" style={{flex: '1 1 100%', margin: 0}}>
                <h4 style={{color: 'var(--accent-blue)', marginBottom: '8px'}}>A. 객실 판매 엑셀 (상세 데이터)</h4>
                <ul style={{fontSize: '13px', lineHeight: '1.6'}}>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>원본 스키마:</strong> 예약건 단위 혹은 일자 단위로 기록된 세로형 리포트 (필수 열: 일자, 객실타입, 수량, 실매출 등)</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>추출 로직:</strong> '일자'를 기준으로 행을 찾고, '객실타입(16평/35평/51평)', '판매객실수', '실매출(Net Revenue)', '요금제', '마켓/소스타입(채널)'을 긁어옵니다.</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>시스템 내 활용처:</strong> 
                    <br/>- 전체 대시보드의 '객실당 평균가(ADR)', '가용객실당 매출(RevPAR)' 자동 역산 및 시계열 분석 기준점
                    <br/>- 예약 채널별(OTA, 홈페이지 등), 요일별 심층 판매 분석
                  </li>
                </ul>
              </div>
              
              {/* File B */}
              <div className="toggle-state active" style={{flex: '1 1 100%', margin: 0}}>
                <h4 style={{color: 'var(--accent-gold)', marginBottom: '8px'}}>B. 전체 영업장 총매출 파일 (부대업장/POS 데이터)</h4>
                <ul style={{fontSize: '13px', lineHeight: '1.6'}}>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>원본 스키마:</strong> 가로로 넓게 퍼진 피벗 테이블 형태 (좌측 첫 열: 영업일자 / 이후 우측으로 수십 개의 영업장명 열 나열)</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>추출 로직:</strong> 첫 열에서 '날짜(yyyy-mm-dd)'를 파싱한 뒤, 가로로 쭉 읽어가며 각 부대업장(수십 개) 열에 적힌 '실매출액'을 수집합니다. <code>ROOM</code>, <code>ROOM OTHER</code>, <code>합계</code> 열은 제외합니다.</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>시스템 내 활용처:</strong> 
                    <br/>- 추출된 수십 개의 영업장 매출을 [설정] 탭의 매핑 로직에 따라 <strong>'레저', '식음', '모토아레나', '골프', '기타', '제외업장'</strong> 6개 그룹으로 동적 병합(Grouping)합니다.
                    <br/>- 이 그룹화된 데이터를 바탕으로 부문별 매출 분석, 상관관계 교차 분석(객실 매출과 어떤 부대가 함께 오르는지), 예측 모델링(Pacing)에 투입합니다.
                  </li>
                </ul>
                <div className="alert-box success" style={{marginTop: '12px', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', padding: '10px'}}>
                  <Info size={14} style={{color: '#ef4444', flexShrink: 0}} />
                  <span style={{color: 'var(--text-main)', fontSize: '12.5px', lineHeight: '1.5'}}>
                    <strong>💡 [중요] [B파일] 안의 객실 매출 취급 로직:</strong><br/>
                    이 엑셀 안에도 <code>ROOM</code> 매출이 찍혀 나오지만 실적 합산에서는 <strong>고의로 버립니다(필터링).</strong> 대신 여기서 뽑아낸 ROOM 총액은, 앞서 올린 <strong>[A. 객실 엑셀]의 합계액과 1원 단위까지 일치하는지 백그라운드에서 교차 대조(Cross-check)</strong>하여 엑셀 추출 누락이나 조작이 없었는지 판별하는 '정합성 검증용 잣대'로만 강력하게 쓰입니다.
                  </span>
                </div>
              </div>

              {/* File C */}
              <div className="toggle-state active" style={{flex: '1 1 100%', margin: 0}}>
                <h4 style={{color: 'var(--accent-purple)', marginBottom: '8px'}}>C. 모토아레나 티켓 판매 엑셀 (고객군 상세 데이터)</h4>
                <ul style={{fontSize: '13px', lineHeight: '1.6'}}>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>원본 스키마:</strong> 모토아레나에서 팔린 티켓별/고객유형별 거래 내역 리포트 (필수 열: 상품명/트랜잭션명, 실매출액)</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>추출 로직:</strong> '상품명' 열에 적힌 텍스트를 파싱하여 키워드 매칭을 수행합니다. (예: '객실', '콘도' 키워드 → 투숙객 / '일반', '단체' → 일반객 / '임직원', '회원' → 내부객 / 나머지 → 기타)</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>시스템 내 활용처:</strong> 
                    <br/>- 모토아레나 전체 매출 중, <strong>실제로 리조트에 숙박하면서 모토아레나를 이용한 '투숙객 비중(Captive Rate)'</strong>을 발라내어 별도의 전환율(Conversion Rate) 심층 분석 화면에 뿌려줍니다.
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

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
              오류를 방지하기 위해 외부 데이터에 의존하지 않고, <strong>가장 정확한 물리적 수치를 시스템 내부에 고정 설정</strong>하여 기준점으로 삼습니다.
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
                <span className="step-num">Step 3: 물리적 객실 환산 및 평형별 매출 합산</span>
                <div style={{color: 'var(--text-muted)'}}>
                  가상으로 분배된 객실 수를 <strong>물리적 키(Key) 개수</strong>로 환원한 뒤 목표 단가를 곱합니다. (예: 51평 커넥팅룸이 가상 2객실로 잡혔다면, 1개로 환원하여 51평 단가를 1번만 곱해 매출 중복 뻥튀기를 방지합니다.)<br/>
                  <code>(16평 물리판매량 × 16평 목표단가) + (35평 물리판매량 × 35평 목표단가) + (51평 물리판매량 × 51평 목표단가)</code>
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
        {/* Card 6: 판매채널-부대시설 거시적 상관관계 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(59, 130, 246, 0.1)'}}>
              <SplitSquareHorizontal size={24} className="text-blue" style={{color: '#3b82f6'}} />
            </div>
            <h3>6. 예약 채널별 ↔ 부대시설 거시적 상관관계 (Macro-Correlation)</h3>
          </div>
          <div className="card-body">
            <p>
              "온라인으로 예약한 사람이 모토아레나에서 돈을 썼는가?"를 직접 1:1로 추적하려면 객실 시스템(PMS)과 업장 포스(POS) 데이터가 고객 단위로 연동되어야 합니다. 그러나 현재 엑셀 업로드 방식은 독립된 월별 총합계 데이터이므로, <strong>'월별 채널 매출의 흐름'</strong>과 <strong>'월별 부대시설 매출의 흐름'</strong> 간의 거시적 통계 상관계수(Pearson Correlation)를 도출하여 이를 극복합니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">Step 1: 데이터 분리 및 월간 집계</span>
                <div style={{color: 'var(--text-muted)'}}>
                  매월 객실 데이터에서 '마켓타입' 항목을 추출해 <strong>채널별(온라인, 세미나, 휴양소 등) 월 총매출 배열 X</strong>를 생성하고, 영업장 데이터에서 <strong>부문별(식음, 레저, 모토) 월 총매출 배열 Y</strong>를 생성합니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2: 피어슨 상관계수 (r) 적용</span>
                <div style={{color: 'var(--text-muted)'}}>
                  공분산을 표준편차의 곱으로 나눈 통계학적 공식을 사용하여 두 배열(X, Y)이 얼마나 함께 오르고 내리는지 -1.0 부터 1.0 사이의 수치로 반환합니다.<br/>
                  <code>r = Cov(X,Y) / (StdDev(X) * StdDev(Y))</code>
                </div>
              </div>
            </div>
            
            <div className="alert-box success" style={{marginTop: '16px', borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)'}}>
              <CheckCircle2 size={16} style={{color: '#3b82f6'}} />
              <span style={{color: 'var(--text-main)'}}>
                <strong>💡 해석 팁:</strong> 상관계수가 0.7 이상이면 매우 강한 연관성(특정 채널 투숙객이 해당 영업장 매출을 견인할 확률이 매우 높음), 0.4 이상이면 유의미한 연관성으로 해석할 수 있습니다. 단, 현재 누적된 개월 수(데이터 포인트)가 적을 때는 경향성 파악 용도로만 참고하세요.
              </span>
            </div>
          </div>
        </div>
        {/* Card 7: 핵심 성과 지표 (TrevPAR, RevPAR) */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(234, 179, 8, 0.1)'}}>
              <CheckCircle2 size={24} className="text-yellow" style={{color: '#eab308'}} />
            </div>
            <h3>7. 리조트 수익성 평가 핵심 지표 (RevPAR & TrevPAR)</h3>
          </div>
          <div className="card-body">
            <p>
              단순히 '총매출'이나 '점유율'만으로는 객실 영업 효율을 제대로 파악하기 어렵습니다. 이에 <strong>PAR(Per Available Room, 가용 객실당)</strong> 개념을 도입하여, 방 1개를 기준으로 창출되는 수익을 정확히 측정합니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">기본 전제: 분모(가용 객실 수)의 무결성</span>
                <div style={{color: 'var(--text-muted)'}}>
                  모든 지표의 분모가 되는 <code>총 가용 객실 수 = 일일 객실 인벤토리 × 해당 월의 일수</code> 입니다. 51평 스위치 설정에 따라 '방 1개' 또는 '방 2개'로 모수(Denominator)가 다이내믹하게 변화하며 지표를 재계산합니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">지표 1: RevPAR (객실 수익만)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>(월간 총 객실 매출) ÷ (총 가용 객실 수)</code><br/>
                  방 1개가 하루에 벌어들이는 '평균 객실료'입니다. 공실(비어있는 방)까지 모두 포함하여 평균을 내므로, 무리한 할인(ADR 하락)으로 방을 채우는 게 유리한지, 비싸게 적게 파는 게 유리한지 평가하는 기준이 됩니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">지표 2: Gross TrevPAR (워크인 포함 전체)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>(객실 + 식음 + 레저 + 모토아레나 + 기타 총매출) ÷ (총 가용 객실 수)</code><br/>
                  투숙객과 워크인(비투숙 외부 방문객)을 가리지 않고, 리조트라는 거대한 공간 시설 전체가 하루에 뿜어내는 총체적인 '공간 수익성'을 객실 모수로 나누어 직관적으로 보여줍니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">지표 3: 순수(Pure) TrevPAR (객실 + 투숙객 부대매출)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>[ (총 객실 매출) + (레저매출 × 비중) + (식음매출 × 비중) + (모토 투숙객매출) ] ÷ (총 가용 객실 수)</code><br/>
                  방 1개를 채웠을 때, 오직 <strong>'그 투숙객'</strong>이 식당, 레저, 모토아레나 등에서 카드를 긁을 것으로 기대되는 수익을 합친 <strong>진짜 객실 1개의 연계 가치</strong>입니다.
                </div>
              </div>
            </div>
            
            <div className="alert-box warning" style={{marginTop: '16px', borderColor: 'rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.05)'}}>
              <Info size={16} style={{color: '#eab308'}} />
              <span style={{color: 'var(--text-main)'}}>
                <strong>💡 '순수'와 'Gross'가 벌어지는 원리 (워크인 변수 통제):</strong><br/>
                현재 엑셀의 결제 데이터에는 '투숙객'과 '워크인'이 섞여 있습니다. 시스템은 [설정] 탭에 입력된 <strong>투숙객 매출 비중(Capture Rate %)</strong>이라는 돋보기를 통해 전체 매출에서 수학적으로 투숙객 지분만 깎아내어(필터링) 순수 TrevPAR를 계산합니다. 따라서, Gross와 순수 TrevPAR 사이의 금액 격차는 온전히 <strong>외부 나들이객(워크인)이 기여한 매출분</strong>을 의미합니다.
              </span>
            </div>
          </div>
        </div>

        {/* Card 8: AI 기반 투숙객 비중 자동 추정 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <Calculator size={24} className="text-emerald" style={{color: '#10b981'}} />
            </div>
            <h3>8. AI 기반 투숙객 매출 비중(Capture Rate) 통계적 추정 알고리즘</h3>
          </div>
          <div className="card-body">
            <p>
              [설정] 탭의 <strong>'데이터 기반 AI 추정'</strong> 기능은 사용자가 임의의 감이나 직관으로 입력하던 투숙객 비중을, 실제 업로드된 매출 데이터의 상관관계 흐름 속에서 수학적으로 역산해내는 고도화된 기능입니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">Step 1: 데이터 분산(Scatter) 매핑</span>
                <div style={{color: 'var(--text-muted)'}}>
                  누적된 모든 월별 데이터를 바탕으로 X축을 <code>객실 점유율(%)</code>, Y축을 <code>해당 부대시설의 매출액(원)</code>으로 설정하여 좌표 평면에 점을 찍습니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2: 최소제곱법(OLS) 선형 회귀 모형 구축</span>
                <div style={{color: 'var(--text-muted)'}}>
                  찍힌 점들의 오차 제곱합을 최소화하는 최적의 추세선 <code>Y = mX + b</code>를 찾습니다.<br/>
                  여기서 <strong>기울기(m)</strong>는 객실 점유율 1%가 오를 때 추가로 발생하는 부대시설 매출을 의미하며, <strong>Y절편(b)</strong>은 점유율이 0%일 때(투숙객이 없을 때) 발생하는 순수 '워크인(외부 고객)' 매출을 의미합니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 3: 비중(Capture Rate) 역산 도출</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>(기울기 × 평균 점유율) ÷ 평균 총매출</code><br/>
                  평균적인 달력 월을 기준으로, <strong>'점유율에 의해 견인된 변동 매출(투숙객 기여분)'</strong>이 <strong>'전체 매출(투숙객 + 워크인)'</strong>에서 차지하는 정확한 비율(%)을 수학적으로 분리해냅니다.
                </div>
              </div>
            </div>
            
            <div className="alert-box success" style={{marginTop: '16px', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)'}}>
              <CheckCircle2 size={16} style={{color: '#10b981'}} />
              <span style={{color: 'var(--text-main)'}}>
                <strong>💡 AI 추정의 가치:</strong> 데이터가 쌓이면 쌓일수록 (최소 2개월 이상, 권장 6개월 이상) 선형 회귀 모델의 정확도는 무한히 상승하며, 계절적 요인이나 일시적 마케팅 변수에 흔들리지 않는 <strong>'가장 신뢰도 높은 순수 객실 연계 가치'</strong>를 평가할 수 있게 됩니다.
              </span>
            </div>
          </div>
        </div>

        {/* Card 9: 모토아레나 동적 그룹핑 파싱 및 허수 판별 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(168, 85, 247, 0.1)'}}>
              <Search size={24} className="text-purple" style={{color: '#a855f7'}} />
            </div>
            <h3>9. 모토아레나 동적 그룹핑(Dynamic Grouping) 및 분류 알고리즘</h3>
          </div>
          <div className="card-body">
            <p>
              단일 영업장 중 이질적인 성격을 띄는 '모토아레나'의 데이터는 단순 총합계가 아닌, <strong>개별 결제 티켓의 명칭을 바탕으로 한 동적 분류(Dynamic Grouping)</strong>를 거쳐 투숙객 매출과 일반객 매출로 완전 분리됩니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">Step 1: 설정 화면 커스텀 핀셋 매핑</span>
                <div style={{color: 'var(--text-muted)'}}>
                  고정된 규칙에 의존하지 않고, [설정] 화면에서 사용자가 전체 모토아레나 티켓 종류를 직접 <code>투숙객 매출</code>, <code>일반객 매출</code>, <code>기타 매출</code> 로 지정하여 유연하게 분류할 수 있습니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2: 일반객 매출 뻥튀기 방지</span>
                <div style={{color: 'var(--text-muted)'}}>
                  신규 객실에 따른 모토아레나 창출 매출을 예측할 때, 무식하게 총매출을 사용하지 않고 오직 <strong>Step 1에서 투숙객으로 분류된 매출액의 합계</strong>만을 추출하여 객단가 분모로 사용합니다. 이를 통해 일반객 비중이 객실 수익으로 뻥튀기되는 치명적인 오류를 원천 차단합니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 3: 비중 + 상관관계 결합에 의한 '허수 판별' (핵심)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  투숙객 매출을 객실 매출과 비교하여 피어슨 상관계수(r)를 구합니다. 단, <strong>상관계수(r)가 1에 가깝게 높게 나오더라도, 티켓 판매 전체에서 투숙객이 차지하는 비중(%) 자체가 쥐꼬리만 하다면 이는 비즈니스 성장을 이끌 수 없는 '통계적 착시(허수)'</strong>로 규정합니다.
                </div>
              </div>
            </div>
            
            <div className="alert-box warning" style={{marginTop: '16px', borderColor: 'rgba(168, 85, 247, 0.3)', background: 'rgba(168, 85, 247, 0.05)'}}>
              <Info size={16} style={{color: '#a855f7'}} />
              <span style={{color: 'var(--text-main)'}}>
                <strong>💡 허수 판별 자동 경고 시스템:</strong><br/>
                상관관계 분석 UI에서는 위 알고리즘이 실시간 가동됩니다. 상관관계가 높더라도 매출 비중이 기준치 미만일 경우 ⚠️ <strong>[통계적 착시 주의]</strong> 경고를 띄워, 데이터 해석 오류를 시스템 차원에서 원천 차단합니다.
              </span>
            </div>
          </div>
        </div>

        {/* Card 10: 시뮬레이터 가동률 상한선(Capa Ceiling) */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(244, 63, 94, 0.1)'}}>
              <Building2 size={24} className="text-rose" style={{color: '#f43f5e'}} />
            </div>
            <h3>10. 미래 창출 매출 가동률 상한선(Capa Ceiling Limit) 알고리즘</h3>
          </div>
          <div className="card-body">
            <p>
              단순한 곱셈기의 가장 큰 모순인 <strong>"객실이 무한정 늘어난다고 식당 테이블과 레저 시설의 수용력도 무한정 늘어나는가?"</strong>에 대한 물리적 한계를 수학적 수식으로 방어하는 안전장치입니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">Step 1: 시설별 현재 가동률(Capa %) 입력</span>
                <div style={{color: 'var(--text-muted)'}}>
                  [설정] 메뉴에서 식음, 레저, 모토아레나 각각의 현재 체감 가동률(이용률)을 0~100% 사이로 직접 지정합니다. (예: 현재 식당이 80% 정도 꽉 차서 돌아가고 있다)
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2: 최대 수용 가능 매출(Max Capa) 역산</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>최대 가능 매출 = 과거 연간 총매출 ÷ (현재 가동률 % / 100)</code><br/>
                  현재 80% 가동률로 8억을 번다면, 100% 꽉 찼을 때의 물리적 최대 가능 매출은 10억이라는 수치를 수학적으로 역산해냅니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 3: 남은 성장 여력(Remaining Capacity) 산출</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>남은 성장 여력 = 최대 가능 매출(10억) - 과거 연간 총매출(8억) = 2억</code><br/>
                  신규 객실로 인해 더 벌어들일 수 있는 부대매출의 한계선(Cap)을 그어줍니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 4: 매출 증가량 방어(Cap) 적용</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>실제 창출 매출 = MIN (객실 증가에 따른 단순 기대 창출 매출, 남은 성장 여력)</code><br/>
                  아무리 객실을 많이 지어도 창출 매출은 2억에서 멈추며(버려짐), 시뮬레이터 화면에는 <strong>*Capa 상한 도달 (초과분 버림)</strong>이라는 강력한 알림이 표시됩니다.
                </div>
              </div>
            </div>
            
            <div className="alert-box success" style={{marginTop: '16px', borderColor: 'rgba(244, 63, 94, 0.3)', background: 'rgba(244, 63, 94, 0.05)'}}>
              <CheckCircle2 size={16} style={{color: '#f43f5e'}} />
              <span style={{color: 'var(--text-main)'}}>
                <strong>💡 이 방어벽의 가치:</strong> 신규 사업(연수원) 건립 타당성을 검토할 때, 과도하게 부풀려진 장밋빛 창출 매출에 속아 잘못된 투자를 결정하는 리스크를 시스템이 선제적으로 완벽하게 막아줍니다.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
