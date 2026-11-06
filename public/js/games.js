/* 놀이 — 사다리타기 · 주간 로또 · 즉석 복권 (로또·복권은 원고료 포인트로) */
(function () {
  'use strict';
  const { esc } = YT;
  const P = (n) => Number(n || 0).toLocaleString('ko-KR');
  const ballCls = (n) => (n <= 10 ? 'b1' : n <= 20 ? 'b2' : n <= 30 ? 'b3' : n <= 40 ? 'b4' : 'b5');
  const ball = (n, extra = '') => `<span class="lt-ball ${ballCls(n)} ${extra}">${n}</span>`;
  const RANK = ['낙첨', '1등', '2등', '3등', '4등', '5등'];
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  // ───────── 사다리타기 (이 기기에서만, 로그인 없이도)
  function ladder(box) {
    let st = store.get('yt_ladder', { players: ['아빠', '엄마', '윤서', '서윤'], results: ['설거지', '청소기', '빨래 개기', '통과!'] });
    let lad = null, done = {};
    const COLW = 84, TOP = 16, H = 300, ROWS = 12;
    const build = () => {
      const n = st.players.length; const rungs = [];
      for (let row = 0; row < ROWS; row++) {
        let prev = -2;
        for (let g = 0; g < n - 1; g++) if (g !== prev + 1 && Math.random() < 0.45) { rungs.push({ g, row }); prev = g; }
      }
      // 모든 칸 사이에 다리가 하나 이상 있게
      for (let g = 0; g < n - 1; g++) if (!rungs.some((r) => r.g === g)) { const row = Math.floor(Math.random() * ROWS); if (!rungs.some((r) => r.row === row && Math.abs(r.g - g) === 1)) rungs.push({ g, row }); }
      // 결과는 섞어서 (어느 결과가 어디 있는지 숨김)
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
    const COLORS = ['#C0392B', '#2E6DB4', '#2E8B57', '#B7791F', '#7B4BB5', '#C2185B', '#00838F', '#5D4037'];
    const draw = () => {
      const n = st.players.length; const W = COLW * n;
      const cx = (c) => COLW / 2 + c * COLW;
      const svg = `<svg class="ld-svg" viewBox="0 0 ${W} ${TOP * 2 + H}" style="max-width:${W}px" role="img" aria-label="사다리">
        ${[...Array(n)].map((_, c) => `<line x1="${cx(c)}" y1="${TOP}" x2="${cx(c)}" y2="${TOP + H}" class="ld-pole"/>`).join('')}
        ${lad.rungs.map((r) => `<line x1="${cx(r.g)}" y1="${y(r.row)}" x2="${cx(r.g + 1)}" y2="${y(r.row)}" class="ld-pole"/>`).join('')}
        ${Object.keys(done).map((s) => { const p = pathOf(+s); return `<polyline points="${p.pts.map(([c, yy]) => `${cx(c)},${yy}`).join(' ')}" class="ld-path" style="stroke:${COLORS[s % COLORS.length]}" data-anim="${done[s] === 'anim' ? 1 : ''}"/>`; }).join('')}
      </svg>`;
      box.innerHTML = `<div class="ld-wrap">
        <div class="ld-grid" style="grid-template-columns:repeat(${n},${COLW}px)">${st.players.map((p, i) => `<button class="ld-top" data-go="${i}" style="--c:${COLORS[i % COLORS.length]}">${esc(p) || i + 1}</button>`).join('')}</div>
        ${svg}
        <div class="ld-grid" style="grid-template-columns:repeat(${n},${COLW}px)">${lad.results.map((r, i) => { const who = Object.keys(done).find((s) => pathOf(+s).end === i); return `<div class="ld-bot ${who != null ? 'open' : ''}" style="--c:${who != null ? COLORS[who % COLORS.length] : 'var(--line-2)'}">${who != null ? esc(r) : '?'}</div>`; }).join('')}</div>
      </div>
      <div class="row gap center mt"><button class="btn primary" id="ldAll">모두 결과 보기</button><button class="btn" id="ldNew">새 사다리</button></div>
      ${Object.keys(done).length ? `<ul class="ld-res">${Object.keys(done).map((s) => `<li><b style="color:${COLORS[s % COLORS.length]}">${esc(st.players[s])}</b> → ${esc(lad.results[pathOf(+s).end])}</li>`).join('')}</ul>` : '<p class="muted small center">위쪽 이름을 누르면 사다리를 타고 내려가요.</p>'}
      <details class="help mt"><summary>참가자 · 결과 바꾸기 (${n}명)</summary>
        <form id="ldForm" class="ld-form"><div class="ld-cols"><div><b>참가자</b>${st.players.map((p, i) => `<input class="input sm" name="p${i}" value="${esc(p)}" maxlength="10">`).join('')}</div>
          <div><b>결과</b>${st.results.map((r, i) => `<input class="input sm" name="r${i}" value="${esc(r)}" maxlength="14">`).join('')}</div></div>
          <div class="row gap"><button type="button" class="btn small" id="ldMinus" ${n <= 2 ? 'disabled' : ''}>한 명 빼기</button><button type="button" class="btn small" id="ldPlus" ${n >= 8 ? 'disabled' : ''}>한 명 더</button><button class="btn small primary">이대로 새 사다리</button></div></form></details>`;
      box.querySelectorAll('.ld-path[data-anim="1"]').forEach((el) => { const L = el.getTotalLength ? el.getTotalLength() : 1000; el.style.strokeDasharray = L; el.style.strokeDashoffset = L; requestAnimationFrame(() => { el.style.transition = 'stroke-dashoffset 1.6s ease-in-out'; el.style.strokeDashoffset = 0; }); });
      Object.keys(done).forEach((s) => { done[s] = 'shown'; });
      const readForm = () => { const f = new FormData(box.querySelector('#ldForm')); st = { players: st.players.map((_, i) => String(f.get('p' + i) || '').trim() || `${i + 1}번`), results: st.results.map((_, i) => String(f.get('r' + i) || '').trim() || '꽝') }; };
      box.querySelector('#ldForm').onsubmit = (e) => { e.preventDefault(); readForm(); store.set('yt_ladder', st); build(); draw(); };
      box.querySelector('#ldPlus').onclick = () => { readForm(); st.players.push(`${st.players.length + 1}번`); st.results.push('꽝'); store.set('yt_ladder', st); build(); draw(); box.querySelector('details').open = true; };
      box.querySelector('#ldMinus').onclick = () => { readForm(); st.players.pop(); st.results.pop(); store.set('yt_ladder', st); build(); draw(); box.querySelector('details').open = true; };
      box.querySelector('#ldAll').onclick = () => { st.players.forEach((_, i) => { if (!done[i]) done[i] = 'anim'; }); draw(); };
      box.querySelector('#ldNew').onclick = () => { build(); draw(); };
      box.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { const i = b.dataset.go; if (!done[i]) { done[i] = 'anim'; draw(); } });
    };
    build(); draw();
  }

  const needReporter = (box) => {
    if (YT.can('reporter')) return false;
    box.innerHTML = YT.state.user ? '<div class="empty-state"><h2>기자만 할 수 있어요</h2><p class="muted">로또와 즉석 복권은 원고료 포인트로 사요. 기사를 쓰는 기자 계정이 필요해요.</p></div>'
      : `<div class="empty-state"><h2>기자 계정으로 로그인해 주세요</h2><a class="btn primary" href="#/login?next=${encodeURIComponent(location.hash)}">로그인</a></div>`;
    return true;
  };

  // ───────── 주간 로또 6/45
  async function lotto(box) {
    if (needReporter(box)) return;
    const d = await YT.api('/api/games/lotto');
    let pick = new Set(); let queue = [];
    const left = d.conf.max ? d.conf.max - d.bought : 5;
    const dAt = new Date(d.draw_at);
    const when = `${dAt.getMonth() + 1}월 ${dAt.getDate()}일 (토) 저녁 8시`;
    const draw = () => {
      box.innerHTML = `<div class="lt-head"><div><span class="pt-k">이번 회</span><b class="lt-round">${d.round}회</b><span class="pt-sub">추첨 ${when} · 한 장 ${P(d.conf.price)}P · 한 회 ${d.conf.max || '무제한'}장까지</span></div>
          <div class="lt-bal"><span class="pt-k">내 포인트</span><b>${P(d.balance)}P</b></div></div>
        ${d.last ? `<section class="pt-sec lt-last"><div class="side-head"><h2>${d.last.round}회 당첨 번호</h2><span class="muted small">${YT.shortDate(d.last.drawn_at)} 추첨</span></div>
          <div class="lt-balls">${d.last.numbers.map((n) => ball(n)).join('')}<span class="lt-plus">+</span>${ball(d.last.bonus, 'bonus')}</div>
          <p class="muted small">${d.last.winners.length ? d.last.winners.map((w) => `${RANK[w.rank]} ${w.c}장`).join(' · ') : '이번 회 당첨자는 없었어요.'}</p></section>` : ''}
        <section class="pt-sec"><div class="side-head"><h2>번호 고르기</h2><span class="muted small">${pick.size} / 6 · 이번 회 남은 장수 ${Math.max(0, left - queue.length)}장</span></div>
          <div class="lt-pad">${[...Array(45)].map((_, i) => `<button class="lt-num ${pick.has(i + 1) ? 'on ' + ballCls(i + 1) : ''}" data-n="${i + 1}" aria-pressed="${pick.has(i + 1)}">${i + 1}</button>`).join('')}</div>
          <div class="row gap mt"><button class="btn" id="ltAuto">자동으로 채우기</button><button class="btn" id="ltClear">다시 고르기</button><button class="btn primary" id="ltAdd" ${pick.size === 6 && queue.length < left ? '' : 'disabled'}>이 번호 담기</button></div>
          ${queue.length ? `<ul class="lt-queue">${queue.map((q, i) => `<li><span class="lt-tag">${String.fromCharCode(65 + i)}</span><span class="lt-balls sm">${q.map((n) => ball(n)).join('')}</span><button class="linklike" data-rm="${i}">빼기</button></li>`).join('')}</ul>
            <div class="row gap"><button class="btn primary" id="ltBuy">${queue.length}장 사기 (${P(queue.length * d.conf.price)}P)</button></div>` : ''}
          <div class="row gap mt"><button class="btn small" id="ltQuick" ${left > 0 ? '' : 'disabled'}>자동으로 한 장 바로 사기</button></div></section>
        <section class="pt-sec"><div class="side-head"><h2>내 복권</h2></div>
          ${d.tickets.length ? `<ul class="lt-mine">${d.tickets.map((t) => { const w = t.draw; return `<li><span class="lt-tag">${t.round}회</span>
              <span class="lt-balls sm">${t.numbers.map((n) => ball(n, w ? (w.numbers.includes(n) ? 'hit' : (n === w.bonus && t.rank === 2 ? 'hit' : 'miss')) : '')).join('')}</span>
              <span class="lt-state ${t.settled ? (t.rank ? 'win' : '') : ''}">${t.settled ? (t.rank ? `${RANK[t.rank]} +${P(t.prize)}P` : '낙첨') : '추첨 전'}</span></li>`; }).join('')}</ul>`
            : '<p class="muted">아직 산 복권이 없어요.</p>'}</section>
        <details class="pt-sec help"><summary>당첨금 안내</summary><table class="table"><tbody>
          <tr><th>1등</th><td>6개 모두</td><td>${P(d.conf.prizes[1])}P</td></tr><tr><th>2등</th><td>5개 + 보너스</td><td>${P(d.conf.prizes[2])}P</td></tr>
          <tr><th>3등</th><td>5개</td><td>${P(d.conf.prizes[3])}P</td></tr><tr><th>4등</th><td>4개</td><td>${P(d.conf.prizes[4])}P</td></tr><tr><th>5등</th><td>3개</td><td>${P(d.conf.prizes[5])}P</td></tr></tbody></table>
          <p class="muted small">매주 토요일 저녁 8시에 추첨해요. 추첨이 끝난 뒤 이 화면을 열면 결과와 당첨금이 들어와요.</p></details>
        ${YT.can('admin') ? confForm(d.conf) : ''}`;
      bind();
    };
    const bind = () => {
      box.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { const n = +b.dataset.n; if (pick.has(n)) pick.delete(n); else if (pick.size < 6) pick.add(n); draw(); });
      box.querySelector('#ltAuto').onclick = () => { while (pick.size < 6) pick.add(1 + Math.floor(Math.random() * 45)); draw(); };
      box.querySelector('#ltClear').onclick = () => { pick = new Set(); draw(); };
      box.querySelector('#ltAdd').onclick = () => { queue.push([...pick].sort((a, b) => a - b)); pick = new Set(); draw(); };
      box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { queue.splice(+b.dataset.rm, 1); draw(); });
      const buy = async (sets, btn) => {
        btn.disabled = true;
        try { const r = await YT.post('/api/games/lotto', { sets }); YT.toast(`${r.round}회 로또 ${r.tickets.length}장을 샀어요. 행운을 빌어요!`); lotto(box); }
        catch (err) { YT.err(err); btn.disabled = false; }
      };
      const bb = box.querySelector('#ltBuy'); if (bb) bb.onclick = () => buy(queue, bb);
      box.querySelector('#ltQuick').onclick = (e) => buy(['auto'], e.target);
      bindConf(box, () => lotto(box));
    };
    draw();
  }
  const confForm = (c) => `<details class="pt-sec help"><summary>관리자 · 로또 설정</summary><form class="form-row" id="gConf">
      <label>한 장 가격<input class="input" name="lotto_price" inputmode="numeric" value="${c.price}"></label><label>한 회 최대 장수<input class="input" name="lotto_max" inputmode="numeric" value="${c.max}"></label>
      ${[1, 2, 3, 4, 5].map((k) => `<label>${k}등 당첨금<input class="input" name="lotto_p${k}" inputmode="numeric" value="${c.prizes[k]}"></label>`).join('')}<button class="btn">저장</button></form></details>`;
  const bindConf = (box, again) => {
    const f = box.querySelector('#gConf');
    if (f) f.onsubmit = async (e) => { e.preventDefault(); try { await YT.put('/api/games/conf', Object.fromEntries(new FormData(f))); YT.toast('설정을 저장했어요.'); again(); } catch (err) { YT.err(err); } };
  };

  // ───────── 즉석 복권 (긁기)
  async function scratch(box) {
    if (needReporter(box)) return;
    const d = await YT.api('/api/games/scratch');
    const left = d.conf.daily ? d.conf.daily - d.today : 99;
    box.innerHTML = `<div class="lt-head"><div><span class="pt-k">즉석 복권</span><b class="lt-round">${P(d.conf.price)}P</b><span class="pt-sub">같은 그림 세 개가 나오면 당첨! 하루 ${d.conf.daily || '무제한'}장까지 · 오늘 남은 장수 ${Math.max(0, left)}장</span></div>
        <div class="lt-bal"><span class="pt-k">내 포인트</span><b id="scBal">${P(d.balance)}P</b></div></div>
      <div class="sc-table">${d.table.map((t) => `<span><b>${t.symbol}${t.symbol}${t.symbol}</b>${P(t.prize)}P</span>`).join('')}</div>
      <div id="scStage" class="sc-stage"><button class="btn primary big" id="scBuy" ${left > 0 && d.balance >= d.conf.price ? '' : 'disabled'}>${left <= 0 ? '오늘은 다 했어요' : d.balance < d.conf.price ? '포인트가 모자라요' : `복권 한 장 사기 (${P(d.conf.price)}P)`}</button></div>
      ${d.tickets.length ? `<section class="pt-sec"><div class="side-head"><h2>최근 복권</h2></div><ul class="lt-mine">${d.tickets.map((t) => `<li><span class="lt-tag">${YT.shortDate(t.created)}</span><span class="sc-mini">${t.symbols ? t.symbols.join(' ') : '긁기 전'}</span><span class="lt-state ${t.prize && t.symbols ? 'win' : ''}">${t.symbols ? (t.prize ? `+${P(t.prize)}P` : '꽝') : `<button class="linklike" data-open="${t.id}">긁으러 가기</button>`}</span></li>`).join('')}</ul></section>` : ''}
      ${YT.can('admin') ? `<details class="pt-sec help"><summary>관리자 · 즉석 복권 설정</summary><form class="form-row" id="gConf"><label>한 장 가격<input class="input" name="scratch_price" inputmode="numeric" value="${d.conf.price}"></label><label>하루 최대 장수<input class="input" name="scratch_daily" inputmode="numeric" value="${d.conf.daily}"></label><button class="btn">저장</button></form>
        <p class="muted small">당첨 확률: 💎 1/1000 (가격의 100배) · 🍀 1/100 (10배) · ⭐ 1/20 (3배) · 🍬 1/5 (본전)</p></details>` : ''}`;
    bindConf(box, () => scratch(box));
    const stage = box.querySelector('#scStage');
    const card = (id) => {
      stage.innerHTML = `<div class="sc-card"><div class="sc-under" id="scUnder"><span class="muted">긁는 중…</span></div><canvas id="scCanvas" aria-label="은박을 문질러 긁어요"></canvas></div>
        <p class="muted small center">손가락(마우스)으로 은박을 문질러요. <button class="linklike" id="scAll">한 번에 열기</button></p>`;
      const cv = stage.querySelector('#scCanvas'); const W = cv.offsetWidth || 320, H = cv.offsetHeight || 160; const dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#B8B8B8'); g.addColorStop(.5, '#E6E6E6'); g.addColorStop(1, '#A9A9A9');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#8A8A8A'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('여기를 긁어 보세요', W / 2, H / 2 + 5);
      let result = null, finished = false;
      const reveal = async () => {
        if (finished) return; finished = true;
        try { result = result || await YT.post('/api/games/scratch/' + id, {}); } catch (err) { YT.err(err); return; }
        cv.style.transition = 'opacity .4s'; cv.style.opacity = 0; setTimeout(() => cv.remove(), 450);
        box.querySelector('#scBal').textContent = P(result.balance) + 'P';
        YT.toast(result.prize ? `당첨! ${P(result.prize)}포인트를 받았어요 🎉` : '아쉽게도 꽝이에요. 다음에 또!');
        setTimeout(() => scratch(box), 1800);
      };
      // 결과를 먼저 받아 아래에 깔아 둔다 (긁기는 보여 주기만)
      YT.post('/api/games/scratch/' + id, {}).then((r) => { result = r; stage.querySelector('#scUnder').innerHTML = `<div class="sc-syms">${r.symbols.map((s) => `<span>${s}</span>`).join('')}</div><b class="sc-prize">${r.prize ? `${P(r.prize)}P 당첨!` : '꽝'}</b>`; }).catch(YT.err);
      ctx.globalCompositeOperation = 'destination-out'; let down = false, scratched = 0;
      const at = (e) => { const r = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
      const rub = (e) => { if (!down) return; e.preventDefault(); const [x, yy] = at(e); ctx.beginPath(); ctx.arc(x, yy, 18, 0, Math.PI * 2); ctx.fill(); if (++scratched > 45 && result) reveal(); };
      cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); rub(e); });
      cv.addEventListener('pointermove', rub); cv.addEventListener('pointerup', () => { down = false; }); cv.addEventListener('pointercancel', () => { down = false; });
      stage.querySelector('#scAll').onclick = reveal;
    };
    const buy = box.querySelector('#scBuy');
    if (buy) buy.onclick = async () => { buy.disabled = true; try { const r = await YT.post('/api/games/scratch', {}); box.querySelector('#scBal').textContent = P(r.balance) + 'P'; card(r.id); } catch (err) { YT.err(err); buy.disabled = false; } };
    box.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { card(b.dataset.open); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }

  const mount = (desc, fn) => async (view) => {
    view.className = 'container';
    view.innerHTML = YT.subTabs('games') + YT.pageHead('', '놀이', desc) + '<div id="gBox"><p class="muted">불러오는 중…</p></div>';
    try { await fn(view.querySelector('#gBox')); } catch (err) { view.querySelector('#gBox').innerHTML = `<div class="empty-state"><p>${esc(err.message || '불러오지 못했어요.')}</p></div>`; }
  };
  YT.addRoute('/games', mount('누가 설거지할까? 사다리를 타 보세요. 참가자와 결과는 이 기기에 기억돼요.', ladder));
  YT.addRoute('/games/lotto', mount('원고료 포인트로 사는 우리 가족 로또. 매주 토요일 저녁 8시에 추첨해요.', lotto));
  YT.addRoute('/games/scratch', mount('포인트로 사서 바로 긁어 보는 즉석 복권이에요.', scratch));
})();
