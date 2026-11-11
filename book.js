// 학생용 상담 신청 페이지 — 로그인 없이 링크(?c=...)로 접속
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const el = (tag, props, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); });
  return n;
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const cid = new URLSearchParams(location.search).get('c');
const root = $('#bk');
const LK = 'hagisiro:book:' + cid;
const loadMine = () => { try { return JSON.parse(localStorage.getItem(LK) || '{}'); } catch (e) { return {}; } };
const recOf = (m, sid) => { const r = m[sid]; return !r ? null : typeof r === 'string' ? { p: r, n: m._n, i: m._i } : r; }; // 예전 기록(비밀번호만)도 읽어요
const saveMine = (o) => { try { localStorage.setItem(LK, JSON.stringify(o)); } catch (e) { /* noop */ } };

function modal(...kids) {
  const m = $('#bm'); m.hidden = false;
  const close = () => { m.hidden = true; m.replaceChildren(); };
  m.replaceChildren(el('div', { class: 'back', onclick: close }), el('div', { class: 'dlg' }, kids));
  return close;
}
const msg = (t) => { root.replaceChildren(el('p', { class: 'mut' }, t)); };

if (!cid || !(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey)) { msg('올바르지 않은 링크예요.'); throw new Error('no cid'); }

const db = getFirestore(initializeApp(window.FIREBASE_CONFIG));
const sidParts = (sid) => { const [d, t] = sid.split('_'); return { y: +d.slice(0, 4), m: +d.slice(4, 6), d: +d.slice(6, 8), hh: t.slice(0, 2), mm: t.slice(2, 4) }; };
const slotTime = (sid) => { const p = sidParts(sid); return new Date(p.y, p.m - 1, p.d, +p.hh, +p.mm).getTime(); };
const dayKey = (sid) => sid.split('_')[0];

let C = null, taken = new Set(), moving = null;
let verified = ''; // 학번·이름·비밀번호를 확인하고 '상담 시간 선택'을 누른 값
const curKey = () => `${f.sid.value}|${f.name.value.trim()}|${f.pin.value}`;
const idKeyOf = (i, n) => `${i}_${String(n).trim().replace(/[\/.]/g, ' ')}`;
const idKey = () => idKeyOf(f.sid.value, f.name.value); // 학번+이름 (이 상담표 안에서만 쓰는 이름표)
const pref = () => doc(db, 'consults', cid, 'people', idKey()); // 비밀번호 (읽을 수 없고, 같은 비밀번호로 쓸 때만 허락돼요)
const arefOf = (i, n) => doc(db, 'consults', cid, 'active', idKeyOf(i, n));
const aref = () => arefOf(f.sid.value, f.name.value); // 지금 신청해 둔 시간 (중복 신청 불가일 때 확인)

