import React, { useState } from 'react';

function getCoordinatesForPercent(percent) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

export default function PieChart3D({ 
  data = [
    { label: '콘도 객실', value: 65, color: '#10b981' }, 
    { label: '레저 부문', value: 35, color: '#3b82f6' }
  ],
  depth = 30,
  tilt = 55
}) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);
  let cumulativePercent = 0;

  const slices = data.map(slice => {
    const percent = slice.value / total;
    const startX = getCoordinatesForPercent(cumulativePercent)[0];
    const startY = getCoordinatesForPercent(cumulativePercent)[1];
    
    cumulativePercent += percent;
    
    const endX = getCoordinatesForPercent(cumulativePercent)[0];
    const endY = getCoordinatesForPercent(cumulativePercent)[1];
    
    const largeArcFlag = percent > 0.5 ? 1 : 0;
    
    const pathData = [
      `M 0 0`,
      `L ${startX * 100} ${startY * 100}`,
      `A 100 100 0 ${largeArcFlag} 1 ${endX * 100} ${endY * 100}`,
      `Z`
    ].join(' ');

    return { ...slice, pathData, percent };
  });

  // Layered 3D rendering
  const layers = [];
  for (let i = depth; i >= 0; i--) {
    layers.push(
      <svg 
        key={i}
        viewBox="-110 -110 220 220" 
        style={{
          position: 'absolute',
          top: `${i}px`,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `rotateX(${tilt}deg) rotateZ(-45deg)`,
          filter: i === 0 ? 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' : 'none',
          opacity: i === 0 ? 1 : (i === depth ? 0.8 : 0.9)
        }}
      >
        {slices.map((slice, index) => (
          <path
            key={index}
            d={slice.pathData}
            fill={i === 0 ? slice.color : adjustBrightness(slice.color, -30)}
            stroke={i === 0 ? 'rgba(255,255,255,0.2)' : 'none'}
            strokeWidth="1"
            style={{
              cursor: 'pointer',
              transition: 'transform 0.3s ease',
              transform: hoverIndex === index && i === 0 ? 'scale(1.05) translateZ(10px)' : 'scale(1)',
              transformOrigin: 'center'
            }}
            onMouseEnter={() => i === 0 && setHoverIndex(index)}
            onMouseLeave={() => i === 0 && setHoverIndex(null)}
          />
        ))}
      </svg>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '40px', padding: '20px' }}>
      <div style={{ position: 'relative', width: '300px', height: '300px' }}>
        {layers}
      </div>
      <div className="pie-legend" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {data.map((item, i) => (
          <div 
            key={i} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '12px 16px',
              background: hoverIndex === i ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: '8px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: item.color }} />
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{item.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                {item.value.toLocaleString()} ({((item.value/total)*100).toFixed(1)}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function adjustBrightness(hex, percent) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.floor(r * (100 + percent) / 100);
  g = Math.floor(g * (100 + percent) / 100);
  b = Math.floor(b * (100 + percent) / 100);

  r = r < 255 ? r : 255;
  g = g < 255 ? g : 255;
  b = b < 255 ? b : 255;

  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}
