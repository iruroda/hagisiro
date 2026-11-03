/* HAGISIRO — 캘린더 · 할 일 · 출결 */
(function () {
  'use strict';
  const P = window.Parser;

  /* ================= 유틸 ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const SHORT = { 결석: '결', 지각: '지', 조퇴: '조', 결과: '과' };
  const { CATS, TYPES, KINDS, END } = P;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const byOrd = (a, b) => (a.ord || 0) - (b.ord || 0) || (a.created || 0) - (b.created || 0);
  const isMobile = () => !!(window.matchMedia && window.matchMedia('(max-width:700px)').matches);
  const md = (ds) => { const d = parseYmd(ds); return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
  };

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }

  /* 아이콘은 전부 벡터(SVG): 24칸 격자 · 선 두께 2.7 · 끝과 꺾임은 둥글게. 글자(•, /, ↻ …)로 기호를 만들지 않는다 */
  const ICON = {
    left: '<path d="M14.5 6l-6 6 6 6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    check: '<path d="M5 12.8l4.6 4.6L19 7.4"/>',
    more: '<circle cx="5.5" cy="12" r="1.9" class="f"/><circle cx="12" cy="12" r="1.9" class="f"/><circle cx="18.5" cy="12" r="1.9" class="f"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    download: '<path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5.5 19.5h13"/>',
    users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17.3" cy="9.3" r="2.4"/><path d="M16.8 14.4c2.3.1 3.8 1.7 4.2 4.3"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    phone: '<path d="M7.2 4.5h2.9l1.4 3.9-1.9 1.3a10.5 10.5 0 004.7 4.7l1.3-1.9 3.9 1.4v2.9a2 2 0 01-2.1 2A14.5 14.5 0 015.2 6.6a2 2 0 012-2.1z"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="3.2"/><path d="M4 10.5h16M10 10.5V19"/>',
    upload: '<path d="M12 14.5v-10M7.5 8.5l4.5-4.5 4.5 4.5M5.5 19.5h13"/>',
    edit: '<path d="M5.5 18.5l.9-3.6L15 6.3a2 2 0 012.8 2.8l-8.6 8.6-3.7.8z"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.9 11.5a1 1 0 001 .9h6.2a1 1 0 001-.9L17 7"/>',
    clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3.2 2"/>',
    enter: '<path d="M19.5 5.5v7a3 3 0 01-3 3H5.5"/><path d="M10 10.5l-4.5 5 4.5 5"/>',
    palette: '<path d="M12 3.8a8.2 8.2 0 100 16.4c1.5 0 2.2-1 2.2-2 0-1.5-1.1-1.9-1.1-3 0-1 .8-1.8 1.9-1.8H17a3.3 3.3 0 003.3-3.3c0-3.8-3.7-6.3-8.3-6.3z"/><circle cx="7.7" cy="11.9" r="1.75" class="f"/><circle cx="10.5" cy="7.7" r="1.75" class="f"/><circle cx="14.9" cy="8.3" r="1.75" class="f"/>',
    repeat: '<path d="M16.5 3.5l3.2 3.2-3.2 3.2"/><path d="M4.3 12v-1.3a4 4 0 014-4h11.4"/><path d="M7.5 20.5l-3.2-3.2 3.2-3.2"/><path d="M19.7 12v1.3a4 4 0 01-4 4H4.3"/>',
    dot: '<circle cx="12" cy="12" r="4.2" class="f"/>',
    slash: '<path d="M8 19.5l8-15"/>',
    tilde: '<path d="M3.5 12.5c2.2-3.4 4.3-3.4 8.5 0s6.3 3.4 8.5 0"/>',
  };
  function icon(name) {
    const s = el('span', { class: 'ic' });
    s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
    return s;
  }
  const LOGO = '<svg viewBox="0 0 64 64" width="56" height="56"><rect width="64" height="64" rx="14" fill="#2563eb"/><rect x="14" y="16" width="36" height="32" rx="6" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M14 25h36" stroke="#fff" stroke-width="3.5"/><path d="M24 36l5.5 5.5L41 31" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* 한글 입력(IME) 중 엔터 처리: 마지막 글자가 확정된 뒤 한 번에 동작하도록 */
  function onEnter(inp, fn) {
    let comp = false, pend = false;
    inp.addEventListener('compositionstart', () => { comp = true; });
    inp.addEventListener('compositionend', () => {
      comp = false;
      if (pend) { pend = false; setTimeout(fn, 0); }
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (e.isComposing || comp) { pend = true; return; }
      fn();
    });
  }

  /* ================= 상태 / 데이터 ================= */
  const now = new Date();
  const LSK = 'hagisiro:v1';
  const COLS = ['todos', 'classes', 'att', 'settings', 'days', 'repeats', 'docs'];
  const S = {
    view: ls.get('hagisiro:view') === 'att' ? 'att' : 'cal',
    sub: ['month', 'week'].includes(ls.get('hagisiro:sub')) ? ls.get('hagisiro:sub') : 'day',
    y: now.getFullYear(), m: now.getMonth(), sel: ymd(now),
    todos: [], classes: [], att: [], settings: [], days: [], repeats: [], docs: [], gcal: {},
    extra: {},
    weekAll: ls.get('hagisiro:weekall') === '1',
    user: null, cloud: null, cloudMod: null, cloudAvail: false,
    guest: ls.get('hagisiro:guest') === '1', ready: false, clsLoaded: true,
    clsId: ls.get('hagisiro:cls'),
    editing: null, unsubs: [], unsubStatic: [],
    anchor: ymd(now), ghol: {},
  };

  /* 화면 설정 (이 기기에만 저장) */
  const PFK = 'hagisiro:pf';
  const IS_WIDGET = /[?&]widget/.test(location.search);
  const PF = Object.assign({ cal: IS_WIDGET ? 'week' : 'month', weeks: IS_WIDGET ? 3 : 4, past: 1, lunar: false, terms: false, hol: true, ghol: false, theme: 'auto', opacity: 90, sortDone: false },
    (() => { try { return JSON.parse(ls.get(PFK) || '{}') || {}; } catch (e) { return {}; } })());
  function normPf() {
    PF.weeks = Math.min(6, Math.max(1, Math.round(+PF.weeks) || 4));
    PF.past = Math.min(5, PF.weeks - 1, Math.max(0, Math.round(+PF.past) || 0));
    PF.opacity = Math.min(100, Math.max(30, Math.round(+PF.opacity) || 90));
    if (!['month', 'week'].includes(PF.cal)) PF.cal = 'month';
    if (!['auto', 'light', 'dark'].includes(PF.theme)) PF.theme = 'auto';
  }
  function applyPf() {
    normPf();
    const h = document.documentElement;
    if (PF.theme === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', PF.theme);
    h.style.setProperty('--wa', PF.opacity + '%');
  }
  function savePf() { applyPf(); ls.set(PFK, JSON.stringify(PF)); }
  applyPf();
  const weekMode = () => S.view === 'cal' && PF.cal === 'week';

  /* 예전 데이터 호환: 사유구분 '인정' → '출석인정', 시간 범위가 없으면 만들어 줌 */
  function normRec(a) {
    if (a.cat === '인정') a = { ...a, cat: '출석인정' };
    if (a.from == null) {
      const r = P.defaultRange(a.type, a.period == null ? null : a.period, a.periodTo == null ? null : a.periodTo, 7);
      a = { ...a, from: r[0], to: r[1] };
    }
    return a;
  }

  function cloudErr(e) {
    console.error(e);
    const code = (e && e.code) || '';
    toast(code === 'permission-denied' ? '권한 오류: firestore.rules 를 게시했는지 확인해 주세요' : '저장/불러오기 오류: ' + (code || (e && e.message)));
  }

  const Data = {
    loadLocal() {
      let d = {};
      try { d = JSON.parse(ls.get(LSK) || '{}'); } catch (e) { d = {}; }
      COLS.forEach((c) => { S[c] = d[c] || []; });
      S.att = S.att.map(normRec);
    },
    saveLocal() {
      const o = {};
      COLS.forEach((c) => { o[c] = S[c]; });
      ls.set(LSK, JSON.stringify(o));
    },
    put(col, obj) {
      const arr = S[col];
      const i = arr.findIndex((x) => x.id === obj.id);
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      if (S.cloud) S.cloud.save(col, obj).catch(cloudErr); else this.saveLocal();
    },
    del(col, id) {
      S[col] = S[col].filter((x) => x.id !== id);
      if (S.cloud) S.cloud.remove(col, id).catch(cloudErr); else this.saveLocal();
    },
  };

  /* ---------- 교시 설정: 요일별 기본값 + 날짜별 예외 ---------- */
  const DEFAULT_PERIODS = [0, 7, 7, 7, 7, 7, 0]; // 일~토
  const cfgPeriods = () => { const c = S.settings.find((x) => x.id === 'main'); return (c && c.periods) || DEFAULT_PERIODS; };
  const dayDefault = (ds) => cfgPeriods()[parseYmd(ds).getDay()];
  const lastOf = (ds) => { const o = S.days.find((x) => x.id === ds); return o ? o.periods : dayDefault(ds); };
  function setDayPeriods(ds, n) {
    if (n === dayDefault(ds)) { if (S.days.some((x) => x.id === ds)) Data.del('days', ds); }
    else Data.put('days', { id: ds, date: ds, periods: n });
  }

  function wkRange() {
    const a = parseYmd(S.anchor);
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate() - a.getDay() - PF.past * 7);
    const rows = PF.weeks;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + rows * 7 - 1);
    return { start, rows, from: ymd(start), to: ymd(end) };
  }
  function range() {
    if (weekMode()) return wkRange();
    const first = new Date(S.y, S.m, 1);
    const dim = new Date(S.y, S.m + 1, 0).getDate();
    const rows = Math.ceil((first.getDay() + dim) / 7);
    const start = new Date(S.y, S.m, 1 - first.getDay());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + rows * 7 - 1);
    return { start, rows, from: ymd(start), to: ymd(end) };
  }

  function stopWatches() {
    S.unsubs.forEach((f) => f()); S.unsubs = [];
    S.unsubStatic.forEach((f) => f()); S.unsubStatic = [];
  }
  function watchRange() {
    S.unsubs.forEach((f) => f()); S.unsubs = [];
    if (S.cloud) {
      const r = range(); const rg = { from: r.from, to: r.to };
      S.unsubs.push(S.cloud.watch('todos', rg, (d) => { S.todos = d; render(); }, cloudErr));
      S.unsubs.push(S.cloud.watch('att', rg, (d) => { S.att = d.map(normRec); render(); }, cloudErr));
      S.unsubs.push(S.cloud.watch('days', rg, (d) => { S.days = d; render(); }, cloudErr));
    }
    loadGcal(); loadGhol();
  }
  function watchStatic() {
    S.unsubStatic.forEach((f) => f()); S.unsubStatic = [];
    S.clsLoaded = false;
    S.unsubStatic.push(S.cloud.watch('classes', null, (d) => { S.classes = d.sort(byOrd); S.clsLoaded = true; render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watch('settings', null, (d) => { S.settings = d; render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watch('repeats', null, (d) => { S.repeats = d; render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watch('docs', null, (d) => { S.docs = d; if (!$('#modal .docdlg')) render(); }, cloudErr));
  }

  /* ================= 부팅 / 로그인 ================= */
  function enterLocal() {
    stopWatches(); S.cloud = null; S.user = null; S.clsLoaded = true;
    Data.loadLocal(); S.gcal = {}; render();
  }
  function enterCloud(u) {
    S.user = u; S.cloud = S.cloudMod;
    COLS.forEach((c) => { S[c] = []; });
    watchStatic(); watchRange(); maybeMigrate(); render();
  }
  function maybeMigrate() {
    const key = 'hagisiro:migrated:' + S.user.uid;
    if (ls.get(key)) return;
    let d = {};
    try { d = JSON.parse(ls.get(LSK) || '{}'); } catch (e) { d = {}; }
    const n = COLS.reduce((a, c) => a + (d[c] || []).length, 0);
    ls.set(key, '1');
    if (!n) return;
    if (confirm(`이 기기에 저장돼 있던 데이터(${n}건)를 내 계정으로 옮길까요?`)) {
      COLS.forEach((c) => (d[c] || []).forEach((x) => S.cloud.save(c, x).catch(cloudErr)));
      toast('내 계정으로 옮겼어요');
    }
  }
  async function boot() {
    if (/[?&]widget/.test(location.search)) document.body.classList.add('widget');
    Data.loadLocal();
    const cfg = window.FIREBASE_CONFIG;
    if (cfg && cfg.apiKey) {
      try {
        const C = await import('./cloud.js');
        C.init(cfg);
        S.cloudMod = C; S.cloudAvail = true;
        C.onUser((u) => {
          S.ready = true;
          if (u) enterCloud(u);
          else {
            S.user = null; S.cloud = null; stopWatches();
            if (S.guest) enterLocal();
            else { COLS.forEach((c) => { S[c] = []; }); S.gcal = {}; S.clsLoaded = true; render(); }
          }
        });
        return;
      } catch (e) {
        console.error(e);
        toast('Firebase 연결 실패 — 이 기기에만 저장돼요');
      }
    }
    S.ready = true; enterLocal();
  }
  const needLogin = () => S.ready && S.cloudAvail && !S.user && !S.guest;

  /* ================= 렌더 ================= */
  function render() {
    if (S.editing) return; // 편집 중엔 화면을 갈아엎지 않음 (끝나면 다시 그림)
    if (!S.ready) return;
    clearPicked();
    document.body.classList.remove('booting');
    const q = $('#q');
    const keep = q && { v: q.value, f: document.activeElement === q, s: q.selectionStart };
    S.topSum = null;
    renderTop();
    const main = $('#main');
    main.replaceChildren();
    if (needLogin()) main.append(loginView());
    else main.append(S.view === 'att' ? attView() : calView());
    if (S.topSum && S.view === 'att') { // 통계는 '오늘' 버튼 바로 오른쪽 (월별=상단바, 일별·주별=날짜 줄)
      const btn = S.sub === 'month' ? $('#top .nav .ghost') : $('#main .dhead .tdbtn');
      if (btn) btn.after(S.topSum);
    }
    S.topSum = null;
    if (keep) {
      const nq = $('#q');
      if (nq) { nq.value = keep.v; if (keep.f) { nq.focus(); try { nq.setSelectionRange(keep.s, keep.s); } catch (e) { /* noop */ } } preview(); }
    }
  }

  function renderTop() {
    const t = $('#top');
    t.replaceChildren();
    closeMenu();
    if (needLogin()) { t.hidden = true; return; }
    t.hidden = false;
    const ib = (name, fn, label) => el('button', { class: 'ib', onclick: fn, 'aria-label': label, title: label }, icon(name));
    const nav = el('div', { class: 'nav' },
      ib('left', () => go(-1), weekMode() ? '이전 주' : '이전 달'),
      el('span', { class: 'ttl' }, weekMode() ? (() => { const a = parseYmd(S.anchor); return `${a.getFullYear()}년 ${a.getMonth() + 1}월`; })() : `${S.y}년 ${S.m + 1}월`),
      ib('right', () => go(1), weekMode() ? '다음 주' : '다음 달'),
      S.view === 'att' && S.sub !== 'month' ? null : el('button', { class: 'ghost sm', onclick: goToday }, '오늘'));
    const tab = (v, label) => el('button', { class: 'tab' + (S.view === v ? ' on' : ''), onclick: () => setView(v) }, label);
    const tabs = el('div', { class: 'tabs' }, tab('cal', '캘린더'), tab('att', '출결'));
    const right = el('div', { class: 'right' });
    DOCS.forEach(([id, label, ic]) => right.append(el('button', { class: 'ghost sm dbtn' + (docOf(id) ? ' has' : ''), title: label, 'aria-label': label, onclick: () => openDoc(id) }, icon(ic), el('span', { class: 'lb' }, label))));
    if (S.view === 'cal') right.append(el('div', { class: 'seg', role: 'group', 'aria-label': '보기 방식' },
      el('button', { class: PF.cal === 'month' ? 'on' : '', onclick: () => setCalMode('month') }, '월별'),
      el('button', { class: PF.cal === 'week' ? 'on' : '', onclick: () => setCalMode('week') }, '이번 주')));
    if ((gcalWanted() || (PF.ghol && S.cloud)) && !gtoken()) right.append(el('button', { class: 'ghost sm', onclick: () => connectGcal(!gcalWanted()) }, '구글 다시 연결'));
    right.append(el('button', { class: 'ib', id: 'menuBtn', onclick: (e) => { e.stopPropagation(); openMenu(); }, 'aria-label': '메뉴', title: '메뉴' }, icon('more')));
    t.append(nav, tabs, right);
  }

  function setView(v) { S.view = v; ls.set('hagisiro:view', v); if (PF.cal === 'week') watchRange(); render(); }
  function setCalMode(m) {
    if (PF.cal === m) return;
    PF.cal = m; savePf();
    if (m === 'week') S.anchor = S.sel;
    watchRange(); render();
  }
  function setSub(v) { S.sub = v; ls.set('hagisiro:sub', v); render(); }
  /* 날짜를 고르면 달도 같이 맞춤 */
  function setSel(ds) {
    S.sel = ds; S.extra = {};
    const d = parseYmd(ds);
    let ch = false;
    if (d.getFullYear() !== S.y || d.getMonth() !== S.m) { S.y = d.getFullYear(); S.m = d.getMonth(); ch = true; }
    if (PF.cal === 'week') { const r = wkRange(); if (ds < r.from || ds > r.to) { S.anchor = ds; ch = true; } }
    if (ch) watchRange();
  }
  function go(dm) {
    if (weekMode()) {
      const a = parseYmd(S.anchor), sd = parseYmd(S.sel);
      S.anchor = ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * dm));
      const ns = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() + 7 * dm);
      S.sel = ymd(ns); S.y = ns.getFullYear(); S.m = ns.getMonth(); S.extra = {};
      watchRange(); render(); return;
    }
    const d = new Date(S.y, S.m + dm, 1);
    S.y = d.getFullYear(); S.m = d.getMonth();
    const sd = parseYmd(S.sel);
    if (sd.getFullYear() !== S.y || sd.getMonth() !== S.m) S.sel = ymd(new Date(S.y, S.m, 1));
    S.extra = {};
    watchRange(); render();
  }
  function goToday() {
    const n = new Date();
    S.y = n.getFullYear(); S.m = n.getMonth(); S.sel = ymd(n); S.anchor = ymd(n); S.extra = {};
    watchRange(); render();
  }

  /* ---------- 메뉴 ---------- */
  function closeMenu() { const m = $('#menu'); if (m) m.remove(); document.removeEventListener('click', onDocClick); }
  function onDocClick(e) { const m = $('#menu'); if (m && !m.contains(e.target)) closeMenu(); }
  function openMenu() {
    if ($('#menu')) { closeMenu(); return; }
    const item = (label, fn) => el('button', { class: 'mi', onclick: () => { closeMenu(); fn(); } }, label);
    const m = el('div', { class: 'menu', id: 'menu' });
    m.append(el('div', { class: 'mh' }, S.user ? (S.user.email || '로그인됨') : (S.cloudAvail ? '로그인 안 됨 · 이 기기에만 저장' : '이 기기에만 저장 중 (Firebase 미설정)')));
    if (S.cloudAvail && !S.user) m.append(item('Google 로그인', () => { S.guest = false; ls.set('hagisiro:guest', '0'); S.cloudMod.login().catch(loginErr); }));
    m.append(item('화면 설정', openPrefs));
    m.append(item('출결 설정 (요일별 교시 수)', openSettings));
    if (S.user) {
      m.append(item(gcalWanted() ? '구글 캘린더 일정 끄기' : '구글 캘린더 일정 함께 보기', () => {
        if (gcalWanted()) { ls.set('hagisiro:gcal', '0'); S.gcal = {}; render(); } else connectGcal(false);
      }));
      m.append(item('로그아웃', () => { ls.set('hagisiro:guest', '0'); S.guest = false; S.cloudMod.logout(); }));
    }
    if (!S.cloud) m.append(item('백업 내보내기 (JSON)', exportJson));
    $('#app').append(m);
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
  }
  const loginErr = (e) => toast('로그인 실패: ' + ((e && (e.code || e.message)) || ''));

  function download(name, text, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  }
  function exportJson() {
    const o = {}; COLS.forEach((c) => { o[c] = S[c]; });
    download(`hagisiro-backup-${ymd(new Date())}.json`, JSON.stringify(o, null, 1), 'application/json');
  }

  /* ---------- 로그인 화면 ---------- */
  function loginView() {
    const logo = el('div', { class: 'logo' }); logo.innerHTML = LOGO;
    return el('div', { class: 'login' },
      logo,
      el('h1', {}, 'HAGISIRO'),
      el('p', { class: 'mut' }, '할 일과 출결을 한 화면에서'),
      el('button', { class: 'pri', onclick: () => S.cloudMod.login().catch(loginErr) }, 'Google로 시작'),
      el('button', { class: 'link', onclick: () => { S.guest = true; ls.set('hagisiro:guest', '1'); enterLocal(); } }, '로그인 없이 이 기기에서만 쓰기'));
  }

  /* ================= 캘린더 ================= */
  function calView() {
    const r = range();
    const todayS = ymd(new Date());
    const wrap = el('div', { class: 'cal', id: 'cal' });
    wrap.append(el('div', { class: 'wk' }, DOW.map((d, i) => el('div', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '' }, d))));
    const grid = el('div', { class: 'days', style: `grid-template-rows:repeat(${r.rows},minmax(0,1fr))` });
    const attBy = {}; S.att.forEach((a) => { attBy[a.date] = (attBy[a.date] || 0) + 1; });

    for (let i = 0; i < r.rows * 7; i++) {
      const d = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate() + i);
      const ds = ymd(d);
      const list = itemsOn(ds);
      const gl = S.gcal[ds] || [];
      const hn = holName(ds, d);
      const lu = PF.lunar && window.Lunar ? Lunar.lunarLabel(d) : '';
      const tm = PF.terms && window.Lunar ? Lunar.termOf(d) : '';
      const cls = 'cell' + (!weekMode() && d.getMonth() !== S.m ? ' other' : '') + (hn ? ' hol' : '') + (ds === todayS ? ' today' : '') + (ds === S.sel ? ' sel' : '') +
        (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
      grid.append(el('div', { class: cls, 'data-date': ds },
        el('div', { class: 'ct' },
          el('span', { class: 'dn' }, d.getDate() === 1 ? `${d.getMonth() + 1}.1` : d.getDate()),
          hn || tm || lu ? el('span', { class: 'sb', title: [hn, tm, lu].filter(Boolean).join(' · ') },
            hn ? el('i', { class: 'hn' }, hn) : null, tm ? el('i', { class: 'tm' }, tm) : null, lu ? el('i', { class: 'lu' }, lu) : null) : null,
          attBy[ds] ? el('button', { class: 'ab', 'data-act': 'att', title: '출결 보기' }, `출결 ${attBy[ds]}`) : null),
        el('div', { class: 'tl' }, gl.map(gev), list.map(todoRow)),
        el('div', { class: 'dots' }, list.slice(0, 5).map((t) => el('i', { class: t.done ? 'on' : '' })), gl.length ? el('i', { class: 'g' }) : null)));
    }

    grid.addEventListener('click', (e) => {
      if (skipClick) return;
      const ab = e.target.closest('[data-act="att"]');
      if (ab) { setSel(ab.closest('.cell').dataset.date); S.sub = 'day'; ls.set('hagisiro:sub', 'day'); setView('att'); return; }
      const cell = e.target.closest('.cell');
      if (!cell || S.editing) return;
      selectDate(cell.dataset.date);
      if (isMobile()) openSheet(cell.dataset.date);
    });
    grid.addEventListener('dblclick', (e) => {
      if (isMobile() || S.editing || e.target.closest('.ab')) return;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = e.target.closest('.td');
      selectDate(cell.dataset.date);
      openEditor(cell.querySelector('.tl'), cell.dataset.date, null, { focusId: row && row.dataset.id });
    });
    wrap.append(grid);
    return wrap;
  }

  function holName(ds, d) {
    if (PF.ghol && S.ghol[ds]) return S.ghol[ds];
    return PF.hol && window.Lunar ? Lunar.holidayOf(d) : '';
  }
  function selectDate(ds) {
    S.sel = ds;
    document.querySelectorAll('.cell.sel').forEach((c) => c.classList.remove('sel'));
    const c = document.querySelector(`.cell[data-date="${ds}"]`);
    if (c) c.classList.add('sel');
  }

  function gev(ev) {
    return el('div', { class: 'gev', title: ev.s }, (ev.t ? ev.t + ' ' : '') + ev.s);
  }

  /* ================= 반복 규칙 =================
   * 반복은 규칙(repeats)만 저장하고, 달력에는 날짜마다 계산해서 보여줘요.
   * 그날 완료·수정·삭제한 흔적만 todos 에 따로 남겨요 (id: r:규칙:날짜, skip=true 면 그날만 삭제) */
  const ruleOf = (id) => S.repeats.find((r) => r.id === id);
  const isLeapY = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const oid = (rid, ds) => `r:${rid}:${ds}`;
  const vid = (rid, ds) => `v:${rid}:${ds}`;
  const clean = (o) => { Object.keys(o).forEach((k) => { if (o[k] === '' || o[k] === undefined || o[k] === null) delete o[k]; }); return o; };

  function occursOn(r, ds) {
    if (ds < r.start || (r.end && ds > r.end)) return false;
    const d = parseYmd(ds), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    switch (r.kind) {
      case 'daily': return !(r.skipWE && (d.getDay() === 0 || d.getDay() === 6));
      case 'weekly': return (r.dows || []).includes(d.getDay());
      case 'monthly': return d.getDate() === Math.min(r.dom, dim);
      case 'yearly': {
        if (r.lunar) {
          const L = window.Lunar; if (!L) return false;
          const l = L.lunarOf(d);
          if (!l || l.leap) return false;
          if (l.m === r.month && l.d === r.day) return true;
          if (r.day === 30 && l.m === r.month && l.d === 29) { // 그 달이 29일까지인 해엔 말일에 표시
            const n = L.lunarOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
            return !!n && n.d === 1;
          }
          return false;
        }
        if (d.getMonth() + 1 !== r.month) return false;
        return d.getDate() === r.day || (r.month === 2 && r.day === 29 && d.getDate() === 28 && !isLeapY(d.getFullYear()));
      }
      default: return false;
    }
  }
  const virtualOf = (r, ds) => ({ id: vid(r.id, ds), virtual: true, rid: r.id, date: ds, text: r.text, done: false, fg: r.fg, bg: r.bg });
  const cellSort = (a, b) => (PF.sortDone ? (a.done ? 1 : 0) - (b.done ? 1 : 0) : 0) || (a.rid ? 0 : 1) - (b.rid ? 0 : 1) || byOrd(a, b);
  /** 그 날짜에 보여줄 항목 = 저장된 할 일 + 계산으로 생기는 반복 항목 */
  function itemsOn(ds) {
    const real = S.todos.filter((t) => t.date === ds);
    const have = new Set(real.filter((t) => t.rid).map((t) => t.rid));
    const out = real.filter((t) => !t.skip && (!t.rid || ruleOf(t.rid)));
    S.repeats.forEach((r) => { if (!have.has(r.id) && occursOn(r, ds)) out.push(virtualOf(r, ds)); });
    return out.sort(cellSort);
  }
  function getItem(id) {
    if (id.startsWith('v:')) { const [, rid, ds] = id.split(':'); const r = ruleOf(rid); return r ? virtualOf(r, ds) : null; }
    return S.todos.find((t) => t.id === id) || null;
  }
  function patchItem(id, patch) {
    const it = getItem(id); if (!it) return;
    if (it.virtual) Data.put('todos', clean({ id: oid(it.rid, it.date), rid: it.rid, date: it.date, text: it.text, done: false, fg: it.fg, bg: it.bg, ord: 0, created: Date.now(), ...patch }));
    else Data.put('todos', clean({ ...it, ...patch }));
  }
  const KIND_LABEL = { daily: '매일', weekly: '매주', monthly: '매달', yearly: '매년' };
  function ruleSummary(r) {
    switch (r.kind) {
      case 'daily': return '매일' + (r.skipWE ? ' (주말 제외)' : '');
      case 'weekly': return '매주 ' + (r.dows || []).slice().sort((a, b) => a - b).map((d) => DOW[d]).join('·') + '요일';
      case 'monthly': return `매달 ${r.dom}일`;
      case 'yearly': return `매년 ${r.lunar ? '음력 ' : ''}${r.month}월 ${r.day}일`;
      default: return '';
    }
  }

  /* ---------- 달력 칸의 할 일 한 줄: 불릿 + 글자 ---------- */
  const colorVars = (t) => (t.fg ? `--tfg:${t.fg};` : '') + (t.bg ? `--tbg:${t.bg};` : '');
  function todoRow(t) {
    return el('div', { class: 'td' + (t.done ? ' done' : '') + (t.rid ? ' rep' : ''), 'data-id': t.id, style: colorVars(t) || null },
      el('span', { class: 'bl' }, icon('dot')), el('span', { class: 'tt', title: t.text }, t.text),
      t.rid ? el('span', { class: 'rpt', title: '반복' }, icon('repeat')) : null);
  }

  /* ---------- 글자색 · 배경색 팔레트 ---------- */
  const FG = [['', '기본'], ['#e5484d', '빨강'], ['#d98a00', '주황'], ['#2e9e5b', '초록'], ['#2563eb', '파랑'], ['#8b5cf6', '보라'], ['#d6409f', '분홍'], ['#8b9098', '회색']];
  const BGC = [['', '없음'], ['rgba(250,204,21,.38)', '노랑'], ['rgba(251,146,60,.32)', '주황'], ['rgba(239,68,68,.24)', '빨강'], ['rgba(34,197,94,.26)', '초록'], ['rgba(59,130,246,.26)', '파랑'], ['rgba(139,92,246,.26)', '보라'], ['rgba(236,72,153,.24)', '분홍'], ['rgba(128,128,128,.28)', '회색']];
  function swatches(onPick, cur) {
    const wrap = el('div', { class: 'sw' });
    const row = (label, key, list) => {
      const r = el('div', { class: 'swr' }, el('span', { class: 'swl' }, label));
      list.forEach(([val, name]) => {
        const b = el('button', { type: 'button', class: 'swb' + (key === 'bg' ? ' sq' : '') + (val ? '' : ' none') + ((cur && (cur[key] || '') === val) ? ' on' : ''), title: `${label} ${name}`, 'aria-label': `${label} ${name}`, style: val ? `background:${val}` : null });
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          r.querySelectorAll('.swb').forEach((x) => x.classList.remove('on')); b.classList.add('on');
          onPick({ [key]: val });
        });
        r.append(b);
      });
      return r;
    };
    wrap.append(row('글자색', 'fg', FG), row('배경색', 'bg', BGC));
    return wrap;
  }
  let palEl = null, palOff = null;
  function closePal() {
    if (palEl) { palEl.remove(); palEl = null; }
    if (palOff) { document.removeEventListener('pointerdown', palOff); palOff = null; }
  }
  function openPalette(anchor, onPick) {
    if (palEl && palEl._anchor === anchor) { closePal(); return; }
    closePal();
    palEl = el('div', { class: 'pal' }, swatches(onPick));
    palEl._anchor = anchor;
    palEl.addEventListener('mousedown', (e) => e.preventDefault()); // 입력창 포커스 유지
    document.body.append(palEl);
    const r = anchor.getBoundingClientRect(), w = palEl.offsetWidth, h = palEl.offsetHeight;
    let top = r.bottom + 6; if (top + h > innerHeight - 4) top = r.top - h - 6;
    palEl.style.left = Math.max(4, Math.min(r.left, innerWidth - w - 4)) + 'px';
    palEl.style.top = Math.max(4, top) + 'px';
    palOff = (e) => { if (palEl && !palEl.contains(e.target) && !anchor.contains(e.target)) closePal(); };
    setTimeout(() => { if (palOff) document.addEventListener('pointerdown', palOff); }, 0);
  }

  /* ---------- 아이콘 막대: ✓ 취소선 · 팔레트 · 반복 ---------- */
  const NEED_PICK = '먼저 할 일을 고르세요 (불릿을 누르거나 끌어서 선택)';
  function makeBar(ctx) {
    const bar = el('div', { class: 'tbar ' + (ctx.cls || '') });
    bar.addEventListener('mousedown', (e) => e.preventDefault()); // 막대를 눌러도 입력창 포커스 유지
    const btn = (name, label, fn) => {
      const b = el('button', { class: 'tb', type: 'button', title: label, 'aria-label': label }, icon(name));
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
      return b;
    };
    bar.append(
      btn('check', '취소선 (완료)', () => {
        const ts = ctx.targets();
        if (!ts.length) { toast(NEED_PICK); return; }
        const to = !ts.every((t) => t.get().done);
        ts.forEach((t) => t.set({ done: to }));
        if (ctx.after) ctx.after(false);
      }),
      btn('palette', '글자색 · 배경색', (b) => {
        if (!ctx.targets().length) { toast(NEED_PICK); return; }
        openPalette(b, (patch) => { ctx.targets().forEach((t) => t.set(patch)); if (ctx.after) ctx.after(true); });
      }),
      btn('repeat', '반복', () => ctx.repeat(ctx.targets())));
    return bar;
  }
  function placeBar(bar, x, y) {
    const w = bar.offsetWidth || 120, h = bar.offsetHeight || 40;
    bar.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + 'px';
    bar.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + 'px';
  }

  /* ---------- 끌어서 여러 개 선택 (보기 화면) → 아이콘 막대 ---------- */
  let skipClick = false, drag = null;
  const allowClick = () => setTimeout(() => { skipClick = false; }, 0);
  function clearPicked(keepPal) {
    document.querySelectorAll('#cal .td.picked').forEach((r) => r.classList.remove('picked'));
    const f = $('.mq-bar'); if (f) f.remove();
    if (!keepPal) closePal();
    if (drag && drag.box) drag.box.remove();
    drag = null;
  }
  const viewTarget = (id) => ({ id, get: () => getItem(id) || {}, set: (p) => patchItem(id, p) });
  function showBar(x, y) {
    if (!document.querySelector('#cal .td.picked')) return;
    const pickedIds = () => [...document.querySelectorAll('#cal .td.picked')].map((r) => r.dataset.id);
    const ctx = {
      cls: 'mq-bar',
      targets: () => pickedIds().map(viewTarget),
      after: (keep) => {
        const ids = pickedIds().map((id) => id.replace(/^v:/, 'r:')); // 저장되면 v: → r:
        clearPicked(keep); render();
        if (keep) {
          ids.forEach((id) => { const r = document.querySelector(`#cal .td[data-id="${id}"]`); if (r) r.classList.add('picked'); });
          showBar(x, y);
        }
      },
      repeat: (ts) => {
        const ids = ts.map((t) => t.id); const first = ids.length ? getItem(ids[0]) : null;
        clearPicked(); openRepeat({ ds: first ? first.date : S.sel, ids });
      },
    };
    const old = $('.mq-bar'); if (old) old.remove();
    const b = makeBar(ctx);
    document.body.append(b);
    placeBar(b, x + 8, y + 8);
  }

  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mq-bar,.pal,.tbar')) return;
    if (S.editing) return;
    clearPicked();
    if (e.button !== 0 || e.pointerType === 'touch') return;
    if (!e.target.closest('#cal .days')) return;
    if (e.target.closest('.ab,input')) return;
    drag = { x: e.clientX, y: e.clientY, on: false, box: null };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
      drag.on = true;
      drag.box = el('div', { class: 'marq' });
      document.body.append(drag.box);
    }
    if (!drag.on) return;
    const x1 = Math.min(drag.x, e.clientX), x2 = Math.max(drag.x, e.clientX);
    const y1 = Math.min(drag.y, e.clientY), y2 = Math.max(drag.y, e.clientY);
    Object.assign(drag.box.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
    document.querySelectorAll('#cal .td').forEach((r) => {
      const b = r.getBoundingClientRect();
      r.classList.toggle('picked', !(b.right < x1 || b.left > x2 || b.bottom < y1 || b.top > y2));
    });
  });
  function endPointer(e) {
    if (!drag) return;
    const was = drag.on;
    if (drag.box) drag.box.remove();
    drag = null;
    if (was) { skipClick = true; allowClick(); showBar(e.clientX, e.clientY); }
  }
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);

  /* ---------- 할 일 편집기: 엔터=다음 줄, 빈 줄에서 엔터=끝 ---------- */
  function commitTodos(ds, items, origVirtual) {
    const old = S.todos.filter((t) => t.date === ds);
    const keep = new Set(), seen = new Set();
    let ord = 0;
    items.forEach((it) => {
      const text = it.text.trim();
      if (!text) return;
      const idx = ord++;
      if (it.virtual) { // 계산으로 생긴 반복 항목: 고친 게 있을 때만 그날 기록으로 저장
        const r = ruleOf(it.rid); if (!r) return;
        seen.add(it.rid);
        const changed = text !== r.text || it.done || (it.fg || '') !== (r.fg || '') || (it.bg || '') !== (r.bg || '');
        if (changed) Data.put('todos', clean({ id: oid(it.rid, ds), rid: it.rid, date: ds, text, done: !!it.done, fg: it.fg, bg: it.bg, ord: idx, created: Date.now() }));
        return;
      }
      if (!it.id) it.id = uid();
      keep.add(it.id);
      if (it.rid) seen.add(it.rid);
      const o = old.find((x) => x.id === it.id);
      const rec = clean({ ...(o || {}), id: it.id, date: ds, text, done: !!it.done, fg: it.fg || '', bg: it.bg || '', ord: idx, created: (o && o.created) || Date.now() });
      if (!o || o.text !== rec.text || !!o.done !== rec.done || (o.fg || '') !== (rec.fg || '') || (o.bg || '') !== (rec.bg || '') || o.ord !== rec.ord) Data.put('todos', rec);
    });
    old.forEach((o) => {
      if (keep.has(o.id) || o.skip) return;
      if (o.rid && ruleOf(o.rid)) Data.put('todos', { id: o.id, rid: o.rid, date: ds, skip: true, created: o.created || Date.now() }); // 그날만 삭제
      else Data.del('todos', o.id);
    });
    (origVirtual || []).forEach((rid) => {
      if (!seen.has(rid) && ruleOf(rid)) Data.put('todos', { id: oid(rid, ds), rid, date: ds, skip: true, created: Date.now() });
    });
  }

  function openEditor(host, ds, onDone, opt = {}) {
    const box = el('div', { class: 'ed' });
    const items = itemsOn(ds).map((t) => ({ id: t.id, virtual: !!t.virtual, rid: t.rid, text: t.text, done: !!t.done, fg: t.fg, bg: t.bg }));
    const origVirtual = items.filter((i) => i.virtual).map((i) => i.rid);
    items.push({ text: '', done: false });
    host.replaceChildren(box);
    const cell = host.closest('.cell');
    if (cell) cell.classList.add('editing');
    let closed = false, selDrag = null, bar = null;
    const rows = () => [...box.children].filter((c) => c.classList.contains('td'));
    const focusEnd = (row) => { const i = row.querySelector('input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    const paint = (row) => {
      const it = row._it;
      row.classList.toggle('done', !!it.done);
      ['fg', 'bg'].forEach((k) => { if (it[k]) row.style.setProperty('--t' + k, it[k]); else row.style.removeProperty('--t' + k); });
    };
    const clearPicks = () => rows().forEach((r) => r.classList.remove('picked'));
    // 선택한 줄이 있으면 그 줄들, 없으면 커서가 있는 줄
    const targets = () => {
      let rs = rows().filter((r) => r.classList.contains('picked'));
      if (!rs.length) { const f = rows().find((r) => r.contains(document.activeElement)); if (f) rs = [f]; }
      return rs.filter((r) => r._it.text.trim()).map((r) => ({ id: r._it.id, get: () => r._it, set: (p) => { Object.assign(r._it, p); paint(r); } }));
    };
    const onMove = (e) => {
      if (!selDrag) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const r = t && t.closest && t.closest('.td');
      if (r && box.contains(r) && r.classList.contains('picked') !== selDrag.state) r.classList.toggle('picked', selDrag.state);
    };
    const onUp = () => { selDrag = null; };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);

    function finish() {
      if (closed) return;
      closed = true;
      closePal();
      if (bar) bar.remove();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      commitTodos(ds, rows().map((r) => r._it), origVirtual);
      S.editing = null;
      if (onDone) onDone();
      render();
    }

    function mkRow(it) {
      const inp = el('input', { type: 'text', value: it.text, spellcheck: 'false', autocomplete: 'off', enterkeyhint: 'next', 'aria-label': '할 일' });
      const bl = el('span', { class: 'bl', title: '눌러서 선택 · 끌어서 여러 줄 선택' }, icon('dot'));
      const row = el('div', { class: 'td' }, bl, inp, it.rid ? el('span', { class: 'rpt', title: '반복' }, icon('repeat')) : null);
      row._it = it;
      paint(row);
      bl.addEventListener('mousedown', (e) => e.preventDefault()); // 입력창 포커스 유지
      bl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const state = !row.classList.contains('picked');
        row.classList.toggle('picked', state);
        selDrag = { state };
      });
      inp.addEventListener('mousedown', clearPicks);
      inp.addEventListener('input', () => { it.text = inp.value; });
      onEnter(inp, () => {
        if (inp.value.trim() === '' && row === rows().at(-1)) { finish(); return; }
        const nr = mkRow({ text: '', done: false });
        row.after(nr); nr.querySelector('input').focus();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        const rs = rows(); const i = rs.indexOf(row);
        if (e.key === 'Backspace' && inp.value === '' && rs.length > 1) {
          e.preventDefault();
          const prev = rs[i - 1] || rs[i + 1];
          row.remove(); focusEnd(prev);
        } else if (e.key === 'ArrowUp' && rs[i - 1]) { e.preventDefault(); focusEnd(rs[i - 1]); }
        else if (e.key === 'ArrowDown' && rs[i + 1]) { e.preventDefault(); focusEnd(rs[i + 1]); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(); }
      });
      return row;
    }

    items.forEach((it) => box.append(mkRow(it)));
    box.addEventListener('focusout', () => setTimeout(() => {
      if (!closed && !box.contains(document.activeElement)) finish();
    }, 0));

    bar = makeBar({
      cls: opt.barHost ? 'inline' : '',
      targets,
      repeat: (ts) => { // 모달에서 입력해야 하니 편집을 먼저 저장하고 닫은 뒤 연다
        const its = ts.map((t) => t.get());
        finish();
        openRepeat({ ds, ids: its.map((i) => i.id).filter(Boolean) });
      },
    });
    if (opt.barHost) opt.barHost.append(bar);
    else if (cell) {
      document.body.append(bar);
      const cr = cell.getBoundingClientRect(), bh = bar.offsetHeight || 40;
      let top = cr.bottom + 4; if (top + bh > innerHeight - 4) top = cr.top - bh - 4;
      placeBar(bar, cr.left, top);
    }

    const api = {
      ds, box, finish,
      addRow() { const nr = mkRow({ text: '', done: false }); box.append(nr); nr.querySelector('input').focus(); },
    };
    S.editing = api;
    const f = opt.focusId && rows().find((r) => r._it.id === opt.focusId);
    if (f) focusEnd(f); else rows().at(-1).querySelector('input').focus();
    return api;
  }

  /* ---------- 모바일: 날짜 누르면 아래에서 올라오는 시트 ---------- */
  function openSheet(ds) {
    const sh = $('#sheet');
    sh.hidden = false; sh.replaceChildren();
    const d = parseYmd(ds);
    const body = el('div', { class: 'sbody' });
    let api;
    const noBlur = (b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); return b; };
    const add = noBlur(el('button', { class: 'addrow', type: 'button', onclick: () => api && api.addRow() }, icon('plus'), '항목 추가'));
    const close = noBlur(el('button', { class: 'ib', type: 'button', 'aria-label': '닫기', onclick: () => api && api.finish() }, icon('close')));
    const foot = el('div', { class: 'sfoot' }, add);
    const g = (S.gcal[ds] || []).map(gev);
    sh.append(el('div', { class: 'back', onclick: () => api && api.finish() }),
      el('div', { class: 'panel' },
        el('div', { class: 'shead' }, el('b', {}, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`), el('span', { class: 'grow' }), close),
        g.length ? el('div', { class: 'sg' }, g) : null, body, foot));
    api = openEditor(body, ds, () => { sh.hidden = true; sh.replaceChildren(); }, { barHost: foot });
  }

  /* ================= 반복 설정 · 관리 팝업 ================= */
  function repeatForm(init, opt) {
    const L = window.Lunar;
    const base = parseYmd(init.start);
    const st = {
      kind: init.kind || 'weekly', dows: new Set(init.dows || [base.getDay()]), dom: init.dom || base.getDate(), skipWE: !!init.skipWE,
      lunar: !!init.lunar, month: init.month || base.getMonth() + 1, day: init.day || base.getDate(),
      start: init.start, end: init.end || '', text: init.text || '', fg: init.fg || '', bg: init.bg || '',
    };
    const root = el('div', { class: 'rform' });
    let textIn = null;
    if (opt.withText) {
      textIn = el('input', { type: 'text', class: 'rtext', placeholder: '반복할 할 일', value: st.text, 'aria-label': '반복할 할 일', spellcheck: 'false' });
      textIn.addEventListener('input', () => { st.text = textIn.value; });
      root.append(textIn);
    }
    const kinds = el('div', { class: 'seg rk' });
    Object.entries(KIND_LABEL).forEach(([k, lab]) => kinds.append(el('button', { type: 'button', class: 'sg-b', 'data-k': k, onclick: () => { st.kind = k; sync(); } }, lab)));
    root.append(kinds);

    const cbWE = el('input', { type: 'checkbox' }); cbWE.checked = st.skipWE;
    cbWE.addEventListener('change', () => { st.skipWE = cbWE.checked; });
    const oDaily = el('label', { class: 'rchk' }, cbWE, '주말(토·일)은 제외');

    const oWeekly = el('div', { class: 'rdow' });
    for (let d = 0; d < 7; d++) {
      oWeekly.append(el('button', { type: 'button', class: 'dowb' + (d === 0 ? ' sun' : d === 6 ? ' sat' : ''), 'data-d': d, onclick: (e) => {
        if (st.dows.has(d)) st.dows.delete(d); else st.dows.add(d);
        e.currentTarget.classList.toggle('on', st.dows.has(d));
      } }, DOW[d]));
    }
    oWeekly.querySelectorAll('.dowb').forEach((b) => b.classList.toggle('on', st.dows.has(+b.dataset.d)));
    const wrapW = el('div', { class: 'rln' }, el('span', {}, '매주'), oWeekly);

    const domIn = el('input', { type: 'number', min: '1', max: '31', value: st.dom, 'aria-label': '일' });
    const hint = el('span', { class: 'mut small' }, '짧은 달에는 그 달의 마지막 날에 표시돼요');
    domIn.addEventListener('input', () => { st.dom = +domIn.value; hint.hidden = !(st.dom > 28); });
    hint.hidden = !(st.dom > 28);
    const oMonthly = el('div', { class: 'rln' }, el('span', {}, '매달'), domIn, el('span', {}, '일'), hint);

    const calSeg = el('div', { class: 'seg rc' },
      el('button', { type: 'button', class: 'sg-b', 'data-c': '0', onclick: () => setLunar(false) }, '양력'),
      L ? el('button', { type: 'button', class: 'sg-b', 'data-c': '1', onclick: () => setLunar(true) }, '음력') : null);
    const monIn = el('input', { type: 'number', min: '1', max: '12', value: st.month, 'aria-label': '월' });
    const dayIn = el('input', { type: 'number', min: '1', max: '31', value: st.day, 'aria-label': '일' });
    monIn.addEventListener('input', () => { st.month = +monIn.value; });
    dayIn.addEventListener('input', () => { st.day = +dayIn.value; });
    function setLunar(on) {
      st.lunar = on;
      if (on && L) { const l = L.lunarOf(base); if (l) { st.month = l.m; st.day = l.d; } }
      else { st.month = base.getMonth() + 1; st.day = base.getDate(); }
      monIn.value = st.month; dayIn.value = st.day; sync();
    }
    const oYearly = el('div', { class: 'rln' }, el('span', {}, '매년'), calSeg, monIn, el('span', {}, '월'), dayIn, el('span', {}, '일'));

    const startIn = el('input', { type: 'date', value: st.start, 'aria-label': '시작일' });
    const endIn = el('input', { type: 'date', value: st.end, 'aria-label': '종료일' });
    startIn.addEventListener('change', () => { st.start = startIn.value; });
    endIn.addEventListener('change', () => { st.end = endIn.value; });
    const per = el('div', { class: 'rper' }, el('label', {}, '시작 ', startIn), el('label', {}, '종료 ', endIn, el('span', { class: 'small' }, ' (비우면 계속)')));

    root.append(oDaily, wrapW, oMonthly, oYearly, per);
    if (opt.withColors) root.append(swatches((p) => Object.assign(st, p), st));

    function sync() {
      kinds.querySelectorAll('.sg-b').forEach((b) => b.classList.toggle('on', b.dataset.k === st.kind));
      calSeg.querySelectorAll('.sg-b').forEach((b) => b.classList.toggle('on', (b.dataset.c === '1') === st.lunar));
      oDaily.hidden = st.kind !== 'daily'; wrapW.hidden = st.kind !== 'weekly';
      oMonthly.hidden = st.kind !== 'monthly'; oYearly.hidden = st.kind !== 'yearly';
    }
    sync();

    const read = () => {
      const f = { kind: st.kind, start: st.start || init.start, end: st.end || '' };
      if (f.end && f.end < f.start) { toast('종료일이 시작일보다 빨라요'); return null; }
      if (st.kind === 'daily') f.skipWE = st.skipWE;
      if (st.kind === 'weekly') {
        if (!st.dows.size) { toast('요일을 하나 이상 골라 주세요'); return null; }
        f.dows = [...st.dows].sort((a, b) => a - b);
      }
      if (st.kind === 'monthly') {
        if (!(st.dom >= 1 && st.dom <= 31)) { toast('1~31 사이의 날짜를 넣어 주세요'); return null; }
        f.dom = st.dom;
      }
      if (st.kind === 'yearly') {
        if (!(st.month >= 1 && st.month <= 12) || !(st.day >= 1 && st.day <= (st.lunar ? 30 : 31))) { toast('월·일을 확인해 주세요'); return null; }
        f.month = st.month; f.day = st.day; f.lunar = st.lunar;
      }
      if (opt.withText) { if (!st.text.trim()) { toast('반복할 내용을 입력해 주세요'); return null; } f.text = st.text.trim(); }
      if (opt.withColors) { f.fg = st.fg; f.bg = st.bg; }
      return f;
    };
    return { node: root, read, focus: () => { if (textIn) textIn.focus(); } };
  }

  function openRepeat({ ds, ids = [], tab } = {}) {
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const fresh = ids.map(getItem).filter((i) => i && !i.rid && i.text); // 아직 반복이 아닌 선택 항목
    let mode = tab || (fresh.length ? 'new' : 'manage');
    let editing = null;
    const tabs = el('div', { class: 'seg rtabs' });
    const body = el('div', { class: 'rbody' });
    const dlg = el('div', { class: 'dlg rdlg' },
      el('div', { class: 'shead' }, el('b', {}, '반복'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
      tabs, body);
    m.append(el('div', { class: 'back', onclick: close }), dlg);
    const today = ymd(new Date());

    function show() {
      tabs.replaceChildren();
      const tb = (k, label) => el('button', { type: 'button', class: 'sg-b' + (mode === k || (k === 'manage' && mode === 'form') ? ' on' : ''), onclick: () => { mode = k; editing = null; show(); } }, label);
      if (fresh.length) tabs.append(tb('new', '반복 설정'));
      tabs.append(tb('manage', `반복 관리 (${S.repeats.length})`));
      body.replaceChildren();
      if (mode === 'new') showNew(); else if (mode === 'form') showForm(); else showManage();
    }

    function showNew() {
      const form = repeatForm({ start: fresh[0].date || ds || today }, {});
      body.append(
        el('div', { class: 'rtargets' }, fresh.map((i) => el('span', { class: 'rchip', style: colorVars(i) || null }, i.text))),
        form.node,
        el('div', { class: 'dlgf' }, el('span', { class: 'grow' }),
          el('button', { class: 'ghost', type: 'button', onclick: close }, '취소'),
          el('button', { class: 'pri', type: 'button', onclick: () => {
            const f = form.read(); if (!f) return;
            fresh.forEach((it) => {
              const rule = clean({ id: uid(), created: Date.now(), text: it.text, fg: it.fg, bg: it.bg, ...f });
              Data.put('repeats', rule);
              if (occursOn(rule, it.date)) { // 한 번짜리 항목은 반복 항목으로 바꿔치기 (완료 표시는 유지)
                Data.del('todos', it.id);
                if (it.done) Data.put('todos', clean({ id: oid(rule.id, it.date), rid: rule.id, date: it.date, text: it.text, done: true, fg: it.fg, bg: it.bg, ord: 0, created: Date.now() }));
              }
            });
            close(); render();
            toast(`${fresh.length}개를 ${ruleSummary(clean({ ...f }))}(으)로 반복해요`);
          } }, '반복으로 설정')));
    }

    function showManage() {
      const list = S.repeats.slice().sort((a, b) => (a.created || 0) - (b.created || 0));
      if (!list.length) body.append(el('p', { class: 'mut rnone' }, '반복으로 정한 할 일이 아직 없어요. 할 일을 더블클릭해서 고른 뒤 반복 아이콘을 누르면 만들 수 있고, 아래 버튼으로 바로 만들 수도 있어요.'));
      list.forEach((r) => {
        const per = r.start + (r.end ? ` ~ ${r.end}` : ' ~');
        body.append(el('div', { class: 'rrow' },
          el('div', { class: 'rinfo' }, el('span', { class: 'rchip', style: colorVars(r) || null }, r.text), el('div', { class: 'mut small' }, `${ruleSummary(r)} · ${per}`)),
          el('button', { class: 'ghost sm', type: 'button', onclick: () => { editing = r; mode = 'form'; show(); } }, '수정'),
          el('button', { class: 'ghost sm danger', type: 'button', onclick: () => delRule(r) }, '삭제')));
      });
      body.append(el('div', { class: 'dlgf' }, el('button', { class: 'ghost', type: 'button', onclick: () => { editing = null; mode = 'form'; show(); } }, icon('plus'), '새 반복'),
        el('span', { class: 'grow' }), el('button', { class: 'ghost', type: 'button', onclick: close }, '닫기')));
    }

    function showForm() {
      const form = repeatForm(editing ? { ...editing } : { start: ds || today }, { withText: true, withColors: true });
      body.append(form.node,
        el('div', { class: 'dlgf' }, el('span', { class: 'grow' }),
          el('button', { class: 'ghost', type: 'button', onclick: () => { mode = 'manage'; editing = null; show(); } }, '취소'),
          el('button', { class: 'pri', type: 'button', onclick: () => {
            const f = form.read(); if (!f) return;
            Data.put('repeats', clean({ id: editing ? editing.id : uid(), created: editing ? editing.created : Date.now(), ...f }));
            mode = 'manage'; editing = null; show(); render();
          } }, '저장')));
      setTimeout(() => form.focus(), 0);
    }

    function delRule(r) {
      if (!confirm('이 반복을 삭제할까요?\n달력에서 이 반복 항목이 모두 사라져요.')) return;
      const ovr = S.todos.filter((t) => t.rid === r.id);
      Data.del('repeats', r.id); ovr.forEach((t) => Data.del('todos', t.id));
      toast('반복을 삭제했어요', () => { Data.put('repeats', r); ovr.forEach((t) => Data.put('todos', t)); render(); });
      show(); render();
    }
    show();
  }

  /* ================= 출결 ================= */
  const curClass = () => S.classes.find((c) => c.id === S.clsId) || S.classes[0] || null;
  const kindLabel = (a) => a.cat + a.type;
  const resSlot = (x, last) => (x >= END ? last + 1 : Math.min(x, last + 1));

  function studentPool() {
    const cur = curClass();
    const order = [cur, ...S.classes.filter((c) => c !== cur)].filter(Boolean);
    const pool = [];
    order.forEach((c) => c.students.forEach((s) => pool.push({ ...s, classId: c.id })));
    return pool;
  }
  function runParse(text) {
    const cur = curClass();
    return P.parse(text, { students: studentPool(), classId: cur && cur.id, today: new Date(), base: parseYmd(S.sel), lastOf });
  }
  const monthRecs = (cls) => S.att.filter((a) => a.classId === cls.id && a.date.startsWith(`${S.y}-${pad(S.m + 1)}-`));

  function attView() {
    const root = el('div', { class: 'att' });
    if (!S.clsLoaded) { root.append(el('div', { class: 'empty mut' }, '불러오는 중…')); return root; }
    const cls = curClass();
    if (!cls) {
      root.append(el('div', { class: 'empty' },
        el('p', {}, '아직 학급이 없어요'),
        el('p', { class: 'mut' }, '명단을 한 번만 붙여넣으면, 이후엔 문장으로 바로 기록돼요'),
        el('button', { class: 'pri', onclick: () => openRoster(null) }, '학급 만들기')));
      return root;
    }
    S.clsId = cls.id;

    const sel = el('select', { 'aria-label': '학급', onchange: (e) => { S.clsId = e.target.value; ls.set('hagisiro:cls', S.clsId); S.extra = {}; render(); } },
      S.classes.map((c) => el('option', { value: c.id, selected: c.id === cls.id }, c.name)));
    const seg = (v, label) => el('button', { class: 'sg-b' + (S.sub === v ? ' on' : ''), onclick: () => setSub(v) }, label);
    root.append(el('div', { class: 'abar' }, sel,
      el('div', { class: 'seg' }, seg('day', '일별'), seg('week', '주별'), seg('month', '월별')),
      el('span', { class: 'grow' }),
      el('button', { class: 'ghost sm', onclick: () => openRoster(cls.id) }, icon('users'), '학급 수정'),
      el('button', { class: 'ghost sm', onclick: () => openRoster(null) }, icon('plus'), '학급 추가'),
      el('button', { class: 'ghost sm', onclick: openSettings }, icon('clock'), '교시 설정'),
      el('button', { class: 'ghost sm', onclick: () => exportCsv(cls) }, icon('download'), 'CSV')));

    const q = el('input', { id: 'q', type: 'text', placeholder: '출결 입력', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': '출결 입력' });
    q.addEventListener('input', preview);
    onEnter(q, submitQuick);
    root.append(el('div', { class: 'qi' },
      el('div', { class: 'qrow' }, q, el('button', { class: 'qgo', type: 'button', id: 'qgo', title: '입력 (Enter)', 'aria-label': '출결 입력 확인', onclick: submitQuick }, icon('enter'))),
      el('div', { id: 'pv', class: 'pv' })));

    root.append(S.sub === 'month' ? monthView(cls) : S.sub === 'week' ? weekView(cls) : dayView(cls));
    setTimeout(preview, 0);
    return root;
  }

  /* ---------- 월별: 한눈에 보는 표 ---------- */
  function monthView(cls) {
    const frag = el('div', { class: 'mv' });
    const recs = monthRecs(cls);
    const by = {};
    recs.forEach((a) => { (by[a.studentId + '|' + a.date] = by[a.studentId + '|' + a.date] || []).push(a); });
    const dim = new Date(S.y, S.m + 1, 0).getDate();
    const todayS = ymd(new Date());
    const dsOf = (d) => `${S.y}-${pad(S.m + 1)}-${pad(d)}`;
    const head = el('tr', {}, el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '이름'));
    for (let d = 1; d <= dim; d++) {
      const ds = dsOf(d); const w = new Date(S.y, S.m, d).getDay();
      head.append(el('th', { class: 'd go' + (w === 0 || w === 6 ? ' we' : '') + (ds === todayS ? ' tdy' : '') + (ds === S.sel ? ' cur' : ''), 'data-d': ds, title: '일별 보기' }, el('div', {}, d), el('div', { class: 'dw' }, DOW[w])));
    }
    TYPES.forEach((t) => head.append(el('th', { class: 'sum t-' + t, title: t }, SHORT[t])));
    const tbody = el('tbody');
    cls.students.slice().sort((a, b) => a.no - b.no).forEach((s) => {
      const tr = el('tr', {}, el('td', { class: 'c1' }, s.no), el('td', { class: 'c2' }, s.name));
      for (let d = 1; d <= dim; d++) {
        const ds = dsOf(d); const w = new Date(S.y, S.m, d).getDay();
        const arr = by[s.id + '|' + ds];
        const td = el('td', { class: 'd go' + (w === 0 || w === 6 ? ' we' : '') + (ds === todayS ? ' tdy' : ''), 'data-d': ds });
        if (arr) {
          td.append(el('span', { class: 'mk t-' + arr[0].type, title: arr.map((a) => `${kindLabel(a)} ${P.rangeLabel(a.from, a.to)}${a.reason ? ' · ' + a.reason : ''}`).join('\n') }, arr.map((a) => SHORT[a.type]).join('')));
        }
        tr.append(td);
      }
      TYPES.forEach((t) => {
        const n = recs.filter((a) => a.studentId === s.id && a.type === t).length;
        tr.append(el('td', { class: 'sum' + (n ? ' has t-' + t : '') }, n || ''));
      });
      tbody.append(tr);
    });
    const tbl = el('table', { class: 'mt' }, el('thead', {}, head), tbody);
    tbl.addEventListener('click', (e) => {
      const c = e.target.closest('[data-d]');
      if (!c) return;
      setSel(c.dataset.d); setSub('day');
    });
    frag.append(el('div', { class: 'mwrap' }, tbl));
    const cnt = TYPES.map((t) => `${t} ${recs.filter((a) => a.type === t).length}`).join(' · ');
    const cc = CATS.map((c) => `${c} ${recs.filter((a) => a.cat === c).length}`).join(' · ');
    S.topSum = el('div', { class: 'msum', title: '날짜를 누르면 일별 보기로 이동' }, el('b', {}, `${S.m + 1}월`), ' ', cnt, el('span', { class: 'sep' }), cc);
    return frag;
  }


  /* ---------- 주별: 학생(행) × 월~금(열) — 언제, 어떤 종류로, 어떤 사유로 빠졌는지 한눈에 ---------- */
  function weekView(cls) {
    const sd = parseYmd(S.sel);
    const mon = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() - ((sd.getDay() + 6) % 7)); // 월요일 시작
    const days = Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    const keys = days.map(ymd);
    const todayS = ymd(new Date());
    const wrap = el('div', { class: 'wv' });
    const shiftW = (n) => { setSel(ymd(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + n * 7))); render(); };
    const fri = days[4];
    wrap.append(el('div', { class: 'dhead' },
      el('button', { class: 'ib', 'aria-label': '이전 주', onclick: () => shiftW(-1) }, icon('left')),
      el('b', { class: 'dttl wttl' }, `${mon.getMonth() + 1}월 ${mon.getDate()}일 ~ ${fri.getMonth() + 1}월 ${fri.getDate()}일`),
      el('button', { class: 'ib', 'aria-label': '다음 주', onclick: () => shiftW(1) }, icon('right')),
      el('button', { class: 'ghost sm tdbtn', onclick: () => { setSel(ymd(new Date())); render(); } }, '이번 주'),
      el('span', { class: 'grow' }),
      el('button', { class: 'ghost sm', onclick: () => { S.weekAll = !S.weekAll; ls.set('hagisiro:weekall', S.weekAll ? '1' : ''); render(); } }, S.weekAll ? '기록 있는 학생만' : '전체 학생')));

    const all = S.att.filter((a) => a.classId === cls.id && keys.includes(a.date));
    const by = {};
    all.forEach((a) => { (by[a.studentId + '|' + a.date] = by[a.studentId + '|' + a.date] || []).push(a); });
    const hasWE = [5, 6].map((i) => all.some((a) => a.date === keys[i])); // 기록이 있는 주말만 표시
    const cols = [0, 1, 2, 3, 4, 5, 6].filter((i) => i < 5 || hasWE[i - 5]);

    const head = el('tr', {}, el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '이름'),
      cols.map((i) => {
        const d = days[i];
        return el('th', { class: 'wcol go' + (keys[i] === todayS ? ' tdy' : '') + (i >= 5 ? ' we' : ''), 'data-d': keys[i], title: '일별 보기' },
          `${d.getMonth() + 1}/${d.getDate()}`, el('span', { class: 'dw' }, ` (${DOW[d.getDay()]})`));
      }),
      el('th', { class: 'sum' }, '계'));
    const tbody = el('tbody');
    const students = cls.students.slice().sort((a, b) => a.no - b.no)
      .filter((s) => S.weekAll || all.some((a) => a.studentId === s.id));
    students.forEach((s) => {
      const tr = el('tr', {}, el('td', { class: 'c1' }, s.no), el('td', { class: 'c2' }, s.name));
      let n = 0;
      cols.forEach((i) => {
        const arr = by[s.id + '|' + keys[i]] || [];
        n += arr.length;
        const td = el('td', { class: 'wc go' + (keys[i] === todayS ? ' tdy' : '') + (i >= 5 ? ' we' : ''), 'data-d': keys[i] });
        arr.forEach((a) => td.append(el('div', { class: 'wi' },
          el('div', { class: 'wkd c-' + a.cat }, kindLabel(a)),
          el('div', { class: 'wg' }, P.rangeLabel(a.from, a.to)),
          a.reason ? el('div', { class: 'wr2 mut' }, a.reason) : null)));
        tr.append(td);
      });
      tr.append(el('td', { class: 'sum' + (n ? ' has' : '') }, n || ''));
      tbody.append(tr);
    });
    const tbl = el('table', { class: 'mt wt' }, el('thead', {}, head), tbody);
    tbl.addEventListener('click', (e) => {
      const c = e.target.closest('[data-d]');
      if (c) { setSel(c.dataset.d); setSub('day'); }
    });
    if (!students.length) wrap.append(el('div', { class: 'empty mut' }, '이 주에는 출결 기록이 없어요 (전원 출석)'));
    else wrap.append(el('div', { class: 'mwrap' }, tbl));

    const cnt = TYPES.map((t) => [t, all.filter((a) => a.type === t).length]).filter((x) => x[1]).map((x) => `${x[0]} ${x[1]}`).join(' · ');
    S.topSum = el('div', { class: 'msum', title: '칸을 누르면 일별 보기로 이동 · ←→ 로 주 이동' }, cnt || '기록 없음');
    return wrap;
  }

  /* ---------- 일별: 조회 · 1~N교시 · 종례 에 빗금 ---------- */
  function dayView(cls) {
    const ds = S.sel;
    const d = parseYmd(ds);
    const last = lastOf(ds);
    const def = dayDefault(ds);
    const ovr = S.days.some((x) => x.id === ds);
    const wrap = el('div', { class: 'dv' });

    const shift = (n) => { setSel(ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))); render(); };
    const cntSel = el('select', { class: 'cnt' + (ovr ? ' ovr' : ''), 'aria-label': '이 날 교시 수', title: '이 날만 교시 수 바꾸기 (단축수업 등)', onchange: (e) => { setDayPeriods(ds, +e.target.value); render(); } },
      Array.from({ length: 11 }, (_, n) => el('option', { value: n, selected: n === last }, n ? `${n}교시` : '수업 없음')));
    wrap.append(el('div', { class: 'dhead' },
      el('button', { class: 'ib', 'aria-label': '이전 날', onclick: () => shift(-1) }, icon('left')),
      el('b', { class: 'dttl' }, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`),
      el('button', { class: 'ib', 'aria-label': '다음 날', onclick: () => shift(1) }, icon('right')),
      el('button', { class: 'ghost sm tdbtn', onclick: () => { const n = new Date(); setSel(ymd(n)); render(); } }, '오늘'),
      el('span', { class: 'grow' }),
      el('span', { class: 'mut small' }, ovr ? `기본 ${def ? def + '교시' : '수업 없음'} → 이 날만` : '이 날 교시 수'),
      cntSel,
      ovr ? el('button', { class: 'ghost sm', onclick: () => { setDayPeriods(ds, def); render(); } }, '기본값으로') : null));

    const recs = S.att.filter((a) => a.classId === cls.id && a.date === ds);
    const by = {}; recs.slice().sort((a, b) => (a.created || 0) - (b.created || 0)).forEach((a) => { (by[a.studentId] = by[a.studentId] || []).push(a); });

    const slotN = last + 2; // 조회 + 교시들 + 종례
    const head = el('tr', {},
      el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '성명'), el('th', { class: 'kc' }, '종류'), el('th', { class: 'rc' }, '교시 범위'),
      Array.from({ length: slotN }, (_, i) => el('th', { class: 'sl-h' }, i === 0 ? '조회' : i === slotN - 1 ? '종례' : `${i}교시`)),
      el('th', { class: 'rs-h' }, '사유'));
    const tbody = el('tbody');

    const rangeOpts = (cur) => [0, ...Array.from({ length: last }, (_, i) => i + 1), END].map((v) =>
      el('option', { value: v, selected: v === cur }, v === 0 ? '조회' : v === END ? '종례' : `${v}교시`));
    const disp = (x) => (x >= END ? END : Math.min(x, last));

    function addRow(s, rec, first) {
      const cells = [el('td', { class: 'c1' }, first ? s.no : ''), el('td', { class: 'c2' }, first ? s.name : '')];
      const ksel = el('select', { class: 'ksel' + (rec ? ' c-' + rec.cat : ''), 'aria-label': `${s.name} 출결 종류` },
        el('option', { class: 'o-ok', value: '출석' }, '출석'),
        CATS.map((c) => TYPES.map((t) => el('option', { class: 'c-' + c, value: c + t, selected: !!rec && rec.cat === c && rec.type === t }, c + t))));
      ksel.addEventListener('change', () => setKind(s, rec, ksel.value, ds, cls));
      cells.push(el('td', { class: 'kc' }, ksel));
      if (rec) {
        const f = el('select', { class: 'rsel', 'aria-label': '시작' }, rangeOpts(disp(rec.from)));
        const t = el('select', { class: 'rsel', 'aria-label': '끝' }, rangeOpts(disp(rec.to)));
        f.addEventListener('change', () => setRange(rec, 'from', +f.value));
        t.addEventListener('change', () => setRange(rec, 'to', +t.value));
        cells.push(el('td', { class: 'rc' }, f, el('span', { class: 'tilde' }, icon('tilde')), t));
        const a = resSlot(rec.from, last), b = resSlot(rec.to, last);
        for (let i = 0; i < slotN; i++) cells.push(el('td', { class: 'slc' + (i >= a && i <= b ? ' sl c-' + rec.cat : ''), title: i >= a && i <= b ? `${kindLabel(rec)}` : null }, i >= a && i <= b ? icon('slash') : ''));
        const rin = el('input', { type: 'text', class: 'rin', value: rec.reason || '', placeholder: '사유', 'aria-label': `${s.name} 사유`, spellcheck: 'false' });
        rin.addEventListener('change', () => Data.put('att', { ...rec, reason: rin.value.trim() }));
        rin.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) rin.blur(); });
        cells.push(el('td', { class: 'rs' }, el('div', { class: 'rsw' }, rin)));
      } else {
        cells.push(el('td', { class: 'rc' }));
        for (let i = 0; i < slotN; i++) cells.push(el('td', { class: 'slc' }));
        cells.push(el('td', { class: 'rs' }));
      }
      tbody.append(el('tr', { class: rec ? 'has' : '', 'data-sid': s.id }, cells));
    }

    cls.students.slice().sort((a, b) => a.no - b.no).forEach((s) => {
      const list = by[s.id] || []; // 하루 1건이 원칙 (예전 데이터에 2건이 있으면 그대로 보여줌)
      list.forEach((rec, i) => addRow(s, rec, i === 0));
      if (!list.length) addRow(s, null, true);
    });

    wrap.append(el('div', { class: 'mwrap' }, el('table', { class: 'mt dt' }, el('thead', {}, head), tbody)));
    const cnt = recs.length
      ? TYPES.map((t) => `${t} ${recs.filter((a) => a.type === t).length}`).join(' · ')
      : '이 날 기록 없음 (전원 출석)';
    S.topSum = el('div', { class: 'msum' }, cnt);
    if (last === 0) wrap.append(el('div', { class: 'mut small' }, '수업이 없는 요일로 설정돼 있어요. 위에서 교시 수를 바꾸거나 “교시 설정”에서 기본값을 바꿔요'));
    return wrap;
  }

  function setKind(s, rec, label, ds, cls) {
    const k = KINDS.find((x) => x.label === label);
    if (!k) { // '출석' = 기록 없음
      if (rec) { Data.del('att', rec.id); toast('출석으로 바꿨어요', () => { Data.put('att', rec); render(); }); }
      render(); return;
    }
    if (rec) {
      const r = { ...rec, cat: k.cat, type: k.type };
      if (k.type !== rec.type) { const [f, t] = P.defaultRange(k.type, null, null, lastOf(ds)); r.from = f; r.to = t; }
      Data.put('att', r);
    } else {
      const [f, t] = P.defaultRange(k.type, null, null, lastOf(ds));
      Data.put('att', { id: uid(), classId: cls.id, studentId: s.id, name: s.name, no: s.no, date: ds, type: k.type, cat: k.cat, from: f, to: t, reason: '', created: Date.now() });
    }
    render();
  }
  function setRange(rec, which, v) {
    let f = rec.from, t = rec.to;
    if (which === 'from') { f = v; if (f > t) t = f; } else { t = v; if (f > t) f = t; }
    Data.put('att', { ...rec, from: f, to: t });
    render();
  }

  /* ---------- 문장 입력 ---------- */
  const chipText = (it) => `${it.no} ${it.name} · ${md(it.date)} · ${it.cat}${it.type} ${P.rangeLabel(it.from, it.to)}${it.reason ? ' · ' + it.reason : ''}`;

  function preview() {
    const q = $('#q'), pv = $('#pv');
    if (!q || !pv) return;
    const v = q.value.trim();
    pv.replaceChildren(); pv.className = 'pv';
    if (!v) {
      pv.append(el('span', { class: 'mut' }, '이름, 날짜, 종류, 교시, 사유를 입력하세요. 예) 홍길동 12일 감기로 2교시 후 조퇴'));
      return;
    }
    const r = runParse(v);
    if (r.errors.length) {
      pv.classList.add('err');
      pv.append(r.errors.includes('student') ? '학생 이름을 입력해주세요.' : '출결 종류(결석/지각/조퇴/결과)를 입력해주세요.');
      return;
    }
    r.items.slice(0, 5).forEach((it) => pv.append(el('span', { class: 'chip t-' + it.type }, chipText(it))));
    if (r.items.length > 5) pv.append(el('span', { class: 'mut' }, `외 ${r.items.length - 5}건`));
    if (r.dateGuessed) pv.append(el('span', { class: 'mut' }, `· 날짜 없음 → ${md(S.sel)}`));
  }

  function submitQuick() {
    const q = $('#q');
    if (!q) return;
    const v = q.value.trim();
    if (!v) return;
    const r = runParse(v);
    if (r.errors.length) {
      preview(); q.classList.add('shake'); setTimeout(() => q.classList.remove('shake'), 350);
      return;
    }
    const created = [], replaced = [];
    for (const it of r.items) {
      const dup = S.att.find((a) => a.studentId === it.studentId && a.date === it.date); // 하루 1건: 같은 학생·같은 날이면 덮어씀
      if (dup) { if (!created.some((c) => c.id === dup.id)) replaced.push(dup); Data.put('att', { ...dup, ...it, id: dup.id }); }
      else { const rec = { ...it, id: uid(), created: Date.now() }; created.push(rec); Data.put('att', rec); }
    }
    q.value = '';
    S.sub = 'day'; ls.set('hagisiro:sub', 'day');
    setSel(r.items[0].date); // 입력한 날짜의 일별 보기로 이동
    toast('저장됨 · ' + (r.items.length === 1 ? chipText(r.items[0]) : `${r.items.length}건`), () => {
      created.forEach((c) => Data.del('att', c.id));
      replaced.forEach((o) => Data.put('att', o));
      render();
    });
    render();
    const nq = $('#q'); if (nq) nq.focus();
  }

  function exportCsv(cls) {
    const rows = [['날짜', '요일', '번호', '이름', '종류', '사유구분', '구분', '교시범위', '사유']];
    monthRecs(cls).sort((a, b) => a.date.localeCompare(b.date) || (a.no || 0) - (b.no || 0)).forEach((a) => {
      const st = cls.students.find((x) => x.id === a.studentId);
      rows.push([a.date, DOW[parseYmd(a.date).getDay()], st ? st.no : a.no, st ? st.name : a.name, kindLabel(a), a.cat, a.type, P.rangeLabel(a.from, a.to), a.reason || '']);
    });
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(`${cls.name}_${S.y}-${pad(S.m + 1)}_출결.csv`, csv, 'text/csv;charset=utf-8');
  }

  /* ---------- 연락처 · 일과 시간표 · 내 시간표 (엑셀/이미지/직접 입력) ---------- */
  const DOCS = [['contacts', '연락처', 'phone'], ['schedule', '일과 진행 시간표', 'clock'], ['mytable', '내 시간표', 'table']];
  const docOf = (id) => S.docs.find((d) => d.id === id);
  const PHONE = /(0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4})/g;
  function linkify(txt) {
    const out = []; let last = 0, m;
    PHONE.lastIndex = 0;
    while ((m = PHONE.exec(txt))) {
      if (m.index > last) out.push(txt.slice(last, m.index));
      out.push(el('a', { class: 'tel', href: 'tel:' + m[0].replace(/\D/g, '') }, m[0]));
      last = m.index + m[0].length;
    }
    if (last < txt.length) out.push(txt.slice(last));
    return out;
  }
  const parseTsv = (t) => t.replace(/\r/g, '').split('\n').map((l) => l.split('\t'));
  function docView(d) {
    if (d.kind === 'image') return el('div', { class: 'dimg' }, el('img', { src: d.img, alt: '' }));
    const text = d.text || '';
    if (text.includes('\t')) {
      const rows = parseTsv(text).filter((r) => r.some((c) => c.trim()));
      const w = Math.max(...rows.map((r) => r.length));
      const cell = (tag, c) => el(tag, {}, linkify(c.trim()));
      return el('div', { class: 'dtw' }, el('table', { class: 'dt2' },
        el('thead', {}, el('tr', {}, Array.from({ length: w }, (_, i) => cell('th', rows[0][i] || '')))),
        el('tbody', {}, rows.slice(1).map((r) => el('tr', {}, Array.from({ length: w }, (_, i) => cell('td', r[i] || '')))))));
    }
    return el('div', { class: 'dtxt' }, text.split('\n').map((l) => el('div', {}, linkify(l) , l ? null : el('br'))));
  }
  let sheetJs = null;
  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!sheetJs) sheetJs = new Promise((res, rej) => {
      document.head.append(el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
        onload: () => res(window.XLSX), onerror: () => { sheetJs = null; rej(new Error('엑셀 변환 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 내용을 복사해 붙여넣어 주세요')); } }));
    });
    return sheetJs;
  }
  const decodeText = (buf) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('euc-kr').decode(buf); } };
  async function fileToDraft(f) {
    const buf = await f.arrayBuffer();
    if (/^image\//.test(f.type)) return { kind: 'image', img: await compressImage(f) };
    if (/\.(csv|tsv|txt)$/i.test(f.name)) {
      let t = decodeText(buf).replace(/^\uFEFF/, '');
      if (/\.csv$/i.test(f.name)) t = t.replace(/\r/g, '').split('\n').map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '')).join('\t')).join('\n');
      return { kind: 'text', text: t };
    }
    if (/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
      const X = await loadSheetJS();
      const wb = X.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      const clean = rows.map((r) => r.map((c) => String(c).replace(/[\t\r\n]+/g, ' ').trim()));
      while (clean.length && clean[clean.length - 1].every((c) => !c)) clean.pop();
      let w = 0; clean.forEach((r) => { for (let i = r.length - 1; i >= 0; i--) if (r[i]) { w = Math.max(w, i + 1); break; } });
      const t = clean.map((r) => r.slice(0, w).join('\t')).join('\n');
      if (wb.SheetNames.length > 1) toast('첫 번째 시트만 가져왔어요');
      return { kind: 'text', text: t };
    }
    throw new Error('엑셀(.xlsx/.xls/.csv)이나 이미지 파일만 올릴 수 있어요');
  }
  function compressImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => {
        let max = 1600, q = 0.82, out = '';
        for (let i = 0; i < 8; i++) {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 700000) break;
          max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.06);
        }
        URL.revokeObjectURL(url);
        if (out.length >= 900000) rej(new Error('이미지가 너무 커요. 더 작은 이미지로 올려 주세요')); else res(out);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 열 수 없어요')); };
      im.src = url;
    });
  }
  function openDoc(id, forceEdit) {
    const meta = DOCS.find((x) => x[0] === id);
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); render(); };
    let cur = docOf(id);
    let draft = cur ? { kind: cur.kind, text: cur.text || '', img: cur.img || '' } : { kind: 'text', text: '' };
    let edit = !!forceEdit || !cur;
    const head = (...extra) => el('div', { class: 'shead' }, el('b', {}, meta[1]), el('span', { class: 'grow' }), ...extra, el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close')));
    function drawView() {
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg docdlg' }, head(),
          el('div', { class: 'dbody' }, docView(cur)),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }),
            el('button', { class: 'ghost', onclick: () => { edit = true; draft = { kind: cur.kind, text: cur.text || '', img: cur.img || '' }; drawEdit(); } }, icon('edit'), '수정'),
            el('button', { class: 'pri', onclick: close }, '닫기'))));
    }
    function drawEdit() {
      const file = el('input', { type: 'file', hidden: true, accept: '.xlsx,.xls,.xlsm,.csv,.tsv,.txt,image/*', onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { draft = await fileToDraft(f); drawEdit(); } catch (er) { toast(er.message || '파일을 읽지 못했어요'); }
      } });
      const ta = el('textarea', { class: 'dta', placeholder: '여기에 직접 입력하거나, 엑셀에서 복사해 붙여넣으세요.\n(탭으로 구분된 내용은 표로 보여줘요)', spellcheck: 'false' });
      ta.value = draft.text || '';
      ta.addEventListener('input', () => { draft.text = ta.value; });
      const body = draft.kind === 'image'
        ? el('div', { class: 'dbody' }, el('div', { class: 'dimg' }, el('img', { src: draft.img, alt: '' })))
        : ta;
      const save = () => {
        if (draft.kind === 'text' && !draft.text.trim()) { if (cur) Data.del('docs', id); close(); return; }
        if (draft.kind === 'text' && draft.text.length > 300000) { toast('내용이 너무 길어요'); return; }
        const o = draft.kind === 'image' ? { id, kind: 'image', img: draft.img, updated: Date.now() } : { id, kind: 'text', text: draft.text, updated: Date.now() };
        Data.put('docs', o); close();
      };
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg docdlg' }, head(),
          el('div', { class: 'dsrc' },
            el('button', { class: 'ghost sm', type: 'button', onclick: () => file.click() }, icon('upload'), '엑셀·이미지 올리기'), file,
            draft.kind === 'image' ? el('button', { class: 'ghost sm', type: 'button', onclick: () => { draft = { kind: 'text', text: '' }; drawEdit(); } }, '글자로 입력') : null,
            el('span', { class: 'mut dhint' }, draft.kind === 'image' ? '이미지가 그대로 보여요' : '또는 아래에 직접 입력')),
          body,
          el('div', { class: 'dlgf' },
            cur ? el('button', { class: 'ghost sm danger', onclick: () => { if (confirm(meta[1] + ' 내용을 지울까요?')) { Data.del('docs', id); close(); } } }, icon('trash'), '지우기') : null,
            el('span', { class: 'grow' }),
            el('button', { class: 'ghost', onclick: () => { if (cur) { edit = false; drawView(); } else close(); } }, '취소'),
            el('button', { class: 'pri', onclick: save }, '저장'))));
      if (draft.kind === 'text') ta.focus();
    }
    if (edit) drawEdit(); else drawView();
  }

  /* ---------- 화면 설정 ---------- */
  function openPrefs() {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const seg = (key, opts, after) => el('div', { class: 'seg' }, opts.map(([v, label]) =>
      el('button', { type: 'button', class: PF[key] === v ? 'on' : '', onclick: () => { PF[key] = v; commit(after); } }, label)));
    const sel = (key, vals, fmt, after) => el('select', { onchange: (e) => { PF[key] = +e.target.value; commit(after); } },
      vals.map((v) => el('option', { value: v, selected: PF[key] === v }, fmt(v))));
    const tog = (key, label, hint, after, off) => el('label', { class: 'pfr tg' + (off ? ' off' : '') },
      el('input', { type: 'checkbox', checked: !!PF[key] && !off, disabled: !!off, onchange: (e) => { PF[key] = e.target.checked; commit(after); } }),
      el('span', {}, label, hint ? el('small', {}, hint) : null));
    const row = (label, ...c) => el('div', { class: 'pfr' }, el('span', { class: 'pl' }, label), el('div', { class: 'pc2' }, c));
    function commit(after) {
      savePf();
      if (after === 'range') watchRange();
      if (after === 'ghol') {
        if (PF.ghol && S.cloud && !gtoken()) connectGcal(!gcalWanted()); else loadGhol();
      }
      render(); draw();
    }
    function draw() {
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg pfdlg' },
          el('div', { class: 'shead' }, el('b', {}, '화면 설정'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
          el('div', { class: 'pfs' }, '캘린더'),
          row('보기 방식', seg('cal', [['month', '월별'], ['week', '이번 주 기준']], 'range')),
          row('전체 주 개수', sel('weeks', [1, 2, 3, 4, 5, 6], (n) => n + '주', 'range')),
          row('지나간 주 개수', sel('past', Array.from({ length: Math.min(5, PF.weeks - 1) + 1 }, (_, i) => i), (n) => n + '주', 'range')),
          el('div', { class: 'pfh' }, '이번 주 기준 보기에서만 쓰여요. 지나간 주는 전체 주보다 적게 정할 수 있어요.'),
          tog('lunar', '음력 날짜 표시'),
          tog('terms', '24절기 표시'),
          tog('hol', '공휴일 표시 (대한민국)', '설날·추석·대체공휴일까지 자동 계산'),
          tog('ghol', '구글 캘린더 공휴일 연동', S.cloud ? '임시공휴일 등을 구글에서 가져와요' : 'Google 로그인 후 사용할 수 있어요', 'ghol', !S.cloud),
          el('div', { class: 'pfs' }, '할 일'),
          tog('sortDone', '완료한 할 일은 맨 아래로'),
          el('div', { class: 'pfs' }, '화면'),
          row('테마', seg('theme', [['auto', '자동'], ['light', '낮'], ['dark', '밤']])),
          row('위젯 투명도', el('input', {
            type: 'range', min: 30, max: 100, step: 5, value: PF.opacity, 'aria-label': '위젯 투명도',
            oninput: (e) => { PF.opacity = +e.target.value; savePf(); const o = m.querySelector('.opv'); if (o) o.textContent = PF.opacity + '%'; },
          }), el('b', { class: 'opv' }, PF.opacity + '%')),
          el('div', { class: 'pfh' }, '바탕화면 위젯 모드에서만 적용돼요.'),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'pri', onclick: close }, '닫기'))));
    }
    draw();
  }

  /* ---------- 설정: 요일별 기본 교시 수 ---------- */
  function openSettings() {
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const cur = cfgPeriods();
    const order = [1, 2, 3, 4, 5, 6, 0]; // 월~일
    const sels = {};
    const grid = el('div', { class: 'pgrid' }, order.map((w) => {
      const s = el('select', { 'aria-label': DOW[w] + '요일 교시 수' },
        Array.from({ length: 11 }, (_, n) => el('option', { value: n, selected: n === cur[w] }, n ? `${n}교시` : '수업 없음')));
      sels[w] = s;
      return el('label', { class: 'pc' + (w === 0 || w === 6 ? ' we' : '') }, el('span', {}, DOW[w]), s);
    }));
    const keep = el('input', { type: 'checkbox', id: 'keepOvr' });
    const save = async () => {
      const periods = [0, 1, 2, 3, 4, 5, 6].map((w) => +sels[w].value);
      Data.put('settings', { id: 'main', periods });
      close();
      if (!keep.checked) { // 날짜별로 따로 정한 교시 수를 모두 지우고 요일별 기본값으로 통일
        let removed = [];
        try {
          if (S.cloud) { removed = await S.cloud.clearAll('days'); S.days = []; }
          else { removed = S.days.slice(); S.days = []; Data.saveLocal(); }
        } catch (e) { cloudErr(e); }
        if (removed.length) toast(`날짜별 개별 설정 ${removed.length}일을 지우고 기본값으로 통일했어요`, () => { removed.forEach((x) => Data.put('days', x)); render(); });
      }
      render();
    };
    m.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' },
        el('div', { class: 'shead' }, el('b', {}, '요일별 교시 수'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        grid,
        el('label', { class: 'keepbox' }, keep, el('span', {}, '개별 설정한 날은 제외하고 덮어쓰기')),
        el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'ghost', onclick: close }, '취소'), el('button', { class: 'pri', onclick: save }, '저장'))));
  }

  /* ---------- 명단 편집 ---------- */
  function openRoster(cid) {
    const c = cid && S.classes.find((x) => x.id === cid);
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const name = el('input', { type: 'text', placeholder: '학급 이름 (예: 2학년 3반)', value: c ? c.name : '', 'aria-label': '학급 이름' });
    const ta = el('textarea', { rows: '14', spellcheck: 'false', placeholder: '번호 이름 — 한 줄에 한 명\n1 강민준\n2 김서연\n\n엑셀에서 번호·이름 칸을 복사해 붙여넣어도 돼요', 'aria-label': '명단' });
    ta.value = c ? c.students.slice().sort((a, b) => a.no - b.no).map((s) => `${s.no} ${s.name}`).join('\n') : '';

    function save() {
      const list = [];
      let auto = 0;
      ta.value.split(/\r?\n/).forEach((line) => {
        const tk = line.trim().split(/[\s,\t]+/).filter(Boolean);
        if (!tk.length) return;
        let no, nm;
        if (/^\d+$/.test(tk[0])) { if (!tk[1]) return; no = +tk[0]; nm = tk[1]; } else { nm = tk[0]; no = auto + 1; }
        auto = no;
        list.push({ no, name: nm });
      });
      if (!list.length) { ta.focus(); return; }
      const old = c ? c.students : [];
      const used = new Set();
      list.forEach((s) => { const o = old.find((x) => !used.has(x.id) && x.name === s.name); if (o) { s.id = o.id; used.add(o.id); } });
      list.forEach((s) => { if (!s.id) { const o = old.find((x) => !used.has(x.id) && +x.no === s.no); if (o) { s.id = o.id; used.add(o.id); } } });
      list.forEach((s) => { if (!s.id) s.id = uid(); });
      const id = c ? c.id : uid();
      Data.put('classes', { id, name: name.value.trim() || '학급', students: list, ord: c ? c.ord : Date.now(), created: c ? c.created : Date.now() });
      S.clsId = id; ls.set('hagisiro:cls', id);
      close(); render();
    }
    function remove() {
      if (!confirm('이 학급을 삭제할까요? (출결 기록은 남아 있어요)')) return;
      Data.del('classes', c.id); S.clsId = null; close(); render();
    }
    m.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' },
        el('div', { class: 'shead' }, el('b', {}, c ? '학급 수정' : '학급 추가'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        name, ta,
        el('div', { class: 'dlgf' },
          c ? el('button', { class: 'ghost sm danger', onclick: remove }, '학급 삭제') : null,
          el('span', { class: 'grow' }),
          el('button', { class: 'ghost', onclick: close }, '취소'),
          el('button', { class: 'pri', onclick: save }, '저장'))));
    (c ? ta : name).focus();
  }

  /* ================= 구글 캘린더 (선택, 읽기 전용) ================= */
  const GK = 'hagisiro:gtok';
  function gtoken() {
    try { const o = JSON.parse(sessionStorage.getItem(GK) || 'null'); if (o && o.exp > Date.now()) return o.t; } catch (e) { /* noop */ }
    return null;
  }
  const gcalWanted = () => !!S.cloud && ls.get('hagisiro:gcal') === '1';
  async function connectGcal(holOnly) {
    try {
      const t = await S.cloud.calendarToken();
      if (!t) throw new Error('토큰을 받지 못했어요');
      try { sessionStorage.setItem(GK, JSON.stringify({ t, exp: Date.now() + 50 * 60e3 })); } catch (e) { /* noop */ }
      if (!holOnly) ls.set('hagisiro:gcal', '1');
      await Promise.all([loadGcal(), loadGhol()]);
      render();
      toast(holOnly ? '구글 공휴일을 연결했어요' : '구글 캘린더 일정을 함께 표시해요');
    } catch (e) { toast('연동 실패: ' + ((e && (e.code || e.message)) || '')); }
  }
  async function loadGcal() {
    if (!gcalWanted()) return;
    const tok = gtoken();
    if (!tok) { S.gcal = {}; render(); return; }
    const r = range();
    const end = parseYmd(r.to); end.setDate(end.getDate() + 1);
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
      timeMin: r.start.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
    });
    try {
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
      if (res.status === 401 || res.status === 403) {
        try { sessionStorage.removeItem(GK); } catch (e) { /* noop */ }
        S.gcal = {}; render();
        if (res.status === 403) toast('구글 캘린더 API가 꺼져 있거나 권한이 없어요 (README 참고)');
        return;
      }
      const j = await res.json();
      const g = {};
      (j.items || []).forEach((ev) => {
        if (ev.status === 'cancelled' || !ev.start) return;
        const s = ev.summary || '(제목 없음)';
        if (ev.start.date) {
          let d = parseYmd(ev.start.date); const e2 = parseYmd(ev.end.date);
          for (let i = 0; d < e2 && i < 31; i++) { (g[ymd(d)] = g[ymd(d)] || []).push({ s }); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
        } else {
          const ds = ev.start.dateTime.slice(0, 10);
          (g[ds] = g[ds] || []).push({ s, t: ev.start.dateTime.slice(11, 16) });
        }
      });
      S.gcal = g; render();
    } catch (e) { console.error(e); }
  }

  /* 구글 '대한민국의 휴일' 캘린더 (임시공휴일 등 반영) */
  let gholWarned = false;
  async function loadGhol() {
    if (!PF.ghol || !S.cloud) { if (Object.keys(S.ghol).length) { S.ghol = {}; render(); } return; }
    const tok = gtoken();
    if (!tok) return;
    const r = range();
    const end = parseYmd(r.to); end.setDate(end.getDate() + 1);
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com') + '/events?' +
      new URLSearchParams({ timeMin: r.start.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', maxResults: '100' });
    try {
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
      if (!res.ok) {
        if (!gholWarned) { gholWarned = true; toast('구글 공휴일을 불러오지 못했어요 (내장 공휴일만 표시)'); }
        return;
      }
      const j = await res.json(); const g = {};
      (j.items || []).forEach((ev) => {
        if (ev.status === 'cancelled' || !ev.start || !ev.start.date) return;
        let d = parseYmd(ev.start.date); const e2 = parseYmd(ev.end.date);
        for (let i = 0; d < e2 && i < 10; i++) { g[ymd(d)] = ev.summary || '공휴일'; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
      });
      S.ghol = g; render();
    } catch (e) { console.error(e); }
  }

  /* ================= 토스트 / 키보드 ================= */
  let toastT;
  function toast(msg, undo) {
    const t = $('#toast');
    t.hidden = false;
    t.replaceChildren(el('span', {}, msg), undo ? el('button', { onclick: () => { undo(); t.hidden = true; } }, '되돌리기') : null);
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, undo ? 7000 : 3500);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearPicked();
    if (S.editing || !$('#modal').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (S.view === 'cal' || S.sub === 'month') {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    } else if (S.view === 'att' && (S.sub === 'day' || S.sub === 'week')) {
      const d = parseYmd(S.sel);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const step = S.sub === 'week' ? 7 : 1;
        setSel(ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (e.key === 'ArrowLeft' ? -step : step)))); render();
      }
    }
  });

  window.__haru = { S, Data, render, toast, lastOf }; // 디버깅용
  boot();
})();
