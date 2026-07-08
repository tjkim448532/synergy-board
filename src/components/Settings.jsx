import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function Settings({ settings }) {
  const [jsonText, setJsonText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // settings prop이 변경되면 (최초 로딩 등) 텍스트 에디터에 주입
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0 && !jsonText) {
      setJsonText(JSON.stringify(settings, null, 2));
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      
      // 1. Validate JSON
      const parsedData = JSON.parse(jsonText);
      
      // 2. Save to Firebase
      const docRef = doc(db, 'config', 'mainSettings');
      await updateDoc(docRef, parsedData);
      
      toast.success('설정 데이터가 Firebase에 저장되었습니다.\n앱이 즉시 동기화됩니다.', {
        icon: '✅',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
    } catch (err) {
      console.error(err);
      setError('JSON 형식이 잘못되었거나 저장 중 오류가 발생했습니다: ' + err.message);
      toast.error('저장 실패: JSON 형식을 확인하세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel"
        style={{ padding: '32px', borderRadius: '16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ 시스템 메타데이터 설정 (Remote Config)
            </h2>
            <p style={{ color: '#94a3b8', marginTop: '8px' }}>
              백엔드 DB(MariaDB)를 수정하지 않고, 프론트엔드 전역에서 참조하는 메타데이터(예산, 카테고리 맵핑, 커스텀 휴무일)를 직접 관리합니다. 엑셀 업로드는 더 이상 지원하지 않습니다.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: isSaving ? '#475569' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            <Save size={20} />
            {isSaving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', color: '#fca5a5', marginBottom: '24px', borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
            <span>JSON Editor</span>
            <span style={{ fontSize: '14px', color: '#64748b' }}>엄격한 JSON 형식을 유지해 주세요 (큰따옴표 사용).</span>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            style={{
              width: '100%',
              height: '500px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              color: '#34d399', // Matrix green for code
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #334155',
              fontFamily: 'monospace',
              fontSize: '15px',
              lineHeight: '1.5',
              outline: 'none',
              resize: 'vertical'
            }}
            spellCheck="false"
          />
        </div>
      </motion.div>
    </div>
  );
}
