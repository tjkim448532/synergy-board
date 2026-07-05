import React, { useState } from 'react';
import { Database, Download, ChevronDown, ChevronUp } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import './ApiDataExplorer.css';

export default function ApiDataExplorer({ processedData }) {
  const [expandedMonths, setExpandedMonths] = useState([]);

  const toggleMonth = (yearMonth) => {
    setExpandedMonths(prev => 
      prev.includes(yearMonth) ? prev.filter(m => m !== yearMonth) : [...prev, yearMonth]
    );
  };

  const handleExportCSV = () => {
    if (!processedData || processedData.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    // 기본 월별 요약 데이터 구성
    const exportData = processedData.map(d => ({
      '기준 월': d.yearMonth,
      '총 객실 판매수': d.totalSold,
      '총 투숙객 수': d.guests,
      '객실 점유율(%)': d.occupancyRate ? d.occupancyRate.toFixed(1) : '0.0',
      '객실 매출': d.totalRoomRevenue,
      'F&B 매출': d.fnbSales,
      '부대시설 매출': d.leisureSales,
      '모토아레나 매출': d.motoSales,
      '골프 매출': d.golfSales,
      '기타 매출': d.otherSales,
      '총 매출 (객실포함)': d.totalSales + d.totalRoomRevenue + d.golfSales
    }));

    try {
      const csv = Papa.unparse(exportData);
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel Korean support
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `synergy_data_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('엑셀(CSV) 파일이 다운로드되었습니다.');
    } catch (e) {
      toast.error('엑셀 내보내기 실패: ' + e.message);
    }
  };

  if (!processedData || processedData.length === 0) {
    return (
      <div className="api-data-explorer" style={{ textAlign: 'center', padding: '40px' }}>
        <Database size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px 0' }}>수집된 데이터가 없습니다.</h3>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>API에서 수신된 원시 데이터가 존재하지 않습니다.</p>
      </div>
    );
  }

  return (
    <div className="api-data-explorer">
      <div className="explorer-header">
        <h2><Database size={24} /> API 원시 데이터 조회 (데이터 허브)</h2>
        <button className="export-btn" onClick={handleExportCSV}>
          <Download size={18} />
          엑셀(CSV) 내보내기
        </button>
      </div>

      <div className="explorer-table-container">
        <table className="explorer-table">
          <thead>
            <tr>
              <th>기준 월</th>
              <th>총 객실 판매</th>
              <th>총 투숙객 수</th>
              <th>점유율</th>
              <th>객실 매출</th>
              <th>F&B 매출</th>
              <th>부대 매출 (레저)</th>
              <th>총 매출 (골프/객실 포함)</th>
              <th>상세 보기</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map(d => {
              const isExpanded = expandedMonths.includes(d.yearMonth);
              const totalOverall = d.totalRoomRevenue + d.totalSales + d.golfSales;
              
              return (
                <React.Fragment key={d.yearMonth}>
                  <tr className={`month-row ${isExpanded ? 'expanded-row' : ''}`} onClick={() => toggleMonth(d.yearMonth)}>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{d.yearMonth}</td>
                    <td>{d.totalSold?.toLocaleString()}실</td>
                    <td>{d.guests?.toLocaleString()}명</td>
                    <td>{d.occupancyRate?.toFixed(1)}%</td>
                    <td>{d.totalRoomRevenue?.toLocaleString()}원</td>
                    <td>{d.fnbSales?.toLocaleString()}원</td>
                    <td>{d.leisureSales?.toLocaleString()}원</td>
                    <td style={{ fontWeight: 'bold' }}>{totalOverall.toLocaleString()}원</td>
                    <td style={{ textAlign: 'center' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr>
                      <td colSpan="9" style={{ padding: 0 }}>
                        <div className="expanded-content">
                          
                          {/* 객실 판매 일별 상세 내역 */}
                          <div className="detail-section">
                            <h4>📅 객실 일별/타입별 판매 원본 내역 (최대 10건 미리보기)</h4>
                            {d.rawRoomRecords && d.rawRoomRecords.length > 0 ? (
                              <table className="detail-table">
                                <thead>
                                  <tr>
                                    <th>일자</th>
                                    <th>객실 타입</th>
                                    <th>판매수</th>
                                    <th>매출액</th>
                                    <th>날씨(최고기온/강수량)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {d.rawRoomRecords.slice(0, 10).map((rec, idx) => (
                                    <tr key={idx}>
                                      <td>{rec.date}</td>
                                      <td>{rec.roomType}</td>
                                      <td>{rec.count}실</td>
                                      <td>{rec.revenue?.toLocaleString()}원</td>
                                      <td>{rec.weatherTempMax}°C / {rec.weatherPrecipitation}mm</td>
                                    </tr>
                                  ))}
                                  {d.rawRoomRecords.length > 10 && (
                                    <tr>
                                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        ... 외 {d.rawRoomRecords.length - 10}건의 일별 기록이 더 있습니다.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>객실 일별 데이터가 없습니다.</p>
                            )}
                          </div>

                          {/* 영업장별 매출 그룹 상세 */}
                          <div className="detail-section">
                            <h4>🏪 부대시설 영업장별 매출 및 이용 내역</h4>
                            <table className="detail-table">
                              <thead>
                                <tr>
                                  <th>영업장명</th>
                                  <th>총 매출액</th>
                                  <th>이용객/티켓 발권 수</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.keys(d.salesByLocation || {}).map((venue, idx) => {
                                  const rev = d.salesByLocation[venue];
                                  const usage = d.leisureTicketUsage?.[venue] || 0;
                                  return (
                                    <tr key={idx}>
                                      <td>{venue}</td>
                                      <td>{rev?.toLocaleString()}원</td>
                                      <td>{usage > 0 ? `${usage.toLocaleString()}명/건` : '-'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
