import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { calculateGroupedSales } from "./src/utils/revenueUtils.js";

const firebaseConfig = {
  projectId: "synergy-board",
  appId: "1:1090826952361:web:8ad8a33583b985c9a793b8",
  storageBucket: "synergy-board.firebasestorage.app"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const docRef = doc(db, 'monthly_records', '2025-01');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    console.log("No data for 2025-05");
    return;
  }
  const d = snap.data();
  console.log("=== DB Raw Data ===");
  console.log("totalRoomRevenue:", d.totalRoomRevenue);
  
  const salesObj = { ...(d.salesByLocation || d.leisureSalesByLocation || {}) };
  
  if (d.motoTotalRev && !salesObj['모토아레나']) {
    salesObj['모토아레나(티켓)'] = Number(d.motoTotalRev);
  }

  if (d.venues) {
    Object.entries(d.venues).forEach(([vName, vData]) => {
      const ignoreList = ['모토아레나', 'ROOM', 'ROOM OTHER', '합계'];
      if (!ignoreList.includes(vName) && !salesObj[vName]) { 
        salesObj[`${vName}(티켓)`] = Number(vData.totalRev || 0);
      }
    });
  }

  console.log("\n=== Final salesObj ===");
  console.log(salesObj);

  const calculated = calculateGroupedSales(salesObj, {});
  console.log("\n=== Calculated Groups (Fallback defaults) ===");
  console.log(calculated);

  console.log("\n=== Final UI Table Expected ===");
  console.log("객실:", d.totalRoomRevenue);
  console.log("레저본부:", calculated.leisure);
  console.log("식음:", calculated.fnb);
  console.log("모토아레나:", calculated.moto);
  console.log("골프:", calculated.golf);
  console.log("기타:", calculated.other);
  
  const total = d.totalRoomRevenue + calculated.leisure + calculated.fnb + calculated.moto + calculated.golf + calculated.other;
  console.log("총매출:", total);
  
  process.exit(0);
}
run();
