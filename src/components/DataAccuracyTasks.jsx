import React from 'react';
import { Database, Link as LinkIcon, DollarSign, Filter, TrendingUp, Info } from 'lucide-react';
import './LogicGuide.css';

export default function DataAccuracyTasks() {
  return (
    <div className="logic-guide-container">
      <div className="guide-header">
        <h2>데이터 정확도 100% 달성을 위한 핵심 과제</h2>
        <p className="guide-desc">시너지 보드의 예측과 분석을 '추정치'가 아닌 완벽한 '팩트(Fact)'로 끌어올리기 위해 IT 및 운영 부서와 협의해야 할 4대 핵심 과제입니다.</p>
      </div>

      <div className="guide-cards">
        
        {/* 과제 1 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle">
              <LinkIcon size={24} />
            </div>
            <h3>1. PMS(객실)와 POS(부대시설)의 완전한 연동 (Single Customer View)</h3>
          </div>
          <div className="card-body">
            <p style={{marginBottom: '12px'}}>
              <strong>현재 상태:</strong> 객실 결제 시스템(PMS)과 각 업장의 포스(POS) 데이터가 고객 이름이나 ID 단위로 100% 연동되어 있지 않아, 부대시설 총매출 중 투숙객이 결제한 금액을 <strong>'추정 비율(Capture Rate)'</strong>로 산출하고 있습니다.
            </p>
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num" style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>필요한 액션</span>
                <div style={{color: 'var(--text-main)'}}>
                  부대시설 이용 시 현장 결제를 지양하고, <strong>'룸 차지(Room Charge, 객실로 달아두기)'</strong> 기능을 100% 활성화하여 고객이 퇴실(Check-out)할 때 프론트에서 전액 통합 결제하도록 프로세스를 유도해야 합니다.
                </div>
              </div>
              <div className="math-step" style={{borderLeftColor: 'var(--accent-emerald)'}}>
                <span className="step-num" style={{background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)'}}>기대 효과</span>
                <div style={{color: 'var(--text-main)'}}>
                  어떤 채널(야놀자/휴양소 등)로 들어온 고객이 부대시설에서 정확히 얼마를 썼는지 1원의 오차도 없이 1:1 매칭이 가능해집니다. 진정한 의미의 <strong>LTV(고객 생애 가치)</strong> 분석과 타겟 마케팅이 완성됩니다.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 과제 2 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle">
              <Database size={24} />
            </div>
            <h3>2. 엑셀 로우 데이터(Raw Data)에 '예약일자' 컬럼 추가</h3>
          </div>
          <div className="card-body">
            <p style={{marginBottom: '12px'}}>
              <strong>현재 상태:</strong> 현재 다운로드 받는 예약실 엑셀 데이터에는 고객이 '숙박하는 날짜(체크인 일자)'만 존재하고, '예약을 확정한 날짜'가 없습니다.
            </p>
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num" style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>필요한 액션</span>
                <div style={{color: 'var(--text-main)'}}>
                  객실 예약/IT 부서에 요청하여 엑셀 다운로드 템플릿에 <strong>[최초 예약일자]</strong> 혹은 <strong>[예약 리드타임(예약일과 투숙일의 격차)]</strong> 컬럼을 반드시 추가해야 합니다.
                </div>
              </div>
              <div className="math-step" style={{borderLeftColor: 'var(--accent-emerald)'}}>
                <span className="step-num" style={{background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)'}}>기대 효과</span>
                <div style={{color: 'var(--text-main)'}}>
                  고객들이 평균적으로 '며칠 전'에 예약을 완료하는지 정확한 예약 페이스(Booking Pace)를 파악할 수 있습니다. 이를 통해 얼리버드 프로모션을 언제 오픈할지, 취소 위약금 규정을 어떻게 설정할지 <strong>타이밍 마케팅</strong>을 최적화할 수 있습니다.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 과제 3 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(234, 179, 8, 0.1)'}}>
              <DollarSign size={24} className="text-yellow" style={{color: '#eab308'}} />
            </div>
            <h3>3. 채널별 수수료율 및 '순수익(Net Revenue)' 데이터 확보</h3>
          </div>
          <div className="card-body">
            <p style={{marginBottom: '12px'}}>
              <strong>현재 상태:</strong> 파이 차트 등에서 보여지는 각 판매 채널별(온라인, 세미나 등) 매출은 수수료를 떼기 전의 겉보기 매출액(Gross) 기준입니다.
            </p>
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num" style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>필요한 액션</span>
                <div style={{color: 'var(--text-main)'}}>
                  OTA(야놀자, 아고다 등)별로 지불하는 수수료율이 다릅니다. PMS에서 수수료가 차감된 <strong>'실수령액(Net Revenue)'</strong>을 바로 뽑을 수 있도록 세팅하거나, 영업 부서에서 채널별 명확한 평균 수수료율(%) 테이블을 제공해야 합니다.
                </div>
              </div>
              <div className="math-step" style={{borderLeftColor: 'var(--accent-emerald)'}}>
                <span className="step-num" style={{background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)'}}>기대 효과</span>
                <div style={{color: 'var(--text-main)'}}>
                  단순 매출 파이 차트가 아닌 <strong>'영업이익 파이 차트'</strong>를 그릴 수 있게 됩니다. 덩치만 크고 수수료를 많이 떼가는 채널을 가려내고, 마진율이 높은 자사 홈페이지(D2C) 예약으로 고객을 유도할 강력한 명분과 재무적 근거를 확보할 수 있습니다.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 과제 4 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(239, 68, 68, 0.1)'}}>
              <Filter size={24} className="text-red" style={{color: '#ef4444'}} />
            </div>
            <h3>4. 마켓 타입(판매 채널) 네이밍 룰(Naming Rule) 강제 통일</h3>
          </div>
          <div className="card-body">
            <p style={{marginBottom: '12px'}}>
              <strong>현재 상태:</strong> 예약실 직원이 고객의 예약 경로를 수기로 입력할 때 발생할 수 있는 오탈자나 띄어쓰기 오류로 인해, 같은 온라인 매출이라도 '온라인', '온라인자동', '야놀자' 등으로 파편화될 위험이 상존합니다.
            </p>
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num" style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>필요한 액션</span>
                <div style={{color: 'var(--text-main)'}}>
                  시스템(PMS)의 마켓 타입 입력 창을 자유 텍스트 타이핑 방식이 아닌 <strong>'선택형 드롭다운(객관식)'</strong>으로 완전히 고정해 버려야 합니다.
                </div>
              </div>
              <div className="math-step" style={{borderLeftColor: 'var(--accent-emerald)'}}>
                <span className="step-num" style={{background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)'}}>기대 효과</span>
                <div style={{color: 'var(--text-main)'}}>
                  이는 비용 없이 내일부터 당장 실천할 수 있는 <strong>가장 가성비 높은 조치</strong>입니다. 시너지 보드가 엑셀을 읽어 들일 때 발생하는 파싱(Parsing) 에러와 '기타' 분류 누락을 원천 차단하여, 데이터 분석의 신뢰도를 100%로 보장합니다.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 과제 5 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <TrendingUp size={24} style={{color: '#10b981'}} />
            </div>
            <h3>5. 분석엔진 이해하기: MRA 기법과 통계적 노이즈(결측치) 제어</h3>
          </div>
          <div className="card-body">
            <p style={{marginBottom: '12px'}}>
              예측치와 실제 수치의 오차를 극소화하기 위해 보드에 내장된 <strong>MRA 분석 엔진</strong>과 <strong>통계 노이즈 차단 장치</strong>의 핵심 작동 원리입니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num" style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>MRA (다중 회귀 분석) 엔진이란?</span>
                <div style={{color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.6'}}>
                  "여름 성수기인데 주말이고, 비까지 쏟아졌다"처럼 현실에서는 여러 상황이 동시에 일어납니다. MRA(Multiple Regression Analysis) 엔진은 복잡하게 뒤엉킨 변수들을 수학적으로 통제하여, <strong>"오직 비로 인해서만 발생한 순수 매출 타격(또는 반사이익)"</strong>을 한 치의 왜곡 없이 분리해 내는 고도의 통계 기술입니다.
                </div>
              </div>
              <div className="math-step" style={{borderLeftColor: 'var(--accent-coral)'}}>
                <span className="step-num" style={{background: 'rgba(244, 63, 94, 0.2)', color: 'var(--accent-coral)'}}>통계적 노이즈(결측치) 방어막</span>
                <div style={{color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.6'}}>
                  특정 부대업장(예: 식음 매장)이 데이터를 누락(결측)하여 시스템에 0원으로 기록된 경우, 이를 단순 평균값에 포함하면 통계가 심각하게 찌그러집니다(맑은 날은 대량 누락되어 매출이 적고, 비 오는 날은 데이터가 있어 매출이 높게 집계되는 등의 착시 현상). 시너지 보드는 <strong>중앙값(Median) 보정 로직</strong>과 <strong>최소 분석 표본 수(5일 이상) 제한</strong>을 통해 이러한 데이터 수집 편향(노이즈)을 지능적으로 감지해 내고 차단합니다.
                </div>
              </div>
            </div>
            
            <div className="alert-box info" style={{marginTop: '16px'}}>
              <Info size={16} />
              <span>
                <strong>💡 요약하자면:</strong> 날씨/성수기 핑계를 발라내 주는 것이 <strong>MRA 엔진</strong>이며, 드문드문 빠진 엑셀 데이터 때문에 발생하는 숫자 왜곡을 걸러내 주는 안전장치가 <strong>중앙값(Median) 노이즈 필터</strong>입니다.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
