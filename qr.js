/* 아주 작은 QR 코드 생성기 (바이트 모드 · 오류정정 M · 버전 1~10) — makeQR(text) → 2차원 배열(true=검은 칸) */
(function () {
  const EC = [null, [10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27], [18, 4, 31], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  const AL = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const rs = (data, n) => {
    let g = [1];
    for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, EXP[i]); }); g = ng; }
    const r = data.concat(new Array(n).fill(0));
    for (let i = 0; i < data.length; i++) { const c = r[i]; if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c); }
    return r.slice(data.length);
  };
  const bch = (d) => { let n = 0; while (d >> n) n++; return n; };
  const fmtBits = (v) => { let d = v << 10; while (bch(d) - bch(0x537) >= 0) d ^= 0x537 << (bch(d) - bch(0x537)); return ((v << 10) | d) ^ 0x5412; };
  const verBits = (v) => { let d = v << 12; while (bch(d) - bch(0x1f25) >= 0) d ^= 0x1f25 << (bch(d) - bch(0x1f25)); return (v << 12) | d; };
  const MASK = [(i, j) => (i + j) % 2 === 0, (i) => i % 2 === 0, (i, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0, (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0];
  const penalty = (m, n) => {
    let p = 0;
    for (let k = 0; k < 2; k++) for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        const cur = k ? m[b][a] : m[a][b], prev = k ? m[b - 1][a] : m[a][b - 1];
        if (cur === prev) { run++; if (b === n - 1 && run >= 5) p += run - 2; } else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const c = m[i][j]; if (c === m[i + 1][j] && c === m[i][j + 1] && c === m[i + 1][j + 1]) p += 3; }
    const pat = [1, 0, 1, 1, 1, 0, 1], at = (r, c, k) => (k ? m[c][r] : m[r][c]);
    for (let k = 0; k < 2; k++) for (let a = 0; a < n; a++) for (let b = 0; b <= n - 11; b++) {
      let ok1 = true, ok2 = true;
      for (let t = 0; t < 7; t++) { if ((at(a, b + t, k) ? 1 : 0) !== pat[t]) ok1 = false; if ((at(a, b + 4 + t, k) ? 1 : 0) !== pat[t]) ok2 = false; }
      for (let t = 7; t < 11 && (ok1 || ok2); t++) { if (ok1 && at(a, b + t, k)) ok1 = false; if (ok2 && at(a, b + t - 7, k)) ok2 = false; }
      if (ok1) p += 40; if (ok2) p += 40;
    }
    let dark = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (m[i][j]) dark++;
    return p + Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  };
  window.makeQR = function (text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = 1;
    for (; v <= 10; v++) { const e = EC[v], cap = e[1] * e[2] + (e[3] || 0) * (e[4] || 0); if (bytes.length + 2 + (v > 9 ? 1 : 0) <= cap) break; }
    if (v > 10) return null;
    const e = EC[v], blocksSpec = [];
    for (let k = 1; k < e.length; k += 2) for (let c = 0; c < e[k]; c++) blocksSpec.push(e[k + 1]);
    const total = blocksSpec.reduce((a, b) => a + b, 0);
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(4, 4); put(bytes.length, v > 9 ? 16 : 8); bytes.forEach((b) => put(b, 8));
    for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
    for (let pad = 0; cw.length < total; pad++) cw.push(pad % 2 ? 0x11 : 0xec);
    const dat = [], ecs = []; let pos = 0;
    blocksSpec.forEach((len) => { const d = cw.slice(pos, pos + len); pos += len; dat.push(d); ecs.push(rs(d, e[0])); });
    const out = [], maxd = Math.max(...blocksSpec);
    for (let i = 0; i < maxd; i++) dat.forEach((d) => { if (i < d.length) out.push(d[i]); });
    for (let i = 0; i < e[0]; i++) ecs.forEach((d) => out.push(d[i]));
    const n = 17 + 4 * v;
    const base = Array.from({ length: n }, () => new Array(n).fill(null));
    const set = (r, c, val) => { if (r >= 0 && c >= 0 && r < n && c < n) base[r][c] = val; };
    const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) set(r + i, c + j, i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4))); };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    const al = AL[v];
    al.forEach((r) => al.forEach((c) => { if (base[r][c] !== null) return; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) base[r + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1; }));
    for (let i = 8; i < n - 8; i++) { if (base[6][i] === null) base[6][i] = i % 2 === 0; if (base[i][6] === null) base[i][6] = i % 2 === 0; }
    const fn = base.map((row) => row.map((x) => x !== null));
    for (let i = 0; i < 9; i++) { fn[8][i] = true; fn[i][8] = true; }
    for (let i = 0; i < 8; i++) { fn[8][n - 1 - i] = true; fn[n - 1 - i][8] = true; }
    if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { fn[i][n - 11 + j] = true; fn[n - 11 + j][i] = true; }
    const build = (mask) => {
      const m = base.map((r) => r.slice());
      let inc = -1, row = n - 1, bi = 7, by = 0;
      for (let col = n - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (;;) {
          for (let c = 0; c < 2; c++) if (!fn[row][col - c]) {
            let d = by < out.length ? ((out[by] >>> bi) & 1) === 1 : false;
            if (MASK[mask](row, col - c)) d = !d;
            m[row][col - c] = d; if (--bi < 0) { by++; bi = 7; }
          }
          row += inc; if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
        }
      }
      const f = fmtBits((0 << 3) | mask);
      for (let i = 0; i < 15; i++) {
        const b = ((f >> i) & 1) === 1;
        m[i < 6 ? i : i < 8 ? i + 1 : n - 15 + i][8] = b;
        m[8][i < 8 ? n - i - 1 : i < 9 ? 7 : 15 - i - 1] = b;
      }
      m[n - 8][8] = true;
      if (v >= 7) { const vb = verBits(v); for (let i = 0; i < 18; i++) { const b = ((vb >> i) & 1) === 1; m[Math.floor(i / 3)][(i % 3) + n - 11] = b; m[(i % 3) + n - 11][Math.floor(i / 3)] = b; } }
      return m;
    };
    let best = null, bp = Infinity;
    for (let k = 0; k < 8; k++) { const m = build(k), p = penalty(m, n); if (p < bp) { bp = p; best = m; } }
    return best;
  };
})();
