import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteField } from "firebase/firestore";

const firebaseConfig = {
  projectId: "synergy-board",
  appId: "1:1090826952361:web:8ad8a33583b985c9a793b8",
  storageBucket: "synergy-board.firebasestorage.app",
  apiKey: "AIzaSyB3BlR6iCy11R49FbYss7OkhFxOQZYzcIY",
  authDomain: "synergy-board.firebaseapp.com",
  messagingSenderId: "1090826952361"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearLeisureData() {
  const querySnapshot = await getDocs(collection(db, "monthly_records"));
  let count = 0;
  for (const document of querySnapshot.docs) {
    const docRef = doc(db, "monthly_records", document.id);
    await updateDoc(docRef, {
      leisureSales: deleteField(),
      leisureSalesByLocation: deleteField()
    });
    count++;
  }
  console.log(`Cleared leisure data from ${count} records.`);
  process.exit(0);
}

clearLeisureData();
