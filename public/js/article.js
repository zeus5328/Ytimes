/* 기사 보기 + 반응·댓글 */
(function () {
  'use strict';
  const { esc } = YT;

  YT.renderBlocks = (blocks) => (blocks || []).map((b) => {
    if (b.type === 'photo') return `<figure class="blk-photo ${esc(b.align || 'center')} ${esc(b.size || 'medium')}"><img src="${YT.photoUrl(b.photo)}" alt="${esc(b.caption || '')}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    if (b.type === 'audio') return b.audio ? `<figure class="blk-audio"><figcaption><b>${esc(b.caption || '목소리 듣기')}</b>${b.duration ? `<small>${YT.mmss(b.duration)}</small>` : ''}</figcaption><audio controls preload="none" src="${YT.audioUrl(b.audio)}"></audio></figure>` : '';
    return String(b.text || '').split(/\n{2,}/).map((p) => p.trim() ? `<p>${YT.nl2br(p)}</p>` : '').join('');
  }).join('');

  const STATUS = { draft: '초안', pending: '승인 대기', approved: '승인 완료', published: '발행됨', changes: '수정 요청' };
  YT.STATUS = STATUS;

  YT.addRoute('/article/:id', async (view, { id }) => {
    const { article: a } = await YT.api('/api/articles/' + encodeURIComponent(id));
    const all = a.status === 'published' ? await YT.getArticles() : [];
    const idx = all.findIndex((x) => x.id === a.id);
    const prev = idx >= 0 ? all[idx + 1] : null, next = idx > 0 ? all[idx - 1] : null;
    const tagList = YT.tags(a.hashtags);
    const related = all.filter((x) => x.id !== a.id && (YT.tags(x.hashtags).some((t) => tagList.includes(t)) || x.section === a.section)).slice(0, 3);
    const canEdit = YT.can('editor') || a.is_own;
    view.innerHTML = `
      ${a.status !== 'published' || (YT.state.user && YT.articleButtons && YT.articleButtons(a).buttons.length) ? `<div class="review-bar ${a.status !== 'published' ? 'unpub' : ''}" id="reviewBar">
        <div><span class="status s-${a.status}">${esc(STATUS[a.status])}</span> ${a.status !== 'published' ? '<b>아직 공개되지 않은 기사예요</b>' : ''}
          <div class="muted small">${esc(YT.articleNext ? YT.articleNext(a) : '')}</div>
          ${a.status === 'changes' && a.review_note ? `<div class="nr-note"><b>검토 메모</b> ${esc(a.review_note)}</div>` : ''}</div>
        <div class="nr-actions">${YT.state.user && YT.articleButtons ? YT.articleButtons(a).buttons.map(([act, label, kind]) => `<button class="btn small ${kind}" data-act="${act}">${label}</button>`).join('') : ''}${canEdit ? `<a class="btn small" href="#/write/${a.id}">수정</a>` : ''}${YT.can('reporter') ? '<a class="btn small ghost" href="#/newsroom">편집실</a>' : ''}</div>
      </div>` : ''}
      <article class="article ${a.section === '그림 일기' ? 'sec-drawing' : ''}">
        <div class="art-kicker"><a href="#/articles?section=${encodeURIComponent(a.section)}">${esc(a.section)}</a> · ${esc(a.category)} · ${esc(YT.monthLabel(a.issue_month || ''))}호</div>
        <h1 class="art-title">${esc(a.title)}</h1>
        <div class="art-byline"><span><b>${esc(a.author_name)}</b> 기자</span><span>${esc(YT.shortDate(a.published_at || a.updated))} 발행</span><span>${YT.readMinutes(a)}분 읽기</span>${a.status === 'published' ? `<span>조회 ${(a.views || 0) + 1}</span>` : ''}${a.revision > 1 ? `<span>${a.revision}차 수정본</span>` : ''}</div>
        ${a.photo ? `<figure class="art-main-photo"><img src="${YT.photoUrl(a.photo)}" alt="${esc(a.photo_caption || a.title)}">${a.photo_caption ? `<figcaption>${esc(a.photo_caption)}</figcaption>` : ''}</figure>` : ''}
        ${'speechSynthesis' in window ? `<div class="art-listen"><button class="btn small" id="ttsBtn" aria-pressed="false">소리로 듣기</button>${a.status === 'published' ? `<a class="btn small" href="#/read?from=${a.id}">크게 읽기</a>` : ''}<span class="tts-rate" id="ttsRate" hidden><button class="btn tiny" data-rate="0.8">천천히</button><button class="btn tiny" data-rate="1">보통</button><button class="btn tiny" data-rate="1.2">빠르게</button></span></div>` : ''}
        <div class="art-body">${YT.renderBlocks(a.blocks)}</div>
        ${a.place ? `<a class="art-place" href="#/map?focus=${a.id}">${esc(a.place.name)} <small>여행 지도에서 보기</small></a>` : ''}
        ${tagList.length ? `<div class="art-tags">${tagList.map((t) => `<a class="tag" href="#/people/${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</div>` : ''}
        <div class="art-tools">
          <button class="btn small" id="printArt">인쇄</button>
          <button class="btn small" id="copyLink">공유하기</button>
          ${canEdit ? `<a class="btn small" href="#/write/${a.id}">수정</a>` : ''}
          <a class="btn small" href="#/print/${esc(a.issue_month)}">${esc(YT.monthLabel(a.issue_month || ''))} 지면 보기</a>
        </div>
        ${(a.writers || []).length ? `<section class="art-writers" aria-label="기자 소개">${a.writers.map((w) => `<div class="aw-card">
          <span class="aw-avatar" aria-hidden="true">${esc(YT.initials(w.name))}</span>
          <div class="aw-body"><div class="aw-name"><b>${esc(w.name)}</b>${w.id ? ' 기자' : ''}${w.role_label ? `<span class="aw-role">${esc(w.role_label)}</span>` : ''}${a.writers.length > 1 ? `<span class="aw-role ghost">${w.lead ? '대표 기자' : '함께 쓴 기자'}</span>` : ''}</div>
            <div class="aw-meta">${w.count ? `지금까지 기사 ${w.count}편 발행` : '첫 기사를 준비하고 있어요'}${w.since ? ` · ${esc(YT.monthLabel(w.since.slice(0, 7)))}부터 활동` : ''}</div>
            ${w.recent.length ? `<ul class="aw-recent">${w.recent.map((r) => `<li><a href="#/article/${r.id}">${esc(r.title)}</a></li>`).join('')}</ul>` : ''}</div></div>`).join('')}</section>` : ''}
        ${a.status === 'published' ? `
        <section class="reactions" aria-label="응원 반응">
          <div class="rx-label">이 기사에 마음 남기기</div>
          <div class="rx-row" id="rxRow">${YT.state.emojis.map((e) => `<button class="rx" data-emoji="${e}" aria-pressed="false"><span>${e}</span><b>${a.reactions[e] || 0}</b></button>`).join('')}</div>
        </section>
        <section class="comments" aria-label="댓글">
          <h2 class="c-head">가족 댓글 <span id="cCount">${a.comment_count}</span></h2>
          <ul class="c-list" id="cList"><li class="muted">불러오는 중…</li></ul>
          ${YT.state.user ? `<form class="c-form" id="cForm"><div class="c-who">${esc(YT.state.user.display_name)}</div>
            <textarea class="input" name="body" maxlength="500" rows="2" placeholder="따뜻한 한마디를 남겨주세요 (최대 500자)" required></textarea>
            <button class="btn primary">댓글 달기</button></form>`
            : `<p class="muted small">댓글은 가족 계정으로 <a href="#/login?next=${encodeURIComponent(location.hash)}">로그인</a> 후 남길 수 있어요. 반응 버튼은 누구나 누를 수 있어요.</p>`}
        </section>` : ''}
      </article>
      ${related.length ? `<section class="related"><div class="side-head"><h2>함께 읽으면 좋은 기사</h2></div><div class="card-grid three">${related.map((r) => YT.articleCard(r, { excerpt: false })).join('')}</div></section>` : ''}
      <nav class="art-nav">${prev ? `<a href="#/article/${prev.id}">← 이전 기사<br><b>${esc(prev.title)}</b></a>` : '<span></span>'}
        <a href="#/" class="center">기사 목록으로</a>
        ${next ? `<a href="#/article/${next.id}" class="right">다음 기사 →<br><b>${esc(next.title)}</b></a>` : '<span></span>'}</nav>`;

    const rb = YT.$('#reviewBar');
    if (rb) rb.onclick = async (e) => { const b = e.target.closest('[data-act]'); if (!b) return; b.disabled = true; const r = await YT.articleAct(a, b.dataset.act); b.disabled = false; if (r) YT.route(); };
    YT.$('#printArt').onclick = () => window.print();
    // 소리로 듣기 — 기기에 들어 있는 한국어 목소리로 제목과 본문을 읽어 준다
    const tb = YT.$('#ttsBtn');
    if (tb) {
      let rate = +(YT.store.get('yt_tts_rate', '0.9')) || 0.9; let playing = false;
      const text = [a.title, ...(a.blocks || []).filter((b) => b.type === 'text').map((b) => b.text), a.photo_caption].filter(Boolean).join('\n\n');
      const chunks = text.split(/(?<=[.!?。…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
      const voice = () => speechSynthesis.getVoices().find((v) => /^ko/i.test(v.lang));
      const stop = () => { speechSynthesis.cancel(); playing = false; tb.textContent = '소리로 듣기'; tb.setAttribute('aria-pressed', 'false'); YT.$('#ttsRate').hidden = true; };
      const play = () => {
        speechSynthesis.cancel(); playing = true; tb.textContent = '그만 듣기'; tb.setAttribute('aria-pressed', 'true'); YT.$('#ttsRate').hidden = false;
        chunks.forEach((c, i) => { const u = new SpeechSynthesisUtterance(c); u.lang = 'ko-KR'; u.rate = rate; const v = voice(); if (v) u.voice = v; if (i === chunks.length - 1) u.onend = () => { if (playing) stop(); }; speechSynthesis.speak(u); });
      };
      tb.onclick = () => (playing ? stop() : play());
      YT.$('#ttsRate').onclick = (e) => { const r = e.target.closest('[data-rate]'); if (!r) return; rate = +r.dataset.rate; YT.store.set('yt_tts_rate', String(rate)); if (playing) play(); };
      window.addEventListener('hashchange', () => speechSynthesis.cancel(), { once: true });
    }
    // 발행된 기사는 /a/기사ID 주소로 공유 — 카카오톡·문자에서 제목과 사진이 카드로 보인다
    YT.$('#copyLink').onclick = () => YT.share(`${a.title} — ${YT.state.settings.site_name}`, a.status === 'published' && !window.YTPreview ? `${location.origin}/a/${a.id}` : location.href);
    if (a.status !== 'published') return;
    // 조회수: 같은 탭에서는 한 번만
    try { const k = 'yt_viewed_' + a.id; if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); YT.post(`/api/articles/${a.id}/view`).then(() => YT.clearCache()).catch(() => {}); } } catch {}

    // 반응
    const row = YT.$('#rxRow');
    const paint = (counts, mine) => YT.$$('.rx', row).forEach((b) => {
      const e = b.dataset.emoji; if (counts) b.querySelector('b').textContent = counts[e] || 0;
      if (mine) { const on = mine.includes(e); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    });
    YT.api(`/api/articles/${a.id}/react`).then((r) => paint(null, r.mine)).catch(() => {});
    row.onclick = async (e) => {
      const b = e.target.closest('.rx'); if (!b) return;
      b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 300);
      try { const r = await YT.post(`/api/articles/${a.id}/react`, { emoji: b.dataset.emoji }); paint(r.reactions, r.mine); YT.clearCache(); } catch (err) { YT.err(err); }
    };

    // 댓글
    const loadComments = async () => {
      const { comments } = await YT.api(`/api/articles/${a.id}/comments`);
      YT.$('#cCount').textContent = comments.filter((c) => !c.deleted).length;
      const one = (c, reply) => c.deleted ? `<li class="c-item gone"><div class="c-body muted">삭제된 댓글이에요.</div>` : `<li class="c-item ${reply ? 'reply' : ''}"><div class="c-meta"><b>${esc(c.name)}</b> · ${esc(YT.relTime(c.created))}
        ${YT.state.user ? `<button class="linklike" data-reply="${reply ? c.parent_id : c.id}" data-to="${esc(c.name)}">답글</button>` : ''}${c.can_edit ? `<button class="linklike" data-cedit="${c.id}">고치기</button>` : ''}${c.can_delete ? `<button class="linklike danger" data-del="${c.id}">삭제</button>` : ''}</div><div class="c-body" data-cbody="${c.id}">${YT.nl2br(c.body)}</div>`;
      const tops = comments.filter((c) => !c.parent_id);
      YT.$('#cList').innerHTML = tops.length ? tops.map((c) => { const rs = comments.filter((r) => r.parent_id === c.id);
        return one(c) + (rs.length ? `<ul class="c-replies">${rs.map((r) => one(r, true) + '</li>').join('')}</ul>` : '') + `<div class="c-reply-slot" data-slot="${c.id}"></div></li>`; }).join('')
        : '<li class="muted">첫 댓글을 남겨주세요.</li>';
    };
    loadComments();
    let comments = [];
    YT.$('#cList').onclick = async (e) => {
      const rp = e.target.closest('[data-reply]');
      if (rp) { // 답글 쓰기 칸을 원댓글 아래에 연다
        const slot = YT.$(`[data-slot="${rp.dataset.reply}"]`); if (!slot) return;
        if (slot.querySelector('form')) { slot.innerHTML = ''; return; }
        slot.innerHTML = `<form class="c-form reply"><textarea class="input" rows="2" maxlength="500" required placeholder="${esc(rp.dataset.to)}님께 답글">${rp.closest('.reply') ? '@' + esc(rp.dataset.to) + ' ' : ''}</textarea><div class="row gap"><button class="btn small primary">답글 달기</button><button type="button" class="btn small" data-cancel>취소</button></div></form>`;
        const fm = slot.querySelector('form'); const ta = fm.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        fm.querySelector('[data-cancel]').onclick = () => { slot.innerHTML = ''; };
        fm.onsubmit = async (ev) => { ev.preventDefault(); try { const r = await YT.post(`/api/articles/${a.id}/comments`, { body: ta.value, parent_id: rp.dataset.reply }); YT.toast('답글을 남겼어요.' + (r.points ? ` +${r.points}포인트` : '')); loadComments(); YT.clearCache(); } catch (err) { YT.err(err); } };
        return;
      }
      const ce = e.target.closest('[data-cedit]');
      if (ce) {
        const id = ce.dataset.cedit; const box = YT.$(`[data-cbody="${id}"]`); if (box.querySelector('form')) return;
        const { comments: list } = await YT.api(`/api/articles/${a.id}/comments`); const c = list.find((x) => x.id === id); if (!c) return;
        box.innerHTML = `<form class="inline-edit col"><textarea class="input" rows="2" maxlength="500">${esc(c.body)}</textarea><div class="row gap"><button class="btn tiny primary">저장</button><button type="button" class="btn tiny" data-cancel>취소</button></div></form>`;
        const fm = box.querySelector('form'); fm.querySelector('textarea').focus();
        fm.querySelector('[data-cancel]').onclick = () => loadComments();
        fm.onsubmit = async (ev) => { ev.preventDefault(); try { await YT.put('/api/comments/' + id, { body: fm.querySelector('textarea').value }); YT.toast('댓글을 고쳤어요.'); loadComments(); } catch (err) { YT.err(err); } };
        return;
      }
      const d = e.target.closest('[data-del]'); if (!d || !YT.confirm('이 댓글을 삭제할까요?')) return;
      try { await YT.del('/api/comments/' + d.dataset.del); loadComments(); YT.clearCache(); } catch (err) { YT.err(err); }
    };
    const form = YT.$('#cForm');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await YT.post(`/api/articles/${a.id}/comments`, { body: form.body.value }); form.reset(); loadComments(); YT.clearCache(); YT.toast('댓글을 남겼어요.' + (r.points ? ` +${r.points}포인트` : '')); } catch (err) { YT.err(err); }
    };
  });

  // ── 크게 읽기: 어르신도 편하게 — 큰 글씨로 기사 한 편씩, 큰 버튼으로 넘기고 소리로 듣기
  YT.addRoute('/read', async (view, _p, q) => {
    const all = (await YT.getArticles(false, true)).filter((a) => a.status === 'published');
    const months = [...new Set(all.map((a) => a.issue_month).filter(Boolean))].sort().reverse();
    const from = all.find((a) => a.id === q.from);
    const ym = (from && from.issue_month) || (months.includes(q.month) ? q.month : months[0]);
    const list = all.filter((a) => a.issue_month === ym).sort((a, b) => (b.section === '헤드라인') - (a.section === '헤드라인') || (a.published_at || '').localeCompare(b.published_at || ''));
    let i = Math.max(0, list.findIndex((a) => a.id === q.from));
    const big = YT.store.get('yt_read_size', 'l');
    let auto = YT.store.get('yt_read_auto', '0') === '1', playing = false;
    const canTalk = 'speechSynthesis' in window;
    const stopTalk = () => { if (canTalk) speechSynthesis.cancel(); playing = false; const b = YT.$('#rdTalk'); if (b) { b.textContent = '소리로 듣기'; b.setAttribute('aria-pressed', 'false'); } };
    const talk = () => {
      const a = list[i]; stopTalk(); playing = true; const b = YT.$('#rdTalk'); b.textContent = '그만 듣기'; b.setAttribute('aria-pressed', 'true');
      const text = [a.title, ...(a.blocks || []).filter((x) => x.type === 'text').map((x) => x.text)].join('\n\n');
      const parts = text.split(/(?<=[.!?。…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
      const v = speechSynthesis.getVoices().find((x) => /^ko/i.test(x.lang));
      parts.forEach((c, k) => { const u = new SpeechSynthesisUtterance(c); u.lang = 'ko-KR'; u.rate = +(YT.store.get('yt_tts_rate', '0.9')) || 0.9; if (v) u.voice = v;
        if (k === parts.length - 1) u.onend = () => { if (!playing) return; stopTalk(); if (auto && i < list.length - 1) { go(1); setTimeout(talk, 600); } };
        speechSynthesis.speak(u); });
    };
    const draw = () => {
      view.className = 'container rd-wrap';
      if (!list.length) { view.innerHTML = YT.subTabs('articles') + '<div class="empty-state"><h2>아직 읽을 기사가 없어요</h2><a class="btn" href="#/">1면으로</a></div>'; return; }
      const a = list[i];
      view.innerHTML = YT.subTabs('articles') + `<div class="rd rd-${big}">
        <div class="rd-top"><span class="rd-issue">${months.length > 1 ? '' : esc(YT.monthLabel(ym)) + '호 · '}${i + 1} / ${list.length}<small> 번째 기사</small></span>
          <span class="rd-size" role="group" aria-label="글자 크기"><button type="button" data-size="m" class="${big === 'm' ? 'on' : ''}">가</button><button type="button" data-size="l" class="${big === 'l' ? 'on' : ''}">가</button><button type="button" data-size="xl" class="${big === 'xl' ? 'on' : ''}">가</button></span>
          ${months.length > 1 ? `<select class="select sm" id="rdMonth" aria-label="몇 월호">${months.map((m) => `<option value="${m}" ${m === ym ? 'selected' : ''}>${YT.monthLabel(m)}호</option>`).join('')}</select>` : ''}</div>
        <article class="rd-art">
          <div class="rd-kicker">${esc(a.section)}${a.category ? ' · ' + esc(a.category) : ''}</div>
          <h1>${esc(a.title)}</h1>
          <p class="rd-by">${esc(a.author_name)} 기자 · ${esc(YT.shortDate(a.published_at || a.updated))}</p>
          ${canTalk ? `<div class="rd-talk"><button class="btn primary" id="rdTalk" aria-pressed="false">소리로 듣기</button><label class="chk"><input type="checkbox" id="rdAuto" ${auto ? 'checked' : ''}> 다 들으면 다음 기사도 이어서</label></div>` : ''}
          ${a.photo && !(a.blocks || []).some((b) => b.photo === a.photo) ? `<figure class="art-main-photo"><img src="${YT.photoUrl(a.photo)}" alt="">${a.photo_caption ? `<figcaption>${esc(a.photo_caption)}</figcaption>` : ''}</figure>` : ''}
          <div class="art-body rd-body">${YT.renderBlocks(a.blocks)}</div>
          <p class="rd-more"><a href="#/article/${a.id}">댓글·반응 보기</a></p>
        </article>
        <nav class="rd-nav" aria-label="기사 넘기기"><button class="btn rd-btn" id="rdPrev" ${i === 0 ? 'disabled' : ''}>‹ 앞 기사</button><button class="btn rd-btn primary" id="rdNext" ${i >= list.length - 1 ? 'disabled' : ''}>다음 기사 ›</button></nav>
      </div>`;
      YT.$('#rdPrev').onclick = () => go(-1); YT.$('#rdNext').onclick = () => go(1);
      view.querySelector('.rd-size').onclick = (e) => { const b = e.target.closest('[data-size]'); if (!b) return; YT.store.set('yt_read_size', b.dataset.size); view.querySelector('.rd').className = 'rd rd-' + b.dataset.size; view.querySelectorAll('.rd-size button').forEach((x) => x.classList.toggle('on', x === b)); };
      const ms = YT.$('#rdMonth'); if (ms) ms.onchange = () => YT.go('#/read?month=' + ms.value);
      const tb = YT.$('#rdTalk'); if (tb) tb.onclick = () => (playing ? stopTalk() : talk());
      const au = YT.$('#rdAuto'); if (au) au.onchange = () => { auto = au.checked; YT.store.set('yt_read_auto', auto ? '1' : '0'); };
      YT.hoistSubBar(view);
    };
    const go = (d) => { const n = i + d; if (n < 0 || n >= list.length) return; const was = playing; stopTalk(); i = n; draw(); window.scrollTo({ top: 0 }); history.replaceState(null, '', '#/read?from=' + list[i].id); };
    draw();
    // 키보드 ←→, 휴대폰은 옆으로 쓸어 넘기기
    const onKey = (e) => { if (!document.querySelector('.rd')) return off(); if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    let sx = null, sy = null;
    const ts = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const te = (e) => { if (sx == null || !document.querySelector('.rd')) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); };
    const off = () => { removeEventListener('keydown', onKey); view.removeEventListener('touchstart', ts); view.removeEventListener('touchend', te); stopTalk(); removeEventListener('hashchange', offHash); };
    const offHash = () => off();
    addEventListener('keydown', onKey); view.addEventListener('touchstart', ts, { passive: true }); view.addEventListener('touchend', te, { passive: true }); addEventListener('hashchange', offHash);
  });
})();
