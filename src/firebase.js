import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAb9Vlu0THC1GTPW2Rd6GbPgCxh3seIttU",
  authDomain: "sudoku-wizard-f341c.firebaseapp.com",
  projectId: "sudoku-wizard-f341c",
  storageBucket: "sudoku-wizard-f341c.firebasestorage.app",
  messagingSenderId: "944124169907",
  appId: "1:944124169907:web:c5045a8172e16fb3122ac6",
  measurementId: "G-ZEVX38J8W3",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(app);
    })
    .catch(() => {});
}
