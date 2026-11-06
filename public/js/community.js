/* 가족 광장 — 투표 + 오늘의 한마디 (신규) */
(function () {
  'use strict';
  const { esc } = YT;
  const MOODS = ['😊', '🥰', '😂', '😴', '🤒', '😤', '🥳', '🙏'];
  YT.MOODS = MOODS;
  // 기분 날씨 — 한마디에 고른 기분을 날씨 말과 색으로 (달력·지면에는 그림 대신 색과 말)
  const MOOD_W = { '😊': ['맑음', '좋아요', '#E2B13C'], '🥰': ['포근', '사랑해요', '#E08A78'], '😂': ['쨍쨍', '웃겨요', '#EE8A3A'], '😴': ['흐림', '졸려요', '#A2A99F'],
    '🤒': ['비', '아파요', '#6C8DB1'], '😤': ['천둥', '속상해요', '#75627E'], '🥳': ['무지개', '신나요', '#5FA585'], '🙏': ['햇살', '고마워요', '#C2A06A'] };
  YT.MOOD_W = MOOD_W;
  const kstDay = (iso) => new Date(Date.parse(iso) + 9 * 36e5).toISOString().slice(0, 10);
  const moodLegend = () => `<div class="mw-legend">${MOODS.map((m) => `<span><i style="--c:${MOOD_W[m][2]}"></i>${MOOD_W[m][0]}<small>${MOOD_W[m][1]}</small></span>`).join('')}</div>`;
  const tally = (notes) => { const c = {}; for (const n of notes) if (MOOD_W[n.mood]) c[n.mood] = (c[n.mood] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  // 지면용 요약: 사람마다 한 달 날짜 칸에 색을 칠한 띠 + 가장 많았던 날씨
  YT.moodSummaryHtml = (notes, ym) => {
    const ns = notes.filter((n) => MOOD_W[n.mood]); if (!ns.length) return '';
    const [y, m] = ym.split('-').map(Number); const days = new Date(y, m, 0).getDate();
    const people = [...new Set(ns.map((n) => n.name))].slice(0, 6);
    const top = tally(ns)[0];
    return `<p class="mw-top">이달 가장 많은 날씨 <b>${MOOD_W[top[0]][0]}</b> <small>${MOOD_W[top[0]][1]} · ${top[1]}번</small></p><div class="mw-strips">${people.map((p) => {
      const mine = ns.filter((n) => n.name === p); const byDay = {}; for (const n of mine) byDay[+kstDay(n.created).slice(8)] = n.mood;
      const best = tally(mine)[0];
      return `<div class="mw-row"><b>${esc(p)}</b><span class="mw-strip" style="--n:${days}">${Array.from({ length: days }, (_, i) => `<i${byDay[i + 1] ? ` style="--c:${MOOD_W[byDay[i + 1]][2]}"` : ''}></i>`).join('')}</span><small>${MOOD_W[best[0]][0]}</small></div>`; }).join('')}</div>${moodLegend()}`;
  };
  // 가족 광장의 기분 날씨 달력
  async function moodCalendar(box, ym) {
    const { notes } = await YT.api('/api/notes?month=' + ym);
    const ns = notes.filter((n) => MOOD_W[n.mood]);
    const [y, m] = ym.split('-').map(Number); const first = new Date(y, m - 1, 1).getDay(); const days = new Date(y, m, 0).getDate();
    const byDay = {}; for (const n of ns) (byDay[kstDay(n.created)] = byDay[kstDay(n.created)] || []).push(n);
    const today = YT.today(); const prev = m === 1 ? `${y - 1}-12` : `${y}-${YT.pad(m - 1)}`, next = m === 12 ? `${y + 1}-01` : `${y}-${YT.pad(m + 1)}`;
    const top = tally(ns);
    box.innerHTML = `<div class="mw-head"><button class="btn small ghost" data-ym="${prev}" aria-label="이전 달">‹</button><b>${y}년 ${m}월</b><button class="btn small ghost" data-ym="${next}" aria-label="다음 달" ${next > today.slice(0, 7) ? 'disabled' : ''}>›</button>
        <span class="muted small grow">${ns.length ? `한마디 ${ns.length}개 · 가장 많은 날씨 <b>${MOOD_W[top[0][0]][0]}</b>` : '이달에는 아직 한마디가 없어요.'}</span></div>
      <div class="mw-cal"><div class="mw-dow">${'일월화수목금토'.split('').map((d) => `<span>${d}</span>`).join('')}</div><div class="mw-grid">${'<span></span>'.repeat(first)}${Array.from({ length: days }, (_, i) => {
        const d = `${ym}-${YT.pad(i + 1)}`; const list = byDay[d] || [];
        return `<button type="button" class="mw-day ${d === today ? 'today' : ''} ${list.length ? 'has' : ''}" data-day="${d}" ${list.length ? '' : 'disabled'} aria-label="${m}월 ${i + 1}일${list.length ? ` 한마디 ${list.length}개` : ''}"><small>${i + 1}</small><span class="mw-dots">${list.slice(-6).map((n) => `<i style="--c:${MOOD_W[n.mood][2]}" title="${esc(n.name)} · ${MOOD_W[n.mood][0]}"></i>`).join('')}</span></button>`; }).join('')}</div></div>
      ${moodLegend()}<div class="mw-detail" id="mwDetail"></div>`;
    box.onclick = (e) => {
      const nav = e.target.closest('[data-ym]'); if (nav && !nav.disabled) return moodCalendar(box, nav.dataset.ym);
      const day = e.target.closest('[data-day]'); if (!day) return;
      box.querySelectorAll('.mw-day.sel').forEach((x) => x.classList.remove('sel')); day.classList.add('sel');
      const list = byDay[day.dataset.day] || [];
      box.querySelector('#mwDetail').innerHTML = `<h4>${+day.dataset.day.slice(5, 7)}월 ${+day.dataset.day.slice(8)}일</h4><ul>${list.map((n) => `<li><i style="--c:${MOOD_W[n.mood][2]}"></i><b>${esc(n.name)}</b> <small>${MOOD_W[n.mood][0]} · ${MOOD_W[n.mood][1]}</small><p>${esc(n.body)}</p></li>`).join('')}</ul>`;
    };
  }

  // ── 투표 카드
  YT.pollCard = (p) => {
    const total = p.counts.reduce((a, b) => a + b, 0);
    const voted = p.mine.length > 0;
    const showResult = voted || p.closed;
    return `<div class="poll" data-poll="${p.id}">
      <div class="poll-q"><h3>${esc(p.question)}</h3>
        <span class="poll-meta">${p.closed ? '<b class="tag-closed">마감</b>' : p.closes ? `${esc(p.closes)}까지` : '진행 중'} · ${p.voters}명 참여${p.multi ? ' · 여러 개 선택' : ''}</span></div>
      <div class="poll-opts">${p.options.map((o, i) => {
        const pct = total ? Math.round((p.counts[i] / total) * 100) : 0;
        const mine = p.mine.includes(i);
        return `<button class="poll-opt ${mine ? 'mine' : ''} ${showResult ? 'show' : ''}" data-opt="${i}" ${p.closed ? 'disabled' : ''} aria-pressed="${mine}" style="--pct:${pct}%">
          <span class="po-label">${esc(o)}</span>${showResult ? `<span class="po-num">${p.counts[i]}표 · ${pct}%</span>` : ''}
          ${showResult && p.names[i].length ? `<span class="po-names">${p.names[i].map(esc).join(', ')}</span>` : ''}</button>`;
      }).join('')}</div>
      ${p.can_add && !p.closed && p.options.length < 12 ? `<form class="poll-add" data-add-opt="${p.id}"><input class="input sm" name="opt" maxlength="60" placeholder="${p.allow_add ? '다른 의견이 있으면 보기를 더하세요' : '보기 더하기'}" aria-label="보기 더하기"><button class="btn small">더하기</button></form>` : ''}
      ${p.multi && !p.closed ? '<button class="btn small primary poll-submit">선택 저장</button>' : ''}
      <div class="poll-foot"><span>${esc(p.author_name || '')} 님이 물어봤어요${p.allow_add ? ' · 누구나 보기 추가 가능' : ''}</span>
        ${p.can_manage ? `<span class="poll-manage"><button class="linklike" data-edit-poll="${p.id}">수정</button>${p.closed ? `<button class="linklike" data-reopen-poll="${p.id}">다시 열기</button>` : `<button class="linklike" data-close-poll="${p.id}">마감하기</button>`}<button class="linklike danger" data-del-poll="${p.id}">삭제</button></span>` : ''}</div>
    </div>`;
  };
  YT.bindPolls = (root, polls, redraw) => {
    const refresh = async (id) => { const r = await YT.api('/api/polls'); const fresh = r.polls.find((x) => x.id === id); const p = polls.find((x) => x.id === id); if (fresh && p) Object.assign(p, fresh); redraw(); };
    root.addEventListener('submit', async (e) => {
      const f = e.target.closest('[data-add-opt]'); if (!f) return; e.preventDefault();
      const text = f.opt.value.trim(); if (!text) return;
      try { await YT.post(`/api/polls/${f.dataset.addOpt}/options`, { text }); YT.toast('보기를 더했어요.'); await refresh(f.dataset.addOpt); } catch (err) { YT.err(err); }
    });
    root.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-poll]'); if (!el) return;
      const p = polls.find((x) => x.id === el.dataset.poll); if (!p) return;
      const opt = e.target.closest('[data-opt]');
      try {
        if (opt && !p.closed) {
          const i = +opt.dataset.opt;
          if (p.multi) { opt.classList.toggle('mine'); return; }
          const r = await YT.post(`/api/polls/${p.id}/vote`, { options: p.mine.includes(i) ? [] : [i] });
          Object.assign(p, r.poll); redraw();
        } else if (e.target.closest('.poll-submit')) {
          const picks = [...el.querySelectorAll('.poll-opt.mine')].map((b) => +b.dataset.opt);
          const r = await YT.post(`/api/polls/${p.id}/vote`, { options: picks }); Object.assign(p, r.poll); redraw(); YT.toast('투표했어요.');
        } else if (e.target.closest('[data-edit-poll]')) {
          YT.openPollForm(() => refresh(p.id), p);
        } else if (e.target.closest('[data-reopen-poll]')) {
          await YT.post(`/api/polls/${p.id}/reopen`, {}); YT.toast('투표를 다시 열었어요.'); await refresh(p.id);
        } else if (e.target.closest('[data-close-poll]')) {
          if (!YT.confirm('이 투표를 마감할까요?')) return;
          await YT.post(`/api/polls/${p.id}/close`); p.closed = true; redraw();
        } else if (e.target.closest('[data-del-poll]')) {
          if (!YT.confirm('이 투표를 삭제할까요?')) return;
          await YT.del('/api/polls/' + p.id); polls.splice(polls.indexOf(p), 1); redraw();
        }
      } catch (err) { YT.err(err); }
    });
  };
  // 새 투표 · 투표 고치기 (p가 있으면 고치기)
  YT.openPollForm = (onSaved, p) => {
    const editing = !!p;
    let opts = editing ? p.options.map((t, i) => ({ text: t, from: i, votes: p.counts[i] })) : [{ text: '' }, { text: '' }, { text: '' }].map((o) => ({ ...o, from: null, votes: 0 }));
    const m = YT.modal(`<h2 class="modal-title">${editing ? '투표 고치기' : '가족에게 물어보기'}</h2><form class="form" id="pollForm">
      <label class="block">질문<input class="input" name="question" maxlength="120" required placeholder="이번 주말 저녁 메뉴는?" value="${editing ? esc(p.question) : ''}"></label>
      <div class="block"><span>보기 (2~12개)${editing && p.voters ? ` <small class="muted">· 지금까지 ${p.voters}명 참여 — 글자를 고쳐도 표는 그대로, 지운 보기의 표만 사라져요</small>` : ''}</span>
        <div id="pOpts" class="opt-list"></div>
        <button type="button" class="btn small" id="addOpt">+ 보기 추가</button></div>
      <div class="form-row"><label>마감일 (선택)<input type="date" class="input" name="closes" value="${editing ? esc(p.closes || '') : ''}"></label></div>
      <div class="poll-flags">
        <label class="check"><input type="checkbox" name="multi" ${editing && p.multi ? 'checked' : ''}> 여러 개 고를 수 있게</label>
        <label class="check"><input type="checkbox" name="allow_add" ${editing && p.allow_add ? 'checked' : ''}> 가족 누구나 보기를 더할 수 있게</label>
        ${editing && p.closed ? '<label class="check"><input type="checkbox" name="reopen" checked> 마감 풀고 다시 열기</label>' : ''}
      </div>
      <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">${editing ? '고친 내용 저장' : '투표 올리기'}</button></div></form>`);
    const f = m.el.querySelector('#pollForm'); const list = m.el.querySelector('#pOpts');
    const sync = () => { list.querySelectorAll('[data-o]').forEach((inp) => { opts[+inp.dataset.o].text = inp.value; }); };
    const draw = () => {
      list.innerHTML = opts.map((o, i) => `<div class="opt-row"><span class="opt-n">${i + 1}</span><input class="input" data-o="${i}" maxlength="60" value="${esc(o.text)}" placeholder="보기 ${i + 1}">
        ${o.votes ? `<small class="muted nowrap">${o.votes}표</small>` : ''}<button type="button" class="icon-x" data-rmo="${i}" aria-label="보기 ${i + 1} 지우기" ${opts.length <= 2 ? 'disabled' : ''}>×</button></div>`).join('');
      m.el.querySelector('#addOpt').disabled = opts.length >= 12;
    };
    draw();
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rmo]'); if (!b) return; sync();
      const o = opts[+b.dataset.rmo];
      if (o.votes && !YT.confirm(`‘${o.text}’에 들어온 ${o.votes}표도 함께 사라져요. 지울까요?`)) return;
      opts.splice(+b.dataset.rmo, 1); draw();
    });
    list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.o !== undefined && !e.isComposing) { e.preventDefault(); if (+e.target.dataset.o === opts.length - 1 && opts.length < 12) { sync(); opts.push({ text: '', from: null, votes: 0 }); draw(); list.querySelector(`[data-o="${opts.length - 1}"]`).focus(); } else { const n = list.querySelector(`[data-o="${+e.target.dataset.o + 1}"]`); n && n.focus(); } } });
    m.el.querySelector('#addOpt').onclick = () => { sync(); if (opts.length >= 12) return; opts.push({ text: '', from: null, votes: 0 }); draw(); list.querySelector(`[data-o="${opts.length - 1}"]`).focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); sync();
      const body = { question: f.question.value, options: opts.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), from: o.from })), closes: f.closes.value, multi: f.multi.checked, allow_add: f.allow_add.checked, reopen: !!(f.reopen && f.reopen.checked) };
      try {
        if (editing) await YT.put('/api/polls/' + p.id, body); else await YT.post('/api/polls', body);
        m.close(); YT.toast(editing ? '투표를 고쳤어요.' : '투표를 올렸어요.'); onSaved && onSaved();
      } catch (err) { YT.err(err); }
    };
    setTimeout(() => f.question.focus(), 50);
  };

  // ── 한마디
  YT.noteItem = (n) => `<li class="note"><span class="note-mood" aria-hidden="true">${esc(n.mood || '')}</span>
    <div class="grow"><p data-note-body="${n.id}">${esc(n.body)}</p><span class="note-meta">${esc(n.name)} · ${esc(YT.relTime(n.created))}${n.can_edit ? ` <button class="linklike" data-edit-note="${n.id}">고치기</button>` : ''}${n.can_delete ? ` <button class="linklike danger" data-del-note="${n.id}">삭제</button>` : ''}</span></div></li>`;
  YT.noteForm = () => YT.can('subscriber') ? `<form class="note-form" id="noteForm">
      <div class="mood-pick" role="radiogroup" aria-label="오늘 기분">${MOODS.map((m, i) => `<label><input type="radio" name="mood" value="${m}" ${i === 0 ? 'checked' : ''}><span>${m}</span></label>`).join('')}</div>
      <div class="note-row"><input class="input" name="body" maxlength="140" placeholder="오늘 하루 어땠나요? (140자)" required><button class="btn primary">남기기</button></div></form>`
    : YT.state.user ? '<p class="muted small">오늘의 한마디는 구독자 이상 계정에서 남길 수 있어요.</p>'
    : `<p class="muted small"><a href="#/login?next=${encodeURIComponent(location.hash || '#/')}">로그인</a>하면 한마디를 남길 수 있어요.</p>`;
  YT.bindNotes = (root, reload) => {
    const f = root.querySelector('#noteForm');
    if (f) f.onsubmit = async (e) => { e.preventDefault(); try { await YT.post('/api/notes', { body: f.body.value, mood: f.mood.value }); f.body.value = ''; reload(); } catch (err) { YT.err(err); } };
    root.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit-note]');
      if (ed) { // 그 자리에서 고치기
        const id = ed.dataset.editNote; const p = root.querySelector(`[data-note-body="${id}"]`); if (!p || p.querySelector('form')) return;
        const old = p.textContent;
        p.innerHTML = `<form class="inline-edit"><input class="input sm" maxlength="140" value="${esc(old)}" aria-label="한마디 고치기"><button class="btn tiny primary">저장</button><button type="button" class="btn tiny" data-cancel>취소</button></form>`;
        const fm = p.querySelector('form'); const inp = fm.querySelector('input'); inp.focus(); inp.select();
        fm.querySelector('[data-cancel]').onclick = () => { p.textContent = old; };
        fm.onsubmit = async (ev) => { ev.preventDefault(); try { await YT.put('/api/notes/' + id, { body: inp.value }); YT.toast('한마디를 고쳤어요.'); reload(); } catch (err) { YT.err(err); } };
        return;
      }
      const d = e.target.closest('[data-del-note]'); if (!d || !YT.confirm('이 한마디를 지울까요?')) return;
      try { await YT.del('/api/notes/' + d.dataset.delNote); reload(); } catch (err) { YT.err(err); }
    });
  };

  // ── 가족 광장 페이지
  YT.addRoute('/board', async (view) => {
    const [{ polls }, { notes }] = await Promise.all([YT.api('/api/polls'), YT.api('/api/notes?limit=100')]);
    view.innerHTML = YT.pageHead('', '가족 광장', '가족에게 물어보고, 오늘 기분을 한 줄로 남기는 곳이에요.',
      YT.can('subscriber') ? '<button class="btn primary" id="newPoll">가족에게 물어보기</button>' : '')
      + `<div class="board">
        <section><div class="side-head"><h2>가족 투표</h2><span>${polls.length}개</span></div><div id="pollList" class="poll-list"></div></section>
        <section><div class="side-head"><h2>오늘의 한마디</h2></div>${YT.noteForm()}<ul class="note-list" id="noteList"></ul>
          <div class="mw-sec"><div class="side-head"><h2>기분 날씨 달력</h2><span class="muted small">한마디의 기분이 날씨로 모여요</span></div><div id="mwBox"><p class="muted small">불러오는 중…</p></div></div></section>
      </div>`;
    const drawPolls = () => { YT.$('#pollList').innerHTML = polls.length ? polls.map(YT.pollCard).join('') : `<div class="empty-state small">아직 투표가 없어요.${YT.can('subscriber') ? ' 저녁 메뉴부터 물어볼까요?' : ''}</div>`; };
    const drawNotes = (list) => { YT.$('#noteList').innerHTML = list.length ? list.map(YT.noteItem).join('') : '<li class="muted">첫 한마디를 남겨주세요.</li>'; };
    drawPolls(); drawNotes(notes);
    YT.bindPolls(YT.$('#pollList'), polls, drawPolls);
    const mwBox = YT.$('#mwBox'); const mw = () => moodCalendar(mwBox, YT.today().slice(0, 7)).catch(() => { mwBox.innerHTML = ''; });
    mw();
    YT.bindNotes(view, async () => { drawNotes((await YT.api('/api/notes?limit=100')).notes); mw(); });
    const np = YT.$('#newPoll'); if (np) np.onclick = () => YT.openPollForm(() => YT.route());
  });
})();
