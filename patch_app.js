
const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Remove Firebase imports
content = content.replace(/import \{ collection, onSnapshot, doc \} from 'firebase\/firestore';\r?\n/, '');
content = content.replace(/import \{ db \} from '\.\/firebase';\r?\n/, '');

// Find and replace the onSnapshot block
const oldUseEffect = \  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'config', 'mainSettings'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    return () => {
      unsubSettings();
    };
  }, []);\;

const newUseEffect = \  useEffect(() => {
    // [V5 패치] Firebase를 제거하고 MariaDB 연동 API를 통해 설정값 호출
    const fetchConfig = async () => {
      try {
        const res = await fetch('https://belleforet-data.vercel.app/api/v5/dashboard/config');
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) setSettings(json.data);
        } else {
          console.warn('V5 Config API not ready yet. Using fallback settings.');
          setSettings({});
        }
      } catch (err) {
        console.error('Failed to fetch V5 config API:', err);
        setSettings({});
      }
    };
    fetchConfig();
  }, []);\;

content = content.replace(oldUseEffect, newUseEffect);
fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx patched.');

