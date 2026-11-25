/* Hagisiro — 캘린더 · 할 일 · 출결 */
(function () {
  'use strict';
  const P = window.Parser;

  /* ================= 유틸 ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  /* 결석·지각·조퇴·결과 개수 (0은 생략, 일·주·월 모두 같은 모양, 색은 표의 색과 동일) */
  function sumLine(recs) {
    const parts = TYPES.map((t) => [t, recs.filter((a) => a.type === t).length]).filter((x) => x[1]);
    if (!parts.length) return '기록 없음';
    const out = [];
    const nodoc = recs.filter((a) => a.type === '결석' && !a.doc).length; // 결석은 서류를 받아요
    parts.forEach((x, i) => {
      if (i) out.push(' · ');
      out.push(el('span', { class: 'sc t-' + x[0] }, `${x[0]} ${x[1]}`));
      if (x[0] === '결석' && nodoc) out.push(' · ', el('span', { class: 'sc t-결석' }, `서류 미제출 ${nodoc}`));
    });
    return out;
  }
  const SHORT = { 결석: '결', 지각: '지', 조퇴: '조', 결과: '과' };
  const { CATS, TYPES, KINDS, END } = P;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const byOrd = (a, b) => (a.ord || 0) - (b.ord || 0) || (a.created || 0) - (b.created || 0);
  const isMobile = () => !/[?&]widget/.test(location.search) && !!(window.matchMedia && window.matchMedia('(max-width:700px)').matches);
  /* 손가락으로만 쓰는 기기(태블릿 등): 두 번 누르기가 잘 안 먹어서, 날짜 칸을 한 번 누르면 바로 입력창이 떠요 */
  const tapEdit = () => isMobile() || (!/[?&]widget/.test(location.search) && !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches));
  const md = (ds) => { const d = parseYmd(ds); return `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`; };
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
    /* 아이콘만 있는 버튼은 이름 툴팁을 항상 단다 */
    if (tag === 'button' && !e.title && e.getAttribute('aria-label') && !e.textContent.trim()) e.title = e.getAttribute('aria-label');
    return e;
  }

  /* 아이콘은 전부 벡터(SVG): 24칸 격자 · 선 두께 2.7 · 끝과 꺾임은 둥글게. 글자(•, /, ↻ …)로 기호를 만들지 않는다 */
  const ICON = {
    left: '<path d="M14.5 6l-6 6 6 6"/>',
    arrowL: '<path d="M19.5 12h-15M11 5.5L4.5 12 11 18.5"/>',
    uturn: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    check: '<path d="M5 12.8l4.6 4.6L19 7.4"/>',
    done: '<path d="M18 14.3V16.7A3 3 0 0 1 15 19.7H7A3 3 0 0 1 4 16.7V8.7A3 3 0 0 1 7 5.7H12.8"/><path d="M8.3 10.9l3.5 3.5 7.14-7.6"/>',
    dday: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.4 8.2v7.6h2.3a3.8 3.8 0 000-7.6z"/>',
    search: '<circle cx="10.5" cy="10.5" r="7"/><path d="M16 16l5 5"/>',
    gear: '<path d="M12.00 2.70 L12.32 2.71 L12.65 2.74 L12.97 2.79 L13.28 2.88 L13.58 3.04 L13.84 3.35 L14.04 3.83 L14.17 4.42 L14.30 4.91 L14.46 5.23 L14.66 5.43 L14.86 5.57 L15.07 5.70 L15.29 5.82 L15.50 5.94 L15.71 6.06 L15.92 6.19 L16.14 6.31 L16.36 6.41 L16.63 6.48 L16.99 6.46 L17.48 6.33 L18.05 6.15 L18.57 6.08 L18.97 6.15 L19.26 6.33 L19.49 6.56 L19.70 6.81 L19.88 7.07 L20.05 7.35 L20.21 7.64 L20.35 7.93 L20.46 8.23 L20.54 8.55 L20.55 8.89 L20.41 9.27 L20.09 9.68 L19.65 10.09 L19.29 10.45 L19.10 10.75 L19.02 11.01 L19.00 11.26 L19.00 11.51 L19.00 11.76 L19.00 12.00 L19.00 12.24 L19.00 12.49 L19.00 12.74 L19.02 12.99 L19.10 13.25 L19.29 13.55 L19.65 13.91 L20.09 14.32 L20.41 14.73 L20.55 15.11 L20.54 15.45 L20.46 15.77 L20.35 16.07 L20.21 16.36 L20.05 16.65 L19.88 16.93 L19.70 17.19 L19.49 17.44 L19.26 17.67 L18.97 17.85 L18.57 17.92 L18.05 17.85 L17.48 17.67 L16.99 17.54 L16.63 17.52 L16.36 17.59 L16.14 17.69 L15.92 17.81 L15.71 17.94 L15.50 18.06 L15.29 18.18 L15.07 18.30 L14.86 18.43 L14.66 18.57 L14.46 18.77 L14.30 19.09 L14.17 19.58 L14.04 20.17 L13.84 20.65 L13.58 20.96 L13.28 21.12 L12.97 21.21 L12.65 21.26 L12.32 21.29 L12.00 21.30 L11.68 21.29 L11.35 21.26 L11.03 21.21 L10.72 21.12 L10.42 20.96 L10.16 20.65 L9.96 20.17 L9.83 19.58 L9.70 19.09 L9.54 18.77 L9.34 18.57 L9.14 18.43 L8.93 18.30 L8.71 18.18 L8.50 18.06 L8.29 17.94 L8.08 17.81 L7.86 17.69 L7.64 17.59 L7.37 17.52 L7.01 17.54 L6.52 17.67 L5.95 17.85 L5.43 17.92 L5.03 17.85 L4.74 17.67 L4.51 17.44 L4.30 17.19 L4.12 16.93 L3.95 16.65 L3.79 16.36 L3.65 16.07 L3.54 15.77 L3.46 15.45 L3.45 15.11 L3.59 14.73 L3.91 14.32 L4.35 13.91 L4.71 13.55 L4.90 13.25 L4.98 12.99 L5.00 12.74 L5.00 12.49 L5.00 12.24 L5.00 12.00 L5.00 11.76 L5.00 11.51 L5.00 11.26 L4.98 11.01 L4.90 10.75 L4.71 10.45 L4.35 10.09 L3.91 9.68 L3.59 9.27 L3.45 8.89 L3.46 8.55 L3.54 8.23 L3.65 7.93 L3.79 7.64 L3.95 7.35 L4.12 7.07 L4.30 6.81 L4.51 6.56 L4.74 6.33 L5.03 6.15 L5.43 6.08 L5.95 6.15 L6.52 6.33 L7.01 6.46 L7.37 6.48 L7.64 6.41 L7.86 6.31 L8.08 6.19 L8.29 6.06 L8.50 5.94 L8.71 5.82 L8.93 5.70 L9.14 5.57 L9.34 5.43 L9.54 5.23 L9.70 4.91 L9.83 4.42 L9.96 3.83 L10.16 3.35 L10.42 3.04 L10.72 2.88 L11.03 2.79 L11.35 2.74 L11.68 2.71z"/><circle cx="12" cy="12" r="2.7"/>',
    google: '<path stroke="none" fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path stroke="none" fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path stroke="none" fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path stroke="none" fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>',
    logout: '<path d="M10 5.5H7a2 2 0 00-2 2v9a2 2 0 002 2h3"/><path d="M14.5 8.5L18 12l-3.5 3.5M18 12H9.5"/>',
    power: '<path d="M12 3.8v7.2"/><path d="M7.2 6.7a7.2 7.2 0 109.6 0"/>',
    minimize: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M8 15h8"/>',
    bell: '<path d="M6 15.75v-6a6 6 0 0112 0v6l1.5 2h-15zM10 20.25h4"/>',
    school: '<path d="M10.5 2.8V11"/><path d="M11.1 3.4l5.6 2.5-5.6 2.5z" fill="currentColor"/><rect x="3.5" y="11" width="17" height="9.5" rx="2.2"/><path d="M10 20.5v-5.5h4v5.5"/>',
    userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.7 2.8-5.8 6.5-5.8s6.5 2.1 6.5 5.8M19 8v6M16 11h6"/>',
    utensils: '<path d="M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17"/>',
    listedit: '<path d="M4 7h9M4 12h4.5M4 17h3.5"/><g transform="translate(15 15) scale(.8) translate(-12 -12)"><path stroke-width="2.7" d="M5.5 18.5l.9-3.6L15 6.3a2 2 0 012.8 2.8l-8.6 8.6-3.7.8z"/></g>',
    sliders: '<path d="M4.5 8h7M17.5 8h2M4.5 16h2M12.5 16h7"/><circle cx="14.5" cy="8" r="2.6"/><circle cx="9.5" cy="16" r="2.6"/>',
    more: '<circle cx="5.5" cy="12" r="1.9" class="f"/><circle cx="12" cy="12" r="1.9" class="f"/><circle cx="18.5" cy="12" r="1.9" class="f"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    download: '<path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5.5 19.5h13"/>',
    users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17.3" cy="9.3" r="2.4"/><path d="M16.8 14.4c2.3.1 3.8 1.7 4.2 4.3"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    phone: '<path d="M3.20 6.00L4.27 4.50Q5.20 3.20 6.80 3.20L8.40 3.20Q10.00 3.20 10.72 4.63L12.26 7.73Q12.80 8.80 11.95 9.65L10.80 10.80Q12.00 12.00 13.20 13.20L14.35 12.05Q15.20 11.20 16.27 11.74L19.37 13.28Q20.80 14.00 20.80 15.60L20.80 17.20Q20.80 18.80 19.50 19.73L18.00 20.80Q5.30 18.60 3.20 6.00z"/>',
    table: '<rect x="3.5" y="4" width="17" height="16" rx="3.2"/><path d="M3.5 8.2h17M8.2 8.2V20M8.2 14.1h12.3M14.35 8.2V20"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M3.5 17.5l6-6 8 8"/><circle cx="15" cy="9.4" r="2.2" class="f"/>',
    edit: '<g transform="translate(12 12) scale(1.22) translate(-12 -12)"><path stroke-width="2.2" d="M5.5 18.5l.9-3.6L15 6.3a2 2 0 012.8 2.8l-8.6 8.6-3.7.8z"/></g>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.9 11.5a1 1 0 001 .9h6.2a1 1 0 001-.9L17 7"/>',
    info: '<circle cx="12" cy="12" r="8.2"/><path d="M12 13v3.2M12 7.8v1.3"/>',
    clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3.2 2"/>',
    enter: '<path d="M19.5 5.5v7a3 3 0 01-3 3H5.5"/><path d="M10 10.5l-4.5 5 4.5 5"/>',
    palette: '<path d="M12 3.8a8.2 8.2 0 100 16.4c1.5 0 2.2-1 2.2-2 0-1.5-1.1-1.9-1.1-3 0-1 .8-1.8 1.9-1.8H17a3.3 3.3 0 003.3-3.3c0-3.8-3.7-6.3-8.3-6.3z"/><circle cx="7.7" cy="11.9" r="1.75" class="f"/><circle cx="10.5" cy="7.7" r="1.75" class="f"/><circle cx="14.9" cy="8.3" r="1.75" class="f"/>',
    repeat: '<path d="M16.5 3.5l3.2 3.2-3.2 3.2"/><path d="M4.3 12v-1.3a4 4 0 014-4h11.4"/><path d="M7.5 20.5l-3.2-3.2 3.2-3.2"/><path d="M19.7 12v1.3a4 4 0 01-4 4H4.3"/>',
    dot: '<circle cx="12" cy="12" r="4.2" class="f"/>',
    slash: '<path d="M8 19.5l8-15"/>',
    progress: '<path d="M10 6.2c-1.4-1.1-3.5-1.6-6.3-1.4v10.8c2.8-.2 4.9.3 6.3 1.4v-10.8z"/><path d="M10 6.2c1.4-1.1 3.5-1.6 6.3-1.4V7.6"/><path d="M10 16.8c.8-.6 1.4-.9 2-.8"/><path d="M13.6 11.8l2.3 2.3 4.7-5"/>',
    up: '<path d="M7 14.5l5-5 5 5"/>',
    down: '<path d="M7 9.5l5 5 5-5"/>',
    sy_none: '<circle cx="12" cy="12" r="7.5" pathLength="80" stroke-dasharray="1 9" stroke-dashoffset="-0.5" stroke-width="2.6"/>',
    sy_circle: '<circle cx="12" cy="12" r="7.6" stroke-width="2.6"/>',
    sy_tri: '<path stroke-width="2.6" d="M12 4.8l8 14H4z"/>',
    sy_x: '<path stroke-width="2.6" d="M6 6l12 12M18 6L6 18"/>',
    sy_check: '<path stroke-width="2.6" d="M5 12.8l4.6 4.6L19 7.4"/>',
    sy_star: '<path fill="currentColor" stroke-width="2.6" d="M12.00 2.80 L14.41 8.68 L20.75 9.16 L15.90 13.27 L17.41 19.44 L12.00 16.10 L6.59 19.44 L8.10 13.27 L3.25 9.16 L9.59 8.68z"/>',
    sy_flower: '<path fill="currentColor" fill-rule="evenodd" stroke-width="0.8" d="M14.42 7.80 A2.8 2.8 0 1 1 16.85 12.00 A2.8 2.8 0 1 1 14.42 16.20 A2.8 2.8 0 1 1 9.58 16.20 A2.8 2.8 0 1 1 7.15 12.00 A2.8 2.8 0 1 1 9.58 7.80 A2.8 2.8 0 1 1 14.42 7.80z M15.6 12a3.6 3.6 0 11-7.2 0 3.6 3.6 0 017.2 0z"/>',
    sy_flag: '<path stroke-width="2.6" d="M8 3.6V19.8"/><path fill="currentColor" stroke-width="2.6" d="M8 3.6L20 9L8 14.4z"/>',
    link: '<path d="M10.17 14.17A4 4 0 0 0 15.7 14l3-3A4.03 4.03 0 0 0 13.54 4.85"/><path d="M13.83 9.83A4 4 0 0 0 8.3 10l-3 3A4.03 4.03 0 0 0 10.46 19.15"/>',
    qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="14.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="3.5" y="14.5" width="6" height="6" rx="1.2"/><path d="M14.5 14.5h2.2v2.2M20.5 14.5v.01M14.5 20.5v.01M17.6 20.5h2.9v-2.6"/>',
    share: '<path stroke-width="2.2" d="M9.1 11.1l5.8-3.3M9.1 12.9l5.8 3.3"/><circle cx="7.2" cy="12" r="2.2" fill="currentColor"/><circle cx="16.8" cy="7.2" r="2.2" fill="currentColor"/><circle cx="16.8" cy="16.8" r="2.2" fill="currentColor"/>',
    refresh: '<path d="M18.89 15.21A7.6 7.6 0 1 1 17.82 7.11"/><path d="M19.73 5.54L19.43 9.03L15.94 8.72"/>',
    menu: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2.4"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
    move: '<path d="M12 3.5v17M3.5 12h17M12 3.5l-2.8 2.8M12 3.5l2.8 2.8M12 20.5l-2.8-2.8M12 20.5l2.8-2.8M3.5 12l2.8-2.8M3.5 12l2.8 2.8M20.5 12l-2.8-2.8M20.5 12l-2.8 2.8"/>',
    weekNow: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10.5h17M8 3v4M16 3v4M8 15.5h8"/>',
    attend: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.7 2.8-5.8 6.5-5.8"/><path d="M14.2 17.9l2.4 2.4 4.9-5.2"/>',
    chat: '<path d="M10.44 17.70L5.6 20.2L5.11 15.37A9 6.8 0 1 1 10.44 17.70z"/><path d="M8 10.6h.01M12 10.6h.01M16 10.6h.01"/>',
    excel: '<rect x="3.5" y="4" width="17" height="16" rx="3.2"/><path d="M14.8 4v16M14.8 9.3h5.7M14.8 14.7h5.7"/><path class="f" d="M6.4 8h1.9L11.9 16h-1.9zM10 8h1.9L8.3 16H6.4z"/>',
    today: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10.5h17M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="2.65" class="f"/>',
    backspace: '<path d="M9.2 5.5H19a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.2L3.5 12z"/><path d="M12.6 9.4l4.2 5.2M16.8 9.4l-4.2 5.2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10.5h17M8 3v4M16 3v4"/>',
    spade: '<path fill="currentColor" stroke-width="2.6" d="M12 4.8C15 8 18 10 18 12.8a3 3 0 0 1-5.4 1.8c.1 1.4.4 2.7 1.2 4.6h-3.6c.8-1.9 1.1-3.2 1.2-4.6A3 3 0 0 1 6 12.8C6 10 9 8 12 4.8z"/>',
    b_sq: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" class="f"/>',
    b_ring: '<circle cx="12" cy="12" r="4.6" stroke-width="2.2"/>',
    b_dash: '<path d="M7 12h10" stroke-width="2.6"/>',
    b_spade: '<path fill="currentColor" stroke-width="2.6" d="M12 4.8C15 8 18 10 18 12.8a3 3 0 0 1-5.4 1.8c.1 1.4.4 2.7 1.2 4.6h-3.6c.8-1.9 1.1-3.2 1.2-4.6A3 3 0 0 1 6 12.8C6 10 9 8 12 4.8z"/>',
    b_club: '<g fill="currentColor" stroke-width="2.6"><circle cx="12" cy="8.3" r="2.4"/><circle cx="8.2" cy="13.3" r="2.4"/><circle cx="15.8" cy="13.3" r="2.4"/><path d="M12 12.4c0 2.4-.4 4.2-1.5 6.8h3c-1.1-2.6-1.5-4.4-1.5-6.8z"/></g>',
    b_diamond: '<path fill="currentColor" stroke-width="2.6" d="M12 4.6L17.6 12 12 19.4 6.4 12z"/>',
    b_heart: '<path fill="currentColor" stroke-width="2.6" d="M12 18.4L5.8 12.2A3.5 3.5 0 0 1 10.6 7.1L12 8.5l1.4-1.4a3.5 3.5 0 0 1 4.8 5.1z"/>',
  };
  /* 글머리 기호 8종 (정사각형~줄표는 기본색, 나머지는 글씨 팔레트에서 뽑은 색) */
  const BUL = [['sq', '사각형'], ['ring', '원'], ['dot', '점'], ['dash', '줄표'], ['spade', '스페이드'], ['club', '클로버'], ['diamond', '다이아몬드'], ['heart', '하트']];
  const bulIcon = (k) => icon(k && k !== 'dot' ? 'b_' + k : 'dot');
  /* k: 할 일에 따로 정한 기호 (비면 설정의 기본 기호) */
  function setBullet(span, k) { const e = k || PF.tbl || 'dot'; span.dataset.raw = k || ''; span.dataset.bl = e === 'dot' ? '' : e; span.replaceChildren(bulIcon(e)); }
  const iconCache = new Map(); // 아이콘은 한 번만 해석해 두고 복제해서 써요 (매번 SVG 문자열을 해석하지 않게)
  function icon(name) {
    let t = iconCache.get(name);
    if (!t) {
      t = el('span', { class: 'ic' });
      t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
      iconCache.set(name, t);
    }
    return t.cloneNode(true);
  }
  /* 시각 고르기: 24시간제 드롭다운 (시 · 분). value 는 'HH:MM'. limit(최소, 최대)로 고를 수 있는 범위를 막아요 */
  function timeSel(val, blank, fine) { // fine: 분을 1분 단위로 (기본은 5분 단위)
    const isB = blank && !val; // blank: 빈칸을 고를 수 있고 처음에도 비어 있음 (신청 마감처럼 선택 사항일 때)
    const [h0, m0] = isB ? [-1, -1] : (val || '16:00').split(':').map(Number);
    const bo = (t) => (blank ? [el('option', { value: '', selected: isB }, t)] : []);
    const hs = el('select', { 'aria-label': '시' }, bo('시'), Array.from({ length: 24 }, (_, i) => el('option', { value: i, selected: i === h0 }, pad(i))));
    const ms = el('select', { 'aria-label': '분' }, bo('분'), Array.from({ length: fine ? 60 : 12 }, (_, i) => el('option', { value: i * (fine ? 1 : 5), selected: i * (fine ? 1 : 5) === m0 }, pad(i * (fine ? 1 : 5)))));
    const w = el('span', { class: 'tsel' }, hs, el('span', {}, ':'), ms);
    let lo = 0, hi = 1439;
    const toM = (v) => { const [h, m] = String(v).split(':').map(Number); return h * 60 + m; };
    const ph = () => { if (blank) { hs.classList.toggle('ph', hs.value === ''); ms.classList.toggle('ph', ms.value === ''); } };
    const refresh = () => {
      ph();
      if (blank) { if (hs.value === '') { ms.value = ''; ph(); return; } if (ms.value === '') ms.value = '0'; ph(); }
      let c = +hs.value * 60 + +ms.value;
      c = Math.min(hi, Math.max(lo, c));
      hs.value = Math.floor(c / 60); ms.value = c % 60;
      [...hs.options].forEach((o) => { o.disabled = +o.value * 60 + (fine ? 59 : 55) < lo || +o.value * 60 > hi; });
      [...ms.options].forEach((o) => { const t = +hs.value * 60 + +o.value; o.disabled = t < lo || t > hi; });
    };
    hs.addEventListener('change', refresh); ms.addEventListener('change', refresh);
    Object.defineProperty(w, 'value', { get: () => (hs.value === '' ? '' : `${pad(+hs.value)}:${pad(+ms.value)}`), set: (v) => { if (blank && !v) { hs.value = ''; ms.value = ''; refresh(); return; } const [h, m] = String(v).split(':').map(Number); hs.value = h; ms.value = m; refresh(); } });
    ph();
    w.limit = (min, max) => { lo = min ? toM(min) : 0; hi = max ? toM(max) : 1439; refresh(); };
    return w;
  }
  const STEPS = [10, 20, 30, 40, 50, 60, 120, 180];
  const stepOpts = (cur) => STEPS.map((n) => el('option', { value: n, selected: n === cur }, n >= 60 ? `${n / 60}시간` : `${n}분`));
  /* 입력칸 꾸밈: 왼쪽 연필(채울 수 있는 칸), 오른쪽 X(내용이 있을 때만 보이고 자리는 항상 비워둬요) */
  function fld(input) {
    const multi = input.tagName === 'TEXTAREA'; // 여러 줄 입력창에는 지우기(X) 버튼을 두지 않아요
    const clr = multi ? null : el('button', { class: 'clr', type: 'button', tabindex: '-1', 'aria-label': '삭제' }, icon('close'));
    const sync = () => { if (clr) clr.style.visibility = input.value ? 'visible' : 'hidden'; w.classList.toggle('blank0', !input.value); };
    if (clr) {
      clr.addEventListener('mousedown', (e) => e.preventDefault());
      clr.addEventListener('click', () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); sync(); input.focus(); });
    }
    input.addEventListener('input', sync);
    const w = el('span', { class: 'fld' + (multi ? ' ta' : '') }, input, clr);
    sync();
    w._sync = sync;
    return w;
  }
  const LOGO = '<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="lg-g" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop offset="0" stop-color="#6d4aff"/><stop offset=".5" stop-color="#2f6df6"/><stop offset="1" stop-color="#12c9b3"/></linearGradient><linearGradient id="lg-g2" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop offset="0" stop-color="#a58fff"/><stop offset=".5" stop-color="#7ea5fa"/><stop offset="1" stop-color="#6cded0"/></linearGradient></defs><rect x="34" y="0" width="30" height="30" rx="9" fill="url(#lg-g2)"/><rect x="0" y="34" width="30" height="30" rx="9" fill="url(#lg-g2)"/><rect x="0" y="0" width="30" height="30" rx="9" fill="url(#lg-g)"/><rect x="34" y="34" width="30" height="30" rx="9" fill="url(#lg-g)"/><path d="M8.7 6.5v17M21.3 6.5v17M8.7 15h12.6" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/><path d="M40 49.5l6.4 6.6 12-14.2" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
    ddays: [], alms: [], todos: [], classes: [], att: [], settings: [], days: [], repeats: [], docs: [], gcal: {},
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
  const PF_DEF = { cal: 'month', weeks: 4, past: 1, lunar: false, terms: false, hol: true, theme: 'auto', opacity: 100, sortDone: true, meal: false, school: null, neisKey: '', anim: true, mgap: false, pastdd: true, tsz: '', tfg: '', tbg: '', tlh: 2, autoDel: false, tbl: '', ab: true, cons: true, hide: [], show: [], mwe: true, mk: ['중식'] };
  const PF = Object.assign(JSON.parse(JSON.stringify(PF_DEF)),
    (() => { try { return JSON.parse(ls.get(PFK) || '{}') || {}; } catch (e) { return {}; } })());
  function normPf() {
    if (!PF.docSel || typeof PF.docSel !== 'object') PF.docSel = {};
    if (!Array.isArray(PF.schools)) PF.schools = [];
    if (PF.school && !PF.schools.some((x) => x.code === PF.school.code)) PF.schools.unshift(PF.school);
    PF.schools = PF.schools.slice(0, 5);
    if (!PF.school && PF.schools.length) PF.school = PF.schools[0];
    PF.weeks = Math.min(6, Math.max(1, Math.round(+PF.weeks) || 4));
    PF.past = Math.min(5, PF.weeks - 1, Math.max(0, Math.round(+PF.past) || 0));
    PF.opacity = Math.min(100, Math.max(30, Math.round(+PF.opacity) || 100));
    if (!['month', 'week'].includes(PF.cal)) PF.cal = 'month';
    if (!['auto', 'light', 'dark'].includes(PF.theme)) PF.theme = 'auto';
  }
  function applyPf() {
    normPf();
    const h = document.documentElement;
    const th = S.ready && S.cloudAvail && !S.user && !S.guest ? PF_DEF.theme : PF.theme; // 로그인 화면은 어느 계정 것도 아니라서 기본 설정을 따라요
    if (th === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', th);
    h.style.setProperty('--wa', PF.opacity + '%');
    h.classList.toggle('noanim', PF.anim === false);
    const FS = { xs: 10, m: 14, l: 16, xl: 19 }, LH = [[1.2, 0], [1.3, 1], [1.4, 1], [1.55, 2], [1.75, 3]];
    const lh = LH[PF.tlh] || LH[2];
    h.style.setProperty('--td-fs', (FS[PF.tsz] || 12) + 'px');
    h.style.setProperty('--td-lh', lh[0]); h.style.setProperty('--td-pad', lh[1] + 'px');
    if (PF.tfg) h.style.setProperty('--tfg-d', PF.tfg); else h.style.removeProperty('--tfg-d');
    if (PF.tbg) h.style.setProperty('--tbg-d', PF.tbg); else h.style.removeProperty('--tbg-d');
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

  /* 저장 실패는 토스트 대신 아이콘 색으로: 새로고침 → (없으면) ⋯ → (없으면) 메뉴 버튼이 빨개져요 */
  function markErr() {
    document.querySelectorAll('#top .err').forEach((n) => n.classList.remove('err'));
    if (!S.saveErr) return;
    const vis = (n) => n && !n.hidden;
    const t = [$('#syncBtn'), $('#ovBtn'), $('#menuBtn')].find(vis);
    if (t) t.classList.add('err');
  }
  function cloudErr(e) {
    console.error(e);
    S.saveErr = true; markErr();
  }
  function saveOk() { if (S.saveErr) { S.saveErr = false; markErr(); } }

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
      if (S.cloud) S.cloud.save(col, obj).then(saveOk, cloudErr); else this.saveLocal();
    },
    del(col, id) {
      S[col] = S[col].filter((x) => x.id !== id);
      if (S.cloud) S.cloud.remove(col, id).then(saveOk, cloudErr); else this.saveLocal();
    },
  };

  /* ---------- 교시 설정: 요일별 기본값 + 날짜별 예외 ---------- */
  const DEFAULT_PERIODS = [0, 7, 7, 7, 7, 7, 0]; // 일~토
  /* 교시 수는 학급마다 따로: 학급 문서의 periods(요일별), 날짜별 예외는 days 문서(classId 포함).
     예전 데이터(학급 구분 없는 공통 설정·예외)는 그대로 모든 학급의 기본값/예외로 읽어요 */
  const cfgPeriods = (cid) => { const c = S.classes.find((x) => x.id === cid); if (c && Array.isArray(c.periods) && c.periods.length === 7) return c.periods; const g = S.settings.find((x) => x.id === 'main'); return (g && g.periods) || DEFAULT_PERIODS; };
  const curCid = () => { const c = curClass(); return c ? c.id : ''; };
  const dayDefault = (ds, cid = curCid()) => cfgPeriods(cid)[parseYmd(ds).getDay()];
  const legacyOvr = (ds) => S.days.find((x) => !x.classId && x.id === ds);
  const ovrOf = (ds, cid = curCid()) => S.days.find((x) => x.classId === cid && x.date === ds) || legacyOvr(ds);
  const lastOf = (ds, cid = curCid()) => { const o = ovrOf(ds, cid); return o ? o.periods : dayDefault(ds, cid); };
  /* 학급 구분 없던 예외를 학급별 예외로 쪼개요 (선택한 학급만 빼고 나머지 학급에 같은 값으로 복사한 뒤 원본 삭제) */
  function splitLegacy(o, exceptCid) {
    S.classes.forEach((c) => { if (c.id !== exceptCid) Data.put('days', { id: `${c.id}_${o.date || o.id}`, date: o.date || o.id, classId: c.id, periods: o.periods }); });
    Data.del('days', o.id);
  }
  function setDayPeriods(ds, n, cid = curCid()) {
    const lg = legacyOvr(ds); if (lg) splitLegacy(lg, cid);
    const mine = S.days.find((x) => x.classId === cid && x.date === ds);
    if (n === dayDefault(ds, cid)) { if (mine) Data.del('days', mine.id); }
    else Data.put('days', { id: `${cid}_${ds}`, date: ds, classId: cid, periods: n });
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
  /* 캘린더 '상담' 버튼: 날짜별 상담 신청 수 (상담표마다 신청 목록을 실시간으로 지켜봐요) */
  function watchConsults() {
    const bw = new Map(); // 상담표 id → { c, books, un }
    const calc = () => {
      const m = {};
      bw.forEach(({ c, books }) => (books || []).filter((b) => !b.cancelled).forEach((b) => {
        const k = String(b.id).slice(0, 8), ds = `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;
        const e = m[ds] || (m[ds] = { n: 0, it: [] }); e.n++;
        let g = e.it.find((x) => x.c.id === c.id); if (!g) e.it.push(g = { c, bs: [] });
        g.bs.push(b);
      }));
      S.cbk = m; if (S.view === 'cal') render();
    };
    const un = S.cloud.consultWatchList((rows) => {
      const ids = new Set(rows.map((r) => r.id));
      bw.forEach((v, id) => { if (!ids.has(id)) { v.un(); bw.delete(id); } });
      rows.forEach((r) => {
        const v = bw.get(r.id);
        if (v) { v.c = r; return; }
        const x = { c: r, books: [], un: null };
        x.un = S.cloud.consultWatchBooks(r.id, (books) => { x.books = books; calc(); }, () => {});
        bw.set(r.id, x);
      });
      calc();
    }, () => {});
    S.unsubStatic.push(() => { un(); bw.forEach((v) => v.un()); bw.clear(); S.cbk = {}; });
  }
  function watchStatic() {
    S.unsubStatic.forEach((f) => f()); S.unsubStatic = [];
    S.clsLoaded = false;
    S.unsubStatic.push(S.cloud.watch('classes', null, (d) => { S.classes = d.sort(byOrd); S.clsLoaded = true; render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watch('settings', null, (d) => { S.settings = d; render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watchDday((d) => { S.ddays = d; render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watchAlarm((d) => { S.alms = d; if (!$('#modal .sdlg')) render(); }, cloudErr));
    S.unsubStatic.push(S.cloud.watch('repeats', null, (d) => { S.repeats = d; render(); }, cloudErr));
    watchConsults();
    S.unsubStatic.push(S.cloud.watch('docs', null, (d) => { S.docs = d; if (!$('#modal .docdlg, #modal .progdlg')) render(); }, cloudErr));
  }

  /* ================= 부팅 / 로그인 ================= */
  function enterLocal() {
    stopWatches(); S.cloud = null; S.user = null; S.clsLoaded = true;
    Data.loadLocal(); S.gcal = {}; render();
  }
  /* 위젯: 로그인 화면을 거치지 않고(이 기기에만 저장 → 메뉴에서 로그인) 로그인하면 구글 로그인 창이 안 닫히고 남아서, 끝났을 때 닫아요 */
  const closeLoginWin = () => { const w = window.hagisiroWidget; if (w && w.loginMode && !loginWinOn) w.loginMode(false); };
  function enterCloud(u) {
    closeLoginWin();
    S.user = u; S.wasIn = true; S.cloud = S.cloudMod; // wasIn: 이 실행에서 로그인한 적이 있으면 로그인 화면에 처음 애니메이션을 다시 보여주지 않아요
    COLS.forEach((c) => { S[c] = []; });
    watchStatic(); watchRange(); maybeMigrate(); render();
  }
  function maybeMigrate() {
    const key = 'hagisiro:migrated:' + S.user.uid;
    const fromLocal = S.fromLocal; S.fromLocal = false; // 이 기기에만 저장하다가 메뉴에서 로그인한 경우
    if (ls.get(key) && !fromLocal) return;
    let d = {};
    try { d = JSON.parse(ls.get(LSK) || '{}'); } catch (e) { d = {}; }
    const n = COLS.reduce((a, c) => a + (d[c] || []).length, 0);
    ls.set(key, '1');
    if (!n) return;
    ask(`이 기기에 저장돼 있던 데이터(${n}건)를 내 계정으로 이동할까요?`, '이동', false).then((yes) => {
      if (!yes) return;
      COLS.forEach((c) => (d[c] || []).forEach((x) => S.cloud.save(c, x).catch(cloudErr)));
    });
  }
  async function boot() {
    try { const w = window.hagisiroWidget; if (w && w.installed) w.installed().then((v) => { S.instWidget = !!v; }, () => {}); } catch (e) { /* 웹·포터블은 그대로 */ }
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
            if (S.user) { S.lgOut = true; S.lgFaded = 0; } // 로그인해 쓰던 중에 로그아웃: 로그인 화면은 처음 애니메이션 없이 부드럽게 나타나요
            S.user = null; S.cloud = null; stopWatches();
            if (S.guest) enterLocal();
            else { COLS.forEach((c) => { S[c] = []; }); S.gcal = {}; S.clsLoaded = true; render(); }
          }
        });
        return;
      } catch (e) {
        console.error(e);
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
  /* 날짜·달·주를 넘길 땐 화면이 벨트처럼 이어져 움직여요: 월별·출결은 좌우, 이번 주 보기는 상하 */
  /* 'tflat'(바탕 한 겹)을 켜고 끌 때는 칸·줄의 바탕색 전환(.12s)이 걸리지 않게 두 프레임 막아요: 안 그러면 한 번 완전히 투명해졌다가 천천히 채워져요 */
  /* 옆으로 들어오는 전환(탭·월/일/주 이동·상담 화면)의 공통 값: 출발은 살짝 느리게 붙고 끝에서 길게 가라앉는 곡선 + 새 화면이 천천히 나타나게 + 맞닿는 선에 옅은 그림자 */
  const SL = { dur: 360, ease: 'cubic-bezier(.3,.08,.2,1)', fade: 200, shadow: (dir) => `${-dir * 10}px 0 18px -8px rgba(0,0,0,.16)`, none: '0 0 0 0 rgba(0,0,0,0)' };
  let flatTok = 0;
  const flatOff = () => { const r = document.documentElement, k = ++flatTok; r.classList.add('notr'); requestAnimationFrame(() => requestAnimationFrame(() => { if (k === flatTok) r.classList.remove('notr'); })); };
  const noAnim = () => document.documentElement.classList.contains('noanim') || !PF.anim;
  /* 출결: 날짜 줄·통계는 제자리에서 사르륵 바뀌고, 아래 표만 벨트처럼 움직여요 */
  const attTable = (c) => { const v = c && c.classList.contains('att') ? c.lastElementChild : null; return v ? v.querySelector(':scope > .mwrap, :scope > .empty') : null; };
  const beltTarget = (c) => (S.view === 'att' ? attTable(c) || c : S.view === 'cal' && !weekMode() && c ? c.querySelector('.days') || c : c);
  function wantBelt(main) {
    const cont = S.cont; S.cont = null;
    if (cont && performance.now() - cont.t0 < 300 && viewKey() === S.lastKey) return cont; // 움직이는 도중에 다시 그려져도 이어서
    if (S.lastKey == null || needLogin() || noAnim() || viewKey() !== S.lastKey || scopeNum() === S.lastSc) return null;
    const oc = main.firstElementChild; if (!oc) return null;
    const node = beltTarget(oc).cloneNode(true);
    node.removeAttribute('id'); node.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    node.inert = true; node.style.pointerEvents = 'none';
    return { node, dir: scopeNum() > S.lastSc ? 1 : -1, s: null, t0: performance.now() };
  }
  function beltEnd() {
    if (!S.belt) return;
    const b = S.belt; S.belt = null;
    S.cont = performance.now() - b.snap.t0 < 300 ? b.snap : null;
    try { b.an.cancel(); if (b.an2) b.an2.cancel(); if (b.an3) b.an3.cancel(); } catch (e) { /* noop */ }
    b.done();
  }
  function startBelt(main, c, t, snap) {
    if (snap.s == null) snap.s = Math.round(Math.abs(S.startDelta || 0) / 7); // 새 화면을 그린 뒤에야 몇 주 움직였는지 알 수 있어요
    const dir = snap.dir, opt = { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' };
    let an, an2, an3, done;
    if (S.view === 'cal' && weekMode()) {
      const grid = c.querySelector('.days');
      const olds = [...snap.node.querySelectorAll('.days > .cell')];
      const news = [...grid.children];
      const R = news.length / 7, Ro = olds.length / 7;
      if (!grid || !R || !Ro || !Number.isInteger(R) || !Number.isInteger(Ro)) return;
      const rkN = (i) => news[i * 7].dataset.rk, rkO = (i) => olds[i * 7].dataset.rk;
      let s = -1; // 몇 줄 움직였는지: 줄 이름(주 시작일)으로 맞춰봐요
      if (dir > 0) { for (let i = 0; i < Ro; i++) if (rkO(i) === rkN(0)) { s = i; break; } if (s < 0) s = Ro; }
      else { for (let i = 0; i < R; i++) if (rkN(i) === rkO(0)) { s = i; break; } if (s < 0) s = Math.min(R, Ro); }
      s = Math.min(s, dir > 0 ? Ro : R);
      if (!s) return;
      const take = (dir > 0 ? olds.slice(0, s * 7) : olds.slice((Ro - s) * 7)).map((n) => n.cloneNode(true));
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0, G = 5, bt = parseFloat(getComputedStyle(grid).borderTopWidth) || 0;
      const nG = [...Array(R).keys()].filter((i) => i > 0 && news[i * 7].classList.contains('mgap')).length;
      const h = (grid.getBoundingClientRect().height - bt - nG * G - gap * (R - 1 + nG)) / R; // 줄 높이를 소수점까지 맞춰서 끝에서 아래가 비지 않게
      const saved = grid.style.cssText, saveRows = news.map((n) => n.style.gridRow);
      const clip = el('div', { class: 'beltclip' });
      clip.style.cssText = 'flex:1;min-height:0;position:relative;overflow:hidden';
      grid.replaceWith(clip); clip.append(grid);
      const all = dir > 0 ? [...take, ...news] : [...news, ...take];
      const tr = []; let tot = 0;
      for (let i = 0; i < all.length / 7; i++) {
        if (i > 0 && all[i * 7].classList.contains('mgap')) tr.push(G);
        all[i * 7].dataset.tr = tr.length + 1; tr.push(h);
        for (let k = 0; k < 7; k++) all[i * 7 + k].style.gridRow = String(tr.length);
      }
      tot = tr.reduce((a, b) => a + b, 0) + gap * (tr.length - 1) + bt;
      grid.style.cssText = `${saved};position:absolute;left:0;right:0;top:0;height:${tot}px;grid-template-rows:${tr.map((x) => x + 'px').join(' ')}`;
      if (dir > 0) grid.prepend(...take); else grid.append(...take);
      const dist = news[0].isConnected ? grid.children[s * 7].getBoundingClientRect().top - grid.getBoundingClientRect().top - bt : 0;
      const a = dir > 0 ? 0 : -dist, b = dir > 0 ? -dist : 0;
      /* 소수 픽셀로 움직이면 줄(1px)이 화면 배율에 따라 번져서 두꺼워 보여요 → 위치를 실제 화면 픽셀 단위로 맞춘 키프레임으로 움직여요 */
      const dpr = window.devicePixelRatio || 1, ez = lgBez(.3, .7, .3, 1), N = 60;
      const kf = Array.from({ length: N + 1 }, (_, i) => ({ offset: i / N, transform: `translateY(${Math.round((a + (b - a) * ez(i / N)) * dpr) / dpr}px)`, easing: i < N ? 'steps(1, jump-end)' : 'linear' }));
      an = grid.animate(kf, { duration: opt.duration, easing: 'linear' });
      done = () => { take.forEach((n) => n.remove()); grid.style.cssText = saved; news.forEach((n, i) => { n.style.gridRow = saveRows[i]; }); if (clip.isConnected) clip.replaceWith(grid); };
    } else {
      const saved = t.style.cssText, node = snap.node;
      const clip = el('div', { class: 'beltclip' });
      clip.style.cssText = t.classList.contains('mwrap') ? `flex:none;min-width:0;width:100%;height:${t.offsetHeight}px;position:relative;overflow:hidden` : 'flex:1;min-height:0;min-width:0;height:100%;position:relative;overflow:hidden';
      t.replaceWith(clip); clip.append(t, node);
      /* 탭을 옮길 때와 같은 방식: 새 화면은 처음부터 70~80%를 덮은 자리(옆에서 22%)에서 짧게 페이드인하며 끝까지 덮고, 옛 화면은 덮인 부분만 잘라내요 */
      /* 바탕은 틀(clip)에 한 겹만 깔고(설정한 투명도 그대로), 옛·새 화면의 바탕은 움직이는 동안 걷어서 겹쳐도 투명도가 변하지 않아요 */
      const upBg = document.body.classList.contains('widget') && !!clip.closest('.att'); // 위젯의 출결 화면만 틀(.att)에 이미 바탕이 있어요 (캘린더·상담·웹 화면은 없음)
      if (!upBg) clip.style.background = 'var(--wbg, var(--bg-s))'; // 출결처럼 위에 이미 바탕이 있는 화면 안이면 또 깔지 않아요(겹쳐서 더 진해져요)
      if (S.view === 'cal' && Math.abs(clip.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom) < 3) clip.style.borderRadius = '0 0 var(--r) var(--r)'; // 창의 맨 아래 모서리에 닿을 때만 (D-day 줄이 아래에 있으면 칸 중간이 둥글게 깎이지 않게)
      t.style.cssText = `${saved};flex:none;width:100%;height:100%;min-width:0;position:relative;z-index:1`;
      node.style.cssText += ';position:absolute;left:0;top:0;width:100%;height:100%;min-width:0;z-index:0;pointer-events:none'; // 덧붙여서 옛 화면에 이미 있던 칸 크기(픽셀로 맞춘 줄·칸 너비)가 지워지지 않게 (지우면 옆으로 밀릴 때 칸 높이가 잠깐 달라져 보여요)
      flatOff(); t.classList.add('tflat'); node.classList.add('tflat');
      const D = 22, fo = { ...opt, duration: SL.dur, easing: SL.ease, fill: 'both' };
      an = t.animate([{ transform: `translateX(${dir * D}%)`, boxShadow: SL.shadow(dir) }, { transform: 'none', boxShadow: SL.none }], fo);
      an2 = t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SL.fade, easing: 'ease-out', fill: 'both' });
      an3 = node.animate(dir > 0
        ? [{ clipPath: `inset(0 ${100 - D}% 0 0)` }, { clipPath: 'inset(0 100% 0 0)' }]
        : [{ clipPath: `inset(0 0 0 ${100 - D}%)` }, { clipPath: 'inset(0 0 0 100%)' }], fo);
      done = () => { flatOff(); t.classList.remove('tflat'); t.style.cssText = saved; if (clip.isConnected) clip.replaceWith(t); };
    }
    const el0 = performance.now() - snap.t0;
    if (el0 > 0) { an.currentTime = el0; if (an2) an2.currentTime = el0; if (an3) an3.currentTime = el0; }
    S.belt = { an, an2, an3, done, snap };
    an.onfinish = () => { if (S.belt && S.belt.an === an) { S.belt = null; done(); } };
  }
  function animateMain(main, snap, ghost) {
    const k = viewKey(), sc = scopeNum();
    const c = main.firstElementChild;
    if (S.lastKey != null && c && !needLogin()) {
      // 출결 안에서 일·주·월을 바꾸거나 날짜를 넘길 땐 학급 버튼·입력칸은 그대로 두고 아래 표만 움직여요
      let t = S.view === 'att' && String(S.lastKey).startsWith('att|') && c.classList.contains('att') && c.lastElementChild ? c.lastElementChild : c;
      let cls = null;
      const attSub = k !== S.lastKey && S.view === 'att' && String(S.lastKey).startsWith('att|') && ghost && !needLogin() && !noAnim() ? (() => { // 출결 안에서 일별·주별·월별을 바꿀 땐 입력칸·설명은 제자리, 아래 표만 옆에서 들어와요
        const SO = { day: 0, week: 1, month: 2 }, from = String(S.lastKey).split('|')[1];
        const ot = attTable(ghost), nt = attTable(c); if (!ot || !nt) return null;
        const node = ot; node.removeAttribute('id'); node.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id')); node.inert = true; node.style.pointerEvents = 'none';
        return { node, nt, dir: (SO[S.sub] ?? 0) >= (SO[from] ?? 0) ? 1 : -1, s: null, t0: performance.now() };
      })() : null;
      if (attSub) {
        [...attSub.nt.parentElement.children].filter((n) => n !== attSub.nt).forEach((n) => n.classList.add('hfade'));
        setTimeout(() => document.querySelectorAll('.hfade').forEach((n) => n.classList.remove('hfade')), 320);
        startBelt(main, c, attSub.nt, attSub);
      } else if (k !== S.lastKey) {
        if (ghost && !needLogin()) { // 새 화면이 옆에서 옛 화면을 덮으며 들어와요
          ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
          ghost.inert = true;
          ghost.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none';
          flatOff(); ghost.classList.add('tflat'); c.classList.add('tflat'); // 바탕은 main에 한 겹만 (설정한 투명도 유지)
          main.style.background = 'var(--wbg, var(--bg-s))'; main.style.borderRadius = '0 0 var(--r) var(--r)'; main.style.overflow = 'hidden';
          c.style.position = 'relative'; c.style.zIndex = '1';
          main.prepend(ghost);
          /* 새 화면은 처음부터 화면의 70~80%를 덮은 자리(옆에서 22%만 떨어진 곳)에서 짧게 페이드인하며 나타나 끝까지 덮어요.
           * 옛 화면은 새 화면이 덮은 부분을 잘라내서, 두 화면이 겹쳐 비치지 않아요. */
          const ORD = { cal: 0, att: 1, consult: 2 }; // 오른쪽 탭으로 가면 오른쪽에서, 왼쪽 탭으로 가면 왼쪽에서
          const dir = (ORD[S.view] ?? 0) >= (ORD[String(S.lastKey).split('|')[0]] ?? 0) ? 1 : -1;
          const D = 22, opt = { duration: SL.dur, easing: SL.ease, fill: 'both' };
          const an = c.animate([{ transform: `translateX(${dir * D}%)`, boxShadow: SL.shadow(dir) }, { transform: 'none', boxShadow: SL.none }], opt);
          const fade = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SL.fade, easing: 'ease-out', fill: 'both' }); // 순간이동이 깜빡임처럼 보이지 않게 짧게 페이드인
          ghost.animate(dir > 0
            ? [{ clipPath: `inset(0 ${100 - D}% 0 0)` }, { clipPath: 'inset(0 100% 0 0)' }]
            : [{ clipPath: `inset(0 0 0 ${100 - D}%)` }, { clipPath: 'inset(0 0 0 100%)' }], opt);
          const fin = () => { an.oncancel = null; an.cancel(); fade.cancel(); ghost.remove(); flatOff(); c.classList.remove('tflat'); c.style.position = ''; c.style.zIndex = ''; main.style.background = ''; main.style.borderRadius = ''; main.style.overflow = ''; };
          an.onfinish = fin; an.oncancel = fin;
        } else cls = 'vin';
      }
      else if (snap) {
        if (S.view === 'att') { // 표만 움직이고, 표 위의 날짜 줄·통계는 제자리에서 부드럽게 바뀜
          const tb = attTable(c);
          if (tb) { [...tb.parentElement.children].filter((n) => n !== tb).forEach((n) => n.classList.add('hfade')); t = tb; }
        }
        if (S.view === 'cal' && !weekMode()) { const dg = c.querySelector('.days'); if (dg) t = dg; } // 요일 줄은 제자리
        setTimeout(() => document.querySelectorAll('.hfade').forEach((n) => n.classList.remove('hfade')), 320);
        startBelt(main, c, t, snap);
      }
      const now = performance.now();
      if (cls) S.anim = { cls, t0: now };
      else if (S.anim && now - S.anim.t0 < 340) cls = S.anim.cls; // 움직이는 도중에 다시 그려져도 처음부터 다시 재생하지 않고 이어서
      if (cls) {
        t.classList.add(cls);
        const el0 = Math.round(now - S.anim.t0);
        if (el0 > 0) t.style.setProperty('--ad', `-${el0}ms`);
        clearTimeout(S.animT); S.animT = setTimeout(() => { S.anim = null; document.querySelectorAll('.vin, .vnext, .vprev').forEach((n) => n.classList.remove('vin', 'vnext', 'vprev')); }, 360 - el0);
      }
    }
    S.lastKey = k; S.lastSc = sc;
  }
  /* 토글(탭·분할 버튼)을 바꾸면 뒤쪽 알약만 이전 자리에서 미끄러져 와요 (글씨는 앞에 그대로) */
  const pillPos = {};
  function slidePills() {
    if (document.documentElement.classList.contains('noanim')) return;
    const seen = {};
    document.querySelectorAll('.tabs, .seg').forEach((box, i) => {
      if (box.closest('#top') && box.classList.contains('seg')) return; // 위쪽 분할 버튼은 알약 없이 글자색만
      const on = box.querySelector(':scope > .on');
      if (!on || !box.offsetWidth) return;
      const key = (box.classList.contains('tabs') ? 't' : 's') + (box.closest('#modal') ? 'm' : box.closest('#top') ? 'top' : 'main') + (box.closest('.pbody') ? S.pfTab : '') + i; // 설정은 대분류마다 따로 (다른 분류의 토글과 한 몸처럼 움직이지 않게)
      const b = box.getBoundingClientRect(), r = on.getBoundingClientRect();
      const g = { l: r.left - b.left - box.clientLeft, w: r.width };
      let pill = box.querySelector(':scope > .pill');
      const fresh = !pill;
      if (!pill) { pill = el('span', { class: 'pill', 'aria-hidden': 'true' }); box.prepend(pill); }
      if (!box.classList.contains('has-pill')) box.classList.add('has-pill');
      Object.assign(pill.style, { left: g.l + 'px', top: (r.top - b.top - box.clientTop) + 'px', width: g.w + 'px', height: r.height + 'px' });
      const prev = pillPos[key];
      const opt = { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' };
      const idx = [...box.children].indexOf(on);
      const cont = prev && prev.run && performance.now() - prev.run.t0 < 300 && Math.abs(prev.run.to - g.l) < 2 ? prev.run : null; // 이동 중에 다시 그려진 경우: 이어서 재생
      if (prev && (prev.idx !== idx || cont) && pill.animate) {
        const run = cont;
        const from = run ? run.from : prev.g;
        if (run || Math.abs(prev.g.l - g.l) > 2) {
          const an = pill.animate([{ left: from.l + 'px', width: from.w + 'px' }, { left: g.l + 'px', width: g.w + 'px' }], opt);
          const t0 = run ? run.t0 : performance.now();
          if (run) an.currentTime = performance.now() - run.t0;
          seen[key] = { g, idx, run: { from, to: g.l, t0 } };
          return;
        }
      }
      seen[key] = { g, idx, run: prev && prev.idx === idx ? prev.run : null };
    });
    Object.keys(pillPos).forEach((k) => delete pillPos[k]);
    Object.assign(pillPos, seen);
  }
  let pillRaf = 0;
  new MutationObserver((ms) => { if (ms.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n.classList && n.classList.contains('pill')))) return; cancelAnimationFrame(pillRaf); pillRaf = requestAnimationFrame(slidePills); })
    .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  /* 팝업·메뉴·알림이 나타날 때만 효과를 줘요 (안의 내용만 다시 그릴 땐 그대로) */
  ['modal', 'sheet'].forEach((id) => {
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
        timer = setTimeout(() => { timer = null; n.classList.remove('closing'); if (logical) { desc.set.call(n, true); rc(); } }, 220);
      },
    });
    n.replaceChildren = (...k) => { if (timer && !k.length) return; if (k.length) cancel(); rc(...k); };
  });

  const closeAsk = (w) => { if (w.classList.contains('closing')) return; w.classList.add('closing'); setTimeout(() => w.remove(), 220); };
  /* 윈도우 기본 팝업 대신 앱 안의 확인창 */
  /* 이름 뒤에 붙일 조사: 마지막 글자(괄호·기호는 건너뜀)의 받침으로 고름. 숫자는 읽는 소리 기준(영·일·삼·육·칠·팔) */
  const jong = (w) => {
    const m = String(w || '').match(/[가-힣0-9](?=[^가-힣0-9]*$)/), c = m ? m[0] : '', n = c.charCodeAt(0);
    if (n >= 0xAC00 && n <= 0xD7A3) return (n - 0xAC00) % 28;       // 0 = 받침 없음, 8 = ㄹ
    if (/[0-9]/.test(c)) return { 0: 21, 1: 8, 3: 16, 6: 1, 7: 8, 8: 8 }[c] || 0;
    return 0;
  };
  const eul = (w) => (jong(w) ? '을' : '를');
  const ro = (w) => (jong(w) && jong(w) !== 8 ? '으로' : '로');
  function ask(msg, ok = '삭제', danger = true, title = null, ic = 'trash') {
    return new Promise((res) => {
      const done = (v) => { closeAsk(w); document.removeEventListener('keydown', key, true); res(v); };
      const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.stopPropagation(); done(true); } };
      const w = el('div', { class: 'askw' }, el('div', { class: 'back', onclick: () => done(false) }),
        el('div', { class: 'dlg askd', role: 'alertdialog' },
          title ? el('div', { class: 'shead' }, hb(ic, title)) : null,
          el('div', { class: 'askm' }, String(msg).split('\n').map((l) => el('div', {}, l))),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'ghost', type: 'button', onclick: () => done(false) }, '취소'),
            el('button', { class: danger ? 'pri danger' : 'pri', type: 'button', onclick: () => done(true) }, ok))));
      document.addEventListener('keydown', key, true);
      document.body.append(w);
      w.querySelector('.pri').focus();
    });
  }

  /* 확인 버튼 하나뿐인 알림창 (학생 신청 페이지의 알림창과 같은 모양) */
  function notice(msg) {
    return new Promise((res) => {
      const done = () => { closeAsk(w); document.removeEventListener('keydown', key, true); res(); };
      const t0 = performance.now(); // 알림을 띄운 바로 그 엔터 키로 곧바로 닫히지 않게
      const key = (e) => { if (e.timeStamp <= t0) return; if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); done(); } };
      const w = el('div', { class: 'askw' }, el('div', { class: 'back', onclick: done }),
        el('div', { class: 'dlg askd', role: 'alertdialog' },
          el('div', { class: 'askm' }, String(msg).split('\n').map((l) => el('div', {}, l))),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'pri', type: 'button', onclick: done }, '확인'))));
      document.addEventListener('keydown', key, true);
      document.body.append(w);
      setTimeout(() => { const b = w.querySelector('.pri'); if (b && b.isConnected) b.focus(); }, 60); // 같은 엔터 키의 기본 동작(버튼 클릭)이 새 팝업을 닫지 않게 늦게 포커스
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
    if (document.body.classList.contains('booting')) { document.body.classList.remove('booting'); }
    const q = $('#q');
    const keep = q && { v: q.value, f: document.activeElement === q, s: q.selectionStart };
    S.topSum = null;
    renderTop(true); // 상단 바 너비 맞추기는 본문까지 다 그린 뒤 한 번에 (레이아웃 계산을 한 번만 하려고)
    const main = $('#main');
    S.startDelta = 0;
    beltEnd();
    const snap = wantBelt(main);
    const ghost = !snap && S.lastKey != null && !needLogin() && !noAnim() && viewKey() !== S.lastKey && main.firstElementChild ? main.firstElementChild.cloneNode(true) : null; // 화면 종류가 바뀔 때도 기존 화면을 뒤에 남겨둬요
    main.replaceChildren();
    if (!needLogin() && S.view === 'cal' && !S.todoTourShown) setTimeout(maybeTodoTour, 900);
    if (needLogin()) main.append(loginView());
    else if (S.ready && S.view === 'consult' && !S.cloud) { S.view = 'cal'; main.append(calView()); } // 로그인 전에는 상담 탭이 없으므로 캘린더로
    else main.append(S.view === 'att' ? attView() : S.view === 'consult' ? consultView() : calView());
    syncLoginWin();
    fitTop();
    if (isMobile()) requestAnimationFrame(fitCellsMobile);
    snapCal();
    if (S.topSum && S.view === 'att') { // 통계는 날짜 줄(일별·주별) 또는 월별 화면 맨 위에 둠 — 맨 윗줄은 항상 고정
      const nx = S.sub === 'month' ? null : $('#main .dhead .dttl + .ib');
      const mh = $('#main .mhead');
      if (nx) nx.after(S.topSum); else if (mh) mh.append(S.topSum); else if (main.firstElementChild) main.firstElementChild.prepend(S.topSum);
    }
    animateMain(main, snap, ghost);
    S.topSum = null;
    if (keep) {
      const nq = $('#q');
      if (nq) { nq.value = keep.v; if (keep.f) { nq.focus(); try { nq.setSelectionRange(keep.s, keep.s); } catch (e) { /* noop */ } } preview(); }
    }
  }

  function renderTop(noFit) {
    const t = $('#top');
    /* 새로고침 화살표가 도는 1초 동안은 상단 바를 다시 그리지 않아요 (다시 그리면 돌던 게 끊겨요). 끝난 뒤에 한 번만 그려요 */
    if (S.spinT > Date.now() && $('#syncBtn')) { clearTimeout(S.topT); S.topT = setTimeout(renderTop, S.spinT - Date.now() + 30); return; }
    t.replaceChildren();
    closeMenu();
    if (needLogin()) { t.hidden = true; return; }
    t.hidden = false;
    const cv = S.view === 'consult';
    const ib = (name, fn, label) => el('button', { class: 'ib', onclick: fn, 'aria-label': label, title: label, disabled: cv }, icon(name));
    const nav = el('div', { class: 'nav' },
      ib('left', () => go(-1), weekMode() ? '이전 주' : '이전 달'),
      el('span', { class: 'ttl' + (cv ? ' off' : ' jump'), onclick: cv ? null : (e) => editTtl(e.currentTarget) }, weekMode() ? (() => { const a = parseYmd(S.anchor); return `${a.getFullYear()}년 ${a.getMonth() + 1}월`; })() : `${S.y}년 ${S.m + 1}월`),
      ib('right', () => go(1), weekMode() ? '다음 주' : '다음 달'),
      el('button', { class: 'ghost sm', disabled: cv, onclick: goToday }, icon('today'), '오늘'));
    const tab = (v, label, ic) => el('button', { class: 'tab' + (S.view === v ? ' on' : ''), onclick: () => setView(v) }, icon(ic), label);
    const tabs = el('div', { class: 'tabs' }, tab('cal', '캘린더', 'calendar'), tab('att', '출결', 'attend'), S.cloud ? tab('consult', '상담', 'chat') : null);
    const right = el('div', { class: 'right' });
    // 오른쪽 도구들: 좁아지면 뒤에서부터 ⋯ 팝업으로 들어가요
    const tools = shortcutDefs().filter((x) => scOn(x)).map((x) => ({ ...x, node: () => scNode(x) }));
    S.tools = tools;
    tools.forEach((x) => { const n = x.node(); n.dataset.ov = x.k; right.append(n); });
    right.append(el('button', { class: 'ib', id: 'ovBtn', hidden: true, onclick: (e) => { e.stopPropagation(); openOverflow(); }, 'aria-label': '더 보기', title: '더 보기' }, icon('more')));
    right.append(el('button', { class: 'ib', id: 'menuBtn', onclick: (e) => { e.stopPropagation(); openMenu(); }, 'aria-label': '메뉴', title: '메뉴' }, icon('menu')));
    t.append(nav, tabs, right);
    if (noFit !== true) fitTop();
    spinSync();
  }
  /* 새로고침 화살표: 누른 직후 상단 바가 다시 그려져도 돌던 걸 이어서 돌려요 */
  function spinSync() {
    const b = $('#syncBtn'), svg = b && b.querySelector('.ic svg');
    if (!svg || !S.spinT) return;
    const left = S.spinT - Date.now();
    if (left <= 0) { S.spinT = 0; return; }
    b.classList.add('spin'); svg.style.animationDelay = `-${1000 - left}ms`;
  }

  /* 상단바가 좁아지면 오른쪽 도구를 뒤에서부터 숨기고 ⋯ 버튼으로 보여줘요 */
  function fitTop() {
    const t = $('#top');
    if (!t || t.hidden) return;
    const items = [...t.querySelectorAll('.right [data-ov]')], more = $('#ovBtn');
    if (!more) return;
    /* 상단 바 너비·제목·탭·도구 구성이 지난번과 같으면 다시 재지 않고 지난 결과를 그대로 써요 (화면을 넘길 때마다 하던 강제 레이아웃 계산을 없앰) */
    const ttl = t.querySelector('.ttl'), sig = [S.topW, ttl && ttl.textContent, t.querySelectorAll('.tab').length, items.map((i) => i.dataset.ov).join()].join('|');
    if (S.topW && sig === S.fitSig) {
      const hid = new Set(S.hiddenTools || []);
      items.forEach((i) => { i.hidden = hid.has(i.dataset.ov); }); more.hidden = !hid.size;
      markErr(); return;
    }
    items.forEach((i) => { i.hidden = false; }); more.hidden = true;
    const over = () => t.scrollWidth > t.clientWidth + 1;
    let n = 0;
    if (over()) { more.hidden = false; while (over() && n < items.length) { items[items.length - 1 - n].hidden = true; n++; } }
    S.hiddenTools = items.filter((i) => i.hidden).map((i) => i.dataset.ov);
    markErr();
    // 줄일 수 있는 가장 좁은 너비: 이동 아이콘 + 날짜 이동 + 탭 + ⋯ + 메뉴
    const api = window.hagisiroWidget;
    if (api && api.setMinWidth) {
      const cs = getComputedStyle(t), nav = t.querySelector('.nav'), tabs = t.querySelector('.tabs'), r = t.querySelector('.right');
      const g = parseFloat(cs.columnGap) || 6, rg = parseFloat(getComputedStyle(r).columnGap) || 4;
      const need = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + nav.offsetWidth + tabs.offsetWidth + 2 * g + 2 * 28 + rg + 8;
      const w = Math.ceil(need + (IS_WIDGET ? 6 : 0));
      if (S.minW !== w) { S.minW = w; api.setMinWidth(w); }
    }
    S.fitSig = sig;
  }
  function openOverflow() {
    if ($('#menu')) { closeMenu(); return; }
    const m = el('div', { class: 'menu', id: 'menu' });
    const item = (label, fn, on, ic) => el('button', { class: 'mi mic' + (on ? ' on' : ''), onclick: () => { closeMenu(); fn(); } }, ic ? icon(ic) : null, el('span', {}, label));
    (S.tools || []).filter((x) => (S.hiddenTools || []).includes(x.k)).forEach((x) => {
      if (x.menu) x.menu.forEach(([l, on, fn]) => m.append(item(l, fn, on))); else m.append(item(x.label, x.run, false, x.ic));
    });
    $('#app').append(m);
    setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
  }

  function setView(v) { S.view = v; ls.set('hagisiro:view', v); if (PF.cal === 'week') watchRange(); render(); }
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
      const a = parseYmd(S.anchor); // 화면만 넘기고 선택한 날짜는 그대로 (선택은 칸을 누를 때만 바뀌어요)
      const na = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * dm);
      S.anchor = ymd(na); S.y = na.getFullYear(); S.m = na.getMonth(); S.extra = {};
      watchRange(); render(); return;
    }
    const d = new Date(S.y, S.m + dm, 1);
    S.y = d.getFullYear(); S.m = d.getMonth();
    S.extra = {}; // 달만 넘기고 선택한 날짜는 그대로 (선택은 칸을 누를 때만 바뀌어요)
    watchRange(); render();
  }
  function jumpTo(y, m) {
    const sd = parseYmd(S.sel);
    const dim = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(sd.getDate(), dim));
    S.y = y; S.m = m; S.sel = ymd(d); S.anchor = ymd(d); S.extra = {};
    watchRange(); render();
  }
  function jumpToDate(ds) {
    S.sel = ds; S.anchor = ds; const d = parseYmd(ds); S.y = d.getFullYear(); S.m = d.getMonth(); S.extra = {};
    watchRange(); render();
  }
  function editTtl(span, withDay) { // withDay: 출결 일별·주별 제목에서는 일까지 골라요
    if (document.querySelector('.ttpop')) return;
    const ref = withDay ? parseYmd(S.sel) : weekMode() ? parseYmd(S.anchor) : new Date(S.y, S.m, 1);
    const yi = el('input', { type: 'text', inputmode: 'numeric', maxlength: 4, class: 'ttin y', value: ref.getFullYear(), 'aria-label': '연도' });
    const mi = el('input', { type: 'text', inputmode: 'numeric', maxlength: 2, class: 'ttin m', value: ref.getMonth() + 1, 'aria-label': '월' });
    const di = withDay ? el('input', { type: 'text', inputmode: 'numeric', maxlength: 2, class: 'ttin d', value: ref.getDate(), 'aria-label': '일' }) : null;
    const go = el('button', { type: 'button', class: 'pri sm', 'aria-label': '이동' }, icon('enter'));
    const fy = el('div', { class: 'ttf' }, yi), fm = el('div', { class: 'ttf' }, mi);
    const pop = el('div', { class: 'ttpop' }, fy, el('span', {}, '년'), fm, el('span', {}, '월'), ...(di ? [el('div', { class: 'ttf' }, di), el('span', {}, '일')] : []), go);
    let done = false, dd = null;
    const closeDD = () => { if (dd) { dd.remove(); dd = null; } };
    const openDD = (inp, vals, onPick) => { // 직접 입력도 되고, 목록에서 골라도 돼요
      closeDD();
      dd = el('div', { class: 'ttdd' }, vals.map((v) => el('button', { type: 'button', class: 'ttdo' + (String(v) === inp.value ? ' on' : ''), onclick: () => { closeDD(); onPick(v); } }, v)));
      inp.parentElement.append(dd);
      const on = dd.querySelector('.on'); if (on) dd.scrollTop = Math.max(0, on.offsetTop - 70);
    };
    const cy = new Date().getFullYear();
    const years = Array.from({ length: 21 }, (_, i) => cy - 10 + i); // 지난 10년 ~ 앞으로 10년
    const showY = () => openDD(yi, years, (v) => { yi.value = v; mi.focus(); mi.select(); });
    const showM = () => openDD(mi, Array.from({ length: 12 }, (_, i) => i + 1), (v) => { mi.value = v; if (di) { di.focus(); di.select(); } else finish(true); });
    const showD = () => { const y = parseInt(yi.value, 10) || ref.getFullYear(), m = parseInt(mi.value, 10) || 1; openDD(di, Array.from({ length: new Date(y, Math.min(12, Math.max(1, m)), 0).getDate() }, (_, i) => i + 1), (v) => { di.value = v; finish(true); }); };
    const close = () => { if (done) return; done = true; document.removeEventListener('pointerdown', off, true); pop.remove(); };
    const finish = (ok) => {
      const y = parseInt(yi.value, 10), m = parseInt(mi.value, 10);
      if (ok && !(y >= 1900 && y <= 2200 && m >= 1 && m <= 12)) return;
      close();
      if (!ok) return;
      if (di) { const dim = new Date(y, m, 0).getDate(); jumpToDate(ymd(new Date(y, m - 1, Math.min(Math.max(parseInt(di.value, 10) || 1, 1), dim)))); } else jumpTo(y, m - 1);
    };
    const off = (e) => { if (!pop.contains(e.target)) close(); else if (dd && !dd.contains(e.target) && !e.target.closest('.ttin')) closeDD(); };
    [yi, mi, di].filter(Boolean).forEach((i) => {
      const show = i === yi ? showY : i === mi ? showM : showD;
      i.addEventListener('input', () => { closeDD(); i.value = i.value.replace(/\D/g, ''); if (i === yi && i.value.length === 4) { mi.focus(); mi.select(); } });
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') { if (dd) closeDD(); else close(); } else if (e.key === 'ArrowDown' && !dd) show(); e.stopPropagation(); });
      i.addEventListener('focus', () => { i.select(); });
      i.addEventListener('click', () => { if (!dd || !i.parentElement.contains(dd)) show(); });
    });
    go.addEventListener('click', () => finish(true));
    document.body.append(pop);
    const r = span.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(6, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 6)) + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    yi.focus();
  }
  function goToday() {
    const n = new Date();
    S.y = n.getFullYear(); S.m = n.getMonth(); S.sel = ymd(n); S.anchor = ymd(n); S.extra = {};
    watchRange(); render();
  }

  /* 새로고침: 구독을 다시 걸어 서버 내용으로 덮어써요 */
  function forceSync() {
    S.saveErr = false; markErr();
    const b = $('#syncBtn');
    S.spinT = Date.now() + 1000;
    if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); }
    if (S.cloud) {
      stopWatches(); watchStatic(); watchRange();
      loadMeal();
    } else { Data.loadLocal(); render(); }
  }

  /* ---------- 바로가기: 메뉴의 모든 항목을 상단 아이콘으로 꺼낼 수 있어요 ---------- */
  function shortcutDefs() {
    const api = window.hagisiroWidget || {};
    const gc = gcalWanted() && !gtoken();
    return [
      S.user ? { k: 'logout', label: '로그아웃', ic: 'logout', run: () => { ls.set('hagisiro:guest', '0'); S.guest = false; S.cloudMod.logout(); } } : null,
      !S.user && S.cloudAvail ? { k: 'login', label: 'Google 로그인', ic: 'google', run: () => { S.fromLocal = S.guest; S.guest = false; ls.set('hagisiro:guest', '0'); S.cloudMod.login().catch(loginErr); } } : null,
      { k: 'search', label: '할 일 검색', ic: 'search', pop: true, run: openSearch },
      { k: 'repeat', label: '반복 관리', ic: 'repeat', pop: true, run: () => openRepeatManage() },
      { k: 'dday', label: 'D-day 관리', ic: 'dday', pop: true, run: openDdays },
      { k: 'alarm', label: '알림 관리', ic: 'bell', pop: true, run: openAlarms },
      { k: 'meal', label: '급식', ic: 'utensils', def: true, pop: true, run: openMealWeek },
      ...DOCS.map(([id, label, ic]) => ({ k: 'doc-' + id, label, ic, def: id !== 'schedule', doc: id, run: () => openDoc(id) })), // 일과 진행 시간표는 기본으로는 숨김
      { k: 'prog', label: '진도 확인', ic: 'progress', pop: true, run: openProgress },
      { k: 'sync', label: '새로고침', ic: 'refresh', def: true, run: forceSync },
      { k: 'prefs', label: '설정', ic: 'gear', pop: true, run: openPrefs },
      gc ? { k: 'gc', label: 'Google 캘린더 다시 연결', ic: 'google', def: true, run: () => connectGcal() } : null,
      !S.cloud ? { k: 'backup', label: '백업 저장', ic: 'download', run: exportJson } : null,
      IS_WIDGET ? { k: 'move', label: '이동·크기 변경', ic: 'move', def: true, run: () => S.winEdit && S.winEdit() } : null,
      api.hide ? { k: 'hide', label: '숨기기', ic: 'minimize', run: () => api.hide() } : null,
      api.quit ? { k: 'quit', label: '종료', ic: 'power', run: () => api.quit() } : null,
    ].filter(Boolean);
  }
  const scOn = (x) => (x.def ? !(PF.hide || []).includes(x.k) : (PF.show || []).includes(x.k));
  function scNode(x) {
    const common = { title: x.label, 'aria-label': x.label, onclick: x.run };
    if (x.doc || x.pop) return el('button', { ...common, class: 'ghost sm dbtn' + (x.doc && docList(x.doc).some(docHas) ? ' has' : '') }, icon(x.ic), el('span', { class: 'lb' }, x.label));
    return el('button', { ...common, class: 'ib', id: x.k === 'sync' ? 'syncBtn' : x.k === 'move' ? 'wmove' : null }, icon(x.ic));
  }

  /* ---------- 메뉴 ---------- */
  function closeMenu() { const m = $('#menu'); if (m) m.remove(); document.removeEventListener('click', onDocClick, true); }
  /* 메뉴 바깥을 누르면 메뉴만 닫고, 그 클릭은 아래 화면(날짜 칸 등)에 전달하지 않아요 */
  function onDocClick(e) { const m = $('#menu'); if (m && !m.contains(e.target)) { e.preventDefault(); e.stopPropagation(); closeMenu(); } }
  function openMenu() {
    if ($('#menu')) { closeMenu(); return; }
    const item = (label, fn, ic) => el('button', { class: 'mi mic', onclick: () => { closeMenu(); fn(); } }, ic ? icon(ic) : null, el('span', {}, label));
    const m = el('div', { class: 'menu', id: 'menu' });
    const sep = () => m.append(el('div', { class: 'msep' }));
    if (S.user) { m.append(el('div', { class: 'mh' }, S.user.email || '')); m.append(item('로그아웃', () => { ls.set('hagisiro:guest', '0'); S.guest = false; S.cloudMod.logout(); }, 'logout')); sep(); }
    else if (S.cloudAvail) { m.append(item('Google 로그인', () => { S.fromLocal = S.guest; S.guest = false; ls.set('hagisiro:guest', '0'); S.cloudMod.login().catch(loginErr); }, 'google')); sep(); }
    else { m.append(el('div', { class: 'mh' }, '이 기기에만 저장')); sep(); }
    m.append(item('할 일 검색', openSearch, 'search'));
    m.append(item('반복 관리', () => openRepeatManage(), 'repeat'));
    m.append(item('D-day 관리', openDdays, 'dday'));
    m.append(item('알림 관리', openAlarms, 'bell'));
    sep();
    m.append(item('급식', openMealWeek, 'utensils'));
    DOCS.forEach(([id, label, ic]) => m.append(item(label, () => openDoc(id), ic)));
    m.append(item('진도 확인', openProgress, 'progress'));
    sep();
    m.append(item('새로고침', forceSync, 'refresh'));
    m.append(item('설정', openPrefs, 'gear'));
    if (!S.cloud) m.append(item('백업 저장', exportJson, 'download'));
    const wapi = window.hagisiroWidget;
    if (IS_WIDGET || (wapi && (wapi.hide || wapi.quit))) sep();
    if (IS_WIDGET) m.append(item('이동·크기 변경', () => S.winEdit && S.winEdit(), 'move'));
    if (wapi && wapi.hide) m.append(item('숨기기', () => wapi.hide(), 'minimize'));
    if (wapi && wapi.quit) m.append(item('종료', () => wapi.quit(), 'power'));
    $('#app').append(m);
    setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
  }
  /* ---------- 할 일 검색 ---------- */
  function gotoDate(ds) {
    const d = parseYmd(ds);
    S.y = d.getFullYear(); S.m = d.getMonth(); S.sel = ds; S.anchor = ds; S.extra = {};
    S.view = 'cal'; ls.set('hagisiro:view', 'cal');
    watchRange(); render();
  }
  /* ---------- D-day 관리 ---------- */
  function openDdays() {
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const list = el('div', { class: 'srl' });
    const dlg = el('div', { class: 'dlg sdlg' },
      el('div', { class: 'shead' }, hb('dday', 'D-day 관리'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
      list);
    m.append(el('div', { class: 'back', onclick: close }), dlg);
    const draw = () => {
      const today = dayNum(ymd(new Date()));
      const all = (S.cloud ? S.ddays : S.todos).filter((t) => t.dday && !t.skip && t.text && t.date)
        .map((t) => ({ t, n: dayNum(t.date) - today }))
        .sort((a, b) => (a.n >= 0) !== (b.n >= 0) ? (a.n >= 0 ? -1 : 1) : (a.n >= 0 ? a.n - b.n : b.n - a.n));
      list.replaceChildren();
      if (!all.length) { list.append(el('div', { class: 'mut small sempty' }, 'D-day 없음')); return; }
      all.forEach(({ t, n }) => {
        const d = parseYmd(t.date);
        list.append(el('div', { class: 'srow' },
          el('button', { type: 'button', class: 'sgo', onclick: () => { close(); gotoDate(t.date); } },
            el('span', { class: 'sd' }, n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`),
            el('span', { class: 'st td', 'data-sz': t.sz || null, style: colorVars(t) || null }, blSpan(t.bl), el('span', { class: 'tt' }, t.text)),
            el('span', { class: 'mut small' }, `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`)),
          el('button', { type: 'button', class: 'ib danger', 'aria-label': 'D-day 삭제', title: 'D-day 삭제', onclick: () => { Data.put('todos', clean({ ...t, dday: '' })); setTimeout(draw, 60); } }, icon('trash'))));
      });
    };
    draw();
  }

  /* ---------- 알림: 할 일에 시각을 붙이면 그날 그 시각에 알려줘요 ---------- */
  function openAlarmTime(cur, curKeep, onSave) {
    const layer = el('div', { class: 'askw' });
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    const shut = () => { document.removeEventListener('keydown', key, true); layer.remove(); };
    const nowHM = () => { const d = new Date(Math.min(Math.ceil(Date.now() / 6e4) * 6e4, new Date().setHours(23, 59, 0, 0))); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }; // 지금 이후 가장 가까운 분 (바로 울리지 않게)
    const tIn = timeSel(cur || nowHM(), false, true);
    const cbAuto = el('input', { type: 'checkbox' }); cbAuto.checked = !curKeep; // 기본: 알림 후 자동 해제
    const autoRow = el('label', { class: 'rchk' }, cbAuto, '알림 후 자동 해제');
    const ok = el('button', { class: 'pri', type: 'button' }, '저장');
    ok.addEventListener('click', () => {
      if (!tIn.value) return;
      shut(); onSave(tIn.value, !cbAuto.checked);
      if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { /* 권한 요청 불가 */ } }
    });
    layer.append(el('div', { class: 'back', onclick: shut }),
      el('div', { class: 'dlg rdlg aldlg' },
        el('div', { class: 'shead' }, hb('bell', '알림'), el('button', { class: 'ib', type: 'button', onclick: shut, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'rbody' },
          el('div', { class: 'rform' }, el('div', { class: 'rdel' }, tIn, cur ? el('button', { class: 'ghost sm danger', type: 'button', onclick: () => { shut(); onSave('', false); } }, icon('trash'), '삭제') : null), autoRow),
          el('div', { class: 'dlgf' },
            el('span', { class: 'grow' }), el('button', { class: 'ghost', type: 'button', onclick: shut }, '취소'), ok))));
    document.addEventListener('keydown', key, true);
    document.body.append(layer);
    setTimeout(() => ok.focus(), 0);
  }
  const alList = () => (S.cloud ? S.alms : S.todos).filter((t) => t.al && !t.skip && t.text && t.date);
  function openAlarms() {
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const list = el('div', { class: 'srl' });
    m.append(el('div', { class: 'back', onclick: close }), el('div', { class: 'dlg sdlg' },
      el('div', { class: 'shead' }, hb('bell', '알림 관리'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))), list));
    const draw = () => {
      const nowS = ymd(new Date()) + ' ' + String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');
      const k = (t) => t.date + ' ' + t.al;
      const all = alList().sort((a, b) => (k(a) >= nowS) !== (k(b) >= nowS) ? (k(a) >= nowS ? -1 : 1) : (k(a) >= nowS ? k(a).localeCompare(k(b)) : k(b).localeCompare(k(a))));
      list.replaceChildren();
      if (!all.length) { list.append(el('div', { class: 'mut small sempty' }, '알림 없음')); return; }
      all.forEach((t) => {
        const d = parseYmd(t.date);
        list.append(el('div', { class: 'srow' },
          el('button', { type: 'button', class: 'sgo', onclick: () => { close(); gotoDate(t.date); } },
            el('span', { class: 'sd' }, t.al),
            el('span', { class: 'st td', 'data-sz': t.sz || null, style: colorVars(t) || null }, blSpan(t.bl), el('span', { class: 'tt' }, t.text)),
            el('span', { class: 'mut small' }, `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`)),
          el('button', { type: 'button', class: 'ib danger', 'aria-label': '알림 삭제', title: '알림 삭제', onclick: () => { Data.put('todos', clean({ ...t, al: '' })); setTimeout(draw, 60); } }, icon('trash'))));
      });
    };
    draw();
  }
  /* 15초마다 확인: 시각이 지난(24시간 안) 알림을 한 번만 울려요 */
  const AL_KEY = 'hagisiro:alfired';
  function alarmTick() {
    let done = []; try { done = JSON.parse(ls.get(AL_KEY) || '[]'); } catch (e) { done = []; }
    const t = Date.now(), fire = [], src = alList();
    src.forEach((a) => {
      const sig = a.id + '|' + a.date + ' ' + a.al;
      if (done.includes(sig) || a.done) return;
      const at = new Date(`${a.date}T${a.al}:00`).getTime();
      if (!(at <= t)) return;
      done.push(sig);
      if (!a.ak) Data.put('todos', clean({ ...a, al: '', ak: '' })); // 알림 후 자동 해제: 목록·아이콘에서 사라져요
      if (t - at < 864e5) fire.push(a);
    });
    if (!fire.length) return;
    ls.set(AL_KEY, JSON.stringify(done.slice(-300)));
    fire.forEach((a) => {
      let shown = false;
      if (window.Notification && Notification.permission === 'granted') { try { new Notification(a.text, { body: `${md(a.date)} ${a.al}`, tag: 'hagisiro-' + a.id, ...(S.instWidget ? {} : { icon: new URL('icons/notif-192.png', location.href).href }) }); /* 설치식 위젯은 알림 위쪽에 앱 아이콘이 나와서 본문 아이콘은 빼요 */ shown = true; } catch (e) { /* 앱 안 팝업으로 대신 */ } }
      if (!shown) notice(`${a.text}\n${md(a.date)} ${a.al}`);
    });
  }
  setInterval(() => { if (S.ready) alarmTick(); }, 15000);
  let searchAll = null;
  async function openSearch() {
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const q = el('input', { type: 'text', class: 'sqi', spellcheck: 'false', autocomplete: 'off', 'aria-label': '할 일 검색' });
    const list = el('div', { class: 'srl sr' });
    const dlg = el('div', { class: 'dlg sdlg' },
      el('div', { class: 'shead' }, hb('search', '할 일 검색'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
      fld(q), list);
    m.append(el('div', { class: 'back', onclick: close }), dlg);
    q.focus();
    let all = S.todos;
    if (S.cloud) {
      list.replaceChildren(loading());
      try { all = await S.cloud.getAll('todos'); } catch (e) { all = S.todos; }
    }
    const today = ymd(new Date());
    const run = () => {
      const k = q.value.trim().toLowerCase();
      list.replaceChildren();
      const fit = () => {
        const cur = list.style.height; list.style.transition = 'none'; list.style.height = 'auto';
        const h = list.children.length ? Math.min(300, list.scrollHeight) : 0;
        list.style.height = cur || '0px'; void list.offsetHeight; list.style.transition = '';
        list.style.height = h + 'px'; list.style.marginTop = h ? '0px' : '-10px';
      };
      if (!k) { fit(); return; }
      const hit = all.filter((t) => !t.skip && t.text && t.text.toLowerCase().includes(k))
        .sort((a, b) => { const fa = a.date >= today, fb = b.date >= today; return fa !== fb ? (fa ? -1 : 1) : (fa ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)); });
      const rules = S.repeats.filter((r) => r.text && r.text.toLowerCase().includes(k));
      if (!hit.length && !rules.length) { list.append(el('div', { class: 'mut small sempty' }, '일치하는 할 일 없음')); fit(); return; }
      hit.slice(0, 100).forEach((t) => {
        const d = parseYmd(t.date);
        list.append(el('button', { type: 'button', class: 'srow' + (t.done ? ' done' : ''), onclick: () => { close(); gotoDate(t.date); } },
          el('span', { class: 'sd' }, `${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '.' : ''}${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`),
          el('span', { class: 'st' }, t.text), t.dday ? el('span', { class: 'ddm' }, icon('dday')) : null, t.rid ? el('span', { class: 'rpt' }, icon('repeat')) : null));
      });
      rules.forEach((r) => list.append(el('button', { type: 'button', class: 'srow', onclick: () => { close(); openRepeatManage(); } },
        el('span', { class: 'sd' }, '반복'), el('span', { class: 'st' }, r.text), el('span', { class: 'mut small' }, ruleSummary(r)))));
      if (hit.length > 100) list.append(el('div', { class: 'mut small sempty' }, `위 100개만 보여요 (전체 ${hit.length}개)`));
      fit();
    };
    q.addEventListener('input', run);
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); else if (e.key === 'Enter') { const f = list.querySelector('.srow'); if (f) f.click(); } e.stopPropagation(); });
    run();
  }
  const loginErr = (e) => console.error(e);

  function download(name, text, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  }
  function exportJson() {
    const o = {}; COLS.forEach((c) => { o[c] = S[c]; });
    download(`hagisiro-backup-${ymd(new Date())}.json`, JSON.stringify(o, null, 1), 'application/json');
  }

  /* 위젯(데스크톱): 로그인 화면은 작은 팝업 창으로 화면 가운데에, 팝업이 열리면 창을 화면 크기로 넓혀서 위젯 밖으로도 옮길 수 있게 */
  let loginWinOn = false;
  function syncLoginWin() {
    const on = needLogin();
    if (document.body.classList.contains('loginmode') !== on) { document.body.classList.toggle('loginmode', on); applyPf(); } // 로그인 화면 ↔ 앱을 오갈 때 테마 다시 적용
    if (!on) { S.lgT0 = null; S.lgOut = false; S.lgFaded = 0; } // 로그인 화면을 벗어나면 다음에 다시 처음부터
    const api = window.hagisiroWidget;
    if (api && api.loginMode && on !== loginWinOn) {
      if (!on && !noAnim()) { const ap = document.getElementById('app'); if (ap) ap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 140, easing: 'ease-out', fill: 'both' }); } // 로그인 창 → 위젯 크기로 바뀌는 동안은 비워뒀다가 부드럽게 켜져요
      loginWinOn = on; api.loginMode(on);
    }
  }
  /* 화면 폭에 따른 배치는 '창'이 아니라 '앱' 폭을 기준으로 (팝업 때문에 창이 커져도 메인이 안 변하게) */
  (function appWidthClass() {
    const app = document.getElementById('app'); if (!app) return;
    const set = () => document.body.classList.toggle('aw600', app.clientWidth <= 600);
    set();
    if (window.ResizeObserver) new ResizeObserver(set).observe(app);
  })();
  /* ---------- 로그인 화면 ---------- */
  /* 로그인 로고 애니메이션: 창 전체의 파란색이 왼쪽 위 네모로 줄어들며 H가 나타나고, 오른쪽·아래로 번져 네 칸이 되고, 마지막에 체크가 그려져요.
   * 슬라임처럼 이어 보이는 건 움직이는 동안만이고, 자리를 잡은 네모는 원래 모양(정확한 네모)을 위에 덮어서 끝났을 때 모양이 달라지지 않게 해요.
   * 흰 공간이 드러나는 때부터 제목·버튼이 나타나 바로 누를 수 있어요. 같은 실행에서 다시 보일 땐 줄어드는 부분은 건너뛰어요. */
  const LGX = { SH0: 200, SH1: 850, HF0: 700, HF1: 1000, UI0: 600, UI1: 900, OFF: 900, hold: 350, right: 560, gap: 60, down: 560, gap2: 80, check: 520, CK: 28 };
  const lgBez = (a, b, c, d) => { const f = (t, p, q) => 3 * p * t * (1 - t) * (1 - t) + 3 * q * t * t * (1 - t) + t * t * t; return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (f(t, a, c) < x) lo = t; else hi = t; } return f(t, b, d); }; };
  const lgLead = lgBez(.45, 0, .25, 1.12), lgFollow = lgBez(.35, 0, .25, 1), lgInOut = lgBez(.5, 0, .3, 1);
  const lgClamp = (x) => Math.max(0, Math.min(1, x));
  const lgLerp = (a, b, k) => a + (b - a) * k;
  const LG_SVG = '<svg width="64" height="64" viewBox="0 0 64 64" style="overflow:visible" aria-label="Hagisiro"><defs><linearGradient id="lgxg" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop offset="0" stop-color="#6d4aff"/><stop offset=".5" stop-color="#2f6df6"/><stop offset="1" stop-color="#12c9b3"/></linearGradient>'
    + '<linearGradient id="lgxp" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop offset="0" stop-color="#a58fff"/><stop offset=".5" stop-color="#7ea5fa"/><stop offset="1" stop-color="#6cded0"/></linearGradient>'
    + '<linearGradient id="lgxo" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop id="lgxo0" offset="0" stop-color="#2f6df6"/><stop offset=".5" stop-color="#2f6df6"/><stop offset="1" stop-color="#2f6df6"/></linearGradient>'
    + '<filter id="lgxf" filterUnits="userSpaceOnUse" x="-12" y="-12" width="88" height="88" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b"/><feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -12"/></filter></defs>'
    + '<g id="lgxG" filter="url(#lgxf)" fill="url(#lgxg)"><rect id="lgxTL" width="30" height="30" rx="9"/><rect id="lgxTR" width="30" height="30" rx="9"/><rect id="lgxBL" width="30" height="30" rx="9"/><rect id="lgxBR" x="34" width="30" height="30" rx="9"/></g>'
    + '<rect id="lgxOV" width="30" height="30" rx="9" fill="url(#lgxo)"/>'
    + '<g fill="url(#lgxg)"><rect id="lgxsTL" width="30" height="30" rx="9" opacity="0"/><rect id="lgxsTR" x="34" width="30" height="30" rx="9" opacity="0"/><rect id="lgxsBL" y="34" width="30" height="30" rx="9" opacity="0"/><rect id="lgxsBR" x="34" y="34" width="30" height="30" rx="9" opacity="0"/></g>'
    + '<g fill="url(#lgxp)"><rect id="lgxpTR" x="34" width="30" height="30" rx="9" opacity="0"/><rect id="lgxpBL" y="34" width="30" height="30" rx="9" opacity="0"/></g>'
    + '<path id="lgxH" opacity="0" d="M8.7 6.5v17M21.3 6.5v17M8.7 15h12.6" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/>'
    + '<path id="lgxC" d="M40 49.5l6.4 6.6 12-14.2" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:0"/></svg>';
  function loginAnim(login, box, ui) {
    if (noAnim()) { box.innerHTML = LOGO; return; }
    if (S.lgOut || S.wasIn) { // 로그아웃 뒤: 파란 화면·로고 애니메이션 없이 하얀 화면에서 로그인 창 전체가 페이드인으로만
      box.innerHTML = LOGO;
      const el0 = S.lgFaded ? performance.now() - S.lgFaded : 0; // 다시 그려져도 이어서 (처음 한 번만 시작)
      if (!S.lgFaded) S.lgFaded = performance.now();
      if (el0 < 400) {
        login.style.opacity = '0';
        requestAnimationFrame(() => { const an = login.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out', fill: 'both' }); an.currentTime = el0; an.onfinish = () => { an.cancel(); login.style.opacity = ''; }; });
      }
      return;
    }
    const first = S.lgT0 == null; if (first) S.lgT0 = performance.now();
    if (first) S.lgSkip = S.lgSeen ? 1000 : 0; // 같은 실행에서 다시 보일 땐 줄어드는 부분을 건너뛰어요
    S.lgSeen = true;
    const skip = S.lgSkip || 0;
    box.innerHTML = LG_SVG;
    const $$ = (id) => box.querySelector('#lgx' + id);
    const q = {}; ['G', 'TL', 'TR', 'BL', 'BR', 'OV', 'sTL', 'sTR', 'sBL', 'sBR', 'pTR', 'pBL', 'H', 'C', 'o0'].forEach((k) => { q[k] = $$(k); });
    const R = (e, x, y, w, h) => { e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('width', w); e.setAttribute('height', h); };
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, k) => '#' + hex(a).map((v, i) => Math.round(lgLerp(v, hex(b)[i], k)).toString(16).padStart(2, '0')).join('');
    const slide = (e, horiz, p) => { // 앞쪽 가장자리는 빨리, 뒤쪽은 늦게 따라가며 늘어났다 줄어들어요
      const head = 30 + 34 * lgLead(p), tail = 34 * lgFollow(lgClamp((p - .14) / .86)), len = head - tail, thin = 30 - Math.max(0, len - 30) * .16, off = (30 - thin) / 2;
      if (horiz) R(e, tail, off, len, thin); else R(e, off, tail, thin, len);
    };
    const endAt = LGX.OFF + LGX.hold + LGX.right + LGX.gap + LGX.down + LGX.gap2 + LGX.check;
    let geo = null, raf = 0;
    // 줄어드는 동안 매 프레임 창 모양을 다시 재요: 위젯 창이 로그인 크기로 줄어드는 중에도 파란색이 둥근 로그인 창에 딱 맞아요
    const measure = () => { const sv = box.firstElementChild.getBoundingClientRect(), c = login.getBoundingClientRect(), k = sv.width / 64 || 1;
      geo = { x: (c.left - sv.left) / k, y: (c.top - sv.top) / k, w: c.width / k, h: c.height / k, r: (parseFloat(getComputedStyle(login).borderTopLeftRadius) || 0) / k, bleed: 2 / k }; };  // 가장자리가 반 픽셀씩 모자라 흰 줄이 보이지 않게 2px 크게 그리고, 둥근 로그인 창 모양으로 잘라요
    const draw = (T) => {
      const k = lgInOut(lgClamp((T - LGX.SH0) / (LGX.SH1 - LGX.SH0))), done = k >= 1;
      if (!done) { measure(); const bl = geo.bleed * (1 - k); R(q.OV, lgLerp(geo.x, 0, k) - bl, lgLerp(geo.y, 0, k) - bl, lgLerp(geo.w, 30, k) + 2 * bl, lgLerp(geo.h, 30, k) + 2 * bl); q.OV.setAttribute('rx', lgLerp(geo.r, 9, k)); q.o0.setAttribute('stop-color', mix('#2f6df6', '#6d4aff', k * k * k)); }
      login.style.overflow = done ? '' : 'hidden'; q.OV.style.display = done ? 'none' : ''; q.sTL.setAttribute('opacity', done ? 1 : 0); q.TL.style.display = done ? '' : 'none';
      q.H.setAttribute('opacity', lgClamp((T - LGX.HF0) / (LGX.HF1 - LGX.HF0)));
      const u = lgClamp((T - LGX.UI0) / (LGX.UI1 - LGX.UI0)); ui.forEach((n) => { n.style.opacity = u; n.style.pointerEvents = u > 0 ? '' : 'none'; });
      const t = T - LGX.OFF, tr = LGX.hold, td = tr + LGX.right + LGX.gap, tc = td + LGX.down + LGX.gap2;
      const pr = lgClamp((t - tr) / LGX.right), pd = lgClamp((t - td) / LGX.down), rest = lgClamp((t - (td + LGX.down)) / 320);
      slide(q.TR, true, pr); slide(q.BL, false, pd);
      q.BR.style.display = pd > 0 ? '' : 'none'; q.BL.style.display = pd > 0 && pd < 1 ? '' : 'none'; q.TR.style.display = pd >= 1 ? 'none' : '';
      { const head = 30 + 34 * lgLead(pd), tail = 34 * lgFollow(lgClamp((pd - .14) / .86)), len = head - tail, thin = 30 - Math.max(0, len - 30) * .16; R(q.BR, 34 + (30 - thin) / 2, tail, thin, len); }
      q.sTR.setAttribute('opacity', pr >= 1 ? 1 : 0); q.pTR.setAttribute('opacity', pr >= 1 && pd >= 1 ? lgInOut(rest) : 0); // 옅은 두 칸은 투명도가 아니라 앱 아이콘과 같은 옅은 색으로 (비치지 않게)
      q.sBL.setAttribute('opacity', pd >= 1 ? 1 : 0); q.pBL.setAttribute('opacity', pd >= 1 ? lgInOut(rest) : 0);
      q.sBR.setAttribute('opacity', pd >= 1 ? 1 : 0);
      const pc = lgClamp((t - tc) / LGX.check);
      q.C.style.strokeDasharray = LGX.CK; q.C.style.strokeDashoffset = LGX.CK * (1 - lgInOut(pc)); q.C.style.opacity = pc > 0 ? 1 : 0;
      return T < endAt + 100;
    };
    const tick = () => {
      if (!box.isConnected || !S.lgT0) return;
      const more = draw(skip + performance.now() - S.lgT0);
      if (more) raf = requestAnimationFrame(tick); else { q.G.style.display = 'none'; ui.forEach((n) => { n.style.opacity = ''; n.style.pointerEvents = ''; }); }
    };
    ui.forEach((n) => { n.style.opacity = 0; n.style.pointerEvents = 'none'; });
    raf = requestAnimationFrame(tick); // 붙은 뒤 첫 그림 직전에 시작
  }
  function loginView() {
    const logo = el('div', { class: 'logo' });
    const ui = [el('h1', {}, 'Hagisiro'),
      el('button', { class: 'pri', onclick: () => S.cloudMod.login().catch(loginErr) }, 'Google 로그인'),
      el('button', { class: 'link', onclick: () => { S.guest = true; ls.set('hagisiro:guest', '1'); enterLocal(); } }, '이 기기에만 저장')];
    const v = el('div', { class: 'login' }, logo, ...ui);
    loginAnim(v, logo, ui);
    return v;
  }

  /* ================= 캘린더 ================= */
  function calView() {
    const r = range();
    { const ns = dayNum(ymd(r.start)); S.startDelta = ns - (S.curStart == null ? ns : S.curStart); S.curStart = ns; S.curRows = r.rows; }
    const todayS = ymd(new Date());
    const wrap = el('div', { class: 'cal', id: 'cal' });
    wrap.append(el('div', { class: 'wk' }, DOW.map((d, i) => el('div', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '' }, d))));
    const grid = el('div', { class: 'days', style: `grid-template-rows:repeat(${r.rows},minmax(0,1fr))` });
    const attBy = {}; S.att.forEach((a) => { attBy[a.date] = (attBy[a.date] || 0) + 1; });

    /* 월 사이 구분하기: 같은 주 안에서 달이 바뀌면 줄을 끊고(남는 칸은 투명) 다음 달은 해당 요일부터 새 줄에서 시작.
       전체 주 수는 '화면에 보이는 줄 수'예요 (빈 줄·빈 칸 포함) */
    const sunKey = (d) => ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
    const rowsL = [];
    {
      const split = weekMode() && PF.mgap;
      let cur = null;
      const push = () => { while (cur.cells.length < 7) cur.cells.push(null); rowsL.push(cur); cur = null; };
      for (let i = 0; rowsL.length < r.rows; i++) {
        const d = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate() + i);
        if (split && i > 0 && d.getDate() === 1 && d.getDay() !== 0 && cur) { push(); if (rowsL.length >= r.rows) break; }
        if (!cur) {
          cur = { cells: [], gap: split && i > 0 && d.getDate() === 1, rk: sunKey(d), part: 0 };
          if (cur.gap) for (let k = 0; k < d.getDay(); k++) cur.cells.push(null);
          if (cur.cells.length) cur.part = 1;
        }
        cur.cells.push(d);
        if (cur.cells.length === 7) push();
      }
    }
    const tracks = []; // 줄마다 1fr, 달이 바뀌는 줄 앞에는 얇은 구분 칸
    const gapIdx = [];
    if (rowsL.some((r) => r.gap)) grid.classList.add('msplit');
    rowsL.forEach((row, ri) => { if (row.gap && ri > 0) tracks.push('var(--mg, 5px)'); gapIdx.push(tracks.length + 1); tracks.push('minmax(0,1fr)'); });
    grid.style.gridTemplateRows = tracks.join(' ');
    grid.dataset.rn = rowsL.length; // 줄 수 (snapCal이 줄 높이를 픽셀로 바꾼 뒤에도 알 수 있게)
    for (let ri = 0; ri < rowsL.length; ri++) {
      const row = rowsL[ri];
      for (let ci = 0; ci < 7; ci++) {
        const d = row.cells[ci];
        const rk = `${row.rk}.${row.part}`;
        if (!d) { grid.append(el('div', { class: 'cell blank' + (row.gap ? ' mgap' : ''), 'aria-hidden': 'true', 'data-rk': rk, style: `grid-row:${gapIdx[ri]}` })); continue; }
      const ds = ymd(d);
      const list = itemsOn(ds);
      const gl = S.gcal[ds] || [];
      const hn = holName(ds, d);
      const lu = PF.lunar && window.Lunar ? Lunar.lunarLabel(d) : '';
      const tm = PF.terms && window.Lunar ? Lunar.termOf(d) : '';
      const cls = 'cell' + (!weekMode() && d.getMonth() !== S.m ? ' other' : '') + (hn ? ' hol' : '') + (ds === todayS ? ' today' : '') + (ds === S.sel ? ' sel' : '') + (row.gap ? ' mgap' : '') +
        (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
      grid.append(el('div', { class: cls, 'data-date': ds, 'data-rk': rk, style: `grid-row:${gapIdx[ri]}` },
        el('div', { class: 'ct' },
          el('span', { class: 'dn' }, d.getDate() === 1 ? `${d.getMonth() + 1}.1.` : d.getDate()),
          hn || tm || lu ? el('span', { class: 'sb', title: [hn, tm, lu].filter(Boolean).join(' · ') },
            hn ? el('i', { class: 'hn' }, hn) : null, tm ? el('i', { class: 'tm' }, tm) : null, lu ? el('i', { class: 'lu' }, lu) : null) : null,
          ),
        el('div', { class: 'tl' }, gl.map(gev), list.map(todoRow)),
        (PF.ab && attBy[ds]) || (PF.cons && S.cloud && S.cbk && S.cbk[ds]) || (PF.meal && S.meal[ds] && mealShown(S.meal[ds]).length) ? el('div', { class: 'cbt' },
          PF.ab && attBy[ds] ? el('button', { class: 'ab', 'data-act': 'att' }, `출결 ${attBy[ds]}`) : null,
          PF.cons && S.cloud && S.cbk && S.cbk[ds] ? el('button', { class: 'ab mb', 'data-act': 'cons' }, `상담 ${S.cbk[ds].n}`) : null,
          PF.meal && S.meal[ds] && mealShown(S.meal[ds]).length ? el('button', { class: 'ab mb', 'data-act': 'meal' }, '급식') : null) : null,
        el('div', { class: 'dots' }, list.slice(0, 5).map((t) => el('i', { class: t.done ? 'on' : '' })), gl.length ? el('i', { class: 'g' }) : null)));
      }
    }

    grid.addEventListener('click', (e) => {
      if (skipClick) return;
      const mb = e.target.closest('[data-act="meal"]');
      if (mb) { openMeal(mb.closest('.cell').dataset.date); return; }
      const ab = e.target.closest('[data-act="att"]');
      if (ab) { openAttDay(ab.closest('.cell').dataset.date); return; }
      const cb = e.target.closest('[data-act="cons"]');
      if (cb) { openConsDay(cb.closest('.cell').dataset.date); return; }
      const cell = e.target.closest('.cell');
      if (!cell || S.editing) return;
      selectDate(cell.dataset.date);
      if (tapEdit()) openSheet(cell.dataset.date);
    });
    grid.addEventListener('dblclick', (e) => {
      if (tapEdit() || S.editing || e.target.closest('.ab')) return;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = e.target.closest('.td');
      selectDate(cell.dataset.date);
      openSheet(cell.dataset.date, { focusId: row && row.dataset.id }); // 칸 안에서 바로 고치지 않고 따로 팝업
    });
    wrap.append(grid);
    const dd = ddayList();
    if (dd.length) {
      const bar = el('div', { class: 'ddbar' + (PF.ddtop ? ' top' : ''), title: dd.map((x) => `${x.label} ${x.t.text}`).join('\n') },
        dd.map((x) => el('button', { type: 'button', class: 'ddc', style: colorVars(x.t) || null, onclick: () => gotoDate(x.t.date) }, el('b', {}, x.label), ' ', el('span', { class: 'ddt' }, x.t.text))));
      if (PF.ddtop) wrap.prepend(bar); else { wrap.classList.add('hasdd'); wrap.append(bar); }
    }
    return wrap;
  }
  /* D-day로 표시한 할 일 중 오늘 이후(완료한 것 제외)를 가까운 날부터 */
  function ddayList() {
    const today = dayNum(ymd(new Date()));
    return (S.cloud ? S.ddays : S.todos).filter((t) => t.dday && !t.skip && t.text && t.date && (PF.pastdd || dayNum(t.date) >= today))
      .map((t) => { const n = dayNum(t.date) - today; return { t, n, label: n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}` }; })
      .sort((a, b) => (a.n >= 0) !== (b.n >= 0) ? (a.n >= 0 ? -1 : 1) : (a.n >= 0 ? a.n - b.n : b.n - a.n) || byOrd(a.t, b.t));
  }

  function holName(ds, d) {
    if (PF.hol && S.ghol[ds]) return S.ghol[ds];
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
   * 반복은 규칙(repeats)만 저장하고, 캘린더에는 날짜마다 계산해서 보여줘요.
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
  const virtualOf = (r, ds) => ({ id: vid(r.id, ds), virtual: true, rid: r.id, date: ds, text: r.text, done: false, fg: r.fg, bg: r.bg, sz: r.sz, bl: r.bl });
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
    if (it.virtual) Data.put('todos', clean({ id: oid(it.rid, it.date), rid: it.rid, date: it.date, text: it.text, done: false, fg: it.fg, bg: it.bg, sz: it.sz, bl: it.bl, dday: it.dday, al: it.al, ak: it.ak, ord: 0, created: Date.now(), ...patch }));
    else Data.put('todos', clean({ ...it, ...patch }));
  }
  /* 캘린더에서 고른 할 일 하나를 지움 (반복 항목은 그날만 지움) */
  function deleteItem(id) {
    const it = getItem(id); if (!it) return;
    if (it.rid) Data.put('todos', { id: oid(it.rid, it.date), rid: it.rid, date: it.date, skip: true, created: Date.now() });
    else Data.del('todos', it.id);
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

  /* 캘린더 칸 경계를 화면의 실제 픽셀에 맞춰요: 1fr로 나누면 소수점 경계가 생겨서, 배율 125·150%(특히 설치형 위젯)에서
     칸 사이·맨 오른쪽·D-day 줄 위에 1px 투명한 틈이 보였어요. 마지막 칸은 남는 만큼(1fr) 채워 바깥 테두리와 정확히 맞춰요 */
  function snapCal() {
    const g = $('#cal .days'); if (!g) return;
    const dpr = window.devicePixelRatio || 1, rb = g.getBoundingClientRect(), cs = getComputedStyle(g);
    const cuts = (start, size, n) => { const out = []; let prev = start; for (let i = 1; i < n; i++) { const b = Math.round((start + size * i / n) * dpr) / dpr; out.push(Math.max(0, b - prev) + 'px'); prev = b; } out.push('minmax(0,1fr)'); return out.join(' '); };
    const cols = cuts(rb.left, rb.width, 7);
    g.style.gridTemplateColumns = cols;
    const wk = $('#cal .wk'); if (wk) wk.style.gridTemplateColumns = cols;
    if (!g.classList.contains('msplit')) {
      const n = +g.dataset.rn || 0, top = rb.top + parseFloat(cs.borderTopWidth || 0);
      if (n > 1) g.style.gridTemplateRows = cuts(top, rb.bottom - top, n);
    }
  }
  if (window.ResizeObserver) { let rq = 0; new ResizeObserver(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(snapCal); }).observe(document.documentElement); }

  /* 폰: 칸에 다 안 들어가는 할 일은 숨기고 마지막 줄에 '+N' */
  function fitCellsMobile() {
    document.querySelectorAll('#cal .cell .tl').forEach((tl) => {
      tl.querySelectorAll('.tmore').forEach((x) => x.remove());
      const rows = [...tl.querySelectorAll(':scope > .td')];
      rows.forEach((r) => { r.hidden = false; });
      if (tl.scrollHeight <= tl.clientHeight + 1) return;
      const more = el('div', { class: 'tmore' });
      tl.append(more);
      let n = 0;
      for (let i = rows.length - 1; i >= 0 && tl.scrollHeight > tl.clientHeight + 1; i--) { rows[i].hidden = true; n++; more.textContent = '+' + n; }
    });
  }
  addEventListener('resize', () => { if (isMobile()) requestAnimationFrame(fitCellsMobile); });

  /* ---------- 캘린더 칸의 할 일 한 줄: 불릿 + 글자 ---------- */
  const colorVars = (t) => (t.fg ? `--tfg:${t.fg};` : '') + (t.bg ? `--tbg:${t.bg};` : '');
  const blSpan = (k) => { const b = el('span', { class: 'bl' }); setBullet(b, k); return b; };
  function todoRow(t) {
    return el('div', { class: 'td' + (t.done ? ' done' : '') + (t.rid ? ' rep' : ''), 'data-id': t.id, 'data-sz': t.sz || null, style: colorVars(t) || null },
      blSpan(t.bl), el('span', { class: 'tt', title: t.text }, t.text),
      t.dday ? el('span', { class: 'ddm', title: 'D-day' }, icon('dday')) : null,
      t.al ? el('span', { class: 'ddm', title: '알림 ' + t.al }, icon('bell')) : null,
      t.rid ? el('span', { class: 'rpt', title: '반복' }, icon('repeat')) : null);
  }

  /* ---------- 글자색 · 배경색 팔레트 ---------- */
  const FG = [['', '기본'], ['#e5484d', '빨강'], ['#d98a00', '주황'], ['#2e9e5b', '초록'], ['#0e9aa7', '청록'], ['#2f6df6', '파랑'], ['#d6409f', '보라'], ['#8b9098', '회색']];
  const BGC = [['', '없음'], ['rgba(229,72,77,.24)', '빨강'], ['rgba(217,138,0,.28)', '주황'], ['rgba(46,158,91,.26)', '초록'], ['rgba(14,154,167,.26)', '청록'], ['rgba(47,109,246,.26)', '파랑'], ['rgba(214,64,159,.24)', '보라'], ['rgba(139,144,152,.28)', '회색']];
  const SIZES = [['xs', '아주 작게'], ['s', '작게'], ['m', '보통'], ['l', '크게'], ['xl', '아주 크게']];
  function swatches(onPick, cur) {
    const wrap = el('div', { class: 'sw' });
    const row = (label, key, list) => {
      const r = el('div', { class: 'swr' }, el('span', { class: 'swl' }, label));
      list.forEach(([val, name]) => {
        const b = el('button', { type: 'button', class: 'swb' + (key === 'bg' ? ' sq' : '') + (val ? '' : ' none') + ((cur && (cur[key] || '') === val) ? ' on' : ''), 'aria-label': `${label} ${name}`, style: val ? `background:${val}` : null });
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
  function openPalette(anchor, onPick, cur, content) {
    if (palEl && palEl._anchor === anchor) { closePal(); return; }
    closePal();
    palEl = el('div', { class: 'pal' }, content || swatches(onPick, cur));
    palEl._anchor = anchor;
    palEl.addEventListener('mousedown', (e) => e.preventDefault()); // 입력창 포커스 유지
    document.body.append(palEl);
    const r = anchor.getBoundingClientRect(), w = palEl.offsetWidth, h = palEl.offsetHeight;
    let top = r.bottom + 6; if (top + h > innerHeight - 4) top = r.top - h - 6;
    palEl.style.left = Math.max(4, Math.min(r.left, innerWidth - w - 4)) + 'px';
    palEl.style.top = Math.max(4, top) + 'px';
    const r2 = palEl.getBoundingClientRect(); if (r2.right > innerWidth - 4) palEl.style.left = Math.max(4, innerWidth - 4 - r2.width) + 'px';
    palOff = (e) => { if (palEl && !palEl.contains(e.target) && !anchor.contains(e.target)) closePal(); };
    setTimeout(() => { if (palOff) document.addEventListener('pointerdown', palOff); }, 0);
  }

  /* ---------- 아이콘 막대: ✓ 취소선 · 팔레트 · 반복 ---------- */
  function makeBar(ctx) {
    const bar = el('div', { class: 'tbar ' + (ctx.cls || '') });
    bar.addEventListener('mousedown', (e) => e.preventDefault()); // 막대를 눌러도 입력창 포커스 유지
    const btn = (name, label, fn) => {
      const b = el('button', { class: 'tb', type: 'button', title: label, 'aria-label': label }, icon(name));
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
      return b;
    };
    bar.append(
      btn('done', '완료', () => {
        const ts = ctx.targets();
        if (!ts.length) return;
        const to = !ts.every((t) => t.get().done);
        if (ctx.setDone) ctx.setDone(ts, to); else ts.forEach((t) => t.set({ done: to }));
        if (ctx.after) ctx.after(false);
      }),
      btn('spade', '기호', (b) => {
        const ts = ctx.targets(true);
        if (!ts.length) return;
        const cur = ts[0].get().bl || PF.tbl || 'dot';
        const box = el('div', { class: 'blpick' });
        BUL.forEach(([k, name]) => box.append(el('button', { type: 'button', class: 'blb' + (cur === k ? ' on' : ''), 'data-bl': k, 'aria-label': name, onclick: (e) => {
          e.stopPropagation(); ctx.targets(true).forEach((t) => t.set({ bl: k })); closePal(); if (ctx.after) ctx.after(false);
        } }, bulIcon(k))));
        openPalette(b, null, null, box);
      }),
      btn('palette', '글자색 · 배경색', (b) => {
        if (!ctx.targets(true).length) return;
        openPalette(b, (patch) => { ctx.targets(true).forEach((t) => t.set(patch)); if (ctx.after) ctx.after(true); }, ctx.targets(true)[0].get());
      }),
      btn('repeat', '반복', () => ctx.repeat(ctx.targets())),
      btn('dday', 'D-day', () => {
        const ts = ctx.targets();
        if (!ts.length) return;
        const to = !ts.every((t) => t.get().dday);
        ts.forEach((t) => t.set({ dday: to ? true : '' }));
        if (ctx.after) ctx.after(false);
      }),
      btn('bell', '알림', () => {
        const ts = ctx.targets();
        if (!ts.length) return;
        openAlarmTime(ts[0].get().al || '', !!ts[0].get().ak, (v, keep) => { ts.forEach((t) => t.set({ al: v, ak: v && keep ? true : '' })); if (ctx.after) ctx.after(false); });
      }));
    return bar;
  }
  function placeBar(bar, x, y) {
    const w = bar.offsetWidth || 120, h = bar.offsetHeight || 40;
    bar.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + 'px';
    bar.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + 'px';
  }

  /* ---------- 터치 화면: 좌우로 밀어서 넘기기 (캘린더는 달·주, 출결은 날·주) ---------- */
  {
    let sw = null;
    const hScroll = (n) => { for (let e = n; e && e !== document.body; e = e.parentElement) { if (e.scrollWidth > e.clientWidth + 2) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll') return true; } } return false; };
    const navBtn = (next) => {
      const re = next ? /^다음 (달|주|날)$/ : /^이전 (달|주|날)$/;
      const pick = (root) => [...document.querySelectorAll(root + ' button[aria-label]')].find((b) => b.offsetParent && !b.disabled && re.test(b.getAttribute('aria-label')));
      return (S.view === 'att' && pick('#main')) || pick('#top');
    };
    document.addEventListener('touchstart', (e) => {
      sw = null;
      if (e.touches.length !== 1 || S.editing || (S.view !== 'cal' && S.view !== 'att')) return;
      const t = e.target;
      if (!t.closest || !t.closest('#main') || t.closest('input, textarea, select, .dlg, #sheet, .tour') || hScroll(t)) return; // 옆으로 스크롤되는 표 안에서는 표를 스크롤
      sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!sw) return;
      const p = e.changedTouches[0], dx = p.clientX - sw.x, dy = p.clientY - sw.y, dt = Date.now() - sw.t;
      sw = null;
      if (dt > 700 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const b = navBtn(dx < 0); // 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전
      if (b) b.click();
    }, { passive: true });
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
      setDone: (ts, to) => { if (to && PF.autoDel) ts.forEach((t) => deleteItem(t.id)); else ts.forEach((t) => t.set({ done: to })); },
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
      if (it.kill) return; // 완료하면 자동 삭제 (설정)
      const idx = ord++;
      if (it.virtual) { // 계산으로 생긴 반복 항목: 고친 게 있을 때만 그날 기록으로 저장
        const r = ruleOf(it.rid); if (!r) return;
        seen.add(it.rid);
        const changed = text !== r.text || it.done || !!it.dday || !!it.al || !!it.ak || (it.fg || '') !== (r.fg || '') || (it.bg || '') !== (r.bg || '') || (it.sz || '') !== (r.sz || '') || (it.bl || '') !== (r.bl || '');
        if (changed) Data.put('todos', clean({ id: oid(it.rid, ds), rid: it.rid, date: ds, text, done: !!it.done, fg: it.fg, bg: it.bg, sz: it.sz, bl: it.bl, dday: it.dday || '', al: it.al || '', ak: it.ak || '', ord: idx, created: Date.now() }));
        return;
      }
      if (!it.id) it.id = uid();
      keep.add(it.id);
      if (it.rid) seen.add(it.rid);
      const o = old.find((x) => x.id === it.id);
      const rec = clean({ ...(o || {}), id: it.id, date: ds, text, done: !!it.done, fg: it.fg || '', bg: it.bg || '', sz: it.sz || '', bl: it.bl || '', dday: it.dday ? true : '', al: it.al || '', ak: it.ak || '', ord: idx, created: (o && o.created) || Date.now() });
      if (!o || o.text !== rec.text || !!o.done !== rec.done || (o.fg || '') !== (rec.fg || '') || (o.bg || '') !== (rec.bg || '') || (o.sz || '') !== (rec.sz || '') || (o.bl || '') !== (rec.bl || '') || !!o.dday !== !!rec.dday || (o.al || '') !== (rec.al || '') || !!o.ak !== !!rec.ak || o.ord !== rec.ord) Data.put('todos', rec);
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
    const items = itemsOn(ds).map((t) => ({ id: t.id, virtual: !!t.virtual, rid: t.rid, text: t.text, done: !!t.done, fg: t.fg, bg: t.bg, sz: t.sz, bl: t.bl, dday: t.dday, al: t.al, ak: t.ak }));
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
      if (it.sz) row.dataset.sz = it.sz; else delete row.dataset.sz;
      row.classList.toggle('dd', !!it.dday);
      if (row._dd) row._dd.hidden = !it.dday;
      if (row._al) { row._al.hidden = !it.al; row._al.title = '알림 ' + (it.al || ''); }
      if (row._bl && (row._bl.dataset.raw !== (it.bl || '') || !row._bl.firstChild)) setBullet(row._bl, it.bl);
      ['fg', 'bg'].forEach((k) => { if (it[k]) row.style.setProperty('--t' + k, it[k]); else row.style.removeProperty('--t' + k); });
    };
    const clearPicks = () => rows().forEach((r) => r.classList.remove('picked'));
    // 선택한 줄이 있으면 그 줄들, 없으면 커서가 있는 줄
    const targets = (incEmpty) => { // incEmpty: 아직 글자를 안 쓴 줄도 포함 (색·크기는 미리 정할 수 있게)
      let rs = rows().filter((r) => r.classList.contains('picked'));
      if (!rs.length) { const f = rows().find((r) => r.contains(document.activeElement)); if (f) rs = [f]; }
      return rs.filter((r) => incEmpty || r._it.text.trim()).map((r) => ({ id: r._it.id, get: () => r._it, set: (p) => { if ('done' in p) r._it.kill = !!(p.done && !r._it.done && PF.autoDel); Object.assign(r._it, p); paint(r); } }));
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
      const bl = el('span', { class: 'bl' });
      const ddm = el('span', { class: 'ddm', title: 'D-day' }, icon('dday'));
      const alm = el('span', { class: 'ddm', title: '알림' }, icon('bell'));
      const row = el('div', { class: 'td' }, bl, inp, it.rid ? el('span', { class: 'rpt', title: '반복' }, icon('repeat')) : null, ddm, alm);
      row._it = it; row._bl = bl; row._dd = ddm; row._al = alm;
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
      const fit = () => { if (!inp.isConnected) return; inp.style.width = '0px'; inp.style.width = Math.max(Math.ceil(inp.scrollWidth) + 6, 8) + 'px'; const un = () => { if (inp.scrollWidth - inp.clientWidth <= 4) inp.scrollLeft = 0; }; un(); requestAnimationFrame(un); /* 글자가 다 들어가는데 앞쪽이 밀려 잘려 있으면 되돌림(입력 직후 브라우저가 한 번 더 밀기도 해서 한 프레임 뒤에도 확인) */ }; // 배경색은 입력한 글자 뒤에만
      requestAnimationFrame(fit);
      if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(fit)); // 글꼴이 늦게 와서 너비가 달라져도 다시 맞춰요
      ['compositionupdate', 'compositionend', 'keyup'].forEach((t) => inp.addEventListener(t, () => requestAnimationFrame(fit))); // 모바일 한글 입력: 조합 중인 마지막 글자까지 넓혀요
      row.addEventListener('mousedown', (e) => { if (e.target === row) { e.preventDefault(); inp.focus(); const n = inp.value.length; inp.setSelectionRange(n, n); } });
      inp.addEventListener('input', () => { it.text = inp.value; fit(); });
      inp.addEventListener('scroll', () => { if (inp.scrollLeft && inp.scrollWidth - inp.clientWidth <= 4) inp.scrollLeft = 0; }); // 글자가 다 들어가는데 브라우저가 늦게 옆으로 밀면 그 순간 되돌림
      onEnter(inp, () => {
        if (inp.value.trim() === '' && row === rows().at(-1)) return; // 빈 줄에서 엔터는 아무 일도 안 해요 (닫기는 Esc · 바깥 클릭 · X)
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
      if (opt.barHost && document.activeElement === document.body) return; // 팝업 안 빈 곳을 눌러서 포커스가 풀린 경우는 닫지 않아요
      if (S.holdSheet) return;
      if (!closed && !box.contains(document.activeElement)) finish();
    }, 0));

    const live = () => { // 팝업을 닫기 전에도 뒤쪽 캘린더에 바로 반영
      commitTodos(ds, rows().map((r) => r._it), origVirtual);
      const e = S.editing; S.editing = null; try { render(); } finally { S.editing = e; }
    };
    bar = makeBar({
      cls: opt.barHost ? 'inline' : '',
      targets,
      after: () => { if (opt.barHost) live(); },
      repeat: (ts) => { // 모달에서 입력해야 하니 편집을 먼저 저장해요
        const its = ts.map((t) => t.get());
        clearPicks();
        if (opt.barHost) { // 할 일 팝업은 그대로 두고 그 위에 반복 팝업을 겹쳐서 열어요
          commitTodos(ds, rows().map((r) => r._it), origVirtual);
          const ids = its.map((i) => i.id).filter(Boolean);
          S.holdSheet = true;
          openRepeat({ ds, ids, onClose: () => { S.holdSheet = false; api.discard(); render(); openSheet(ds); } });
          return;
        }
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
      discard() { // 저장 없이 편집기만 정리 (반복 설정 뒤 새로 열 때)
        if (closed) return; closed = true; closePal(); if (bar) bar.remove();
        document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp);
        S.editing = null;
      },
      addRow() { const nr = mkRow({ text: '', done: false }); box.append(nr); nr.querySelector('input').focus(); },
    };
    S.editing = api;
    const f = opt.focusId && rows().find((r) => r._it.id === opt.focusId);
    if (f) focusEnd(f); else rows().at(-1).querySelector('input').focus();
    return api;
  }

  /* ---------- 모바일: 날짜 누르면 아래에서 올라오는 시트 ---------- */
  function openSheet(ds, opt = {}) {
    const sh = $('#sheet');
    sh.hidden = false; sh.replaceChildren();
    const d = parseYmd(ds);
    const body = el('div', { class: 'sbody' });
    let api;
    const noBlur = (b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); return b; };
    const close = noBlur(el('button', { class: 'ib', type: 'button', 'aria-label': '닫기', onclick: () => api && api.finish() }, icon('close')));
    const foot = el('div', { class: 'sfoot' });
    const g = (S.gcal[ds] || []).map(gev);
    sh.append(el('div', { class: 'back', onclick: () => api && api.finish() }),
      el('div', { class: 'panel' },
        el('div', { class: 'shead' }, el('b', {}, `${md(ymd(d))}`), el('span', { class: 'grow' }), close),
        g.length ? el('div', { class: 'sg' }, g) : null,
        body, foot));
    sh.querySelector('.panel').addEventListener('mousedown', (e) => { if (!e.target.closest('input, textarea, select, button')) e.preventDefault(); });
    api = openEditor(body, ds, () => { sh.hidden = true; sh.replaceChildren(); }, { barHost: foot, focusId: opt.focusId });
  }

  /* ================= 반복 설정 · 관리 팝업 ================= */
  function repeatForm(init, opt, onChange) {
    const L = window.Lunar;
    const base = parseYmd(init.start);
    const st = {
      kind: init.kind || 'weekly', dows: new Set(init.dows || [base.getDay()]), dom: init.dom || base.getDate(), skipWE: !!init.skipWE,
      lunar: !!init.lunar, month: init.month || base.getMonth() + 1, day: init.day || base.getDate(),
      start: init.start, end: init.end || '', text: init.text || '', fg: init.fg || '', bg: init.bg || '', bl: init.bl || '',
    };
    const root = el('div', { class: 'rform' });
    let textIn = null;
    if (opt.withText) {
      textIn = el('input', { type: 'text', class: 'rtext', value: st.text, 'aria-label': '반복할 할 일', spellcheck: 'false' });
      textIn.addEventListener('input', () => { st.text = textIn.value; if (onChange) onChange(); });
      root.append(fld(textIn));
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
        sync();
      } }, DOW[d]));
    }
    oWeekly.querySelectorAll('.dowb').forEach((b) => b.classList.toggle('on', st.dows.has(+b.dataset.d)));
    const wrapW = el('div', { class: 'rln' }, el('span', {}, '매주'), oWeekly);

    const domIn = el('input', { type: 'number', min: '1', max: '31', value: st.dom, 'aria-label': '일' });
    domIn.addEventListener('input', () => { st.dom = +domIn.value; sync(); });
    const oMonthly = el('div', { class: 'rln' }, el('span', {}, '매달'), domIn, el('span', {}, '일'));

    const calSeg = el('div', { class: 'seg rc' },
      el('button', { type: 'button', class: 'sg-b', 'data-c': '0', onclick: () => setLunar(false) }, '양력'),
      L ? el('button', { type: 'button', class: 'sg-b', 'data-c': '1', onclick: () => setLunar(true) }, '음력') : null);
    const monIn = el('input', { type: 'number', min: '1', max: '12', value: st.month, 'aria-label': '월' });
    const dayIn = el('input', { type: 'number', min: '1', max: '31', value: st.day, 'aria-label': '일' });
    monIn.addEventListener('input', () => { st.month = +monIn.value; sync(); });
    dayIn.addEventListener('input', () => { st.day = +dayIn.value; sync(); });
    function setLunar(on) {
      st.lunar = on;
      if (on && L) { const l = L.lunarOf(base); if (l) { st.month = l.m; st.day = l.d; } }
      else { st.month = base.getMonth() + 1; st.day = base.getDate(); }
      monIn.value = st.month; dayIn.value = st.day; sync();
    }
    const oYearly = el('div', { class: 'rln' }, el('span', {}, '매년'), calSeg, monIn, el('span', {}, '월'), dayIn, el('span', {}, '일'));

    /* 기간: 시작일 ≤ 종료일 (앞쪽 날짜는 고를 수 없고, 직접 입력하면 같은 날로 맞춰요) */
    const startIn = el('input', { type: 'date', value: st.start, 'aria-label': '시작일' });
    const endIn = el('input', { type: 'date', value: st.end, 'aria-label': '종료일' });
    const cbForever = el('input', { type: 'checkbox' }); cbForever.checked = !st.end;
    const limits = () => { endIn.min = st.start || ''; startIn.max = st.end || ''; };
    startIn.addEventListener('change', () => {
      if (!startIn.value) startIn.value = st.start;
      st.start = startIn.value;
      if (st.end && st.end < st.start) { st.end = st.start; endIn.value = st.end; }
      limits(); sync();
    });
    endIn.addEventListener('change', () => {
      if (endIn.value && endIn.value < st.start) endIn.value = st.start;
      st.end = endIn.value; limits(); sync();
    });
    cbForever.addEventListener('change', () => {
      endIn.disabled = cbForever.checked;
      if (cbForever.checked) { st.end = ''; endIn.value = ''; } else if (!st.end) { st.end = st.start; endIn.value = st.end; }
      limits(); sync();
    });
    endIn.disabled = cbForever.checked;
    limits();
    const per = el('div', { class: 'rper' }, el('label', {}, '시작일', startIn), el('label', {}, '종료일', endIn), el('label', { class: 'rchk' }, cbForever, '계속'));

    const sub = el('div', { class: 'rsub' }, oDaily, wrapW, oMonthly, oYearly);
    root.append(per, sub);
    if (opt.withColors) {
      const sw = swatches((p) => Object.assign(st, p), st);
      const blr = el('div', { class: 'swr' }, el('span', { class: 'swl' }, '기호'));
      const blb = el('div', { class: 'pc2 blset' });
      BUL.forEach(([k, name]) => blb.append(el('button', { type: 'button', class: 'blb' + ((st.bl || PF.tbl || 'dot') === k ? ' on' : ''), 'data-bl': k, 'aria-label': name, onclick: () => {
        st.bl = k; blb.querySelectorAll('.blb').forEach((x) => x.classList.toggle('on', x.dataset.bl === k)); if (onChange && ready) onChange();
      } }, bulIcon(k))));
      blr.append(blb); sw.prepend(blr);
      root.insertBefore(sw, kinds);
    }

    function sync() {
      kinds.querySelectorAll('.sg-b').forEach((b) => b.classList.toggle('on', b.dataset.k === st.kind));
      calSeg.querySelectorAll('.sg-b').forEach((b) => b.classList.toggle('on', (b.dataset.c === '1') === st.lunar));
      oDaily.classList.toggle('off', st.kind !== 'daily'); wrapW.classList.toggle('off', st.kind !== 'weekly');
      oMonthly.classList.toggle('off', st.kind !== 'monthly'); oYearly.classList.toggle('off', st.kind !== 'yearly');
      slidePills();
      if (onChange && ready) onChange();
    }
    let ready = false;
    sync(); ready = true;

    /* 꼭 필요한 값이 비면 null → 저장 버튼이 꺼져요 */
    const read = () => {
      const f = { kind: st.kind, start: st.start, end: st.end || '' };
      if (!f.start || (!cbForever.checked && !f.end)) return null;
      if (st.kind === 'daily') f.skipWE = st.skipWE;
      if (st.kind === 'weekly') {
        if (!st.dows.size) return null;
        f.dows = [...st.dows].sort((a, b) => a - b);
      }
      if (st.kind === 'monthly') {
        if (!(st.dom >= 1 && st.dom <= 31)) return null;
        f.dom = st.dom;
      }
      if (st.kind === 'yearly') {
        if (!(st.month >= 1 && st.month <= 12) || !(st.day >= 1 && st.day <= (st.lunar ? 30 : 31))) return null;
        f.month = st.month; f.day = st.day; f.lunar = st.lunar;
      }
      if (opt.withText) { if (!st.text.trim()) return null; f.text = st.text.trim(); }
      if (opt.withColors) { f.fg = st.fg; f.bg = st.bg; f.bl = st.bl || ''; }
      return f;
    };
    return { node: root, read, focus: () => { if (textIn) textIn.focus(); } };
  }

  const bulletRow = (i) => el('div', { class: 'td rtarget', 'data-sz': i.sz || null }, blSpan(i.bl), el('span', { class: 'rchip', style: colorVars(i) || null }, i.text));

  async function removeRule(r) {
    if (!(await ask('이 반복을 삭제할까요?'))) return false;
    const ovr = S.todos.filter((t) => t.rid === r.id);
    Data.del('repeats', r.id); ovr.forEach((t) => Data.del('todos', t.id));
    render();
    return true;
  }

  /* 반복 팝업(하나로 통일): 반복 관리의 추가·수정, 할 일에서 연 반복 설정이 모두 이 창이에요 */
  function openRuleDialog({ rule = null, items = [], ds, onClose } = {}) {
    const multi = items.length > 1;
    const one = items.length === 1 ? items[0] : null;
    const layer = el('div', { class: 'askw' });
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    const shut = () => { document.removeEventListener('keydown', key, true); layer.remove(); if (onClose) onClose(); };
    const ok = el('button', { class: 'pri', type: 'button' }, '저장');
    const init = rule ? { ...rule } : one ? { text: one.text, fg: one.fg, bg: one.bg, bl: one.bl, start: one.date || ds } : { start: ds || S.sel || ymd(new Date()) };
    const opt = multi ? {} : { withText: true, withColors: true };
    const form = repeatForm(init, opt, () => { ok.disabled = !form.read(); });
    ok.disabled = !form.read();
    const delBtn = rule ? el('button', { class: 'ghost sm danger', type: 'button', onclick: async () => { if (await removeRule(rule)) shut(); } }, icon('trash'), '삭제') : null;
    if (delBtn && form.node.firstElementChild) { // 삭제는 지울 내용(할 일 글자) 바로 옆에
      const f0 = form.node.firstElementChild, row = el('div', { class: 'rdel' });
      f0.replaceWith(row); row.append(f0, delBtn);
    }
    ok.addEventListener('click', () => {
      const f = form.read(); if (!f) return;
      if (rule) { // 규칙을 고치면 따로 고쳐둔 날짜 항목에도 글자·기호·색이 모두 적용돼요
        const r = clean({ id: rule.id, created: rule.created, sz: rule.sz, ...f });
        Data.put('repeats', r);
        S.todos.filter((t) => t.rid === r.id && !t.skip).forEach((t) => Data.put('todos', clean({ ...t, text: r.text, fg: r.fg || '', bg: r.bg || '', bl: r.bl || '' })));
      } else if (items.length) {
        items.forEach((it) => {
          const r = clean({ id: uid(), created: Date.now(), sz: it.sz, ...(multi ? { text: it.text, fg: it.fg, bg: it.bg, bl: it.bl } : {}), ...f });
          Data.put('repeats', r);
          if (occursOn(r, it.date)) { // 한 번짜리 항목은 반복 항목으로 바꿔치기 (완료 표시는 유지)
            Data.del('todos', it.id);
            if (it.done) Data.put('todos', clean({ id: oid(r.id, it.date), rid: r.id, date: it.date, text: r.text, done: true, fg: r.fg, bg: r.bg, sz: r.sz, bl: r.bl, ord: 0, created: Date.now() }));
          }
        });
      } else {
        Data.put('repeats', clean({ id: uid(), created: Date.now(), ...f }));
      }
      shut(); render();
    });
    layer.append(el('div', { class: 'back', onclick: shut }),
      el('div', { class: 'dlg rdlg' },
        el('div', { class: 'shead' }, hb('repeat', '반복'), el('button', { class: 'ib', type: 'button', onclick: shut, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'rbody' },
          multi ? el('div', { class: 'rtargets' }, items.map(bulletRow)) : null,
          form.node,
          el('div', { class: 'dlgf' },
            el('span', { class: 'grow' }), el('button', { class: 'ghost', type: 'button', onclick: shut }, '취소'), ok))));
    document.addEventListener('keydown', key, true);
    document.body.append(layer);
    slidePills(); setTimeout(() => form.focus(), 0);
  }

  /* 할 일의 반복 버튼: 이미 반복이면 그 반복의 수정 창, 아니면 새 반복 설정 */
  function openRepeat({ ds, ids = [], onClose } = {}) {
    const it = ids.map(getItem).find(Boolean); // 여러 개를 골랐어도 맨 위 하나에만 적용
    const rep = it && it.rid ? ruleOf(it.rid) : null;
    if (!rep && !(it && it.text)) { if (onClose) onClose(); return; }
    openRuleDialog({ rule: rep, items: rep ? [] : [it], ds, onClose });
  }

  /* 햄버거 메뉴의 반복 관리: 목록 · 추가 · 수정 · 삭제 */
  function openRepeatManage() {
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    let editing = null, mode = 'list';
    const body = el('div', { class: 'rbody' });
    const dlg = el('div', { class: 'dlg rdlg' },
      el('div', { class: 'shead' }, hb('repeat', '반복 관리'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
      body);
    m.append(el('div', { class: 'back', onclick: close }), dlg);

    function show() {
      body.replaceChildren();
      if (mode === 'form') showForm(); else showList();
    }
    function showList() {
      const list = S.repeats.slice().sort((a, b) => (a.created || 0) - (b.created || 0));
      body.append(el('div', { class: 'abar' }, el('button', { class: 'ghost sm', type: 'button', onclick: () => { editing = null; showForm(); } }, icon('plus'), '반복 추가')));
      if (!list.length) body.append(el('div', { class: 'mut small sempty' }, '반복 없음'));
      list.forEach((r) => {
        const per = r.start + (r.end ? ` ~ ${r.end}` : ' ~ 계속');
        body.append(el('div', { class: 'rrow' },
          el('div', { class: 'rinfo' }, bulletRow(r), el('div', { class: 'mut small' }, `${ruleSummary(r)} · ${per}`)),
          el('button', { class: 'ib', type: 'button', 'aria-label': '수정', onclick: () => { editing = r; showForm(); } }, icon('edit')),
          el('button', { class: 'ib danger', type: 'button', 'aria-label': '삭제', onclick: () => delRule(r) }, icon('trash'))));
      });
    }
    function showForm() { openRuleDialog({ rule: editing, ds: S.sel, onClose: () => { editing = null; show(); } }); }
    async function delRule(r) { if (await removeRule(r)) show(); }
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
    return P.parse(text, { students: studentPool(), classId: cur && cur.id, today: new Date(), base: parseYmd(S.sel), lastOf: (ds) => lastOf(ds, cur && cur.id) });
  }
  const monthRecs = (cls) => S.att.filter((a) => a.classId === cls.id && a.date.startsWith(`${S.y}-${pad(S.m + 1)}-`));

  function attView() {
    const root = el('div', { class: 'att' });
    if (!S.clsLoaded) { root.append(loading(true)); return root; }
    const real = curClass();
    const none = !real; // 학급이 없어도 같은 틀을 보여주고, 학급 추가만 켜 둬요
    const cls = real || { id: '', name: '', students: [], periods: [] };
    if (!none) S.clsId = cls.id;
    if (none) root.classList.add('off');

    const sel = el('select', { 'aria-label': '학급', disabled: none, onchange: (e) => { S.clsId = e.target.value; ls.set('hagisiro:cls', S.clsId); S.extra = {}; render(); } },
      S.classes.map((c) => el('option', { value: c.id, selected: c.id === cls.id }, c.name)));
    const seg = (v, label) => el('button', { class: 'sg-b' + (S.sub === v ? ' on' : ''), onclick: () => setSub(v) }, label);
    root.append(el('div', { class: 'abar' }, sel,
      el('button', { class: 'ghost sm', disabled: none, onclick: () => openRoster(cls.id) }, icon('users'), '학급 수정'),
      el('button', { class: 'ghost sm', onclick: () => openRoster(null) }, icon('userplus'), '학급 추가'),
      el('div', { class: 'seg' }, seg('day', '일별'), seg('week', '주별'), seg('month', '월별')),
      el('span', { class: 'grow' }),
      el('button', { class: 'ghost sm', disabled: none, onclick: openSettings }, icon('sliders'), '교시 설정'),
      el('button', { class: 'ghost sm', disabled: none, onclick: () => exportCsv(cls) }, icon('download'), '파일로 저장')));

    const q = el('input', { id: 'q', type: 'text', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': '출결 입력', disabled: none });
    q.addEventListener('input', preview);
    onEnter(q, submitQuick);
    root.append(el('div', { class: 'qi' },
      el('div', { class: 'qrow' }, fld(q), el('button', { class: 'qgo', type: 'button', id: 'qgo', disabled: none, 'aria-label': '출결 입력 확인', onclick: submitQuick }, icon('enter'))),
      el('div', { id: 'pv', class: 'pv' })));

    root.append(S.sub === 'month' ? monthView(cls) : S.sub === 'week' ? weekView(cls) : dayView(cls));
    if (!none) { setTimeout(preview, 0); setTimeout(maybeTour, 600); }
    return root;
  }

  /* ---------- 월별: 한눈에 보는 표 ---------- */
  function monthView(cls) {
    const frag = el('div', { class: 'mv' });
    const ph = () => el('span', { class: 'ib ph', 'aria-hidden': 'true' }); // 일별·주별의 ‹ › 자리 (월 이동은 위 헤더에 있어서 버튼 없음)
    frag.append(el('div', { class: 'dhead mhead' }, el('b', { class: 'dttl mttl0' }, `${S.m + 1}월`)));
    const recs = monthRecs(cls);
    const by = {};
    recs.forEach((a) => { (by[a.studentId + '|' + a.date] = by[a.studentId + '|' + a.date] || []).push(a); });
    const dim = new Date(S.y, S.m + 1, 0).getDate();
    const todayS = ymd(new Date());
    const dsOf = (d) => `${S.y}-${pad(S.m + 1)}-${pad(d)}`;
    const head = el('tr', {}, el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '이름'));
    for (let d = 1; d <= dim; d++) {
      const ds = dsOf(d); const w = new Date(S.y, S.m, d).getDay();
      head.append(el('th', { class: 'd go' + (w === 0 || w === 6 ? ' we' : '') + (w === 0 || holName(ds, new Date(S.y, S.m, d)) ? ' sun' : w === 6 ? ' sat' : '') + (ds === todayS ? ' tdy' : ''), 'data-d': ds }, el('div', {}, d), el('div', { class: 'dw' }, DOW[w])));
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
          td.append(el('span', { class: 'mk', title: arr.map((a) => `${kindLabel(a)} ${recLabel(a)}${a.reason ? ' · ' + a.reason : ''}`).join('\n') }, arr.map((a) => el('span', { class: 't-' + a.type + (a.type === '결석' && a.doc ? ' docok' : '') }, SHORT[a.type]))));
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
    frag.append(mkWrap(tbl));
    S.topSum = el('div', { class: 'msum' }, sumLine(recs));
    return frag;
  }


  /* 결석 서류 제출 확인 (일별·주별 공용, 눌러서 바로 저장) */
  function docChk(rec, mode) {
    const cb = el('input', { type: 'checkbox', checked: !!rec.doc, 'aria-label': '서류 제출 확인' });
    cb.addEventListener('change', () => { Data.put('att', { ...rec, doc: cb.checked }); render(); });
    return el('label', { class: 'docchk rchk', title: mode === 'nolabel' ? '서류 제출 확인' : null }, cb, mode === 'nolabel' ? null : el('span', {}, '서류 제출 확인'));
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
      el('b', { class: 'dttl wttl jump', onclick: (e) => editTtl(e.currentTarget, true) }, `${md(ymd(mon))} ~ ${md(ymd(fri))}`),
      el('button', { class: 'ib', 'aria-label': '다음 주', onclick: () => shiftW(1) }, icon('right')),
      el('span', { class: 'grow' }),
      (() => {
        const setAll = (v) => { if (S.weekAll === v) return; S.weekAll = v; ls.set('hagisiro:weekall', v ? '1' : ''); render(); const t = $('#main .wv > .mwrap, #main .wv > .empty'); if (t && t.animate) t.animate({ opacity: [0, 1] }, { duration: 220, easing: 'ease-out' }); };
        return el('div', { class: 'seg' }, el('button', { type: 'button', class: S.weekAll ? 'on' : '', onclick: () => setAll(true) }, '전체'), el('button', { type: 'button', class: S.weekAll ? '' : 'on', onclick: () => setAll(false) }, '기록 있는 학생만'));
      })()));

    const all = S.att.filter((a) => a.classId === cls.id && keys.includes(a.date));
    const by = {};
    all.forEach((a) => { (by[a.studentId + '|' + a.date] = by[a.studentId + '|' + a.date] || []).push(a); });
    const hasWE = [5, 6].map((i) => all.some((a) => a.date === keys[i])); // 기록이 있는 주말만 표시
    const cols = [0, 1, 2, 3, 4, 5, 6].filter((i) => i < 5 || hasWE[i - 5]);

    const head = el('tr', {}, el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '이름'),
      cols.map((i) => {
        const d = days[i];
        return el('th', { class: 'wcol go' + (d.getDay() === 0 || holName(keys[i], d) ? ' sun' : d.getDay() === 6 ? ' sat' : '') + (keys[i] === todayS ? ' tdy' : '') + (i >= 5 ? ' we' : ''), 'data-d': keys[i], },
          `${d.getMonth() + 1}.${d.getDate()}.`, el('span', { class: 'dw' }, ` (${DOW[d.getDay()]})`));
      }),
      null);
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
        arr.forEach((a) => {
          const txt = el('div', { class: 'wtx' },
            el('div', { class: 'wkd' }, kindLabel(a)),
            el('div', { class: 'wg' }, recLabel(a)),
            a.reason ? el('div', { class: 'wr2 mut' }, a.reason) : null);
          td.append(el('div', { class: 'wi t-' + a.type + (a.type === '결석' ? ' wdoc' : '') }, txt,
            a.type === '결석' ? docChk(a, 'nolabel') : null));
        });
        tr.append(td);
      });
      tbody.append(tr);
    });
    const tbl = el('table', { class: 'mt wt', style: `--n:${cols.length}` }, el('thead', {}, head), tbody);
    tbl.addEventListener('click', (e) => {
      if (e.target.closest('.docchk')) return; // 서류 체크는 날짜 이동 없이 바로 저장
      const c = e.target.closest('[data-d]');
      if (c) { setSel(c.dataset.d); setSub('day'); }
    });
    if (!students.length) wrap.append(el('div', { class: 'empty mut' }, '기록 없음'));
    else wrap.append(mkWrap(tbl));

    S.topSum = el('div', { class: 'msum' }, sumLine(all));
    return wrap;
  }

  /* 표 영역: 스크롤바는 틀 바깥(오른쪽)에 두고, 틀(테두리·둥근 모서리)은 스크롤돼도 제자리에 고정 */
  function mkWrap(tbl) {
    const box = el('div', { class: 'mbox' }, tbl);
    const w = el('div', { class: 'mwrap' }, el('div', { class: 'mfr' }, el('i')), box);
    const fit = () => { const pb = parseFloat(getComputedStyle(w).paddingBottom) || 0; w.style.setProperty('--mh', Math.max(0, w.clientHeight - pb) + 'px'); end(); };
    const end = () => w.classList.toggle('atend', w.scrollTop + w.clientHeight >= w.scrollHeight - 1); // 아래에 더 이어지는 자료가 있으면 틀 아래선을 숨겨서, 잘린 줄이 닫힌 표처럼 보이지 않게
    w.addEventListener('scroll', end, { passive: true });
    if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(w); ro.observe(box); }
    requestAnimationFrame(() => { fit(); requestAnimationFrame(fit); }); setTimeout(fit, 350); // 크기 변화가 없어 관찰자가 안 울리는 경우(주말 등)에도 틀 높이를 확정
    return w;
  }
  /* 불러오는 중: 글자 대신 보라~파랑 도넛 링이 빙글빙글 */
  /* 불러오는 중: 네모 하나가 시계 방향으로 돌며 칸을 채우고(1바퀴) 먹어치우는(2바퀴) 슬라임. 로딩이 끝나 화면에서 사라지면 그 자리에서 바로 멈춰요 */
  const SLIME = (() => {
    const POS = [[0, 0], [34, 0], [34, 34], [0, 34]], SZ = 30, RX = 9, STEP = 450;
    const STEPS = []; for (let lap = 0; lap < 2; lap++) for (let k = 0; k < 4; k++) STEPS.push({ from: k, to: (k + 1) % 4, erase: !!lap });
    const TOTAL = STEPS.length * STEP;
    const bez = (x1, y1, x2, y2) => (t) => { let lo = 0, hi = 1, u = t; for (let i = 0; i < 24; i++) { u = (lo + hi) / 2; const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; if (x < t) lo = u; else hi = u; } return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u; };
    const ease = bez(0.5, -0.12, 0.3, 1.1); // 살짝 당겼다가 튀어 나가고 조금 넘쳤다 돌아오는 쫀득한 곡선
    function frame(t) {
      const idx = Math.min(STEPS.length - 1, Math.floor(t / STEP));
      const cells = new Set([0]);
      for (let i = 0; i < idx; i++) { const x = STEPS[i]; if (x.erase) cells.delete(x.from); cells.add(x.to); }
      const x = STEPS[idx], u = (t - idx * STEP) / STEP;
      if (x.erase) cells.delete(x.from);
      const e = ease(u), d = 1e-3, v = (ease(Math.min(1, u + d)) - ease(Math.max(0, u - d))) / (2 * d);
      const dx = POS[x.to][0] - POS[x.from][0], dy = POS[x.to][1] - POS[x.from][1];
      const st = 1 + Math.min(0.5, Math.abs(v) * 0.16);
      const w = dx ? SZ * st : SZ / Math.sqrt(st), h = dx ? SZ / Math.sqrt(st) : SZ * st;
      const cx = POS[x.from][0] + dx * e + SZ / 2, cy = POS[x.from][1] + dy * e + SZ / 2;
      let o = '<g filter="url(#slGoo)" fill="url(#slG)">';
      cells.forEach((i) => { o += `<rect x="${POS[i][0]}" y="${POS[i][1]}" width="${SZ}" height="${SZ}" rx="${RX}"/>`; });
      return o + `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${RX}"/></g>`;
    }
    const live = new Set(); let run = false;
    function loop(now) {
      live.forEach((n) => { if (!n.isConnected) { if (now - n._t0 > 400) live.delete(n); return; } n.innerHTML = frame(Math.max(0, now - n._t0) % TOTAL); });
      if (live.size) requestAnimationFrame(loop); else run = false;
    }
    return (size) => {
      if (!document.getElementById('slDefs')) {
        document.body.insertAdjacentHTML('beforeend', '<svg id="slDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="slG" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="62" y2="62"><stop offset="0" stop-color="#6d4aff"/><stop offset=".5" stop-color="#2f6df6"/><stop offset="1" stop-color="#12c9b3"/></linearGradient><filter id="slGoo" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="1.7" result="b"/><feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter></defs></svg>');
      }
      const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      n.setAttribute('viewBox', '-6 -6 76 76'); n.setAttribute('width', size); n.setAttribute('height', size); n.style.overflow = 'visible';
      n.innerHTML = frame(0);
      if (!noAnim()) { n._t0 = performance.now(); live.add(n); if (!run) { run = true; requestAnimationFrame(loop); } }
      return n;
    };
  })();
  const loading = (page) => el('div', { class: 'ldg' + (page ? ' page' : ''), role: 'status', 'aria-label': '불러오는 중' }, SLIME(40));
  const hb = (ic, t) => el('b', { class: 'hb' }, icon(ic), t);
  /* 팝업 제목줄을 잡아 끌면 팝업이 이동 (뒤에 있는 내용을 볼 수 있게) */
  document.addEventListener('mousedown', (e) => {
    const h = e.target.closest && e.target.closest('.shead');
    if (!h || e.button !== 0 || e.target.closest('button, input, select, textarea')) return;
    const dlg = h.closest('.dlg, .panel');
    if (!dlg) return;
    const x0 = e.screenX, y0 = e.screenY, tx = dlg._tx || 0, ty = dlg._ty || 0;
    const mv = (ev) => {
      dlg._tx = tx + ev.screenX - x0; dlg._ty = ty + ev.screenY - y0;
      dlg.style.translate = `${dlg._tx}px ${dlg._ty}px`;
      const r = dlg.getBoundingClientRect();
      let fx = 0, fy = 0; // 팝업은 위젯 밖으로 나가지 못해요
      if (r.top < 0) fy = -r.top; else if (r.bottom > innerHeight) fy = Math.max(innerHeight - r.bottom, -r.top);
      const vw = document.documentElement.clientWidth || innerWidth;
      if (r.left < 0) fx = -r.left; else if (r.right > vw) fx = Math.max(vw - r.right, -r.left);
      if (fx || fy) { dlg._tx += fx; dlg._ty += fy; dlg.style.translate = `${dlg._tx}px ${dlg._ty}px`; }
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    e.preventDefault();
  });
  /* ---------- 일별: 조회 · 1~N교시 · 종례 에 빗금 ---------- */
  function dayView(cls) {
    const ds = S.sel;
    const d = parseYmd(ds);
    const last = lastOf(ds, cls.id);
    const def = dayDefault(ds, cls.id);
    const ovr = !!ovrOf(ds, cls.id);
    const wrap = el('div', { class: 'dv' });

    const shift = (n) => { setSel(ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))); render(); };
    const cntSel = el('select', { class: 'cnt' + (ovr ? ' ovr' : ''), 'aria-label': '이날 교시 수', onchange: (e) => { setDayPeriods(ds, +e.target.value, cls.id); render(); } },
      Array.from({ length: 11 }, (_, n) => el('option', { value: n, selected: n === last }, n ? `${n}교시` : '수업 없음')));
    wrap.append(el('div', { class: 'dhead' },
      el('button', { class: 'ib', 'aria-label': '이전 날', onclick: () => shift(-1) }, icon('left')),
      el('b', { class: 'dttl jump' + (d.getDay() === 0 || holName(ds, d) ? ' sun' : d.getDay() === 6 ? ' sat' : ''), onclick: (e) => editTtl(e.currentTarget, true) }, `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`),
      el('button', { class: 'ib', 'aria-label': '다음 날', onclick: () => shift(1) }, icon('right')),
      el('span', { class: 'grow' }),
      ovr ? el('button', { class: 'ghost sm', onclick: () => { setDayPeriods(ds, def, cls.id); render(); } }, icon('uturn'), `기본 ${def ? def + '교시' : '수업 없음'}`) : null,
      cntSel));

    const recs = S.att.filter((a) => a.classId === cls.id && a.date === ds);
    const by = {}; recs.slice().sort((a, b) => (a.created || 0) - (b.created || 0)).forEach((a) => { (by[a.studentId] = by[a.studentId] || []).push(a); });

    const slotN = last + 2; // 조회 + 교시들 + 종례
    const head = el('tr', {},
      el('th', { class: 'c1' }, '번호'), el('th', { class: 'c2' }, '이름'), el('th', { class: 'kc' }, '종류'),
      Array.from({ length: slotN }, (_, i) => el('th', { class: 'sl-h' }, i === 0 ? '조회' : i === slotN - 1 ? '종례' : `${i}교시`)),
      el('th', { class: 'rs-h' }, '사유'));
    const tbody = el('tbody');

    function addRow(s, rec, first) {
      const cells = [el('td', { class: 'c1' }, first ? s.no : ''), el('td', { class: 'c2' }, first ? s.name : '')];
      const ksel = el('select', { class: 'ksel' + (rec ? ' t-' + rec.type : ''), 'aria-label': `${s.name} 출결 종류` },
        el('option', { class: 'o-ok', value: '출석' }, '출석'),
        TYPES.map((t) => CATS.map((c) => el('option', { class: 't-' + t, value: c + t, selected: !!rec && rec.cat === c && rec.type === t }, c + t))));
      ksel.addEventListener('change', () => setKind(s, rec, ksel.value, ds, cls));
      cells.push(el('td', { class: 'kc' }, ksel));
      if (rec && rec.type === '결석') { // 결석은 조회~종례가 전부 빗금(건드릴 수 없음) + 가운데에 서류 제출 확인
        cells.push(el('td', { class: 'slc absc', colspan: slotN },
          el('div', { class: 'absw' }, Array.from({ length: slotN }, () => el('span', { class: 'sl t-결석' }, icon('slash'))), docChk(rec))));
        const rin = el('input', { type: 'text', class: 'rin', value: rec.reason || '', 'aria-label': `${s.name} 사유`, spellcheck: 'false' });
        rin.addEventListener('change', () => Data.put('att', { ...rec, reason: rin.value.trim() }));
        rin.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) rin.blur(); });
        cells.push(el('td', { class: 'rs' }, el('div', { class: 'rsw' }, rin)));
      } else if (rec) {
        const on = new Set(recCols(rec, last));
        for (let i = 0; i < slotN; i++) cells.push(el('td', { class: 'slc tg' + (on.has(i) ? ' sl t-' + rec.type : ''), title: on.has(i) ? kindLabel(rec) : null, onclick: () => toggleSlot(s, rec, i, ds, cls) }, on.has(i) ? icon('slash') : ''));
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

    wrap.append(mkWrap(el('table', { class: 'mt dt' }, el('thead', {}, head), tbody)));
    S.topSum = el('div', { class: 'msum' }, sumLine(recs));
    if (last === 0) wrap.append(el('div', { class: 'mut small' }, '수업 없음'));
    return wrap;
  }

  function setKind(s, rec, label, ds, cls) {
    const k = KINDS.find((x) => x.label === label);
    if (!k) { // '출석' = 기록 없음
      if (rec) { Data.del('att', rec.id); }
      render(); return;
    }
    if (rec) {
      const r = { ...rec, cat: k.cat, type: k.type };
      if (k.type !== rec.type) { const [f, t] = P.defaultRange(k.type, null, null, lastOf(ds, cls.id)); r.from = f; r.to = t; delete r.slots; }
      Data.put('att', r);
    } else {
      const [f, t] = P.defaultRange(k.type, null, null, lastOf(ds, cls.id));
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
    const last = lastOf(ds, cls.id);
    if (!rec) {
      const k = KINDS.find((x) => x.cat === '미인정' && x.type === '결과');
      const v = colVal(i, last);
      Data.put('att', { id: uid(), classId: cls.id, studentId: s.id, name: s.name, no: s.no, date: ds, type: k.type, cat: k.cat, from: v, to: v, slots: [v], reason: '', created: Date.now() });
      render(); return;
    }
    const set = new Set(recCols(rec, last));
    if (set.has(i)) set.delete(i); else set.add(i);
    if (!set.size) { Data.del('att', rec.id); render(); return; }
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

  /* 처음 쓰는 사람에게: 대상만 밝게, 나머지는 어둡게 하고 말풍선으로 안내 ('다시 열지 않음'을 고르면 다시 안 떠요) */
  function showTour(target, key, lines) {
    const r = target.getBoundingClientRect();
    const hole = el('div', { class: 'tour-hole' });
    const never = el('input', { type: 'checkbox' });
    const close = () => { if (never.checked) ls.set(key, '1'); box.classList.add('out'); setTimeout(() => box.remove(), 230); };
    const tip = el('div', { class: 'tour-tip' }, lines,
      el('div', { class: 'tour-f' }, el('label', { class: 'rchk' }, never, '다시 열지 않음'), el('button', { class: 'pri sm', type: 'button', onclick: close }, '닫기')));
    const box = el('div', { class: 'tour' }, hole, tip);
    document.body.append(box);
    const cr = box.getBoundingClientRect(); // 위젯 모드에선 위젯 안쪽만 덮어요
    const rl = r.left - cr.left, rt = r.top - cr.top;
    Object.assign(hole.style, { left: rl - 4 + 'px', top: rt - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px' });
    const w = Math.min(300, cr.width - 16);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(8, Math.min(rl, cr.width - w - 8)) + 'px';
    const th = tip.offsetHeight;
    tip.style.top = (rt + r.height + 12 + th < cr.height ? rt + r.height + 12 : Math.max(8, rt - th - 12)) + 'px';
  }
  /* 출결 화면에 처음 들어오면: 입력칸 */
  function maybeTour() {
    if (S.tourShown || ls.get('hagisiro:tourAtt') === '1') return;
    const row = $('#main .qrow');
    if (!row || !row.offsetWidth) return;
    S.tourShown = true;
    showTour(row, 'hagisiro:tourAtt', [
      el('div', {}, '출결은 문장으로도 입력할 수 있어요.'),
      el('div', { class: 'mut' }, '예) 김네모 감기로 12일 4교시에 조퇴 /'),
      el('div', { class: 'mut' }, '내일부터 3일간 이세모 가족여행 체험학습')]);
  }
  /* 캘린더를 처음 열면: 오늘 칸 (두 번 클릭은 화면에 안 보이는 동작이라서. 한 번 터치로 여는 모바일은 안내 없음) */
  function maybeTodoTour() {
    if (S.todoTourShown || ls.get('hagisiro:tourTodo') === '1' || tapEdit() || S.editing || needLogin() || S.view !== 'cal' || document.querySelector('.tour, #sheet:not([hidden])')) return;
    const cell = $(`#cal .cell[data-date="${ymd(new Date())}"]`);
    if (!cell || !cell.offsetWidth) return;
    S.todoTourShown = true;
    showTour(cell, 'hagisiro:tourTodo', [el('div', {}, '날짜 칸을 더블클릭해서 할 일을 입력해 보세요.')]);
  }
  function preview() {
    const q = $('#q'), pv = $('#pv');
    if (!q || !pv) return;
    const v = q.value.trim();
    pv.replaceChildren(); pv.className = 'pv';
    const ASK = '이름, 날짜, 사유 등을 입력해 주세요.';
    if (!v) { pv.append(el('span', { class: 'mut' }, ASK)); return; }
    const r = runParse(v);
    if (r.errors.length) {
      const info = r.info || {};
      if (r.errors.includes('student') && !info.type && !info.period && !info.date) { pv.append(el('span', { class: 'mut' }, ASK)); return; } // 이름 쓰는 중
      pv.append(el('span', { class: 'mut' }, r.errors.includes('student') ? '학생 이름을 입력해 주세요.' : '출결 종류(결석/지각/조퇴/결과)를 입력해 주세요.')); // 오류가 아니라 입력 중 안내라서 회색
      return;
    }
    r.items.slice(0, 5).forEach((it) => pv.append(el('span', { class: 'chip t-' + it.type }, chipText(it))));
    if (r.items.length > 5) pv.append(el('span', { class: 'mut' }, `외 ${r.items.length - 5}건`));
    // 빠진 것 중 가장 중요한 하나만 안내: 사유 → 날짜 → 교시
    const it0 = r.items[0], info = r.info || {};
    let note = '';
    if (!info.reason) note = '사유가 없으면 미인정으로 등록돼요.';
    else if (r.dateGuessed) note = `날짜가 없으면 ${(() => { const t = S.sel === ymd(new Date()) ? '오늘' : md(S.sel); return t + ro(t); })()} 등록돼요.`;
    else if (!info.period && it0.type !== '결석') note = `교시가 없으면 ${P.rangeLabel(it0.from, it0.to)}로 등록돼요.`;
    if (note) pv.append(el('span', { class: 'mut' }, note));
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
    q.value = ''; // 저장하면서 화면이 다시 그려져도 입력한 문장이 남지 않게 먼저 비워요
    const created = [], replaced = [];
    for (const it of r.items) {
      const dup = S.att.find((a) => a.studentId === it.studentId && a.date === it.date); // 하루 1건: 같은 학생·같은 날이면 덮어씀
      if (dup) { if (!created.some((c) => c.id === dup.id)) replaced.push(dup); Data.put('att', { ...dup, ...it, id: dup.id }); }
      else { const rec = { ...it, id: uid(), created: Date.now() }; created.push(rec); Data.put('att', rec); }
    }
    S.sub = 'day'; ls.set('hagisiro:sub', 'day');
    setSel(r.items[0].date); // 입력한 날짜의 일별 보기로 이동
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
  /* 종류(연락처·일과 진행 시간표·내 시간표)마다 이름을 붙여 여러 개 저장: 처음 것은 id가 종류 이름 그대로, 새로 만든 것은 type 필드로 구분 */
  const docType = (d) => d.type || d.id;
  function docList(type) {
    const l = S.docs.filter((d) => d.kind !== 'progress' && docType(d) === type)
      .sort((a, b) => (a.id === type ? -1 : b.id === type ? 1 : (a.created || 0) - (b.created || 0)));
    return l.length ? l : [{ id: type, type, name: DOCS.find((x) => x[0] === type)[1], virtual: true }];
  }
  const docName = (d) => d.name || DOCS.find((x) => x[0] === docType(d))[1];
  function docSelId(type) { const l = docList(type); return (l.find((d) => d.id === (PF.docSel || {})[type]) || l[0]).id; }
  const docHas = (d) => !!d && !d.virtual && (d.kind === 'image' ? !!d.img : !!(d.text || '').trim());
  const progId = (tid) => (tid === 'mytable' ? 'progress' : 'progress_' + tid);
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
      return el('div', { class: 'dtw' }, el('div', { class: 'mbox' }, el('table', { class: 'dt2' },
        el('thead', {}, el('tr', {}, Array.from({ length: w }, (_, i) => cell('th', rows[0][i] || '')))),
        el('tbody', {}, rows.slice(1).map((r) => el('tr', {}, Array.from({ length: w }, (_, i) => cell('td', r[i] || ''))))))));
    }
    return el('div', { class: 'dtxt' }, text.split('\n').map((l) => el('div', {}, linkify(l) , l ? null : el('br'))));
  }
  /* ---------- 진도 확인: 내 시간표의 과목 × 평일 표. 셀을 눌러 한 줄 입력 + 배경 기호 ---------- */
  const PSYM = [['', '없음', 'sy_none'], ['circle', '동그라미', 'sy_circle'], ['tri', '세모', 'sy_tri'], ['x', '엑스', 'sy_x'], ['check', '체크', 'sy_check'], ['star', '별', 'sy_star'], ['flower', '꽃', 'sy_flower'], ['flag', '깃발', 'sy_flag']];
  function progSubjects(tid) { // 고른 시간표(표 형태 글)에서 과목과 요일을 읽어요
    const d = docOf(tid || 'mytable');
    const out = new Map();
    if (!d || d.kind !== 'text' || !(d.text || '').includes('\t')) return out;
    const rows = parseTsv(d.text).filter((r) => r.some((c) => c.trim()));
    if (!rows.length) return out;
    const colDay = {};
    rows[0].forEach((c, i) => { const m = /^\s*([월화수목금])/.exec(c); if (m) colDay[i] = '월화수목금'.indexOf(m[1]) + 1; });
    let body = rows;
    if (Object.keys(colDay).length) body = rows.slice(1); else [1, 2, 3, 4, 5].forEach((i) => { colDay[i] = i; });
    body.forEach((r, ri) => {
      const pno = parseInt(String(r[0] || '').replace(/\D/g, ''), 10) || ri + 1; // 첫 칸의 교시 번호 (없으면 위에서부터 몇 번째 줄인지)
      Object.entries(colDay).forEach(([i, w]) => {
        const t = (r[i] || '').replace(/\s+/g, ' ').trim();
        if (!t || /^[-–—.]+$/.test(t)) return;
        if (!out.has(t)) out.set(t, new Map());
        const m = out.get(t); if (!m.has(w)) m.set(w, []);
        if (!m.get(w).includes(pno)) m.get(w).push(pno);
      });
    });
    return out;
  }
  function openProgress() {
    const m = $('#modal');
    m.hidden = false;
    const t0 = new Date();
    const mon0 = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - ((t0.getDay() + 6) % 7));
    const ttList = docList('mytable');
    let tid = (ttList.find((d) => d.id === PF.progTt) || ttList[0]).id;
    const loadProg = () => { const p = docOf(progId(tid)); return p ? JSON.parse(JSON.stringify(p)) : { id: progId(tid), kind: 'progress', ord: [], cells: {}, start: '', end: '' }; };
    let prog = loadProg();
    let timer = null;
    const flush = () => { if (timer) { clearTimeout(timer); timer = null; } prog.updated = Date.now(); Data.put('docs', JSON.parse(JSON.stringify(prog))); };
    const save = () => { if (timer) clearTimeout(timer); timer = setTimeout(flush, 350); };
    const close = () => { if (timer) flush(); m.hidden = true; m.replaceChildren(); render(); };
    let sel = null;   // { name, ds } 셀 선택
    let bulk = null;  // ds 날짜 선택(한꺼번에 입력)
    let subj = progSubjects(tid);
    const names = () => { // 저장된 순서 먼저, 새 과목은 뒤에
      const all = [...subj.keys()];
      return [...prog.ord.filter((n) => subj.has(n)), ...all.filter((n) => !prog.ord.includes(n))];
    };
    const range = () => {
      let a = prog.start ? parseYmd(prog.start) : mon0;
      let b = prog.end ? parseYmd(prog.end) : new Date(mon0.getFullYear(), mon0.getMonth(), mon0.getDate() + 4);
      if (b < a) [a, b] = [b, a];
      const days = [];
      for (let d = new Date(a), i = 0; d <= b && i < 200; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), i++) if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d));
      return days;
    };
    const dl = (d) => `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`;
    const cellOf = (n, ds) => prog.cells[n + '|' + ds] || {};
    const setCell = (n, ds, patch) => {
      const k = n + '|' + ds;
      const v = { ...(prog.cells[k] || {}), ...patch };
      if (!v.t && !v.s) delete prog.cells[k]; else prog.cells[k] = v;
    };
    const tds = new Map(); // 'name|ds' → td (입력하는 대로 바로 표에 보이게)
    const paint = (n, ds) => {
      const td = tds.get(n + '|' + ds); if (!td) return;
      const c = cellOf(n, ds);
      const ps = (subj.get(n) && subj.get(n).get(parseYmd(ds).getDay())) || [];
      td.replaceChildren(...(c.s ? [el('span', { class: 'pbg ps-' + c.s }, icon((PSYM.find((x) => x[0] === c.s) || [])[2] || 'sy_none'))] : []),
        ...(ps.length ? [el('span', { class: 'ppd' }, ps.slice().sort((a, b) => a - b).join('·') + '교시')] : []),
        el('span', { class: 'ptx' }, c.t || ''));
      td.title = c.t || '';
    };
    const dlg = el('div', { class: 'dlg progdlg' });
    const head = el('div', { class: 'shead' }, hb('progress', '진도 확인'), el('span', { class: 'grow' }), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close')));
    const sel0 = el('select', { 'aria-label': '시간표', onchange: () => {
      if (timer) flush();
      tid = sel0.value; PF.progTt = tid; savePf();
      prog = loadProg(); subj = progSubjects(tid); sel = null; bulk = null;
      const dd = range(); sIn.value = ymd(dd[0] || mon0); eIn.value = ymd(dd[dd.length - 1] || mon0);
      drawAll();
    } }, ttList.map((d) => el('option', { value: d.id, selected: d.id === tid }, docName(d))));
    const clearBtn = el('button', { class: 'ghost sm danger', type: 'button', onclick: async () => {
      { const cd = ttList.find((d) => d.id === tid); if (!(await ask(`${cd ? docName(cd) : '내 시간표'}의 진도 확인 내용을 모두 삭제할까요?`))) return; }
      prog.cells = {}; sel = null; bulk = null; flush(); drawAll();
    } }, icon('trash'), '내용 모두 삭제');
    const days0 = range();
    const sIn = el('input', { type: 'date', value: ymd(days0[0] || mon0), 'aria-label': '시작일', onchange: () => { prog.start = sIn.value; flush(); drawAll(); } });
    const eIn = el('input', { type: 'date', value: ymd(days0[days0.length - 1] || mon0), 'aria-label': '종료일', onchange: () => { prog.end = eIn.value; flush(); drawAll(); } });
    const bar = el('div', { class: 'mk mopts progbar' }, sel0, el('span', { class: 'grow' }), sIn, el('span', { class: 'mut' }, '~'), eIn, clearBtn);
    const wrap = el('div', { class: 'progwrap' });
    const edit = el('div', { class: 'progedit' });
    dlg.append(head, bar, wrap, edit);
    dlg.addEventListener('click', (e) => { // 누를 수 있는 칸·입력 영역 말고 다른 곳을 누르면 선택 해제
      if (!sel && !bulk) return;
      if (e.target.closest('td.pcl, th.pd.go, .progedit, button, input, select, label')) return;
      sel = null; bulk = null; wrap.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); drawEdit();
    });

    const symRow = (cur, pick) => el('div', { class: 'blpick psyms' }, PSYM.map(([k, name, ic]) => el('button', { type: 'button', class: 'blb' + (k ? ' ps-' + k : '') + ((cur || '') === k ? ' on' : ''), 'aria-label': name, title: name, onclick: () => pick(k) }, icon(ic))));
    function drawEdit() {
      edit.replaceChildren();
      if (sel) {
        const { name, ds } = sel;
        const inp = el('input', { type: 'text', value: cellOf(name, ds).t || '', 'aria-label': `${dl(parseYmd(ds))} ${name} 진도`, spellcheck: 'false' });
        inp.addEventListener('input', () => { setCell(name, ds, { t: inp.value }); paint(name, ds); save(); });
        const syms = el('div', {});
        const drawSym = () => syms.replaceChildren(symRow(cellOf(name, ds).s, (k) => { setCell(name, ds, { s: k }); paint(name, ds); save(); drawSym(); }));
        drawSym();
        edit.append(el('div', { class: 'pedh mut' }, `${dl(parseYmd(ds))} · ${name}`), el('div', { class: 'pedr' }, fld(inp), syms));
        setTimeout(() => inp.focus(), 0);
      } else if (bulk) {
        const ds = bulk;
        const snap = names().map((n) => ({ n, t: cellOf(n, ds).t || '' })); // 비우면 원래 내용으로 돌아가게
        const inp = el('input', { type: 'text', 'aria-label': `${dl(parseYmd(ds))} 한꺼번에 입력`, spellcheck: 'false' });
        const syms = el('div', {});
        let sy = null;
        const drawSym = () => syms.replaceChildren(symRow(sy, (k) => { sy = k; snap.forEach(({ n }) => { setCell(n, ds, { s: k }); paint(n, ds); }); save(); drawSym(); }));
        drawSym();
        inp.addEventListener('input', () => { snap.forEach(({ n, t }) => { setCell(n, ds, { t: inp.value.trim() ? inp.value : t }); paint(n, ds); }); save(); });
        edit.append(el('div', { class: 'pedh mut' }, `${dl(parseYmd(ds))} · 한꺼번에 입력`), el('div', { class: 'pedr' }, fld(inp), syms));
        setTimeout(() => inp.focus(), 0);
      }
    }
    function drawAll() {
      tds.clear();
      const list = names(), days = range();
      const none = !list.length; // 쓸 수 있는 시간표가 없으면 표 대신 안내 문구, 날짜·삭제는 비활성화
      dlg.classList.toggle('nosub', none);
      [clearBtn, sIn, eIn].forEach((x) => { x.disabled = none; });
      const weekRow = () => { // 월~금을 묶어서 N주차 (시작 날짜가 있는 주가 1주차)
        const th = []; let k = 0;
        days.forEach((d, i) => {
          const mon = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
          const prev = i ? days[i - 1] : null, pm = prev ? ymd(new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - ((prev.getDay() + 6) % 7))) : null;
          if (mon !== pm) { k++; th.push(el('th', { class: 'pw', colspan: 1 }, `${k}주차`)); } else th[th.length - 1].colSpan++;
        });
        return el('tr', { class: 'pwr' }, el('th', { class: 'pn', rowSpan: 2 }, '과목'), th);
      };
      const dateRow = (go) => el('tr', { class: 'pdr' }, days.map((d) => el('th', go ? { class: 'pd go' + (bulk === ymd(d) ? ' sel' : ''), onclick: () => { bulk = bulk === ymd(d) ? null : ymd(d); sel = null; drawAll(); } } : { class: 'pd' }, dl(d))));
      if (none) {
        wrap.replaceChildren(el('div', { class: 'empty mut' }, '먼저 내 시간표를 표로 만들어 주세요.'));
        sel = null; bulk = null; drawEdit(); return;
      }
      const body = list.map((n, i) => {
        const mv = (dir) => { const o = list.slice(); const j = i + dir; [o[i], o[j]] = [o[j], o[i]]; prog.ord = o; flush(); drawAll(); };
        const tr = el('tr', {}, el('td', { class: 'pn' }, el('div', { class: 'pnr' },
          el('span', { class: 'pmv' },
            el('button', { type: 'button', class: 'ib', disabled: i === 0, 'aria-label': '위로', onclick: () => mv(-1) }, icon('up')),
            el('button', { type: 'button', class: 'ib', disabled: i === list.length - 1, 'aria-label': '아래로', onclick: () => mv(1) }, icon('down'))),
          el('span', { class: 'pnm' }, n))));
        days.forEach((d) => {
          const ds = ymd(d);
          const td = el('td', { class: 'pcl go' + (subj.get(n).has(d.getDay()) ? ' on' : '') + (sel && sel.name === n && sel.ds === ds ? ' sel' : ''),
            onclick: () => { sel = { name: n, ds }; bulk = null; wrap.querySelectorAll('td.pcl.sel').forEach((x) => x.classList.remove('sel')); td.classList.add('sel'); wrap.querySelectorAll('th.pd.sel').forEach((x) => x.classList.remove('sel')); drawEdit(); } });
          tds.set(n + '|' + ds, td); paint(n, ds);
          tr.append(td);
        });
        return tr;
      });
      const tbl = el('table', { class: 'mt pt', style: `width:${148 + 112 * days.length}px;min-width:100%` }, el('thead', {}, weekRow(), dateRow(true)), el('tbody', {}, body));
      wrap.replaceChildren(el('div', { class: 'pmw' }, tbl));
      drawEdit();
    }
    m.replaceChildren(el('div', { class: 'back', onclick: close }), dlg);
    drawAll();
  }
  let sheetJs = null;
  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!sheetJs) sheetJs = new Promise((res, rej) => {
      document.head.append(el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
        onload: () => res(window.XLSX), onerror: () => { sheetJs = null; rej(new Error('엑셀 변환 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 내용을 복사해 붙여넣어주세요.')); } }));
    });
    return sheetJs;
  }
  async function fileToDraft(f) {
    const buf = await f.arrayBuffer();
    if (/^image\//.test(f.type)) return { kind: 'image', img: await compressImage(f) };
    if (/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
      const X = await loadSheetJS();
      const wb = X.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      const clean = rows.map((r) => r.map((c) => String(c).replace(/[\t\r\n]+/g, ' ').trim()));
      while (clean.length && clean[clean.length - 1].every((c) => !c)) clean.pop();
      let w = 0; clean.forEach((r) => { for (let i = r.length - 1; i >= 0; i--) if (r[i]) { w = Math.max(w, i + 1); break; } });
      const t = clean.map((r) => r.slice(0, w).join('\t')).join('\n');
      return { kind: 'text', text: t };
    }
    throw new Error('엑셀(.xlsx/.xls/.xlsm)이나 이미지 파일만 업로드할 수 있어요.');
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
        if (out.length >= 900000) rej(new Error('이미지가 너무 커요. 더 작은 이미지를 업로드해 주세요.')); else res(out);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 열지 못했어요.')); };
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
  /* 업로드 가능 형식 안내 (작은 말풍선) */
  function fmtPop(btn) {
    document.querySelector('.fmtpop')?.remove();
    const pop = el('div', { class: 'fmtpop' },
      el('div', {}, el('span', {}, icon('excel'), '엑셀 업로드'), el('small', {}, '첫 번째 시트를 불러와요.')),
      el('div', {}, el('span', {}, icon('image'), '이미지 업로드'), el('small', {}, '이미지를 그대로 보여 줘요.')));
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8) + 'px';
    const off = (e) => { if (pop.contains(e.target)) return; pop.remove(); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); pop.remove(); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', esc, true); } };
    setTimeout(() => { document.addEventListener('mousedown', off, true); document.addEventListener('keydown', esc, true); }, 0);
  }
  function openDoc(type, forceEdit) {
    const meta = DOCS.find((x) => x[0] === type);
    const m = $('#modal');
    m.hidden = false;
    const close = () => { if (saveT) persist(); m.hidden = true; m.replaceChildren(); render(); };
    let id, cur, draft, edit;
    const load = (nid, fe) => { id = nid; const d = docOf(id); cur = docHas(d) ? d : null; draft = cur ? { kind: cur.kind, text: cur.text || '', img: cur.img || '' } : { kind: 'text', text: '' }; edit = !!fe || !cur; };
    load(docSelId(type), forceEdit);
    /* 수정 중에는 저장 버튼 없이, 입력이 잠깐 멈추면 저장해요 (닫거나 '완료'를 눌러도 저장) */
    let saveT = null;
    const persist = () => {
      if (saveT) { clearTimeout(saveT); saveT = null; }
      if (draft.kind === 'text' && draft.text.length > 300000) draft.text = draft.text.slice(0, 300000); // 너무 길면 뒤쪽을 잘라요
      if (draft.kind === 'text' && !draft.text.trim()) {
        if (cur) { const e = docOf(id); if (e && e.name) Data.put('docs', { id, type, name: e.name, created: e.created || 0, kind: 'text', text: '', updated: Date.now() }); else Data.del('docs', id); cur = null; render(); }
        return;
      }
      const e0 = docOf(id) || {};
      const base = { id, type, ...(e0.name ? { name: e0.name } : {}), created: e0.created || 0 };
      const o = draft.kind === 'image' ? { ...base, kind: 'image', img: draft.img, updated: Date.now() } : { ...base, kind: 'text', text: draft.text, updated: Date.now() };
      Data.put('docs', o); cur = docOf(id) || o;
    };
    const sched = () => { if (saveT) clearTimeout(saveT); saveT = setTimeout(persist, 500); };
    /* 위쪽: 항목 고르기(왼쪽) · 설정(옆) — 급식의 학교 드롭박스와 같은 자리 */
    const entRow = (...extra) => el('div', { class: 'mk mopts docent' },
      el('select', { 'aria-label': meta[1], onchange: (e) => { if (saveT) persist(); PF.docSel[type] = e.target.value; savePf(); load(e.target.value); (edit ? drawEdit : drawView)(); } },
        docList(type).map((d) => el('option', { value: d.id, selected: d.id === id }, docName(d)))),
      el('button', { class: 'ghost sm', type: 'button', onclick: () => { if (saveT) persist(); openDocSet(type, () => { load(docSelId(type)); (edit ? drawEdit : drawView)(); }); } }, icon('listedit'), '편집'),
      el('span', { class: 'grow' }), ...extra);
    const head = (...extra) => el('div', { class: 'shead' }, hb(meta[2], meta[1]), el('span', { class: 'grow' }), ...extra, el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close')));
    /* 보기: 내용이 있으면 아래 버튼 없이, 위쪽(파일 업로드가 있던 자리)에 수정만 (삭제는 '편집'에서) */
    let drawView = function () {
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg docdlg' + (cur.kind === 'image' ? ' imgdlg' : '') }, head(), entRow(
          el('button', { class: 'ghost sm', type: 'button', onclick: () => { edit = true; draft = { kind: cur.kind, text: cur.text || '', img: cur.img || '' }; drawEdit(); } }, icon('edit'), '수정')),
          el('div', { class: 'dbody' }, docView(cur))));
    };
    let drawEdit = function () {
      const pick = (accept, run) => { // 파일 고르기 → run(파일)
        const inp = el('input', { type: 'file', accept, hidden: true, onchange: async () => { const f = inp.files[0]; inp.remove(); if (f) await run(f); } });
        document.body.append(inp); inp.click();
      };
      const upload = (accept) => pick(accept, async (f) => { try { draft = await fileToDraft(f); persist(); drawEdit(); } catch (er) { /* 못 읽으면 그대로 */ } });
      const ta = el('textarea', { class: 'dta', spellcheck: 'false', placeholder: '엑셀이나 한글의 표를 복사해 붙여 넣어 주세요.' });
      ta.value = draft.text || '';
      ta.addEventListener('input', () => { draft.text = ta.value; sched(); });
      ta.addEventListener('keydown', (e) => { // Tab 키는 칸을 나누는 탭 문자로 (Shift+Tab은 그대로 다음 칸으로 이동)
        if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault(); ta.setRangeText('\t', ta.selectionStart, ta.selectionEnd, 'end'); draft.text = ta.value; sched();
      });
      ta.addEventListener('paste', (e) => {
        const cd = e.clipboardData; if (!cd) return;
        const html = cd.getData('text/html');
        if (!html || !/<table/i.test(html)) return; // 표가 아니면 그대로 붙여넣기
        const t = htmlTableToTsv(html); if (!t.trim()) return;
        e.preventDefault();
        ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end');
        draft.text = ta.value; sched();
      });
      const body = draft.kind === 'image'
        ? el('div', { class: 'dbody' }, el('div', { class: 'dimg' }, el('div', { class: 'dimgw' }, el('img', { src: draft.img, alt: '' }),
          el('button', { class: 'dimgdel', type: 'button', 'aria-label': '이미지 삭제', onclick: () => { draft = { kind: 'text', text: '' }; persist(); drawEdit(); } }, el('span', { class: 'dimgi' }, el('span', { class: 'ol' }, icon('trash')), icon('trash')), '삭제'))))
        : ta;
      m.replaceChildren(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg docdlg' + (draft.kind === 'image' ? ' imgdlg' : '') }, head(), entRow(
          el('button', { class: 'ghost sm', type: 'button', onclick: () => upload('.xlsx,.xls,.xlsm') }, icon('excel'), '엑셀 업로드'),
          el('button', { class: 'ghost sm', type: 'button', onclick: () => upload('image/*') }, icon('image'), '이미지 업로드'),
          el('button', { class: 'ib sm', type: 'button', 'aria-label': '설명', onclick: (e) => { e.stopPropagation(); fmtPop(e.currentTarget); } }, icon('info')),
          el('button', { class: 'ghost sm', type: 'button', onclick: () => { persist(); if (docHas(cur)) { edit = false; drawView(); } else close(); } }, icon('check'), '완료')),
          body));
      if (draft.kind === 'text' && draft.text) ta.focus();
    };
    function fitImg() { // 사진 크기에 맞춰 팝업 폭을 줄이고, 화면(세로)에 들어가도록 줄여요
      const d = m.querySelector('.imgdlg'), img = d && d.querySelector('img');
      if (!img) return;
      const run = () => {
        const nw = img.naturalWidth, nh = img.naturalHeight; if (!nw) return;
        const hasSrc = 44;
        const availW = window.innerWidth * 0.94 - 28, availH = window.innerHeight * 0.9 - 150 - hasSrc;
        const k = Math.min(1, availW / nw, availH / nh);
        const w = Math.round(nw * k);
        const first0 = !d.dataset.fitted; if (first0) img.style.transition = 'none'; // 처음 맞출 땐 움직임 없이 바로
        img.style.width = w + 'px'; img.style.height = 'auto'; if (first0) { void img.offsetWidth; img.style.transition = ''; }
        /* 사진 폭에 맞추되, 윗줄(드롭박스·버튼)이 한 줄에 들어갈 만큼보다는 좁아지지 않게 — 줄어들고 늘어날 땐 부드럽게 */
        const bar = d.querySelector('.docent');
        let need = 0;
        if (bar) { const it = [...bar.children].filter((k) => !k.classList.contains('grow')); need = it.reduce((a, k) => a + k.offsetWidth, 0) + 8 * it.length + 28 + 2; }
        const tw = Math.min(Math.max(need, w + 28), window.innerWidth * 0.94) + 'px';
        if (!d.dataset.fitted) { d.style.transition = 'none'; d.style.width = tw; void d.offsetWidth; d.style.transition = ''; d.dataset.fitted = '1'; } else d.style.width = tw;
      };
      /* 사진을 아직 못 읽었으면 크기를 맞출 때까지 팝업을 감춰 뒀다가, 맞춘 크기로 한 번에 나타나요 (큰 팝업 → 줄어듦 → 늘어남이 눈에 보이지 않게) */
      const reveal = () => {
        if (!d.dataset.hid) return;
        delete d.dataset.hid; d.dataset.nofx = String(performance.now()); d.style.visibility = '';
        if (!noAnim()) d.animate([{ opacity: 0, transform: 'translateY(6px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
      };
      if (img.complete && img.naturalWidth) run();
      else {
        if (!d.dataset.fitted && !d.dataset.hid) { d.dataset.hid = '1'; d.style.visibility = 'hidden'; }
        img.addEventListener('load', () => { run(); reveal(); }, { once: true });
        img.addEventListener('error', reveal, { once: true });
      }
    }
    const _de = drawEdit, _dv = drawView;
    /* 항목을 바꿀 땐 팝업을 닫았다 다시 열지 않고, 같은 창에서 내용만 바꿔요 (높이는 모든 팝업 공통의 부드러운 늘고 줄기가 맡아요) */
    const morph = (redraw) => {
      const old = m.querySelector('.docdlg');
      if (!old || !m.querySelector('.back')) { redraw(); return; }
      let cap = null;
      m.replaceChildren = (...n) => { cap = n; }; // 새 창을 DOM에 넣지 않고 내용만 받아와서, 기존 창에 옮겨 담아요 (창을 다시 넣으면 열리는 애니메이션이 처음부터 다시 돌아요)
      try { redraw(); } finally { delete m.replaceChildren; }
      const nu = cap && cap[1]; if (!nu) { redraw(); return; }
      old.replaceChildren(...nu.childNodes);
      old.className = nu.className; if (!old.classList.contains('imgdlg')) old.style.width = '';
      const ta = old.querySelector('textarea.dta'); if (ta && ta.value) ta.focus();
    };
    drawEdit = function () { morph(_de); fitImg(); }; drawView = function () { morph(_dv); fitImg(); };
    if (edit) drawEdit(); else drawView();
  }

  /* 항목 편집: 이름 바꾸기 · 삭제 · 추가 (급식의 '학교 편집'과 같은 방식) */
  function openDocSet(type, done) {
    const meta = DOCS.find((x) => x[0] === type);
    const layer = el('div', { class: 'askw' });
    let changed = false;
    const close = () => { layer.remove(); if (changed && done) done(); };
    const list = el('div', { class: 'schlist' });
    const drawList = () => {
      list.replaceChildren(...docList(type).map((d) => {
        const inp = el('input', { type: 'text', value: docName(d), maxlength: 30, 'aria-label': '이름', spellcheck: 'false' });
        inp.addEventListener('change', () => {
          const nm = inp.value.trim() || meta[1];
          inp.value = nm;
          const c = docOf(d.id) || { id: d.id, type, kind: 'text', text: '', created: 0 };
          Data.put('docs', { ...c, type, name: nm, updated: c.updated || Date.now() }); changed = true;
        });
        return el('div', { class: 'schcur' }, el('span', { class: 'schnm' }, fld(inp)),
          el('button', { class: 'ghost sm danger', type: 'button', disabled: !!d.virtual, onclick: async () => {
            if (!(await ask(`${docName(d)}${eul(docName(d))} 삭제할까요?`))) return;
            Data.del('docs', d.id);
            if (type === 'mytable') Data.del('docs', progId(d.id));
            if (PF.docSel[type] === d.id) delete PF.docSel[type];
            savePf(); changed = true; drawList();
          } }, icon('trash'), '삭제'));
      }));
    };
    const add = () => {
      const l = docList(type), now2 = Date.now();
      if (l[0].virtual) Data.put('docs', { id: type, type, name: meta[1], kind: 'text', text: '', created: 0, updated: now2 });
      const nid = `${type}_${now2.toString(36)}`;
      Data.put('docs', { id: nid, type, name: `${meta[1]} ${l.length + 1}`, kind: 'text', text: '', created: now2, updated: now2 });
      PF.docSel[type] = nid; savePf(); changed = true; drawList();
      const ins = list.querySelectorAll('input'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); }
    };
    layer.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' },
        el('div', { class: 'shead' }, hb('listedit', '편집'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'abar' }, el('button', { class: 'ghost sm', type: 'button', onclick: add }, icon('plus'), '추가')),
        list));
    drawList();
    document.body.append(layer);
  }

  /* ---------- 화면 설정 ---------- */
  function openPrefs() {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const W = window.hagisiroWidget;
    const TABS = [['view', '앱'], ['look', '캘린더'], ['cal', '표시 항목'], ['td', '할 일'], ['sc', '바로가기']];
    if (!TABS.some((t) => t[0] === S.pfTab)) S.pfTab = 'view';
    const seg = (key, opts, after) => el('div', { class: 'seg' }, opts.map(([v, label]) =>
      el('button', { type: 'button', class: PF[key] === v ? 'on' : '', onclick: () => { PF[key] = v; commit(after); } }, label)));
    const sel = (key, vals, fmt, after) => el('select', { onchange: (e) => { PF[key] = +e.target.value; commit(after); } },
      vals.map((v) => el('option', { value: v, selected: PF[key] === v }, fmt(v))));
    const tog = (key, label, hint, after, off, lock, excl) => el('label', { class: 'pfr tg' + (off || lock ? ' off' : '') },
      el('input', { type: 'checkbox', checked: !!PF[key] && !off, disabled: !!(off || lock), onchange: (e) => { PF[key] = e.target.checked; if (excl && e.target.checked) PF[excl] = false; commit(after); } }),
      el('span', {}, label, hint ? el('small', {}, hint) : null));
    const row = (label, ...c) => el('div', { class: 'pfr' }, el('span', { class: 'pl' }, label), el('div', { class: 'pc2' }, c));
    const dim = (node, on) => { if (on) { node.classList.add('off'); node.querySelectorAll('select,button,input').forEach((x) => { x.disabled = true; }); } return node; };
    function commit(after) {
      savePf();
      if (after === 'range') watchRange();
      if (after === 'meal') loadMeal();
      if (after === 'ghol') {
        loadGhol();
      }
      render(); draw();
    }
    const pages = {
      cal: () => [
          el('div', { class: 'pfs' }, '날짜에 함께 표시'),
          tog('hol', '공휴일', '', 'ghol'),
          tog('lunar', '음력 날짜'),
          tog('terms', '24절기'),
          S.cloud ? el('label', { class: 'pfr tg' },
            el('input', { type: 'checkbox', checked: gcalWanted(), onchange: (e) => {
              const cb = e.target;
              if (cb.checked) connectGcal().finally(() => { cb.checked = gcalWanted(); });
              else { ls.set('hagisiro:gcal', '0'); S.gcal = {}; render(); }
            } }), el('span', {}, 'Google 캘린더 일정')) : null,
          el('div', { class: 'pfs' }, '미니 버튼'),
          tog('ab', '출결', '', 'render'),
          tog('cons', '상담', '', 'render', !S.cloud),
          tog('meal', '급식', '', 'render'),
        ],
      view: () => [
        el('div', { class: 'pfs' }, '모양'),
        row('테마', seg('theme', [['auto', '자동'], ['light', '라이트'], ['dark', '다크']])),
        tog('anim', '애니메이션 효과'),
        ...(W ? [el('div', { class: 'pfs' }, '창'),
        S.zmode ? row('창 순서', el('div', { class: 'seg' }, [['normal', '일반'], ['top', '맨 앞'], ['bottom', '맨 뒤']].map(([v, l]) =>
          el('button', { type: 'button', class: S.zmode === v ? 'on' : '', onclick: async () => { S.zmode = await W.setZ(v); draw(); } }, l)))) : null,
        row('투명도', el('input', {
          type: 'range', min: 30, max: 100, step: 5, value: PF.opacity, 'aria-label': '투명도',
          oninput: (e) => { PF.opacity = +e.target.value; savePf(); const o = m.querySelector('.opv'); if (o) o.textContent = PF.opacity + '%'; },
        }), el('b', { class: 'opv' }, PF.opacity + '%')),
        ...(S.autoStart == null ? [] : [el('div', { class: 'pfs' }, '시작'), el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox', checked: !!S.autoStart, onchange: async (e) => { S.autoStart = await W.setAutoStart(e.target.checked); draw(); } }), el('span', {}, 'Windows 시작 시 실행'))]),
] : []),
      ],
      sc: () => [
        el('div', { class: 'pfs' }, '상단 줄에 표시'),
        ((defs) => el('div', { class: 'scgrid', style: `grid-template-rows: repeat(${Math.ceil(defs.length / 2)}, auto); grid-auto-flow: column` }, defs.map((x) => // 세로로 먼저 채워요
          el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox', checked: scOn(x), onchange: (e) => {
            const key = x.def ? 'hide' : 'show', h = new Set(PF[key] || []);
            if (e.target.checked === !!x.def) h.delete(x.k); else h.add(x.k);
            PF[key] = [...h]; commit('render');
          } }), el('span', {}, x.label)))))(shortcutDefs()),
      ],
      look: () => {
        const mon = PF.cal === 'month'; // 월별에선 이번 주 보기용 설정을 잠가요
        return [
          el('div', { class: 'pfs' }, '캘린더 보기'),
          row('보기 방식', seg('cal', [['month', '월별'], ['week', '이번 주']], 'range')),
          dim(row('전체 주 수', sel('weeks', [1, 2, 3, 4, 5, 6], (n) => n + '주', 'range')), mon),
          dim(row('지나간 주 수', sel('past', Array.from({ length: Math.min(5, PF.weeks - 1) + 1 }, (_, i) => i), (n) => n + '주', 'range')), mon),
          tog('mgap', '월 사이 구분', '', 'render', false, mon),
          el('div', { class: 'pfs' }, 'D-day'),
          tog('ddtop', 'D-day 줄을 요일 위에 표시', '', 'render'),
          tog('pastdd', '지나간 D-day 표시', '', 'render'),
        ];
      },
      td: () => {
        const dots = (key, list) => el('div', { class: 'pc2 pdots' }, list.map(([val, name]) => el('button', { type: 'button', class: 'swb' + (key === 'tbg' ? ' sq' : '') + (val ? '' : ' none') + ((PF[key] || '') === val ? ' on' : ''), 'aria-label': name, style: val ? `background:${val}` : null,
          onclick: () => { PF[key] = val; commit('render'); } })));
        return [
          el('div', { class: 'pfs' }, '기본 모양'),
          row('글자 크기', el('div', { class: 'seg szseg' }, SIZES.map(([v, l]) => el('button', { type: 'button', class: (PF.tsz || 's') === v ? 'on' : '', onclick: () => { PF.tsz = v === 's' ? '' : v; commit('render'); } }, l)))),
          row('줄 간격', el('div', { class: 'seg szseg' }, [[0, '아주 좁게'], [1, '좁게'], [2, '보통'], [3, '넓게'], [4, '아주 넓게']].map(([v, l]) => el('button', { type: 'button', class: PF.tlh === v ? 'on' : '', onclick: () => { PF.tlh = v; commit('render'); } }, l)))),
          row('기호', el('div', { class: 'pc2 blset' }, BUL.map(([k, name]) => el('button', { type: 'button', class: 'blb' + ((PF.tbl || 'dot') === k ? ' on' : ''), 'data-bl': k, 'aria-label': name,
            onclick: () => { PF.tbl = k === 'dot' ? '' : k; commit('render'); } }, bulIcon(k))))),
          row('글자색', dots('tfg', FG)),
          row('배경색', dots('tbg', BGC)),
          el('div', { class: 'pfs' }, '완료 시 동작'),
          tog('sortDone', '완료 시 맨 아래로 이동', '', 'render', false, false, 'autoDel'),
          tog('autoDel', '완료 시 자동 삭제', '', 'render', false, false, 'sortDone'),
        ];
      },
    };
    const tabBar = el('div', { class: 'pnav' });
    const body = el('div', { class: 'pbody' });
    // (아래 draw에서 탭 목록 맨 아래, 구분선 왼쪽에 붙여요)
    let shown = null;
    function draw() {
      const keep = shown === S.pfTab ? body.scrollTop : 0;
      tabBar.replaceChildren(...TABS.map(([k, l]) => el('button', { type: 'button', class: S.pfTab === k ? 'on' : '', onclick: () => { S.pfTab = k; draw(); } }, l)), resetBtn);
      body.replaceChildren(...pages[S.pfTab]().filter(Boolean));
      body.scrollTop = keep;
      if (shown != null && shown !== S.pfTab && !noAnim()) body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }); // 다른 대분류로 옮길 땐 부드럽게 나타나요
      shown = S.pfTab;
    }
    const resetBtn = el('button', { class: 'ghost sm preset', type: 'button', onclick: async () => {
          if (!(await ask('모든 설정을 기본으로 되돌릴까요?', '확인', false))) return;
          ['cal', 'weeks', 'past', 'mgap', 'lunar', 'terms', 'hol', 'ab', 'cons', 'meal', 'pastdd', 'ddtop', 'tsz', 'tfg', 'tbg', 'tlh', 'tbl', 'autoDel', 'sortDone', 'theme', 'anim', 'hide', 'show', 'opacity']
            .forEach((k) => { if (k in PF_DEF) PF[k] = JSON.parse(JSON.stringify(PF_DEF[k])); else delete PF[k]; });
          if (W && W.setZ) { try { S.zmode = await W.setZ('normal'); } catch (e) { /* 창 순서는 그대로 */ } }
          commit('range'); draw();
        } }, icon('uturn'), '기본으로 되돌리기');
    m.replaceChildren(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg pfdlg' },
        el('div', { class: 'shead' }, hb('gear', '설정'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'pmain' }, tabBar, body)));
    draw();
    if (W && W.getZ) W.getZ().then((v) => { S.zmode = v; if (!m.hidden) draw(); });
    if (W && W.getAutoStart) W.getAutoStart().then((v) => { S.autoStart = v; if (!m.hidden) draw(); });
  }

  /* ---------- 설정: 요일별 기본 교시 수 ---------- */
  function openSettings() {
    const cls = curClass(); if (!cls) return;
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const cur = cfgPeriods(cls.id);
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
      Data.put('classes', { ...cls, periods });
      close();
      if (!keep.checked) { // 이 학급의 날짜별 교시 수를 모두 지우고 요일별 기본값으로 통일
        try {
          const all = S.cloud ? await S.cloud.getAll('days') : S.days.slice();
          all.forEach((o) => { if (o.classId === cls.id) Data.del('days', o.id); else if (!o.classId) splitLegacy(o, cls.id); });
        } catch (e) { cloudErr(e); }
      }
      render();
    };
    m.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg perdlg' },
        el('div', { class: 'shead' }, hb('sliders', '교시 설정'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        grid,
        el('label', { class: 'keepbox' }, keep, el('span', {}, '개별 설정한 날은 제외하고 덮어쓰기')),
        el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'ghost', onclick: close }, '취소'), el('button', { class: 'pri', onclick: save }, '저장'))));
  }

  /* 이름이 비어 있으면 '이름 1', '이름 2' … 중 비어 있는 가장 작은 번호로 (결번도 채워요) */
  function autoName(base, names) {
    const used = new Set(names.map((n) => String(n || '').trim()));
    let n = 1; while (used.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  /* ---------- 명단 편집 ---------- */
  function openRoster(cid) {
    const c = cid && S.classes.find((x) => x.id === cid);
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const name = el('input', { type: 'text', value: c ? c.name : '', 'aria-label': '학급 이름' });
    const ta = el('textarea', { rows: '14', spellcheck: 'false', placeholder: '1 김네모\n2 이세모\n\n엑셀이나 한글의 표를 복사해 붙여 넣을 수 있어요.', 'aria-label': '명단' });
    ta.value = c ? c.students.slice().sort((a, b) => a.no - b.no).map((s) => `${s.no} ${s.name}`).join('\n') : '';

    function parseList() {
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
      return list;
    }
    let sv;
    function save() {
      const list = parseList();
      if (!list.length) { ta.focus(); return; }
      const old = c ? c.students : [];
      const used = new Set();
      list.forEach((s) => { const o = old.find((x) => !used.has(x.id) && x.name === s.name); if (o) { s.id = o.id; used.add(o.id); } });
      list.forEach((s) => { if (!s.id) { const o = old.find((x) => !used.has(x.id) && +x.no === s.no); if (o) { s.id = o.id; used.add(o.id); } } });
      list.forEach((s) => { if (!s.id) s.id = uid(); });
      const id = c ? c.id : uid();
      Data.put('classes', { id, name: name.value.trim() || autoName('학급', S.classes.filter((x) => !c || x.id !== c.id).map((x) => x.name)), students: list, ord: c ? c.ord : Date.now(), created: c ? c.created : Date.now(), ...(c && c.periods ? { periods: c.periods } : {}) });
      S.clsId = id; ls.set('hagisiro:cls', id);
      close(); render();
    }
    async function remove() {
      if (!(await ask('이 학급과 출결 기록을 삭제할까요?'))) return;
      S.att.filter((a) => a.classId === c.id).forEach((a) => Data.del('att', a.id));
      Data.del('classes', c.id); S.clsId = null; close(); render();
    }
    m.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg rosdlg' },
        el('div', { class: 'shead' }, hb(c ? 'users' : 'userplus', c ? '학급 수정' : '학급 추가'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'pfr' }, el('span', { class: 'pl' }, '학급 이름'), fld(name),
          c ? el('button', { class: 'ghost sm danger', type: 'button', onclick: remove }, icon('trash'), '삭제') : null),
        el('div', { class: 'pfr col' }, el('span', { class: 'pl' }, '학생 번호 · 이름'), fld(ta)),
        el('div', { class: 'dlgf' },
          el('span', { class: 'grow' }),
          el('button', { class: 'ghost', onclick: close }, '취소'),
          sv = el('button', { class: 'pri', onclick: save }, '저장'))));
    const chkSave = () => { sv.disabled = !parseList().length; };
    ta.addEventListener('input', chkSave); chkSave();
    (c ? ta : name).focus();
  }

  /* ================= Google 캘린더 (선택, 읽기 전용) ================= */
  const GK = 'hagisiro:gtok';
  function gtoken() {
    try { const o = JSON.parse(sessionStorage.getItem(GK) || 'null'); if (o && o.exp > Date.now()) return o.t; } catch (e) { /* noop */ }
    return null;
  }
  const gcalWanted = () => !!S.cloud && ls.get('hagisiro:gcal') === '1';
  async function connectGcal() {
    try {
      const t = await S.cloud.calendarToken();
      closeLoginWin();
      if (!t) return;
      try { sessionStorage.setItem(GK, JSON.stringify({ t, exp: Date.now() + 50 * 60e3 })); } catch (e) { /* noop */ }
      ls.set('hagisiro:gcal', '1');
      await loadGcal();
      render();
    } catch (e) { console.error(e); }
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

  /* Google '대한민국의 휴일' 공개 캘린더 (임시공휴일 등 반영) — 로그인·권한 없이 공개 키로 읽어요 */
  async function loadGhol() {
    if (!PF.hol) { if (Object.keys(S.ghol).length) { S.ghol = {}; render(); } return; }
    const key = window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey;
    const tok = gtoken();
    if (!key && !tok) return;
    const r = range();
    const end = parseYmd(r.to); end.setDate(end.getDate() + 1);
    const q = { timeMin: r.start.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', maxResults: '100' };
    if (key) q.key = key;
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com') + '/events?' + new URLSearchParams(q);
    try {
      let res = await fetch(url);
      if (!res.ok && tok) res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } }); // 키로 안 되면 로그인 권한으로 한 번 더
      if (!res.ok) {
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
    // 인증키가 없으면 한 번에 5건까지만 주므로, 쪽을 넘겨가며 모두 받아요
    const size = PF.neisKey ? 100 : 5;
    let all = [];
    for (let page = 1; page <= 40; page++) {
      const p = new URLSearchParams({ Type: 'json', pIndex: String(page), pSize: String(size), ...q });
      if (PF.neisKey) p.set('KEY', PF.neisKey);
      const res = await fetch(NEIS + api + '?' + p);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (j.RESULT) { if (j.RESULT.CODE === 'INFO-200') break; throw new Error(j.RESULT.MESSAGE || j.RESULT.CODE); }
      const blk = j[api], rows = blk && blk[1] ? blk[1].row : [];
      all = all.concat(rows);
      if (rows.length !== size) break;
    }
    return all;
  };
  const ymdN = (ds) => ds.replace(/-/g, '');
  /* 인증키 없이 부르면 NEIS가 쪽수와 상관없이 맨 앞 5건만 줘요(조식만 오는 증상).
   * 그래서 5건을 넘으면(총 건수로 알 수 있어요) 하루씩 나눠 받고, 받은 날은 기억해 둬요. */
  const neisOnce = async (api, q) => {
    const p = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '5', ...q });
    const res = await fetch(NEIS + api + '?' + p);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.RESULT) { if (j.RESULT.CODE === 'INFO-200') return { rows: [], total: 0 }; throw new Error(j.RESULT.MESSAGE || j.RESULT.CODE); }
    const blk = j[api] || [];
    const head = blk[0] && blk[0].head && blk[0].head[0];
    return { rows: blk[1] ? blk[1].row : [], total: head ? +head.list_total_count || 0 : 0 };
  };
  const mealDay = {};
  async function mealFetch(from, to) {
    const base = { ATPT_OFCDC_SC_CODE: PF.school.edu, SD_SCHUL_CODE: PF.school.code };
    if (PF.neisKey) return neis('mealServiceDietInfo', { ...base, MLSV_FROM_YMD: ymdN(from), MLSV_TO_YMD: ymdN(to) });
    const first = await neisOnce('mealServiceDietInfo', { ...base, MLSV_FROM_YMD: ymdN(from), MLSV_TO_YMD: ymdN(to) });
    if (first.total <= first.rows.length) return first.rows;
    const days = [];
    for (let d = parseYmd(from), z = parseYmd(to); d <= z && days.length < 60; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(ymd(d));
    const key = (ds) => PF.school.code + ds;
    const todo = days.filter((ds) => !mealDay[key(ds)]);
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const ds = todo[i++];
        try { mealDay[key(ds)] = (await neisOnce('mealServiceDietInfo', { ...base, MLSV_FROM_YMD: ymdN(ds), MLSV_TO_YMD: ymdN(ds) })).rows; } catch (e) { console.error(e); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return days.flatMap((ds) => mealDay[key(ds)] || []);
  }
  async function loadMeal() {
    if (!PF.school) { if (Object.keys(S.meal).length) { S.meal = {}; render(); } return; }
    const r = range();
    try {
      const rows = await mealFetch(r.from, r.to);
      const m = {};
      rows.forEach((x) => {
        const k = x.MLSV_YMD.replace(/^(\d{4})(\d\d)(\d\d)$/, '$1-$2-$3');
        (m[k] = m[k] || []).push({ kind: x.MMEAL_SC_NM, menu: String(x.DDISH_NM || '').split(/<br\s*\/?>/i).map((t) => t.trim()).filter(Boolean), cal: x.CAL_INFO || '' });
      });
      S.meal = m; render();
    } catch (e) {
      console.error(e);
    }
  }
  const allergyStrip = (t) => t.replace(/\s*\(?[\d.]+\)?\s*$/, '').replace(/\(\s*[\d.\s]+\)/g, '');
  const MEAL_KINDS = ['조식', '중식', '석식'];
  const mealRow = (x) => el('div', { class: 'meal' }, el('b', {}, x.kind, x.cal ? el('small', {}, ' ' + x.cal) : null), el('ul', {}, x.menu.map((t) => el('li', {}, allergyStrip(t)))));
  const mealShown = (list) => list.filter((x) => !MEAL_KINDS.includes(x.kind) || (PF.mk || MEAL_KINDS).includes(x.kind));
  /* 날짜 칸의 '상담 N': 그 날의 상담 신청만 모아서 (상담표가 여러 개면 상담표별로) */
  function openConsDay(ds) {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const e = (S.cbk && S.cbk[ds]) || { it: [] };
    m.replaceChildren(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg consday' },
        el('div', { class: 'shead' }, hb('chat', `${md(ds)} 상담`), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'cdlist' }, e.it.map(({ c, bs }) => el('div', { class: 'cdg' },
          el('button', { type: 'button', class: 'cdt', onclick: () => { close(); S.cs = { c }; setView('consult'); } }, c.title || '상담'),
          bs.slice().sort((x, y) => String(x.id).localeCompare(String(y.id))).map((b) => el('div', { class: 'cdr' },
            el('b', {}, `${String(b.id).slice(9, 11)}:${String(b.id).slice(11, 13)}`), el('span', {}, `${b.name}${b.info ? ' (' + b.info + ')' : ''}`))))))));
  }
  function openAttDay(ds) {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const groups = S.classes.map((c) => ({ c, rs: S.att.filter((a) => a.classId === c.id && a.date === ds) })).filter((g) => g.rs.length);
    const stOf = (c, a) => c.students.find((x) => x.id === a.studentId) || {};
    const noOf = (c, a) => stOf(c, a).no || 0;
    m.replaceChildren(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg consday' },
        el('div', { class: 'shead' }, hb('attend', `${md(ds)} 출결`), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'cdlist' }, groups.map(({ c, rs }) => el('div', { class: 'cdg' },
          el('button', { type: 'button', class: 'cdt', onclick: () => { close(); S.clsId = c.id; ls.set('hagisiro:cls', c.id); setSel(ds); S.sub = 'day'; ls.set('hagisiro:sub', 'day'); setView('att'); } }, c.name),
          rs.slice().sort((x, y) => noOf(c, x) - noOf(c, y)).map((a) => el('div', { class: 'cdr' },
            el('b', {}, `${stOf(c, a).no || ''} ${stOf(c, a).name || ''}`.trim()),
            el('span', {}, `${kindLabel(a)} ${recLabel(a)}${a.reason ? ' · ' + a.reason : ''}`))))))));
  }
  function openMeal(ds) {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const d = parseYmd(ds);
    const list = mealShown(S.meal[ds] || []);
    m.replaceChildren(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' + (list.length > 1 ? ' mealday' : list.length === 1 ? ' mealone' : '') },
        el('div', { class: 'shead' }, hb('utensils', `${md(ymd(d))} 급식`), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        list.length ? el('div', { class: 'meals' + (list.length > 1 ? ' hz' : '') }, list.map(mealRow)) : el('div', { class: 'mut' }, '급식 없음')));
  }
  /* 상단바 급식 버튼: 주별 급식 표 (행: 날짜·조식·중식·석식 / 열: 요일) + 지난주·다음주 이동 */
  const mealRows = (rows) => {
    const d = {};
    rows.forEach((x) => {
      const k = x.MLSV_YMD.replace(/^(\d{4})(\d\d)(\d\d)$/, '$1-$2-$3');
      (d[k] = d[k] || []).push({ kind: x.MMEAL_SC_NM, menu: String(x.DDISH_NM || '').split(/<br\s*\/?>/i).map((t) => t.trim()).filter(Boolean), cal: x.CAL_INFO || '' });
    });
    return d;
  };
  function openMealWeek() {
    const m = $('#modal');
    m.hidden = false;
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const t0 = new Date();
    let sun = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - t0.getDay());
    const cache = {};
    let nav = 0;
    const body = el('div', { class: 'mealwrap' });
    const ttl = el('b', { class: 'mttl' });
    let dlg;
    /* 세로 크기는 보이는 끼니(조식·중식·석식) 개수에 따라 바뀌고, 바뀔 때 부드럽게 움직여요 (표 내용·불러오는 중에는 변하지 않음) */
    const fit = (first) => {
      if (!dlg) return;
      const n = MEAL_KINDS.filter((k) => (PF.mk || MEAL_KINDS).includes(k)).length;
      const h = (190 + n * 155) + 'px';
      if (!first && dlg.style.height !== h) { // 크기가 변하는 동안은 세로 스크롤바를 숨겨서 표 폭이 흔들리지 않게
        dlg.classList.add('hgt'); clearTimeout(dlg._ht); dlg._ht = setTimeout(() => dlg.classList.remove('hgt'), 340);
      }
      dlg.style.height = h;
      if (first) { dlg.style.transition = 'none'; requestAnimationFrame(() => { dlg.style.transition = ''; }); }
    };
    const draw = () => {
      fit();
      if (dlg) dlg.classList.toggle('nosch', !PF.school); // 학교가 없으면 주 제목·표도 다른 비활성 요소처럼 흐리게
      const days = Array.from({ length: 7 }, (_, i) => new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i)).filter((d) => !(PF.mwe && (d.getDay() === 0 || d.getDay() === 6)));
      const e = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
      ttl.textContent = `${sun.getMonth() + 1}.${sun.getDate()}. ~ ${e.getMonth() + 1}.${e.getDate()}.`;
      body.replaceChildren();
      const data = PF.school ? cache[ymd(sun)] : {};
      if (!data) { body.append(loading()); return; }
      const kinds = MEAL_KINDS.filter((k) => (PF.mk || MEAL_KINDS).includes(k));
      const tbl = el('table', { class: 'mtbl' },
        el('thead', {}, el('tr', {}, el('th', { class: 'rk' }), days.map((d) => el('th', { class: (ymd(d) === ymd(t0) ? 'today ' : '') + (d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '') }, `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`)))),
        el('tbody', {}, kinds.map((k) => el('tr', {}, el('th', { class: 'rk' }, k), days.map((d) => {
          const it = data && (data[ymd(d)] || []).find((x) => x.kind === k);
          return el('td', { class: ymd(d) === ymd(t0) ? 'today' : '' }, it ? it.menu.map((t) => el('div', {}, allergyStrip(t))) : null);
        })))));
      body.append(tbl);
      /* 창이 좁아 글이 여러 줄로 접혀 표가 더 길어지면, 스크롤바가 생기지 않게 팝업 높이를 표에 맞춰요 */
      if (dlg && dlg.isConnected) {
        const need = Math.ceil(dlg.offsetHeight - body.clientHeight + tbl.offsetHeight + 2), cur = parseFloat(dlg.style.height) || 0;
        if (need > cur) dlg.style.height = need + 'px';
      }
    };
    const load = () => {
      const my = ++nav, key = ymd(sun);
      draw();
      if (!PF.school || cache[key]) return;
      const end = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
      mealFetch(key, ymd(end))
        .then((rows) => { cache[key] = mealRows(rows); }, () => { cache[key] = {}; })
        .then(() => { if (my === nav && document.body.contains(body)) draw(); });
    };
    const mv = (n) => { sun = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 7 * n); load(); };
    /* 학교 편집을 마치면 급식 팝업은 닫았다 다시 열지 않고, 같은 창에서 학교 목록·표만 새로 보여줘요 */
    const refreshSchools = () => {
      schSel.replaceChildren(...PF.schools.map((x) => el('option', { value: x.code, selected: PF.school && x.code === PF.school.code }, x.name)));
      dlg.querySelectorAll('.mopts select, .mopts input, .mnav button').forEach((e) => { e.disabled = !PF.school; });
      Object.keys(cache).forEach((k) => delete cache[k]); load();
    };
    /* 학교(왼쪽) · 조식/중식/석식/주말 제외 체크(오른쪽): 날짜 줄 위에 한 줄로 */
    const chk = (label, on, fn) => el('label', { class: 'rchk' }, el('input', { type: 'checkbox', checked: on, disabled: !PF.school, onchange: (e) => fn(e.target.checked) }), label);
    const schSel = el('select', { 'aria-label': '학교', disabled: !PF.school, onchange: (e) => {
      PF.school = PF.schools.find((x) => x.code === e.target.value) || PF.school; S.meal = {};
      Object.keys(cache).forEach((k) => delete cache[k]); savePf(); loadMeal(); load();
    } }, PF.schools.map((x) => el('option', { value: x.code, selected: PF.school && x.code === PF.school.code }, x.name)));
    const opts = el('div', { class: 'mk mopts' },
      schSel,
      el('button', { class: 'ghost sm', type: 'button', onclick: () => openSchool(refreshSchools) }, icon('school'), '학교 편집'),
      el('span', { class: 'grow' }),
      MEAL_KINDS.map((k) => chk(k, (PF.mk || MEAL_KINDS).includes(k), (v) => {
        const cur = new Set(PF.mk || MEAL_KINDS); if (v) cur.add(k); else cur.delete(k);
        PF.mk = MEAL_KINDS.filter((x) => cur.has(x)); savePf(); draw(); render();
      })),
      chk('주말 제외', !!PF.mwe, (v) => { PF.mwe = v; savePf(); draw(); }));
    dlg = el('div', { class: 'dlg mealdlg' },
      el('div', { class: 'shead' }, hb('utensils', '급식'), el('span', { class: 'grow' }),
        el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
      opts,
      el('div', { class: 'mnav' },
        el('button', { class: 'ib', type: 'button', disabled: !PF.school, onclick: () => mv(-1), 'aria-label': '이전 주' }, icon('left')), ttl,
        el('button', { class: 'ib', type: 'button', disabled: !PF.school, onclick: () => mv(1), 'aria-label': '다음 주' }, icon('right')),
        el('button', { class: 'ghost sm', type: 'button', disabled: !PF.school, onclick: () => { sun = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - t0.getDay()); load(); } }, icon('weekNow'), '이번 주')),
      body);
    fit(true);
    m.replaceChildren(el('div', { class: 'back', onclick: close }), dlg);
    load();
  }
  function openSchool(done) {
    const layer = el('div', { class: 'askw' });
    let changed = false;
    const close = () => { layer.remove(); if (changed && done) done(); };
    const list = el('div', { class: 'schlist' });
    const res = el('div', { class: 'schres' });
    const inp = el('input', { type: 'text', 'aria-label': '학교 이름', autocomplete: 'off', spellcheck: 'false' });
    const sbtn = el('button', { class: 'ghost sm', type: 'button', onclick: () => go() }, icon('search'), '검색');
    const drawList = () => {
      list.replaceChildren(...PF.schools.map((z) => el('div', { class: 'schcur' }, el('span', { class: 'schnm' }, z.name),
        el('button', { class: 'ghost sm danger', type: 'button', onclick: async () => {
          if (!(await ask(`${z.name}${eul(z.name)} 삭제할까요?`))) return;
          PF.schools = PF.schools.filter((x) => x.code !== z.code);
          if (PF.school && PF.school.code === z.code) { PF.school = PF.schools[0] || null; }
          S.meal = {}; savePf(); loadMeal(); render(); changed = true; drawList();
        } }, icon('trash'), '삭제'))));
      const full = PF.schools.length >= 5;
      list.hidden = !PF.schools.length; inp.disabled = full; sbtn.disabled = full;
    };
    let busy = false;
    const go = async () => {
      const q = inp.value.trim();
      if (!q || busy || PF.schools.length >= 5) return;
      busy = true; res.replaceChildren(loading());
      try {
        const rows = await neis('schoolInfo', { SCHUL_NM: q });
        res.replaceChildren(...(rows.length ? rows.map((x) => el('button', { type: 'button', class: 'schrow', onclick: () => {
          const ns = { name: x.SCHUL_NM, edu: x.ATPT_OFCDC_SC_CODE, code: x.SD_SCHUL_CODE };
          PF.schools = PF.schools.filter((z) => z.code !== ns.code);
          PF.schools.push(ns);
          PF.school = ns; S.meal = {};
          savePf(); loadMeal(); changed = true; // 창은 닫지 않고, 추가된 학교를 목록에 보여준 뒤 검색칸을 비워요
          res.replaceChildren(); inp.value = ''; drawList(); if (!inp.disabled) inp.focus();
        } }, el('b', {}, x.SCHUL_NM), el('small', {}, ' ' + (x.ORG_RDNMA || x.LCTN_SC_NM || '')))) : [el('div', { class: 'mut' }, '학교 없음')]));
      } catch (e) { console.error(e); res.replaceChildren(el('div', { class: 'mut' }, '학교 없음')); }
      busy = false;
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    layer.append(el('div', { class: 'back', onclick: close }),
      el('div', { class: 'dlg' },
        el('div', { class: 'shead' }, hb('school', '학교 편집'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
        el('div', { class: 'schq' }, fld(inp), sbtn), res,
        list));
    drawList();
    document.body.append(layer);
    setTimeout(() => inp.focus(), 30);
  }

  /* ================= 상담 신청 (선생님) ================= */
  const bookUrl = (id) => new URL('book.html?c=' + id, location.href).href;
  const cRange = (c) => { const d = c.slots.map((x) => x.split('_')[0]).sort(); const f = (k) => { const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)); return `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]})`; }; return d.length ? `${f(d[0])} ~ ${f(d[d.length - 1])}` : ''; };
  const shareText = (c) => `${c.title || '상담'}\n${bookUrl(c.id)}`;
  const copyText = async (c) => {
    const url = bookUrl(c.id);
    try { await navigator.clipboard.writeText(shareText(c)); } catch (e) { console.warn(e); }
    const m = $('#modal');
    m.hidden = false; m.replaceChildren();
    const close = () => { m.hidden = true; m.replaceChildren(); };
    const dlg = el('div', { class: 'dlg sdlg' },
      el('div', { class: 'shead' }, hb('share', '링크 복사'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
      el('div', { class: 'lkgrp' },
        el('div', { class: 'lkmsg' }, '아래 링크를 복사했어요.', el('span', { class: 'grow' }),
          el('button', { class: 'ghost sm', type: 'button', onclick: () => {
            if (qrBox.parentNode) { qrBox.remove(); return; }
            const q = window.makeQR && window.makeQR(url);
            if (!q) return;
            const n = q.length; let d = '';
            q.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 2} ${y + 2}h1v1h-1z`; }));
            qrBox.innerHTML = `<svg viewBox="0 0 ${n + 4} ${n + 4}" shape-rendering="crispEdges" aria-label="QR코드"><rect width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
            dlg.append(qrBox);
          } }, icon('qr'), 'QR코드')),
        el('div', { class: 'lkbox' }, url)));
    const qrBox = el('div', { class: 'lkqr' });
    m.append(el('div', { class: 'back', onclick: close }), dlg);
  };
  const sidLabel = (sid) => { const d = new Date(+sid.slice(0, 4), +sid.slice(4, 6) - 1, +sid.slice(6, 8)); return `${d.getMonth() + 1}.${d.getDate()}. (${DOW[d.getDay()]}) ${sid.slice(9, 11)}:${sid.slice(11, 13)}`; };
  function consultView() {
    const host = el('div', { class: 'cv' });
    S.cvHost = host;
    if (!S.cloud) return host;
    let unsub = null;
    S.cleanup = () => { if (unsub) unsub(); unsub = null; };
    let nav = 0;
    const stop = () => { nav++; if (unsub) { unsub(); unsub = null; } };
    let dir = ''; // 화면을 넘길 때만: 'next'(오른쪽에서 밀려 들어옴) · 'prev'(왼쪽에서)
    const shell = (title, body, back) => {
      const kids = [
        !title && !back ? null : el('div', { class: 'cvh' }, back ? el('button', { class: 'ib', type: 'button', onclick: () => { dir = 'prev'; back(); }, 'aria-label': '이전' }, icon('arrowL')) : null, el('b', {}, title)), body].filter(Boolean);
      const d = dir; dir = '';
      const olds = d ? [...host.children].map((n) => n.cloneNode(true)) : [];
      host.replaceChildren(...kids);
      if (d && !noAnim()) { // 탭 전환과 같은 방식: 새 화면이 옆 22% 자리에서 페이드인하며 끝까지 덮고, 옛 화면은 덮인 부분만 잘라내요 (다음: 오른쪽에서 / 이전: 왼쪽에서)
        host.scrollTop = 0;
        const dr = d === 'next' ? 1 : -1, D = 22, fo = { duration: SL.dur, easing: SL.ease, fill: 'both' };
        const ghost = el('div', { class: 'cv cs-ghost', 'aria-hidden': 'true' }, ...olds);
        ghost.inert = true; ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        host.append(ghost);
        const ans = kids.flatMap((c) => [c.animate([{ transform: `translateX(${dr * D}%)` }, { transform: 'none' }], fo), c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SL.fade, easing: 'ease-out', fill: 'both' })]);
        const ga = ghost.animate(dr > 0 ? [{ clipPath: `inset(0 ${100 - D}% 0 0)` }, { clipPath: 'inset(0 100% 0 0)' }] : [{ clipPath: `inset(0 0 0 ${100 - D}%)` }, { clipPath: 'inset(0 0 0 100%)' }], fo);
        ga.onfinish = ga.oncancel = () => { ghost.remove(); ans.forEach((x) => x.cancel()); };
      }
    };
    const hm = (sid) => `${sid.slice(9, 11)}:${sid.slice(11, 13)}`;
    const kOf = (d) => ymd(d).replace(/-/g, '');
    const dcol = (d) => (d.getDay() === 0 || holName(ymd(d), d) ? 'dsun' : d.getDay() === 6 ? 'dsat' : ''); // 캘린더와 같은 요일·공휴일 색
    const mins = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
    const tkey = (t) => pad(Math.floor(t / 60)) + pad(t % 60);
    const r = (l, ...c) => el('div', { class: 'pfr' }, el('span', { class: 'pl' }, l), el('div', { class: 'pc2' }, c));

    /* ---- 첫 화면: 새로 만들기 + 만들어 둔 상담표 목록 ---- */
    async function list() {
      S.cs = null; stop(); const my = nav;
      const d0 = dir; dir = '';
      if (!d0) shell('', loading(true));
      let rows = [];
      try { rows = await S.cloud.consultList(); } catch (e) { console.error(e); }
      if (my !== nav) return;
      dir = d0;
      S.ctitles = rows.map((r) => r.title || '');
      rows.sort((a, b) => (b.created || 0) - (a.created || 0));
      shell('', el('div', { class: 'clist' },
        rows.map((c) => el('div', { class: 'crow' },
          el('button', { class: 'ctitle', type: 'button', onclick: () => { dir = 'next'; detail(c); } }, el('b', {}, c.title || '상담'), el('small', {}, ` ${cRange(c)}`)),
          el('button', { class: 'ib', type: 'button', title: '링크 복사', 'aria-label': '링크 복사', onclick: () => copyText(c) }, icon('share')),
          el('button', { class: 'ib', type: 'button', title: '수정', 'aria-label': '수정', onclick: () => { dir = 'next'; fine(draftOf(c), c, 'list'); } }, icon('edit')),
          el('button', { class: 'ib danger', type: 'button', title: '삭제', 'aria-label': '삭제', onclick: () => del(c) }, icon('trash')))),
        el('button', { class: 'pri cnew', type: 'button', onclick: () => { dir = 'next'; quick(); } }, icon('plus'), '새 테이블 만들기')));
    }
    async function del(c) {
      if (!(await ask(`${c.title || '상담'}${eul(c.title || '상담')} 삭제할까요?`))) return;
      try { await S.cloud.consultDelete(c.id); list(); } catch (e) { console.error(e); }
    }

    /* ---- 1단계: 빠른 만들기 (기간·시각·간격) ---- */
    function quick() {
      stop();
      const today = ymd(new Date());
      const q = S.qform || (S.qform = { title: '', note: '', from: today, to: ymd(new Date(Date.now() + 13 * 864e5)), t1: '16:00', t2: '17:00', step: 20, skipWE: true, closeD: '', closeT: '', noDup: false });
      const f = {
        title: el('input', { type: 'text', maxlength: 40, value: q.title }),
        note: el('textarea', { rows: 3, maxlength: 500, spellcheck: 'false' }, q.note),
        from: el('input', { type: 'date', value: q.from }), to: el('input', { type: 'date', value: q.to }),
        t1: timeSel(q.t1), t2: timeSel(q.t2),
        step: el('select', {}, stepOpts(q.step)),
        closeD: el('input', { type: 'date', value: q.closeD }), closeT: timeSel(q.closeT, true),
      };
      const wk = el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox', checked: q.skipWE }), el('span', {}, '주말 제외'));
      const nd = el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox', checked: q.noDup }), el('span', {}, '중복 신청 불가'));
      const save = () => { Object.keys(f).forEach((k) => { q[k] = k === 'step' ? +f[k].value : f[k].value; }); q.skipWE = wk.querySelector('input').checked; q.noDup = nd.querySelector('input').checked; };
      const tl = (...c) => el('span', { class: 'rng' }, c[0], el('span', { class: 'tld' }, '~'), c[1]);
      /* 시작이 종료보다 뒤로 가지 못하게: 캘린더·시각 목록에서 막고, 직접 입력해도 같은 값으로 맞춰요 */
      const limits = () => { f.from.max = f.to.value || ''; f.to.min = f.from.value || ''; f.t1.limit('', f.t2.value); f.t2.limit(f.t1.value, ''); };
      f.from.addEventListener('change', () => { if (f.from.value && f.to.value && f.from.value > f.to.value) f.from.value = f.to.value; limits(); });
      f.to.addEventListener('change', () => { if (f.from.value && f.to.value && f.to.value < f.from.value) f.to.value = f.from.value; limits(); });
      f.t1.addEventListener('change', limits); f.t2.addEventListener('change', limits);
      let okb;
      shell('새 테이블 만들기 (1/2)', el('div', { class: 'cform' },
        r('제목', fld(f.title)), el('div', { class: 'pfr col' }, el('span', { class: 'pl' }, '학생 안내 사항(선택)'), fld(f.note)),
        r('시작일 · 종료일', tl(f.from, f.to)), wk, r('시작 시각 · 종료 시각', tl(f.t1, f.t2)), r('간격', f.step), r('신청 마감(선택)', f.closeD, f.closeT), nd,
        el('div', { class: 'dlgf' }, el('span', { class: 'grow' }),
          okb = el('button', { class: 'pri', type: 'button', onclick: () => {
          save();
          const a = parseYmd(q.from || today), z = parseYmd(q.to || today);
          const step = q.step;
          const days = {};
          for (let d = new Date(a); d <= z && Object.keys(days).length < 120; d.setDate(d.getDate() + 1)) {
            if (q.skipWE && (d.getDay() === 0 || d.getDay() === 6)) continue;
            const o = {};
            for (let t = mins(q.t1); t + step <= mins(q.t2); t += step) o[tkey(t)] = true;
            days[kOf(d)] = o;
          }
          if (!Object.values(days).some((o) => Object.keys(o).length)) return;
          dir = 'next';
          fine({ title: q.title.trim() || autoName('상담 신청 테이블', S.ctitles || []), note: q.note.trim(), closeAt: q.closeD ? new Date(`${q.closeD}T${q.closeT || '23:59'}`).getTime() : 0, noDup: q.noDup, days, step }, null);
        } }, '다음'))), () => { S.qform = null; list(); });
      limits();
      const chk = () => { okb.disabled = !(f.from.value && f.to.value && f.from.value <= f.to.value && mins(f.t1.value) + +f.step.value <= mins(f.t2.value)); };
      Object.values(f).forEach((x) => { x.addEventListener('input', chk); x.addEventListener('change', chk); }); chk();
      const emp = () => f.closeD.classList.toggle('empty', !f.closeD.value); /* 비어 있는 날짜(연도-월-일)는 회색 */
      f.closeD.addEventListener('input', emp); f.closeD.addEventListener('change', emp); emp();
    }

    /* ---- 2단계: 칸마다 잠그기 · 날짜별로 다르게 ---- */
    function draftOf(c) {
      const days = {};
      c.slots.forEach((sid) => { (days[sid.slice(0, 8)] = days[sid.slice(0, 8)] || {})[sid.slice(9, 13)] = true; });
      return { title: c.title || '', note: c.note || '', closeAt: c.closeAt || 0, noDup: !!c.noDup, days, step: 20 };
    }
    function fine(dr, c, from) {
      stop();
      let booked = {};
      const total = () => Object.values(dr.days).reduce((n, o) => n + Object.values(o).filter(Boolean).length, 0);
      const draw = () => {
        /* 화면을 다시 그려도 보고 있던 위치(세로·가로 스크롤)를 그대로 유지해요 */
        const sv = (q) => { const n = host.querySelector(q); return n ? [n.scrollTop, n.scrollLeft] : null; };
        const keepPos = [['.cform', sv('.cform')], ['.cgrid', sv('.cgrid')]];
        const keys = Object.keys(dr.days).sort();
        const allT = [...new Set(keys.flatMap((k) => Object.keys(dr.days[k])))].sort(); // 모든 날의 시각을 합친 목록
        const tIn = el('input', { type: 'text', value: dr.title, maxlength: 40, oninput: (e) => { dr.title = e.target.value; } });
        const nIn = el('textarea', { rows: 3, maxlength: 500, spellcheck: 'false', oninput: (e) => { dr.note = e.target.value; } }, dr.note);
        const c0 = dr.closeAt ? new Date(dr.closeAt) : null;
        const cDate = el('input', { type: 'date', value: c0 ? ymd(c0) : '' }), cTime = timeSel(c0 && !(c0.getHours() === 23 && c0.getMinutes() === 59) ? `${pad(c0.getHours())}:${pad(Math.floor(c0.getMinutes() / 5) * 5)}` : '', true);
        const cSync = () => { dr.closeAt = cDate.value ? new Date(`${cDate.value}T${cTime.value || '23:59'}`).getTime() : 0; };
        cDate.addEventListener('change', cSync); cTime.addEventListener('change', cSync);
        const cEmp = () => cDate.classList.toggle('empty', !cDate.value); /* 비어 있는 날짜(연도-월-일)는 회색 */
        cDate.addEventListener('input', cEmp); cDate.addEventListener('change', cEmp); cEmp();
        const cIn = el('span', { class: 'pc2' }, cDate, cTime);
        const addDate = el('input', { type: 'date' });
        const aEmp = () => addDate.classList.toggle('empty', !addDate.value); /* 비어 있는 날짜(연도-월-일)는 회색 */
        addDate.addEventListener('input', aEmp); addDate.addEventListener('change', aEmp); aEmp();
        const dPlus = el('button', { class: 'pri cplus', type: 'button', title: '날짜 추가', 'aria-label': '날짜 추가', onclick: () => { if (!addDate.value) return; const k = addDate.value.replace(/-/g, ''); dr.days[k] = dr.days[k] || {}; addDate.value = ''; draw(); } }, icon('plus'));
        const dChk = () => { dPlus.disabled = addDate.value.replace(/-/g, '') in dr.days; }; /* 이미 있는 날짜면 추가 불가 */
        addDate.addEventListener('input', dChk); addDate.addEventListener('change', dChk); dChk();
        const dayCard = (k) => {
          const o = dr.days[k], ts = Object.keys(o).sort();
          const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
          /* 시각 추가의 기본값: 그날 마지막 칸 + 간격 (간격은 만들 때 정한 값, 없으면 칸 사이 간격에서 알아내요) */
          const stepM = (() => { const m = ts.map((t) => +t.slice(0, 2) * 60 + +t.slice(2)); return m.length > 1 ? (m[m.length - 1] - m[m.length - 2]) || dr.step || 20 : dr.step || 20; })();
          const nextM = ts.length ? Math.min(+ts[ts.length - 1].slice(0, 2) * 60 + +ts[ts.length - 1].slice(2) + stepM, 23 * 60 + 55) : 16 * 60;
          const tm = timeSel(`${pad(Math.floor(nextM / 60))}:${pad(nextM % 60 - (nextM % 5))}`);
          const tPlus = el('button', { class: 'pri cplus', type: 'button', title: '시각 추가', 'aria-label': '시각 추가', onclick: () => {
            const t = tm.value.replace(':', ''); if (!(t in o)) o[t] = true; draw();
          } }, icon('plus'));
          const tChk = () => { tPlus.disabled = tm.value.replace(':', '') in o; }; /* 이미 있는 시각이면 추가 불가 */
          tm.addEventListener('change', tChk); tm.addEventListener('input', tChk); tChk();
          return el('div', { class: 'cdc' },
            el('div', { class: 'cdh ' + dcol(d) }, el('b', { class: 'cday' }, `${d.getMonth() + 1}.${d.getDate()}.`), el('span', { class: 'mut' }, `(${DOW[d.getDay()]})`), el('span', { class: 'grow' }),
              el('button', { class: 'ib sm danger', type: 'button', title: '이날 삭제', 'aria-label': '이날 삭제', onclick: () => { delete dr.days[k]; draw(); } }, icon('trash'))),
            ts.map((t) => {
              const b = booked[k + '_' + t];
              return el('button', { type: 'button', class: 'cchip' + (o[t] ? '' : ' off') + (b ? ' bk' : ''),
                onclick: () => { o[t] = !o[t]; draw(); } }, `${t.slice(0, 2)}:${t.slice(2)}`, b ? el('small', {}, b.name) : null);
            }),
            el('div', { class: 'cadd' }, tm, tPlus));
        };
        shell(c ? '테이블 수정' : '새 테이블 만들기 (2/2)', el('div', { class: 'cform' },
          ...(c ? [r('제목', fld(tIn)), el('div', { class: 'pfr col' }, el('span', { class: 'pl' }, '학생 안내 사항(선택)'), fld(nIn)), r('신청 마감(선택)', cIn), el('label', { class: 'pfr tg' }, el('input', { type: 'checkbox', checked: !!dr.noDup, onchange: (e) => { dr.noDup = e.target.checked; } }), el('span', {}, '중복 신청 불가'))] : []),
          c ? el('div', { class: 'cdiv' }) : null, // 수정할 때: 위 설정(제목·안내·마감·중복)과 날짜 표 사이 구분선
          r('날짜 추가', addDate, dPlus),
          allT.length ? r('상담 시간 한꺼번에 삭제', el('div', { class: 'cchips cbulk' }, allT.map((t) => {
            const on = keys.some((k) => dr.days[k][t]); /* 어느 날에든 켜져 있으면 보통, 모든 날에서 꺼져 있으면 가운데 줄 */
            return el('button', { type: 'button', class: 'cchip' + (on ? '' : ' off'), onclick: () => { keys.forEach((k) => { if (t in dr.days[k]) dr.days[k][t] = !on; }); draw(); } }, `${t.slice(0, 2)}:${t.slice(2)}`);
          }))) : null,
          el('div', { class: 'cgrid' }, keys.length ? keys.map(dayCard) : el('div', { class: 'mut' }, '날짜 없음')),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), c ? null : el('button', { class: 'ghost', type: 'button', onclick: () => { dir = 'prev'; quick(); } }, '이전'), el('button', { class: 'pri', type: 'button', disabled: !total() || total() > 400, onclick: async (e) => {
            const btn = e.currentTarget, fb = btn.parentElement;
            fb.querySelector('.cerr')?.remove();
            const slots = [];
            Object.keys(dr.days).sort().forEach((k) => Object.keys(dr.days[k]).sort().forEach((t) => { if (dr.days[k][t]) slots.push(`${k}_${t}`); }));
            if (!slots.length || slots.length > 400) return;
            btn.disabled = true;
            try {
              const data = { title: dr.title.trim() || '상담', note: dr.note.trim(), slots, closeAt: dr.closeAt || 0, noDup: !!dr.noDup };
              let id;
              if (c) { await S.cloud.consultUpdate(c.id, data); id = c.id; } else id = await S.cloud.consultCreate(data);
              let nc = { ...data, id, created: Date.now() };
              try { nc = (await S.cloud.consultList()).find((x) => x.id === id) || nc; } catch (e2) { console.error(e2); }
              S.qform = null; dir = 'prev'; list();
            } catch (er) {
              console.error(er); btn.disabled = false;
              fb.prepend(el('span', { class: 'cerr' }, `저장하지 못했어요 (${(er && (er.code || er.message)) || '오류'})`));
            }
          } }, '저장'))), c ? () => { from === 'detail' ? detail(c) : list(); } : quick);
        keepPos.forEach(([q, pos]) => { const n = pos && host.querySelector(q); if (n) { n.scrollTop = pos[0]; n.scrollLeft = pos[1]; } });
      };
      if (!c) { draw(); return; }
      /* 수정: 신청 현황이 도착한 뒤 한 번만 그려야 오른쪽에서 밀려 들어오는 효과가 끊기지 않아요 */
      const d0 = dir; dir = '';
      if (!d0) shell('', loading(true));
      let first = true;
      const once = () => { if (first) { first = false; dir = d0; } };
      unsub = S.cloud.consultWatchBooks(c.id, (books) => { once(); booked = {}; books.filter((b) => !b.cancelled).forEach((b) => { booked[b.id] = b; }); draw(); }, () => { once(); draw(); });
    }

    /* ---- 완성된 테이블: 링크 복사 · 신청 현황 ---- */
    /* 선생님이 학생 대신 신청 (비어 있는 칸을 누르면): 학번·이름·비밀번호를 정해 주면 학생은 그 비밀번호로만 고칠 수 있어요 */
    function proxyBook(c, sid) {
      const layer = el('div', { class: 'askw' });
      const close = () => { layer.remove(); document.removeEventListener('keydown', key, true); };
      const digits = (n) => (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, n); if (v !== e.target.value) e.target.value = v; };
      const fi = el('input', { type: 'text', inputmode: 'numeric', maxlength: 5, autocomplete: 'off', 'aria-label': '학번', oninput: digits(5) });
      const fn = el('input', { type: 'text', maxlength: 20, autocomplete: 'off', 'aria-label': '이름' });
      const fp = el('input', { type: 'text', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', 'aria-label': '비밀번호', oninput: digits(4) });
      const ok = el('button', { class: 'pri', type: 'button', disabled: true }, '확인');
      const valid = () => fi.value.length === 5 && fn.value.trim() && fp.value.length === 4;
      const chk = () => { ok.disabled = !valid(); };
      [fi, fn, fp].forEach((x) => x.addEventListener('input', chk));
      const go = async () => {
        if (!valid() || ok.disabled) return;
        ok.disabled = true;
        try {
          await S.cloud.consultBookFor(c.id, sid, { info: fi.value, name: fn.value.trim(), pin: fp.value }, !!c.noDup);
          close();
        } catch (e) {
          console.error(e);
          ok.disabled = false;
          if (e.code === 'pin-mismatch') await notice('비밀번호가 맞지 않아요.'); else if (e.code === 'dup') await notice('이미 신청한 상담이 있어요.');
          fp.focus(); fp.select();
        }
      };
      ok.addEventListener('click', go);
      const key = (e) => { if (document.querySelector('.askd')) return; if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'Enter') { e.stopPropagation(); go(); } };
      const p = (l, i) => el('div', { class: 'pfr' }, el('span', { class: 'pl' }, l), el('div', { class: 'pc2' }, i));
      layer.append(el('div', { class: 'back', onclick: close }),
        el('div', { class: 'dlg proxd', role: 'dialog' },
          el('div', { class: 'shead' }, el('b', {}, '상담 신청'), el('button', { class: 'ib', type: 'button', onclick: close, 'aria-label': '닫기' }, icon('close'))),
          el('div', { class: 'mut small proxt' }, sidLabel(sid)),
          el('div', { class: 'cform' }, p('학번(숫자 5자리)', fi), p('이름', fn), p('비밀번호(숫자 4자리)', fp)),
          el('div', { class: 'dlgf' }, el('span', { class: 'grow' }), el('button', { class: 'ghost', type: 'button', onclick: close }, '취소'), ok)));
      document.addEventListener('keydown', key, true);
      document.body.append(layer);
      fi.focus();
    }
    function detail(c) {
      S.cs = { c };
      const draw = (books) => {
        const by = {}; books.filter((b) => !b.cancelled).forEach((b) => { by[b.id] = b; });
        const days = {};
        c.slots.slice().sort().forEach((sid) => { (days[sid.slice(0, 8)] = days[sid.slice(0, 8)] || []).push(sid); });
        const n = Object.keys(by).length;
        /* 만들 때·수정할 때와 같은 표 모양(날짜 카드 + 시각 칩)으로 보여줘요. 신청된 칸은 색이 채워지고 이름이 보여요 */
        const card = (k) => {
          const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
          return el('div', { class: 'cdc' },
            el('div', { class: 'cdh ' + dcol(d) }, el('b', { class: 'cday' }, `${d.getMonth() + 1}.${d.getDate()}.`), el('span', { class: 'mut' }, `(${DOW[d.getDay()]})`)),
            days[k].map((sid) => {
              const b = by[sid];
              return el('button', { type: 'button', class: 'cchip' + (b ? ' bk' : ' ro'), title: b ? `${b.name}${b.info ? ' (' + b.info + ')' : ''}` : null,
                onclick: b ? async () => {
                  if (!(await ask(`${b.name}${b.info ? ' (' + b.info + ')' : ''}의 신청을 삭제할까요?`, '삭제'))) return;
                  try { await S.cloud.consultRemoveBooking(c.id, sid); } catch (e) { console.error(e); }
                } : () => proxyBook(c, sid) }, hm(sid), b ? el('small', {}, b.name) : null);
            }));
        };
        shell(c.title || '상담', el('div', { class: 'cdet' },
          el('div', { class: 'crow2' }, el('span', { class: 'mut' }, cRange(c)), el('span', { class: 'grow' }),
            el('button', { class: 'tbn', type: 'button', onclick: () => copyText(c) }, icon('share'), '링크 복사'),
            el('button', { class: 'tbn', type: 'button', onclick: () => { dir = 'next'; fine(draftOf(c), c, 'detail'); } }, icon('edit'), '수정'),
            el('button', { class: 'tbn danger', type: 'button', onclick: () => del(c) }, icon('trash'), '삭제')),
          el('div', { class: 'cgrid' }, Object.keys(days).map(card))), list);
      };
      stop();
      /* 처음 한 번만 오른쪽에서 밀려 들어와요 (불러오는 동안은 이전 화면이 그대로, 이후 신청 변화는 제자리에서 갱신) */
      const d0 = dir; dir = '';
      if (!d0) shell('', loading(true));
      let first = true;
      unsub = S.cloud.consultWatchBooks(c.id, (books) => { if (first) { first = false; dir = d0; } draw(books); }, (e) => console.error(e));
    }
    if (S.cs && S.cs.c) detail(S.cs.c); else list();
    return host;
  }

  /* ================= 위젯 이동·크기 변경 (Electron) ================= */
  function initWidgetEdit() {
    if (!IS_WIDGET) return;
    const api = window.hagisiroWidget;
    let layer = null;
    function toggle() {
      if (layer) { layer._off && layer._off(); layer.remove(); layer = null; document.body.classList.remove('wedit'); return; }
      document.body.classList.add('wedit');
      const done = el('button', { class: 'pri sm wdone', type: 'button', onclick: (ev) => { ev.stopPropagation(); toggle(); } }, '확인');
      done.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      layer = el('div', { id: 'wedit' }, ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].map((e) => el('i', { 'data-e': e })), done);
      const fit = () => { // 위젯 영역에 정확히 맞춰요 (창이 커져 있거나 스크롤바 자리가 있어도 오른쪽이 잘리지 않게)
        const a = document.getElementById('app'); if (!a || !layer) return;
        const b = a.getBoundingClientRect(), w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
        const l = Math.max(0, b.left), t = Math.max(0, b.top), rr = Math.min(w, b.right), bb = Math.min(h, b.bottom);
        Object.assign(layer.style, { inset: 'auto', left: l + 'px', top: t + 'px', width: Math.max(0, rr - l) + 'px', height: Math.max(0, bb - t) + 'px' });
      };
      layer._fit = fit; window.addEventListener('resize', fit);
      let drag = null;
      ['dragstart', 'selectstart', 'contextmenu'].forEach((t) => layer.addEventListener(t, (ev) => ev.preventDefault()));
      layer.addEventListener('pointerdown', async (ev) => {
        ev.preventDefault();
        if (ev.button !== 0) return; // 왼쪽 버튼만
        window.getSelection && window.getSelection().removeAllRanges();
        if (!api) return;
        const mode = ev.target.dataset.e || 'move';
        layer.setPointerCapture(ev.pointerId);
        const CUR = { n: 'ns-resize', s: 'ns-resize', w: 'ew-resize', e: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', move: 'move' };
        layer.style.cursor = CUR[mode] || 'move'; // 끄는 동안에도 잡은 가장자리에 맞는 커서 유지
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
      const end = () => { if (drag && api) api.done(); drag = null; layer.style.cursor = ''; };
      layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
      document.body.append(layer); fit();
      /* 앱 바깥을 누르거나 다른 창으로 넘어가면 이동·크기 변경이 끝나요 */
      const outside = (ev) => { if (layer && !layer.contains(ev.target)) toggle(); };
      const lost = () => { if (layer) toggle(); };
      document.addEventListener('pointerdown', outside, true); window.addEventListener('blur', lost);
      layer._off = () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('blur', lost); };
    }
    S.winEdit = toggle;
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && layer) toggle(); });
  }

  /* ================= 키보드 ================= */

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

  if (location.hostname === 'localhost') window.__haru = { S, Data, render, lastOf }; // 개발용 (배포 화면에선 노출 안 함)
  /* 모든 팝업: 안의 내용이 바뀌어 세로 크기가 달라질 때 부드럽게 늘고 줄어요 (급식 팝업은 자체 전환 사용) */
  function watchPopups() {
    const seen = new WeakSet();
    const attach = (n) => {
      if (seen.has(n) || n.classList.contains('mealdlg')) return;
      seen.add(n);
      let last = n.offsetHeight, busy = false;
      new ResizeObserver(() => {
        if (busy) return;
        const h = n.offsetHeight;
        if (n.dataset.nofx && performance.now() - +n.dataset.nofx < 400) { last = h; return; } // 처음 나타날 때 크기를 맞추는 건 움직이지 않아요
        if (noAnim() || Math.abs(h - last) < 2) { last = h; return; }
        const from = last; last = h; busy = true;
        const ov = n.style.overflow; n.style.overflow = 'hidden';
        const a = n.animate([{ height: from + 'px' }, { height: h + 'px' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' });
        const end = () => { busy = false; n.style.overflow = ov; last = n.offsetHeight; };
        a.onfinish = end; a.oncancel = end;
      }).observe(n);
    };
    const scan = () => document.querySelectorAll('.dlg, #sheet .panel').forEach(attach);
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    scan();
  }
  /* 드롭다운(<select>) 목록: 브라우저 기본 목록 대신 연도·월 목록과 같은 앱 전용 목록으로 보여줘요 (값·변경 이벤트는 그대로라 기존 동작은 바뀌지 않아요) */
  function initSelects() {
    let dd = null, cur = null, skip = null, hi = -1;
    const items = () => [...dd.querySelectorAll('.ttdo:not(:disabled)')];
    const mark = (i) => {
      const it = items(); if (!it.length) return;
      hi = (i + it.length) % it.length;
      it.forEach((b, k) => b.classList.toggle('kb', k === hi));
      it[hi].scrollIntoView({ block: 'nearest' });
    };
    const close = () => {
      if (!dd) return;
      dd.remove(); dd = null; cur = null; hi = -1;
      document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', close);
    };
    const off = (e) => { if (!dd || dd.contains(e.target)) return; skip = e.target.closest && e.target.closest('select') === cur ? cur : null; close(); };
    const key = (e) => {
      if (!dd) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const s = cur; close(); s.focus(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); mark(hi + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); mark(hi < 0 ? -1 : hi - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { const it = items(); if (hi >= 0 && it[hi]) { e.preventDefault(); e.stopPropagation(); it[hi].click(); } }
      else if (e.key === 'Tab') close();
    };
    const open = (s) => {
      close();
      const opts = [...s.options];
      dd = el('div', { class: 'ttdd sdd', role: 'listbox' }, opts.map((o, i) => (o.hidden ? null : el('button', { type: 'button', class: 'ttdo' + (o.selected ? ' on' : ''), disabled: o.disabled, onclick: () => {
        s.selectedIndex = i;
        s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
        close(); s.focus();
      } }, o.textContent))));
      cur = s;
      document.body.append(dd);
      const r = s.getBoundingClientRect();
      const below = innerHeight - r.bottom - 10, above = r.top - 10, up = dd.scrollHeight + 10 > below && above > below;
      dd.style.maxHeight = Math.max(80, Math.min(240, up ? above : below)) + 'px';
      dd.style.minWidth = r.width + 'px';
      dd.style.left = Math.max(6, Math.min(r.left, innerWidth - dd.offsetWidth - 6)) + 'px';
      dd.style.top = (up ? r.top - 4 - dd.offsetHeight : r.bottom + 4) + 'px';
      const on = dd.querySelector('.on'); if (on) { dd.scrollTop = Math.max(0, on.offsetTop - 70); hi = items().indexOf(on); }
      document.addEventListener('pointerdown', off, true); document.addEventListener('keydown', key, true); window.addEventListener('resize', close);
    };
    document.addEventListener('mousedown', (e) => {
      const s = e.target.closest && e.target.closest('select');
      if (!s || s.disabled || e.button !== 0) return;
      e.preventDefault(); // 기본 목록이 뜨지 않게
      s.focus();
      if (skip === s) { skip = null; return; }
      skip = null; open(s);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (dd) return;
      const s = e.target;
      if (!(s instanceof HTMLSelectElement) || s.disabled) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(s); }
    }, true);
    window.addEventListener('scroll', (e) => { if (dd && !dd.contains(e.target)) close(); }, true);
  }
  initSelects();
  watchPopups();
  initWidgetEdit();
  { const tp = $('#top'); if (tp && window.ResizeObserver) new ResizeObserver((es) => { S.topW = Math.round(es[0].contentRect.width); fitTop(); }).observe(tp); }
  if (document.fonts) document.fonts.ready.then(() => { S.fitSig = null; fitTop(); }); // 글꼴이 늦게 들어와 글자 폭이 바뀌면 한 번 다시 재요
  boot();
})();
