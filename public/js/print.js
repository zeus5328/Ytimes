/* 이달의 지면 — 한 달 기사를 신문 1면처럼 한 장에 배치해 인쇄·PDF 저장
   화면과 인쇄가 똑같이 보이도록 실제 용지 폭(A4 718px · A3 1047px, 여백 10mm 제외)으로 짜고,
   화면에서는 폭에 맞게 줄여 보여줍니다. 휴대폰은 ‘읽기 편하게’ 보기도 고를 수 있어요. */
(function () {
  'use strict';
  const { esc } = YT;
  const PAPER = { A4: 718, A3: 1047 }; // 인쇄 가능 폭(px, 96dpi) = 용지 폭 - 좌우 여백 20mm
  const PAD = 38; // 화면에서 보이는 종이 여백 (10mm)
  const textOf = (a) => (a.blocks || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n\n').trim();
  const clip = (t, max) => (max && t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + ' …' : t);
  const paras = (t) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${YT.nl2br(p)}</p>`).join('');
  const md = (d) => `${+d.slice(5, 7)}.${YT.pad(+d.slice(8))}`;
  const issueNo = (ym, founded) => {
    const [y, m] = ym.split('-').map(Number); const [fy, fm] = (founded || ym).split('-').map(Number);
    return Math.max(1, (y - fy) * 12 + (m - fm) + 1);
  };
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
  const fig = (a, cls = '') => a.photo ? `<figure class="np-fig ${cls}"><img src="${YT.photoUrl(a.photo)}" alt="">${a.photo_caption ? `<figcaption>${esc(a.photo_caption)}</figcaption>` : ''}</figure>` : '';
  const hasAudio = (a) => (a.blocks || []).some((b) => b.type === 'audio' && b.audio);
  const qrBox = (a) => hasAudio(a) ? `<div class="np-qr" data-qr="${esc(location.origin + '/a/' + a.id)}"><span class="qr-slot"></span><small><b>목소리 듣기</b>휴대폰 카메라로 찍으면<br>기사에서 바로 들려요</small></div>` : '';
  const kicker = (a) => `<div class="np-kicker">${esc(a.section)}${a.category ? ` · ${esc(a.category)}` : ''}</div>`;

  function leadHtml(a) {
    // 사진이 있으면 사진을 제목 아래 넓게 싣고, 본문은 그 아래 여러 단으로
    const t = clip(textOf(a), a.photo ? 1300 : 2400); const n = t.length;
    const cols = n < 280 ? 1 : n < 800 ? 2 : 3;
    const size = a.title.length <= 12 ? 'xl' : a.title.length <= 22 ? 'lg' : 'md';
    return `<section class="np-lead ${a.photo ? 'has-photo' : ''}">
      ${kicker(a)}
      <h2 class="np-headline ${size}">${esc(a.title)}</h2>
      <div class="np-byline">${esc(a.author_name)} 기자 · ${esc(YT.shortDate(a.published_at || a.updated))}</div>
      ${fig(a, 'lead')}
      <div class="np-cols c${cols} ${n >= 200 ? 'dropcap' : ''} ${n < 280 ? 'standfirst' : ''}">${paras(t) || '<p class="np-muted">본문이 아직 없어요.</p>'}</div>
      ${qrBox(a)}
    </section>`;
  }
  function storyHtml(a, i) {
    // 사진 기사: 글(한 단) + 오른쪽 사진. 사진 없는 긴 글만 두 단으로
    const t = clip(textOf(a), a.photo ? 650 : 1100); const two = !a.photo && t.length > 420;
    return `<article class="np-story ${i === 0 ? 'first' : ''} ${a.photo ? 'has-photo' : ''}">
      ${kicker(a)}<h3>${esc(a.title)}</h3>
      <div class="np-story-body">
        <div class="np-cols ${two ? 'c2' : 'c1'}">${paras(t)}</div>
        ${fig(a, 'side')}
      </div>
      ${qrBox(a)}<div class="np-byline end">${esc(a.author_name)} 기자</div></article>`;
  }

  // ── 친척에게 링크 보내기: 계정 없는 친척이 이번 호만 정한 날까지 읽는 링크
  async function shareLinks(ym) {
    const m = YT.modal(`<h2 class="modal-title">${YT.monthLabel(ym)}호 — 친척에게 링크 보내기</h2>
      <p class="muted small">계정이 없는 친척도 이 링크로 <b>이번 호 기사만</b> 읽을 수 있어요(사진·목소리 포함). 정한 날이 지나거나 ‘링크 끄기’를 누르면 더는 열리지 않아요.</p>
      <form class="form sl-form" id="slForm"><div class="evf-row">
        <label class="grow">누구에게 <small class="muted">(선택)</small><input class="input" name="label" maxlength="40" placeholder="예) 큰고모, 외갓집"></label>
        <label>열어 둘 기간<select class="select" name="days"><option value="3">3일</option><option value="7">1주일</option><option value="14" selected>2주일</option><option value="30">한 달</option><option value="90">석 달</option></select></label></div>
        <div class="row gap end"><button class="btn primary">링크 만들기</button></div></form>
      <div id="slList" class="sl-list"><p class="muted small">불러오는 중…</p></div>`, { wide: true });
    const box = m.el.querySelector('#slList');
    const url = (t) => `${location.origin}/i/${t}`;
    const draw = async () => {
      const { links } = await YT.api('/api/share-links?month=' + ym);
      box.innerHTML = links.length ? `<h3 class="sl-h">이번 호 링크</h3><ul>${links.map((l) => `<li class="${l.active ? '' : 'off'}"><div class="grow"><b>${esc(l.label || '이름 없이 보낸 링크')}</b>
          <small>${l.active ? `${esc(l.expires)}까지 열림` : l.revoked ? '꺼짐' : '기간 끝남'} · 열어 본 횟수 ${l.views}번${l.last_view ? ` · 마지막 ${esc(YT.relTime(l.last_view))}` : ''} · ${esc(l.created_name)}</small>
          ${l.active ? `<input class="input sm" readonly value="${esc(url(l.token))}" aria-label="링크 주소">` : ''}</div>
          ${l.active ? `<div class="sl-act"><button class="btn small" data-copy="${esc(l.token)}">복사</button>${navigator.share ? `<button class="btn small" data-send="${esc(l.token)}" data-label="${esc(l.label)}">보내기</button>` : ''}<button class="btn small ghost danger" data-off="${esc(l.token)}">링크 끄기</button></div>` : ''}</li>`).join('')}</ul>`
        : '<p class="muted small">아직 만든 링크가 없어요.</p>';
    };
    const copy = async (t) => { try { await navigator.clipboard.writeText(url(t)); YT.toast('링크를 복사했어요. 카카오톡·문자에 붙여 넣어 보내세요.'); } catch { YT.toast('복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.', 'error'); } };
    box.onclick = async (e) => {
      const c = e.target.closest('[data-copy]'), sd = e.target.closest('[data-send]'), off = e.target.closest('[data-off]');
      if (c) copy(c.dataset.copy);
      if (sd) { try { await navigator.share({ title: `${YT.state.settings.site_name} ${YT.monthLabel(ym)}호`, text: '우리 가족 신문 이번 호예요.', url: url(sd.dataset.send) }); } catch {} }
      if (off && YT.confirm('이 링크를 끌까요? 받은 사람은 더 이상 열 수 없어요.')) { try { await YT.del('/api/share-links/' + off.dataset.off); YT.toast('링크를 껐어요.'); draw(); } catch (err) { YT.err(err); } }
      const inp = e.target.closest('input[readonly]'); if (inp) inp.select();
    };
    const f = m.el.querySelector('#slForm');
    f.onsubmit = async (e) => { e.preventDefault(); try { const { link } = await YT.post('/api/share-links', { month: ym, days: f.days.value, label: f.label.value }); f.label.value = ''; await draw(); copy(link.token); } catch (err) { YT.err(err); } };
    draw().catch((err) => { box.innerHTML = `<p class="muted small">${esc(err.message)}</p>`; });
  }

  async function page(view, params) {
    const all = await YT.getArticles(false, true);
    const months = [...new Set(all.map((a) => a.issue_month).filter(Boolean))].sort().reverse();
    const ym = params.month || months[0] || YT.today().slice(0, 7);
    if (!months.includes(ym)) months.unshift(ym);
    const arts = all.filter((a) => a.issue_month === ym);
    const S = YT.state.settings;
    const [y, m] = ym.split('-').map(Number);
    const first = YT.ymd(y, m, 1), last = YT.addDays(YT.ymd(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1), -1);
    const [occ0, pollsR, notesR] = await Promise.all([YT.occurrencesBetween(first, last).catch(() => []), YT.api('/api/polls').catch(() => ({ polls: [] })), YT.api('/api/notes?month=' + ym).catch(() => ({ notes: [] }))]);
    const inMonth = (d) => (d || '').slice(0, 7) === ym;
    const mPolls = pollsR.polls.filter((p) => inMonth(p.created) && p.voters).slice(0, 2);
    const monthNotes = notesR.notes; const mNotes = monthNotes.slice().reverse().slice(0, 6);
    const moodBox = YT.moodSummaryHtml ? YT.moodSummaryHtml(monthNotes, ym) : '';
    const seen = new Set(); const occ = occ0.filter((o) => { const k = o.date + '|' + o.title; if (seen.has(k)) return false; seen.add(k); return true; });

    const lead = arts.find((a) => a.section === '헤드라인') || arts.find((a) => a.photo) || arts[0];
    const rest = arts.filter((a) => a !== lead);
    const photoPick = rest.find((a) => a.section === '포토제닉' && a.photo);
    const weather = rest.find((a) => a.section === '우리 집 날씨');
    const others = rest.filter((a) => a !== photoPick && a !== weather);
    const long = others.filter((a) => a.photo || textOf(a).length >= 220);
    const briefs = others.filter((a) => !long.includes(a));
    const special = occ.filter((o) => o.kind !== 'event');
    const plain = occ.filter((o) => o.kind === 'event');
    const photos = arts.reduce((n, a) => n + (a.photo ? 1 : 0) + (a.blocks || []).filter((b) => b.type === 'photo').length, 0);
    const order = [lead, ...long, ...briefs, photoPick, weather].filter(Boolean);
    const list = (items, fmt, max = 9) => `<ul class="np-list">${items.slice(0, max).map(fmt).join('')}${items.length > max ? `<li class="np-more">외 ${items.length - max}건</li>` : ''}</ul>`;

    view.className = 'container wide';
    view.innerHTML = `
      <div class="print-controls no-print">
        ${YT.pageHead('', '지면', '한 달 동안 발행된 기사를 진짜 신문처럼 한 장에 모았어요. 인쇄하거나 PDF로 저장해 가족에게 나눠주세요.')}${YT.subTabs('paper')}
        <div class="pc-row">
          <label>발행월 <select class="select" id="pMonth">${months.map((x) => `<option value="${x}" ${x === ym ? 'selected' : ''}>${YT.monthLabel(x)}호</option>`).join('')}</select></label>
          <label>용지 <select class="select" id="pSize"><option value="A4">A4 세로</option><option value="A3">A3 세로</option></select></label>
          <div class="pv-seg" role="group" aria-label="보기 방식"><button type="button" class="pv-btn" data-view="sheet">지면 그대로</button><button type="button" class="pv-btn" data-view="flow">읽기 편하게</button></div>
          <button class="btn primary" id="pPrint">인쇄 · PDF로 저장</button>
          ${YT.can('editor') ? '<button class="btn" id="pShare">친척에게 링크 보내기</button>' : ''}
        </div>
        <p class="muted small">인쇄 창에서 ‘배경 그래픽’을 켜고 머리글·바닥글은 끄면 가장 깔끔해요. 화면의 ‘지면 그대로’ 모양 그대로 인쇄돼요.</p>
      </div>
      <div class="paper-wrap" id="paperWrap"><div class="paper" id="paper">
        <header class="np-mast">
          <div class="np-ears"><span>제${issueNo(ym, S.founded)}호</span><span>${esc(S.kicker || '')}</span><span>${y}년 ${m}월호</span></div>
          <h1 class="np-name">${esc(S.site_name)}</h1>
          <div class="np-sub"><span>${esc(S.tagline || '')}</span><span>창간 ${esc((S.founded || '').replace(/-/g, '.'))}</span><span>가족 무료 · 기사 ${arts.length}편</span></div>
        </header>
        ${arts.length ? `
        ${leadHtml(lead)}
        <div class="np-grid">
          <div class="np-main">
            ${long.map(storyHtml).join('')}
            ${photoPick ? `<article class="np-story photo-pick"><div class="np-kicker">포토제닉 · 이달의 한 장</div>${fig(photoPick, 'wide')}<p class="np-pick-cap"><b>${esc(photoPick.title)}</b> <span>${esc(photoPick.author_name)} 기자</span></p></article>` : ''}
            ${briefs.length ? `<section class="np-briefs"><h4 class="np-sec">짧은 소식</h4><div class="np-brief-grid">${briefs.map((a) => `<article class="np-brief"><h5>${esc(a.title)}</h5>${textOf(a) ? `<p>${YT.nl2br(clip(textOf(a), 200))}</p>` : ''}${qrBox(a)}<span class="np-byline">${esc(a.author_name)} 기자</span></article>`).join('')}</div></section>` : ''}
            ${long.length + briefs.length + (photoPick ? 1 : 0) < 3 && (mPolls.length || mNotes.length) ? `<section class="np-square"><h4 class="np-sec">가족 광장에서</h4>
              ${mPolls.map((p) => { const tot = p.counts.reduce((x, y) => x + y, 0) || 1; const best = Math.max(...p.counts);
                return `<div class="np-poll"><b>${esc(p.question)}</b><span class="np-byline">${p.voters}명 참여${p.closed ? ' · 마감' : ''}</span><ul>${p.options.map((o, i) => `<li class="${p.counts[i] === best && best ? 'win' : ''}"><span>${esc(o)}</span><i style="--w:${Math.round(p.counts[i] / tot * 100)}%"></i><small>${p.counts[i]}표</small></li>`).join('')}</ul></div>`; }).join('')}
              ${mNotes.length ? `<div class="np-notes">${mNotes.map((n) => `<p><span>${esc(n.mood || '')}</span>“${esc(n.body)}” <small>— ${esc(n.name)}, ${+n.created.slice(8, 10)}일</small></p>`).join('')}</div>` : ''}
            </section>` : ''}
            ${!long.length && !briefs.length && !photoPick && !mPolls.length && !mNotes.length ? `<p class="np-muted np-pad">이번 호는 1면 기사 한 편으로 꾸몄어요. 가족 광장에 투표나 한마디를 남기면 이 자리에 함께 실려요.</p>` : ''}
          </div>
          <aside class="np-side">
            ${special.length ? `<div class="np-box"><h4>이달의 축하</h4>${list(special, (o) => `<li><b>${md(o.date)}</b><span>${YT.eventIcon(o)} ${esc(o.title)}${o.age ? ` <small>${o.age}세</small>` : ''}${o.anniversary_years ? ` <small>${o.anniversary_years}주년</small>` : ''}</span></li>`)}</div>` : ''}
            ${plain.length ? `<div class="np-box"><h4>가족 일정</h4>${list(plain, (o) => `<li><b>${md(o.date)}</b><span>${esc(o.title)}${o.location ? ` <small>· ${esc(o.location)}</small>` : ''}</span></li>`)}</div>` : ''}
            ${weather ? `<div class="np-box weather"><h4>우리 집 날씨</h4><b>${esc(weather.title)}</b><p>${YT.nl2br(clip(textOf(weather), 260))}</p></div>` : ''}
            <div class="np-box np-stats"><h4>숫자로 본 이번 호</h4><div class="np-nums">
              <div><b>${arts.length}</b><span>기사</span></div><div><b>${photos}</b><span>사진</span></div>
              <div><b>${special.length}</b><span>생일·기념일</span></div><div><b>${plain.length}</b><span>가족 일정</span></div></div></div>
            ${moodBox ? `<div class="np-box np-mood"><h4>이달의 기분 날씨</h4>${moodBox}</div>` : ''}
            ${S.editor_note ? `<div class="np-box np-note"><h4>편집자의 말</h4><p>${YT.nl2br(S.editor_note)}</p></div>` : ''}
            <div class="np-box"><h4>이번 호 차례</h4><ol class="np-toc">${order.map((a) => `<li><span>${esc(a.title)}</span><small>${esc(a.section)}</small></li>`).join('')}</ol></div>
          </aside>
        </div>` : `<div class="np-empty">${YT.monthLabel(ym)}에 발행된 기사가 없어요.<br>편집실에서 기사를 발행하면 이 지면이 채워집니다.</div>`}
        <footer class="np-foot"><span>발행 · ${esc(S.site_name)} 편집국</span><span>${esc(S.site_name)}는 가족이 함께 만드는 신문입니다</span><span>${y}.${YT.pad(m)}</span></footer>
      </div></div>`;

    const wrap = YT.$('#paperWrap'), paper = YT.$('#paper');
    let mode = store('yt_paper_view') || (innerWidth < 760 ? 'flow' : 'sheet');
    const fit = () => {
      const w = PAPER[paper.dataset.size || 'A4'] + PAD * 2;
      paper.style.setProperty('--pw', PAPER[paper.dataset.size || 'A4'] + 'px');
      if (mode === 'flow') { paper.style.zoom = ''; return; }
      const avail = wrap.clientWidth; paper.style.zoom = avail < w ? (avail / w).toFixed(4) : '';
    };
    const setMode = (v) => {
      mode = v; wrap.classList.toggle('pv-flow', v === 'flow'); wrap.classList.toggle('pv-sheet', v !== 'flow');
      YT.$$('.pv-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      fit();
    };
    YT.$$('.pv-btn').forEach((b) => (b.onclick = () => { store('yt_paper_view', b.dataset.view); setMode(b.dataset.view); }));
    YT.$('#pMonth').onchange = (e) => YT.go('#/print/' + e.target.value);
    const sh = YT.$('#pShare'); if (sh) sh.onclick = () => shareLinks(ym);
    // 소리가 든 기사에는 QR 코드
    const slots = [...paper.querySelectorAll('.np-qr')];
    if (slots.length) Promise.all(slots.map(async (q) => { try { q.querySelector('.qr-slot').innerHTML = await YT.qrSvg(q.dataset.qr, 76); } catch { q.remove(); } })).then(() => fit());
    const sizeStyle = document.getElementById('pageSize') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pageSize' }));
    const setSize = () => { const s = YT.$('#pSize').value; store('yt_paper_size', s); sizeStyle.textContent = `@page { size: ${s} portrait; margin: 10mm; }`; paper.dataset.size = s; fit(); };
    YT.$('#pSize').value = store('yt_paper_size') === 'A3' ? 'A3' : 'A4';
    YT.$('#pSize').onchange = setSize; setSize(); setMode(mode);
    const onResize = YT.debounce(() => { if (document.body.contains(paper)) fit(); else removeEventListener('resize', onResize); }, 120);
    addEventListener('resize', onResize);
    // 인쇄할 때 한 장에 들어가도록: 폭을 넓혀 다시 배치하고 그만큼 줄이기를 몇 번 반복해 맞춘다
    const PAGE_H = { A4: 1047, A3: 1512 }; // 용지 높이 - 위아래 여백 20mm
    const fitOnePage = () => {
      const size = paper.dataset.size || 'A4', pw = PAPER[size], ph = PAGE_H[size];
      paper.style.zoom = ''; paper.style.setProperty('--pw', pw + 'px'); paper.classList.add('printing');
      let z = 1;
      for (let k = 0; k < 6; k++) {
        const h = paper.offsetHeight;
        if (h * z <= ph * 0.97 || z <= 0.7) break;
        z = Math.max(0.7, Math.min(z, (ph / h) * 0.96));
        paper.style.setProperty('--pw', Math.round(pw / z) + 'px');
      }
      // 글씨가 너무 작아지면서까지 한 장에 넣지는 않는다 — 그럴 땐 원래 크기로 여러 장
      if (paper.offsetHeight * z > ph * 0.99) { z = 1; paper.style.setProperty('--pw', pw + 'px'); }
      paper.style.zoom = z < 1 ? z.toFixed(4) : '';
      return z;
    };
    const unfit = () => { paper.classList.remove('printing'); paper.style.zoom = ''; fit(); };
    YT.fitPaperForPrint = fitOnePage;
    YT.$('#pPrint').onclick = () => {
      const prev = mode; setMode('sheet');
      document.body.classList.add('print-paper'); fitOnePage();
      const done = () => { document.body.classList.remove('print-paper'); unfit(); setMode(prev); removeEventListener('afterprint', done); };
      addEventListener('afterprint', done);
      // 사진을 모두 불러온 뒤 인쇄
      Promise.all([...paper.querySelectorAll('img')].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => { window.print(); setTimeout(() => { if (document.body.classList.contains('print-paper')) done(); }, 1000); });
    };
  }
  // ── 연간 합본호: 한 해 기사를 표지·차례·월별로 엮은 책자 (A4 세로, 인쇄·PDF)
  async function yearBook(view, params) {
    const all = await YT.getArticles(false, true);
    const years = [...new Set(all.map((a) => (a.issue_month || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    const y = params.year || years[0] || YT.today().slice(0, 4);
    if (!years.includes(y)) years.unshift(y);
    const S = YT.state.settings;
    const arts = all.filter((a) => (a.issue_month || '').startsWith(y)).sort((a, b) => (a.issue_month + (a.published_at || '')).localeCompare(b.issue_month + (b.published_at || '')));
    const months = [...new Set(arts.map((a) => a.issue_month))];
    const photos = arts.reduce((n, a) => n + (a.photo ? 1 : 0) + (a.blocks || []).filter((b) => b.type === 'photo').length, 0);
    const cover = arts.find((a) => a.section === '포토제닉' && a.photo) || arts.find((a) => a.photo);
    // 연말 시상식 — 기자별 기록으로 상을 정하고, ‘올해의 기사’는 가족 투표로
    const [rs, pollsR] = await Promise.all([YT.api('/api/reporter-stats?year=' + y).catch(() => ({ stats: [], top: [] })), YT.api('/api/polls').catch(() => ({ polls: [] }))]);
    const best = (k) => { const l = rs.stats.filter((x) => x[k] > 0).sort((p, q) => q[k] - p[k]); return l.length ? l[0] : null; };
    const awards = [['', '올해의 기자상', best('articles'), (x) => `기사 ${x.articles}편`], ['', '사진 기자상', best('photos'), (x) => `사진 ${x.photos}장`], ['', '인기 기자상', best('reactions'), (x) => `반응 ${x.reactions}개`],
      ['', '댓글 요정상', best('comments'), (x) => `댓글 ${x.comments}개`], ['', '우체부상', best('cards'), (x) => `카드·편지 ${x.cards}장`]].filter((a) => a[2]);
    const voteQ = `${y}년 올해의 기사는?`; const vote = pollsR.polls.find((p) => p.question === voteQ);
    const voteWin = vote && vote.voters ? vote.options[vote.counts.indexOf(Math.max(...vote.counts))] : '';
    const body = (a) => (a.blocks || []).map((b) => b.type === 'photo' ? (b.photo ? `<figure class="bk-fig"><img src="${YT.photoUrl(b.photo)}" alt="" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : '') : b.type === 'audio' ? '' : (b.text || '').trim() ? paras(b.text) : '').join('');
    view.className = 'container wide';
    view.innerHTML = `
      <div class="print-controls no-print">
        ${YT.pageHead('', '지면', `${y}년 합본호 — 한 해 동안 발행한 기사를 표지·차례·시상식과 함께 한 권으로 엮었어요. 인쇄하거나 PDF로 저장해 선물해 보세요.`)}${YT.subTabs('paper')}
        <div class="pc-row">
          <label>연도 <select class="select" id="bkYear">${years.map((x) => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <button class="btn primary" id="bkPrint" ${arts.length ? '' : 'disabled'}>인쇄 · PDF로 저장</button>
        </div>
        <p class="muted small">인쇄 창에서 용지 A4 세로, ‘배경 그래픽’ 켜기, 머리글·바닥글 끄기를 고르세요. 달마다 새 쪽에서 시작해요.</p>
      </div>
      <div class="book-wrap"><div class="book" id="book">
        <section class="bk-cover">
          <div class="bk-ear"><span>${esc(S.kicker || '')}</span><span>창간 ${esc((S.founded || '').replace(/-/g, '.'))}</span></div>
          <h1 class="bk-name">${esc(S.site_name)}</h1>
          <div class="bk-year">${y}<span>합본호</span></div>
          ${cover ? `<figure class="bk-cover-ph"><img src="${YT.photoUrl(cover.photo)}" alt=""></figure>` : '<div class="bk-cover-ph empty" aria-hidden="true"></div>'}
          <div class="bk-stats"><div><b>${arts.length}</b><span>기사</span></div><div><b>${months.length}</b><span>개월</span></div><div><b>${photos}</b><span>사진</span></div></div>
          <p class="bk-tag">${esc(S.tagline || '')}</p>
        </section>
        ${arts.length ? `<section class="bk-toc"><h2>차례</h2>${months.map((m) => `<div class="bk-toc-m"><h3>${+m.slice(5)}월호</h3><ol>${arts.filter((a) => a.issue_month === m).map((a) => `<li><span>${esc(a.title)}</span><small>${esc(a.section)} · ${esc(a.author_name)}</small></li>`).join('')}</ol></div>`).join('')}</section>
        ${awards.length ? `<section class="bk-awards"><h2>${y} 유니 타임즈 시상식</h2>
          <div class="aw-grid">${awards.map(([ic, name, w, f]) => `<div class="aw"><small>${name}</small><b>${esc(w.name)}</b><em>${f(w)}</em>
            <span class="aw-badges">${YT.badgesOf ? YT.badgesOf(w).filter((b) => b.got).map((b) => esc(b.name)).join(' · ') : ''}</span></div>`).join('')}</div>
          <div class="aw-best"><small>올해의 기사 ${vote ? `(가족 투표 · ${vote.voters}명 참여)` : '(조회·반응·댓글 순)'}</small>
            <b>${esc(voteWin || (rs.top[0] ? rs.top[0].title : ''))}</b>
            <ol>${rs.top.slice(0, 5).map((t) => `<li>${esc(t.title)} <small>${esc(t.author_name)}</small></li>`).join('')}</ol></div>
          ${YT.can('editor') && rs.top.length >= 2 ? `<div class="no-print aw-act">${vote ? `<a class="btn small" href="#/board">투표 현황 보기</a>` : `<button class="btn small primary" id="awVote">‘올해의 기사’ 가족 투표 열기</button>`}<span class="muted small">후보 ${Math.min(8, rs.top.length)}편으로 가족 광장에 투표를 올려요.</span></div>` : ''}
        </section>` : ''}
        ${months.map((m) => `<section class="bk-month"><header class="bk-mhead"><span>${esc(S.site_name)}</span><h2>${+m.slice(5)}월호</h2><span>${y}.${m.slice(5)}</span></header>
          ${arts.filter((a) => a.issue_month === m).map((a) => `<article class="bk-art">
            <div class="np-kicker">${esc(a.section)} · ${esc(a.category)}</div><h3>${esc(a.title)}</h3>
            <div class="np-byline">${esc(a.author_name)} 기자 · ${esc(YT.shortDate(a.published_at || a.updated))}</div>
            ${a.photo ? `<figure class="bk-fig lead"><img src="${YT.photoUrl(a.photo)}" alt="" loading="lazy">${a.photo_caption ? `<figcaption>${esc(a.photo_caption)}</figcaption>` : ''}</figure>` : ''}
            <div class="bk-body">${body(a)}</div></article>`).join('')}</section>`).join('')}`
        : `<div class="np-empty">${y}년에 발행된 기사가 아직 없어요.</div>`}
        <footer class="bk-end"><b>${esc(S.site_name)}</b><span>${y}년 합본호 · 가족이 함께 만든 신문</span></footer>
      </div></div>`;
    YT.$('#bkYear').onchange = (e) => YT.go('#/print-year/' + e.target.value);
    const av = YT.$('#awVote'); if (av) av.onclick = async () => {
      try { await YT.post('/api/polls', { question: voteQ, options: rs.top.slice(0, 8).map((t) => t.title), closes: `${y}-12-31` }); YT.toast('가족 광장에 투표를 올렸어요.'); YT.route(); } catch (err) { YT.err(err); }
    };
    YT.$('#bkPrint').onclick = () => {
      const sizeStyle = document.getElementById('pageSize') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pageSize' }));
      sizeStyle.textContent = '@page { size: A4 portrait; margin: 14mm 14mm 16mm; }';
      document.body.classList.add('print-book');
      const imgs = [...YT.$('#book').querySelectorAll('img')]; imgs.forEach((i) => { i.loading = 'eager'; });
      Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => {
        const done = () => { document.body.classList.remove('print-book'); removeEventListener('afterprint', done); };
        addEventListener('afterprint', done); window.print(); setTimeout(() => { if (document.body.classList.contains('print-book')) done(); }, 1500);
      });
    };
  }
  // ── 우편 발송: 주소록(편집장 이상만) + A4 주소 라벨 인쇄
  const LABELS = {
    l16: { name: 'A4 16칸 (2줄×8칸, 99.1×33.9mm)', cols: 2, rows: 8, w: 99.1, h: 33.9, top: 12.9, left: 4.65, gx: 2.5, gy: 0 },
    l14: { name: 'A4 14칸 (2줄×7칸, 99.1×38.1mm)', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, gx: 2.5, gy: 0 },
    l21: { name: 'A4 21칸 (3줄×7칸, 63.5×38.1mm)', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.2, gx: 2.54, gy: 0 },
  };
  async function mail(view) {
    view.innerHTML = YT.subTabs('paper') + YT.pageHead('', '우편 발송', '친척에게 지면을 우편으로 보낼 때 — 주소록을 모아 두고 봉투에 붙일 주소 라벨을 한 번에 인쇄해요.');
    if (!YT.can('editor')) { view.insertAdjacentHTML('beforeend', '<div class="empty-state"><h2>편집장 이상만 볼 수 있어요</h2><p class="muted">주소는 소중한 개인 정보라 편집장·관리자만 보고 고칠 수 있어요.</p></div>'); return; }
    const from = (() => { try { return JSON.parse(localStorage.getItem('yt_mail_from') || '{}'); } catch { return {}; } })();
    view.insertAdjacentHTML('beforeend', `<div class="mail">
      <section class="panel"><div class="side-head"><h2>주소록</h2><button class="btn small primary" id="adAdd">+ 주소 더하기</button></div>
        <p class="muted small">체크한 분들만 라벨로 인쇄돼요. 주소는 편집장·관리자만 볼 수 있어요.</p><div id="adList"><p class="muted">불러오는 중…</p></div></section>
      <section class="panel"><div class="side-head"><h2>라벨 인쇄</h2></div>
        <form class="form" id="lbForm">
          <label class="block">라벨 용지<select class="select" name="type">${Object.entries(LABELS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
          <div class="evf-row"><label>시작 칸<input class="input" type="number" name="skip" min="1" max="21" value="1" style="max-width:6rem"></label><span class="muted small grow">쓰다 남은 라벨지는 비어 있는 첫 칸 번호를 적어요.</span></div>
          <fieldset class="mail-from"><legend>보내는 사람 <small class="muted">(이 기기에 저장)</small></legend>
            <div class="evf-row"><label class="grow">이름<input class="input" name="fname" maxlength="40" value="${esc(from.name || '')}" placeholder="예) 유니 타임즈 편집국"></label><label>우편번호<input class="input" name="fzip" maxlength="10" value="${esc(from.zip || '')}" style="max-width:7rem"></label></div>
            <label class="block">주소<input class="input" name="faddr" maxlength="200" value="${esc(from.addr || '')}"></label>
            <label class="chk"><input type="checkbox" name="fon" ${from.on ? 'checked' : ''}> 받는 분 라벨 안에 보내는 사람도 작게 넣기</label></fieldset>
          <div class="row gap"><button class="btn primary" id="lbPrint">라벨 인쇄</button><a class="btn" href="#/print">이달 지면 인쇄하러 가기</a></div>
          <p class="muted small">인쇄 창에서 <b>배율 100%(실제 크기)</b>, 여백 ‘없음’으로 고르면 칸에 딱 맞아요. 처음엔 보통 종이에 한 장 시험 인쇄해 라벨지와 겹쳐 보세요.</p>
        </form></section></div>
      <div id="lbSheet" class="lb-sheet-wrap" hidden></div>`);
    let list = [];
    const draw = async () => {
      list = (await YT.api('/api/items?kind=address')).items.sort((a, b) => a.data.name.localeCompare(b.data.name, 'ko'));
      YT.$('#adList').innerHTML = list.length ? `<ul class="ad-list">${list.map((it) => `<li><label class="ad-chk"><input type="checkbox" data-send="${it.id}" ${it.data.send ? 'checked' : ''} aria-label="${esc(it.data.name)} 라벨 인쇄"></label>
          <div class="grow"><b>${esc(it.data.name)}</b>${it.data.note ? ` <small class="muted">${esc(it.data.note)}</small>` : ''}<span>${it.data.zip ? `(${esc(it.data.zip)}) ` : ''}${esc(it.data.addr1)} ${esc(it.data.addr2)}</span>${it.data.phone ? `<small class="muted">${esc(it.data.phone)}</small>` : ''}</div>
          <span class="ad-act"><button class="linklike" data-edit="${it.id}">고치기</button><button class="linklike danger" data-del="${it.id}">지우기</button></span></li>`).join('')}</ul>
          <p class="muted small">${list.filter((x) => x.data.send).length}분 선택됨 · <button class="linklike" id="adAll">모두 선택</button> · <button class="linklike" id="adNone">모두 해제</button></p>`
        : '<div class="empty-state small">아직 주소가 없어요. 지면을 받아 볼 친척의 주소를 더해 보세요.</div>';
    };
    const form = (it) => {
      const d = it ? it.data : { send: true };
      const m = YT.modal(`<h2 class="modal-title">${it ? '주소 고치기' : '주소 더하기'}</h2><form class="form" id="adForm">
        <div class="evf-row"><label class="grow">받는 분<input class="input" name="name" required maxlength="40" value="${esc(d.name || '')}" placeholder="예) 김영희"></label><label>메모<input class="input" name="note" maxlength="60" value="${esc(d.note || '')}" placeholder="큰고모" style="max-width:9rem"></label></div>
        <div class="evf-row"><label>우편번호<input class="input" name="zip" maxlength="10" inputmode="numeric" value="${esc(d.zip || '')}" style="max-width:8rem"></label><label class="grow">전화 <small class="muted">(선택)</small><input class="input" name="phone" maxlength="30" value="${esc(d.phone || '')}"></label></div>
        <label class="block">주소<input class="input" name="addr1" required maxlength="120" value="${esc(d.addr1 || '')}" placeholder="도로명 주소"></label>
        <label class="block">상세 주소<input class="input" name="addr2" maxlength="120" value="${esc(d.addr2 || '')}" placeholder="동·호수"></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`);
      const f = m.el.querySelector('#adForm');
      f.onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); try { await (it ? YT.put('/api/items/' + it.id, { data: { ...v, send: !!d.send } }) : YT.post('/api/items', { kind: 'address', data: { ...v, send: true } })); m.close(); draw(); } catch (err) { YT.err(err); } };
    };
    YT.$('#adAdd').onclick = () => form(null);
    YT.$('#adList').onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
      if (e.target.id === 'adAll' || e.target.id === 'adNone') { const on = e.target.id === 'adAll'; for (const it of list) if (!!it.data.send !== on) await YT.put('/api/items/' + it.id, { data: { ...it.data, send: on } }).catch(() => {}); return draw(); }
      if (ed) form(list.find((x) => x.id === ed.dataset.edit));
      if (dl && YT.confirm('이 주소를 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); draw(); } catch (err) { YT.err(err); } }
    };
    YT.$('#adList').onchange = async (e) => { const c = e.target.closest('[data-send]'); if (!c) return; const it = list.find((x) => x.id === c.dataset.send); try { await YT.put('/api/items/' + it.id, { data: { ...it.data, send: c.checked } }); it.data.send = c.checked; draw(); } catch (err) { YT.err(err); } };
    const lf = YT.$('#lbForm');
    lf.onsubmit = (e) => {
      e.preventDefault();
      const fr = { name: lf.fname.value.trim(), zip: lf.fzip.value.trim(), addr: lf.faddr.value.trim(), on: lf.fon.checked };
      try { localStorage.setItem('yt_mail_from', JSON.stringify(fr)); } catch {}
      const to = list.filter((x) => x.data.send); if (!to.length) return YT.toast('라벨로 인쇄할 주소를 체크해 주세요.', 'error');
      const L = LABELS[lf.type.value]; const per = L.cols * L.rows; const skip = Math.max(0, Math.min(per - 1, (+lf.skip.value || 1) - 1));
      const cells = [...Array(skip).fill(null), ...to];
      const pages = []; for (let i = 0; i < cells.length; i += per) pages.push(cells.slice(i, i + per));
      const label = (it) => it ? `<div class="lb-in">${fr.on && (fr.name || fr.addr) ? `<div class="lb-from">보내는 사람 · ${esc(fr.name)}${fr.addr ? ` · ${esc(fr.addr)}` : ''}${fr.zip ? ` (${esc(fr.zip)})` : ''}</div>` : ''}
          ${it.data.zip ? `<div class="lb-zip">${esc(it.data.zip)}</div>` : ''}<div class="lb-addr">${esc(it.data.addr1)}${it.data.addr2 ? `<br>${esc(it.data.addr2)}` : ''}</div><div class="lb-name">${esc(it.data.name)} <small>님 귀하</small></div></div>` : '';
      const sheet = YT.$('#lbSheet');
      sheet.innerHTML = pages.map((pg) => `<div class="lb-page" style="--lw:${L.w}mm;--lh:${L.h}mm;--lt:${L.top}mm;--ll:${L.left}mm;--gx:${L.gx}mm;--gy:${L.gy}mm;--cols:${L.cols}">${pg.map((it) => `<div class="lb-cell">${label(it)}</div>`).join('')}</div>`).join('');
      sheet.hidden = false;
      const sz = document.getElementById('pageSize') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pageSize' }));
      sz.textContent = '@page { size: A4 portrait; margin: 0; }'; document.body.classList.add('print-labels');
      const done = () => { document.body.classList.remove('print-labels'); sheet.hidden = true; removeEventListener('afterprint', done); };
      addEventListener('afterprint', done); window.print(); setTimeout(() => { if (document.body.classList.contains('print-labels')) done(); }, 1500);
    };
    draw().catch((err) => { YT.$('#adList').innerHTML = `<p class="muted">${esc(err.message)}</p>`; });
  }
  YT.addRoute('/print-mail', mail);
  YT.addRoute('/print-year', yearBook);
  YT.addRoute('/print-year/:year', yearBook);
  YT.addRoute('/print', page);
  YT.addRoute('/print/:month', page);
})();
