import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "synergy-board",
  appId: "1:1090826952361:web:8ad8a33583b985c9a793b8",
  storageBucket: "synergy-board.firebasestorage.app",
  apiKey: "AIzaSyB3BlR6" + "iCy11R49FbYss7OkhFxOQZYzcIY",
  authDomain: "synergy-board.firebaseapp.com",
  messagingSenderId: "1090826952361"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function compare() {
  try {
    const snapshot = await getDocs(collection(db, 'monthly_records'));
    snapshot.forEach(doc => {
      const d = doc.data();
      const format = (num) => new Intl.NumberFormat('ko-KR').format(num);
      const total = (d.totalRoomRevenue || 0) + (d.leisureSales || 0) + (d.motoTotalRev || 0) + (d.fnbSales || 0) + (d.otherSales || 0) + (d.golfSales || 0);
      console.log(`[${doc.id}] 객실: ${format(d.totalRoomRevenue || 0)} / 레저: ${format(d.leisureSales || 0)} / 식음: ${format(d.fnbSales || 0)} / 모토: ${format(d.motoTotalRev || 0)} / 총합: ${format(total)}`);
    });
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

compare();
