/* HAGISIRO — 음력 · 24절기 · 대한민국 공휴일 (모두 오프라인 계산)
 *  - 음력: 브라우저 Intl(중국력)을 사용. 한국 음력과 아주 드물게 하루 차이가 날 수 있음
 *  - 24절기: 태양 황경(Meeus 저정밀식)으로 계산, 한국 표준시(KST) 날짜
 *  - 공휴일: 고정일 + 음력 명절 + 대체공휴일 규칙 (임시공휴일은 구글 캘린더 연동으로 보강)
 */
(function (root) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /* ---------------- 음력 ---------------- */
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }); } catch (e) { fmt = null; }
  const lcache = new Map();

  /* Intl 중국력은 UTC+8 기준이라, 삭(朔)이 UTC 15:00~16:00(한국 자정 직전 1시간)에 걸리면
   * 한국(UTC+9)보다 하루 이르다. 삭 시각을 직접 계산해 그 달만 보정한다. (Meeus ch.49 축약식) */
  function newMoonMs(k) {
    const T = k / 1236.85, T2 = T * T;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const r = (x) => ((x % 360) + 360) % 360 * rad;
    const M = r(2.5534 + 29.1053567 * k - 0.0000014 * T2);
    const Mp = r(201.5643 + 385.81693528 * k + 0.0107582 * T2);
    const F = r(160.7108 + 390.67050284 * k - 0.0016118 * T2);
    const Om = r(124.7746 - 1.56375588 * k + 0.0020672 * T2);
    jde += -0.4072 * Math.sin(Mp) + 0.17241 * E * Math.sin(M) + 0.01608 * Math.sin(2 * Mp) + 0.01039 * Math.sin(2 * F)
      + 0.00739 * E * Math.sin(Mp - M) - 0.00514 * E * Math.sin(Mp + M) + 0.00208 * E * E * Math.sin(2 * M)
      - 0.00111 * Math.sin(Mp - 2 * F) - 0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * E * Math.sin(2 * Mp + M)
      - 0.00042 * Math.sin(3 * Mp) + 0.00042 * E * Math.sin(M + 2 * F) + 0.00038 * E * Math.sin(M - 2 * F)
      - 0.00024 * E * Math.sin(2 * Mp - M) - 0.00017 * Math.sin(Om);
    return (jde - 2440587.5) * 86400000 - 69000; // TT→UT(ΔT≈69s)
  }
  const edgeCache = new Map();
  /** year년 안에서 "중국 달력으론 D일, 한국 달력으론 D+1일"인 삭의 중국 기준 날짜 집합 */
  function edgeDays(year) {
    if (edgeCache.has(year)) return edgeCache.get(year);
    const set = new Set();
    const k0 = Math.floor((year - 2000) * 12.3685) - 2;
    for (let k = k0; k < k0 + 16; k++) {
      const ms = newMoonMs(k);
      const hr = (((ms % 86400000) + 86400000) % 86400000) / 3600000; // UTC 시각
      if (hr >= 15 && hr < 16) {
        const cn = new Date(ms + 8 * 3600000);
        set.add(`${cn.getUTCFullYear()}-${pad(cn.getUTCMonth() + 1)}-${pad(cn.getUTCDate())}`);
      }
    }
    edgeCache.set(year, set);
    return set;
  }
  const isEdge = (d) => edgeDays(d.getFullYear()).has(ymd(d)) || edgeDays(d.getFullYear() + 1).has(ymd(d)) || edgeDays(d.getFullYear() - 1).has(ymd(d));

  function rawLunar(date) {
    const noonKST = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 3)); // 한국 정오
    const parts = fmt.formatToParts(noonKST);
    const mo = parts.find((p) => p.type === 'month').value;
    const da = parts.find((p) => p.type === 'day').value;
    return { m: parseInt(mo, 10), d: parseInt(da, 10), leap: /bis/i.test(mo) };
  }

  /** → { m, d, leap } 또는 null  (한국 기준) */
  function lunarOf(date) {
    if (!fmt) return null;
    const key = ymd(date);
    if (lcache.has(key)) return lcache.get(key);
    let out = null;
    try {
      const l = rawLunar(date);
      const start = addDays(date, -(l.d - 1)); // 이 달(중국 기준)의 1일
      if (isEdge(start)) {
        if (l.d === 1) { const p = rawLunar(addDays(date, -1)); out = { m: p.m, d: p.d + 1, leap: p.leap }; }
        else out = { m: l.m, d: l.d - 1, leap: l.leap };
      } else out = l;
    } catch (e) { out = null; }
    lcache.set(key, out);
    return out;
  }
  /** 칸에 쓸 짧은 표기: 매달 1일은 "음9.1"(윤달은 "윤9.1"), 나머지는 "9.22" */
  function lunarLabel(date) {
    const l = lunarOf(date);
    if (!l) return '';
    if (l.d === 1) return (l.leap ? '윤' : '음') + l.m + '.1';
    return l.m + '.' + l.d;
  }

  /* ---------------- 24절기 ---------------- */
  const TERMS = [
    ['소한', 285], ['대한', 300], ['입춘', 315], ['우수', 330], ['경칩', 345], ['춘분', 0],
    ['청명', 15], ['곡우', 30], ['입하', 45], ['소만', 60], ['망종', 75], ['하지', 90],
    ['소서', 105], ['대서', 120], ['입추', 135], ['처서', 150], ['백로', 165], ['추분', 180],
    ['한로', 195], ['상강', 210], ['입동', 225], ['소설', 240], ['대설', 255], ['동지', 270],
  ];
  const rad = Math.PI / 180;
  const jdOf = (ms) => ms / 86400000 + 2440587.5;
  function sunLon(jd) { // 태양 겉보기 황경(도)
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const om = (125.04 - 1934.136 * T) * rad;
    return (((L0 + C - 0.00569 - 0.00478 * Math.sin(om)) % 360) + 360) % 360;
  }
  const termCache = new Map();
  /** year년의 24절기 → { 'YYYY-MM-DD': '입춘', ... } (KST 기준 날짜) */
  function termsOfYear(year) {
    if (termCache.has(year)) return termCache.get(year);
    const map = {};
    for (const [name, target] of TERMS) {
      // 대략의 시각에서 ±4일 구간을 이분 탐색
      const k = (target + 360 - 285) % 360 / 15; // 소한=0
      let guess = Date.UTC(year, 0, 5, 0) + k * 15.2184 * 86400000;
      let lo = guess - 4 * 86400000, hi = guess + 4 * 86400000;
      const diff = (ms) => { let x = sunLon(jdOf(ms)) - target; if (x > 180) x -= 360; if (x < -180) x += 360; return x; };
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (diff(mid) < 0) lo = mid; else hi = mid;
      }
      const kst = new Date((lo + hi) / 2 + 9 * 3600000);
      map[`${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`] = name;
    }
    termCache.set(year, map);
    return map;
  }
  const termOf = (date) => termsOfYear(date.getFullYear())[ymd(date)] || '';

  /* ---------------- 공휴일 ---------------- */
  const EXTRA = { // 법정 선거일 등 계산으로 알 수 없는 날
    '2026-06-03': '전국동시지방선거',
    '2028-04-12': '국회의원선거',
  };
  const hcache = new Map();
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  /** year년 공휴일 → { 'YYYY-MM-DD': '이름' } */
  function holidaysOfYear(year) {
    if (hcache.has(year)) return hcache.get(year);
    const H = {};
    const put = (d, name) => { H[ymd(d)] = name; };
    const subst = []; // 대체공휴일 후보: {date, label, sundayOnly}

    [[1, 1, '신정', false], [3, 1, '삼일절', true], [5, 5, '어린이날', true], [6, 6, '현충일', false],
      [8, 15, '광복절', true], [10, 3, '개천절', true], [10, 9, '한글날', true], [12, 25, '성탄절', true]]
      .forEach(([m, d, name, sub]) => {
        const dt = new Date(year, m - 1, d);
        put(dt, name);
        if (sub) subst.push({ date: dt, label: name });
      });

    // 음력 명절: 해당 해의 모든 날을 훑어서 찾음
    const blocks = []; // 설날·추석 3일 연휴
    for (let dt = new Date(year, 0, 1); dt.getFullYear() === year; dt = addDays(dt, 1)) {
      const l = lunarOf(dt);
      if (!l || l.leap) continue;
      if (l.m === 1 && l.d === 1) {
        put(addDays(dt, -1), '설날 연휴'); put(dt, '설날'); put(addDays(dt, 1), '설날 연휴');
        blocks.push([addDays(dt, -1), dt, addDays(dt, 1)]);
      } else if (l.m === 4 && l.d === 8) {
        const clash = !!H[ymd(dt)]; // 어린이날 등과 겹치면 대체공휴일
        put(dt, clash ? H[ymd(dt)] + '·부처님오신날' : '부처님오신날');
        subst.push({ date: dt, label: '부처님오신날', force: clash });
      } else if (l.m === 8 && l.d === 15) {
        put(addDays(dt, -1), '추석 연휴'); put(dt, '추석'); put(addDays(dt, 1), '추석 연휴');
        blocks.push([addDays(dt, -1), dt, addDays(dt, 1)]);
      }
    }
    // 12월 말일에 걸친 설날 연휴(다음 해 설날 전날이 올해 말일인 경우는 없음) → 무시
    const isOff = (d) => d.getDay() === 0 || d.getDay() === 6 || !!H[ymd(d)];

    // 대체공휴일: 날짜 순서대로 처리
    const jobs = [];
    blocks.forEach((b) => {
      const overlap = b.some((d) => d.getDay() === 0) || b.some((d) => H[ymd(d)] && !/연휴$|^설날$|^추석$/.test(H[ymd(d)]));
      if (overlap) jobs.push({ after: b[2], label: b[1].getMonth() < 6 ? '설날' : '추석', t: +b[2] });
    });
    subst.forEach((s) => {
      if (s.force || s.date.getDay() === 0 || s.date.getDay() === 6) jobs.push({ after: s.date, label: s.label, t: +s.date });
    });
    jobs.sort((a, b) => a.t - b.t).forEach((j) => {
      let d = addDays(j.after, 1);
      for (let i = 0; i < 10 && isOff(d); i++) d = addDays(d, 1);
      put(d, `대체공휴일(${j.label})`);
    });

    Object.keys(EXTRA).forEach((k) => { if (k.startsWith(year + '-')) H[k] = EXTRA[k]; });
    hcache.set(year, H);
    return H;
  }
  const holidayOf = (date) => holidaysOfYear(date.getFullYear())[ymd(date)] || '';

  const api = { lunarOf, lunarLabel, termsOfYear, termOf, holidaysOfYear, holidayOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lunar = api;
})(typeof window !== 'undefined' ? window : globalThis);
