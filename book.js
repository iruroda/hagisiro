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
const saveMine = (o) => { try { localStorage.setItem(LK, JSON.stringify(o)); } catch (e) { /* noop */ } };

let toastT;
function toast(msg) { const t = $('#bt'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function modal(...kids) {
  const m = $('#bm'); m.hidden = false;
  const close = () => { m.hidden = true; m.replaceChildren(); };
  m.replaceChildren(el('div', { class: 'back', onclick: close }), el('div', { class: 'dlg' }, kids));
  return close;
}
const msg = (t) => { root.replaceChildren(el('p', { class: 'mut' }, t)); };

if (!cid || !(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey)) { msg('올바르지 않은 링크예요'); throw new Error('no cid'); }

const db = getFirestore(initializeApp(window.FIREBASE_CONFIG));
const sidParts = (sid) => { const [d, t] = sid.split('_'); return { y: +d.slice(0, 4), m: +d.slice(4, 6), d: +d.slice(6, 8), hh: t.slice(0, 2), mm: t.slice(2, 4) }; };
const slotTime = (sid) => { const p = sidParts(sid); return new Date(p.y, p.m - 1, p.d, +p.hh, +p.mm).getTime(); };
const dayKey = (sid) => sid.split('_')[0];

let C = null, taken = new Set(), moving = null;
const f = { name: el('input', { placeholder: '이름', maxlength: 20, autocomplete: 'name' }),
  info: el('input', { placeholder: '예) 2학년 3반 12번 (선택)', maxlength: 30 }),
  pin: el('input', { placeholder: '숫자 4자리', maxlength: 4, inputmode: 'numeric', autocomplete: 'off', type: 'password' }) };

(async () => {
  try {
    const s = await getDoc(doc(db, 'consults', cid));
    if (!s.exists()) { msg('상담표를 찾을 수 없어요'); return; }
    C = s.data();
  } catch (e) { msg('불러오지 못했어요'); return; }
  const mine0 = loadMine();
  if (mine0._n) { f.name.value = mine0._n; f.info.value = mine0._i || ''; }
  onSnapshot(collection(db, 'consults', cid, 'taken'), (snap) => { taken = new Set(snap.docs.map((d) => d.id)); draw(); }, () => msg('불러오지 못했어요'));
  draw();
})();

const closed = () => C && C.closeAt && Date.now() >= C.closeAt;

function draw() {
  if (!C) return;
  const mine = loadMine();
  const now = Date.now();
  const days = {};
  C.slots.slice().sort().forEach((sid) => { if (slotTime(sid) > now || taken.has(sid)) (days[dayKey(sid)] = days[dayKey(sid)] || []).push(sid); });
  const keep = [document.activeElement === f.name, document.activeElement === f.info, document.activeElement === f.pin];
  root.replaceChildren(...[
    el('h1', {}, C.title || '상담 신청'),
    C.note ? el('p', { class: 'note' }, C.note) : null,
    C.closeAt ? el('p', { class: 'mut small' }, closed() ? '신청이 마감됐어요' : `신청 마감 ${new Date(C.closeAt).getMonth() + 1}/${new Date(C.closeAt).getDate()} ${String(new Date(C.closeAt).getHours()).padStart(2, '0')}:${String(new Date(C.closeAt).getMinutes()).padStart(2, '0')}`) : null,
    el('div', { class: 'form' },
      el('label', {}, '이름', f.name), el('label', {}, '학년·반·번호', f.info), el('label', {}, '비밀번호', f.pin),
      el('div', { class: 'mut small' }, '비밀번호는 신청을 취소하거나 바꿀 때 써요. 시간을 고르면 신청돼요.')),
    moving ? el('div', { class: 'banner' }, '옮길 시간을 골라 주세요', el('button', { onclick: () => { moving = null; draw(); } }, '그만두기')) : null,
    Object.keys(days).length ? Object.keys(days).map((k) => {
      const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
      return [el('div', { class: 'day' }, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`),
        el('div', { class: 'chips' }, days[k].map((sid) => {
          const p = sidParts(sid), isT = taken.has(sid), isMine = isT && mine[sid];
          return el('button', { class: 'chip' + (isT ? ' taken' : '') + (isMine ? ' mine' : ''), type: 'button', title: isT ? (isMine ? '내 신청' : '신청됨') : '',
            onclick: () => (isT ? onTaken(sid) : onFree(sid)) }, `${p.hh}:${p.mm}`);
        }))];
    }) : el('p', { class: 'mut' }, '신청할 수 있는 시간이 없어요')].flat(Infinity).filter(Boolean));
  [f.name, f.info, f.pin][keep.indexOf(true)]?.focus();
}

function readForm() {
  const name = f.name.value.trim(), info = f.info.value.trim(), pin = f.pin.value.trim();
  if (!name) { toast('이름을 입력해 주세요'); f.name.focus(); return null; }
  if (!/^\d{4}$/.test(pin)) { toast('비밀번호는 숫자 4자리예요'); f.pin.focus(); return null; }
  return { name, info, pin };
}
const bref = (sid) => doc(db, 'consults', cid, 'books', sid);
const tref = (sid) => doc(db, 'consults', cid, 'taken', sid);
const label = (sid) => { const p = sidParts(sid); return `${p.m}월 ${p.d}일 ${p.hh}:${p.mm}`; };

function onFree(sid) {
  if (closed()) { toast('신청이 마감됐어요'); return; }
  const v = readForm(); if (!v) return;
  const move = moving;
  const close = modal(el('b', {}, move ? '이 시간으로 바꿀까요?' : '이 시간으로 신청할까요?'), el('div', {}, `${label(sid)} · ${v.name}`),
    el('div', { class: 'row' }, el('button', { class: 'ghost', onclick: () => close() }, '취소'),
      el('button', { class: 'pri', onclick: async (e) => { e.target.disabled = true; await book(sid, v, move); close(); } }, move ? '바꾸기' : '신청')));
}
async function book(sid, v, move) {
  const b = writeBatch(db);
  if (move) { b.set(bref(move.sid), { cancelled: true, pin: move.pin }, { merge: true }); b.delete(tref(move.sid)); }
  b.set(tref(sid), { t: 1 });
  b.set(bref(sid), { name: v.name, info: v.info, pin: v.pin, at: Date.now(), cancelled: false });
  try {
    await b.commit();
    const mine = loadMine(); if (move) delete mine[move.sid];
    mine[sid] = v.pin; mine._n = v.name; mine._i = v.info; saveMine(mine);
    moving = null; toast(move ? '시간을 바꿨어요' : '신청했어요'); draw();
  } catch (e) {
    console.error(e);
    toast(e && e.code === 'permission-denied' ? (move ? '비밀번호가 다르거나 이미 신청된 시간이에요' : '이미 신청됐거나 마감된 시간이에요') : '신청하지 못했어요');
  }
}

function onTaken(sid) {
  const mine = loadMine();
  const pin = el('input', { placeholder: '비밀번호 4자리', maxlength: 4, inputmode: 'numeric', type: 'password', value: mine[sid] || '' });
  const need = () => { if (!/^\d{4}$/.test(pin.value)) { toast('비밀번호는 숫자 4자리예요'); return false; } return true; };
  const close = modal(el('b', {}, mine[sid] ? '내 신청' : '신청된 시간'), el('div', { class: 'mut small' }, label(sid) + ' · 신청한 사람만 바꿀 수 있어요'), pin,
    el('div', { class: 'row' },
      el('button', { class: 'ghost danger', onclick: async () => {
        if (!need()) return;
        try {
          const b = writeBatch(db); b.set(bref(sid), { cancelled: true, pin: pin.value }, { merge: true }); b.delete(tref(sid)); await b.commit();
          const m = loadMine(); delete m[sid]; saveMine(m); close(); toast('신청을 취소했어요');
        } catch (e) { toast(e && e.code === 'permission-denied' ? '비밀번호가 달라요' : '취소하지 못했어요'); }
      } }, '신청 취소'),
      el('button', { class: 'pri', onclick: async () => {
        if (!need()) return;
        // 비밀번호 확인: 아무것도 바꾸지 않는 쓰기로 검증할 수 없어서, 바꾸는 순간에 규칙이 확인해요
        moving = { sid, pin: pin.value }; close(); toast('옮길 시간을 골라 주세요'); draw();
      } }, '시간 바꾸기')));
}
