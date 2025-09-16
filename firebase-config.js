import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// Proveedor de autenticación con Google
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Configurar dominios autorizados para Replit
auth.settings.appVerificationDisabledForTesting = false;

// Función para manejar dominios no autorizados
export const handleAuthDomain = (error) => {
    if (error.code === 'auth/unauthorized-domain') {
        console.warn('Dominio no autorizado. Configurar en Firebase Console:', window.location.hostname);
        return {
            isError: true,
            message: 'Para usar autenticación, el administrador debe agregar este dominio en Firebase Console.'
        };
    }
    return { isError: false };
};

// Funciones de autenticación
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export { onAuthStateChanged };