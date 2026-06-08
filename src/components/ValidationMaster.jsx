import React, { useMemo } from 'react';
import './ValidationMaster.css';

const MOCK_VALIDATION_DATA = [
  { grand: 'Water Park (워터파크)', site: 'Indoor Zone (실내존)', ticket: 'Day Pass (종일권)', basePrice: 45000, minPrice: 30000, maxPrice: 60000, status: 'valid' },
  { grand: 'Water Park (워터파크)', site: 'Indoor Zone (실내존)', ticket: 'Afternoon Pass (오후권)', basePrice: 35000, minPrice: 20000, maxPrice: 50000, status: 'valid' },
  { grand: 'Water Park (워터파크)', site: 'Outdoor Zone (야외존)', ticket: 'Day Pass (종일권)', basePrice: 50000, minPrice: 35000, maxPrice: 70000, status: 'warning' },
  { grand: 'Ski Resort (스키장)', site: 'Lift (리프트)', ticket: 'Half-day Lift (반일권)', basePrice: 60000, minPrice: 40000, maxPrice: 80000, status: 'valid' },
  { grand: 'Ski Resort (스키장)', site: 'Lift (리프트)', ticket: 'Full-day Lift (주간권)', basePrice: 80000, minPrice: 60000, maxPrice: 100000, status: 'valid' },
  { grand: 'Ski Resort (스키장)', site: 'Rental (렌탈)', ticket: 'Gear Rental (장비렌탈)', basePrice: 30000, minPrice: 20000, maxPrice: 40000, status: 'error' },
  { grand: 'Golf Club (골프클럽)', site: 'Valley Course', ticket: 'Green Fee (그린피)', basePrice: 150000, minPrice: 100000, maxPrice: 200000, status: 'valid' },
  { grand: 'Golf Club (골프클럽)', site: 'Valley Course', ticket: 'Cart Fee (카트비)', basePrice: 90000, minPrice: 90000, maxPrice: 90000, status: 'valid' },
];

export default function ValidationMaster() {
  
  const formattedData = useMemo(() => {
    let grandSpans = {};
    let siteSpans = {};
    
    // Calculate row spans
    for (let i = MOCK_VALIDATION_DATA.length - 1; i >= 0; i--) {
      const row = MOCK_VALIDATION_DATA[i];
      const grandKey = row.grand;
      const siteKey = row.grand + '-' + row.site;

      grandSpans[grandKey] = (grandSpans[grandKey] || 0) + 1;
      siteSpans[siteKey] = (siteSpans[siteKey] || 0) + 1;
    }

    let processedGrand = new Set();
    let processedSite = new Set();

    return MOCK_VALIDATION_DATA.map(row => {
      const grandKey = row.grand;
      const siteKey = row.grand + '-' + row.site;
      
      const newRow = { ...row, grandRowSpan: 0, siteRowSpan: 0 };
      
      if (!processedGrand.has(grandKey)) {
        newRow.grandRowSpan = grandSpans[grandKey];
        processedGrand.add(grandKey);
      }
      
      if (!processedSite.has(siteKey)) {
        newRow.siteRowSpan = siteSpans[siteKey];
        processedSite.add(siteKey);
      }
      
      return newRow;
    });
  }, []);

  const formatCurrency = (val) => val.toLocaleString();

  return (
    <div className="validation-container">
      <div className="validation-header">
        <h2>검증 마스터 데이터</h2>
        <div className="validation-actions">
          <button className="btn-primary">월별 데이터 업로드</button>
          <button className="btn-secondary">검증 규칙 내보내기</button>
        </div>
      </div>
      
      <div className="table-wrapper glass-panel">
        <table className="validation-table">
          <thead>
            <tr>
              <th>대분류 (Grand Category)</th>
              <th>영업장 (Operating Site)</th>
              <th>티켓그룹 (Ticket Group)</th>
              <th>기준단가</th>
              <th>최소단가</th>
              <th>최대단가</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {formattedData.map((row, idx) => (
              <tr key={idx}>
                {row.grandRowSpan > 0 && (
                  <td rowSpan={row.grandRowSpan} className="merged-cell category-cell">
                    {row.grand}
                  </td>
                )}
                {row.siteRowSpan > 0 && (
                  <td rowSpan={row.siteRowSpan} className="merged-cell site-cell">
                    {row.site}
                  </td>
                )}
                <td>{row.ticket}</td>
                <td className="number-cell">{formatCurrency(row.basePrice)}</td>
                <td className="number-cell">{formatCurrency(row.minPrice)}</td>
                <td className="number-cell">{formatCurrency(row.maxPrice)}</td>
                <td>
                  <span className={`status-badge ${row.status}`}>
                    {row.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
