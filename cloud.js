// Firebase 연결부 (ES module) — config.js에 값이 있을 때만 app.js가 불러옴
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect,
  GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, writeBatch, addDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

let app, auth, db, user = null;

export function init(cfg) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  // 오프라인에서도 보이고, 연결되면 알아서 동기화
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export function onUser(cb) {
  return onAuthStateChanged(auth, (u) => { user = u; cb(u && { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL }); });
}

export async function login() {
  const p = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, p);
  } catch (e) {
    if (e && e.code === 'auth/popup-blocked') return signInWithRedirect(auth, p);
    if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
    throw e;
  }
}

export function logout() { return signOut(auth); }

// 구글 캘린더(읽기 전용) 연동용 토큰 — 선택 기능
export async function calendarToken() {
  const p = new GoogleAuthProvider();
  p.addScope('https://www.googleapis.com/auth/calendar.readonly');
  const r = await signInWithPopup(auth, p);
  const cred = GoogleAuthProvider.credentialFromResult(r);
  return cred && cred.accessToken;
}

const colRef = (name) => collection(db, 'users', user.uid, name);

export function watch(name, range, onData, onError) {
  const base = colRef(name);
  const q = range ? query(base, where('date', '>=', range.from), where('date', '<=', range.to)) : base;
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError);
}

// D-day로 표시한 할 일만 (날짜 범위와 상관없이)
export function watchDday(onData, onError) {
  return onSnapshot(query(colRef('todos'), where('dday', '==', true)), (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError);
}
// 한 번 전체 읽기 (검색용)
export async function getAll(name) {
  const snap = await getDocs(colRef(name));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export function save(name, obj) {
  const { id, ...rest } = obj;
  return setDoc(doc(db, 'users', user.uid, name, id), JSON.parse(JSON.stringify(rest)));
}

export function remove(name, id) {
  return deleteDoc(doc(db, 'users', user.uid, name, id));
}

// 컬렉션 전체 삭제 (지운 문서 목록을 돌려줘서 되돌리기에 쓴다)
export async function clearAll(name) {
  const snap = await getDocs(colRef(name));
  const out = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  return out;
}

/* ================= 상담 신청 (선생님 쪽) ================= */

export async function consultList() {
  const snap = await getDocs(query(collection(db, 'consults'), where('owner', '==', user.uid)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.created || 0) - (a.created || 0));
}
export async function consultCreate(data) {
  const r = await addDoc(collection(db, 'consults'), { ...data, owner: user.uid, created: Date.now() });
  return r.id;
}
export function consultUpdate(id, data) { return updateDoc(doc(db, 'consults', id), data); }
export async function consultDelete(id) {
  for (const sub of ['books', 'taken', 'people', 'active']) {
    const snap = await getDocs(collection(db, 'consults', id, sub));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
    }
  }
  await deleteDoc(doc(db, 'consults', id));
}
export function consultWatchBooks(id, cb, err) {
  return onSnapshot(collection(db, 'consults', id, 'books'), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), err);
}
export async function consultRemoveBooking(cid, sid) {
  const b = writeBatch(db);
  b.delete(doc(db, 'consults', cid, 'books', sid)); b.delete(doc(db, 'consults', cid, 'taken', sid));
  await b.commit();
}

// 선생님이 학생 대신 신청: 학생 페이지와 같은 문서를 써요 (taken · active · people · books)
export async function consultBookFor(cid, sid, v, noDup) {
  const key = `${v.info}_${String(v.name).trim().replace(/[\/.]/g, ' ')}`;
  const pr = doc(db, 'consults', cid, 'people', key), ar = doc(db, 'consults', cid, 'active', key);
  const ps = await getDoc(pr);
  if (ps.exists() && ps.data().pin !== v.pin) { const e = new Error('pin'); e.code = 'pin-mismatch'; throw e; }
  if (noDup) { const as = await getDoc(ar); if (as.exists()) { const e = new Error('dup'); e.code = 'dup'; throw e; } }
  const b = writeBatch(db);
  b.set(doc(db, 'consults', cid, 'taken', sid), { t: 1 });
  b.set(ar, { sid });
  b.set(pr, { pin: v.pin });
  b.set(doc(db, 'consults', cid, 'books', sid), { name: v.name, info: v.info, pin: v.pin, at: Date.now(), cancelled: false });
  await b.commit();
}
