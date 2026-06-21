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
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=precipitation&timezone=Asia/Seoul`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API HTTP error: ${response.status}`);
    const data = await response.json();
    const daily = data.daily;
    const hourly = data.hourly;
    const weatherMap = {};
    
    if (daily && daily.time) {
      daily.time.forEach((t, i) => {
        const code = daily.weather_code[i];
        weatherMap[t] = {
          tempMax: daily.temperature_2m_max[i] !== null ? Number(daily.temperature_2m_max[i]) : null,
          tempMin: daily.temperature_2m_min[i] !== null ? Number(daily.temperature_2m_min[i]) : null,
          precipitation: daily.precipitation_sum[i] !== null ? Number(daily.precipitation_sum[i]) : null,
          daytimePrecip: 0,
          nighttimePrecip: 0,
          code: code,
          desc: getWeatherDesc(code)
        };
      });
    }

    if (hourly && hourly.time && hourly.precipitation) {
      hourly.time.forEach((t, i) => {
        const [dateStr, timeStr] = t.split('T'); // "2024-01-01" and "05:00"
        const hour = parseInt(timeStr.split(':')[0], 10);
        const precip = hourly.precipitation[i] || 0;
        
        if (weatherMap[dateStr]) {
          // 주간: 05:00 ~ 20:00 (5시 포함, 20시 포함)
          if (hour >= 5 && hour <= 20) {
            weatherMap[dateStr].daytimePrecip += precip;
          } else {
            weatherMap[dateStr].nighttimePrecip += precip;
          }
        }
      });
    }

    return weatherMap;
  } catch (error) {
    console.error("fetchWeatherForRange failed:", error);
    return {};
  }
};

export const fetchCurrentWeather = async () => {
  const lat = 36.8451;
  const lon = 127.5821;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Asia/Seoul`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API HTTP error: ${response.status}`);
    const data = await response.json();
    const cur = data.current_weather;
    if (cur) {
      return {
        temp: cur.temperature,
        code: cur.weathercode,
        desc: getWeatherDesc(cur.weathercode),
        time: cur.time
      };
    }
    return null;
  } catch (error) {
    console.error("fetchCurrentWeather failed:", error);
    return null;
  }
};

