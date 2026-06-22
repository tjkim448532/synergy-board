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
  Search,
  CloudRain,
  Smile,
  Zap
} from 'lucide-react';
import './LogicGuide.css';

export default function LogicGuide() {
  return (
    <div className="logic-guide-container">
      <div className="guide-header glass-panel">
        <div className="header-icon-wrapper">
          <Smile size={32} className="text-emerald" />
        </div>
        <div>
          <h2>분석 로직 가이드 (완전 쉬운 버전 🐣)</h2>
          <p className="text-muted" style={{marginTop: '8px'}}>
            "컴퓨터가 도대체 어떻게 숫자를 뽑아내는 거지?" 궁금하셨죠? 경영진부터 신입사원까지, 누구나 이해할 수 있게 시너지 보드의 작동 원리를 아주 쉽게 설명해 드립니다.
          </p>
        </div>
      </div>

      <div className="guide-cards">
        
        {/* 0. 재료 손질하기 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginBottom: '12px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <Search size={24} className="text-emerald" style={{color: '#10b981'}} />
            </div>
            <h3>0. 요리 준비! (데이터 재료 손질하기)</h3>
          </div>
          <div className="card-body">
            <p>
              맛있는 요리(경영 전략)를 만들려면 신선한 재료(데이터)가 필요합니다. 시너지 보드는 여러분이 올려주신 엑셀 파일들을 어떻게 요리할까요?
            </p>
            
            <div className="toggle-explanation" style={{marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
              <div className="toggle-state active" style={{flex: '1 1 100%', margin: 0}}>
                <h4 style={{color: 'var(--accent-blue)', marginBottom: '8px'}}>A. 객실 엑셀 (몇 명이 어디서 자고 갔나?)</h4>
                <ul style={{fontSize: '13px', lineHeight: '1.6'}}>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>무엇을 보나요?</strong> 날짜별로 16평, 35평, 51평이 몇 개 팔렸고, 얼마 벌었는지 쏙쏙 골라냅니다.</li>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>어디에 쓰나요?</strong> "오늘 우리 객실 점유율이 몇 프로지?" 계산하는 가장 중요한 기초 자료가 됩니다.</li>
                </ul>
              </div>
              
              <div className="toggle-state active" style={{flex: '1 1 100%', margin: 0}}>
                <h4 style={{color: 'var(--accent-gold)', marginBottom: '8px'}}>B. 영업장 엑셀 (다들 식당이랑 골프장에서 얼마 썼나?)</h4>
                <ul style={{fontSize: '13px', lineHeight: '1.6'}}>
                  <li><CheckCircle2 size={14} className="text-emerald" /> <strong>무엇을 보나요?</strong> 수십 개의 매장 이름을 보고 똑똑하게 <strong>[식음, 레저, 골프, 모토, 기타]</strong> 5개 바구니로 착착 나눠 담습니다.</li>
                </ul>
                <div className="alert-box success" style={{marginTop: '12px', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', padding: '10px'}}>
                  <Info size={14} style={{color: '#ef4444', flexShrink: 0}} />
                  <span style={{color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.5'}}>
                    <strong>💡 명탐정 기능:</strong> 영업장 엑셀에도 '객실 매출'이 적혀 있는데, 컴퓨터는 이걸 A파일의 객실 매출과 1원 단위까지 비교해 봅니다. 두 개가 다르면 "어? 누군가 엑셀을 잘못 뽑았는데?" 하고 찾아내는 감시 카메라 역할을 합니다.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1. 방 갯수 세기 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <Building2 size={24} />
            </div>
            <h3>1. 기준점 세우기 (우리에겐 방이 몇 개?)</h3>
          </div>
          <div className="card-body">
            <p>
              "오늘 방 50개 팔았다!" 이게 잘한 걸까요? 전체 방이 50개면 100점이지만, 1000개면 50점입니다. 그래서 컴퓨터는 <strong>'총 방 갯수'</strong>를 꽉 붙들고 있습니다.
            </p>
            <div className="formula-box">
              <div className="formula-item">
                <span className="label">우리의 총 객실</span>
                <span className="value text-accent">175 개</span>
              </div>
            </div>
            <div className="alert-box info">
              <Info size={16} />
              <span>모든 점유율 계산은 무조건 이 175개에서 출발합니다. 절대로 흔들리지 않는 든든한 주춧돌이죠.</span>
            </div>
          </div>
        </div>

        {/* 2. 51평 방 쪼개기 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <SplitSquareHorizontal size={24} />
            </div>
            <h3>2. 51평형 쪼개기 마술 (방 1개야? 2개야?)</h3>
          </div>
          <div className="card-body">
            <p>
              51평형은 문을 열면 방이 2개(커넥팅 룸)입니다. 이걸 1개로 칠까요, 2개로 칠까요? 설정에서 마음대로 바꿀 수 있습니다!
            </p>
            <div className="toggle-explanation">
              <div className="toggle-state active">
                <h4>방 2개로 칠게요! (기본)</h4>
                <ul>
                  <li><CheckCircle2 size={14} className="text-emerald" /> 175개 중에서 하나 팔리면 "방 2개 나갔어!" 하고 카운트합니다.</li>
                </ul>
              </div>
              <div className="toggle-state">
                <h4>방 1개로 칠게요!</h4>
                <ul>
                  <li><CheckCircle2 size={14} className="text-emerald" /> 총 객실을 아예 90개(175 - 85)로 줄여버리고, 하나 팔리면 "방 1개 나갔네" 합니다.</li>
                </ul>
              </div>
            </div>
            <div className="alert-box success">
              <Info size={16} />
              <span>
                <strong>💡 휠체어방 예외:</strong> 단, 휠체어 손님이 쓰는 장애인 객실은 무조건 방 1개로만 칩니다. 컴퓨터가 똑똑하게 알아서 예외 처리합니다.
              </span>
            </div>
          </div>
        </div>

        {/* 3. 주중/주말 억울함 풀기 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <CalendarDays size={24} />
            </div>
            <h3>3. 주중/주말 억울함 풀어주기</h3>
          </div>
          <div className="card-body">
            <p>
              예약 기록을 보면 주중이랑 주말을 나눌 때 "예약 건수"로만 엑셀에 찍힙니다. 그러면 방이 2개짜리인 51평형이 많이 팔린 날은 손해를 봅니다.
            </p>
            <div className="alert-box success">
              <CheckCircle2 size={16} />
              <span>
                <strong>컴퓨터의 해결책:</strong> "어? 주말 예약에 51평이 많이 껴있네? 그럼 주말 점수에 가산점(가중치)을 더 줄게!" 이렇게 해서 전체 한 달 점유율과 딱 맞아떨어지게 공평하게 계산해 줍니다.
              </span>
            </div>
          </div>
        </div>

        {/* 4. 과거를 보고 미래 맞추기 */}
        <div className="guide-card glass-panel">
          <div className="card-top">
            <div className="icon-circle">
              <TrendingUp size={24} />
            </div>
            <h3>4. 미래 예측하기 (과거를 보면 미래가 보인다)</h3>
          </div>
          <div className="card-body">
            <p>
              시뮬레이터에서 점유율 슬라이더를 슥 밀면 매출이 바로 뜹니다. 어떻게 아는 걸까요?
            </p>
            <div className="visual-diagram">
              <div className="diagram-dot dot-1"></div>
              <div className="diagram-dot dot-2"></div>
              <div className="diagram-dot dot-3"></div>
              <div className="diagram-dot dot-4"></div>
              <div className="diagram-line"></div>
              <span className="diagram-label x-axis">객실 찬 비율(점유율)</span>
              <span className="diagram-label y-axis">얼마나 벌었나?(매출)</span>
            </div>
            <p className="text-small text-muted" style={{marginTop: '12px', lineHeight: '1.5'}}>
              단순하게 곱하기를 하는 게 아닙니다. 컴퓨터가 지난 몇 달 동안 "점유율이 이정도일 때 밥은 얼마나 먹었지?"를 점으로 다 찍어보고, <strong>가장 정확한 중심선(추세선)</strong>을 그어놓고 대답해주는 겁니다.
            </p>
          </div>
        </div>

      </div>

      <div className="guide-cards" style={{marginTop: '24px'}}>
        
        {/* 6. 진짜 시너지 찾기 (심슨의 역설 제거) */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(236, 72, 153, 0.1)'}}>
              <Zap size={24} className="text-pink" style={{color: '#ec4899'}} />
            </div>
            <h3>6. 진짜 파급력 찾기 (거품 걷어내기 대작전)</h3>
          </div>
          <div className="card-body">
            <p>
              "51평 손님들이 수영장(레저) 매출을 엄청 올려준다!" 정말일까요? 어쩌면 <strong>'여름 휴가철 성수기'</strong>라서 51평도 많이 팔리고 수영장도 장사가 잘 된 건 아닐까요?
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">Step 1: 심슨의 역설(착시 현상) 발견</span>
                <div style={{color: 'var(--text-muted)'}}>
                  여름 피크 시즌에 놀러온 사람들이 물놀이를 많이 한 걸 가지고, 51평형 객실 자체가 레저 매출을 끌어올린다고 착각하는 것을 통계학에서는 '심슨의 역설'이라고 부릅니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 2: AI 명탐정의 거품 걷어내기 (다중 회귀 분석 MRA)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  그래서 시너지 보드는 <strong>매일매일(365일)</strong> 데이터를 분석합니다. 그리고 <strong>"그날 비가 왔나? 눈이 왔나? 바람이 불었나? 여름 성수기였나?"</strong>를 전부 체크해서, 그 효과들을 빼버립니다(통제합니다).
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Step 3: 순수 마케팅 파급력 도출</span>
                <div style={{color: 'var(--text-muted)'}}>
                  날씨 핑계, 성수기 핑계를 다 빼고 남은 숫자가 대시보드에 <strong>1%당 파급력(₩)</strong>으로 뜹니다. 진짜배기 마케팅 실력을 뜻하는 숫자입니다!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7. 진짜 돈벌이 지표 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(234, 179, 8, 0.1)'}}>
              <CheckCircle2 size={24} className="text-yellow" style={{color: '#eab308'}} />
            </div>
            <h3>7. 진짜 돈벌이 지표 (RevPAR & TrevPAR)</h3>
          </div>
          <div className="card-body">
            <p>
              총매출만 보면 우리 리조트가 장사를 잘하고 있는지 모릅니다. 그래서 <strong>"방 1개"</strong>를 기준으로 성적표를 매깁니다.
            </p>
            
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">RevPAR (객실 성적표)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>객실 총매출 ÷ 전체 빈방+찬방</code><br/>
                  방 1개가 벌어들인 순수 숙박비입니다. 방을 싸게 많이 파는 게 나은지, 비싸게 적게 파는 게 나은지 알려줍니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">Gross TrevPAR (리조트 전체 성적표)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  <code>(객실 + 모든 부대매출) ÷ 전체 방</code><br/>
                  동네 주민(워크인)이 식당에서 밥 먹은 것까지 다 합쳐서 방 1개당 가치로 나눈 '리조트 덩치' 성적표입니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">순수(Pure) TrevPAR (진짜배기 성적표)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  동네 주민이 쓴 돈은 싹 빼고, 오직 <strong>우리 방에서 자고 간 손님이 밥 먹고 수영한 돈</strong>만 더해서 성적을 냅니다. 우리가 진짜 고객을 얼마나 잘 쥐어짰는지(?) 보여줍니다!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 10. 밥그릇 한계 인정 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(244, 63, 94, 0.1)'}}>
              <Building2 size={24} className="text-rose" style={{color: '#f43f5e'}} />
            </div>
            <h3>10. 밥그릇 크기 인정하기 (시뮬레이터 상한선 방어벽)</h3>
          </div>
          <div className="card-body">
            <p>
              우리가 객실을 천 개, 만 개 짓는다고 식당 매출이 무한정 늘어날까요? 식당 테이블은 10개 뿐인데요!
            </p>
            <div className="alert-box warning" style={{marginTop: '16px', borderColor: 'rgba(244, 63, 94, 0.3)', background: 'rgba(244, 63, 94, 0.05)'}}>
              <Info size={16} style={{color: '#f43f5e'}} />
              <span style={{color: 'var(--text-main)'}}>
                컴퓨터는 이 현실을 알고 있습니다. 설정에서 "식당 테이블이 80% 차있어"라고 알려주면, 컴퓨터는 "아, 그럼 앞으로 식음 매출은 지금보다 조금밖에 더 못 오르겠네!" 하고 매출이 너무 뻥튀기되지 않게 알아서 가위질(Cap)을 해줍니다. 경영진이 엉뚱한 장밋빛 전망에 속지 않게 지켜주는 든든한 방어벽이죠.
              </span>
            </div>
          </div>
        </div>

        {/* 11. 날씨 요정 */}
        <div className="guide-card glass-panel" style={{gridColumn: '1 / -1', marginTop: '24px'}}>
          <div className="card-top">
            <div className="icon-circle" style={{background: 'rgba(14, 165, 233, 0.1)'}}>
              <CloudRain size={24} className="text-sky" style={{color: '#0ea5e9'}} />
            </div>
            <h3>11. 날씨 요정의 마법 (장마와 비오는 날 예측)</h3>
          </div>
          <div className="card-body">
            <p>
              시뮬레이터에 날씨를 넣으면 아주 똑똑하게 매출을 깎아줍니다. 
            </p>
            <div className="formula-box vertical" style={{marginTop: '16px'}}>
              <div className="math-step">
                <span className="step-num">마법 1: 평일 비 vs 주말 비</span>
                <div style={{color: 'var(--text-muted)'}}>
                  원래 사람 없는 평일에 비 오는 것과, 대목인 주말에 비 오는 건 타격이 다릅니다. 컴퓨터는 평일 기준선과 주말 기준선을 따로 잡고 계산합니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">마법 2: 장마철 지침 현상</span>
                <div style={{color: 'var(--text-muted)'}}>
                  어제도 비, 그제도 비, 오늘도 비? 사람들이 지쳐서 더 안 옵니다. 3일 연속 비가 오면 매출을 한 번 더 깎아냅니다.
                </div>
              </div>
              <div className="math-step">
                <span className="step-num">마법 3: 실내 매장의 반란 (풍선 효과)</span>
                <div style={{color: 'var(--text-muted)'}}>
                  레저(야외)는 비 오면 망하지만, 실내 식당은 비 오면 오히려 손님이 멉니다! 컴퓨터는 이걸 알아채고 실내 매장 매출은 오히려 팍팍 올려주는 센스를 발휘합니다.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