const digits = (n) => (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, n); if (v !== e.target.value) e.target.value = v; };
const f = { sid: el('input', { maxlength: 5, inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', oninput: digits(5) }),
  name: el('input', { maxlength: 20, autocomplete: 'name' }),
  pin: el('input', { maxlength: 4, inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', class: 'secret', oninput: digits(4) }) };
const pickBtn = el('button', { class: 'pri pickbtn', type: 'button', disabled: true, onclick: () => pickTimes() }, '상담 시간 선택');
let busyPick = false;
const syncPick = () => { pickBtn.disabled = !ready() || busyPick; };
let drawSlots = () => {};
['sid', 'name', 'pin'].forEach((k) => f[k].addEventListener('input', () => { drawSlots(); })); // 입력 중에는 입력칸을 다시 만들지 않아요(한글 조합이 끊김)
const ready = () => /^\d{5}$/.test(f.sid.value) && f.name.value.trim() && /^\d{4}$/.test(f.pin.value);

(async () => {
  try {
    const s = await getDoc(doc(db, 'consults', cid));
    if (!s.exists()) { msg('상담표를 찾을 수 없어요.'); return; }
    C = s.data();
  } catch (e) { msg('불러오지 못했어요.'); return; }
  const mine0 = loadMine();
  if (mine0._n) { f.name.value = mine0._n; f.sid.value = /^\d{5}$/.test(mine0._i || '') ? mine0._i : ''; }
  onSnapshot(collection(db, 'consults', cid, 'taken'), (snap) => { taken = new Set(snap.docs.map((d) => d.id)); draw(); }, () => msg('불러오지 못했어요.'));
  draw();
})();

const closed = () => C && C.closeAt && Date.now() >= C.closeAt;

function draw() {
  if (!C) return;
  document.title = C.title || '상담 신청';
  const mine = loadMine();
  const now = Date.now();
  const days = {};
  C.slots.slice().sort().forEach((sid) => { if (slotTime(sid) > now || taken.has(sid)) (days[dayKey(sid)] = days[dayKey(sid)] || []).push(sid); });
  const slotNodes = () => [
    !ready() || verified !== curKey() ? null : moving ? el('div', { class: 'banner' }, '옮길 시간을 골라 주세요.', el('button', { onclick: () => { moving = null; draw(); } }, '그만두기')) : null,
    !ready() || verified !== curKey() ? null : Object.keys(days).length ? Object.keys(days).map((k) => {
      const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
      return [el('div', { class: 'day' }, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`),
        el('div', { class: 'chips' }, days[k].map((sid) => {
          const p = sidParts(sid), isT = taken.has(sid), rec = isT ? recOf(mine, sid) : null;
          // 학번·이름·비밀번호가 신청할 때와 모두 같을 때만 내 신청으로 보여주고 눌러서 바꿀 수 있어요
          const isMine = !!rec && rec.i === f.sid.value && rec.n === f.name.value.trim() && rec.p === f.pin.value;
          return el('button', { class: 'chip' + (isT ? ' taken' : '') + (isMine ? ' mine' : ''), type: 'button', title: isT ? (isMine ? '내 신청' : '신청됨') : '',
            disabled: isT && !isMine, onclick: () => (isMine ? onTaken(sid, rec) : isT ? null : onFree(sid)) }, `${p.hh}:${p.mm}`);
        }))];
    }) : el('p', { class: 'mut' }, '신청할 수 있는 시간이 없어요.')].flat(Infinity).filter(Boolean);
  const slotHost = el('div', { class: 'slots', style: 'display:contents' });
  drawSlots = () => { syncPick(); slotHost.replaceChildren(...slotNodes()); };
  const fs = [f.sid, f.name, f.pin];
  const keep = fs.map((x) => document.activeElement === x);
  const caret = keep.indexOf(true) >= 0 ? fs[keep.indexOf(true)].selectionStart : null;
  root.replaceChildren(...[
    el('h1', {}, C.title || '상담 신청'),
    C.note ? el('p', { class: 'note' }, C.note) : null,
    C.closeAt ? el('p', { class: 'mut small' }, closed() ? '신청이 마감됐어요.' : `신청 마감 ${new Date(C.closeAt).getMonth() + 1}.${new Date(C.closeAt).getDate()}. ${String(new Date(C.closeAt).getHours()).padStart(2, '0')}:${String(new Date(C.closeAt).getMinutes()).padStart(2, '0')}`) : null,
    el('div', { class: 'form' },
      el('label', {}, '학번(숫자 5자리)', f.sid), el('label', {}, '이름', f.name), el('label', {}, '비밀번호(숫자 4자리)', f.pin)),
    pickBtn,
    slotHost].flat(Infinity).filter(Boolean));
  syncPick(); slotHost.replaceChildren(...slotNodes());
  const fi = keep.indexOf(true);
  if (fi >= 0) { fs[fi].focus(); try { fs[fi].setSelectionRange(caret, caret); } catch (e) { /* noop */ } }
}

const readForm = () => (ready() ? { name: f.name.value.trim(), info: f.sid.value, pin: f.pin.value } : null);
const bref = (sid) => doc(db, 'consults', cid, 'books', sid);
const tref = (sid) => doc(db, 'consults', cid, 'taken', sid);
const label = (sid) => { const p = sidParts(sid); return `${p.m}월 ${p.d}일 ${p.hh}:${p.mm}`; };

const alertBox = (t) => { const close = modal(el('div', {}, t), el('div', { class: 'row' }, el('button', { class: 'pri', onclick: () => close() }, '확인'))); };

/* 학번·이름·비밀번호 확인: 같은 학번·이름은 이 상담표에서 처음 쓴 비밀번호로만 들어올 수 있어요 */
async function pickTimes() {
  if (!ready() || busyPick) return;
  busyPick = true; syncPick();
  try {
    if (!closed()) await setDoc(pref(), { pin: f.pin.value });
    verified = curKey(); draw();
  } catch (e) {
    if (e && e.code === 'permission-denied') alertBox('비밀번호가 일치하지 않습니다.'); else console.error(e);
  } finally { busyPick = false; syncPick(); }
}

function onFree(sid) {
  if (closed()) return;
  const v = readForm(); if (!v) return;
  const move = moving;
  if (C.noDup && !move) { // 중복 신청 불가: 이미 신청한 시간이 남아 있으면 막아요
    getDoc(aref()).then((d) => { if (d.exists() && taken.has(d.data().sid)) alertBox('이미 신청한 상담이 있습니다.'); else ask(); }).catch(() => ask());
    return;
  }
  ask();
  function ask() {
  const close = modal(el('b', {}, move ? '이 시간으로 바꿀까요?' : '이 시간으로 신청할까요?'), el('div', {}, label(sid)),
    el('div', { class: 'row' }, el('button', { class: 'ghost', onclick: () => close() }, '취소'),
      el('button', { class: 'pri', onclick: async (e) => { e.target.disabled = true; await book(sid, v, move); close(); } }, move ? '바꾸기' : '신청')));
  }
}
async function book(sid, v, move) {
  const b = writeBatch(db);
  if (move) { b.set(bref(move.sid), { cancelled: true, pin: move.pin }, { merge: true }); b.delete(tref(move.sid)); }
  b.set(tref(sid), { t: 1 });
  b.set(arefOf(v.info, v.name), { sid });
  b.set(bref(sid), { name: v.name, info: v.info, pin: v.pin, at: Date.now(), cancelled: false });
  try {
    await b.commit();
    const mine = loadMine(); if (move) delete mine[move.sid];
    mine[sid] = { p: v.pin, n: v.name, i: v.info }; mine._n = v.name; mine._i = v.info; saveMine(mine);
    moving = null; draw();
  } catch (e) {
    console.error(e);
    draw(); // 실패하면 아무 알림 없이 현재 상태(이미 신청된 칸 등)로 다시 그려요
  }
}

function onTaken(sid, rec) {
  const close = modal(el('b', {}, '상담 신청 변경'), el('div', {}, label(sid)),
    el('div', { class: 'row' },
      el('button', { class: 'ghost danger', onclick: async () => {
        try {
          const b = writeBatch(db); b.set(bref(sid), { cancelled: true, pin: rec.p }, { merge: true }); b.delete(tref(sid)); b.delete(arefOf(rec.i, rec.n)); await b.commit();
          const m = loadMine(); delete m[sid]; saveMine(m); close();
        } catch (e) { console.error(e); }
      } }, '취소'),
      el('button', { class: 'pri', onclick: () => { moving = { sid, pin: rec.p }; close(); draw(); } }, '변경')));
}
