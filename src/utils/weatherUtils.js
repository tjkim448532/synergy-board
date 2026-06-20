/**
 * weatherUtils.js
 * 벨포레 증평 위치(위도: 36.8451° N, 경도: 127.5821° E)의 날씨를 조회하고 가공하는 유틸리티입니다.
 */

export const getWeatherDesc = (code) => {
  if (code === 0) return '맑음';
  if ([1, 2, 3].includes(code)) return '구름많음';
  if ([45, 48].includes(code)) return '안개';
  if ([51, 53, 55, 56, 57].includes(code)) return '이슬비';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '비';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '눈';
  if ([95, 96, 99].includes(code)) return '뇌우';
  return '흐림';
};

export const fetchWeatherForRange = async (startDate, endDate) => {
  if (!startDate || !endDate) return {};
  const lat = 36.8451;
  const lon = 127.5821;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Seoul`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API HTTP error: ${response.status}`);
    const data = await response.json();
    const daily = data.daily;
    const weatherMap = {};
    
    if (daily && daily.time) {
      daily.time.forEach((t, i) => {
        const code = daily.weather_code[i];
        weatherMap[t] = {
          tempMax: daily.temperature_2m_max[i] !== null ? Number(daily.temperature_2m_max[i]) : null,
          tempMin: daily.temperature_2m_min[i] !== null ? Number(daily.temperature_2m_min[i]) : null,
          precipitation: daily.precipitation_sum[i] !== null ? Number(daily.precipitation_sum[i]) : null,
          code: code,
          desc: getWeatherDesc(code)
        };
      });
    }
    return weatherMap;
  } catch (error) {
    console.error("fetchWeatherForRange failed:", error);
    return {};
  }
};
