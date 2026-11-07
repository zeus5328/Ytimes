/* 부엌 — 레시피(#/kitchen) · 냉장고를 부탁해(#/fridge)
   · 레시피와 냉장고 음식은 items(kind 'recipe' · 'fridge')에 저장
   · 냉장고에 있는 재료로 만들 수 있는 레시피를 찾아 주고, 유통기한이 가까운 재료를 먼저 쓰게 도와줘요 */
(function () {
  'use strict';
  const { esc } = YT;
  const CATS = ['밥·죽', '면·국수', '국·찌개', '반찬', '고기', '해산물', '간식·디저트', '빵·브런치', '음료', '기타'];
  const CAT_ICON = { '밥·죽': '🍚', '면·국수': '🍜', '국·찌개': '🍲', 반찬: '🥢', 고기: '🥩', 해산물: '🦐', '간식·디저트': '🍰', '빵·브런치': '🥪', 음료: '🥤', 기타: '🍽️' };
  const F_CATS = ['채소·과일', '고기·생선', '유제품·달걀', '반찬·국', '소스·양념', '음료', '냉동식품', '간식', '기타'];
  const F_ICON = { '채소·과일': '🥬', '고기·생선': '🐟', '유제품·달걀': '🥚', '반찬·국': '🍱', '소스·양념': '🧂', 음료: '🧃', 냉동식품: '🧊', 간식: '🍪', 기타: '📦' };
  const PLACES = ['냉장', '냉동', '실온'];
  // 자주 넣는 음식 — 고르면 분류·보관 장소·보통 먹을 수 있는 날을 채워 줘요 (포장에 적힌 날짜가 먼저예요)
  const COMMON = [
    ['우유', '유제품·달걀', '냉장', 7], ['달걀', '유제품·달걀', '냉장', 21], ['두부', '반찬·국', '냉장', 5], ['요거트', '유제품·달걀', '냉장', 10], ['치즈', '유제품·달걀', '냉장', 21],
    ['대파', '채소·과일', '냉장', 7], ['양파', '채소·과일', '실온', 21], ['당근', '채소·과일', '냉장', 14], ['감자', '채소·과일', '실온', 21], ['애호박', '채소·과일', '냉장', 5],
    ['상추', '채소·과일', '냉장', 4], ['사과', '채소·과일', '냉장', 21], ['돼지고기', '고기·생선', '냉장', 3], ['소고기', '고기·생선', '냉장', 3], ['닭고기', '고기·생선', '냉장', 2],
    ['김치', '반찬·국', '냉장', 60], ['햄', '고기·생선', '냉장', 14], ['어묵', '반찬·국', '냉장', 5], ['만두', '냉동식품', '냉동', 90], ['아이스크림', '간식', '냉동', 180],
  ];
  // 집에 늘 있는 기본 양념 — 레시피 재료 맞추기에서 ‘있는 것’으로 봐요
  const PANTRY = ['소금', '설탕', '후추', '물', '식용유', '참기름', '들기름', '깨', '통깨', '간장', '진간장', '국간장', '고춧가루', '다진마늘', '마늘', '식초', '올리고당', '물엿', '맛술', '미림', '케첩', '마요네즈', '버터', '밀가루', '전분', '고추장', '된장'];
  const norm = (s) => String(s || '').replace(/\s+|\(.*?\)/g, '').toLowerCase();
  const today = () => YT.today();
  const addDays = (d, n) => YT.addDays(d, n);
  const dLeft = (exp) => (exp ? Math.round((Date.parse(exp) - Date.parse(today())) / 864e5) : null);
  const dBadge = (exp) => {
    const n = dLeft(exp); if (n === null) return '<span class="fr-d none">날짜 없음</span>';
    if (n < 0) return `<span class="fr-d over">${-n}일 지남</span>`;
    if (n === 0) return '<span class="fr-d today">오늘까지</span>';
    return `<span class="fr-d ${n <= 3 ? 'soon' : ''}">D-${n}</span>`;
  };
  const load = async () => { const { items } = await YT.api('/api/items?kind=recipe,fridge'); return { recipes: items.filter((i) => i.kind === 'recipe'), fridge: items.filter((i) => i.kind === 'fridge') }; };

  // 재료 맞추기: 냉장고 음식 이름과 서로 포함되면 있는 것으로 (돼지고기 ↔ 돼지고기 앞다리살)
  function matcher(fridge) {
    const have = fridge.map((f) => ({ k: norm(f.data.name), f }));
    const find = (name) => { const k = norm(name); if (!k) return null; return have.find((h) => h.k && (h.k === k || (k.length >= 2 && h.k.includes(k)) || (h.k.length >= 2 && k.includes(h.k)))) || null; };
    const pantry = (name) => { const k = norm(name); return PANTRY.some((p) => k === p || (p.length >= 2 && k.endsWith(p) && k.length <= p.length + 2)); };
    return (r) => {
      // 유통기한이 지난 음식은 ‘있는 것’으로 치지 않아요 (요리에 쓰라고 권하지 않게)
      const ing = r.data.ingredients || []; const rows = ing.map((g) => { const h = find(g.name); const over = !!h && (dLeft(h.f.data.expires) ?? 0) < 0; return { ...g, have: !!h && !over, over, pantry: (!h || over) && pantry(g.name), item: h && h.f }; });
      const need = rows.filter((x) => !x.pantry); const got = need.filter((x) => x.have);
      const urgent = got.filter((x) => { const n = dLeft(x.item.data.expires); return n !== null && n <= 3; });
      return { rows, need: need.length, got: got.length, missing: need.filter((x) => !x.have), urgent, score: need.length ? got.length / need.length : 0 };
    };
  }

  const card = (r, m) => `<a class="kc-card" href="#/kitchen/recipe/${r.id}">
      ${r.data.photo ? `<img src="${YT.thumbUrl(r.data.photo)}" alt="" loading="lazy">` : `<span class="kc-ph" aria-hidden="true">${CAT_ICON[r.data.category] || '🍽️'}</span>`}
      <div class="kc-b"><small>${esc(r.data.category || '기타')}${r.data.time ? ' · ⏱ ' + esc(r.data.time) : ''}${r.data.level ? ' · ' + esc(r.data.level) : ''}</small>
      <b>${esc(r.data.title)}</b><span class="muted small">${esc(r.data.chef || r.author_name || '')}</span>
      ${m && m.need ? `<span class="kc-fit ${m.score === 1 ? 'all' : ''}">🧊 냉장고 재료 ${m.got}/${m.need}</span>` : ''}</div></a>`;

  // ───────── 레시피 목록
  const needLogin = (view, what) => { view.innerHTML = YT.subTabs('kitchen') + `<div class="empty-state"><h2>가족 계정으로 로그인해 주세요</h2><p>${what}는 가족 계정으로 로그인해야 쓸 수 있어요.</p><a class="btn primary" href="#/login?next=${encodeURIComponent(location.hash)}">로그인</a></div>`; };
  YT.addRoute('/kitchen', async (view, _p, q) => {
    view.className = 'container';
    if (!YT.can('subscriber')) return needLogin(view, '우리 집 레시피');
    const { recipes, fridge } = await load();
    const arts = (await YT.getArticles(false, false).catch(() => [])).filter((a) => a.category === '요리');
    const fit = matcher(fridge);
    let cat = CATS.includes(q.cat) ? q.cat : ''; let term = '';
    const draw = () => {
      const list = recipes.filter((r) => (!cat || r.data.category === cat) && (!term || norm(r.data.title + (r.data.ingredients || []).map((g) => g.name).join('')).includes(norm(term))));
      YT.$('#kcList').innerHTML = list.length ? `<div class="kc-grid">${list.map((r) => card(r, fit(r))).join('')}</div>`
        : `<div class="empty-state"><h2>${recipes.length ? '찾는 레시피가 없어요' : '첫 레시피를 올려 주세요'}</h2><p class="muted">할머니의 김치찌개, 아빠의 주말 볶음밥… 우리 집 손맛을 남겨 두면 냉장고 재료로 뭘 만들지 찾아 줘요.</p></div>`;
      YT.$$('#kcCats .chip').forEach((c) => c.classList.toggle('on', c.dataset.c === cat));
    };
    view.innerHTML = YT.subTabs('kitchen') + YT.pageHead('', '레시피', '우리 집 요리 비법을 모아 두는 곳이에요. 재료를 적어 두면 ‘냉장고를 부탁해’가 냉장고 재료로 만들 수 있는 요리를 찾아 줘요.',
      `<div class="row gap">${recipes.length ? '<button class="btn" id="kcShop">장보기 목록</button>' : ''}${YT.can('subscriber') ? '<a class="btn primary" href="#/kitchen/write">+ 레시피 올리기</a>' : ''}</div>`)
      + `<div class="hs-bar"><div class="chips" id="kcCats"><button class="chip" data-c="">전체 ${recipes.length}</button>${CATS.filter((c) => recipes.some((r) => r.data.category === c)).map((c) => `<button class="chip" data-c="${esc(c)}">${CAT_ICON[c]} ${esc(c)} ${recipes.filter((r) => r.data.category === c).length}</button>`).join('')}</div>
        <input type="search" class="input sm" id="kcQ" placeholder="요리·재료 찾기" aria-label="요리·재료 찾기" style="max-width:14rem"></div>
      <div id="kcList"></div>
      ${arts.length ? `<section class="mt"><div class="side-head"><h2>신문에 실린 요리 기사</h2><a href="#/recipes">레시피북 →</a></div><div class="kc-grid">${arts.slice(0, 8).map((a) => `<a class="kc-card" href="#/article/${a.id}">${a.photo ? `<img src="${YT.thumbUrl(a.photo)}" alt="" loading="lazy">` : '<span class="kc-ph" aria-hidden="true">📰</span>'}<div class="kc-b"><small>요리 기사</small><b>${esc(a.title)}</b><span class="muted small">${esc(a.author_name)} 기자</span></div></a>`).join('')}</div></section>` : ''}`;
    view.querySelector('#kcCats').onclick = (e) => { const c = e.target.closest('[data-c]'); if (c) { cat = c.dataset.c; draw(); } };
    view.querySelector('#kcQ').oninput = (e) => { term = e.target.value.trim(); draw(); };
    const sb = YT.$('#kcShop'); if (sb) sb.onclick = () => shopping(recipes, fridge);
    draw();
  });

  // ───────── 장보기 목록: 고른 레시피 재료를 합치고, 냉장고에 있는 것·기본 양념은 빼 줘요
  function shopping(recipes, fridge, pre) {
    const key = 'yt_kshop'; let st = { pick: [], got: [], extra: [] }; try { st = { ...st, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch {}
    st.pick = st.pick.filter((id) => recipes.some((r) => r.id === id)); if (pre && !st.pick.includes(pre)) st.pick.push(pre);
    const save = () => { try { localStorage.setItem(key, JSON.stringify(st)); } catch {} };
    const fit = matcher(fridge);
    const m = YT.modal(`<h2 class="modal-title">장보기 목록</h2><p class="muted small">요리를 고르면 재료를 모아 같은 재료끼리 합쳐요. <b>냉장고에 있는 것</b>과 기본 양념은 따로 보여 줘요. (이 기기에 저장)</p>
      <div class="chips sh-pick" id="ksPick">${recipes.map((r) => `<button type="button" class="chip" data-id="${r.id}">${esc(r.data.title)}</button>`).join('')}</div>
      <div id="ksList" class="sh-list"></div>
      <form class="evf-row sh-add" id="ksAdd"><input class="input grow" name="t" maxlength="40" placeholder="더 살 것 (예: 우유)"><button class="btn small">더하기</button></form>
      <div class="row gap end"><button type="button" class="btn" id="ksCopy">글로 복사</button><button type="button" class="btn" data-close>닫기</button></div>`);
    const merged = () => {
      const buy = new Map(), home = new Map();
      for (const id of st.pick) { const r = recipes.find((x) => x.id === id); if (!r) continue;
        for (const g of fit(r).rows) { const k = norm(g.name); const target = g.have || g.pantry ? home : buy; const cur = target.get(k) || { name: g.name, parts: [], pantry: g.pantry, item: g.item }; cur.parts.push(g.amt || ''); target.set(k, cur); } }
      for (const t of st.extra) { const k = norm(t); if (!buy.has(k)) buy.set(k, { name: t, parts: [], extra: true }); }
      return { buy: [...buy.values()], home: [...home.values()] };
    };
    const draw = () => {
      m.el.querySelectorAll('#ksPick .chip').forEach((c) => c.classList.toggle('on', st.pick.includes(c.dataset.id)));
      const { buy, home } = merged();
      m.el.querySelector('#ksList').innerHTML = (buy.length ? `<h3 class="ks-h">살 것 ${buy.length}</h3><ul>${buy.map((g) => { const k = norm(g.name); const got = st.got.includes(k);
        return `<li class="${got ? 'done' : ''}"><label><input type="checkbox" data-k="${esc(k)}" ${got ? 'checked' : ''}><b>${esc(g.name)}</b></label><small>${esc(g.parts.filter(Boolean).join(' + '))}</small>${g.extra ? `<button type="button" class="linklike" data-x="${esc(g.name)}">빼기</button>` : ''}</li>`; }).join('')}</ul>` : '<p class="muted small">위에서 요리를 골라 주세요.</p>')
        + (home.length ? `<h3 class="ks-h">집에 있어요 ${home.length}</h3><p class="muted small">${home.map((g) => `${esc(g.name)}${g.item ? ` <span class="muted">(${g.item.data.place})</span>` : ''}`).join(' · ')}</p>` : '');
    };
    m.el.querySelector('#ksPick').onclick = (e) => { const c = e.target.closest('[data-id]'); if (!c) return; st.pick = st.pick.includes(c.dataset.id) ? st.pick.filter((x) => x !== c.dataset.id) : [...st.pick, c.dataset.id]; save(); draw(); };
    m.el.querySelector('#ksList').onchange = (e) => { const c = e.target.closest('[data-k]'); if (!c) return; st.got = c.checked ? [...new Set([...st.got, c.dataset.k])] : st.got.filter((x) => x !== c.dataset.k); save(); draw(); };
    m.el.querySelector('#ksList').onclick = (e) => { const x = e.target.closest('[data-x]'); if (x) { st.extra = st.extra.filter((t) => t !== x.dataset.x); save(); draw(); } };
    m.el.querySelector('#ksAdd').onsubmit = (e) => { e.preventDefault(); const t = e.target.t.value.trim(); if (t) { st.extra = [...new Set([...st.extra, t])]; e.target.t.value = ''; save(); draw(); } };
    m.el.querySelector('#ksCopy').onclick = async () => { const { buy } = merged(); try { await navigator.clipboard.writeText('장보기 목록\n' + buy.map((g) => `□ ${g.name}${g.parts.filter(Boolean).length ? ' — ' + g.parts.filter(Boolean).join(' + ') : ''}`).join('\n')); YT.toast('복사했어요. 카카오톡·메모에 붙여 넣으세요.'); } catch { YT.toast('복사하지 못했어요.', 'error'); } };
    draw();
  }

  // ───────── 레시피 보기
  YT.addRoute('/kitchen/recipe/:id', async (view, { id }) => {
    view.className = 'container';
    if (!YT.can('subscriber')) return needLogin(view, '우리 집 레시피');
    const { recipes, fridge } = await load();
    const r = recipes.find((x) => x.id === id);
    if (!r) { view.innerHTML = YT.subTabs('kitchen') + '<div class="empty-state"><h2>레시피를 찾을 수 없어요</h2><p><a href="#/kitchen">레시피 목록으로</a></p></div>'; return; }
    const d = r.data; const m = matcher(fridge)(r);
    view.innerHTML = YT.subTabs('kitchen') + `<article class="kr">
      <div class="kr-head">${d.photo ? `<img class="kr-photo" src="${YT.photoUrl(d.photo)}" alt="${esc(d.title)}">` : `<span class="kr-photo kc-ph" aria-hidden="true">${CAT_ICON[d.category] || '🍽️'}</span>`}
        <div><div class="sec-kicker">${esc(d.category || '기타')}</div><h1 class="page-title">${esc(d.title)}</h1>
        <div class="kr-meta">${d.servings ? `<span>🍽 ${esc(d.servings)}</span>` : ''}${d.time ? `<span>⏱ ${esc(d.time)}</span>` : ''}${d.level ? `<span>📊 ${esc(d.level)}</span>` : ''}<span>👩‍🍳 ${esc(d.chef || r.author_name || '')}</span></div>
        ${d.intro ? `<p class="kr-intro">${YT.nl2br(d.intro)}</p>` : ''}
        <div class="row gap no-print">${r.can_edit ? `<a class="btn small" href="#/kitchen/write/${r.id}">수정</a><button class="btn small danger" id="krDel">삭제</button>` : ''}<button class="btn small" id="krShop">장보기 목록에 넣기</button><button class="btn small" id="krPrint">인쇄</button></div></div></div>
      <div class="kr-grid">
        <section class="kr-ing"><h2>재료</h2>${m.need ? `<p class="kc-fit ${m.score === 1 ? 'all' : ''}">🧊 냉장고에 ${m.got}/${m.need}가지 있어요${m.urgent.length ? ` · <b>${m.urgent.map((x) => esc(x.item.data.name)).join(', ')}</b> 빨리 써요` : ''}</p>` : ''}
          <ul>${m.rows.map((g) => `<li class="${g.have ? 'have' : g.pantry ? 'pantry' : 'need'}"><b>${esc(g.name)}</b><span>${esc(g.amt)}</span><small>${g.have ? `냉장고 ✓ ${dBadge(g.item.data.expires)}` : g.pantry ? '기본 양념' : g.over ? `냉장고에 있지만 유통기한이 지났어요 ${dBadge(g.item.data.expires)}` : '사야 해요'}</small></li>`).join('') || '<li class="muted">재료가 없어요</li>'}</ul></section>
        <section class="kr-steps"><h2>만드는 순서</h2><ol>${(d.steps || []).map((s) => `<li>${s.text ? `<p>${YT.nl2br(s.text)}</p>` : ''}${s.photo ? `<img src="${YT.photoUrl(s.photo)}" alt="" loading="lazy">` : ''}</li>`).join('') || '<li class="muted">순서가 없어요</li>'}</ol>
          ${d.tip ? `<div class="kr-tip"><b>💡 비법</b><p>${YT.nl2br(d.tip)}</p></div>` : ''}</section>
      </div>
      <p class="muted small mt">${esc(r.author_name || '')}님이 ${esc((r.created || '').slice(0, 10))}에 올렸어요.</p></article>`;
    YT.$('#krPrint').onclick = () => window.print();
    YT.$('#krShop').onclick = () => shopping(recipes, fridge, r.id);
    const del = YT.$('#krDel'); if (del) del.onclick = async () => { if (!YT.confirm(`‘${d.title}’ 레시피를 지울까요?`)) return; try { await YT.del('/api/items/' + r.id); YT.toast('레시피를 지웠어요.'); YT.go('#/kitchen'); } catch (err) { YT.err(err); } };
  });

  // ───────── 레시피 쓰기·고치기
  const writer = async (view, { id }) => {
    view.className = 'container';
    if (!YT.can('subscriber')) return needLogin(view, '레시피 올리기');
    let r = null;
    if (id) { const { items } = await YT.api('/api/items?kind=recipe'); r = items.find((x) => x.id === id); if (!r || !r.can_edit) { view.innerHTML = YT.subTabs('kitchen') + '<div class="empty-state"><h2>고칠 수 없는 레시피예요</h2></div>'; return; } }
    const d = r ? JSON.parse(JSON.stringify(r.data)) : { title: '', category: '반찬', servings: '', time: '', level: '', chef: YT.state.user.display_name, intro: '', tip: '', photo: '', ingredients: [{ name: '', amt: '' }, { name: '', amt: '' }, { name: '', amt: '' }], steps: [{ text: '', photo: '' }, { text: '', photo: '' }] };
    view.innerHTML = YT.subTabs('kitchen') + YT.pageHead('', r ? '레시피 고치기' : '레시피 올리기', '재료를 한 줄에 하나씩 적으면 냉장고 재료와 맞춰 볼 수 있어요.')
      + `<form class="form kw" id="kwForm">
        <div class="form-row"><label class="grow">요리 이름<input class="input" name="title" maxlength="60" required value="${esc(d.title)}" placeholder="할머니표 김치찌개"></label>
          <label>종류<select class="select" name="category">${CATS.map((c) => `<option ${d.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
        <div class="form-row"><label>몇 인분<input class="input" name="servings" maxlength="12" value="${esc(d.servings)}" placeholder="4인분"></label>
          <label>걸리는 시간<input class="input" name="time" maxlength="12" value="${esc(d.time)}" placeholder="30분"></label>
          <label>난이도<select class="select" name="level"><option value="">-</option>${['쉬움', '보통', '어려움'].map((l) => `<option ${d.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="grow">누구의 요리<input class="input" name="chef" maxlength="30" value="${esc(d.chef)}" placeholder="엄마표"></label></div>
        <div class="block"><span>대표 사진</span><div class="row gap" id="kwPh">${d.photo ? `<img src="${YT.thumbUrl(d.photo)}" class="thumb-sm">` : ''}<input type="file" accept="image/*" id="kwPhoto"></div></div>
        <label class="block">한 줄 소개<textarea class="input" name="intro" rows="2" maxlength="600" placeholder="비 오는 날 생각나는 우리 집 찌개">${esc(d.intro)}</textarea></label>
        <fieldset class="kw-set"><legend>재료 <small class="muted">— 이름과 양을 나눠 적어요 (예: 돼지고기 / 200g)</small></legend><div id="kwIng"></div><button type="button" class="btn small" id="kwIngAdd">+ 재료</button></fieldset>
        <fieldset class="kw-set"><legend>만드는 순서</legend><div id="kwSteps"></div><button type="button" class="btn small" id="kwStepAdd">+ 순서</button></fieldset>
        <label class="block">💡 비법·주의할 점<textarea class="input" name="tip" rows="3" maxlength="800" placeholder="김치는 푹 익은 걸 써야 맛있어요">${esc(d.tip)}</textarea></label>
        <div class="row gap end"><a class="btn" href="${r ? '#/kitchen/recipe/' + r.id : '#/kitchen'}">취소</a><button class="btn primary">${r ? '저장' : '올리기'}</button></div></form>`;
    const sync = () => { const f = YT.$('#kwForm');
      d.ingredients = [...f.querySelectorAll('.kw-ing')].map((row) => ({ name: row.querySelector('[data-f=name]').value.trim(), amt: row.querySelector('[data-f=amt]').value.trim() }));
      d.steps = [...f.querySelectorAll('.kw-step')].map((row, i) => ({ text: row.querySelector('textarea').value.trim(), photo: (d.steps[i] || {}).photo || '' })); };
    const drawIng = () => { YT.$('#kwIng').innerHTML = d.ingredients.map((g, i) => `<div class="kw-ing evf-row"><input class="input grow" data-f="name" maxlength="40" value="${esc(g.name)}" placeholder="재료" aria-label="재료 ${i + 1}"><input class="input" data-f="amt" maxlength="30" value="${esc(g.amt)}" placeholder="양" aria-label="양 ${i + 1}" style="max-width:9rem"><button type="button" class="linklike" data-rmi="${i}" aria-label="재료 빼기">✕</button></div>`).join(''); };
    const drawSteps = () => { YT.$('#kwSteps').innerHTML = d.steps.map((s, i) => `<div class="kw-step"><span class="kw-n">${i + 1}</span><textarea class="input" rows="2" maxlength="600" placeholder="${i === 0 ? '돼지고기를 먹기 좋게 썰어요' : ''}" aria-label="순서 ${i + 1}">${esc(s.text)}</textarea>
      <div class="kw-sp">${s.photo ? `<img src="${YT.thumbUrl(s.photo)}" class="thumb-sm">` : ''}<label class="btn small">📷<input type="file" accept="image/*" data-sp="${i}" hidden></label><button type="button" class="linklike" data-rms="${i}" aria-label="순서 빼기">✕</button></div></div>`).join(''); };
    drawIng(); drawSteps();
    YT.$('#kwIngAdd').onclick = () => { sync(); d.ingredients.push({ name: '', amt: '' }); drawIng(); YT.$$('#kwIng [data-f=name]').pop().focus(); };
    YT.$('#kwStepAdd').onclick = () => { sync(); d.steps.push({ text: '', photo: '' }); drawSteps(); YT.$$('#kwSteps textarea').pop().focus(); };
    YT.$('#kwIng').onclick = (e) => { const b = e.target.closest('[data-rmi]'); if (b) { sync(); d.ingredients.splice(+b.dataset.rmi, 1); drawIng(); } };
    YT.$('#kwSteps').onclick = (e) => { const b = e.target.closest('[data-rms]'); if (b) { sync(); d.steps.splice(+b.dataset.rms, 1); drawSteps(); } };
    YT.$('#kwSteps').onchange = async (e) => { const inp = e.target.closest('[data-sp]'); if (!inp || !inp.files[0]) return; sync();
      try { d.steps[+inp.dataset.sp].photo = await YT.uploadImage(inp.files[0], 'recipe'); drawSteps(); YT.toast('사진을 넣었어요.'); } catch (err) { YT.err(err); } };
    YT.$('#kwPhoto').onchange = async (e) => { try { d.photo = await YT.uploadImage(e.target.files[0], 'recipe'); YT.$('#kwPh').querySelector('img')?.remove(); YT.$('#kwPh').insertAdjacentHTML('afterbegin', `<img src="${YT.thumbUrl(d.photo)}" class="thumb-sm">`); YT.toast('사진을 올렸어요.'); } catch (err) { YT.err(err); } };
    YT.$('#kwForm').onsubmit = async (e) => {
      e.preventDefault(); sync(); const f = e.target;
      const data = { ...Object.fromEntries(new FormData(f)), photo: d.photo || '', ingredients: d.ingredients.filter((g) => g.name), steps: d.steps.filter((s) => s.text || s.photo) };
      try {
        if (r) { await YT.put('/api/items/' + r.id, { data }); YT.toast('레시피를 고쳤어요.'); YT.go('#/kitchen/recipe/' + r.id); }
        else { const res = await YT.post('/api/items', { kind: 'recipe', data }); YT.toast('레시피를 올렸어요.'); YT.go('#/kitchen/recipe/' + res.id); }
      } catch (err) { YT.err(err); }
    };
  };
  YT.addRoute('/kitchen/write', writer);
  YT.addRoute('/kitchen/write/:id', writer);

  // ───────── 냉장고를 부탁해
  YT.addRoute('/fridge', async (view) => {
    view.className = 'container';
    if (!YT.can('subscriber')) return needLogin(view, '냉장고 관리');
    let { recipes, fridge } = await load();
    let place = '';
    const reload = async () => { ({ recipes, fridge } = await load()); draw(); };
    const form = (it) => {
      const x = it ? it.data : { name: '', cat: '기타', place: '냉장', qty: '', bought: today(), expires: '', memo: '' };
      const m = YT.modal(`<h2 class="modal-title">${it ? '음식 고치기' : '냉장고에 넣기'}</h2><form class="form" id="frForm">
        ${it ? '' : `<div class="chips fr-common" aria-label="자주 넣는 음식">${COMMON.map(([n]) => `<button type="button" class="chip" data-cm="${esc(n)}">${esc(n)}</button>`).join('')}</div>`}
        <div class="form-row"><label class="grow">음식 이름<input class="input" name="name" maxlength="40" required value="${esc(x.name)}" placeholder="두부"></label><label>양<input class="input" name="qty" maxlength="20" value="${esc(x.qty)}" placeholder="1모 · 반 통"></label></div>
        <div class="form-row"><label>보관<select class="select" name="place">${PLACES.map((p) => `<option ${x.place === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <label>분류<select class="select" name="cat">${F_CATS.map((c) => `<option ${x.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
        <div class="form-row"><label>넣은 날<input class="input" type="date" name="bought" value="${esc(x.bought)}"></label><label>유통기한 · 먹을 날<input class="input" type="date" name="expires" value="${esc(x.expires)}"></label></div>
        <div class="chips"><span class="muted small">유통기한 →</span>${[[3, '3일 뒤'], [7, '1주 뒤'], [14, '2주 뒤'], [30, '한 달 뒤']].map(([n, l]) => `<button type="button" class="chip" data-ex="${n}">${l}</button>`).join('')}</div>
        <label class="block">메모<input class="input" name="memo" maxlength="120" value="${esc(x.memo)}" placeholder="할머니가 주신 것 · 김치찌개용"></label>
        <p class="muted small">포장에 적힌 날짜가 있으면 그걸 적어 주세요. 자주 넣는 음식을 누르면 보통 먹을 수 있는 날을 대신 채워 줘요.</p>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">${it ? '저장' : '넣기'}</button></div></form>`);
      const f = m.el.querySelector('#frForm');
      m.el.onclick = (e) => {
        const c = e.target.closest('[data-cm]'); if (c) { const k = COMMON.find(([n]) => n === c.dataset.cm); f.name.value = k[0]; f.cat.value = k[1]; f.place.value = k[2]; f.expires.value = addDays(f.bought.value || today(), k[3]); }
        const ex = e.target.closest('[data-ex]'); if (ex) f.expires.value = addDays(f.bought.value || today(), +ex.dataset.ex);
      };
      f.onsubmit = async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(f));
        try { if (it) await YT.put('/api/items/' + it.id, { data }); else await YT.post('/api/items', { kind: 'fridge', data }); m.close(); YT.toast(it ? '고쳤어요.' : `${data.name}을(를) 넣었어요.`); reload(); } catch (err) { YT.err(err); } };
      setTimeout(() => f.name.focus(), 0);
    };
    const draw = () => {
      const by = (a, b) => (a.data.expires || '9999').localeCompare(b.data.expires || '9999');
      const list = fridge.filter((f) => !place || f.data.place === place).sort(by);
      const over = fridge.filter((f) => { const n = dLeft(f.data.expires); return n !== null && n < 0; }), soon = fridge.filter((f) => { const n = dLeft(f.data.expires); return n !== null && n >= 0 && n <= 3; });
      // 냉장고 재료로 만들 수 있는 요리 — 있는 재료 비율이 높고, 빨리 먹어야 할 재료를 쓰는 요리부터
      const fit = matcher(fridge);
      const picks = recipes.map((r) => ({ r, m: fit(r) })).filter((x) => x.m.got > 0).sort((a, b) => (b.m.urgent.length - a.m.urgent.length) || (b.m.score - a.m.score) || (b.m.got - a.m.got)).slice(0, 6);
      view.innerHTML = YT.subTabs('kitchen') + YT.pageHead('', '냉장고를 부탁해', '냉장고에 무엇이 있는지 가족이 함께 적어 두고, 유통기한이 가까운 음식부터 챙겨요. 있는 재료로 만들 수 있는 레시피도 찾아 줘요.', '<button class="btn primary" id="frAdd">+ 냉장고에 넣기</button>')
        + `<div class="glance fr-glance">
            <button class="gl ${place === '' ? 'on' : ''}" data-pl=""><span>전체</span><b>${fridge.length}<small>가지</small></b></button>
            ${PLACES.map((p) => `<button class="gl ${place === p ? 'on' : ''}" data-pl="${p}"><span>${p === '냉장' ? '🧊 냉장' : p === '냉동' ? '❄️ 냉동' : '🧺 실온'}</span><b>${fridge.filter((f) => f.data.place === p).length}<small>가지</small></b></button>`).join('')}
          </div>
          ${over.length || soon.length ? `<p class="fr-alert">${over.length ? `⚠️ 유통기한 지난 음식 <b>${over.length}</b>가지 — ${over.map((f) => esc(f.data.name)).join(', ')}. ` : ''}${soon.length ? `⏰ 3일 안에 먹어야 할 음식 <b>${soon.length}</b>가지 — ${soon.map((f) => esc(f.data.name)).join(', ')}` : ''}</p>` : ''}
          <div class="fr-grid">
            <section><div class="side-head"><h2>${place || '냉장고'} 속 음식 ${list.length}</h2><span class="muted small">유통기한이 가까운 순</span></div>
              ${list.length ? `<ul class="fr-list">${list.map((f) => `<li class="fr-item ${(dLeft(f.data.expires) ?? 99) < 0 ? 'is-over' : (dLeft(f.data.expires) ?? 99) <= 3 ? 'is-soon' : ''}">
                <span class="fr-ic" aria-hidden="true">${F_ICON[f.data.cat] || '📦'}</span>
                <div class="fr-b"><b>${esc(f.data.name)}</b>${f.data.qty ? ` <span class="muted small">${esc(f.data.qty)}</span>` : ''}<small>${esc(f.data.place)} · ${esc(f.data.cat)}${f.data.memo ? ' · ' + esc(f.data.memo) : ''}${f.author_name ? ` · ${esc(f.author_name)}` : ''}</small></div>
                ${dBadge(f.data.expires)}
                <div class="fr-acts"><button class="btn small" data-eat="${f.id}" title="냉장고에서 빼요">다 먹었어요</button><button class="linklike" data-ed="${f.id}">고치기</button></div></li>`).join('')}</ul>`
                : `<div class="empty-state small"><p>${fridge.length ? '여기에는 아직 없어요.' : '냉장고가 비어 있어요. ‘냉장고에 넣기’로 장 봐 온 것부터 적어 보세요.'}</p></div>`}</section>
            <section class="fr-side"><div class="side-head"><h2>🍳 오늘 뭐 해 먹지?</h2><a href="#/kitchen">레시피 →</a></div>
              ${picks.length ? `<ul class="fr-picks">${picks.map(({ r, m }) => `<li><a href="#/kitchen/recipe/${r.id}"><b>${esc(r.data.title)}</b><span class="kc-fit ${m.score === 1 ? 'all' : ''}">재료 ${m.got}/${m.need}</span></a>
                <small>${m.urgent.length ? `⏰ ${m.urgent.map((x) => esc(x.item.data.name)).join(', ')} 빨리 써요 · ` : ''}${m.missing.length ? `없는 것: ${m.missing.slice(0, 4).map((x) => esc(x.name)).join(', ')}${m.missing.length > 4 ? ' 외' : ''}` : '재료가 모두 있어요!'}</small></li>`).join('')}</ul>`
                : `<p class="muted small">${recipes.length ? '냉장고 재료와 맞는 레시피가 아직 없어요. 재료 이름을 레시피와 같게 적으면 잘 찾아요.' : '레시피를 올리면 냉장고 재료로 만들 수 있는 요리를 찾아 줘요.'}</p>`}
              ${YT.can('subscriber') ? '<a class="btn small mt" href="#/kitchen/write">+ 레시피 올리기</a>' : ''}</section>
          </div>`;
      YT.$('#frAdd').onclick = () => form();
    };
    view.onclick = async (e) => {
      const pl = e.target.closest('[data-pl]'); if (pl) { place = pl.dataset.pl; draw(); return; }
      const ed = e.target.closest('[data-ed]'); if (ed) { form(fridge.find((f) => f.id === ed.dataset.ed)); return; }
      const eat = e.target.closest('[data-eat]'); if (eat) { const f = fridge.find((x) => x.id === eat.dataset.eat);
        try { await YT.del('/api/items/' + f.id); fridge = fridge.filter((x) => x.id !== f.id); YT.toast(`${f.data.name}을(를) 냉장고에서 뺐어요.`); draw(); } catch (err) { YT.err(err); } }
    };
    draw();
  });
})();
