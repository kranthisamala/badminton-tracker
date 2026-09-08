import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from './firebase.config.json';

// Firebase project config lives in firebase.config.json (Firebase Console →
// Project Settings → General → "Your apps" → the web app you registered).
// These values are not secret — Firestore/Auth access is controlled by the
// security rules published in the console, not by hiding this config. Kept
// as JSON (not inline here) so the one-off scripts/provision-member-accounts.js
// and scripts/push-data-to-firestore.js Node scripts could read the same
// file too if ever needed without a TypeScript loader.
export const firebaseConfig = firebaseConfigJson;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
