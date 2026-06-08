import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "synergy-board",
  appId: "1:1090826952361:web:8ad8a33583b985c9a793b8",
  storageBucket: "synergy-board.firebasestorage.app",
  apiKey: "AIzaSyB3BlR6iCy11R49FbYss7OkhFxOQZYzcIY",
  authDomain: "synergy-board.firebaseapp.com",
  messagingSenderId: "1090826952361"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
