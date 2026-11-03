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
  const isMobile = () => !/[?&]widget/.test(location.search) && !!(window.matchMedia && window.matchMedia('(max-width:700px)').matches);
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
    phone: '<path d="M6.6 3.2h3l2 5-1.2.9a9 9 0 003.1 3.1l.9-1.2 5 2v3.2a2.6 2.6 0 01-2.8 2.6A18 18 0 013.3 6a2.6 2.6 0 013.3-2.8z"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="3.2"/><path d="M4 10.5h16M10 10.5V19"/>',
    upload: '<path d="M12 14.5v-10M7.5 8.5l4.5-4.5 4.5 4.5M5.5 19.5h13"/>',
    edit: '<path d="M5.5 18.5l.9-3.6L15 6.3a2 2 0 012.8 2.8l-8.6 8.6-3.7.8z"/>',
    scan: '<path d="M5 8.5V6.5a1.5 1.5 0 011.5-1.5h2M15.5 5h2A1.5 1.5 0 0119 6.5v2M19 15.5v2a1.5 1.5 0 01-1.5 1.5h-2M8.5 19h-2A1.5 1.5 0 015 17.5v-2M5 12h14"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.9 11.5a1 1 0 001 .9h6.2a1 1 0 001-.9L17 7"/>',
    clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3.2 2"/>',
    enter: '<path d="M19.5 5.5v7a3 3 0 01-3 3H5.5"/><path d="M10 10.5l-4.5 5 4.5 5"/>',
    palette: '<path d="M12 3.8a8.2 8.2 0 100 16.4c1.5 0 2.2-1 2.2-2 0-1.5-1.1-1.9-1.1-3 0-1 .8-1.8 1.9-1.8H17a3.3 3.3 0 003.3-3.3c0-3.8-3.7-6.3-8.3-6.3z"/><circle cx="7.7" cy="11.9" r="1.75" class="f"/><circle cx="10.5" cy="7.7" r="1.75" class="f"/><circle cx="14.9" cy="8.3" r="1.75" class="f"/>',
    repeat: '<path d="M16.5 3.5l3.2 3.2-3.2 3.2"/><path d="M4.3 12v-1.3a4 4 0 014-4h11.4"/><path d="M7.5 20.5l-3.2-3.2 3.2-3.2"/><path d="M19.7 12v1.3a4 4 0 01-4 4H4.3"/>',
    dot: '<circle cx="12" cy="12" r="4.2" class="f"/>',
    slash: '<path d="M8 19.5l8-15"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    refresh: '<path d="M15.75 18.5A7.5 7.5 0 1115.75 5.5"/><path d="M14.3 1.4l1.45 4.1-4.4.8"/>',
    menu: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2.4"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
    move: '<path d="M12 3.5v17M3.5 12h17M12 3.5l-2.8 2.8M12 3.5l2.8 2.8M12 20.5l-2.8-2.8M12 20.5l2.8-2.8M3.5 12l2.8-2.8M3.5 12l2.8 2.8M20.5 12l-2.8-2.8M20.5 12l-2.8 2.8"/>',
    tilde: '<path d="M3.5 12.5c2.2-3.4 4.3-3.4 8.5 0s6.3 3.4 8.5 0"/>',
  };
  function icon(name) {
    const s = el('span', { class: 'ic' });
    s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
    return s;
  }
  const LOGO = '<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="lg-g" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop offset="0" stop-color="#7c4dff"/><stop offset=".5" stop-color="#2f6df6"/><stop offset="1" stop-color="#12c9b3"/></linearGradient></defs><rect x="34" y="0" width="30" height="30" rx="9" fill="url(#lg-g)" opacity="0.62"/><rect x="0" y="34" width="30" height="30" rx="9" fill="url(#lg-g)" opacity="0.62"/><rect x="0" y="0" width="30" height="30" rx="9" fill="url(#lg-g)"/><rect x="34" y="34" width="30" height="30" rx="9" fill="url(#lg-g)"/><path d="M8.7 6.5v17M21.3 6.5v17M8.7 15h12.6" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/><path d="M40 49.5l6.4 6.6 12-14.2" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
    anchor: ymd(now), ghol: {}, meal: {},
  };

  /* 화면 설정 (이 기기에만 저장) */
  const PFK = 'hagisiro:pf';
  const IS_WIDGET = /[?&]widget/.test(location.search);
  const PF = Object.assign({ cal: IS_WIDGET ? 'week' : 'month', weeks: IS_WIDGET ? 3 : 4, past: 1, lunar: false, terms: false, hol: true, ghol: false, theme: 'auto', opacity: 90, sortDone: false, meal: false, school: null, neisKey: '', anim: true, mgap: false },
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
    h.classList.toggle('noanim', PF.anim === false);
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
    toast(code === 'permission-denied' ? '저장 권한 오류' : '저장 오류: ' + (code || (e && e.message)));
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
    loadGcal(); loadGhol(); loadMeal();
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
    ask(`이 기기에 저장돼 있던 데이터(${n}건)를 내 계정으로 옮길까요?`, '옮기기', false).then((yes) => {
      if (!yes) return;
      COLS.forEach((c) => (d[c] || []).forEach((x) => S.cloud.save(c, x).catch(cloudErr)));
      toast('내 계정으로 옮겼어요');
    });
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
        toast('연결 실패 · 이 기기에만 저장');
      }
    }
    S.ready = true; enterLocal();
  }
  const needLogin = () => S.ready && S.cloudAvail && !S.user && !S.guest;

  /* ================= 전환 애니메이션 =================
   * 화면 종류(캘린더/출결, 일·주·월, 월별/이번 주)가 바뀌면 살짝 페이드, 같은 화면에서 달·주·날을 넘기면 방향대로 밀려 들어와요.
   * 데이터가 들어와서 다시 그릴 땐 움직이지 않아요. (시스템의 '애니메이션 줄이기' 설정을 따라가요) */
  const dayNum = (ds) => Math.floor(parseYmd(ds).getTime() / 864e5);
  const viewKey = () => `${S.view}|${S.view === 'att' ? S.sub : PF.cal}`;
  function scopeNum() {
    if (S.view === 'consult') return 0;
    if (S.view === 'cal') return PF.cal === 'week' ? dayNum(S.anchor) : S.y * 12 + S.m;
    if (S.sub === 'month') return S.y * 12 + S.m;
    if (S.sub === 'week') return dayNum(S.sel) - parseYmd(S.sel).getDay();
    return dayNum(S.sel);
  }
  function animateMain(main) {
    const k = viewKey(), sc = scopeNum();
    const c = main.firstElementChild;
    if (S.lastKey != null && c && !needLogin()) {
      if (k !== S.lastKey) c.classList.add('vin');
      else if (sc !== S.lastSc) c.classList.add(sc > S.lastSc ? 'vnext' : 'vprev');
    }
    S.lastKey = k; S.lastSc = sc;
  }
  /* 토글(탭·분할 버튼)을 바꾸면 켜진 칸이 이전 자리에서 미끄러져 와요 */
  const pillPos = {};
  function slidePills() {
    if (document.documentElement.classList.contains('noanim')) return;
    const seen = {};
    document.querySelectorAll('.tabs, .seg').forEach((box, i) => {
      const on = box.querySelector(':scope > .on');
      if (!on) return;
      const key = (box.classList.contains('tabs') ? 't' : 's') + (box.closest('#modal') ? 'm' : box.closest('#top') ? 'top' : 'main') + i;
      const b = box.getBoundingClientRect(), r = on.getBoundingClientRect();
      const x = r.left - b.left;
      const prev = pillPos[key];
      const opt = { duration: 240, easing: 'cubic-bezier(.3,1.25,.4,1)' };
      if (prev && on !== prev.node && on.animate) {
        const run = prev.run && performance.now() - prev.run.t0 < 240 && Math.abs(prev.run.to - x) < 2 ? prev.run : null; // 같은 이동 중에 화면이 한 번 더 그려진 경우: 이어서 재생
        if (run) {
          const an = on.animate([{ transform: `translateX(${run.from - x}px)` }, { transform: 'none' }], opt);
          an.currentTime = performance.now() - run.t0;
          seen[key] = { x, w: b.width, node: on, run };
          return;
        }
        if (Math.abs(prev.x - x) > 2 && Math.abs(prev.w - b.width) < 14) {
          on.animate([{ transform: `translateX(${prev.x - x}px)` }, { transform: 'none' }], opt);
          seen[key] = { x, w: b.width, node: on, run: { from: prev.x, to: x, t0: performance.now() } };
          return;
        }
      }
      seen[key] = { x, w: b.width, node: on };
    });
    Object.keys(pillPos).forEach((k) => delete pillPos[k]);
    Object.assign(pillPos, seen);
  }
  let pillRaf = 0;
  new MutationObserver(() => { cancelAnimationFrame(pillRaf); pillRaf = requestAnimationFrame(slidePills); })
    .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  /* 팝업·메뉴·알림이 나타날 때만 효과를 줘요 (안의 내용만 다시 그릴 땐 그대로) */
  ['modal', 'toast', 'sheet'].forEach((id) => {
    const n = document.getElementById(id);
    if (!n) return;
    new MutationObserver(() => {
      if (n.hidden) return;
      n.classList.remove('opening'); void n.offsetWidth; n.classList.add('opening');
    }).observe(n, { attributes: true, attributeFilter: ['hidden'] });
  });

  /* 팝업이 닫힐 때도 부드럽게: hidden=true 를 잠깐 미뤄서 사라지는 효과를 먼저 보여줘요 */
  ['modal', 'sheet'].forEach((id) => {
    const n = document.getElementById(id);
    if (!n) return;
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
    const rc = n.replaceChildren.bind(n);
    let logical = n.hidden, timer = null;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; n.classList.remove('closing'); } };
    Object.defineProperty(n, 'hidden', {
      get() { return logical; },
      set(v) {
        v = !!v;
        if (!v) { cancel(); logical = false; desc.set.call(n, false); return; }
        if (logical) return;
        logical = true;
        if (document.documentElement.classList.contains('noanim')) { desc.set.call(n, true); return; }
        n.classList.add('closing');
        timer = setTimeout(() => { timer = null; n.classList.remove('closing'); if (logical) { desc.set.call(n, true); rc(); } }, 150);
      },
    });
    n.replaceChildren = (...k) => { if (timer && !k.length) return; if (k.length) cancel(); rc(...k); };
  });

  /* 윈도우 기본 팝업 대신 앱 안의 확인창 */
  function ask(msg, ok = '삭제', danger = true) {
    return new Promise((res) => {
      const done = (v) => { w.remove(); document.removeEventListener('keydown', key, true); res(v); };
      const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.stopPropagation(); done(true); } };
      const w = el('div', { class: 'askw' }, el('div', { class: 'back', onclick: () => done(false) }),
        el('div', { class: 'dlg askd', role: 'alertdialog' },
          el('div', { class: 'askm' }, String(msg).split('\n').map((l) => el('div', {}, l))),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'ghost', type: 'button', onclick: () => done(false) }, '취소'),
            el('button', { class: danger ? 'pri danger' : 'pri', type: 'button', onclick: () => done(true) }, ok))));
      document.addEventListener('keydown', key, true);
      document.body.append(w);
      w.querySelector('.pri').focus();
    });
  }

  /* ================= 렌더 ================= */
  function render() {
    if (S.editing) return; // 편집 중엔 화면을 갈아엎지 않음 (끝나면 다시 그림)
    { const ae = document.activeElement; if (S.view === 'consult' && ae && ae.closest && ae.closest('.cv') && ae.matches('input,select')) return; }
    if (S.view === 'consult' && S.cvHost && $('#main').firstElementChild === S.cvHost && S.ready && !needLogin()) { renderTop(); return; } // 상담표 작업 중엔 다른 데이터 갱신으로 화면을 다시 그리지 않아요
    if (S.cleanup) { S.cleanup(); S.cleanup = null; }
    S.cvHost = null;
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
    else main.append(S.view === 'att' ? attView() : S.view === 'consult' ? consultView() : calView());
    animateMain(main);
    if (S.topSum && S.view === 'att') { // 통계는 날짜 줄(일별·주별) 또는 월별 화면 맨 위에 둠 — 맨 윗줄은 항상 고정
      const nx = S.sub === 'month' ? null : $('#main .dhead .dttl + .ib');
      const mh = $('#main .mhead');
      if (nx) nx.after(S.topSum); else if (mh) mh.append(S.topSum); else if (main.firstElementChild) main.firstElementChild.prepend(S.topSum);
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
    const cv = S.view === 'consult';
    const ib = (name, fn, label) => el('button', { class: 'ib', onclick: fn, 'aria-label': label, title: label, disabled: cv }, icon(name));
    const nav = el('div', { class: 'nav' },
      ib('left', () => go(-1), weekMode() ? '이전 주' : '이전 달'),
      el('span', { class: 'ttl' + (cv ? ' off' : ' jump'), title: cv ? '' : '눌러서 연·월 직접 입력', onclick: cv ? null : (e) => editTtl(e.currentTarget) }, weekMode() ? (() => { const a = parseYmd(S.anchor); return `${a.getFullYear()}년 ${a.getMonth() + 1}월`; })() : `${S.y}년 ${S.m + 1}월`),
      ib('right', () => go(1), weekMode() ? '다음 주' : '다음 달'),
      el('button', { class: 'ghost sm', disabled: cv, onclick: goToday }, '오늘'));
    const tab = (v, label) => el('button', { class: 'tab' + (S.view === v ? ' on' : ''), onclick: () => setView(v) }, label);
    const tabs = el('div', { class: 'tabs' }, tab('cal', '캘린더'), tab('att', '출결'), S.cloudAvail ? tab('consult', '상담') : null);
    const right = el('div', { class: 'right' });
    // 오른쪽 도구들: 좁아지면 뒤에서부터 ⋯ 팝업으로 들어가요
    const gc = (gcalWanted() || (PF.ghol && S.cloud)) && !gtoken();
    const tools = [
      { k: 'sync', label: '새로고침', run: forceSync, node: () => el('button', { class: 'ib', id: 'syncBtn', title: '새로고침', 'aria-label': '새로고침', onclick: forceSync }, icon('refresh')) },
      ...DOCS.map(([id, label, ic]) => ({ k: 'doc-' + id, label, run: () => openDoc(id),
        node: () => el('button', { class: 'ghost sm dbtn' + (docOf(id) ? ' has' : ''), title: label, 'aria-label': label, onclick: () => openDoc(id) }, icon(ic), el('span', { class: 'lb' }, label)) })),
      S.view === 'cal' ? { k: 'seg', menu: [['월별', PF.cal === 'month', () => setCalMode('month')], ['이번 주', PF.cal === 'week', () => setCalMode('week')]],
        node: () => el('div', { class: 'seg', role: 'group', 'aria-label': '보기 방식' },
          el('button', { class: PF.cal === 'month' ? 'on' : '', onclick: () => setCalMode('month') }, '월별'),
          el('button', { class: PF.cal === 'week' ? 'on' : '', onclick: () => setCalMode('week') }, '이번 주')) } : null,
      gc ? { k: 'gc', label: 'Google 다시 연결', run: () => connectGcal(!gcalWanted()), node: () => el('button', { class: 'ghost sm', onclick: () => connectGcal(!gcalWanted()) }, 'Google 다시 연결') } : null,
    ].filter(Boolean);
    S.tools = tools;
    tools.forEach((x) => { const n = x.node(); n.dataset.ov = x.k; right.append(n); });
    right.append(el('button', { class: 'ib', id: 'ovBtn', hidden: true, onclick: (e) => { e.stopPropagation(); openOverflow(); }, 'aria-label': '더 보기', title: '더 보기' }, icon('more')));
    right.append(el('button', { class: 'ib', id: 'menuBtn', onclick: (e) => { e.stopPropagation(); openMenu(); }, 'aria-label': '메뉴', title: '메뉴' }, icon('menu')));
    t.append(nav, tabs, right);
    fitTop();
  }

  /* 상단바가 좁아지면 오른쪽 도구를 뒤에서부터 숨기고 ⋯ 버튼으로 보여줘요 */
  function fitTop() {
    const t = $('#top');
    if (!t || t.hidden) return;
    const items = [...t.querySelectorAll('.right [data-ov]')], more = $('#ovBtn');
    if (!more) return;
    items.forEach((i) => { i.hidden = false; }); more.hidden = true;
    const over = () => t.scrollWidth > t.clientWidth + 1;
    let n = 0;
    if (over()) { more.hidden = false; while (over() && n < items.length) { items[items.length - 1 - n].hidden = true; n++; } }
    S.hiddenTools = items.filter((i) => i.hidden).map((i) => i.dataset.ov);
    // 줄일 수 있는 가장 좁은 너비: 이동 아이콘 + 날짜 이동 + 탭 + ⋯ + 메뉴
    const api = window.hagisiroWidget;
    if (api && api.setMinWidth) {
      const cs = getComputedStyle(t), nav = t.querySelector('.nav'), tabs = t.querySelector('.tabs'), r = t.querySelector('.right');
      const g = parseFloat(cs.columnGap) || 6, rg = parseFloat(getComputedStyle(r).columnGap) || 4;
      const need = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + nav.offsetWidth + tabs.offsetWidth + 2 * g + 2 * 28 + rg + 8;
      const w = Math.ceil(need + (IS_WIDGET ? 6 : 0));
      if (S.minW !== w) { S.minW = w; api.setMinWidth(w); }
    }
  }
  function openOverflow() {
    if ($('#menu')) { closeMenu(); return; }
    const m = el('div', { class: 'menu', id: 'menu' });
    const item = (label, fn, on) => el('button', { class: 'mi' + (on ? ' on' : ''), onclick: () => { closeMenu(); fn(); } }, label);
    (S.tools || []).filter((x) => (S.hiddenTools || []).includes(x.k)).forEach((x) => {
      if (x.menu) x.menu.forEach(([l, on, fn]) => m.append(item(l, fn, on))); else m.append(item(x.label, x.run));
    });
    $('#app').append(m);
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
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
  function jumpTo(y, m) {
    const sd = parseYmd(S.sel);
    const dim = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(sd.getDate(), dim));
    S.y = y; S.m = m; S.sel = ymd(d); S.anchor = ymd(d); S.extra = {};
    watchRange(); render();
  }
  function editTtl(span) {
    if (span.querySelector('input')) return;
    const ref = weekMode() ? parseYmd(S.anchor) : new Date(S.y, S.m, 1);
    const yi = el('input', { type: 'text', inputmode: 'numeric', maxlength: 4, class: 'ttin y', value: ref.getFullYear(), 'aria-label': '연도' });
    const mi = el('input', { type: 'text', inputmode: 'numeric', maxlength: 2, class: 'ttin m', value: ref.getMonth() + 1, 'aria-label': '월' });
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      const y = parseInt(yi.value, 10), m = parseInt(mi.value, 10);
      if (ok && y >= 1900 && y <= 2200 && m >= 1 && m <= 12) jumpTo(y, m - 1); else render();
    };
    [yi, mi].forEach((i) => {
      i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, ''); if (i === yi && i.value.length === 4) { mi.focus(); mi.select(); } });
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); e.stopPropagation(); });
      i.addEventListener('focus', () => i.select());
    });
    span.replaceChildren(yi, '년 ', mi, '월');
    span.addEventListener('focusout', () => setTimeout(() => { if (!span.contains(document.activeElement)) finish(true); }, 0));
    yi.focus();
  }
  function goToday() {
    const n = new Date();
    S.y = n.getFullYear(); S.m = n.getMonth(); S.sel = ymd(n); S.anchor = ymd(n); S.extra = {};
    watchRange(); render();
  }

  /* 새로고침: 구독을 다시 걸어 서버 내용으로 덮어써요 */
  function forceSync() {
    const b = $('#syncBtn');
    if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); }
    if (S.cloud) {
      stopWatches(); watchStatic(); watchRange();
      loadMeal();
    } else { Data.loadLocal(); render(); }
    toast('새로 불러왔어요');
  }

  /* ---------- 메뉴 ---------- */
  function closeMenu() { const m = $('#menu'); if (m) m.remove(); document.removeEventListener('click', onDocClick); }
  function onDocClick(e) { const m = $('#menu'); if (m && !m.contains(e.target)) closeMenu(); }
  function openMenu() {
    if ($('#menu')) { closeMenu(); return; }
    const item = (label, fn) => el('button', { class: 'mi', onclick: () => { closeMenu(); fn(); } }, label);
    const m = el('div', { class: 'menu', id: 'menu' });
    m.append(el('div', { class: 'mh' }, S.user ? (S.user.email || '로그인됨') : '이 기기에만 저장'));
    if (S.cloudAvail && !S.user) m.append(item('Google 로그인', () => { S.guest = false; ls.set('hagisiro:guest', '0'); S.cloudMod.login().catch(loginErr); }));
    m.append(item('설정', openPrefs));
    if (S.user) {
      m.append(item(gcalWanted() ? 'Google 캘린더 일정 숨기기' : 'Google 캘린더 일정 표시', () => {
        if (gcalWanted()) { ls.set('hagisiro:gcal', '0'); S.gcal = {}; render(); } else connectGcal(false);
      }));
      m.append(item('로그아웃', () => { ls.set('hagisiro:guest', '0'); S.guest = false; S.cloudMod.logout(); }));
    }
    if (!S.cloud) m.append(item('백업 내보내기 (JSON)', exportJson));
    if (window.hagisiroWidget && window.hagisiroWidget.quit) m.append(item('종료', () => window.hagisiroWidget.quit()));
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
      el('button', { class: 'pri', onclick: () => S.cloudMod.login().catch(loginErr) }, 'Google 로그인'),
      el('button', { class: 'link', onclick: () => { S.guest = true; ls.set('hagisiro:guest', '1'); enterLocal(); } }, '이 기기에만 저장'));
  }

  /* ================= 캘린더 ================= */
  function calView() {
    const r = range();
    const todayS = ymd(new Date());
    const wrap = el('div', { class: 'cal', id: 'cal' });
    wrap.append(el('div', { class: 'wk' }, DOW.map((d, i) => el('div', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '' }, d))));
    const grid = el('div', { class: 'days', style: `grid-template-rows:repeat(${r.rows},minmax(0,1fr))` });
    const attBy = {}; S.att.forEach((a) => { attBy[a.date] = (attBy[a.date] || 0) + 1; });

    const gapRows = new Set();
    if (weekMode() && PF.mgap) {
      for (let i = 7; i < r.rows * 7; i++) if (new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate() + i).getDate() === 1) gapRows.add(Math.floor(i / 7));
    }
    for (let i = 0; i < r.rows * 7; i++) {
      const d = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate() + i);
      const ds = ymd(d);
      const list = itemsOn(ds);
      const gl = S.gcal[ds] || [];
      const hn = holName(ds, d);
      const lu = PF.lunar && window.Lunar ? Lunar.lunarLabel(d) : '';
      const tm = PF.terms && window.Lunar ? Lunar.termOf(d) : '';
      const cls = 'cell' + (!weekMode() && d.getMonth() !== S.m ? ' other' : '') + (hn ? ' hol' : '') + (ds === todayS ? ' today' : '') + (ds === S.sel ? ' sel' : '') + (gapRows.has(Math.floor(i / 7)) ? ' mgap' : '') +
        (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
      grid.append(el('div', { class: cls, 'data-date': ds },
        el('div', { class: 'ct' },
          el('span', { class: 'dn' }, d.getDate() === 1 ? `${d.getMonth() + 1}.1` : d.getDate()),
          hn || tm || lu ? el('span', { class: 'sb', title: [hn, tm, lu].filter(Boolean).join(' · ') },
            hn ? el('i', { class: 'hn' }, hn) : null, tm ? el('i', { class: 'tm' }, tm) : null, lu ? el('i', { class: 'lu' }, lu) : null) : null,
          attBy[ds] ? el('button', { class: 'ab', 'data-act': 'att', title: '출결 보기' }, `출결 ${attBy[ds]}`) : null,
          PF.meal && S.meal[ds] ? el('button', { class: 'ab mb', 'data-act': 'meal', title: '급식' }, '급식') : null),
        el('div', { class: 'tl' }, gl.map(gev), list.map(todoRow)),
        el('div', { class: 'dots' }, list.slice(0, 5).map((t) => el('i', { class: t.done ? 'on' : '' })), gl.length ? el('i', { class: 'g' }) : null)));
    }

    grid.addEventListener('click', (e) => {
      if (skipClick) return;
      const mb = e.target.closest('[data-act="meal"]');
      if (mb) { openMeal(mb.closest('.cell').dataset.date); return; }
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
  const FG = [['', '기본'], ['#e5484d', '빨강'], ['#d98a00', '주황'], ['#2e9e5b', '초록'], ['#2f6df6', '파랑'], ['#8b5cf6', '보라'], ['#d6409f', '분홍'], ['#8b9098', '회색']];
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
      btn('check', '완료', () => {
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
    let closed = false, selDrag = null, bar = null, rowDrag = null;
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
    // 글자 칸에서 끌어서 줄을 넘어가면, 글자 선택 대신 지나간 줄 전체를 선택
    const rowAt = (y) => {
      const rs = rows();
      return rs.find((r) => { const b = r.getBoundingClientRect(); return y >= b.top && y <= b.bottom; }) || (y < rs[0].getBoundingClientRect().top ? rs[0] : rs[rs.length - 1]);
    };
    const onMove = (e) => {
      if (rowDrag && !selDrag) {
        const cur = rowAt(e.clientY);
        if (cur !== rowDrag.row) rowDrag.on = true;
        if (rowDrag.on) {
          box.classList.add('rowsel');
          if (window.getSelection) window.getSelection().removeAllRanges();
          const rs = rows(), a = rs.indexOf(rowDrag.row), b = rs.indexOf(cur), lo = Math.min(a, b), hi = Math.max(a, b);
          rs.forEach((r, i) => r.classList.toggle('picked', i >= lo && i <= hi));
        }
        return;
      }
      if (!selDrag) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const r = t && t.closest && t.closest('.td');
      if (r && box.contains(r) && r.classList.contains('picked') !== selDrag.state) r.classList.toggle('picked', selDrag.state);
    };
    const onUp = () => { selDrag = null; if (rowDrag) { rowDrag = null; box.classList.remove('rowsel'); } };
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
      inp.addEventListener('mousedown', (e) => { clearPicks(); if (e.button === 0) rowDrag = { row, on: false }; });
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
    const add = noBlur(el('button', { class: 'addrow', type: 'button', onclick: () => api && api.addRow() }, icon('plus'), '할 일 추가'));
    const close = noBlur(el('button', { class: 'ib', type: 'button', 'aria-label': '닫기', onclick: () => api && api.finish() }, icon('close')));
    const foot = el('div', { class: 'sfoot' }, add);
    const g = (S.gcal[ds] || []).map(gev);
    sh.append(el('div', { class: 'back', onclick: () => api && api.finish() }),
      el('div', { class: 'panel' },
        el('div', { class: 'shead' }, el('b', {}, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`), el('span', { class: 'grow' }), close),
        g.length ? el('div', { class: 'sg' }, g) : null,
        PF.meal && S.meal[ds] ? el('button', { class: 'ghost sm mealbtn', type: 'button', onclick: () => openMeal(ds) }, '급식 보기') : null, body, foot));
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
        if (!st.dows.size) { toast('요일을 하나 이상 골라주세요'); return null; }
        f.dows = [...st.dows].sort((a, b) => a - b);
      }
      if (st.kind === 'monthly') {
        if (!(st.dom >= 1 && st.dom <= 31)) { toast('1~31 사이의 날짜를 넣어주세요'); return null; }
        f.dom = st.dom;
      }
      if (st.kind === 'yearly') {
        if (!(st.month >= 1 && st.month <= 12) || !(st.day >= 1 && st.day <= (st.lunar ? 30 : 31))) { toast('월·일을 확인해주세요'); return null; }
        f.month = st.month; f.day = st.day; f.lunar = st.lunar;
      }
      if (opt.withText) { if (!st.text.trim()) { toast('반복할 내용을 입력해주세요'); return null; } f.text = st.text.trim(); }
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
      body.append(el('div', { class: 'dlgf' }, el('button', { class: 'ghost', type: 'button', onclick: () => { editing = null; mode = 'form'; show(); } }, icon('plus'), '반복 추가'),
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

    async function delRule(r) {
      if (!(await ask('이 반복을 삭제할까요?\n달력에서 이 반복이 모두 사라져요.'))) return;
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
        el('button', { class: 'pri', onclick: () => openRoster(null) }, '학급 추가')));
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
      el('button', { class: 'ghost sm', onclick: () => exportCsv(cls) }, icon('download'), '파일로 저장')));

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
    frag.append(el('div', { class: 'dhead mhead' }));
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
          td.append(el('span', { class: 'mk t-' + arr[0].type, title: arr.map((a) => `${kindLabel(a)} ${recLabel(a)}${a.reason ? ' · ' + a.reason : ''}`).join('\n') }, arr.map((a) => SHORT[a.type]).join('')));
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
          el('div', { class: 'wg' }, recLabel(a)),
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
    if (!students.length) wrap.append(el('div', { class: 'empty mut' }, '기록 없음'));
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
      el('span', { class: 'grow' }),
      el('span', { class: 'mut small' }, ovr ? `기본 ${def ? def + '교시' : '수업 없음'} → 이 날만` : '이 날 교시 수'),
      cntSel,
      ovr ? el('button', { class: 'ghost sm', onclick: () => { setDayPeriods(ds, def); render(); } }, '기본값으로') : null));

    const recs = S.att.filter((a) => a.classId === cls.id && a.date === ds);
    const by = {}; recs.slice().sort((a, b) => (a.created || 0) - (b.created || 0)).forEach((a) => { (by[a.studentId] = by[a.studentId] || []).push(a); });

    const slotN = last + 2; // 조회 + 교시들 + 종례
    const head = el('tr', {},
      el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '성명'), el('th', { class: 'kc' }, '종류'),
      Array.from({ length: slotN }, (_, i) => el('th', { class: 'sl-h' }, i === 0 ? '조회' : i === slotN - 1 ? '종례' : `${i}교시`)),
      el('th', { class: 'rs-h' }, '사유'));
    const tbody = el('tbody');

    function addRow(s, rec, first) {
      const cells = [el('td', { class: 'c1' }, first ? s.no : ''), el('td', { class: 'c2' }, first ? s.name : '')];
      const ksel = el('select', { class: 'ksel' + (rec ? ' c-' + rec.cat : ''), 'aria-label': `${s.name} 출결 종류` },
        el('option', { class: 'o-ok', value: '출석' }, '출석'),
        CATS.map((c) => TYPES.map((t) => el('option', { class: 'c-' + c, value: c + t, selected: !!rec && rec.cat === c && rec.type === t }, c + t))));
      ksel.addEventListener('change', () => setKind(s, rec, ksel.value, ds, cls));
      cells.push(el('td', { class: 'kc' }, ksel));
      if (rec) {
        const on = new Set(recCols(rec, last));
        for (let i = 0; i < slotN; i++) cells.push(el('td', { class: 'slc tg' + (on.has(i) ? ' sl c-' + rec.cat : ''), title: on.has(i) ? kindLabel(rec) : null, onclick: () => toggleSlot(s, rec, i, ds, cls) }, on.has(i) ? icon('slash') : ''));
        const rin = el('input', { type: 'text', class: 'rin', value: rec.reason || '', 'aria-label': `${s.name} 사유`, spellcheck: 'false' });
        rin.addEventListener('change', () => Data.put('att', { ...rec, reason: rin.value.trim() }));
        rin.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) rin.blur(); });
        cells.push(el('td', { class: 'rs' }, el('div', { class: 'rsw' }, rin)));
      } else {
        for (let i = 0; i < slotN; i++) cells.push(el('td', { class: 'slc tg', onclick: () => toggleSlot(s, null, i, ds, cls) }));
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
      : '기록 없음';
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
      if (k.type !== rec.type) { const [f, t] = P.defaultRange(k.type, null, null, lastOf(ds)); r.from = f; r.to = t; delete r.slots; }
      Data.put('att', r);
    } else {
      const [f, t] = P.defaultRange(k.type, null, null, lastOf(ds));
      Data.put('att', { id: uid(), classId: cls.id, studentId: s.id, name: s.name, no: s.no, date: ds, type: k.type, cat: k.cat, from: f, to: t, reason: '', created: Date.now() });
    }
    render();
  }
  /* 교시 칸: 눌러서 빗금 켜고 끄기 (바로 저장) */
  const colVal = (i, last) => (i === 0 ? 0 : i === last + 1 ? END : i);
  function recCols(rec, last) {
    if (rec.slots && rec.slots.length) return rec.slots.map((v) => resSlot(v, last));
    const a = resSlot(rec.from, last), b = resSlot(rec.to, last), o = [];
    for (let i = a; i <= b; i++) o.push(i);
    return o;
  }
  function toggleSlot(s, rec, i, ds, cls) {
    const last = lastOf(ds);
    if (!rec) {
      const k = KINDS.find((x) => x.cat === '미인정' && x.type === '결과');
      const v = colVal(i, last);
      Data.put('att', { id: uid(), classId: cls.id, studentId: s.id, name: s.name, no: s.no, date: ds, type: k.type, cat: k.cat, from: v, to: v, slots: [v], reason: '', created: Date.now() });
      render(); return;
    }
    const set = new Set(recCols(rec, last));
    if (set.has(i)) set.delete(i); else set.add(i);
    if (!set.size) { Data.del('att', rec.id); toast('출석으로 바꿨어요', () => { Data.put('att', rec); render(); }); render(); return; }
    const vals = [...set].sort((x, y) => x - y).map((c) => colVal(c, last));
    Data.put('att', { ...rec, slots: vals, from: vals[0], to: vals[vals.length - 1] });
    render();
  }
  const recLabel = (a) => {
    if (!(a.slots && a.slots.length)) return P.rangeLabel(a.from, a.to);
    const v = a.slots.slice().sort((x, y) => x - y);
    const run = v.every((x, i) => i === 0 || x === v[i - 1] + 1 || (x === END && v[i - 1] >= 0));
    return run && v.length > 1 && v[v.length - 1] !== END ? P.rangeLabel(v[0], v[v.length - 1]) : v.map(P.slotName).join(', ');
  };

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
      rows.push([a.date, DOW[parseYmd(a.date).getDay()], st ? st.no : a.no, st ? st.name : a.name, kindLabel(a), a.cat, a.type, recLabel(a), a.reason || '']);
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
        onload: () => res(window.XLSX), onerror: () => { sheetJs = null; rej(new Error('엑셀 변환 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 내용을 복사해 붙여넣어주세요')); } }));
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
  /* 이미지 → 글자(OCR). 브라우저 안에서 Tesseract.js 로 읽고, 글자 위치로 행·열을 만들어요 */
  let ocrLib = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!ocrLib) ocrLib = new Promise((res, rej) => {
      document.head.append(el('script', { src: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
        onload: () => res(window.Tesseract), onerror: () => { ocrLib = null; rej(new Error('글자 인식 도구를 불러오지 못했어요')); } }));
    });
    return ocrLib;
  }
  function wordsToTsv(words) {
    const ws = words.filter((w) => w.text.trim() && w.confidence > 25).map((w) => ({
      t: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1, y: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 }));
    if (!ws.length) return '';
    const hs = ws.map((w) => w.h).sort((a, b) => a - b); const mh = hs[hs.length >> 1] || 20;
    ws.sort((a, b) => a.y - b.y);
    const rows = [];
    ws.forEach((w) => {
      const r = rows[rows.length - 1];
      if (r && Math.abs(w.y - r.y) < mh * 0.6) { r.w.push(w); r.y = (r.y * (r.w.length - 1) + w.y) / r.w.length; } else rows.push({ y: w.y, w: [w] });
    });
    return rows.map((r) => {
      r.w.sort((a, b) => a.x0 - b.x0);
      const cells = []; let cur = null, last = 0;
      r.w.forEach((w) => { if (cur !== null && w.x0 - last < mh * 0.9) cur += ' ' + w.t; else { if (cur !== null) cells.push(cur); cur = w.t; } last = w.x1; });
      cells.push(cur);
      return cells.join('\t');
    }).join('\n');
  }
  function upscale(src) { // 키우기 → 흑백 → 표 선 지우기: 글자만 남겨야 훨씬 잘 읽혀요
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const k = Math.max(1, Math.min(3, 2600 / im.width));
        const W = Math.round(im.width * k), H = Math.round(im.height * k);
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, W, H);
        try {
          const id = g.getImageData(0, 0, W, H), d = id.data, n = W * H, gray = new Uint8Array(n), hist = new Array(256).fill(0);
          for (let i = 0; i < n; i++) { const v = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0; gray[i] = v; hist[v]++; }
          let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
          let sb = 0, wb = 0, best = 0, th = 128;
          for (let t = 0; t < 256; t++) { wb += hist[t]; if (!wb) continue; const wf = n - wb; if (!wf) break; sb += t * hist[t]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) * (mb - mf); if (v > best) { best = v; th = t; } }
          const bin = new Uint8Array(n); for (let i = 0; i < n; i++) bin[i] = gray[i] < th ? 1 : 0; // 1 = 글자/선
          const minRun = Math.max(70, Math.round(Math.min(W, H) * 0.12)); // 이보다 길게 이어진 가로·세로 줄은 표 선으로 보고 지움
          const kill = new Uint8Array(n);
          for (let y = 0; y < H; y++) { let s0 = -1; for (let x = 0; x <= W; x++) { const on = x < W && bin[y * W + x]; if (on && s0 < 0) s0 = x; else if (!on && s0 >= 0) { if (x - s0 >= minRun) for (let q = s0; q < x; q++) kill[y * W + q] = 1; s0 = -1; } } }
          for (let x = 0; x < W; x++) { let s0 = -1; for (let y = 0; y <= H; y++) { const on = y < H && bin[y * W + x]; if (on && s0 < 0) s0 = y; else if (!on && s0 >= 0) { if (y - s0 >= minRun) for (let q = s0; q < y; q++) kill[q * W + x] = 1; s0 = -1; } } }
          for (let i = 0; i < n; i++) { const v = bin[i] && !kill[i] ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
          g.putImageData(id, 0, 0);
        } catch (e) { /* 실패하면 그냥 키운 그림으로 */ }
        res(c.toDataURL('image/png'));
      };
      im.onerror = () => rej(new Error('이미지를 열지 못했어요'));
      im.src = src;
    });
  }
  async function ocrImage(src) {
    const T = await loadTesseract();
    const w = await T.createWorker('kor', 1, { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/kor/4.0.0_best_int' });
    try {
      await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      const { data } = await w.recognize(await upscale(src));
      return wordsToTsv(data.words || []);
    } finally { await w.terminate(); }
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
        if (out.length >= 900000) rej(new Error('이미지가 너무 커요. 더 작은 이미지로 올려주세요')); else res(out);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 열지 못했어요')); };
      im.src = url;
    });
  }
  /* 한글·워드·웹에서 복사한 표(HTML)를 탭으로 구분된 글자로 바꿔요 (엑셀은 원래 탭으로 와요) */
  function htmlTableToTsv(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tb = doc.querySelector('table'); if (!tb) return '';
    const grid = [];
    [...tb.rows].forEach((tr, ri) => {
      grid[ri] = grid[ri] || []; let ci = 0;
      [...tr.cells].forEach((td) => {
        while (grid[ri][ci] !== undefined) ci++;
        const txt = td.innerText !== undefined && td.innerText ? td.innerText : td.textContent;
        const t = String(txt).replace(/\u00a0/g, ' ').replace(/\s*\n\s*/g, ' ').replace(/\t/g, ' ').trim();
        const cs = Math.max(1, +td.colSpan || 1), rs = Math.max(1, +td.rowSpan || 1);
        for (let r2 = 0; r2 < rs; r2++) for (let c2 = 0; c2 < cs; c2++) { grid[ri + r2] = grid[ri + r2] || []; grid[ri + r2][ci + c2] = (r2 === 0 && c2 === 0) ? t : ''; }
        ci += cs;
      });
    });
    return grid.map((r) => Array.from(r, (x) => x || '').join('\t').replace(/\t+$/, '')).filter((l, i, arr) => l || arr[i + 1]).join('\n');
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
    let drawView = function () {
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg docdlg' + (cur.kind === 'image' ? ' imgdlg' : '') }, head(),
          el('div', { class: 'dbody' }, docView(cur)),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }),
            el('button', { class: 'ghost', onclick: () => { edit = true; draft = { kind: cur.kind, text: cur.text || '', img: cur.img || '' }; drawEdit(); } }, icon('edit'), '수정'),
            el('button', { class: 'pri', onclick: close }, '닫기'))));
    };
    let drawEdit = function () {
      const file = el('input', { type: 'file', hidden: true, accept: '.xlsx,.xls,.xlsm,.csv,.tsv,.txt,image/*', onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { draft = await fileToDraft(f); drawEdit(); } catch (er) { toast(er.message || '파일을 읽지 못했어요'); }
      } });
      const ta = el('textarea', { class: 'dta', placeholder: '여기에 직접 입력하거나, 엑셀에서 복사해 붙여넣으세요.\n(탭으로 구분된 내용은 표로 보여줘요)', spellcheck: 'false' });
      ta.value = draft.text || '';
      ta.addEventListener('input', () => { draft.text = ta.value; });
      ta.addEventListener('paste', (e) => {
        const cd = e.clipboardData; if (!cd) return;
        const html = cd.getData('text/html');
        if (!html || !/<table/i.test(html)) return; // 표가 아니면 그대로 붙여넣기
        const t = htmlTableToTsv(html); if (!t.trim()) return;
        e.preventDefault();
        ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end');
        draft.text = ta.value;
      });
      const body = draft.kind === 'image'
        ? el('div', { class: 'dbody' }, el('div', { class: 'dimg' }, el('img', { src: draft.img, alt: '' })))
        : ta;
      const save = () => {
        if (draft.kind === 'text' && !draft.text.trim()) { if (cur) Data.del('docs', id); close(); return; }
        if (draft.kind === 'text' && draft.text.length > 300000) { toast('내용이 너무 길어요'); return; }
        const o = draft.kind === 'image' ? { id, kind: 'image', img: draft.img, updated: Date.now() } : { id, kind: 'text', text: draft.text, updated: Date.now() };
        Data.put('docs', o); cur = docOf(id) || o; edit = false; drawView(); toast('저장했어요');
      };
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg docdlg' + (draft.kind === 'image' ? ' imgdlg' : '') }, head(),
          el('div', { class: 'dsrc' },
            el('button', { class: 'ghost sm', type: 'button', onclick: () => file.click() }, icon('upload'), '엑셀·이미지 올리기'), file,
            draft.kind === 'image' ? el('button', { class: 'ghost sm', type: 'button', onclick: async (e) => {
              const b = e.currentTarget; b.disabled = true; b.lastChild.textContent = '읽는 중…';
              try {
                const t = await ocrImage(draft.img);
                if (!t.trim()) { toast('글자를 찾지 못했어요'); b.disabled = false; b.lastChild.textContent = '글자로 읽기'; return; }
                draft = { kind: 'text', text: t }; drawEdit();
              } catch (er) { toast(er.message || '글자를 읽지 못했어요'); b.disabled = false; b.lastChild.textContent = '글자로 읽기'; }
            } }, icon('scan'), el('span', {}, '글자로 읽기')) : null,
            draft.kind === 'image' ? el('button', { class: 'ghost sm', type: 'button', onclick: () => { draft = { kind: 'text', text: '' }; drawEdit(); } }, '글자로 입력') : null,
            el('span', { class: 'mut dhint' }, draft.kind === 'image' ? '이미지가 그대로 보여요' : '또는 아래에 직접 입력')),
          body,
          el('div', { class: 'dlgf' },
            cur ? el('button', { class: 'ghost sm danger', onclick: async () => { if (await ask(meta[1] + ' 내용을 삭제할까요?')) { Data.del('docs', id); close(); } } }, icon('trash'), '삭제') : null,
            el('span', { class: 'grow' }),
            el('button', { class: 'ghost', onclick: () => { if (cur) { edit = false; drawView(); } else close(); } }, '취소'),
            el('button', { class: 'pri', onclick: save }, '저장'))));
      if (draft.kind === 'text') ta.focus();
    };
    function fitImg() { // 사진 크기에 맞춰 팝업 폭을 줄이고, 화면(세로)에 들어가도록 줄여요
      const d = m.querySelector('.imgdlg'), img = d && d.querySelector('img');
      if (!img) return;
      const run = () => {
        const nw = img.naturalWidth, nh = img.naturalHeight; if (!nw) return;
        const hasSrc = d.querySelector('.dsrc') ? 56 : 0;
        const availW = window.innerWidth * 0.94 - 28, availH = window.innerHeight * 0.9 - 150 - hasSrc;
        const k = Math.min(1, availW / nw, availH / nh);
        const w = Math.round(nw * k);
        img.style.width = w + 'px'; img.style.height = 'auto';
        d.style.width = Math.max(Math.min(340, window.innerWidth * 0.94), w + 28) + 'px';
      };
      if (img.complete && img.naturalWidth) run(); else img.addEventListener('load', run, { once: true });
    }
    const _de = drawEdit, _dv = drawView;
    drawEdit = function () { _de(); fitImg(); }; drawView = function () { _dv(); fitImg(); };
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
      if (after === 'meal') loadMeal();
      if (after === 'ghol') {
        if (PF.ghol && S.cloud && !gtoken()) connectGcal(!gcalWanted()); else loadGhol();
      }
      render(); draw();
    }
    function draw() {
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg pfdlg' },
          el('div', { class: 'shead' }, el('b', {}, '설정'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
          el('div', { class: 'pfs' }, '캘린더'),
          row('보기 방식', seg('cal', [['month', '월별'], ['week', '이번 주']], 'range')),
          row('전체 주 개수', sel('weeks', [1, 2, 3, 4, 5, 6], (n) => n + '주', 'range')),
          row('지나간 주 개수', sel('past', Array.from({ length: Math.min(5, PF.weeks - 1) + 1 }, (_, i) => i), (n) => n + '주', 'range')),
          el('div', { class: 'pfh' }, '이번 주 기준 보기에서만 쓰여요. 지나간 주는 전체 주보다 적게 정할 수 있어요.'),
          tog('mgap', '월 사이 간격 띄우기', '이번 주 보기에서 달이 바뀌는 줄 위에 간격을 둬요', 'render'),
          el('div', { class: 'pfs' }, '날짜 표시'),
          tog('lunar', '음력 날짜 표시'),
          tog('terms', '24절기 표시'),
          tog('hol', '공휴일 표시 (대한민국)', '설날·추석·대체공휴일까지 자동 계산'),
          tog('ghol', 'Google 캘린더 공휴일 연동', S.cloud ? '임시공휴일 등을 Google에서 가져와요' : 'Google 로그인 후 사용할 수 있어요', 'ghol', !S.cloud),
          el('div', { class: 'pfs' }, '급식'),
          tog('meal', '급식 표시', PF.school ? PF.school.name : '학교를 먼저 골라 주세요', 'meal', !PF.school),
          row('학교', el('button', { type: 'button', class: 'ghost sm', onclick: () => openSchool(draw) }, PF.school ? PF.school.name : '학교 찾기')),
          row('인증키', el('input', { type: 'text', class: 'keyin', value: PF.neisKey || '', placeholder: '선택 · 없으면 일부만 보여요', 'aria-label': '인증키',
            onchange: (e) => { PF.neisKey = e.target.value.trim(); S.meal = {}; savePf(); loadMeal(); } })),
          el('div', { class: 'pfs' }, '할 일'),
          tog('sortDone', '완료한 할 일은 맨 아래로'),
          el('div', { class: 'pfs' }, '화면'),
          row('테마', seg('theme', [['auto', '자동'], ['light', '낮'], ['dark', '밤']])),
          tog('anim', '화면 전환 애니메이션'),
          window.hagisiroWidget ? el('div', { class: 'pfs' }, '위젯') : null,
          window.hagisiroWidget && S.zmode ? row('창 순서', el('div', { class: 'seg' }, [['top', '맨 앞'], ['normal', '일반'], ['bottom', '맨 뒤']].map(([v, l]) =>
            el('button', { type: 'button', class: S.zmode === v ? 'on' : '', onclick: async () => { S.zmode = await window.hagisiroWidget.setZ(v); draw(); } }, l)))) : null,
          window.hagisiroWidget ? row('투명도', el('input', {
            type: 'range', min: 30, max: 100, step: 5, value: PF.opacity, 'aria-label': '위젯 투명도',
            oninput: (e) => { PF.opacity = +e.target.value; savePf(); const o = m.querySelector('.opv'); if (o) o.textContent = PF.opacity + '%'; },
          }), el('b', { class: 'opv' }, PF.opacity + '%')) : null,
          S.autoStart == null ? null : el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox', checked: !!S.autoStart, onchange: async (e) => { S.autoStart = await window.hagisiroWidget.setAutoStart(e.target.checked); draw(); } }), el('span', {}, '윈도우 시작할 때 함께 시작')),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'pri', onclick: close }, '닫기'))));
    }
    draw();
    if (window.hagisiroWidget && window.hagisiroWidget.getZ) window.hagisiroWidget.getZ().then((v) => { S.zmode = v; if (!m.hidden) draw(); });
    if (window.hagisiroWidget && window.hagisiroWidget.getAutoStart) window.hagisiroWidget.getAutoStart().then((v) => { S.autoStart = v; if (!m.hidden) draw(); });
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
        if (removed.length) toast(`날짜별 개별 설정 ${removed.length}일을 삭제하고 기본값으로 통일했어요`, () => { removed.forEach((x) => Data.put('days', x)); render(); });
      }
      render();
    };
    m.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg perdlg' },
        el('div', { class: 'shead' }, el('b', {}, '교시 설정'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
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
    async function remove() {
      if (!(await ask('이 학급을 삭제할까요?\n출결 기록은 남아 있어요.'))) return;
      Data.del('classes', c.id); S.clsId = null; close(); render();
    }
    m.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg rosdlg' },
        el('div', { class: 'shead' }, el('b', {}, c ? '학급 수정' : '학급 추가'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        name, ta,
        el('div', { class: 'dlgf' },
          c ? el('button', { class: 'ghost sm danger', onclick: remove }, '학급 삭제') : null,
          el('span', { class: 'grow' }),
          el('button', { class: 'ghost', onclick: close }, '취소'),
          el('button', { class: 'pri', onclick: save }, '저장'))));
    (c ? ta : name).focus();
  }

  /* ================= Google 캘린더 (선택, 읽기 전용) ================= */
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
      toast(holOnly ? 'Google 공휴일을 연결했어요' : 'Google 캘린더 일정을 함께 표시해요');
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
        if (res.status === 403) toast('Google 캘린더 권한 오류');
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

  /* Google '대한민국의 휴일' 캘린더 (임시공휴일 등 반영) */
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
        if (!gholWarned) { gholWarned = true; toast('Google 공휴일을 불러오지 못했어요 (내장 공휴일만 표시)'); }
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

  /* ================= 급식 (NEIS 교육정보 개방 포털) ================= */
  const NEIS = 'https://open.neis.go.kr/hub/';
  const neis = async (api, q) => {
    const p = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '100', ...q });
    if (PF.neisKey) p.set('KEY', PF.neisKey);
    const res = await fetch(NEIS + api + '?' + p);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.RESULT) { if (j.RESULT.CODE === 'INFO-200') return []; throw new Error(j.RESULT.MESSAGE || j.RESULT.CODE); }
    const blk = j[api];
    return blk && blk[1] ? blk[1].row : [];
  };
  const ymdN = (ds) => ds.replace(/-/g, '');
  let mealWarned = false;
  async function loadMeal() {
    if (!PF.meal || !PF.school) { if (Object.keys(S.meal).length) { S.meal = {}; render(); } return; }
    const r = range();
    try {
      const rows = await neis('mealServiceDietInfo', {
        ATPT_OFCDC_SC_CODE: PF.school.edu, SD_SCHUL_CODE: PF.school.code,
        MLSV_FROM_YMD: ymdN(r.from), MLSV_TO_YMD: ymdN(r.to),
      });
      const m = {};
      rows.forEach((x) => {
        const k = x.MLSV_YMD.replace(/^(\d{4})(\d\d)(\d\d)$/, '$1-$2-$3');
        (m[k] = m[k] || []).push({ kind: x.MMEAL_SC_NM, menu: String(x.DDISH_NM || '').split(/<br\s*\/?>/i).map((t) => t.trim()).filter(Boolean), cal: x.CAL_INFO || '' });
      });
      S.meal = m; render();
    } catch (e) {
      console.error(e);
      if (!mealWarned) { mealWarned = true; toast('급식 정보를 불러오지 못했어요'); }
    }
  }
  const allergyStrip = (t) => t.replace(/\s*\(?[\d.]+\)?\s*$/, '').replace(/\(\s*[\d.\s]+\)/g, '');
  function openMeal(ds) {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const d = parseYmd(ds);
    const list = S.meal[ds] || [];
    m.replaceChildren(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' },
        el('div', { class: 'shead' }, el('b', {}, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]}) 급식`), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        list.length ? el('div', { class: 'meals' }, list.map((x) => el('div', { class: 'meal' },
          el('b', {}, x.kind, x.cal ? el('small', {}, ' ' + x.cal) : null),
          el('ul', {}, x.menu.map((t) => el('li', {}, allergyStrip(t))))))) : el('div', { class: 'mut' }, '급식이 없어요')));
  }
  function openSchool(done) {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); if (done) openPrefs(); };
    const res = el('div', { class: 'schres' });
    const inp = el('input', { type: 'search', placeholder: '학교 이름', 'aria-label': '학교 이름' });
    let busy = false;
    const go = async () => {
      const q = inp.value.trim();
      if (!q || busy) return;
      busy = true; res.replaceChildren(el('div', { class: 'mut' }, '불러오는 중…'));
      try {
        const rows = await neis('schoolInfo', { SCHUL_NM: q });
        res.replaceChildren(...(rows.length ? rows.map((x) => el('button', { type: 'button', class: 'schrow', onclick: () => {
          PF.school = { name: x.SCHUL_NM, edu: x.ATPT_OFCDC_SC_CODE, code: x.SD_SCHUL_CODE }; PF.meal = true; S.meal = {};
          savePf(); loadMeal(); close();
        } }, el('b', {}, x.SCHUL_NM), el('small', {}, ' ' + (x.ORG_RDNMA || x.LCTN_SC_NM || '')))) : [el('div', { class: 'mut' }, '찾는 학교가 없어요')]));
      } catch (e) { res.replaceChildren(el('div', { class: 'mut' }, '학교를 불러오지 못했어요')); }
      busy = false;
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    m.replaceChildren(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' },
        el('div', { class: 'shead' }, el('b', {}, '학교 찾기'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'schq' }, inp, el('button', { class: 'pri', type: 'button', onclick: go }, '검색')), res));
    setTimeout(() => inp.focus(), 30);
  }

  /* ================= 상담 신청 (선생님) ================= */
  const bookUrl = (id) => new URL('book.html?c=' + id, location.href).href;
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast('링크를 복사했어요'); } catch (e) { ask('아래 링크를 길게 눌러 복사하세요\n' + t, '닫기', false); } };
  const sidLabel = (sid) => `${sid.slice(4, 6)}/${sid.slice(6, 8)} ${sid.slice(9, 11)}:${sid.slice(11, 13)}`;
  function consultView() {
    const host = el('div', { class: 'cv' });
    S.cvHost = host;
    if (!S.cloud) { host.append(el('div', { class: 'cvm mut' }, 'Google 로그인 후 사용할 수 있어요')); return host; }
    let unsub = null;
    S.cleanup = () => { if (unsub) unsub(); unsub = null; };
    let nav = 0;
    const stop = () => { nav++; if (unsub) { unsub(); unsub = null; } };
    const shell = (title, body, back) => host.replaceChildren(
      el('div', { class: 'cvh' }, back ? el('button', { class: 'ib', type: 'button', onclick: back, 'aria-label': '이전' }, icon('left')) : null, el('b', {}, title)), body);
    const hm = (sid) => `${sid.slice(9, 11)}:${sid.slice(11, 13)}`;
    const dayLabel = (k) => { const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };
    const kOf = (d) => ymd(d).replace(/-/g, '');
    const mins = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
    const tkey = (t) => pad(Math.floor(t / 60)) + pad(t % 60);
    const r = (l, ...c) => el('div', { class: 'pfr' }, el('span', { class: 'pl' }, l), el('div', { class: 'pc2' }, c));

    /* ---- 첫 화면: 새로 만들기 + 만들어 둔 상담표 목록 ---- */
    async function list() {
      S.cs = null; stop(); const my = nav;
      shell('상담 신청', el('div', { class: 'mut' }, '불러오는 중…'));
      let rows = [];
      try { rows = await S.cloud.consultList(); } catch (e) { console.error(e); if (my === nav) shell('상담 신청', el('div', { class: 'mut' }, '불러오지 못했어요')); return; }
      if (my !== nav) return;
      rows.sort((a, b) => (b.created || 0) - (a.created || 0));
      shell('상담 신청', el('div', { class: 'clist' },
        el('button', { class: 'pri cnew', type: 'button', onclick: quick }, icon('plus'), '상담 신청 테이블 만들기'),
        el('div', { class: 'pfs' }, '만들어 둔 테이블'),
        rows.length ? rows.map((c) => el('div', { class: 'crow' },
          el('button', { class: 'ctitle', type: 'button', onclick: () => detail(c) }, el('b', {}, c.title || '상담'), el('small', {}, ` ${c.slots.length}칸`)),
          el('button', { class: 'ib', type: 'button', title: '링크 복사', 'aria-label': '링크 복사', onclick: () => copyText(bookUrl(c.id)) }, icon('link')),
          el('button', { class: 'ib', type: 'button', title: '수정', 'aria-label': '수정', onclick: () => fine(draftOf(c), c) }, icon('edit')),
          el('button', { class: 'ib', type: 'button', title: '삭제', 'aria-label': '삭제', onclick: () => del(c) }, icon('trash')))) : el('div', { class: 'mut' }, '아직 만든 테이블이 없어요')));
    }
    async function del(c) {
      if (!(await ask(`“${c.title || '상담'}” 테이블을 삭제할까요?\n신청 내용도 모두 사라져요.`))) return;
      try { await S.cloud.consultDelete(c.id); toast('삭제했어요'); list(); } catch (e) { toast('삭제하지 못했어요'); }
    }

    /* ---- 1단계: 빠른 만들기 (기간·시각·간격) ---- */
    function quick() {
      stop();
      const today = ymd(new Date());
      const f = {
        title: el('input', { placeholder: '제목 (예: 2학기 진로 상담)', maxlength: 40 }),
        from: el('input', { type: 'date', value: today }), to: el('input', { type: 'date', value: ymd(new Date(Date.now() + 13 * 864e5)) }),
        t1: el('input', { type: 'time', value: '16:00' }), t2: el('input', { type: 'time', value: '18:00' }),
        step: el('select', {}, [10, 20, 30, 40, 50, 60].map((n) => el('option', { value: n, selected: n === 20 }, n + '분'))),
      };
      const wk = el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox' }), el('span', {}, '주말 포함'));
      shell('테이블 만들기 · 1/2', el('div', { class: 'cform' },
        f.title, r('시작일', f.from), r('종료일', f.to), wk, r('시작 시각', f.t1), r('종료 시각', f.t2), r('간격', f.step),
        el('div', { class: 'pfh' }, '대략적인 틀을 만들어요. 다음 단계에서 칸마다 잠그거나 날짜별로 다르게 고칠 수 있어요.'),
        el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'pri', type: 'button', onclick: () => {
          const a = parseYmd(f.from.value || today), z = parseYmd(f.to.value || today);
          const weekend = wk.querySelector('input').checked, step = +f.step.value;
          const days = {};
          for (let d = new Date(a); d <= z && Object.keys(days).length < 120; d.setDate(d.getDate() + 1)) {
            if (!weekend && (d.getDay() === 0 || d.getDay() === 6)) continue;
            const o = {};
            for (let t = mins(f.t1.value); t + step <= mins(f.t2.value); t += step) o[tkey(t)] = true;
            days[kOf(d)] = o;
          }
          if (!Object.values(days).some((o) => Object.keys(o).length)) { toast('만들어지는 시간이 없어요'); return; }
          fine({ title: f.title.value.trim(), note: '', closeAt: 0, days, step }, null);
        } }, '확인'))), list);
    }

    /* ---- 2단계: 칸마다 잠그기 · 날짜별로 다르게 ---- */
    function draftOf(c) {
      const days = {};
      c.slots.forEach((sid) => { (days[sid.slice(0, 8)] = days[sid.slice(0, 8)] || {})[sid.slice(9, 13)] = true; });
      return { title: c.title || '', note: c.note || '', closeAt: c.closeAt || 0, days, step: 20 };
    }
    function fine(dr, c) {
      stop();
      let booked = {};
      const total = () => Object.values(dr.days).reduce((n, o) => n + Object.values(o).filter(Boolean).length, 0);
      const draw = () => {
        const keys = Object.keys(dr.days).sort();
        const tIn = el('input', { value: dr.title, placeholder: '제목 (예: 2학기 진로 상담)', maxlength: 40, oninput: (e) => { dr.title = e.target.value; } });
        const nIn = el('input', { value: dr.note, placeholder: '안내 (선택)', maxlength: 200, oninput: (e) => { dr.note = e.target.value; } });
        const cIn = el('input', { type: 'datetime-local', value: dr.closeAt ? new Date(dr.closeAt - new Date(dr.closeAt).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '', onchange: (e) => { dr.closeAt = e.target.value ? new Date(e.target.value).getTime() : 0; } });
        const addDate = el('input', { type: 'date' });
        const dayCard = (k) => {
          const o = dr.days[k], ts = Object.keys(o).sort();
          const anyBooked = ts.some((t) => booked[k + '_' + t]);
          const allOn = ts.length && ts.every((t) => o[t]);
          const tm = el('input', { type: 'time', 'aria-label': '시간 추가' });
          return el('div', { class: 'cdc' },
            el('div', { class: 'crow2' }, el('b', { class: 'cday' }, dayLabel(k)), el('span', { class: 'grow' }),
              el('button', { class: 'ib sm', type: 'button', title: allOn ? '하루 전체 잠그기' : '하루 전체 열기', 'aria-label': '하루 전체 잠그기', onclick: () => { ts.forEach((t) => { if (!booked[k + '_' + t]) o[t] = !allOn; }); draw(); } }, icon(allOn ? 'lock' : 'check')),
              el('button', { class: 'ib sm', type: 'button', title: '이 날 다시 만들기', 'aria-label': '이 날 다시 만들기', onclick: () => regen(k) }, icon('repeat')),
              anyBooked ? null : el('button', { class: 'ib sm', type: 'button', title: '이 날 삭제', 'aria-label': '이 날 삭제', onclick: () => { delete dr.days[k]; draw(); } }, icon('trash'))),
            el('div', { class: 'cchips' }, ts.map((t) => {
              const b = booked[k + '_' + t];
              return el('button', { type: 'button', class: 'cchip' + (o[t] ? '' : ' off') + (b ? ' bk' : ''), disabled: !!b, title: b ? `${b.name} 신청` : o[t] ? '눌러서 잠그기' : '눌러서 열기',
                onclick: () => { o[t] = !o[t]; draw(); } }, o[t] ? null : icon('lock'), `${t.slice(0, 2)}:${t.slice(2)}`, b ? el('small', {}, b.name) : null);
            })),
            el('div', { class: 'crow2' }, tm, el('button', { class: 'ghost sm', type: 'button', onclick: () => {
              if (!tm.value) return; const t = tm.value.replace(':', ''); if (!(t in o)) o[t] = true; draw();
            } }, icon('plus'), '시간 추가')));
        };
        const regen = (k) => {
          const a = el('input', { type: 'time', value: '16:00' }), z = el('input', { type: 'time', value: '18:00' });
          const st = el('select', {}, [10, 20, 30, 40, 50, 60].map((n) => el('option', { value: n, selected: n === (dr.step || 20) }, n + '분')));
          const bar = el('div', { class: 'cregen' }, a, '~', z, st, el('button', { class: 'pri sm', type: 'button', onclick: () => {
            const o = {}; Object.keys(dr.days[k]).forEach((t) => { if (booked[k + '_' + t]) o[t] = true; });
            for (let t = mins(a.value); t + +st.value <= mins(z.value); t += +st.value) o[tkey(t)] = true;
            dr.days[k] = o; draw();
          } }, '적용'));
          const card = [...host.querySelectorAll('.cdc')].find((x) => x.querySelector('.cday').textContent === dayLabel(k));
          if (card && !card.querySelector('.cregen')) card.querySelector('.crow2').after(bar);
        };
        shell(c ? '테이블 수정' : '테이블 만들기 · 2/2', el('div', { class: 'cform' },
          tIn, nIn, r('신청 마감', cIn),
          el('div', { class: 'crow2' }, el('span', { class: 'mut' }, `열린 칸 ${total()}`), el('span', { class: 'grow' }), addDate,
            el('button', { class: 'ghost sm', type: 'button', onclick: () => { if (!addDate.value) return; const k = addDate.value.replace(/-/g, ''); dr.days[k] = dr.days[k] || {}; draw(); } }, icon('plus'), '날짜')),
          el('div', { class: 'cgrid' }, keys.length ? keys.map(dayCard) : el('div', { class: 'mut' }, '날짜가 없어요')),
          el('div', { class: 'pfh' }, '칸을 누르면 잠겨요 (잠긴 칸은 학생이 고를 수 없어요). 신청이 들어온 칸은 잠글 수 없어요.'),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'pri', type: 'button', onclick: async (e) => {
            const slots = [];
            Object.keys(dr.days).sort().forEach((k) => Object.keys(dr.days[k]).sort().forEach((t) => { if (dr.days[k][t]) slots.push(`${k}_${t}`); }));
            if (!slots.length) { toast('열린 칸이 없어요'); return; }
            if (slots.length > 400) { toast('칸이 너무 많아요 (최대 400)'); return; }
            e.currentTarget.disabled = true;
            try {
              const data = { title: dr.title.trim() || '상담 신청', note: dr.note.trim(), slots, closeAt: dr.closeAt || 0 };
              let id;
              if (c) { await S.cloud.consultUpdate(c.id, data); id = c.id; } else id = await S.cloud.consultCreate(data);
              const nc = (await S.cloud.consultList()).find((x) => x.id === id);
              toast('완성! 링크를 복사해 학생에게 보내요'); detail(nc);
            } catch (er) { console.error(er); toast('저장하지 못했어요'); e.currentTarget.disabled = false; }
          } }, icon('check'), '완성'))), c ? list : quick);
      };
      draw();
      if (c) unsub = S.cloud.consultWatchBooks(c.id, (books) => { booked = {}; books.filter((b) => !b.cancelled).forEach((b) => { booked[b.id] = b; }); draw(); }, () => {});
    }

    /* ---- 완성된 테이블: 링크 복사 · 신청 현황 ---- */
    function detail(c) {
      S.cs = { c };
      const draw = (books) => {
        const by = {}; books.filter((b) => !b.cancelled).forEach((b) => { by[b.id] = b; });
        const days = {};
        c.slots.slice().sort().forEach((sid) => { (days[sid.slice(0, 8)] = days[sid.slice(0, 8)] || []).push(sid); });
        const n = Object.keys(by).length;
        shell(c.title || '상담', el('div', { class: 'cdet' },
          el('div', { class: 'crow2' }, el('span', { class: 'mut' }, `신청 ${n} / ${c.slots.length}`), el('span', { class: 'grow' }),
            el('button', { class: 'pri sm', type: 'button', onclick: () => copyText(bookUrl(c.id)) }, icon('link'), '공유 링크 복사'),
            el('button', { class: 'ib', type: 'button', title: '수정', 'aria-label': '수정', onclick: () => fine(draftOf(c), c) }, icon('edit')),
            el('button', { class: 'ib', type: 'button', title: '삭제', 'aria-label': '삭제', onclick: () => del(c) }, icon('trash'))),
          el('div', { class: 'cgrid' }, Object.keys(days).map((k) =>
            [el('div', { class: 'cday' }, dayLabel(k)),
              days[k].map((sid) => { const b = by[sid]; return el('div', { class: 'cslot' + (b ? ' on' : '') },
                el('span', { class: 'ct2' }, hm(sid)),
                b ? el('span', { class: 'cn' }, el('b', {}, b.name), b.info ? el('small', {}, ' ' + b.info) : null) : el('span', { class: 'mut' }, '—'),
                b ? el('button', { class: 'ib', type: 'button', title: '신청 지우기', 'aria-label': '신청 지우기', onclick: async () => {
                  if (!(await ask(`${b.name} 학생의 신청을 지울까요?`, '지우기'))) return;
                  try { await S.cloud.consultRemoveBooking(c.id, sid); } catch (e) { toast('지우지 못했어요'); }
                } }, icon('close')) : null); })]))), list);
      };
      stop();
      draw([]);
      unsub = S.cloud.consultWatchBooks(c.id, draw, () => toast('불러오지 못했어요'));
    }
    if (S.cs && S.cs.c) detail(S.cs.c); else list();
    return host;
  }

  /* ================= 위젯 이동·크기 변경 (Electron) ================= */
  function initWidgetEdit() {
    if (!IS_WIDGET) return;
    const api = window.hagisiroWidget;
    const btn = el('button', { id: 'wmove', type: 'button', title: '이동·크기 변경', 'aria-label': '이동·크기 변경', onclick: () => toggle() }, icon('move'));
    let layer = null;
    function toggle() {
      if (layer) { layer.remove(); layer = null; document.body.classList.remove('wedit'); return; }
      document.body.classList.add('wedit');
      layer = el('div', { id: 'wedit' }, ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].map((e) => el('i', { 'data-e': e })));
      let drag = null;
      ['dragstart', 'selectstart', 'contextmenu'].forEach((t) => layer.addEventListener(t, (ev) => ev.preventDefault()));
      layer.addEventListener('pointerdown', async (ev) => {
        ev.preventDefault();
        window.getSelection && window.getSelection().removeAllRanges();
        if (!api) return;
        const mode = ev.target.dataset.e || 'move';
        layer.setPointerCapture(ev.pointerId);
        drag = { mode, sx: ev.screenX, sy: ev.screenY, b: null };
        const b = await api.getBounds();
        if (drag) drag.b = b;
      });
      layer.addEventListener('pointermove', (ev) => {
        if (!drag || !drag.b) return;
        const dx = ev.screenX - drag.sx, dy = ev.screenY - drag.sy, o = drag.b;
        let { x, y, width, height } = o;
        const m = drag.mode;
        if (m === 'move') { x += dx; y += dy; } else {
          const e = m.replace('n', 't').replace('s', 'b').replace('w', 'l').replace('e', 'r');
          if (e.includes('l')) { x += dx; width -= dx; }
          if (e.includes('r')) width += dx;
          if (e.includes('t')) { y += dy; height -= dy; }
          if (e.includes('b')) height += dy;
        }
        const map = { n: 't', s: 'b', w: 'l', e: 'r' };
        api.setBounds({ x, y, width, height }, m === 'move' ? 'move' : m.split('').map((ch) => map[ch]).join(''));
      });
      const end = () => { if (drag && api) api.done(); drag = null; };
      layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
      document.body.append(layer);
    }
    document.body.append(btn);
  }

  /* ================= 토스트 / 키보드 ================= */
  let toastT;
  function toast(msg, undo) {
    const t = $('#toast');
    t.hidden = false;
    t.replaceChildren(...[el('span', {}, msg), undo ? el('button', { onclick: () => { undo(); t.hidden = true; } }, '되돌리기') : null].filter(Boolean));
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
  initWidgetEdit();
  { const tp = $('#top'); if (tp && window.ResizeObserver) new ResizeObserver(() => fitTop()).observe(tp); }
  boot();
})();
