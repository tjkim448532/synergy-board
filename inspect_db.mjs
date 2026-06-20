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

async function run() {
  const snapshot = await getDocs(collection(db, 'monthly_records'));
  snapshot.forEach(doc => {
    const d = doc.data();
    console.log(`========================================`);
    console.log(`Document ID (Month): ${doc.id}`);
    
    if (d.rawRoomRecords && d.rawRoomRecords.length > 0) {
      console.log(`  rawRoomRecords count: ${d.rawRoomRecords.length}`);
      console.log(`  Sample rawRoomRecords[0]:`, JSON.stringify(d.rawRoomRecords[0], null, 2));
    } else {
      console.log(`  rawRoomRecords: EMPTY`);
    }
    
    if (d.rawLeisureRecords && d.rawLeisureRecords.length > 0) {
      console.log(`  rawLeisureRecords count: ${d.rawLeisureRecords.length}`);
      console.log(`  Sample rawLeisureRecords[0]:`, JSON.stringify(d.rawLeisureRecords[0], null, 2));
      console.log(`  Sample rawLeisureRecords[1]:`, JSON.stringify(d.rawLeisureRecords[1], null, 2));
    } else {
      console.log(`  rawLeisureRecords: EMPTY`);
    }
  });
  process.exit(0);
}
run();
