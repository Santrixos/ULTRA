import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAneyRjnZzvhIFLzykATmW4ShN3IVuf5E0",
  authDomain: "ligamx-daf3d.firebaseapp.com",
  projectId: "ligamx-daf3d",
  storageBucket: "ligamx-daf3d.appspot.com", 
  messagingSenderId: "437421248316",
  appId: "1:437421248316:web:38e9f436a57389d2c49839",
  measurementId: "G-LKVTFN2463"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);