/* 신문 1면 */
(function () {
  'use strict';
  const { esc } = YT;
  const CORNERS = [
    ['우리 집 날씨', '가족의 기분과 오늘의 분위기를 전해요'],
    ['일반 기사', '일상·여행·학교에서 만난 소식'],
    ['인(人)터뷰', '한 사람을 골라 묻고 답하는 시간'],
    ['찰칵! 이 순간', '한 달을 대표하는 소중한 한 장'],
    ['그림 일기', '아이의 그림·손글씨를 사진으로'],
    ['관찰 일기', '반려동물·식물·하늘을 날마다 지켜본 기록'],
    ['우리 집 단신', '서너 줄로 전하는 짧은 소식'],
    ['칭찬 릴레이', '가족을 칭찬하고 다음 사람에게 바통을'],
  ];
  // 이번 주 취재 질문 — 매주 하나씩 돌아가며 1면에 (누르면 인터뷰 기사 틀이 열린다)
  const QUESTIONS = ['어릴 적 가장 좋아한 놀이는 무엇이었나요?', '처음 받은 월급(용돈)으로 무엇을 했나요?', '우리 가족에게 가장 고마운 순간은 언제였나요?', '요즘 가장 많이 웃은 일은?',
    '가장 기억에 남는 여행지는 어디인가요?', '어릴 적 꿈은 무엇이었나요?', '제일 좋아하는 우리 집 음식과 그 이유는?', '학교 다닐 때 가장 좋아한 과목은?',
    '가족에게 꼭 물려주고 싶은 습관이 있나요?', '올해 꼭 해 보고 싶은 일 세 가지는?', '처음 혼자 해 본 일 중 기억나는 것은?', '가장 아끼는 물건과 그 사연은?',
    '할머니·할아버지께 배운 것 중 가장 소중한 것은?', '10년 뒤 우리 가족은 어떤 모습일까요?', '힘들 때 힘이 되는 말은 무엇인가요?', '요즘 푹 빠져 있는 것은?',
    '가장 좋아하는 계절과 그 계절의 추억은?', '부모님(자녀)에게 아직 하지 못한 말이 있나요?', '내가 생각하는 우리 가족의 자랑거리는?', '어릴 적 살던 동네는 어떤 곳이었나요?',
    '가장 무서웠던(떨렸던) 경험은?', '내가 만든 요리 중 가장 자신 있는 것은?', '가족과 꼭 함께 가 보고 싶은 곳은?', '최근에 새로 배운 것은 무엇인가요?',
    '나만의 스트레스 푸는 방법은?', '가장 좋아하는 노래와 떠오르는 기억은?', '첫 친구는 누구였고 어떻게 만났나요?', '우리 집 규칙 중 하나를 바꾼다면?',
    '가장 기억에 남는 생일은?', '나를 한 단어로 표현한다면?', '어른이 되어 가장 놀란 일은?', '가족에게 받은 선물 중 가장 기억에 남는 것은?',
    '하루 동안 무엇이든 할 수 있다면?', '좋아하는 책이나 영화와 그 이유는?', '가장 자랑스러웠던 순간은?', '이번 주 우리 가족 뉴스 한 줄을 뽑는다면?',
    '명절에 가장 기다려지는 것은?', '어릴 적 받았던 칭찬 중 기억나는 것은?', '가장 좋아하는 동물과 그 이유는?', '내 이름에 담긴 뜻을 알고 있나요?',
    '지금 사는 집에서 가장 좋아하는 곳은?', '실수해서 오히려 좋았던 일이 있나요?', '나에게 행복이란?', '가족 사진 중 가장 좋아하는 한 장은?',
    '처음 자전거(수영)를 배운 날은?', '요즘 가장 고민되는 것은?', '친구에게 우리 가족을 소개한다면?', '가장 맛있게 먹은 길거리 음식은?',
    '내가 할 수 있는 가장 특이한 재주는?', '1년 전의 나에게 해 주고 싶은 말은?', '올해 우리 가족 10대 뉴스 1위는?', '내년의 나에게 바라는 것은?'];
  YT.weekQuestion = (d = YT.today()) => { const t = Date.parse(d + 'T00:00:00Z'); const w = Math.floor((t / 864e5 + 3) / 7); return QUESTIONS[((w % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length]; };
  YT.CORNERS = CORNERS;

  const ddayText = (today, d) => (d === today ? '오늘' : 'D-' + YT.dayDiff(today, d));

  function celebrateToday(todays) {
    if (!todays.length) return '';
    const first = todays[0];
    const to = YT.tags(first.hashtags).find((t) => first.title.includes(t)) || '';
    return `<section class="celebrate" aria-label="오늘의 축하">
      <div class="cel-body"><span class="cel-label">오늘은</span>
        ${todays.map((o) => `<span class="cel-item"><b>${esc(o.title)}</b>${o.age ? ` <small>${o.age}세</small>` : ''}${o.anniversary_years ? ` <small>${o.anniversary_years}주년</small>` : ''}</span>`).join('')}</div>
      <a class="btn small light" href="#/post/write?type=${first.kind === 'birthday' ? 'birthday' : first.kind === 'anniversary' ? 'anniversary' : 'letter'}&to=${encodeURIComponent(to)}">축하 카드 쓰기</a>
    </section>`;
  }

  function topStory(a) {
    if (!a) return `<article class="lead empty"><h2>우리 가족의 첫 소식을 기다려요</h2><p>편집실에서 이야기를 쓰고 발행하면 이 자리에 크게 실려요.</p>
      ${YT.can('reporter') ? '<a class="btn primary" href="#/write">첫 기사 쓰기</a>' : ''}</article>`;
    return `<article class="lead ${a.photo ? '' : 'no-photo'}">
      <a href="#/article/${a.id}" class="lead-link">
        ${a.photo ? `<div class="lead-photo"><img src="${YT.photoUrl(a.photo)}" alt="${esc(a.photo_caption || a.title)}"></div>` : ''}
        <div class="lead-text">
          <div class="a-kicker"><span>${esc(a.section)}</span><span>${esc(a.category)}</span>${YT.isNew(a) ? '<b class="new-dot">새 글</b>' : ''}</div>
          <h2 class="lead-title">${esc(a.title)}</h2>
          <p class="lead-excerpt">${esc((a.excerpt || '').slice(0, 150))}${(a.excerpt || '').length > 150 ? '…' : ''}</p>
          <div class="a-byline"><span>${esc(YT.shortDate(a.published_at || a.updated))}</span><span>${esc(a.author_name)} 기자</span><span>${YT.readMinutes(a)}분 읽기</span></div>
        </div>
      </a>
    </article>`;
  }

  YT.addRoute('/', async (view) => {
    const today = YT.today();
    const [articles, occ, pollsR, notesR] = await Promise.all([
      YT.getArticles(),
      YT.occurrencesBetween(today, YT.addDays(today, Math.max(45, YT.prefs().dday))).catch(() => []),
      YT.api('/api/polls').catch(() => ({ polls: [] })),
      YT.api('/api/notes?limit=6').catch(() => ({ notes: [] })),
    ]);
    const choreR = YT.can('subscriber') ? await YT.api('/api/items?kind=chore').catch(() => ({ items: [], assign: {} })) : { items: [], assign: {} };
    const chores = choreR.items.slice(0, 5);
    const special = occ.filter((o) => o.kind !== 'event');
    const todays = special.filter((o) => o.date === today);
    const ddayTo = YT.addDays(today, YT.prefs().dday);
    const upcoming = occ.filter((o) => (o.date > today || (o.kind === 'event' && o.date === today)) && o.date <= ddayTo).slice(0, 6);
    const top = articles.find((a) => a.section === '헤드라인') || articles[0];
    const latest = articles.filter((a) => a !== top).slice(0, 5);
    const popular = articles.filter((a) => (a.views || 0) + YT.rxTotal(a) + a.comment_count > 0)
      .sort((a, b) => (b.views + YT.rxTotal(b) * 3 + b.comment_count * 3) - (a.views + YT.rxTotal(a) * 3 + a.comment_count * 3)).slice(0, 5);
    const polls = pollsR.polls.filter((p) => !p.closed).slice(0, 1);
    // N년 전 오늘: 지난 해들의 오늘 앞뒤 일주일 기사 → 없으면 같은 달 기사
    const md = today.slice(5, 7); const ty = +today.slice(0, 4);
    const when = (a) => (a.published_at || a.updated || '').slice(0, 10);
    const yearsAgo = (a) => ty - +when(a).slice(0, 4);
    const nearToday = (a) => { const y = yearsAgo(a); if (y < 1) return false; const same = YT.addDays(when(a), 0).replace(/^\d{4}/, String(ty)); return Math.abs(YT.dayDiff(same, today)) <= 7; };
    let memories = articles.filter(nearToday).sort((a, b) => Math.abs(YT.dayDiff(when(a).replace(/^\d{4}/, String(ty)), today)) - Math.abs(YT.dayDiff(when(b).replace(/^\d{4}/, String(ty)), today))).slice(0, 3);
    const memExact = memories.length > 0;
    if (!memExact) memories = articles.filter((a) => yearsAgo(a) >= 1 && when(a).slice(5, 7) === md).slice(0, 3);
    const months = [...new Set(articles.map((a) => a.issue_month).filter(Boolean))].sort().reverse();

    // 한눈에 보기 (보장설계 매니저의 요약 타일처럼)
    const ym = today.slice(0, 7); const in7 = YT.addDays(today, 7);
    const glance = [
      ['오늘 일정', occ.filter((o) => o.date === today).length, '건', `#/calendar?date=${today}`],
      ['7일 안 일정', occ.filter((o) => o.date > today && o.date <= in7).length, '건', '#/calendar'],
      [`${Number(ym.slice(5))}월 생일·기념일`, special.filter((o) => o.date.slice(0, 7) === ym && o.date >= today).length, '번', '#/calendar'],
      [`${Number(ym.slice(5))}월호 기사`, articles.filter((a) => (a.issue_month || (a.published_at || a.updated || '').slice(0, 7)) === ym).length, '편', '#/print'],
    ];
    view.innerHTML = `
      ${celebrateToday(todays)}
      ${YT.prefs().glance ? `<nav class="glance" aria-label="한눈에 보기">${glance.map(([l, n, u, h]) => `<a class="gl" href="${h}"><span>${esc(l)}</span><b>${n}<small>${u}</small></b></a>`).join('')}</nav>` : ''}
      <div class="front">
        ${topStory(top)}
        <aside class="week" aria-label="다가오는 날">
          <div class="side-head"><h2>다가오는 날</h2><a href="#/calendar">캘린더</a></div>
          ${upcoming.length ? `<ol class="dday-list">${upcoming.map((o) => `<li><a href="#/calendar?date=${o.date}">
              <span class="dd ${o.kind}">${ddayText(today, o.date)}</span>
              <span class="dd-body"><b>${esc(o.title)}</b><small>${esc(o.date.slice(5).replace('-', '월 '))}일 ${YT.weekday(o.date)}요일${o.time ? ' ' + esc(o.time) : ''}${o.age ? ` · ${o.age}세` : ''}${o.anniversary_years ? ` · ${o.anniversary_years}주년` : ''}</small></span></a></li>`).join('')}</ol>`
            : `<p class="muted">${YT.prefs().dday}일 안에 등록된 날이 없어요.</p>`}
          ${YT.can('staff') ? '<button class="btn small ghost-line" id="quickEv">일정 추가</button>' : ''}
          <div class="week-q"><span class="wq-k">이번 주 취재 질문</span><p>“${esc(YT.weekQuestion(today))}”</p>
            ${YT.can('reporter') ? `<a class="btn small" href="#/write?q=${encodeURIComponent(YT.weekQuestion(today))}">가족에게 묻고 기사 쓰기</a>` : '<small class="muted">가족에게 물어보고 이야기를 나눠 보세요.</small>'}</div>
          ${chores.length ? `<div class="week-chores"><div class="side-head"><h2>이번 주 당번</h2><a href="#/todo/chores">당번표</a></div>
            <ul>${chores.map((c) => `<li><span>${esc(c.data.name)}</span><b>${esc((choreR.assign[c.id] || [])[0] || '')}</b></li>`).join('')}</ul></div>` : ''}
        </aside>
      </div>

      <section class="band three">
        <div>
          <div class="side-head"><h2>최근 소식</h2></div>
          ${latest.length ? `<ul class="news-list">${latest.map((a) => `<li><a href="#/article/${a.id}"><b>${esc(a.title)}</b>${YT.isNew(a) ? '<i class="new-dot">새 글</i>' : ''}<small>${esc(a.section)} · ${esc(YT.shortDate(a.published_at || a.updated))}</small></a></li>`).join('')}</ul>`
            : '<p class="muted">새로 발행되는 소식이 여기에 쌓여요.</p>'}
        </div>
        <div>
          <div class="side-head"><h2>많이 읽은 기사</h2></div>
          ${popular.length ? `<ol class="rank-list">${popular.map((a) => `<li><a href="#/article/${a.id}"><b>${esc(a.title)}</b><small>조회 ${a.views || 0}${YT.rxTotal(a) ? ` · 공감 ${YT.rxTotal(a)}` : ''}${a.comment_count ? ` · 댓글 ${a.comment_count}` : ''}</small></a></li>`).join('')}</ol>`
            : '<p class="muted">기사를 읽고 응원을 남기면 순위가 생겨요.</p>'}
        </div>
        <div>
          <div class="side-head"><h2>가족 투표</h2><a href="#/board">가족 광장</a></div>
          <div id="homePoll">${polls.length ? polls.map(YT.pollCard).join('') : `<p class="muted">진행 중인 투표가 없어요.</p>${YT.can('subscriber') ? '<button class="btn small" id="homeNewPoll">가족에게 물어보기</button>' : ''}`}</div>
        </div>
      </section>

      <section class="band notes-band">
        <div class="side-head"><h2>오늘의 한마디</h2><a href="#/board">모두 보기</a></div>
        <div class="notes-wrap">${YT.noteForm()}<ul class="note-list row-list" id="homeNotes"></ul></div>
      </section>

      ${memories.length ? `<section class="band memories" aria-label="지난 이맘때"><div class="side-head"><h2>${memExact ? `${yearsAgo(memories[0])}년 전 오늘` : '지난 이맘때'}</h2><span>${memExact ? '그날 우리 가족은' : Number(md) + '월의 기록'}</span></div>
        <div class="mem-list">${memories.map((a) => `<a class="mem" href="#/article/${a.id}">${a.photo ? `<img src="${YT.thumbUrl(a.photo)}" alt="" loading="lazy">` : '<span class="mem-ph" aria-hidden="true"></span>'}
          <span class="mem-t"><b class="mem-ago">${yearsAgo(a)}년 전 · ${esc(YT.shortDate(when(a)))}</b><strong>${esc(a.title)}</strong><small>${esc(a.author_name)} 기자</small></span></a>`).join('')}</div></section>` : ''}

      <section class="band corners" aria-label="코너">
        ${CORNERS.map(([name, desc]) => {
          const a = articles.find((x) => x.section === name);
          return `<a class="corner" href="#/articles?section=${encodeURIComponent(name)}"><h3>${esc(name)}</h3>
            ${a ? `<p class="corner-article">${esc(a.title)}</p>` : `<p class="muted">${esc(desc)}</p>`}<span class="corner-more">${a ? '코너 보기' : '첫 글을 기다려요'}</span></a>`;
        }).join('')}
      </section>

      <section class="band"><div class="side-head"><h2>기사 더 보기</h2><a href="#/articles">전체 기사 ${articles.length}개 →</a></div>
        ${articles.length > 1 ? `<div class="card-grid">${articles.filter((a) => a !== top).slice(0, 4).map((a) => YT.articleCard(a)).join('')}</div>` : ''}
        <div class="row gap mt"><a class="btn" href="#/articles">코너·분류·발행월로 찾아보기</a><a class="btn ghost" href="#/print">이달의 지면 보기</a></div></section>

      <section class="band"><div class="side-head"><h2>이달의 생일</h2><a href="#/people">가족 앨범</a></div><ul class="bd-grid" id="monthBd"></ul></section>`;

    // 투표·한마디
    YT.bindPolls(YT.$('#homePoll'), polls, () => { YT.$('#homePoll').innerHTML = polls.map(YT.pollCard).join(''); });
    const hp = YT.$('#homeNewPoll'); if (hp) hp.onclick = () => YT.openPollForm(() => YT.route());
    const drawNotes = (list) => { YT.$('#homeNotes').innerHTML = list.length ? list.map(YT.noteItem).join('') : '<li class="muted">아직 아무도 남기지 않았어요.</li>'; };
    drawNotes(notesR.notes);
    YT.bindNotes(YT.$('.notes-band'), async () => drawNotes((await YT.api('/api/notes?limit=6')).notes));
    const qe = YT.$('#quickEv'); if (qe) qe.onclick = () => YT.openEventForm({ date: today }, 'new', () => YT.route());

    // 이달의 생일
    try {
      const [y, m] = today.split('-'); const first = `${y}-${m}-01`; const last = YT.addDays(YT.ymd(+y + (m === '12' ? 1 : 0), m === '12' ? 1 : +m + 1, 1), -1);
      const bd = (await YT.occurrencesBetween(first, last)).filter((o) => o.kind === 'birthday');
      YT.$('#monthBd').innerHTML = bd.length ? bd.map((o) => `<li class="${o.date < today ? 'past' : o.date === today ? 'today' : ''}">
        <span class="bd-day"><b>${+o.date.slice(8)}</b>${YT.weekday(o.date)}</span>
        <span><b>${esc(o.title)}</b><small>${o.calendar === 'lunar' ? `음력 ${o.birth_month}월 ${o.birth_day}일` : '양력'}${o.age ? ` · ${o.age}세` : ''}</small></span></li>`).join('')
        : '<li class="muted">이번 달에는 생일이 없어요.</li>';
    } catch { YT.$('#monthBd').innerHTML = '<li class="muted">생일을 불러오지 못했어요.</li>'; }
  });

  // 코너별 기사
  // 기사 — 코너·분류·발행월·검색으로 모아 보기 (주소에 조건이 남아 공유·뒤로 가기가 됩니다)
  YT.addRoute('/articles', async (view, _p, q) => {
    let articles = await YT.getArticles();
    const months = [...new Set(articles.map((a) => a.issue_month).filter(Boolean))].sort().reverse();
    let sec = YT.state.sections.includes(q.section) ? q.section : '', cat = YT.state.categories.includes(q.cat) ? q.cat : '전체', mon = months.includes(q.month) ? q.month : '', limit = 12;
    view.innerHTML = YT.subTabs('articles') + YT.pageHead('', '기사', '우리 가족 신문에 실린 모든 기사를 코너·분류·발행월로 찾아보세요.',
      `${YT.can('reporter') ? '<a class="btn primary" href="#/write">+ 기사 쓰기</a>' : ''}`)
      + `<nav class="sec-tabs" id="secTabs" aria-label="코너">${['', ...YT.state.sections].map((x) => `<button class="${x === sec ? 'on' : ''}" data-sec="${esc(x)}">${x ? esc(x) : '전체 코너'} <small>${articles.filter((a) => !x || a.section === x).length}</small></button>`).join('')}</nav>
      <p class="muted small" id="secDesc"></p>
      <div class="aa-bar">
        <div class="chips" id="aaCats">${['전체', ...YT.state.categories].map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <div class="aa-filters">
          <select class="select" id="aaMonth" aria-label="발행월"><option value="">모든 달</option>${months.map((m) => `<option value="${m}" ${m === mon ? 'selected' : ''}>${YT.monthLabel(m)}호</option>`).join('')}</select>
          <input type="search" class="input" id="aaSearch" placeholder="제목·본문 검색" aria-label="기사 검색" value="${esc(q.q || '')}">
        </div>
      </div>
      <p class="muted small" id="aaCount"></p>
      <div class="card-grid" id="aaGrid"></div>
      <div class="center"><button class="btn" id="aaMore" hidden>더 보기</button></div>`;
    const sync = () => { const ps = new URLSearchParams(); if (sec) ps.set('section', sec); if (cat !== '전체') ps.set('cat', cat); if (mon) ps.set('month', mon); const qq = YT.$('#aaSearch').value.trim(); if (qq) ps.set('q', qq); history.replaceState(null, '', '#/articles' + (ps.toString() ? '?' + ps : '')); };
    let loadingFull = false;
    const draw = () => {
      const qq = YT.$('#aaSearch').value.trim().toLowerCase();
      // 본문까지 찾을 때만 기사 본문을 받아 온다
      if (qq && !loadingFull && articles.length && !articles[0].blocks) { loadingFull = true; YT.getArticles(false, true).then((full) => { articles = full; draw(); }).catch(() => {}); }
      const list = articles.filter((a) => (!sec || a.section === sec) && (cat === '전체' || a.category === cat) && (!mon || a.issue_month === mon)
        && (!qq || (a.title + ' ' + (a.hashtags || '') + ' ' + (a.blocks || []).map((b) => b.text || b.caption || '').join(' ')).toLowerCase().includes(qq)));
      YT.$('#secDesc').textContent = sec ? ((CORNERS.find((c) => c[0] === sec) || [, sec === '헤드라인' ? '우리 가족에게 일어난 가장 큰 일' : ''])[1] || '') : '';
      YT.$('#aaCount').textContent = `기사 ${list.length}개`;
      YT.$('#aaGrid').innerHTML = list.length ? list.slice(0, limit).map((a) => YT.articleCard(a)).join('')
        : `<div class="empty-state small">${articles.length ? '조건에 맞는 기사가 없어요. 조건을 바꿔보세요.' : '아직 발행된 기사가 없어요.'}${sec && YT.can('reporter') ? `<br><a class="btn small primary" href="#/write?section=${encodeURIComponent(sec)}">이 코너에 첫 기사 쓰기</a>` : ''}</div>`;
      YT.$('#aaMore').hidden = list.length <= limit; sync();
    };
    YT.$('#secTabs').onclick = (e) => { const b = e.target.closest('[data-sec]'); if (!b) return; sec = b.dataset.sec; limit = 12; YT.$$('#secTabs button').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    YT.$('#aaCats').onclick = (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; limit = 12; YT.$$('#aaCats .chip').forEach((c) => c.classList.toggle('on', c === b)); draw(); };
    YT.$('#aaMonth').onchange = (e) => { mon = e.target.value; draw(); };
    YT.$('#aaSearch').oninput = YT.debounce(draw, 150);
    YT.$('#aaMore').onclick = () => { limit += 12; draw(); };
    draw();
  });
  // 예전 코너 주소는 기사 모아 보기의 해당 코너로
  YT.addRoute('/section/:name', async (view, { name }) => { location.replace('#/articles?section=' + encodeURIComponent(name)); });
})();
