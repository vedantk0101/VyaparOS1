import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

// REGISTER USER
export async function registerUser(
  email,
  password,
  fullName,
  businessName
) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await updateProfile(credential.user, {
    displayName: fullName
  });

  await setDoc(doc(db, "users", credential.user.uid), {
    fullName: fullName,
    businessName: businessName,
    email: email,
    createdAt: serverTimestamp()
  });

  return credential.user;
}

// LOGIN USER
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return credential.user;
}

// GET USER BUSINESS PROFILE
export async function getUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (userSnapshot.exists()) {
    return userSnapshot.data();
  }

  return {
    fullName: user.displayName || "",
    businessName: "My Business"
  };
}

// LOGOUT
export async function logoutUser() {
  return await signOut(auth);
}

// RESET PASSWORD
export async function resetPassword(email) {
  return await sendPasswordResetEmail(auth, email);
}

// AUTHENTICATION STATE
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}