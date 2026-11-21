import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

const firebaseApp: FirebaseApp = getApps().find((app) => app.name === '[DEFAULT]')
  ?? initializeApp(environment.firebase);

export const firebaseServices: {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
} = {
  app: firebaseApp,
  auth: getAuth(firebaseApp),
  firestore: getFirestore(firebaseApp),
  storage: getStorage(firebaseApp),
};

export const firebaseAuthPersistence = setPersistence(
  firebaseServices.auth,
  browserLocalPersistence,
);
