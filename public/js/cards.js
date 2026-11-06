/* 우체국 카드 디자인 — 종류마다 서로 다른 디자인 4가지
   편지: 편지지 · 항공우편 · 원고지 · 테이프 메모
   생일: 케이크 · 풍선 · 컨페티 · 가랜드
   기념일: 아치 · 리스 · 숫자 · 폴라로이드
   크리스마스: 라인 트리 · 솔방울 리스 · 눈 오는 밤 · 오너먼트
   연하장: 일출 · 복주머니 · 창살 문양 · 매화 */
(function () {
  'use strict';
  const { esc } = YT;

  const TYPES = {
    letter: { name: '편지', title: '마음을 전합니다', msg: '오늘은 꼭 전하고 싶었던 마음을 글로 남겨요. 함께한 순간들을 떠올리며, 고마움과 응원을 전합니다.', designs: ['편지지', '항공우편', '원고지', '테이프 메모'], max: 5000, tag: 'Letter' },
    birthday: { name: '생일카드', title: '생일을 축하해요', msg: '당신의 하루가 웃음과 사랑으로 가득하길 바라요. 언제나 건강하고 행복하세요.', designs: ['케이크', '풍선', '컨페티', '가랜드'], max: 1500, tag: 'Happy Birthday' },
    anniversary: { name: '기념일카드', title: '함께한 날들을 축하해요', msg: '처음 그날처럼, 앞으로의 날들도 다정하게 함께해요. 오늘을 기억하며 고마운 마음을 전합니다.', designs: ['아치', '리스', '숫자', '폴라로이드'], max: 1500, tag: 'Happy Anniversary' },
    christmas: { name: '크리스마스카드', title: '메리 크리스마스', msg: '함께여서 더 따뜻한 크리스마스. 사랑하는 사람들과 포근하고 행복한 연말 보내세요.', designs: ['라인 트리', '솔잎 리스', '눈 오는 밤', '오너먼트'], max: 1500, tag: 'Merry Christmas' },
    newyear: { name: '연하장', title: '새해 복 많이 받으세요', msg: '새해에는 바라는 일들이 차근차근 이루어지고, 건강과 웃음이 늘 함께하기를 바랍니다.', designs: ['일출', '복주머니', '창살 문양', '매화'], max: 1500, tag: 'Happy New Year' },
  };
  YT.CARD_TYPES = TYPES;
  YT.CARD_COLORS = { ivory: '아이보리', rose: '블러시', sage: '세이지', midnight: '미드나잇' };

  // ── 결정적 난수 (같은 카드는 항상 같은 모양)
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; };
  const seedOf = (str) => [...String(str)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;
  const f = (n) => Math.round(n * 10) / 10;

  // ── 선 그림 모음
  const ART = {
    sprig: svg('0 0 120 120', '<path d="M60 108V34"/><path d="M60 50c-10-2-18-10-20-22 12 1 19 9 20 22zM60 50c10-2 18-10 20-22-12 1-19 9-20 22zM60 72c-12-2-21-11-23-25 14 1 22 11 23 25zM60 72c12-2 21-11 23-25-14 1-22 11-23 25zM60 94c-13-2-23-12-25-27 15 1 24 12 25 27zM60 94c13-2 23-12 25-27-15 1-24 12-25 27z"/>'),
    cake: svg('0 0 160 130', `<path d="M20 122h120"/><rect x="30" y="86" width="100" height="36" rx="3"/><rect x="44" y="56" width="72" height="30" rx="3"/>
      <path d="M30 98c8 7 17 7 25 0s17-7 25 0 17 7 25 0 17-7 25 0M44 66c6 6 12 6 18 0s12-6 18 0 12 6 18 0 12-6 18 0"/>
      <path d="M62 56V40M80 56V36M98 56V40"/><path d="M62 30c-3 3-3 7 0 9 3-2 3-6 0-9zM80 26c-3 3-3 7 0 9 3-2 3-6 0-9zM98 30c-3 3-3 7 0 9 3-2 3-6 0-9z" class="fill-acc"/>`),
    rings: svg('0 0 120 120', '<circle cx="48" cy="70" r="22"/><circle cx="72" cy="70" r="22"/><path d="M66 38l6-10 6 10-6 6z"/>'),
    tree: svg('0 0 120 140', '<path d="M60 18v108"/><path d="M60 38l-14-8M60 38l14-8M60 56l-20-11M60 56l20-11M60 74l-26-14M60 74l26-14M60 92l-32-17M60 92l32-17M60 110l-38-19M60 110l38-19"/><path d="M60 6l2.6 5.2 5.7.8-4.1 4 1 5.6-5.2-2.7-5.2 2.7 1-5.6-4.1-4 5.7-.8z" class="fill-acc"/><path d="M52 126h16"/>'),
    pouch: svg('0 0 120 130', `<path d="M30 60C18 74 14 94 22 108c8 13 68 13 76 0 8-14 4-34-8-48z" class="pouch-body"/><rect x="38" y="50" width="44" height="11" rx="3" class="pouch-neck"/>
      <path d="M40 50c-3-12 6-20 11-14 3-9 15-9 18 0 5-6 14 2 11 14"/><path d="M60 55c-10-9-21-5-17 3s13 3 17-3zM60 55c10-9 21-5 17 3s-13 3-17-3zM58 58l-7 16M62 58l7 16"/>
      <circle cx="60" cy="90" r="15" class="pouch-em"/><text x="60" y="96" text-anchor="middle" class="pouch-txt">福</text>`),
  };

  function leafWreath(n = 26, r = 38) {
    let b = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const x = 60 + Math.cos(a) * r, y = 60 + Math.sin(a) * r; const deg = (a * 180) / Math.PI + (i % 2 ? 30 : -30);
      b += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3.2" ry="8" transform="rotate(${f(deg)} ${f(x)} ${f(y)})" class="${i % 3 === 0 ? 'fill-soft' : ''}"/>`;
    }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; b += `<circle cx="${f(60 + Math.cos(a) * (r + 1))}" cy="${f(60 + Math.sin(a) * (r + 1))}" r="2.6" class="fill-acc"/>`; }
    return svg('0 0 120 120', `<circle cx="60" cy="60" r="${r}" stroke-width=".8"/>${b}`, 'wreath');
  }
  function pineWreath() {
    let b = '';
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2; const r1 = 34 + (i % 3) * 2, r2 = r1 + 9;
      const da = (i % 2 ? 0.18 : -0.18);
      b += `<path d="M${f(60 + Math.cos(a) * r1)} ${f(60 + Math.sin(a) * r1)}L${f(60 + Math.cos(a + da) * r2)} ${f(60 + Math.sin(a + da) * r2)}"/>`;
    }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; b += `<circle cx="${f(60 + Math.cos(a) * 42)}" cy="${f(60 + Math.sin(a) * 42)}" r="2.8" class="fill-acc"/>`; }
    b += '<path d="M60 100c-8-6-18-6-18 0s10 6 18 0zM60 100c8-6 18-6 18 0s-10 6-18 0zM58 102l-8 14M62 102l8 14" class="bow"/>';
    return svg('0 0 120 120', b, 'wreath');
  }
  function plumBranch() {
    const blossom = (x, y, r) => { let p = ''; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; p += `<circle cx="${f(x + Math.cos(a) * r)}" cy="${f(y + Math.sin(a) * r)}" r="${f(r * 0.72)}" class="fill-soft"/>`; } return p + `<circle cx="${x}" cy="${y}" r="${f(r * 0.35)}" class="fill-acc"/>`; };
    return svg('0 0 200 140', `<path d="M196 18c-30 6-58 20-80 42s-48 40-96 58" stroke-width="2.4"/><path d="M130 48c4-14 14-24 26-30M98 74c-10-8-14-18-14-30M62 96c4 10 4 20 0 30" stroke-width="1.6"/>
      ${blossom(150, 22, 6)}${blossom(116, 52, 7)}${blossom(84, 42, 5)}${blossom(70, 86, 6.5)}${blossom(40, 102, 5)}${blossom(160, 36, 4)}<circle cx="102" cy="64" r="2.4" class="fill-acc"/><circle cx="58" cy="118" r="2.2" class="fill-acc"/>`, 'plum');
  }
  function balloons(seed) {
    const R = rng(seed); const cols = ['fill-acc', 'fill-soft2', 'fill-soft', 'fill-acc', 'fill-soft2'];
    let b = '';
    const xs = [38, 70, 102, 134, 166];
    xs.forEach((x, i) => {
      const y = 46 + (i % 2 ? 18 : 0) + R() * 10; const rx = 17 + R() * 3, ry = rx * 1.22;
      b += `<path d="M${f(x)} ${f(y + ry)}c${f(-6 + R() * 12)} 20 ${f(8 - R() * 16)} 36 ${f(-4 + R() * 8)} ${f(110 - y - ry)}" stroke-width=".9"/>`;
      b += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" class="${cols[i]}"/><path d="M${f(x - 3)} ${f(y + ry + 3)}h6l-3-4z" class="fill-acc"/>`;
      b += `<path d="M${f(x - rx * 0.45)} ${f(y - ry * 0.35)}c2-6 6-9 10-10" stroke="#fff" stroke-opacity=".7"/>`;
    });
    return svg('0 0 204 160', b, 'balloons');
  }
  function garland() {
    let b = '<path d="M-4 18C40 46 80 52 102 52s62-6 106-34" stroke-width="1"/>';
    const pts = [[10, 26], [30, 37], [52, 45], [76, 50], [102, 52], [128, 50], [152, 45], [174, 37], [194, 26]];
    pts.forEach(([x, y], i) => { b += `<path d="M${x - 9} ${y - 3}L${x + 9} ${y + 1}L${x + 1} ${y + 22}z" class="${['fill-acc', 'fill-soft2', 'fill-soft'][i % 3]}"/>`; });
    return svg('0 0 204 80', b, 'garland');
  }
  function ornaments(seed) {
    const R = rng(seed); let b = '';
    [[24, 40], [58, 70], [96, 52], [134, 84], [170, 46]].forEach(([x, len], i) => {
      const r = 11 + R() * 5;
      b += `<path d="M${x} 0V${len}" stroke-width=".9"/><rect x="${x - 4}" y="${len}" width="8" height="5" rx="1" class="fill-acc"/>`;
      b += `<circle cx="${x}" cy="${f(len + 5 + r)}" r="${f(r)}" class="${['fill-acc', 'fill-soft2', 'fill-soft'][i % 3]}"/>`;
      b += i % 2 ? `<path d="M${f(x - r)} ${f(len + 5 + r)}h${f(r * 2)}" stroke-dasharray="2 2.5"/>` : `<path d="M${f(x - r * .7)} ${f(len + 5 + r * .6)}c${f(r * .5)} 4 ${f(r * .9)} 4 ${f(r * 1.4)} 0" />`;
    });
    return svg('0 0 196 130', b, 'ornaments');
  }
  function snowScene(seed) {
    const R = rng(seed); let flakes = '';
    for (let i = 0; i < 46; i++) flakes += `<circle cx="${f(R() * 200)}" cy="${f(R() * 150)}" r="${f(0.6 + R() * 1.6)}" class="snow"/>`;
    return svg('0 0 200 200', `<circle cx="150" cy="44" r="16" class="moon"/>${flakes}
      <path d="M0 160c40-20 70-22 100-12s70 6 100-10V200H0z" class="hill"/><path d="M0 176c50-14 90-10 120-2s56 6 80-2V200H0z" class="hill2"/>
      <path d="M58 150v-22l14-12 14 12v22zM68 150v-10h8v10" class="house"/><rect x="62" y="130" width="6" height="6" class="win"/>
      <path d="M128 156l8-24 8 24zM146 160l6-18 6 18z" class="pine"/>`, 'scene');
  }
  function sunrise() {
    return svg('0 0 200 120', `<circle cx="100" cy="78" r="30" class="sun"/><path d="M100 30v-12M66 44l-8-8M134 44l8-8M50 76H38M150 76h12" />
      <path d="M0 96c26-18 44-24 62-14s30 10 44-2 30-16 48-4 30 16 46 8" class="ridge"/><path d="M0 108c30-10 56-12 80-4s50 8 70 0 34-6 50 0" class="ridge2"/>
      <path d="M140 30q5-5 10 0q5-5 10 0M118 20q4-4 8 0q4-4 8 0" stroke-width=".9"/>`, 'sunrise');
  }
  function confettiBits(seed) {
    const R = rng(seed); let s = '';
    for (let i = 0; i < 34; i++) {
      const shape = ['dot', 'bar', 'tri'][i % 3]; const c = ['acc', 'soft2', 'ink'][Math.floor(R() * 3)];
      s += `<i class="cf ${shape} cf-${c}" style="left:${f(R() * 96)}%;top:${f(R() * 96)}%;transform:rotate(${Math.round(R() * 180)}deg)"></i>`;
    }
    return `<div class="ca-confetti" aria-hidden="true">${s}</div>`;
  }
  // 원고지: 글자를 칸마다 하나씩
  function manuscript(text, small) {
    const cols = 12, rows = small ? 8 : 15;
    const cells = []; const lines = String(text || '').replace(/\r/g, '').split('\n');
    for (const line of lines) {
      const chars = [' ', ...line]; // 문단 첫 칸 들여쓰기
      for (const ch of chars) cells.push(ch);
      while (cells.length % cols) cells.push('');
    }
    while (cells.length < cols * rows) cells.push('');
    const shown = cells.slice(0, cols * rows);
    return `<div class="ms-grid" style="--cols:${cols}">${shown.map((ch) => `<span>${ch === ' ' ? '' : esc(ch)}</span>`).join('')}</div>`;
  }

  const fmtDate = (d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return ''; const [y, m, dd] = d.split('-').map(Number); return `${y}. ${m}. ${dd}.`; };

  YT.renderCard = (c, opts = {}) => {
    const type = TYPES[c.type] ? c.type : 'letter'; const T = TYPES[type];
    const d = Math.min(3, Math.max(0, Number(c.design) || 0));
    const small = !!opts.small; const seed = seedOf((c.id || '') + type + d);
    const raw = String(c.message || '');
    const msg = small ? esc(raw.slice(0, 64)) + (raw.length > 64 ? '…' : '') : YT.nl2br(raw);
    const img = c.photo ? `<img src="${opts && opts.small ? YT.thumbUrl(c.photo) : YT.photoUrl(c.photo)}" alt="카드에 첨부한 사진" loading="lazy">` : '';
    const P = {
      tag: `<div class="ca-tag">${esc(T.tag)}</div>`,
      title: `<h3 class="ca-title">${esc(c.title || T.title)}</h3>`,
      to: `<div class="ca-to">${esc(c.to_name || '소중한 당신')}에게</div>`,
      msg: `<div class="ca-msg">${msg}</div>`,
      date: `<span class="ca-date">${esc(fmtDate(c.card_date))}</span>`,
      sign: `<b class="ca-sign">${esc(c.from_name || '우리 가족')} 드림</b>`,
    };
    P.from = `<div class="ca-from">${P.date}${P.sign}</div>`;
    const key = `${type}-${d}`;
    const wrap = (inner, extra = '') => `<div class="card-art k-${key} c-${esc(c.color || 'ivory')} ${small ? 'small' : ''} ${extra}">${inner}</div>`;
    const photoOr = (fallback, cls = 'ca-photo') => (img ? `<div class="${cls}">${img}</div>` : fallback);

    switch (key) {
      // ── 편지
      case 'letter-0': return wrap(`<div class="ca-in">
          <div class="ca-head">${P.title}${P.date}</div>${P.to}${P.msg}${img ? `<div class="ca-photo pola">${img}</div>` : ''}
          <div class="ca-from">${P.sign}</div></div><div class="ca-seal" aria-hidden="true"><span>${esc((c.from_name || '유').slice(0, 1))}</span></div>`, 'lined');
      case 'letter-1': return wrap(`<div class="air-edge" aria-hidden="true"></div><div class="ca-in">
          <div class="air-top"><span class="air-label">항공우편 · Par Avion</span>${photoOr(`<div class="air-stamp">${ART.sprig}</div>`, 'air-stamp photo')}</div>
          ${P.to}${P.msg}${P.from}</div>`);
      case 'letter-2': return wrap(`<div class="ca-in">
          <div class="ms-head">${P.title}<span>${esc(c.from_name || '')}</span></div>${manuscript(raw, small)}
          <div class="ms-foot">${P.to.replace('ca-to', 'ca-to inline')}${P.date}</div></div>`);
      case 'letter-3': return wrap(`<div class="memo">
          <i class="tape t1" aria-hidden="true"></i><i class="tape t2" aria-hidden="true"></i>
          ${P.to}${P.msg}${img ? `<div class="ca-photo memo-photo">${img}</div>` : ''}${P.from}</div>`, 'cork');

      // ── 생일
      case 'birthday-0': return wrap(`<div class="ca-in center">
          <div class="art-cake">${ART.cake}</div>${P.tag}${P.title}<i class="ca-rule"></i>${img ? `<div class="ca-photo circle">${img}</div>` : ''}${P.to}${P.msg}${P.from}</div>`, 'sprinkle');
      case 'birthday-1': return wrap(`<div class="art-balloons">${balloons(seed)}</div><div class="ca-in bottom">
          ${P.tag}${P.title}${P.to}${P.msg}${P.from}</div>`);
      case 'birthday-2': return wrap(`${confettiBits(seed)}<div class="ca-in">
          <div class="bd-big"><span>Happy</span><span>Birthday</span></div>${photoOr('', 'ca-photo strip')}${P.title.replace('ca-title', 'ca-title sm')}${P.to}${P.msg}${P.from}</div>`);
      case 'birthday-3': return wrap(`<div class="art-garland">${garland()}</div><div class="ca-in center pad-top">
          ${P.tag}${P.title}${photoOr('', 'ca-photo frame')}${P.to}${P.msg}${P.from}</div>`);

      // ── 기념일
      case 'anniversary-0': return wrap(`<div class="ca-in">
          <div class="ca-arch">${img || `<div class="ca-orn">${ART.rings}</div>`}</div>
          <div class="ca-body">${P.tag}${P.title}${P.to}${P.msg}${P.from}</div></div>`);
      case 'anniversary-1': return wrap(`<div class="ca-in center">
          <div class="wreath-wrap">${leafWreath()}<div class="wreath-in">${img ? `<div class="ca-photo circle">${img}</div>` : `<span class="wr-amp">&amp;</span>`}</div></div>
          ${P.tag}${P.title}${P.to}${P.msg}${P.from}</div>`);
      case 'anniversary-2': {
        const dd = /^\d{4}-(\d{2})-(\d{2})$/.exec(c.card_date || '');
        const big = dd ? `${dd[1]}.${dd[2]}` : '♡';
        return wrap(`<div class="ca-in">
          <div class="an-num" aria-hidden="true">${esc(big)}</div>${P.tag}${P.title}${photoOr('', 'ca-photo strip')}${P.to}${P.msg}${P.from}</div>`);
      }
      case 'anniversary-3': return wrap(`<div class="ca-in center">
          <div class="pola-big"><i class="tape t1" aria-hidden="true"></i><div class="pola-img">${img || `<div class="ca-orn">${ART.rings}</div>`}</div><span>${esc(fmtDate(c.card_date) || '우리의 날')}</span></div>
          ${P.title}${P.to}${P.msg}<div class="ca-from">${P.sign}</div></div>`);

      // ── 크리스마스
      case 'christmas-0': return wrap(`<div class="ca-in center">
          <div class="art-tree">${ART.tree}</div>${P.tag}${P.title}${img ? `<div class="ca-photo circle">${img}</div>` : ''}${P.to}${P.msg}${P.from}</div>`, 'snowdots');
      case 'christmas-1': return wrap(`<div class="ca-in center">
          <div class="wreath-wrap pine">${pineWreath()}<div class="wreath-in">${img ? `<div class="ca-photo circle">${img}</div>` : `<span class="wr-year">${esc((c.card_date || '').slice(0, 4) || 'Noel')}</span>`}</div></div>
          ${P.tag}${P.title}${P.to}${P.msg}${P.from}</div>`);
      case 'christmas-2': return wrap(`<div class="art-scene">${snowScene(seed)}</div><div class="ca-in bottom night">
          ${P.tag}${P.title}${P.to}${P.msg}${P.from}</div>`, 'nightsky');
      case 'christmas-3': return wrap(`<div class="art-orn">${ornaments(seed)}</div><div class="ca-in pad-top">
          ${P.tag}${P.title}${photoOr('', 'ca-photo strip')}${P.to}${P.msg}${P.from}</div>`);

      // ── 연하장
      case 'newyear-0': return wrap(`<div class="art-sun">${sunrise()}</div><div class="ca-in bottom">
          ${P.tag}${P.title}${P.to}${P.msg}${P.from}</div>`);
      case 'newyear-1': return wrap(`<div class="ca-in center">
          <div class="art-pouch">${ART.pouch}</div>${P.title}${img ? `<div class="ca-photo circle">${img}</div>` : ''}${P.to}${P.msg}${P.from}</div>`, 'dancheong');
      case 'newyear-2': return wrap(`<div class="lattice" aria-hidden="true"></div><div class="ca-in lattice-in">
          ${P.tag}${P.title}${photoOr('', 'ca-photo strip')}${P.to}${P.msg}${P.from}</div>`);
      default: return wrap(`<div class="art-plum">${plumBranch()}</div><div class="ca-in">
          <div class="vert-title" aria-hidden="true">${esc((c.title || T.title).replace(/\s+/g, '').slice(0, 10))}</div>
          <div class="plum-body">${P.tag}${P.to}${P.msg}${P.from}</div></div>`, 'ink');
    }
  };
})();
