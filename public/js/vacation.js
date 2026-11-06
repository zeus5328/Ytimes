/* 방학계획표 — 동그라미 하루 생활계획표 · 방학 목표 · 날마다 체크하는 습관 (학교생활 메뉴) */
(function () {
  'use strict';
  const { esc } = YT;
  const COLORS = ['#F3D9B1', '#CFE3D4', '#D5DCF0', '#F2D3D3', '#E8E0C2', '#D2E8E9', '#E4D5EB', '#F1DCC9', '#D9E7C7', '#DCD6CF', '#F4E4B6', '#CADFEA', '#EBD2DD', '#D2E4DE', '#E3DAF1', '#F3D7C3'];
  const SEASONS = ['여름방학', '겨울방학', '봄방학'];
  const PRESET = [['22:00', '07:00', '잠'], ['07:00', '08:00', '씻기·아침'], ['08:00', '10:00', '공부'], ['10:00', '12:00', '운동·놀이'], ['12:00', '13:00', '점심'],
    ['13:00', '15:00', '독서·숙제'], ['15:00', '18:00', '자유 시간'], ['18:00', '19:00', '저녁'], ['19:00', '21:00', '가족 시간'], ['21:00', '22:00', '일기·정리']];
  const DEF_HABITS = ['일찍 일어나기', '책 30분 읽기', '방학 숙제', '운동하기', '일기 쓰기'];
  const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const days = (a, b) => { const out = []; for (let t = Date.parse(a + 'T00:00:00Z'); t <= Date.parse(b + 'T00:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
  const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8)}`;
  const dow = (d) => '일월화수목금토'[new Date(d + 'T00:00:00Z').getUTCDay()];

  // 24시간 동그라미 (맨 위가 밤 12시)
  function clock(routine, size = 300) {
    const R = size / 2 - 22, c = size / 2;
    const pt = (m, r) => { const a = (m / 1440) * 2 * Math.PI - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    let slices = '', labels = '';
    routine.forEach((b, i) => {
      const s = mins(b.start); let e = mins(b.end); if (e <= s) e += 1440; const span = e - s;
      const [x1, y1] = pt(s, R), [x2, y2] = pt(e, R);
      slices += `<path d="M${c},${c} L${x1},${y1} A${R},${R} 0 ${span > 720 ? 1 : 0} 1 ${x2},${y2} Z" fill="${COLORS[i % COLORS.length]}" stroke="var(--bg)" stroke-width="1.5"><title>${esc(b.start)}~${esc(b.end)} ${esc(b.label)}</title></path>`;
      if (span >= 50) { const [lx, ly] = pt(s + span / 2, R * (span > 300 ? 0.55 : 0.66)); labels += `<text x="${lx}" y="${ly}" class="vc-l" text-anchor="middle" dominant-baseline="middle">${esc(b.label)}</text>`; }
    });
    let ticks = '';
    for (let h = 0; h < 24; h++) { const [x1, y1] = pt(h * 60, R), [x2, y2] = pt(h * 60, R + (h % 3 ? 4 : 7)); ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="vc-t"/>`; if (h % 3 === 0) { const [tx, ty] = pt(h * 60, R + 15); ticks += `<text x="${tx}" y="${ty}" class="vc-h" text-anchor="middle" dominant-baseline="middle">${h}</text>`; } }
    return `<svg class="vc" viewBox="0 0 ${size} ${size}" role="img" aria-label="하루 생활계획표"><circle cx="${c}" cy="${c}" r="${R}" class="vc-bg"/>${slices}${ticks}${labels}<circle cx="${c}" cy="${c}" r="3" class="vc-dot"/></svg>`;
  }

  function editor(v, onSaved) {
    const d = v ? { ...v.data } : { student: YT.state.user.display_name, title: '', season: new Date().getMonth() < 6 ? '여름방학' : '겨울방학', start: YT.today(), end: YT.addDays(YT.today(), 30), motto: '', goals: [], routine: PRESET.map(([start, end, label]) => ({ start, end, label })), habits: DEF_HABITS.slice() };
    const routine = (d.routine || []).map((x) => ({ ...x }));
    const m = YT.modal(`<h2 class="modal-title">${v ? '방학계획표 고치기' : '새 방학계획표'}</h2><form class="form" id="vcForm">
      <div class="form-row"><label>누구<input class="input" name="student" required maxlength="30" value="${esc(d.student || '')}"></label>
        <label>방학<select class="select" name="season">${SEASONS.map((s) => `<option ${s === d.season ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      <div class="form-row"><label>시작<input type="date" class="input" name="start" required value="${esc(d.start)}"></label><label>끝<input type="date" class="input" name="end" required value="${esc(d.end)}"></label></div>
      <label>제목 (선택)<input class="input" name="title" maxlength="60" value="${esc(d.title || '')}" placeholder="예: 신나고 알찬 여름방학"></label>
      <label>나의 다짐 (선택)<input class="input" name="motto" maxlength="120" value="${esc(d.motto || '')}" placeholder="예: 하루 한 권 책 읽기!"></label>
      <div class="block"><span>하루 생활계획 <small class="muted">— 동그라미 시간표로 그려져요</small></span><div id="vcRt" class="vc-rows"></div>
        <div class="row gap"><button type="button" class="btn small" id="vcAdd">+ 시간 더하기</button><button type="button" class="btn small ghost" id="vcPreset">기본 계획 불러오기</button></div></div>
      <label>방학 목표 <small class="muted">한 줄에 하나 (10개까지)</small><textarea class="input" name="goals" rows="4" placeholder="수영 배우기&#10;책 20권 읽기">${esc((d.goals || []).map((g) => g.text).join('\n'))}</textarea></label>
      <label>날마다 체크할 일 <small class="muted">한 줄에 하나 (8개까지)</small><textarea class="input" name="habits" rows="4">${esc((d.habits || []).join('\n'))}</textarea></label>
      ${v && (v.data.habits || []).length ? '<p class="muted small">체크할 일의 순서나 개수를 바꾸면 지난 체크가 다른 줄로 옮겨질 수 있어요.</p>' : ''}
      <div class="row gap end">${v ? '<button type="button" class="btn danger ghost" id="vcDel">지우기</button>' : ''}<button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`, { wide: true });
    const box = m.el.querySelector('#vcRt');
    const draw = () => { box.innerHTML = routine.map((r, i) => `<div class="vc-row"><i style="background:${COLORS[i % COLORS.length]}"></i><input type="time" class="input sm" data-i="${i}" data-k="start" value="${esc(r.start)}" aria-label="시작"><span>~</span><input type="time" class="input sm" data-i="${i}" data-k="end" value="${esc(r.end)}" aria-label="끝"><input class="input sm grow" data-i="${i}" data-k="label" maxlength="20" value="${esc(r.label)}" placeholder="할 일" aria-label="할 일"><button type="button" class="icon-x" data-rm="${i}" aria-label="지우기">×</button></div>`).join('') || '<p class="muted small">시간을 더해 보세요.</p>'; };
    draw();
    box.oninput = (e) => { const t = e.target; if (t.dataset.i != null) routine[+t.dataset.i][t.dataset.k] = t.value; };
    box.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { routine.splice(+b.dataset.rm, 1); draw(); } };
    m.el.querySelector('#vcAdd').onclick = () => { if (routine.length >= 16) return YT.toast('16칸까지 넣을 수 있어요.', 'error'); const last = routine[routine.length - 1]; routine.push({ start: last ? last.end : '09:00', end: '', label: '' }); draw(); };
    m.el.querySelector('#vcPreset').onclick = () => { if (routine.length && !YT.confirm('지금 적은 하루 계획을 기본 계획으로 바꿀까요?')) return; routine.splice(0, routine.length, ...PRESET.map(([start, end, label]) => ({ start, end, label }))); draw(); };
    const del = m.el.querySelector('#vcDel');
    if (del) del.onclick = async () => { if (!YT.confirm('이 방학계획표를 지울까요?')) return; try { await YT.del('/api/items/' + v.id); m.close(); YT.toast('지웠어요.'); onSaved(null); } catch (err) { YT.err(err); } };
    m.el.querySelector('#vcForm').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const oldGoals = new Map((d.goals || []).map((g) => [g.text, g.done]));
      const data = { student: f.student, season: f.season, start: f.start, end: f.end, title: f.title, motto: f.motto,
        routine: routine.filter((r) => r.label && r.start && r.end),
        goals: f.goals.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10).map((text) => ({ text, done: !!oldGoals.get(text) })),
        habits: f.habits.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8), checks: v ? v.data.checks : {} };
      try { let id = v && v.id; if (v) await YT.put('/api/items/' + v.id, { data, date: data.start }); else id = (await YT.post('/api/items', { kind: 'vacation', data, date: data.start })).id; m.close(); YT.toast('저장했어요.'); onSaved(id); } catch (err) { YT.err(err); }
    };
  }

  function planHtml(v) {
    const d = v.data; const today = YT.today(); const all = days(d.start, d.end); const habits = d.habits || []; const checks = d.checks || {};
    const passed = all.filter((x) => x <= today); const total = passed.length * habits.length;
    const doneN = passed.reduce((n, x) => n + (checks[x] || []).length, 0);
    const pct = total ? Math.round((doneN / total) * 100) : 0;
    const left = Math.round((Date.parse(d.end) - Date.parse(today)) / 864e5);
    const status = today < d.start ? `방학까지 D-${Math.round((Date.parse(d.start) - Date.parse(today)) / 864e5)}` : today > d.end ? '방학이 끝났어요' : `방학 ${passed.length}일째 · ${left}일 남았어요`;
    const inVac = today >= d.start && today <= d.end;
    const tdone = checks[today] || [];
    const goals = d.goals || [];
    return `<section class="vc-head"><div><span class="vc-season">${esc(d.season || '방학')}</span><h2>${esc(d.title || `${d.student}의 ${d.season || '방학'} 계획표`)}</h2>
        <p class="muted">${esc(d.student)} · ${md(d.start)}(${dow(d.start)}) ~ ${md(d.end)}(${dow(d.end)}) · ${all.length}일 · <b>${status}</b></p>${d.motto ? `<p class="vc-motto">“${esc(d.motto)}”</p>` : ''}</div>
        ${v.can_edit ? '<button class="btn small" data-edit>고치기</button>' : ''}</section>
      <div class="vc-grid">
        <section class="g-panel"><div class="g-ph"><h3>하루 생활계획표</h3></div>${(d.routine || []).length ? `<div class="vc-clock">${clock(d.routine)}</div>
          <ol class="vc-list">${d.routine.map((b, i) => `<li><i style="background:${COLORS[i % COLORS.length]}"></i><span>${esc(b.start)} ~ ${esc(b.end)}</span><b>${esc(b.label)}</b></li>`).join('')}</ol>` : '<p class="muted">아직 하루 계획이 없어요.</p>'}</section>
        <div class="vc-col">
          ${habits.length && inVac ? `<section class="g-panel vc-today"><div class="g-ph"><h3>오늘 할 일 <small class="muted">${md(today)}(${dow(today)})</small></h3><span class="muted small">${tdone.length} / ${habits.length}</span></div>
            <div class="vc-checks">${habits.map((h, i) => `<button class="vc-chk ${tdone.includes(i) ? 'on' : ''}" data-day="${today}" data-h="${i}" ${v.can_edit ? '' : 'disabled'} aria-pressed="${tdone.includes(i)}"><span aria-hidden="true">${tdone.includes(i) ? '✓' : ''}</span>${esc(h)}</button>`).join('')}</div></section>` : ''}
          ${goals.length ? `<section class="g-panel"><div class="g-ph"><h3>방학 목표</h3><span class="muted small">${goals.filter((g) => g.done).length} / ${goals.length} 이뤘어요</span></div>
            <ul class="vc-goals">${goals.map((g, i) => `<li><button class="vc-goal ${g.done ? 'on' : ''}" data-goal="${i}" ${v.can_edit ? '' : 'disabled'} aria-pressed="${g.done}"><span aria-hidden="true">${g.done ? '★' : '☆'}</span>${esc(g.text)}</button></li>`).join('')}</ul></section>` : ''}
          ${habits.length ? `<section class="g-panel"><div class="g-ph"><h3>얼마나 지켰나</h3><span class="muted small">지난 날 기준 ${pct}%</span></div><div class="vc-bar"><i style="width:${pct}%"></i></div>
            <ul class="vc-stat">${habits.map((h, i) => { const n = passed.filter((x) => (checks[x] || []).includes(i)).length; return `<li><span>${esc(h)}</span><b>${n}</b><small>/ ${passed.length}일</small></li>`; }).join('')}</ul></section>` : ''}
        </div></div>
      ${habits.length ? `<section class="g-panel"><div class="g-ph"><h3>날마다 체크</h3><span class="muted small">${v.can_edit ? '칸을 누르면 체크돼요' : ''}</span></div>
        <div class="vc-table-wrap"><table class="vc-table"><thead><tr><th></th>${all.map((x) => `<th class="${x === today ? 'today' : ''} ${'토일'.includes(dow(x)) ? 'we' : ''}"><small>${dow(x)}</small>${x === all[0] || x.slice(8) === '01' ? md(x) : +x.slice(8)}</th>`).join('')}</tr></thead>
          <tbody>${habits.map((h, i) => `<tr><th>${esc(h)}</th>${all.map((x) => { const on = (checks[x] || []).includes(i); return `<td class="${x === today ? 'today' : ''}"><button class="vc-cell ${on ? 'on' : ''}" data-day="${x}" data-h="${i}" ${v.can_edit && x <= today ? '' : 'disabled'} aria-label="${md(x)} ${esc(h)}" aria-pressed="${on}">${on ? '✓' : ''}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>` : ''}`;
  }

  YT.addRoute('/vacation', async (view) => {
    view.className = 'container';
    if (!YT.state.user) return YT.needLogin(view, '가족 계정으로 로그인하면 방학계획표를 볼 수 있어요.');
    let items = (await YT.api('/api/items?kind=vacation')).items;
    let cur = YT.query().id || '';
    const draw = () => {
      items.sort((a, b) => (b.data.start || '').localeCompare(a.data.start || ''));
      const today = YT.today();
      if (!items.find((x) => x.id === cur)) cur = (items.find((x) => x.data.start <= today && x.data.end >= today && x.can_edit) || items.find((x) => x.data.start <= today && x.data.end >= today) || items[0] || {}).id || '';
      const v = items.find((x) => x.id === cur);
      view.innerHTML = YT.subTabs('school') + YT.pageHead('', '방학계획표', '동그라미 생활계획표로 하루를 짜고, 방학 목표와 날마다 할 일을 체크해요.',
        YT.can('reporter') ? '<button class="btn primary" id="vcNew">+ 새 방학계획표</button>' : '')
        + (items.length > 1 ? `<div class="chips">${items.map((x) => `<button class="chip ${x.id === cur ? 'on' : ''}" data-pick="${x.id}">${esc(x.data.student)} · ${esc(x.data.start.slice(0, 4))} ${esc(x.data.season || '')}</button>`).join('')}</div>` : '')
        + (v ? `<div class="vc">${planHtml(v)}</div>` : `<div class="empty-state"><h2>아직 방학계획표가 없어요</h2><p class="muted">방학 기간을 정하고, 하루 생활계획과 방학 목표, 날마다 체크할 일을 적어 보세요.</p>${YT.can('reporter') ? '<button class="btn primary" id="vcNew2">방학계획표 만들기</button>' : ''}</div>`);
      const tw = view.querySelector('.vc-table-wrap'), th = tw && tw.querySelector('thead th.today');
      if (tw && th) tw.scrollLeft = Math.max(0, th.offsetLeft - tw.clientWidth / 2);
      const saved = async (id) => { items = (await YT.api('/api/items?kind=vacation')).items; cur = id || ''; draw(); };
      ['#vcNew', '#vcNew2'].forEach((s) => { const b = YT.$(s); if (b) b.onclick = () => editor(null, saved); });
      view.onclick = async (e) => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.pick) { cur = b.dataset.pick; draw(); return; }
        if (b.hasAttribute('data-edit')) return editor(v, saved);
        if (!v) return;
        const checks = JSON.parse(JSON.stringify(v.data.checks || {})); const goals = (v.data.goals || []).map((g) => ({ ...g }));
        if (b.dataset.day) { const day = b.dataset.day, h = +b.dataset.h; const list = checks[day] || []; checks[day] = list.includes(h) ? list.filter((x) => x !== h) : [...list, h]; }
        else if (b.dataset.goal != null) { const g = goals[+b.dataset.goal]; g.done = !g.done; if (g.done) YT.toast(`목표 달성! ‘${g.text}’`); }
        else return;
        const prev = v.data; v.data = { ...v.data, checks, goals }; draw(); // 먼저 그리고
        try { await YT.put('/api/items/' + v.id, { quick: true, data: { checks, goals } }); } catch (err) { v.data = prev; draw(); YT.err(err); }
      };
    };
    draw();
  });
})();
