import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZuuO8Gkw0eXcmKCvAIA01cyX8acxtO2w",
  authDomain: "vyaparos-806bb.firebaseapp.com",
  projectId: "vyaparos-806bb",
  storageBucket: "vyaparos-806bb.firebasestorage.app",
  messagingSenderId: "447743788298",
  appId: "1:447743788298:web:bbf68f0e8931e40f7966f3",
  measurementId: "G-RBKM67S01J"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);