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

async function calc() {
  try {
    const snapshot = await getDocs(collection(db, 'monthly_records'));
    let totRev = 0, totLeisure = 0, totMoto = 0, totFnb = 0, totOther = 0;
    let monthsCount = 0;

    snapshot.forEach(doc => {
      const d = doc.data();
      if (!d.yearMonth) return;
      monthsCount++;
      if (d.yearMonth === '2025-05') {
        console.log("=== 2025-05 venues ===");
        console.log(d.venues);
      }
    });

    const sum = totRev + totLeisure + totMoto + totFnb + totOther;
    const annual = (sum / monthsCount) * 12;

    console.log(`Total Sum: ${sum}`);
    console.log(`Months Count: ${monthsCount}`);
    console.log(`Annualized: ${annual}`);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

calc();
