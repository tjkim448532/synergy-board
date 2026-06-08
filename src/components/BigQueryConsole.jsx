import React, { useState } from 'react';
import { Play, Database as DbIcon, Terminal } from 'lucide-react';
import './BigQueryConsole.css';

export default function BigQueryConsole() {
  const [query, setQuery] = useState('SELECT\n  year_month,\n  occupancy_rate,\n  leisure_sales,\n  CORR(occupancy_rate, leisure_sales) OVER() as pearson_r\nFROM `project.dataset.monthly_data`\nORDER BY year_month DESC;');
  const [results, setResults] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const executeQuery = () => {
    setIsExecuting(true);
    // Simulate network delay and BigQuery processing
    setTimeout(() => {
      setResults([
        { year_month: '2025-12', occupancy_rate: '88.5%', leisure_sales: '2,150,000,000', pearson_r: '0.86' },
        { year_month: '2025-11', occupancy_rate: '72.1%', leisure_sales: '1,640,000,000', pearson_r: '0.86' },
        { year_month: '2025-10', occupancy_rate: '65.4%', leisure_sales: '1,420,000,000', pearson_r: '0.86' },
      ]);
      setIsExecuting(false);
    }, 1200);
  };

  return (
    <div className="bq-container">
      <div className="bq-header">
        <div className="tab active"><Terminal size={16} /> SQL Editor</div>
        <div className="tab"><DbIcon size={16} /> Firestore Data Viewer</div>
      </div>
      
      <div className="bq-editor-section">
        <textarea 
          className="bq-textarea" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        <div className="bq-actions">
          <button className="run-query-btn" onClick={executeQuery} disabled={isExecuting}>
            <Play size={16} fill="currentColor" /> {isExecuting ? 'Running...' : 'Run Query'}
          </button>
        </div>
      </div>

      <div className="bq-results-section glass-panel">
        <div className="results-header">Query Results</div>
        {results ? (
          <table className="results-table">
            <thead>
              <tr>
                {Object.keys(results[0]).map(key => <th key={key}>{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => <td key={j}>{val}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-results">No data to display. Run a query.</div>
        )}
      </div>
    </div>
  );
}
