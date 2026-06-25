// api/_lib/firebaseAdmin.js
// Firebase Admin singleton for serverless functions. Credentials come from a
// service-account JSON stored in the FIREBASE_SERVICE_ACCOUNT env var (Vercel).
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("❌ Missing FIREBASE_SERVICE_ACCOUNT in environment");
  }
  // Support both raw JSON and base64-encoded JSON.
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

const app =
  getApps()[0] ??
  initializeApp({ credential: cert(loadServiceAccount()) });

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

/** Verify a Firebase ID token from an `Authorization: Bearer <token>` header. */
export async function verifyRequestUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return null;
  try {
    return await adminAuth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}
