import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "synergy-board",
  appId: "1:1090826952361:web:8ad8a33583b985c9a793b8",
  storageBucket: "synergy-board.firebasestorage.app"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'monthly_records'));
  let found = false;
  
  snap.forEach(doc => {
    const d = doc.data();
    if (!d.yearMonth) return;
    
    if (d.yearMonth) {
        console.log(`[${d.yearMonth}] Moto Total(Excel): ${d.motoTotalRev}, Guest: ${d.motoGuestRev}, General: ${d.motoGeneralRev}, Internal: ${d.motoInternalRev}, Other: ${d.motoOtherRev}, Final MotoSales: ${d.motoSales}`);
    }
    
    // check sums
    const room = d.totalRoomRevenue || 0;
    const leisure = d.leisureSales || 0;
    const fnb = d.fnbSales || 0;
    const moto = d.motoTotalRev || 0;
    const golf = d.golfSales || 0;
    const other = d.otherSales || 0;
    
    if (room === 1070798689) console.log("MATCH ROOM", d.yearMonth);
    if (leisure === 1070798689) console.log("MATCH LEISURE", d.yearMonth);
    if (moto === 1070798689) console.log("MATCH MOTO", d.yearMonth);
    
    const sumAll = room + leisure + fnb + moto + golf + other;
    console.log(`Month ${d.yearMonth} total: ${sumAll}, leisure: ${leisure}, room: ${room}, moto: ${moto}`);
    if (sumAll === 1070798689) console.log("MATCH TOTAL", d.yearMonth);
  });
  
  console.log("Done checking.");
  process.exit(0);
}
run();
