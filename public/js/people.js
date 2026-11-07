/* 가족 앨범 — 인물 (성장 기록·가족 연표는 house.js) */
(function () {
  'use strict';
  const { esc } = YT;
  const avatar = (p, size = '') => p.photo
    ? `<span class="avatar ${size}"><img src="${YT.thumbUrl(p.photo)}" alt="" loading="lazy"></span>`
    : `<span class="avatar ${size}" style="--h:${[...p.name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360}">${esc(p.name.slice(-2))}</span>`;

  async function buildGroups(people) {
    const y = new Date().getFullYear();
    const ev = await YT.getYearEvents(y);
    const groupNames = new Set(people.filter((p) => p.is_group).map((p) => p.name));
    const groupOf = new Map();
    const tally = new Map();
    for (const e of ev.events) {
      const t = YT.tags(e.hashtags); const gs = t.filter((x) => groupNames.has(x));
      for (const n of t) if (!groupNames.has(n)) for (const g of gs) { const k = n + '|' + g; tally.set(k, (tally.get(k) || 0) + 1); }
    }
    for (const [k, c] of tally) { const [n, g] = k.split('|'); const cur = groupOf.get(n); if (!cur || cur.c < c) groupOf.set(n, { g, c }); }
    // 다가오는 생일
    const today = YT.today();
    const occ = await YT.occurrencesBetween(today, YT.addDays(today, 366));
    const nextBd = new Map();
    for (const o of occ) if (o.kind === 'birthday') for (const n of YT.tags(o.hashtags)) {
      // 생일 제목에 이름이 들어간 사람만 주인공으로 간주
      if (o.title.includes(n) && !nextBd.has(n)) nextBd.set(n, o);
    }
    return { groupOf, nextBd, groupNames };
  }

  YT.addRoute('/people', async (view) => {
    const { people } = await YT.api('/api/people');
    const { groupOf, nextBd } = await buildGroups(people);
    const persons = people.filter((p) => !p.is_group);
    const groups = {};
    for (const p of persons) { const g = p.family_group || groupOf.get(p.name)?.g || '우리 가족'; (groups[g] = groups[g] || []).push(p); }
    const order = Object.keys(groups).sort((a, b) => (a === '우리 가족' ? -1 : b === '우리 가족' ? 1 : groups[b].length - groups[a].length));
    const today = YT.today();
    view.innerHTML = YT.subTabs('album') + YT.pageHead('', '가족 앨범', '가족 한 사람 한 사람의 이야기 — 이름을 누르면 생일·기념일·관련 기사를 한곳에서 볼 수 있어요.', YT.can('staff') ? '<button class="btn primary" id="addPerson">+ 인물 추가</button>' : '')
      + `<input type="search" class="input" id="pSearch" placeholder="이름 검색" aria-label="이름 검색" style="max-width:320px">
      <div class="chips mt">${order.map((g) => `<a class="chip" href="#pg-${encodeURIComponent(g)}">${esc(g)} <small>${groups[g].length}</small></a>`).join('')}</div>
      ${order.map((g) => `<section class="p-group" id="pg-${encodeURIComponent(g)}"><div class="side-head"><h2>${esc(g)}</h2>${g !== '우리 가족' ? `<a href="#/people/${encodeURIComponent(g)}">모아 보기 →</a>` : ''}</div>
        <div class="p-grid">${groups[g].map((p) => { const b = nextBd.get(p.name); return `<a class="p-card" data-name="${esc(p.name)}" href="#/people/${encodeURIComponent(p.name)}">${avatar(p)}
          <div><b>${esc(p.name)}</b>${p.relation ? `<span class="p-rel">${esc(p.relation)}</span>` : ''}
          <div class="muted small">${b ? `생일 ${b.date.slice(5).replace('-', '/')} · ${b.date === today ? '오늘!' : 'D-' + YT.dayDiff(today, b.date)}` : ''}${p.article_count ? ` · 기사 ${p.article_count}` : ''}</div></div></a>`; }).join('')}</div></section>`).join('')}
      <p class="muted small mt">기사에 <b>등장 인물</b>을 넣거나 생일을 등록하면 가족 앨범에 자동으로 추가돼요. 지역·모임 이름(예: 해바라기마을)은 가족 그룹으로 묶여요. 위의 ‘성장 기록’·‘가족 연표’ 탭에서 자라는 모습과 큰일도 볼 수 있어요.</p>`;
    const ap = YT.$('#addPerson');
    if (ap) ap.onclick = () => {
      const groups = [...new Set(people.map((p) => p.family_group).filter(Boolean))];
      const m = YT.modal(`<h2 class="modal-title">인물 추가</h2><form class="form" id="npForm">
        <div class="form-row"><label>이름<input class="input" name="name" maxlength="30" required placeholder="황윤수"></label>
        <label>관계·호칭<input class="input" name="relation" maxlength="30" placeholder="김신중의 친구 / 둘째이모"></label></div>
        <label class="block">가족 그룹<input class="input" name="family_group" maxlength="30" list="grpList" placeholder="우리 가족 / 친구·지인"><datalist id="grpList">${['우리 가족', '친구·지인', ...groups].filter((v, i, a) => a.indexOf(v) === i).map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
        <label class="block">한 줄 소개 (선택)<input class="input" name="bio" maxlength="200"></label>
        <label class="check small"><input type="checkbox" name="bd"> 저장하고 생일도 바로 입력하기</label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">추가</button></div></form>`);
      const f = m.el.querySelector('#npForm'); setTimeout(() => f.name.focus(), 50);
      f.onsubmit = async (e) => {
        e.preventDefault(); const name = f.name.value.trim().replace(/^#/, '').replace(/\s+/g, '');
        if (!name) return;
        if (people.some((p) => p.name === name) && !YT.confirm(`‘${name}’은(는) 이미 가족 앨범에 있어요. 관계·그룹을 이 내용으로 바꿀까요?`)) return;
        try {
          await YT.put('/api/people/' + encodeURIComponent(name), { relation: f.relation.value, family_group: f.family_group.value, bio: f.bio.value });
          const bd = f.bd.checked; m.close(); YT.toast(`${name}님을 가족 앨범에 추가했어요.`);
          if (bd) YT.openEventForm({ kind: 'birthday', title: `${name} 생일`, hashtags: '#' + name }, 'new', () => YT.go('#/people/' + encodeURIComponent(name)));
          else YT.go('#/people/' + encodeURIComponent(name));
        } catch (err) { YT.err(err); }
      };
    };
    YT.$('#pSearch').oninput = (e) => { const q = e.target.value.trim(); YT.$$('.p-card').forEach((c) => (c.hidden = q && !c.dataset.name.includes(q))); };
  });

  YT.addRoute('/people/:name', async (view, { name }) => {
    const [d, { people }] = await Promise.all([YT.api('/api/people/' + encodeURIComponent(name)), YT.api('/api/people')]);
    const me = people.find((p) => p.name === name) || { name };
    if (d.exists === false && !people.some((x) => x.name === name)) {
      view.innerHTML = YT.subTabs('album') + `<div class="empty-state"><h2>‘${esc(name)}’님을 찾을 수 없어요</h2><p class="muted">가족 앨범에 없는 이름이에요. 이름을 다시 확인하거나 가족 앨범에서 찾아보세요.</p><a class="btn" href="#/people">가족 앨범으로</a></div>`;
      return;
    }
    const p = { ...me, ...d.person };
    const today = YT.today();
    const upcoming = d.occurrences.filter((o) => o.date >= today).slice(0, 6);
    const isGroup = me.is_group;
    const members = isGroup ? d.related : [];
    const myBirthday = !isGroup && d.events.find((e) => e.kind === 'birthday' && e.title.includes(name));
    view.innerHTML = `
      <div class="person-head">${avatar(p, 'xl')}
        <div class="grow"><div class="sec-kicker">${isGroup ? '가족 그룹' : '가족 앨범'}${p.family_group ? ' · ' + esc(p.family_group) : ''}</div>
        <h1 class="page-title">${esc(name)} ${p.relation ? `<span class="p-rel big">${esc(p.relation)}</span>` : ''}</h1>
        ${myBirthday ? `<p class="muted">생일 · ${myBirthday.calendar === 'lunar' ? '음력' : '양력'} ${myBirthday.birth_month}월 ${myBirthday.birth_day}일${myBirthday.birth_year ? ` · ${myBirthday.birth_year}년생` : ''}${YT.can('staff') ? ' <button class="btn tiny" id="editBd">생일 수정</button>' : ''}</p>` : ''}
        ${p.bio ? `<p class="p-bio">${YT.nl2br(p.bio)}</p>` : (YT.can('staff') && !isGroup ? '<p class="muted small">아직 소개가 없어요. ‘프로필 편집’으로 한 줄 소개를 남겨보세요.</p>' : '')}
        ${(() => { const link = (n) => `<a href="#/people/${encodeURIComponent(n)}">${esc(n)}</a>`; const kids = people.filter((x) => x.father === name || x.mother === name).map((x) => x.name);
          const bits = [p.father && `아버지 ${link(p.father)}`, p.mother && `어머니 ${link(p.mother)}`, p.spouse && `배우자 ${link(p.spouse)}`, kids.length && `자녀 ${kids.map(link).join(', ')}`].filter(Boolean);
          return bits.length ? `<p class="p-fam">${bits.join(' · ')} · <a href="#/family-tree">가계도 보기</a></p>` : ''; })()}</div>
        <div class="p-acts">${!isGroup && p.facetime ? YT.ftButton(name, p.facetime, '') : ''}${YT.can('staff') ? '<button class="btn" id="editP">프로필 편집</button>' : ''}${YT.can('staff') && !isGroup && !p.is_account ? '<button class="btn danger" id="delP">삭제</button>' : ''}</div>
      </div>
      <div class="person-grid">
        <section><div class="side-head"><h2>${isGroup ? '그룹 일정' : '생일·기념일'}</h2><a href="#/calendar">캘린더 ↗</a></div>
          <ul class="ev-list">${upcoming.length ? upcoming.map((o) => YT.eventItem(o).replace('<li class="ev-item">', `<li class="ev-item"><span class="dday">${o.date === today ? '오늘' : 'D-' + YT.dayDiff(today, o.date)}</span>`)).join('') : '<li class="muted">다가오는 일정이 없어요.</li>'}</ul>
          ${YT.can('staff') && !isGroup && !myBirthday ? `<button class="btn small" id="addBd">${esc(name)} 생일 등록</button>` : ''}</section>
        <section><div class="side-head"><h2>${isGroup ? '구성원' : '함께 등장하는 가족'}</h2></div>
          <div class="chips">${(isGroup ? members : d.related).filter((n) => !people.find((x) => x.name === n)?.is_group).map((n) => `<a class="chip" href="#/people/${encodeURIComponent(n)}">${esc(n)}</a>`).join('') || '<span class="muted">아직 없어요.</span>'}</div>
          ${!isGroup ? `<div class="mt">${d.related.filter((n) => people.find((x) => x.name === n)?.is_group).map((n) => `<a class="tag" href="#/people/${encodeURIComponent(n)}">#${esc(n)}</a>`).join(' ')}</div>` : ''}</section>
      </div>
      <section class="mt"><div class="side-head"><h2>${esc(name)} 관련 기사</h2><span class="muted small">${d.articles.length}개</span></div>
        ${d.articles.length ? `<div class="card-grid three">${d.articles.map((a) => YT.articleCard(a, { excerpt: false })).join('')}</div>` : `<div class="empty-state small">아직 기사가 없어요.${YT.can('reporter') ? `<br><a class="btn small primary" href="#/write">${esc(name)} 이야기 쓰기</a>` : ''}</div>`}
      </section>
      ${YT.can('reporter') && !isGroup ? `<div class="row gap mt"><a class="btn" href="#/post/write?type=letter&to=${encodeURIComponent(name)}">${esc(name)}에게 편지 쓰기</a></div>` : ''}
      <p class="mt"><a href="#/people">← 가족 앨범으로</a></p>`;
    const eb = YT.$('#editBd');
    if (eb) eb.onclick = () => YT.openEventForm(myBirthday, 'edit', () => { YT.clearCache(); YT.route(); });
    const add = YT.$('#addBd');
    if (add) add.onclick = () => YT.openEventForm({ kind: 'birthday', title: `${name} 생일`, hashtags: '#' + name }, 'new', () => YT.route());
    const del = YT.$('#delP');
    if (del) del.onclick = () => {
      const fr = /친구|지인|동료|이웃|선배|후배|선생님/.test((p.relation || '') + (p.family_group || ''));
      const m = YT.modal(`<h2 class="modal-title">${esc(name)} 삭제</h2>
        <p>가족 앨범에서 <b>${esc(name)}</b>님의 프로필(소개·사진·관계·가계도 연결)을 지우고, 일정의 등장 인물에서도 빼요.</p>
        ${myBirthday ? `<label class="check"><input type="checkbox" id="delEv" ${fr ? 'checked' : ''}> ‘${esc(myBirthday.title)}’ 일정도 휴지통으로 보내기</label>` : ''}
        ${d.articles.length ? `<p class="muted small">기사 ${d.articles.length}편에 등장 인물로 들어가 있어서, 그 기사들 때문에 이름은 가족 앨범에 계속 보일 수 있어요. 기사에서 빼려면 기사를 ‘수정’해 주세요.</p>` : ''}
        <p class="muted small">휴지통으로 보낸 생일 일정은 일정 › 달력 아래 ‘삭제한 일정’에서 편집장 이상이 되살릴 수 있어요. 지운 프로필은 되살릴 수 없어요.</p>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn danger" id="delGo">삭제</button></div>`);
      m.el.querySelector('#delGo').onclick = async () => {
        try {
          const ev = m.el.querySelector('#delEv'); const r = await YT.del('/api/people/' + encodeURIComponent(name) + (ev && ev.checked ? '?events=1' : ''));
          m.close(); YT.clearCache(); YT.toast(`${name}님을 지웠어요${r.trashed ? ` · 생일 일정 ${r.trashed}개는 휴지통으로` : ''}.`); YT.go('#/people');
        } catch (err) { YT.err(err); }
      };
    };
    const ed = YT.$('#editP');
    if (ed) ed.onclick = () => {
      const m = YT.modal(`<h2 class="modal-title">${esc(name)} 프로필</h2><form class="form" id="pForm">
        <div class="form-row"><label>관계·호칭<input class="input" name="relation" maxlength="30" value="${esc(p.relation || '')}" placeholder="엄마 / 둘째이모 / 서아 친구"></label>
        <label>가족 그룹<input class="input" name="family_group" maxlength="30" value="${esc(p.family_group || '')}" placeholder="우리 가족 / 해바라기마을 / 푸른숲마을"></label>
        <input type="hidden" name="emoji" value="${esc(p.emoji || '')}"></div>
        <fieldset class="rel-set"><legend>가계도 <small class="muted">— 이름을 적으면 가계도에 이어져요</small></legend>
          <div class="form-row"><label>아버지<input class="input" name="father" list="relNames" maxlength="30" value="${esc(p.father || '')}"></label>
          <label>어머니<input class="input" name="mother" list="relNames" maxlength="30" value="${esc(p.mother || '')}"></label>
          <label>배우자<input class="input" name="spouse" list="relNames" maxlength="30" value="${esc(p.spouse || '')}"></label></div>
          <datalist id="relNames">${people.filter((x) => !x.is_group && x.name !== name).map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist></fieldset>
        <label class="block">📹 페이스타임 연락처 <small class="muted">— 전화번호 또는 애플 ID 이메일 · 로그인한 가족에게만 보여요</small><input class="input" name="facetime" maxlength="120" value="${esc(p.facetime || '')}" placeholder="010-1234-5678 또는 name@icloud.com" autocomplete="off"></label>
        <label class="block">한 줄 소개<textarea class="input" name="bio" rows="3" maxlength="1000" placeholder="좋아하는 것, 요즘 빠져 있는 것">${esc(p.bio || '')}</textarea></label>
        <div class="block"><span>프로필 사진</span><div class="row gap">${p.photo ? `<img src="${YT.photoUrl(p.photo)}" class="thumb-sm">` : ''}<input type="file" accept="image/*" id="pPhoto"></div></div>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`);
      const f = m.el.querySelector('#pForm'); let photo = p.photo || null;
      m.el.querySelector('#pPhoto').onchange = async (e) => { try { photo = await YT.uploadImage(e.target.files[0], 'person'); YT.toast('사진을 올렸어요.'); } catch (err) { YT.err(err); } };
      f.onsubmit = async (e) => { e.preventDefault(); try { await YT.put('/api/people/' + encodeURIComponent(name), { ...Object.fromEntries(new FormData(f)), photo }); m.close(); YT.toast('프로필을 저장했어요.'); YT.route(); } catch (err) { YT.err(err); } };
    };
  });

  // ── 가계도: 인물마다 적은 아버지·어머니·배우자를 이어 세대별로 그린다
  YT.addRoute('/family-tree', async (view) => {
    const { people } = await YT.api('/api/people');
    const P = new Map(people.filter((p) => !p.is_group).map((p) => [p.name, p]));
    const ensure = (n) => { if (n && !P.has(n)) P.set(n, { name: n }); };
    for (const p of [...P.values()]) { ensure(p.father); ensure(p.mother); ensure(p.spouse); }
    const linked = [...P.values()].filter((p) => p.father || p.mother || p.spouse || [...P.values()].some((q) => q.father === p.name || q.mother === p.name || q.spouse === p.name));
    view.innerHTML = YT.subTabs('album') + YT.pageHead('', '가계도', '가족 앨범의 인물마다 아버지·어머니·배우자를 적으면 세대별로 이어져요. 이름을 누르면 그 사람 이야기로 가요.',
      YT.can('staff') ? '<button class="btn" id="ftHelp">이어 주는 방법</button>' : '') + '<div class="ft-wrap" id="ftWrap"></div>';
    const help = () => YT.modal(`<h2 class="modal-title">가계도 이어 주기</h2><ol class="set-list"><li><b>가족 앨범 › 인물</b>에서 사람을 고른 뒤 <b>프로필 편집</b>을 눌러요.</li><li><b>아버지 · 어머니 · 배우자</b> 칸에 이름을 적고 저장해요. (배우자는 한쪽만 적어도 서로 이어져요)</li><li>아이 프로필에 부모 이름을 적으면 아래 세대로 내려가 그려져요.</li></ol><div class="row end"><a class="btn primary" href="#/people">인물로 가기</a></div>`);
    const hb = YT.$('#ftHelp'); if (hb) hb.onclick = help;
    const wrap = YT.$('#ftWrap');
    if (!linked.length) { wrap.innerHTML = `<div class="empty-state"><h2>아직 이어진 가족이 없어요</h2><p class="muted">인물 프로필에서 아버지·어머니·배우자를 적으면 여기에 가계도가 그려져요.</p>${YT.can('staff') ? '<button class="btn primary" id="ftHelp2">이어 주는 방법</button>' : ''}</div>`; const h2 = YT.$('#ftHelp2'); if (h2) h2.onclick = help; return; }
    // 세대 정하기: 부모보다 한 세대 아래, 배우자는 같은 세대
    const gen = new Map(linked.map((p) => [p.name, 0]));
    for (let k = 0; k < 30; k++) {
      let changed = false;
      for (const p of linked) {
        let g = gen.get(p.name);
        for (const par of [p.father, p.mother]) if (par && gen.has(par)) g = Math.max(g, gen.get(par) + 1);
        if (p.spouse && gen.has(p.spouse)) g = Math.max(g, gen.get(p.spouse));
        if (g !== gen.get(p.name) && g < 12) { gen.set(p.name, g); changed = true; }
      }
      if (!changed) break;
    }
    // ── 배치: 부부를 한 덩어리(unit)로, 집안(뿌리 부부)마다 아래로 가지를 뻗는 나무 모양으로
    //    · 자녀 덩어리들의 폭을 먼저 재고, 부모는 자녀들 한가운데 위에
    //    · 두 집안을 잇는 부부(예: 아빠-엄마)는 한쪽 집안의 맨 끝에 두고, 다른 집안을 바로 옆에 붙인다
    const W = 128, H = 52, GX = 16, GY = 70, CG = 8, TREE_GAP = 40; const pos = new Map();
    const byName = new Map(linked.map((p) => [p.name, p]));
    const order = [...linked].sort((a, b) => gen.get(a.name) - gen.get(b.name) || a.name.localeCompare(b.name, 'ko'));
    const units = []; const unitOf = new Map();
    for (const p of order) {
      if (unitOf.has(p.name)) continue;
      const sp = p.spouse && byName.get(p.spouse); const u = { m: sp && !unitOf.has(sp.name) ? [p, sp] : [p], kids: [], id: units.length };
      // 부모가 있는 사람(핏줄)을 먼저
      if (u.m.length === 2 && !(u.m[0].father || u.m[0].mother) && (u.m[1].father || u.m[1].mother)) u.m.reverse();
      units.push(u); u.m.forEach((x) => unitOf.set(x.name, u));
    }
    const parentUnit = (p) => unitOf.get(p.father) || unitOf.get(p.mother) || null;
    for (const u of units) {
      const ps = [...new Set(u.m.map(parentUnit).filter((x) => x && x !== u))];
      u.parent = ps[0] || null; u.other = ps[1] || null; // other: 다른 집안 쪽 부모(두 집안을 잇는 부부)
      if (u.parent) u.parent.kids.push(u);
    }
    const rootOf = (u) => { const seen = new Set(); while (u.parent && !seen.has(u)) { seen.add(u); u = u.parent; } return u; };
    const roots = units.filter((u) => !u.parent);
    const size = (u, seen = new Set()) => (seen.has(u) ? 0 : (seen.add(u), u.m.length + u.kids.reduce((n, k) => n + size(k, seen), 0)));
    // 집안 순서: 가장 큰 집안부터, 다리(부부)로 이어진 집안은 바로 오른쪽에
    const rootOrder = []; const placedRoot = new Set();
    const visitRoot = (r) => {
      if (placedRoot.has(r)) return; placedRoot.add(r); rootOrder.push(r);
      const stack = [r]; const seen = new Set();
      while (stack.length) { const u = stack.pop(); if (seen.has(u)) continue; seen.add(u); if (u.other) visitRoot(rootOf(u.other)); stack.push(...u.kids); }
    };
    roots.slice().sort((a, b) => size(b) - size(a)).forEach(visitRoot);
    const rank = new Map(rootOrder.map((r, i) => [r, i]));
    // 자녀 순서: 오른쪽 집안과 잇는 부부는 맨 오른쪽, 왼쪽 집안과 잇는 부부는 맨 왼쪽 (선이 덜 엇갈리게)
    const side = (u) => { if (!u.other) return 0; const a = rank.get(rootOf(u.parent)), b = rank.get(rootOf(u.other)); return b > a ? 1 : -1; };
    for (const u of units) {
      u.kids.sort((a, b) => side(a) - side(b) || (gen.get(a.m[0].name) - gen.get(b.m[0].name)) || a.m[0].name.localeCompare(b.m[0].name, 'ko'));
      if (u.other && u.m.length === 2) { // 다른 집안 쪽 배우자를 그 집안 방향에
        const otherIsRight = side(u) > 0; const blood = u.m.find((x) => parentUnit(x) === u.parent) || u.m[0];
        u.m = otherIsRight ? [blood, u.m.find((x) => x !== blood)] : [u.m.find((x) => x !== blood), blood];
      }
    }
    const unitW = (u) => u.m.length * W + (u.m.length - 1) * CG;
    const wid = new Map();
    const width = (u, seen = new Set()) => {
      if (wid.has(u)) return wid.get(u); if (seen.has(u)) return unitW(u); seen.add(u);
      const kw = u.kids.reduce((n, k) => n + width(k, seen), 0) + Math.max(0, u.kids.length - 1) * GX;
      const w = Math.max(unitW(u), kw); wid.set(u, w); return w;
    };
    const placed = new Set();
    const place = (u, left) => {
      if (placed.has(u)) return; placed.add(u);
      const w = width(u); const kw = u.kids.reduce((n, k) => n + width(k), 0) + Math.max(0, u.kids.length - 1) * GX;
      let cx = left + (w - kw) / 2; for (const k of u.kids) { place(k, cx); cx += width(k) + GX; }
      // 부모는 자녀 덩어리들의 가운데 위에
      let center = left + w / 2;
      if (u.kids.length) { const xs = u.kids.map((k) => { const a = pos.get(k.m[0].name), b = pos.get(k.m[k.m.length - 1].name); return a && b ? (a.x + b.x + W) / 2 : null; }).filter((x) => x != null); if (xs.length) center = (Math.min(...xs) + Math.max(...xs)) / 2; }
      const x0 = center - unitW(u) / 2;
      u.m.forEach((p, i) => pos.set(p.name, { x: x0 + i * (W + CG), y: gen.get(p.name) * (H + GY), p }));
    };
    let left = 0; for (const r of rootOrder) { place(r, left); left += width(r) + TREE_GAP; }
    for (const u of units) if (!placed.has(u)) { place(u, left); left += width(u) + TREE_GAP; } // 혹시 남은 덩어리
    // 왼쪽 끝을 0에 맞추기
    const minX = Math.min(...[...pos.values()].map((q) => q.x)); for (const q of pos.values()) q.x -= minX;
    const maxX = Math.max(...[...pos.values()].map((q) => q.x + W)) + GX;
    const height = (Math.max(...[...gen.values()]) + 1) * (H + GY) - GY + 8;
    let lines = '';
    for (const [n, { x, y, p }] of pos) { // 부부 줄
      if (p.spouse && pos.has(p.spouse) && n < p.spouse) { const o = pos.get(p.spouse); if (o.y === y) lines += `<path d="M${Math.min(x, o.x) + W},${y + H / 2}H${Math.max(x, o.x)}" class="ft-sp"/>`; }
    }
    for (const [, { x, y, p }] of pos) { // 부모 → 아이 (부모 사이 가운데에서 내려와 아이 위로)
      const pars = [p.father, p.mother].filter((n) => n && pos.has(n)).map((n) => pos.get(n)); if (!pars.length) continue;
      const px = pars.reduce((a, b) => a + b.x + W / 2, 0) / pars.length; const py = pars.length === 2 && pars[0].y === pars[1].y ? pars[0].y + H / 2 : Math.max(...pars.map((q) => q.y)) + H;
      const mid = y - GY / 2 + (Math.abs(px - (x + W / 2)) > 600 ? 8 : 0);
      lines += `<path d="M${px},${py}V${mid}H${x + W / 2}V${y}" class="ft-ln"/>`;
    }
    const nodes = [...pos.values()].map(({ x, y, p }) => `<a href="#/people/${encodeURIComponent(p.name)}" class="ft-node" style="left:${x}px;top:${y}px;width:${W}px;height:${H}px">
      ${p.photo ? `<img src="${YT.thumbUrl(p.photo)}" alt="" loading="lazy">` : `<span class="ft-av" style="--h:${[...p.name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360}">${esc(p.name.slice(-2))}</span>`}
      <span class="ft-t"><b>${esc(p.name)}</b>${p.relation ? `<small>${esc(p.relation)}</small>` : ''}</span></a>`).join('');
    const CW = Math.max(0, maxX - GX);
    wrap.innerHTML = `<div class="ft-tools"><span class="muted small">${pos.size}명 · ${rootOrder.length}집안</span><div class="seg-btns"><button type="button" class="chip" data-z="-1" aria-label="작게">－</button><button type="button" class="chip" data-z="fit">화면에 맞추기</button><button type="button" class="chip" data-z="1" aria-label="크게">＋</button></div></div>
      <div class="ft-scroll" id="ftScroll"><div class="ft-size" id="ftSize"><div class="ft-canvas" id="ftCanvas" style="width:${CW}px;height:${height}px"><svg width="${CW}" height="${height}" aria-hidden="true">${lines}</svg>${nodes}</div></div></div>
      <p class="muted small">화면보다 넓으면 옆으로 밀거나 ‘화면에 맞추기’를 눌러 보세요. 이름을 누르면 그 사람 이야기로 가요.</p>`;
    // 확대·축소 (이 기기에 기억)
    let z = 1; try { z = parseFloat(localStorage.getItem('yt_ft_zoom')) || 0; } catch {}
    const box = YT.$('#ftScroll'), sz = YT.$('#ftSize'), cv = YT.$('#ftCanvas');
    const fitZ = () => Math.max(0.35, Math.min(1, (box.clientWidth - 8) / CW));
    const apply = () => { cv.style.transform = `scale(${z})`; sz.style.width = CW * z + 'px'; sz.style.height = height * z + 'px'; try { localStorage.setItem('yt_ft_zoom', String(z)); } catch {} };
    if (!z) z = fitZ() < 0.6 ? 0.6 : fitZ(); apply();
    // 나(로그인한 사람, 없으면 관계가 ‘나’인 사람)를 표시하고 그 자리로 옮겨 보여 준다
    const meName = [YT.state.user && YT.state.user.display_name, [...pos.values()].find((q) => q.p.relation === '나')?.p.name].find((n) => n && pos.has(n));
    if (meName) { const el = cv.querySelector(`[href="#/people/${encodeURIComponent(meName)}"]`); if (el) el.classList.add('me'); const q = pos.get(meName); box.scrollLeft = Math.max(0, (q.x + W / 2) * z - box.clientWidth / 2); }
    wrap.querySelector('.ft-tools').onclick = (e) => { const b = e.target.closest('[data-z]'); if (!b) return; z = b.dataset.z === 'fit' ? fitZ() : Math.max(0.35, Math.min(1.5, Math.round((z + 0.15 * +b.dataset.z) * 100) / 100)); apply(); };
  });
})();
