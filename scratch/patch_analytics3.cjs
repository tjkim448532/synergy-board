const fs = require('fs');
const file = 'src/components/AdvancedAnalytics.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetLines = [
  "{(!dailyWeatherSalesData || dailyWeatherSalesData.length === 0) ? (",
  "        <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>",
  "          과거 2개월치 날씨 및 매출 데이터를 분석 중입니다...",
  "        </div>",
  "      ) : (",
  "        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>"
].join('\n');

const replaceLines = [
  "{(!dailyWeatherSalesData || dailyWeatherSalesData.length === 0) ? (",
  "        <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>",
  "          과거 2개월치 날씨 및 매출 데이터를 분석 중입니다...",
  "        </div>",
  "      ) : !weatherStats ? (",
  "        <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>",
  "          선택된 기간({startDate} ~ {endDate})에 유효한 기상청 날씨 데이터가 수신되지 않아 상관관계를 분석할 수 없습니다.",
  "        </div>",
  "      ) : (",
  "        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>"
].join('\n');

if (content.includes(targetLines)) {
  content = content.replace(targetLines, replaceLines);
  fs.writeFileSync(file, content);
  console.log("Success");
} else {
  console.log("Target lines not found exactly. Trying fallback regex.");
  content = content.replace(
    /\{\(!dailyWeatherSalesData \|\| dailyWeatherSalesData\.length === 0\) \? \([\s\S]*?\) : \(/,
    `{(!dailyWeatherSalesData || dailyWeatherSalesData.length === 0) ? (
        <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>
          과거 2개월치 날씨 및 매출 데이터를 분석 중입니다...
        </div>
      ) : !weatherStats ? (
        <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>
          선택된 기간({startDate} ~ {endDate})에 유효한 기상청 날씨 데이터가 수신되지 않아 상관관계를 분석할 수 없습니다.
        </div>
      ) : (`
  );
  fs.writeFileSync(file, content);
  console.log("Fallback applied");
}
