/* HAGISIRO — 출결 문장 파서 (규칙 기반, 오프라인 동작)
 * "홍길동 11월 2일 감기로 조퇴(2교시)" → 질병조퇴, 2교시~종례, 사유 '감기'
 *
 * 종류 17가지 = 출석 + (질병·미인정·기타·출석인정) × (결석·지각·조퇴·결과)
 * 시간 범위는 칸 번호로 저장: 0=조회, 1~9=교시, 99=종례
 */
(function (root) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const CATS = ['질병', '미인정', '기타', '출석인정'];
  const TYPES = ['결석', '지각', '조퇴', '결과'];
  const KINDS = [];
  CATS.forEach((c) => TYPES.forEach((t) => KINDS.push({ label: c + t, cat: c, type: t })));
  const END = 99; // 종례

  /* ---------- 사유 분류 ---------- */
  const RE_OK = /생리|월경|멘스|경조사|체험학습|체험|가족\s*여행|여행|캠핑|견학|답사|봉사|가족\s*행사|공결|출석\s*인정|대회|경진|공연|면접|시험|훈련|학교장|조문|결혼|장례|상중|부친상|모친상|부모상|조부모상|조부상|조모상|외조부모?상|외조모상|증조부모?상|형제상|자매상|형제자매상|친척상|(?:할머니|할아버지)\s*상|상을\s*당|사망|별세|돌아가|임종|부고|초상|발인|문상|상가|빈소|예방접종|법정감염병/;
  const RE_SICK = /감기|열|아파|아픔|아프|병원|진료|두통|복통|배탈|몸살|독감|코로나|치과|통증|구토|다쳐|다침|부상|수술|입원|치료|증상|컨디션|질병|알레르기|어지|편두통|장염|병결|[가-힣]{1,4}과\s*(?:진료|치료|검사|방문|예약|내원|병원|가|감|다녀|갔|간)|정형|내과|외과|이비인후|안과|피부과|소아과|비뇨|산부인|신경과|재활|한의|의원|응급|약국|처방|물리치료|깁스|골절|염좌|접질|삐었|삐끗|인대|디스크|허리|요통|관절|치통|사랑니|발치|엑스레이|x-?ray|mri|ct\s*촬영|초음파|주사|링거|수액|병가|발열|고열|오한|기침|콧물|비염|축농증|중이염|결막염|눈병|수족구|감염|염증|편도|인후|두드러기|피부염|아토피|위염|설사|체했|체함|소화|속쓰림|멀미|현기증|빈혈|쓰러|기절|검진|건강\s*검사/i;
  const RE_NO = /무단|미인정|늦잠|땡땡이|가출|무통보|게임|놀러/;

  function classify(reason, forced) {
    if (forced) return forced;
    const r = reason || '';
    if (!r.trim()) return '미인정'; // 사유가 없으면 미인정
    if (/^미인정$|무단/.test(r)) return '미인정';
    if (/^질병$/.test(r)) return '질병';
    if (/^인정$|^출석인정$/.test(r)) return '출석인정';
    if (/^기타$/.test(r)) return '기타';
    if (RE_OK.test(r)) return '출석인정'; // 생리·월경은 질병보다 먼저 확인
    if (RE_SICK.test(r)) return '질병';
    if (RE_NO.test(r)) return '미인정';
    return '기타';
  }

  /* ---------- 종류별 기본 시간 범위 ---------- */
  // p/q: 글에서 읽은 교시 숫자(없으면 null), last: 그날 마지막 교시
  function defaultRange(type, p, q, last) {
    switch (type) {
      case '결석': return [0, END];
      case '지각': return [0, q != null ? q : (p != null ? p : 0)];      // N교시까지 → 조회~N교시
      case '조퇴': return [p != null ? p : END, END];                     // N교시 → N교시~종례
      default: // 결과
        if (p == null) return [1, last || 7];
        return [p, q != null ? q : p];
    }
  }

  const slotName = (x) => (x === 0 ? '조회' : x >= END ? '종례' : x + '교시');
  function rangeLabel(from, to) {
    if (from === 0 && to >= END) return '종일';
    return from === to ? slotName(from) : slotName(from) + '~' + slotName(to);
  }

  /* ---------- 날짜 ---------- */
  function resolveMD(today, mo, da) {
    const y = today.getFullYear();
    let d = new Date(y, mo - 1, da);
    if (d.getMonth() !== mo - 1) return null;
    if ((d - today) / 864e5 > 180) d = new Date(y - 1, mo - 1, da);
    return d;
  }

  function expandRange(a, b) {
    const out = [];
    if (b < a) return [a];
    let d = new Date(a);
    for (let i = 0; i < 62 && d <= b; i++) {
      const w = d.getDay();
      if (w !== 0 && w !== 6) out.push(new Date(d));
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return out.length ? out : [a];
  }

  /* ---------- 메인 ---------- */
  /**
   * opt.students : [{id, no, name, classId}] (현재 학급 학생을 앞에)
   * opt.classId  : 현재 학급 id (번호로 찾을 때 사용)
   * opt.today    : 오늘(Date)
   * opt.base     : 날짜가 안 쓰였을 때 쓸 기본 날짜(Date)
   * opt.lastOf   : (YYYY-MM-DD) → 그날 마지막 교시 수
   */
  function parse(text, opt) {
    opt = opt || {};
    const today = dayStart(opt.today || new Date());
    const base = dayStart(opt.base || today);
    const lastOf = opt.lastOf || (() => 7);
    const res = { items: [], errors: [], dateGuessed: false };
    let t = ' ' + String(text || '').replace(/\s+/g, ' ').trim() + ' ';
    if (t.trim() === '') { res.errors.push('empty'); return res; }

    const take = (re) => {
      const m = re.exec(t);
      if (!m) return null;
      t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length);
      return m;
    };

    /* 1) 학생 찾기 — 이름(긴 이름 우선) → 번호 */
    const pool = (opt.students || []).slice().sort((a, b) => b.name.length - a.name.length);
    const found = [];
    for (const s of pool) {
      let from = 0;
      for (;;) {
        const idx = t.indexOf(s.name, from);
        if (idx < 0) break;
        const prev = t[idx - 1];
        if (!prev || !/[가-힣]/.test(prev)) {
          if (!found.includes(s)) found.push(s);
          t = t.slice(0, idx) + ' '.repeat(s.name.length) + t.slice(idx + s.name.length);
          break;
        }
        from = idx + 1;
      }
    }
    const numRe = /(?<![\d.])(\d{1,2})\s*번(?=[이가은는도을를\s,]|$)/g;
    let nm;
    while ((nm = numRe.exec(t))) {
      const no = +nm[1];
      const s = pool.find((x) => x.classId === opt.classId && +x.no === no);
      if (s && !found.includes(s)) {
        found.push(s);
        t = t.slice(0, nm.index) + ' '.repeat(nm[0].length) + t.slice(nm.index + nm[0].length);
        numRe.lastIndex = 0;
      }
    }

    /* 2) 날짜 */
    let dates = [];
    let m;
    if ((m = take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:~|∼|-|–|부터)\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일(?:\s*까지)?/))) {
      const a = resolveMD(today, +m[1], +m[2]);
      const b = resolveMD(today, m[3] ? +m[3] : +m[1], +m[4]);
      if (a && b) dates = expandRange(a, b);
    } else if ((m = take(/(?<![\d.])(\d{1,2})\s*[./]\s*(\d{1,2})\s*(?:~|∼|-|–)\s*(?:(\d{1,2})\s*[./]\s*)?(\d{1,2})(?![\d]|\s*교시)/))) {
      const a = resolveMD(today, +m[1], +m[2]);
      const b = resolveMD(today, m[3] ? +m[3] : +m[1], +m[4]);
      if (a && b) dates = expandRange(a, b);
    } else if ((m = take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) {
      const d = resolveMD(today, +m[1], +m[2]);
      if (d) dates = [d];
    } else if ((m = take(/(?<![\d.])(\d{1,2})\s*[./]\s*(\d{1,2})(?![\d.]|\s*교시)/))) {
      const d = resolveMD(today, +m[1], +m[2]);
      if (d) dates = [d];
    } else if ((m = take(/(?<![\d월])(\d{1,2})\s*일(?!\s*간|\s*째)/))) {
      const d = new Date(base.getFullYear(), base.getMonth(), +m[1]);
      if (d.getMonth() === base.getMonth()) dates = [d];
    } else if ((m = take(/그\s*저께|엊그제|그제/))) {
      dates = [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)];
    } else if ((m = take(/어제/))) {
      dates = [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)];
    } else if ((m = take(/오늘/))) {
      dates = [today];
    } else if ((m = take(/모레/))) {
      dates = [new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)];
    } else if ((m = take(/내일/))) {
      dates = [new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)];
    } else if ((m = take(/(?:(지난|저번|이번)\s*(?:주)?\s*)?([일월화수목금토])요일/))) {
      const want = DOW.indexOf(m[2]);
      let back = (today.getDay() - want + 7) % 7;
      if (back === 0 && (m[1] === '지난' || m[1] === '저번')) back = 7;
      dates = [new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)];
    }
    if (!dates.length) { dates = [base]; res.dateGuessed = true; }

    /* 3) 종류 (결석/지각/조퇴/결과) + 사유구분 */
    let type = null;
    let forcedCat = null;
    let impliedReason = null; // 줄임말이 뜻하는 사유 (생결 → 생리)
    let arrive = null; // "N교시 등교" → 조회~(N-1)교시 지각
    if (/출석\s*인정/.test(t)) { forcedCat = '출석인정'; t = t.replace(/출석\s*인정/g, ' '); }
    const em = /조퇴|지각|결과|결석|병결|생결/.exec(t);
    if (em) {
      type = { 조퇴: '조퇴', 지각: '지각', 결과: '결과', 결석: '결석', 병결: '결석', 생결: '결석' }[em[0]];
      if (em[0] === '병결') forcedCat = forcedCat || '질병';
      if (em[0] === '생결') { forcedCat = forcedCat || '출석인정'; impliedReason = '생리'; } // 생리결석(출석인정결석)
      let cut = em.index;
      const pre = /(질병|미인정|기타)\s*$/.exec(t.slice(0, em.index)); // '기타결석', '질병 조퇴' 처럼 붙은 사유구분
      if (pre) { forcedCat = forcedCat || pre[1]; cut = pre.index; }
      t = t.slice(0, cut) + ' '.repeat(em.index + em[0].length - cut) + t.slice(em.index + em[0].length);
    }
    if (!type || type === '지각') {
      const am = /(\d)\s*교시\s*(?:에|부터)?\s*(?:등교|도착|입실|참석|왔|옴|출석)\S*/.exec(t);
      if (am) {
        arrive = +am[1]; type = '지각';
        t = t.slice(0, am.index) + ' '.repeat(am[0].length) + t.slice(am.index + am[0].length);
      }
    }
    if (!type) {
      if (/일찍\s*(?:가|갔|감|귀가|하교)|하교/.test(t)) {
        type = '조퇴';
        t = t.replace(/일찍\s*(?:가|갔|감|귀가|하교)\S*|하교\S*/g, ' ');
      } else if (/늦(?:게|음|었|잠)/.test(t)) {
        type = '지각';
        t = t.replace(/늦(?:게|음|었)\S*/g, ' '); // '늦잠'은 사유로 남김
      } else if (/안\s*(?:옴|왔|와)|불참|못\s*(?:옴|왔)|오지\s*않/.test(t)) {
        type = '결석';
        t = t.replace(/(?:안|못)\s*(?:옴|왔|와)\S*|불참\S*|오지\s*않\S*/g, ' ');
      }
    }

    /* 4) 교시 숫자 */
    const nums = [];
    let after = false;
    t = t.replace(/(\d)\s*(?:~|∼|-|–)\s*(\d)\s*교시\s*(?:부터|까지|후에?|이후|마치고|끝나고|전|이전)?/g, (_, a, b) => { nums.push(+a, +b); return ' '; });
    t = t.replace(/(\d)\s*교시\s*(부터|까지|후에?|이후|마치고|끝나고|전|이전)?/g, (_, a, q) => {
      nums.push(+a);
      if (q && /^(후|후에|이후|마치고|끝나고)$/.test(q)) after = true;
      return ' ';
    });
    let p = null, q = null;
    if (nums.length) {
      p = Math.min(...nums);
      const mx = Math.max(...nums);
      if (mx !== p) q = mx;
      if (after) { p += 1; if (q != null) q += 1; }
    }
    if (arrive != null) { p = Math.max(0, arrive - 1); q = null; }
    if (!type && p != null) type = '결과';

    /* 5) 사유 */
    const stop = /^(?:이|가|은|는|도|을|를|에|의|께서|학생|님|으로|로|때문에|사유|사유는|사유로|사유:|왔어요|왔음|왔습니다|왔어|옴|했어요|했음|함|했습니다|갔어요|갔음|감|입니다|이에요|예요)$/;
    let reason = t
      .replace(/[(){}\[\],.:;·~]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !stop.test(w))
      .join(' ')
      .replace(/(?:으로\s*인해서?|로\s*인해서?|으로\s*인한|로\s*인한|때문에|으로|로)$/, '')
      .trim();
    if (!reason && impliedReason) reason = impliedReason;
    if (/^(질병|미인정|인정|기타)$/.test(reason)) { forcedCat = forcedCat || (reason === '인정' ? '출석인정' : reason); reason = ''; }
    const cat = classify(reason, forcedCat);

    /* 6) 검증 */
    res.info = { type: !!type, period: p != null, reason: !!reason, date: !res.dateGuessed }; // 화면 안내용: 무엇을 입력했는지
    if (!found.length) res.errors.push('student');
    if (!type) res.errors.push('type');
    if (res.errors.length) return res;

    for (const s of found) {
      for (const d of dates) {
        const ds = ymd(d);
        const [from, to] = defaultRange(type, p, q, lastOf(ds));
        res.items.push({ classId: s.classId, studentId: s.id, name: s.name, no: s.no, date: ds, type, cat, from, to, reason });
        if (res.items.length >= 120) return res;
      }
    }
    return res;
  }

  const api = { parse, classify, defaultRange, rangeLabel, slotName, ymd, DOW, CATS, TYPES, KINDS, END };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== 'undefined' ? window : globalThis);
