/* 오락실 — 로또복권 · 즉석복권 · 사다리게임 (복권은 원고료 포인트로) */
(function () {
  'use strict';
  const { esc } = YT;
  const P = (n) => Number(n || 0).toLocaleString('ko-KR');
  const ballCls = (n) => (n <= 10 ? 'b1' : n <= 20 ? 'b2' : n <= 30 ? 'b3' : n <= 40 ? 'b4' : 'b5');
  const ball = (n, extra = '', i = 0) => `<span class="lt-ball ${ballCls(n)} ${extra}" style="--i:${i}">${n}</span>`;
  const RANK = ['낙첨', '1등', '2등', '3등', '4등', '5등'];
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const COLORS = ['#D1493F', '#2F6FBA', '#2F8F5B', '#C78A12', '#7A4FB8', '#C23B7A', '#11808C', '#6D4C41'];
  const two = (n) => String(n).padStart(2, '0');
  // 화면을 떠나면 멈추는 시계
  let tick = null;
  const startTick = (fn) => { clearInterval(tick); fn(); tick = setInterval(() => { if (!document.querySelector('[data-tick]')) { clearInterval(tick); return; } fn(); }, 1000); };
  const burst = (host, emoji = ['🎉', '✨', '🎊', '⭐']) => { // 당첨 축하 반짝이
    if (document.documentElement.classList.contains('reduce-motion')) return;
    const b = document.createElement('div'); b.className = 'g-burst'; b.setAttribute('aria-hidden', 'true');
    b.innerHTML = [...Array(18)].map((_, i) => `<i style="--x:${Math.round(Math.cos(i / 18 * 6.283) * (70 + Math.random() * 60))}px;--y:${Math.round(Math.sin(i / 18 * 6.283) * (60 + Math.random() * 50))}px;--d:${(Math.random() * .2).toFixed(2)}s">${emoji[i % emoji.length]}</i>`).join('');
    host.appendChild(b); setTimeout(() => b.remove(), 1600);
  };
  const balanceChip = (n, id = '') => `<div class="g-wallet"><span>내 포인트</span><b ${id ? `id="${id}"` : ''}>${P(n)}<small>P</small></b><a href="#/points">충전하려면 기사 쓰기 →</a></div>`;

  // ───────── 사다리게임 (이 기기에서만, 로그인 없이도) — ① 인원 고르기 ② 이름·결과 적기 ③ 사다리
  function ladder(box) {
    let st = store.get('yt_ladder', { players: ['아빠', '엄마', '윤서', '서윤'], results: ['설거지', '청소기', '빨래 개기', '통과!'] });
    let lad = null, done = {};
    let COLW = 92; const TOP = 10, H = 320, ROWS = 12;
    const PRESET = ['꽝', '통과!', '설거지', '청소기', '빨래 개기', '분리수거', '심부름', '간식 사기'];
    const resize = (n) => { // 인원에 맞춰 이름·결과 칸 늘리고 줄이기
      while (st.players.length < n) { st.players.push(''); st.results.push(PRESET[st.results.length % PRESET.length]); }
      st.players.length = n; st.results.length = n;
    };
    // ① ② 준비 화면
    const setup = () => {
      const n = st.players.length;
      box.innerHTML = `<div class="g-panel ld-setup">
        <div class="ld-step"><span class="ld-stepno">1</span><div><b>몇 명이 할까요?</b><small>2명부터 8명까지</small></div></div>
        <div class="ld-count" role="radiogroup" aria-label="인원">${[2, 3, 4, 5, 6, 7, 8].map((k) => `<button type="button" role="radio" class="${k === n ? 'on' : ''}" aria-checked="${k === n}" data-n="${k}">${k}<small>명</small></button>`).join('')}</div>
        <div class="ld-step"><span class="ld-stepno">2</span><div><b>이름과 결과를 적어요</b><small>결과는 사다리 아래에 섞여서 숨겨져요</small></div></div>
        <form id="ldForm" class="ld-form">
          <div class="ld-cols">${st.players.map((p, i) => `<div class="ld-pair" style="--c:${COLORS[i % COLORS.length]}"><span class="ld-no">${i + 1}</span>
            <input class="input" name="p${i}" value="${esc(p)}" maxlength="10" placeholder="${i + 1}번 이름" aria-label="${i + 1}번 이름" ${i === 0 ? 'autofocus' : ''}>
            <input class="input" name="r${i}" value="${esc(st.results[i] || '')}" maxlength="14" placeholder="결과" aria-label="${i + 1}번 결과"></div>`).join('')}</div>
          <div class="ld-quick"><span class="muted small">결과 빨리 채우기</span><button type="button" class="chip" data-fill="pass">한 명만 당첨</button><button type="button" class="chip" data-fill="chores">집안일 나누기</button><button type="button" class="chip" data-fill="order">순서 정하기</button></div>
          <button class="btn primary big wide">사다리 만들기 →</button></form></div>`;
      const read = () => { const f = new FormData(box.querySelector('#ldForm')); st.players = st.players.map((_, i) => String(f.get('p' + i) || '').trim()); st.results = st.results.map((_, i) => String(f.get('r' + i) || '').trim()); };
      box.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { read(); resize(+b.dataset.n); setup(); });
      box.querySelectorAll('[data-fill]').forEach((b) => b.onclick = () => {
        read(); const k = st.players.length;
        st.results = b.dataset.fill === 'pass' ? st.results.map((_, i) => (i === 0 ? '당첨!' : '꽝'))
          : b.dataset.fill === 'order' ? st.results.map((_, i) => `${i + 1}번째`)
          : st.results.map((_, i) => ['설거지', '청소기', '빨래 개기', '분리수거', '심부름', '통과!', '신발 정리', '화분 물주기'][i % 8]);
        if (b.dataset.fill === 'chores' && k <= 4) st.results[k - 1] = '통과!';
        setup();
      });
      box.querySelector('#ldForm').onsubmit = (e) => {
        e.preventDefault(); read();
        const empty = st.players.findIndex((p) => !p);
        if (empty >= 0) { YT.toast(`${empty + 1}번 이름을 적어 주세요.`, 'error'); box.querySelector(`[name=p${empty}]`).focus(); return; }
        st.results = st.results.map((r) => r || '꽝');
        store.set('yt_ladder', st); build(); draw();
      };
    };
    const build = () => {
      const n = st.players.length; const rungs = [];
      for (let row = 0; row < ROWS; row++) {
        let prev = -2;
        for (let g = 0; g < n - 1; g++) if (g !== prev + 1 && Math.random() < 0.42) { rungs.push({ g, row }); prev = g; }
      }
      for (let g = 0; g < n - 1; g++) if (!rungs.some((r) => r.g === g)) { const row = Math.floor(Math.random() * ROWS); if (!rungs.some((r) => r.row === row && Math.abs(r.g - g) === 1)) rungs.push({ g, row }); }
      lad = { rungs, results: st.results.slice().sort(() => Math.random() - 0.5) }; done = {};
    };
    const y = (row) => TOP + ((row + 1) * H) / (ROWS + 1);
    const pathOf = (start) => {
      let c = start; const pts = [[c, TOP]];
      for (let row = 0; row < ROWS; row++) {
        const r = lad.rungs.find((x) => x.row === row && (x.g === c || x.g === c - 1));
        if (r) { pts.push([c, y(row)]); c = r.g === c ? c + 1 : c - 1; pts.push([c, y(row)]); }
      }
      pts.push([c, TOP + H]); return { end: c, pts };
    };
    // ③ 사다리
    const draw = () => {
      const n = st.players.length;
      const avail = (box.clientWidth || 360) - 48; COLW = Math.max(56, Math.min(92, Math.floor(avail / n))); // 휴대폰에서도 가로로 넘치지 않게
      const W = COLW * n; const cx = (c) => COLW / 2 + c * COLW;
      const who = {}; Object.keys(done).forEach((s) => { who[pathOf(+s).end] = +s; });
      const paths = Object.keys(done).map((s) => { const p = pathOf(+s); const d = 'M' + p.pts.map(([c, yy]) => `${cx(c)} ${yy}`).join(' L'); return { s: +s, d, anim: done[s] === 'anim' }; });
      box.innerHTML = `<div class="g-panel ld-panel">
        <div class="ld-head"><div><b>누가 할까?</b><span>${n}명 · 이름을 누르면 사다리를 타고 내려가요</span></div><div class="row gap"><button class="btn small ghost" id="ldBack">← 다시 정하기</button><button class="btn small" id="ldNew">↻ 새 사다리</button><button class="btn small primary" id="ldAll">모두 공개</button></div></div>
        <div class="ld-wrap"><div class="ld-board" style="width:${W}px;--cw:${COLW}px">
          <div class="ld-row">${st.players.map((p, i) => `<button class="ld-top ${done[i] ? 'on' : ''}" data-go="${i}" style="--c:${COLORS[i % COLORS.length]}"><i>${i + 1}</i><span>${esc(p)}</span></button>`).join('')}</div>
          <svg class="ld-svg" viewBox="0 0 ${W} ${TOP * 2 + H}" width="${W}" role="img" aria-label="사다리">
            ${[...Array(n)].map((_, c) => `<line x1="${cx(c)}" y1="${TOP}" x2="${cx(c)}" y2="${TOP + H}" class="ld-pole"/>`).join('')}
            ${lad.rungs.map((r) => `<line x1="${cx(r.g)}" y1="${y(r.row)}" x2="${cx(r.g + 1)}" y2="${y(r.row)}" class="ld-pole"/>`).join('')}
            ${paths.map((p) => `<path d="${p.d}" class="ld-path ${p.anim ? 'anim' : ''}" style="stroke:${COLORS[p.s % COLORS.length]}"/>${p.anim ? `<circle r="8" class="ld-dot" fill="${COLORS[p.s % COLORS.length]}"><animateMotion dur="1.6s" fill="freeze" path="${p.d}" calcMode="paced"/></circle>` : ''}`).join('')}
          </svg>
          <div class="ld-row">${lad.results.map((r, i) => { const w = who[i]; return `<div class="ld-bot ${w != null ? 'open' : ''}" style="--c:${w != null ? COLORS[w % COLORS.length] : 'var(--line-2)'}">${w != null ? `<small>${esc(st.players[w])}</small><b>${esc(r)}</b>` : '<b class="q">?</b>'}</div>`; }).join('')}</div>
        </div></div>
        ${Object.keys(done).length ? `<ul class="ld-res">${Object.keys(done).map((s) => `<li style="--c:${COLORS[s % COLORS.length]}"><b>${esc(st.players[s])}</b><span>→</span>${esc(lad.results[pathOf(+s).end])}</li>`).join('')}</ul>` : ''}
      </div>`;
      Object.keys(done).forEach((s) => { done[s] = 'shown'; });
      box.querySelector('#ldBack').onclick = setup;
      box.querySelector('#ldAll').onclick = () => { st.players.forEach((_, i) => { if (!done[i]) done[i] = 'anim'; }); draw(); };
      box.querySelector('#ldNew').onclick = () => { build(); draw(); };
      box.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { const i = b.dataset.go; if (!done[i]) { done[i] = 'anim'; draw(); } });
    };
    setup();
  }

  const needReporter = (box) => {
    if (YT.can('reporter')) return false;
    box.innerHTML = `<div class="g-panel g-lock"><span class="g-lock-ic" aria-hidden="true">🎟️</span><h2>${YT.state.user ? '기자만 할 수 있어요' : '기자 계정으로 로그인해 주세요'}</h2>
      <p class="muted">로또복권과 즉석복권은 기사를 써서 받은 원고료 포인트로 사요.</p>
      ${YT.state.user ? '<a class="btn" href="#/games">사다리게임 하러 가기</a>' : `<a class="btn primary" href="#/login?next=${encodeURIComponent(location.hash)}">로그인</a>`}</div>`;
    return true;
  };

  // ───────── 로또복권 6/45
  async function lotto(box) {
    if (needReporter(box)) return;
    const d = await YT.api('/api/games/lotto');
    let pick = new Set(); let queue = [];
    const left = d.conf.max ? d.conf.max - d.bought : 5;
    const drawAt = new Date(d.draw_at);
    const when = `${drawAt.getMonth() + 1}월 ${drawAt.getDate()}일 토요일 저녁 8시`;
    const thisRound = d.tickets.filter((t) => t.round === d.round);
    const past = d.tickets.filter((t) => t.round !== d.round);
    const slip = (t, i) => { const w = t.draw; return `<div class="lt-slip-row ${t.settled && t.rank ? 'win' : ''}"><span class="lt-tag">${i != null ? String.fromCharCode(65 + i) : t.round + '회'}</span>
      <span class="lt-balls sm">${t.numbers.map((n, k) => ball(n, w ? (w.numbers.includes(n) || (n === w.bonus && t.rank === 2) ? 'hit' : 'miss') : '', k)).join('')}</span>
      <span class="lt-state">${t.settled ? (t.rank ? `<b>${RANK[t.rank]}</b> +${P(t.prize)}P` : '낙첨') : (t.auto ? '자동' : '수동')}</span></div>`; };
    const draw = () => {
      box.innerHTML = `<section class="g-hero lt-hero">
          <div class="g-hero-main"><span class="g-eyebrow">UNI LOTTO 6/45</span><h2 class="g-title">제 <b>${d.round}</b>회 로또복권</h2>
            <p class="g-sub">추첨 ${when} · 한 장 ${P(d.conf.price)}P · 한 회 ${d.conf.max || '무제한'}장까지</p>
            <div class="g-count" data-tick aria-live="off"><span><b id="cdD">-</b>일</span><span><b id="cdH">--</b>시간</span><span><b id="cdM">--</b>분</span><span><b id="cdS">--</b>초</span></div></div>
          ${balanceChip(d.balance)}</section>
        ${d.last ? `<section class="g-panel lt-win"><div class="g-ph"><h3>제 ${d.last.round}회 당첨 번호</h3><span class="muted small">${YT.shortDate(d.last.drawn_at)} 추첨</span></div>
          <div class="lt-balls lg pop">${d.last.numbers.map((n, i) => ball(n, '', i)).join('')}<span class="lt-plus">+</span>${ball(d.last.bonus, 'bonus', 6)}</div>
          <p class="muted small">${d.last.winners.length ? d.last.winners.map((w) => `${RANK[w.rank]} ${w.c}장`).join(' · ') : '이번 회 당첨된 복권은 없었어요.'}</p></section>` : ''}
        <div class="lt-grid">
          <section class="g-panel lt-slip"><div class="g-ph"><h3>번호 고르기</h3><span class="lt-cnt"><b>${pick.size}</b>/6</span></div>
            <div class="lt-pad">${[...Array(45)].map((_, i) => `<button class="lt-num ${pick.has(i + 1) ? 'on' : ''}" data-n="${i + 1}" aria-pressed="${pick.has(i + 1)}">${i + 1}</button>`).join('')}</div>
            <div class="lt-preview">${[...Array(6)].map((_, i) => { const a = [...pick].sort((x, y) => x - y)[i]; return a ? ball(a) : '<span class="lt-ball empty"></span>'; }).join('')}</div>
            <div class="lt-acts"><button class="btn" id="ltAuto">자동 채우기</button><button class="btn ghost" id="ltClear">지우기</button><button class="btn primary" id="ltAdd" ${pick.size === 6 && queue.length < left ? '' : 'disabled'}>담기 →</button></div></section>
          <section class="g-panel lt-cart"><div class="g-ph"><h3>담은 복권</h3><span class="muted small">이번 회 남은 장수 ${Math.max(0, left - queue.length)}장</span></div>
            ${queue.length ? `<div class="lt-slips">${queue.map((q, i) => `<div class="lt-slip-row"><span class="lt-tag">${String.fromCharCode(65 + i)}</span><span class="lt-balls sm">${q.map((n) => ball(n)).join('')}</span><button class="g-x" data-rm="${i}" aria-label="빼기">×</button></div>`).join('')}</div>
              <button class="btn primary wide" id="ltBuy">${queue.length}장 사기 · ${P(queue.length * d.conf.price)}P</button>`
              : `<p class="muted small">번호 6개를 고르고 ‘담기’를 누르거나, 아래 자동 한 장을 바로 살 수 있어요.</p>`}
            <button class="btn wide" id="ltQuick" ${left > 0 ? '' : 'disabled'}>🎲 자동으로 한 장 바로 사기 · ${P(d.conf.price)}P</button>
            ${thisRound.length ? `<div class="g-ph mt"><h3>이번 회 내 복권</h3><span class="muted small">${thisRound.length}장 · 추첨을 기다려요</span></div><div class="lt-slips">${thisRound.map((t, i) => slip(t, i)).join('')}</div>` : ''}</section>
        </div>
        ${past.length ? `<section class="g-panel"><div class="g-ph"><h3>지난 복권</h3><span class="muted small">맞힌 번호만 색이 남아요</span></div><div class="lt-slips">${past.slice(0, 20).map((t) => slip(t)).join('')}</div></section>` : ''}
        <details class="g-panel g-more"><summary>당첨금 안내</summary><div class="lt-prizes">${[['1등', '6개 모두'], ['2등', '5개 + 보너스'], ['3등', '5개'], ['4등', '4개'], ['5등', '3개']].map(([r, m], i) => `<div><b>${r}</b><small>${m}</small><span>${P(d.conf.prizes[i + 1])}P</span></div>`).join('')}</div>
          <p class="muted small">매주 토요일 저녁 8시에 추첨해요. 추첨이 끝난 뒤 이 화면을 열면 결과와 당첨금이 들어와요.</p></details>
        ${YT.can('admin') ? confForm(d.conf) : ''}`;
      bind();
      startTick(() => { const ms = Math.max(0, drawAt - Date.now()); const s = Math.floor(ms / 1000); const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('cdD', Math.floor(s / 86400)); set('cdH', two(Math.floor(s / 3600) % 24)); set('cdM', two(Math.floor(s / 60) % 60)); set('cdS', two(s % 60)); });
    };
    const bind = () => {
      box.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { const n = +b.dataset.n; if (pick.has(n)) pick.delete(n); else if (pick.size < 6) pick.add(n); draw(); });
      box.querySelector('#ltAuto').onclick = () => { while (pick.size < 6) pick.add(1 + Math.floor(Math.random() * 45)); draw(); };
      box.querySelector('#ltClear').onclick = () => { pick = new Set(); draw(); };
      box.querySelector('#ltAdd').onclick = () => { queue.push([...pick].sort((a, b) => a - b)); pick = new Set(); draw(); };
      box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { queue.splice(+b.dataset.rm, 1); draw(); });
      const buy = async (sets, btn) => {
        btn.disabled = true;
        try { const r = await YT.post('/api/games/lotto', { sets }); burst(btn.closest('.g-panel') || box, ['🍀', '✨', '🎟️']); YT.toast(`제${r.round}회 로또복권 ${r.tickets.length}장을 샀어요. 행운을 빌어요!`); setTimeout(() => lotto(box), 700); }
        catch (err) { YT.err(err); btn.disabled = false; }
      };
      const bb = box.querySelector('#ltBuy'); if (bb) bb.onclick = () => buy(queue, bb);
      box.querySelector('#ltQuick').onclick = (e) => buy(['auto'], e.currentTarget);
      bindConf(box, () => lotto(box));
    };
    draw();
  }
  const confForm = (c) => `<details class="g-panel g-more"><summary>관리자 · 로또복권 설정</summary><form class="form-row" id="gConf">
      <label>한 장 가격<input class="input" name="lotto_price" inputmode="numeric" value="${c.price}"></label><label>한 회 최대 장수<input class="input" name="lotto_max" inputmode="numeric" value="${c.max}"></label>
      ${[1, 2, 3, 4, 5].map((k) => `<label>${k}등 당첨금<input class="input" name="lotto_p${k}" inputmode="numeric" value="${c.prizes[k]}"></label>`).join('')}<button class="btn">저장</button></form></details>`;
  const bindConf = (box, again) => {
    const f = box.querySelector('#gConf');
    if (f) f.onsubmit = async (e) => { e.preventDefault(); try { await YT.put('/api/games/conf', Object.fromEntries(new FormData(f))); YT.toast('설정을 저장했어요.'); again(); } catch (err) { YT.err(err); } };
  };

  // ───────── 즉석복권 (긁기)
  async function scratch(box) {
    if (needReporter(box)) return;
    const d = await YT.api('/api/games/scratch');
    let left = d.conf.daily ? d.conf.daily - d.today : 99;
    const can = () => left > 0 && Number(String(box.querySelector('#scBal')?.textContent || d.balance).replace(/\D/g, '')) >= d.conf.price;
    box.innerHTML = `<section class="g-hero sc-hero">
        <div class="g-hero-main"><span class="g-eyebrow">INSTANT SCRATCH</span><h2 class="g-title">행운 <b>즉석복권</b></h2>
          <p class="g-sub">같은 그림 세 개가 나오면 당첨! 한 장 ${P(d.conf.price)}P · 하루 ${d.conf.daily || '무제한'}장 · 오늘 남은 장수 <b id="scLeft">${Math.max(0, left)}</b>장</p>
          <div class="sc-legend">${d.table.map((t) => `<span><i>${t.symbol}${t.symbol}${t.symbol}</i><b>${P(t.prize)}P</b></span>`).join('')}</div></div>
        ${balanceChip(d.balance, 'scBal')}</section>
      <section class="g-panel sc-stage" id="scStage"></section>
      ${d.tickets.length ? `<section class="g-panel"><div class="g-ph"><h3>최근 복권</h3></div><div class="lt-slips">${d.tickets.map((t) => `<div class="lt-slip-row ${t.prize && t.symbols ? 'win' : ''}"><span class="lt-tag">${YT.shortDate(t.created).slice(5)}</span><span class="sc-mini">${t.symbols ? t.symbols.join(' ') : '긁기 전'}</span><span class="lt-state">${t.symbols ? (t.prize ? `<b>+${P(t.prize)}P</b>` : '꽝') : `<button class="linklike" data-open="${t.id}">긁으러 가기</button>`}</span></div>`).join('')}</div></section>` : ''}
      ${YT.can('admin') ? `<details class="g-panel g-more"><summary>관리자 · 즉석복권 설정</summary><form class="form-row" id="gConf"><label>한 장 가격<input class="input" name="scratch_price" inputmode="numeric" value="${d.conf.price}"></label><label>하루 최대 장수<input class="input" name="scratch_daily" inputmode="numeric" value="${d.conf.daily}"></label><button class="btn">저장</button></form>
        <p class="muted small">당첨 확률: 💎 1/1000 (가격의 100배) · 🍀 1/100 (10배) · ⭐ 1/20 (3배) · 🍬 1/5 (본전)</p></details>` : ''}`;
    bindConf(box, () => scratch(box));
    const stage = box.querySelector('#scStage');
    const idle = () => {
      stage.innerHTML = `<div class="sc-ticket idle"><div class="sc-band"><b>LUCKY</b><span>유니 타임즈 즉석복권</span></div>
        <div class="sc-face"><span class="sc-face-ic" aria-hidden="true">🎟️</span><p>${left <= 0 ? '오늘 복권은 다 긁었어요.<br>내일 또 만나요!' : '복권을 사면 여기에서 바로 긁을 수 있어요'}</p></div></div>
        <button class="btn primary big" id="scBuy" ${can() ? '' : 'disabled'}>${left <= 0 ? '오늘은 끝!' : can() ? `복권 한 장 사기 · ${P(d.conf.price)}P` : '포인트가 모자라요'}</button>`;
      const buy = stage.querySelector('#scBuy');
      buy.onclick = async () => { buy.disabled = true; try { const r = await YT.post('/api/games/scratch', {}); box.querySelector('#scBal').textContent = P(r.balance); left--; box.querySelector('#scLeft').textContent = Math.max(0, left); card(r.id); } catch (err) { YT.err(err); buy.disabled = false; } };
    };
    const card = (id) => {
      stage.innerHTML = `<div class="sc-ticket"><div class="sc-band"><b>LUCKY</b><span>No. ${esc(id.slice(0, 8).toUpperCase())}</span></div>
        <div class="sc-area"><div class="sc-under" id="scUnder"><span class="muted">…</span></div><canvas id="scCanvas" aria-label="은박을 문질러 긁어요"></canvas></div>
        <div class="sc-foot">같은 그림 3개 = 당첨</div></div>
        <p class="muted small center">손가락(마우스)으로 은박을 문질러요 · <button class="linklike" id="scAll">한 번에 열기</button></p>`;
      const cv = stage.querySelector('#scCanvas'); const W = cv.offsetWidth || 320, H = cv.offsetHeight || 150; const dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#9FA3A8'); g.addColorStop(.35, '#E9EBEE'); g.addColorStop(.55, '#B9BDC2'); g.addColorStop(1, '#8E9297');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let x = -H; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.lineTo(x + H + 5, 0); ctx.lineTo(x + 5, H); ctx.fill(); }
      ctx.fillStyle = 'rgba(60,60,60,.55)'; ctx.font = '800 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★  긁어 보세요  ★', W / 2, H / 2 + 5);
      let result = null, finished = false;
      const reveal = () => {
        if (finished || !result) return; finished = true;
        cv.style.transition = 'opacity .45s'; cv.style.opacity = 0; setTimeout(() => cv.remove(), 480);
        box.querySelector('#scBal').textContent = P(result.balance);
        stage.querySelector('.sc-ticket').classList.add(result.prize ? 'won' : 'lost');
        if (result.prize) burst(stage.querySelector('.sc-area'));
        YT.toast(result.prize ? `당첨! ${P(result.prize)}포인트를 받았어요 🎉` : '아쉽게도 꽝이에요. 다음에 또!');
        setTimeout(() => { const nb = document.createElement('div'); nb.className = 'row gap center'; nb.innerHTML = `<button class="btn primary" id="scMore" ${left > 0 ? '' : 'disabled'}>${left > 0 ? '한 장 더' : '오늘은 끝!'}</button>`; stage.appendChild(nb); nb.querySelector('#scMore').onclick = idle; }, 600);
      };
      YT.post('/api/games/scratch/' + id, {}).then((r) => { result = r;
        stage.querySelector('#scUnder').innerHTML = `<div class="sc-syms">${r.symbols.map((s, i) => `<span style="--i:${i}">${s}</span>`).join('')}</div><b class="sc-prize">${r.prize ? `${P(r.prize)}P 당첨!` : '꽝 · 다음 기회에'}</b>`; }).catch(YT.err);
      ctx.globalCompositeOperation = 'destination-out'; let down = false, rubbed = 0;
      const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const rub = (e) => { if (!down) return; e.preventDefault(); const [x, yy] = at(e); ctx.beginPath(); ctx.arc(x, yy, 20, 0, Math.PI * 2); ctx.fill(); if (++rubbed > 40) reveal(); };
      cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); rub(e); });
      cv.addEventListener('pointermove', rub); cv.addEventListener('pointerup', () => { down = false; }); cv.addEventListener('pointercancel', () => { down = false; });
      stage.querySelector('#scAll').onclick = () => { if (result) reveal(); else setTimeout(reveal, 500); };
    };
    idle();
    box.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { card(b.dataset.open); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }

  const mount = (desc, fn) => async (view) => {
    view.className = 'container';
    view.innerHTML = YT.subTabs('games') + YT.pageHead('', '오락실', desc) + '<div id="gBox" class="g-box"><p class="muted">불러오는 중…</p></div>';
    try { await fn(view.querySelector('#gBox')); } catch (err) { view.querySelector('#gBox').innerHTML = `<div class="empty-state"><p>${esc(err.message || '불러오지 못했어요.')}</p></div>`; }
  };
  YT.addRoute('/games', mount('누가 설거지할까? 인원을 고르고 이름을 적으면 사다리가 만들어져요. 적은 이름은 이 기기에 기억돼요.', ladder));
  YT.addRoute('/games/lotto', mount('원고료 포인트로 사는 우리 가족 로또복권. 매주 토요일 저녁 8시에 추첨해요.', lotto));
  YT.addRoute('/games/scratch', mount('포인트로 사서 바로 긁어 보는 즉석복권이에요.', scratch));
})();
