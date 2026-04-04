import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import firebaseConfig, { FIRESTORE_TEMPLATES_COLLECTION } from "./firebaseConfig.mjs";
import slugify from "../utils/slugify.js";
import uid from "../utils/uid.js";

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function sanitizeWords(words) {
  if (!Array.isArray(words)) return [];

  const cleaned = words
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: item.id ?? index + 1,
      ru: String(item.ru ?? "").trim(),
      es: String(item.es ?? "").trim()
    }))
    .filter((item) => item.ru && item.es);

  const seen = new Set();
  const unique = [];

  for (const word of cleaned) {
    const key = `${word.ru}|||${word.es}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }

  return unique;
}

function normalizeTemplate(docSnapshot) {
  const data = docSnapshot.data() ?? {};
  const name = String(data.name ?? "Template").trim() || "Template";
  const templateId = String(data.templateId ?? docSnapshot.id ?? (slugify(name) || name));
  return {
    templateId,
    sourceId: docSnapshot.id,
    name,
    words: sanitizeWords(data.words)
  };
}

export async function fetchFirebaseTemplates() {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, FIRESTORE_TEMPLATES_COLLECTION));
  return snapshot.docs.map(normalizeTemplate);
}

export async function createFirebaseTemplate(template) {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const name = String(template?.name ?? "").trim();
  if (!name) {
    throw new Error('Template must include a non-empty "name".');
  }

  const words = sanitizeWords(template?.words);
  if (!words.length) {
    throw new Error('Template must include at least one valid word with both "ru" and "es".');
  }

  const templateIdBase = slugify(name) || "template";
  const templateId = `${templateIdBase}-${uid().slice(0, 8)}`;
  const templateDoc = {
    templateId,
    name,
    words,
    source: "user-upload",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, FIRESTORE_TEMPLATES_COLLECTION, templateId), templateDoc);

  return {
    templateId,
    sourceId: templateId,
    name,
    words
  };
}
