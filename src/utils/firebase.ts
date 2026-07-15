import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwT35TNMhpaAppOrPAP2JkMYVc1_-x4sE",
  authDomain: "claudeclone-2ef24.firebaseapp.com",
  projectId: "claudeclone-2ef24",
  storageBucket: "claudeclone-2ef24.firebasestorage.app",
  messagingSenderId: "451395906297",
  appId: "1:451395906297:web:1b8d9d746bae72624e9028",
  measurementId: "G-LYLBJDT8ZE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
