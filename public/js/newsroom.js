/* 편집실 + 기사 작성기 */
(function () {
  'use strict';
  const { esc } = YT;
  const STATUS = YT.STATUS;
  const RECIPE_TPL = '■ 이 요리는\n누가 만들었나요? \n어떤 날 먹나요? \n\n■ 재료 (몇 인분: )\n- \n- \n- \n\n■ 만드는 법\n1. \n2. \n3. \n\n■ 우리 집 비법\n';
  YT.RECIPE_TPL = RECIPE_TPL;
  const TEMPLATES = {
    '그림 일기': ['그림·손글씨를 사진으로 찍어 올리는 코너', '아이가 그린 그림이나 손글씨 일기를 사진으로 찍어 ‘사진 넣기’로 올리고, 무엇을 그렸는지 한두 줄 적어주세요.',
      '그린 사람: \n그린 날: \n\n무엇을 그렸나요?\n\n그리면서 든 생각'],
    '헤드라인': ['우리 가족에게 일어난 가장 큰 사건', '이번 달 가장 기억에 남는 일을 골라 언제, 어디서, 누가, 무엇을 했는지 써보세요.',
      '이번 달 가장 큰 소식\n\n언제·어디서: \n함께한 가족: \n\n어떤 일이 있었나요?\n\n가장 기억에 남는 순간\n\n우리 가족에게 어떤 의미였나요?'],
    '일반 기사': ['가족의 일상과 소식을 자유롭게 기록하세요.', '누가, 언제, 어디서, 어떤 일을 함께했나요? 편안하게 이야기를 들려주세요.',
      '누가: \n언제: \n어디서: \n\n무슨 일이 있었나요?\n\n그때 들은 말이나 느낌\n\n앞으로의 계획'],
    '인(人)터뷰': ['한 사람을 골라 묻고 답하는 시간', '인터뷰할 가족 한 명을 정하고 직접 답변을 받아 기록하세요. 답변을 꾸며 쓰지 않아도 괜찮아요.',
      '오늘의 인터뷰 주인공: \n인터뷰한 사람: \n\nQ. 요즘 가장 즐거운 일은 무엇인가요?\nA. \n\nQ. 최근 새롭게 도전한 일은요?\nA. \n\nQ. 가족과 함께하고 싶은 일이 있나요?\nA. \n\nQ. 가족에게 전하고 싶은 한마디는요?\nA. '],
    '찰칵! 이 순간': ['한 달을 대표하는 소중한 한 장', '대표 사진 한 장과 짧은 설명을 남겨주세요. 아래 사진 첨부에서 이미지를 올릴 수 있습니다.',
      '사진을 찍은 날: \n장소: \n\n사진 속 이야기\n\n이 사진을 고른 이유\n\n사진을 찍은 사람: '],
    '우리 집 날씨': ['가족의 기분과 분위기를 전하는 예보', '진짜 기상예보 대신 우리 가족의 마음 날씨를 써보세요. 맑음·구름 조금·비 온 뒤 무지개 등 자유롭게 표현하면 됩니다.',
      '오늘 우리 집 마음 날씨: ☀️ 맑음\n\n가족의 기분 한 줄씩\n- \n- \n\n맑았던 순간\n\n잠깐 흐렸던 순간\n\n내일의 마음 예보\n\n함께 해볼 작은 약속'],
    '편집장의 말': ['이달 신문을 여는 편집장의 글', '이번 호에 실린 이야기와 이달 우리 가족의 분위기를 짧게 소개해 주세요. 지면 맨 앞에 실려요.',
      '이번 호를 펴내며\n\n이달 우리 가족은\n\n이번 호에서 꼭 읽어 볼 기사\n\n다음 달에 기대하는 일'],
    '관찰 일기': ['날마다 지켜본 기록', '반려동물, 화분, 하늘처럼 하나를 정해 며칠 동안 지켜본 것을 날짜별로 적어 보세요. 사진을 곁들이면 더 좋아요.',
      '관찰한 것: \n관찰한 사람: \n\n첫째 날 ( / )\n\n둘째 날 ( / )\n\n셋째 날 ( / )\n\n새로 알게 된 점\n\n궁금해진 점'],
    '우리 집 단신': ['서너 줄로 전하는 짧은 소식', '이가 빠졌어요, 자전거를 배웠어요처럼 짧은 소식을 서너 줄로 전해요. 지면의 ‘짧은 소식’ 칸에 실려요.',
      '소식: \n누가·언제: \n\n한 줄 덧붙이기'],
    '칭찬 릴레이': ['가족을 칭찬하고 다음 사람에게 바통을', '가족 한 명을 골라 칭찬하고, 다음 칭찬을 이어 갈 사람을 지목해요.',
      '오늘 칭찬할 사람: \n칭찬하는 사람: \n\n칭찬하고 싶은 일\n\n그때 내 마음\n\n다음 바통을 받을 사람: '],
  };
  // 분류마다 한 줄 설명 (헷갈리지 않게)
  const CAT_DESC = { 일상: '평범한 하루, 집에서 생긴 일', 여행: '나들이·여행 (장소를 넣으면 여행 지도에)', 성장: '키·이·처음 해 본 일처럼 자라는 이야기', 학교: '학교·학원·숙제·상장',
    친구: '친구와 함께한 일', 기념일: '생일·결혼기념일 같은 우리 가족 기념일', '명절·행사': '설·추석·크리스마스·가족 행사', 요리: '레시피와 음식 이야기 (레시피북에 모여요)',
    '놀이·취미': '놀이·만들기·취미 활동', '책·영화': '읽은 책·본 영화 소개', 운동: '운동·경기·체육 활동', 건강: '건강 관리 (병원 이야기는 꼭 필요한 만큼만)', 반려동물: '꾸리 같은 반려동물 이야기' };
  // 제목으로 분류 추천 — 분류를 직접 고르지 않았을 때만
  const CAT_HINTS = [[/생일|생신|결혼|기념일|돌잔치/, '기념일'], [/설날|추석|크리스마스|명절|어린이날|어버이날|송년|새해/, '명절·행사'], [/레시피|요리|만들어 먹|맛집|먹었/, '요리'],
    [/여행|나들이|캠핑|바다|공원|박물관/, '여행'], [/학교|학원|숙제|시험|상장|선생님/, '학교'], [/꾸리|강아지|고양이|반려|산책/, '반려동물'], [/책|영화|독서|읽은/, '책·영화'],
    [/축구|수영|태권도|줄넘기|운동|자전거|야구/, '운동'], [/병원|감기|건강|예방접종/, '건강'], [/친구/, '친구'], [/키|이가|처음|첫/, '성장'], [/놀이|레고|그림|만들기|게임/, '놀이·취미']];
  const suggestCat = (t) => (CAT_HINTS.find(([re]) => re.test(t || '')) || [])[1];
  // 인터뷰 질문 꾸러미 — ‘다른 질문’을 누르면 섞어서
  const INTERVIEW_Q = ['요즘 가장 즐거운 일은 무엇인가요?', '최근 새롭게 도전한 일은요?', '어릴 적 꿈은 무엇이었나요?', '가장 기억에 남는 여행지는?', '우리 가족에게 가장 고마운 순간은?',
    '요즘 가장 고민되는 것은?', '10년 뒤 나는 어떤 모습일까요?', '가장 좋아하는 음식과 그 이유는?', '하루 동안 무엇이든 할 수 있다면?', '가족에게 꼭 배우고 싶은 것은?',
    '최근에 크게 웃었던 일은?', '나만의 스트레스 푸는 방법은?', '가장 아끼는 물건과 그 이유는?', '올해 꼭 해 보고 싶은 일 세 가지는?', '가족에게 전하고 싶은 한마디는요?',
    '처음 해 본 일 중 가장 떨렸던 것은?', '좋아하는 책이나 영화는?', '나를 한 단어로 표현한다면?', '주말에 가장 하고 싶은 일은?', '어른이 되면(어릴 때) 해 보고 싶은 것은?'];
  const interviewTpl = () => { const q = INTERVIEW_Q.slice().sort(() => Math.random() - 0.5).slice(0, 4); return `오늘의 인터뷰 주인공: \n인터뷰한 사람: \n\n${q.map((x) => `Q. ${x}\nA. `).join('\n\n')}`; };

  // ───────── 기사 흐름 공통 (편집실 목록·기사 화면에서 함께 씀)
  // 단계: 작성 중(초안·수정 요청) → 승인 대기 → 승인 완료 → 발행됨
  const STAGES = [
    { key: 'writing', label: '작성 중', st: ['draft', 'changes'], desc: '초안·수정 요청' },
    { key: 'pending', label: '승인 대기', st: ['pending'], desc: '검토를 기다려요' },
    { key: 'approved', label: '승인 완료', st: ['approved'], desc: '발행을 기다려요' },
    { key: 'published', label: '발행됨', st: ['published'], desc: '신문에 실렸어요' },
  ];
  const who = () => ({ editor: YT.can('editor'), senior: YT.can('senior') });
  // 이 기사에 대해 지금 내가 누를 수 있는 버튼들 [action, 이름, 강조]
  YT.articleButtons = (a) => {
    const { editor, senior } = who(); const own = a.is_own; const out = [];
    const canEdit = editor || own;
    if (['draft', 'changes'].includes(a.status)) {
      if (own && senior && !editor) out.push(['publish', '바로 발행', 'accent']);
      else if (editor) out.push(['publish', '바로 발행', 'accent']);
      if (own) out.push(['request', a.status === 'changes' ? '고친 뒤 다시 요청' : '승인 요청', !senior ? 'primary' : '']);
    }
    if (a.status === 'pending') {
      if (editor) out.push(['publish', '승인하고 발행', 'accent'], ['approve', '승인만', ''], ['changes', '수정 요청', '']);
      else if (senior && !own) out.push(['approve', '승인', 'primary'], ['changes', '수정 요청', '']);
      else if (own) out.push(['unpublish', '요청 취소', '']);
      if (own && senior && !editor) out.unshift(['publish', '바로 발행', 'accent']);
    }
    if (a.status === 'approved') {
      if (editor || (senior && own)) out.push(['publish', '신문에 발행', 'accent']);
      if (editor || (senior && !own)) out.push(['changes', '수정 요청', '']);
    }
    if (a.status === 'published' && (editor || (senior && own))) out.push(['unpublish', '발행 취소', 'ghost late']);
    return { buttons: out, canEdit };
  };
  YT.articleNext = (a) => {
    const { editor, senior } = who(); const own = a.is_own;
    switch (a.status) {
      case 'draft': return own ? (senior && !editor ? '다 썼으면 바로 발행하거나 검토를 요청하세요.' : '다 썼으면 ‘승인 요청’을 눌러주세요.') : '기자가 쓰는 중이에요.';
      case 'changes': return own ? '검토 메모를 보고 고친 뒤 다시 요청해주세요.' : '기자가 고치는 중이에요.';
      case 'pending': return editor ? '읽어보고 발행하거나 수정을 요청하세요.' : senior && !own ? '읽어보고 승인하거나 수정을 요청하세요.' : '검토를 기다리는 중이에요. 고칠 게 있으면 ‘요청 취소’ 후 수정하세요.';
      case 'approved': return editor || (senior && own) ? '승인됐어요. 발행하면 1면에 실려요.' : '승인됐어요. 편집장의 발행을 기다려요.';
      case 'published': return '신문에 실렸어요.' + (editor ? ' 고치려면 ‘수정’을 누르세요(발행 상태 유지).' : '');
    }
    return '';
  };
  const DONE = { request: '승인을 요청했어요.', approve: '승인했어요.', changes: '수정을 요청했어요.', publish: '신문에 발행했어요.', unpublish: '되돌렸어요.' };
  // 버튼 실행 — 수정 요청은 메모 창, 발행은 확인
  YT.articleAct = (a, act) => new Promise((resolve) => {
    const send = async (note = '') => {
      try { const r = await YT.post(`/api/articles/${a.id}/action`, { action: act, note }); YT.refreshTodo(); YT.toast(act === 'unpublish' ? (a.status === 'pending' ? '승인 요청을 취소했어요. 고친 뒤 다시 요청하세요.' : '발행을 취소하고 초안으로 돌렸어요.') : DONE[act]); YT.clearCache(); resolve(r.article); }
      catch (err) { YT.err(err); resolve(null); }
    };
    if (act === 'changes') {
      let sent = false;
      const m = YT.modal(`<h2 class="modal-title">수정 요청</h2><p class="muted small">‘${esc(a.title)}’ — 기자에게 무엇을 고치면 좋을지 알려주세요.</p>
        <form class="form" id="chgForm"><textarea class="input" name="note" rows="4" maxlength="500" placeholder="예) 첫 문단에 날짜와 장소를 넣어주세요. 사진 설명도 부탁해요."></textarea>
        <div class="chips">${['날짜·장소를 넣어주세요', '사진 설명을 달아주세요', '제목을 더 짧게', '맞춤법을 확인해주세요'].map((t) => `<button type="button" class="chip" data-q="${t}">${t}</button>`).join('')}</div>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">수정 요청 보내기</button></div></form>`, { onClose: () => { if (!sent) resolve(null); } });
      const f = m.el.querySelector('#chgForm');
      m.el.querySelector('.chips').onclick = (e) => { const q = e.target.closest('[data-q]'); if (q) { f.note.value = (f.note.value ? f.note.value + '\n' : '') + q.dataset.q; f.note.focus(); } };
      f.onsubmit = (e) => { e.preventDefault(); sent = true; const note = f.note.value.trim(); m.close(); send(note); };
      setTimeout(() => f.note.focus(), 50);
      return;
    }
    if (act === 'publish' && !YT.confirm(`‘${a.title}’을(를) 신문에 발행할까요? 모든 독자에게 공개됩니다.`)) return resolve(null);
    if (act === 'unpublish' && a.status === 'published' && !YT.confirm('발행을 취소할까요? 1면과 목록에서 내려가고 초안으로 돌아갑니다.')) return resolve(null);
    send();
  });
  const btnHtml = (a, [act, label, kind]) => `<button class="btn small ${kind}" data-act="${act}" data-id="${a.id}">${label}</button>`;

  // ───────── 편집실 목록
  YT.addRoute('/newsroom', async (view) => {
    if (!YT.can('reporter')) return YT.needLogin(view, '편집실은 기자 계정으로 이용할 수 있어요.');
    const { editor, senior } = who();
    const roleDesc = YT.ROLES[YT.state.user.role] || '';
    const [{ articles }, trash] = await Promise.all([
      YT.api('/api/articles?scope=newsroom'),
      editor ? YT.api('/api/articles?scope=trash') : Promise.resolve({ articles: [] }),
    ]);
    const qs = YT.query();
    let stage = qs.stage || '';           // '' = 전체
    let mineOnly = !senior;               // 수습·평기자는 기본으로 내 기사만
    // 지금 내가 처리할 기사
    const todo = (a) => {
      if (a.is_own && ['draft', 'changes'].includes(a.status)) return true;
      if (a.status === 'pending' && (editor || (senior && !a.is_own))) return true;
      if (a.status === 'approved' && (editor || (senior && a.is_own))) return true;
      return false;
    };

    view.innerHTML = YT.subTabs('desk') + YT.pageHead('', '편집실', `현재 권한 · ${esc(roleDesc)}`, '<a class="btn primary" href="#/write">+ 새 기사 쓰기</a>')
      + `<nav class="pipe" id="pipe" aria-label="기사 단계"></nav>
      <section class="nr-todo" id="todoBox"></section>
      <div class="nr-tools"><div class="row gap"><h2 class="nr-h" id="listTitle"></h2>${senior ? '' : '<label class="check small"><input type="checkbox" id="mineOnly" checked> 내 기사만</label>'}</div>
        <input type="search" class="input" id="nrSearch" placeholder="제목·기자 이름 검색" aria-label="기사 검색"></div>
      <div id="nrList" class="nr-list"></div>
      <details class="help mt"><summary>기사는 어떻게 실리나요?</summary>
        <ol class="howto"><li><b>쓰기</b> — ‘새 기사 쓰기’에서 쓰고 저장하면 <em>초안</em>이 돼요. 몇 번이고 고칠 수 있어요.</li>
          <li><b>승인 요청</b> — 다 쓰면 ‘승인 요청’. 쓰기 화면의 ‘저장하고 승인 요청’으로 한 번에 해도 돼요.</li>
          <li><b>검토</b> — 편집장·시니어기자가 읽고 승인하거나, 메모와 함께 수정을 요청해요.</li>
          <li><b>발행</b> — 편집장이 발행하면 1면에 실려요. 편집장은 ‘승인하고 발행’으로 한 번에, 시니어기자는 자기 기사를 바로 발행할 수 있어요.</li></ol></details>
      ${editor ? `<details class="trash"><summary>휴지통 (${trash.articles.length})</summary><p class="muted small">삭제한 기사는 신문 목록에 표시되지 않습니다. 복원하면 초안으로 돌아갑니다.</p>
        ${trash.articles.map((a) => `<div class="nr-row"><div><b>${esc(a.title)}</b><div class="muted small">${esc(a.author_name)} · ${esc(YT.shortDate(a.updated))}</div></div>
        <div class="nr-actions"><button class="btn small" data-restore="${a.id}">복원</button>${YT.can('admin') ? `<button class="btn small danger" data-purge="${a.id}">영구 삭제</button>` : ''}</div></div>`).join('') || '<p class="muted">비어 있어요.</p>'}</details>` : ''}`;

    const row = (a, compact) => {
      const { buttons, canEdit } = YT.articleButtons(a);
      const more = [`<a class="btn small ghost" href="#/article/${a.id}">${a.status === 'published' ? '읽기' : '미리보기'}</a>`];
      if (canEdit) more.push(`<a class="btn small" href="#/write/${a.id}">수정</a>`);
      const del = editor || (a.is_own && a.status !== 'published') ? `<button class="btn small danger ghost" data-trash="${a.id}">삭제</button>` : '';
      return `<div class="nr-row ${compact ? 'todo' : ''}">
        <div class="nr-main"><span class="status s-${a.status}">${STATUS[a.status]}</span>
          <a href="#/article/${a.id}" class="nr-title">${esc(a.title)}</a>
          <div class="muted small">${esc(a.section)} · ${esc(a.author_name)}${a.is_own ? ' (나)' : ''} · ${esc(YT.monthLabel(a.issue_month || ''))}호 · ${a.revision ? a.revision + '차 수정본' : '초고'} · ${esc(YT.relTime(a.updated))}</div>
          ${a.status === 'changes' && a.review_note ? `<div class="nr-note"><b>검토 메모</b> ${esc(a.review_note)}</div>` : ''}
          <div class="nr-hint">${esc(YT.articleNext(a))}</div></div>
        <div class="nr-actions">${buttons.filter((b) => !b[2].includes('late')).map((b) => btnHtml(a, b)).join('')}${more.join('')}${buttons.filter((b) => b[2].includes('late')).map((b) => btnHtml(a, b)).join('')}${compact ? '' : del}</div>
      </div>`;
    };
    const draw = () => {
      const mine = (a) => !mineOnly || a.is_own;
      const pool = articles.filter(mine);
      YT.$('#pipe').innerHTML = `<button class="pipe-step all ${stage === '' ? 'on' : ''}" data-stage=""><b>${pool.length}</b><span>전체</span></button>`
        + STAGES.map((s, i) => { const n = pool.filter((a) => s.st.includes(a.status)).length; const ch = s.key === 'writing' ? pool.filter((a) => a.status === 'changes').length : 0;
          return `<button class="pipe-step ${stage === s.key ? 'on' : ''}" data-stage="${s.key}"><i>${i + 1}</i><b>${n}</b><span>${s.label}</span><small>${ch ? `수정 요청 ${ch}건` : s.desc}</small></button>`; }).join('');
      const td = articles.filter(todo);
      YT.$('#todoBox').innerHTML = `<div class="side-head"><h2>지금 내가 할 일 <span class="count">${td.length}</span></h2></div>`
        + (td.length ? td.slice(0, 6).map((a) => row(a, true)).join('') + (td.length > 6 ? `<p class="muted small">외 ${td.length - 6}건은 아래 목록에서 확인하세요.</p>` : '')
          : `<p class="muted nr-empty">처리할 기사가 없어요. ${YT.can('reporter') ? '<a href="#/write">새 기사를 써볼까요?</a>' : ''}</p>`);
      const q = YT.$('#nrSearch').value.trim();
      const st = STAGES.find((s) => s.key === stage);
      const list = pool.filter((a) => (!st || st.st.includes(a.status)) && (!q || a.title.includes(q) || (a.author_name || '').includes(q)));
      YT.$('#listTitle').textContent = `${st ? st.label : '전체 기사'} ${list.length}`;
      YT.$('#nrList').innerHTML = list.length ? list.map((a) => row(a)).join('')
        : `<div class="empty-state small">${q ? '검색한 기사가 없어요.' : st ? `‘${st.label}’ 기사가 없어요.` : '아직 기사가 없어요.'}${!q && !st ? '<br><a class="btn primary" href="#/write">첫 기사 쓰기</a>' : ''}</div>`;
    };
    draw();
    YT.$('#pipe').onclick = (e) => { const b = e.target.closest('[data-stage]'); if (b) { stage = b.dataset.stage; draw(); } };
    YT.$('#nrSearch').oninput = YT.debounce(draw, 150);
    const mo = YT.$('#mineOnly'); if (mo) mo.onchange = () => { mineOnly = mo.checked; draw(); };
    view.onclick = async (e) => {
      const t = e.target.closest('[data-act],[data-trash],[data-restore],[data-purge]'); if (!t) return;
      try {
        if (t.dataset.act) {
          const a = articles.find((x) => x.id === t.dataset.id); if (!a) return;
          t.disabled = true;
          const r = await YT.articleAct(a, t.dataset.act);
          if (r) Object.assign(a, r);
          draw();
        } else if (t.dataset.trash) {
          if (!YT.confirm('이 기사를 삭제할까요? 삭제한 기사는 휴지통에서 복원할 수 있습니다.')) return;
          const r = await YT.del('/api/articles/' + t.dataset.trash); YT.toast(r.message); YT.clearCache(); YT.route();
        } else if (t.dataset.restore) {
          const r = await YT.post(`/api/articles/${t.dataset.restore}/restore`); YT.toast(r.message); YT.route();
        } else if (t.dataset.purge) {
          if (!YT.confirm('이 기사를 영구 삭제할까요? 첨부 사진도 삭제되며 복원할 수 없습니다.')) return;
          const r = await YT.del(`/api/articles/${t.dataset.purge}?permanent=1`); YT.toast(r.message); YT.route();
        }
      } catch (err) { YT.err(err); }
    };
  });

  // ───────── 기사 작성기 (글쓰기 책상)
  // 한 장의 원고지처럼 이어 쓰고, 커서 자리에 사진을 넣고, 옆 칸에서 코너·태그·대표 사진을 정합니다.
  async function writer(view, params, query) {
    if (!YT.can('reporter')) return YT.needLogin(view, '기사는 기자 계정으로 쓸 수 있어요.');
    let a = null;
    if (params.id) a = (await YT.api('/api/articles/' + encodeURIComponent(params.id))).article;
    const [peopleNames, reporters] = await Promise.all([YT.api('/api/people').then((r) => r.people.map((p) => p.name)).catch(() => []), YT.api('/api/reporters').then((r) => r.reporters).catch(() => [])]);
    const today = YT.today();
    const me = YT.state.user;
    const canPublish = () => YT.can('editor') || (YT.can('senior') && (!a || a.is_own));
    const st = {
      title: a?.title || '', section: a?.section || query.section || '일반 기사', category: a?.category || '일상',
      issue_month: a?.issue_month || today.slice(0, 7), hashtags: a?.hashtags || '', photo: a?.photo || null,
      photo_caption: a?.photo_caption || '', blocks: a?.blocks?.length ? JSON.parse(JSON.stringify(a.blocks)) : [{ type: 'text', text: '' }],
      coauthors: (a?.coauthors || []).map((c) => c.id), place: a?.place || null, places: a?.places?.length ? a.places.map((p) => ({ ...p })) : a?.place ? [{ ...a.place }] : [],
    };
    // 다른 화면에서 넘어온 새 기사 (이번 주 취재 질문·버킷리스트 달성·레시피)
    if (!a) {
      if (query.title) st.title = String(query.title).slice(0, 120);
      if (query.category && YT.state.categories.includes(query.category)) st.category = query.category;
      if (query.q) { st.section = '인(人)터뷰'; st.blocks = [{ type: 'text', text: `이번 주 취재 질문\n\nQ. ${query.q}\nA. ` }]; if (!st.title) st.title = String(query.q).replace(/[?？]$/, '').slice(0, 60); }
      else if (st.category === '요리') st.blocks = [{ type: 'text', text: RECIPE_TPL }];
    }
    const leadId = a ? (a.is_main_author ? me.id : null) : me.id; // 대표 기자(나 또는 다른 사람)는 고를 칸에서 뺀다
    const coPick = reporters.filter((r) => r.id !== me.id || (a && !a.is_main_author)).filter((r) => r.id !== leadId && !(a && a.lead_author === r.name && !st.coauthors.includes(r.id)));
    if (!YT.state.sections.includes(st.section)) st.section = '일반 기사';

    // ── 자동 임시 저장 (이 브라우저)
    let dirty = false, draftKey = 'yt_draft_' + (a ? a.id : 'new'), autoTimer = null, restore = null;
    const setAuto = (t) => { const el = YT.$('#autoSaved'); if (el) el.textContent = t; };
    const markDirty = () => {
      dirty = true; setAuto('고치는 중…'); clearTimeout(autoTimer);
      autoTimer = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ ...st, saved: Date.now() })); setAuto('이 기기에 임시 저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })); } catch {} }, 1200);
      checks();
    };
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (saved && (!a || saved.saved > new Date(a.updated).getTime())) restore = saved; else if (saved) localStorage.removeItem(draftKey);
    } catch {}
    YT.setLeaveGuard(() => !dirty || YT.confirm('저장하지 않은 내용이 있어요. 페이지를 떠날까요? (이 기기에 임시 저장된 원고는 다음에 이어 쓸 수 있어요)'));
    window.onbeforeunload = () => (dirty ? '' : undefined);

    const months = []; for (let i = -6; i <= 2; i++) { const d = new Date(today.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + i); months.push(d.toISOString().slice(0, 7)); }
    if (!months.includes(st.issue_month)) months.unshift(st.issue_month);
    const statusLabel = () => (a ? `${STATUS[a.status] || '초안'} · ${a.revision ? a.revision + '차 수정본' : '초고'}` : '새 기사 · 아직 저장 전');
    const submitLabel = () => {
      if (a && a.status === 'published') return '';
      if (canPublish()) return '저장하고 발행';
      if (a && !['draft', 'changes'].includes(a.status)) return '';
      return '저장하고 승인 요청';
    };

    view.innerHTML = `<div class="wr">
      <div class="wr-bar" role="toolbar" aria-label="기사 저장">
        <a class="btn small ghost" href="#/newsroom">← 편집실</a>
        <div class="wr-state"><b id="wrState">${esc(statusLabel())}</b><span id="autoSaved">쓰는 동안 이 기기에 자동으로 임시 저장돼요</span></div>
        <div class="wr-acts"><button class="btn small" id="previewBtn">미리보기</button>
          <button class="btn small" id="saveBtn" title="Ctrl+S / ⌘S">저장</button>
          <button class="btn small primary" id="submitBtn" ${submitLabel() ? '' : 'hidden'}>${submitLabel()}</button></div>
      </div>
      ${restore ? `<div class="wr-restore" id="wrRestore"><span>저장하지 않고 닫은 원고가 있어요 · ${esc(new Date(restore.saved).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span>
        <button class="btn small primary" id="rsYes">이어 쓰기</button><button class="btn small ghost" id="rsNo">버리기</button></div>` : ''}
      <div class="wr-grid">
        <div class="wr-main">
          <button type="button" class="wr-kicker" id="wrKicker" aria-label="코너·분류 바꾸기"></button>
          <textarea class="wr-title" id="wTitle" rows="1" maxlength="120" placeholder="제목을 입력하세요" aria-label="기사 제목">${esc(st.title)}</textarea>
          <div class="wr-tools" role="toolbar" aria-label="본문 도구">
            <button type="button" class="wt" id="addPhoto" title="커서가 있는 자리에 사진을 넣어요"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>사진 넣기</button>
            <button type="button" class="wt" id="addAudio" title="목소리·소리를 녹음하거나 파일로 넣어요"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>소리 넣기</button>
            <button type="button" class="wt" id="tplBtn" title="코너에 맞는 작성 틀"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>작성 틀</button>
            <button type="button" class="wt" id="quoteBtn" title="커서 자리에 인용 부호 넣기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/></svg>인용</button>
            <button type="button" class="wt" id="micBtn" title="말하면 커서 자리에 글로 받아 적어요" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>말로 쓰기</span></button>
            <button type="button" class="wt" id="helpBtn" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/></svg>쓰는 요령</button>
            <span class="wt-count" id="wCount"></span>
          </div>
          <div class="wr-help" id="wrHelp" hidden>
            <p><b>첫 문단</b> — 누가 · 언제 · 어디서 · 무엇을 했는지 1~2문장으로.</p>
            <p><b>가운데</b> — 구체적인 과정, 직접 들은 말(“ ”), 그때의 느낌.</p>
            <p><b>마지막</b> — 우리 가족에게 어떤 의미였는지, 다음 계획.</p>
            <p class="muted small">빈 줄 하나로 문단이 나뉘어요. 사진은 원하는 자리에 커서를 두고 ‘사진 넣기’, 또는 끌어다 놓거나 복사해 붙여넣기(Ctrl+V)하세요.</p>
          </div>
          <div class="wr-mic" id="micStatus" hidden aria-live="polite"></div>
          <div id="blocks" class="wr-doc" aria-label="기사 본문"></div>
          <p class="wr-hint">사진은 끌어다 놓거나 붙여넣기로도 넣을 수 있어요 · 본문 사진 최대 10장</p>
        </div>

        <aside class="wr-side" aria-label="기사 설정">
          <section class="ws" id="wsSec"><h3>코너</h3>
            <div class="ws-secs" id="secPick" role="radiogroup">${YT.state.sections.map((s) => `<label class="${s === st.section ? 'on' : ''}"><input type="radio" name="sec" value="${esc(s)}" ${s === st.section ? 'checked' : ''}><b>${esc(s)}</b><small>${esc(TEMPLATES[s] ? TEMPLATES[s][0] : '')}</small></label>`).join('')}</div>
            <div class="ws-two"><label>분류<select class="select" id="wCat">${YT.state.categories.map((c) => `<option ${c === st.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
              <label>발행월<select class="select" id="wMonth">${months.map((m) => `<option value="${m}" ${m === st.issue_month ? 'selected' : ''}>${YT.monthLabel(m)}호</option>`).join('')}</select></label></div>
            <p class="muted small" id="catDesc"></p><div id="hlWarn"></div>
          </section>
          <section class="ws"><h3>등장 인물 <small>가족 사전에 연결돼요</small></h3>
            <div class="tag-in" id="tagBox"><span id="tagChips"></span><input id="tagInput" list="tagList" placeholder="이름 입력 후 Enter" aria-label="등장 인물 추가" autocomplete="off"></div>
            <datalist id="tagList">${peopleNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
          </section>
          ${coPick.length ? `<section class="ws"><h3>함께 쓴 기자 <small>바이라인에 같이 실려요</small></h3>
            <div class="chips" id="coPick">${coPick.map((r) => `<button type="button" class="chip ${st.coauthors.includes(r.id) ? 'on' : ''}" data-co="${r.id}" aria-pressed="${st.coauthors.includes(r.id)}">${esc(r.name)}</button>`).join('')}</div>
            <p class="muted small">함께 쓴 기자도 이 기사를 고치고 승인 요청할 수 있어요.</p></section>` : ''}
          <section class="ws"><h3>대표 사진 <small>1면·목록에 크게</small></h3><div id="mainPhoto"></div></section>
          <section class="ws"><h3>장소 <small>여행 지도에 핀으로</small></h3><div id="placeBox"></div></section>
          <section class="ws"><h3>저장 전 확인</h3><ul class="wr-checks" id="wrChecks"></ul>
            <p class="muted small">${canPublish() ? '‘저장하고 발행’을 누르면 바로 신문에 실려요.' : '‘저장하고 승인 요청’을 누르면 편집장·시니어기자가 검토해요. ‘저장’만 하면 초안으로 남아요.'}</p></section>
        </aside>
      </div>
      <input type="file" id="fileIn" accept="image/*" multiple hidden>
    </div>`;

    // ── 제목: 자동 높이, Enter → 본문으로
    const titleEl = YT.$('#wTitle');
    const grow = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
    let catTouched = !!a || !!query.category;
    titleEl.oninput = () => {
      st.title = titleEl.value.replace(/\n/g, ' '); if (titleEl.value !== st.title) titleEl.value = st.title; grow(titleEl); markDirty();
      const sug = !catTouched && suggestCat(st.title); // 제목으로 분류 추천
      if (sug && sug !== st.category && YT.state.categories.includes(sug)) { st.category = sug; YT.$('#wCat').value = sug; kicker(); catDesc(); }
    };
    titleEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const t = YT.$('.wr-text'); if (t) { t.focus(); t.setSelectionRange(0, 0); } } };

    const kicker = () => { YT.$('#wrKicker').innerHTML = `<b>${esc(st.section)}</b> · ${esc(st.category)} · ${esc(YT.monthLabel(st.issue_month))}호 <span>바꾸기</span>`; };
    YT.$('#wrKicker').onclick = () => { const s = YT.$('#wsSec'); s.scrollIntoView({ behavior: 'smooth', block: 'center' }); s.classList.add('flash'); setTimeout(() => s.classList.remove('flash'), 1200); };

    // ── 본문: 글 덩어리(빈 줄로 문단 구분) + 사진. 커서 위치를 기억해 그 자리에 사진을 넣는다
    const blocksEl = YT.$('#blocks');
    let caret = null; // { i, pos }
    const photoCount = () => st.blocks.filter((b) => b.type === 'photo').length;
    const audioCount = () => st.blocks.filter((b) => b.type === 'audio').length;
    const normalize = () => {
      const out = [];
      for (const b of st.blocks) {
        const last = out[out.length - 1];
        if (b.type === 'text' && last && last.type === 'text') { last.text = [last.text.replace(/\s+$/, ''), b.text.replace(/^\s+/, '')].filter(Boolean).join('\n\n'); }
        else out.push(b);
      }
      if (!out.length || out[out.length - 1].type !== 'text') out.push({ type: 'text', text: '' }); // 마지막엔 항상 이어 쓸 칸
      st.blocks = out;
    };
    const count = () => {
      const n = st.blocks.filter((b) => b.type === 'text').reduce((s, b) => s + b.text.replace(/\s/g, '').length, 0);
      YT.$('#wCount').textContent = `${n.toLocaleString()}자 · 약 ${Math.max(1, Math.round(n / 500))}분 읽기 · 사진 ${photoCount()}장`;
    };
    const photoHtml = (b, i) => `<figure class="wr-photo s-${b.size || 'medium'}" data-i="${i}">
        <div class="wp-img"><img src="${YT.thumbUrl(b.photo)}" alt="">${st.photo === b.photo ? '<span class="wp-badge">대표 사진</span>' : ''}</div>
        <input class="wp-cap" data-cap value="${esc(b.caption || '')}" placeholder="사진 설명 — 누가·언제·어디서·무엇을" aria-label="사진 설명">
        <div class="wp-ctl">
          <span class="seg-mini" role="group" aria-label="크기">${[['small', '작게'], ['medium', '중간'], ['full', '꽉 차게']].map(([v, l]) => `<button type="button" data-size="${v}" class="${(b.size || 'medium') === v ? 'on' : ''}">${l}</button>`).join('')}</span>
          ${(b.size || 'medium') !== 'full' ? `<span class="seg-mini" role="group" aria-label="정렬">${[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([v, l]) => `<button type="button" data-align="${v}" class="${(b.align || 'center') === v ? 'on' : ''}">${l}</button>`).join('')}</span>` : ''}
          <span class="wp-more"><button type="button" data-main title="대표 사진으로">${st.photo === b.photo ? '★ 대표' : '☆ 대표로'}</button><button type="button" data-mv="-1" aria-label="위로">↑</button><button type="button" data-mv="1" aria-label="아래로">↓</button><button type="button" data-rm class="danger">빼기</button></span>
        </div></figure>`;
    const audioHtml = (b, i) => `<figure class="wr-photo wr-audio" data-i="${i}">
        <div class="wa-play"><audio controls preload="metadata" src="${YT.audioUrl(b.audio)}"></audio>${b.duration ? `<span class="muted small">${YT.mmss(b.duration)}</span>` : ''}</div>
        <input class="wp-cap" data-cap value="${esc(b.caption || '')}" placeholder="무엇을 담았나요? — 예) 할머니가 불러 주신 자장가" aria-label="소리 설명">
        <div class="wp-ctl"><span class="muted small">목소리·소리 — 지면에는 QR 코드로 실려요</span><span class="wp-more"><button type="button" data-mv="-1" aria-label="위로">↑</button><button type="button" data-mv="1" aria-label="아래로">↓</button><button type="button" data-rm class="danger">빼기</button></span></div></figure>`;
    const drawBlocks = (focusAt) => {
      normalize();
      const firstText = st.blocks.findIndex((b) => b.type === 'text');
      blocksEl.innerHTML = st.blocks.map((b, i) => b.type === 'photo' ? photoHtml(b, i) : b.type === 'audio' ? audioHtml(b, i)
        : `<textarea class="wr-text" data-i="${i}" rows="1" aria-label="본문" placeholder="${i === firstText && !st.blocks.some((x) => x.type !== 'text') ? '첫 문단에 가장 중요한 소식을 1~2문장으로 적어보세요. 빈 줄 하나로 문단이 나뉘어요.' : '이어서 쓰세요…'}">${esc(b.text)}</textarea>`).join('');
      blocksEl.querySelectorAll('.wr-text').forEach(grow);
      count();
      if (focusAt) { const t = blocksEl.querySelector(`.wr-text[data-i="${focusAt.i}"]`); if (t) { t.focus(); t.setSelectionRange(focusAt.pos, focusAt.pos); } }
    };
    const rememberCaret = (e) => { const t = e.target; if (t.classList && t.classList.contains('wr-text')) caret = { i: +t.dataset.i, pos: t.selectionStart }; };
    blocksEl.addEventListener('keyup', rememberCaret); blocksEl.addEventListener('click', rememberCaret); blocksEl.addEventListener('focusin', rememberCaret);

    // 사진 넣기: 커서가 글 가운데 있으면 그 자리에서 글을 나눠 사진을 끼운다
    const insertPhotos = async (files, at = caret) => {
      files = files.filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      const room = 10 - photoCount(); if (room <= 0) return YT.toast('본문 사진은 최대 10장까지 넣을 수 있어요.', 'error');
      if (files.length > room) { YT.toast(`본문 사진은 10장까지라 ${room}장만 넣을게요.`); files = files.slice(0, room); }
      const ids = [];
      for (let k = 0; k < files.length; k++) { YT.toast(`사진 올리는 중 ${k + 1}/${files.length}…`); try { ids.push(await YT.uploadImage(files[k])); } catch (err) { YT.err(err); } }
      noteGps(files);
      if (!ids.length) return;
      const photos = ids.map((id) => ({ type: 'photo', photo: id, caption: '', align: 'center', size: 'medium' }));
      let idx;
      if (at && st.blocks[at.i] && st.blocks[at.i].type === 'text') {
        const t = st.blocks[at.i].text; const before = t.slice(0, at.pos).replace(/\s+$/, ''), after = t.slice(at.pos).replace(/^\s+/, '');
        st.blocks.splice(at.i, 1, ...(before ? [{ type: 'text', text: before }] : []), ...photos, { type: 'text', text: after });
        idx = at.i + (before ? 1 : 0) + photos.length;
      } else if (at && at.after != null) { st.blocks.splice(at.after + 1, 0, ...photos); idx = at.after + 1 + photos.length; }
      else { const lastT = st.blocks.length - 1; st.blocks.splice(lastT, 0, ...photos); idx = lastT + photos.length; }
      if (!st.photo) st.photo = ids[0]; // 대표 사진이 없으면 첫 사진을 대표로
      markDirty(); drawBlocks(); drawMain();
      YT.toast(`사진 ${ids.length}장을 넣었어요. 아래에 설명을 적어주세요.`);
      const cap = blocksEl.querySelector(`.wr-photo[data-i="${idx - photos.length}"] .wp-cap`); if (cap) cap.focus();
    };
    blocksEl.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('wr-text')) { st.blocks[+t.dataset.i].text = t.value; grow(t); caret = { i: +t.dataset.i, pos: t.selectionStart }; count(); markDirty(); }
      else if (t.dataset.cap !== undefined) { st.blocks[+t.closest('.wr-photo').dataset.i].caption = t.value; markDirty(); }
    });
    blocksEl.addEventListener('keydown', (e) => {
      const t = e.target; if (!t.classList.contains('wr-text')) return;
      const i = +t.dataset.i;
      // 맨 앞에서 Backspace: 바로 위가 사진이면 사진 칸으로 이동
      if (e.key === 'Backspace' && t.selectionStart === 0 && t.selectionEnd === 0 && i > 0 && st.blocks[i - 1].type !== 'text') { e.preventDefault(); const c = blocksEl.querySelector(`.wr-photo[data-i="${i - 1}"] .wp-cap`); c && c.focus(); }
    });
    blocksEl.addEventListener('click', (e) => {
      const fig = e.target.closest('.wr-photo'); const btn = e.target.closest('button'); if (!fig || !btn) return;
      const i = +fig.dataset.i; const b = st.blocks[i];
      if (btn.dataset.size) b.size = btn.dataset.size;
      else if (btn.dataset.align) b.align = btn.dataset.align;
      else if (btn.dataset.main !== undefined) { st.photo = st.photo === b.photo ? null : b.photo; if (st.photo && !st.photo_caption) st.photo_caption = b.caption || ''; drawMain(); }
      else if (btn.dataset.mv) {
        // 사진을 글 문단 하나만큼 위/아래로: 인접 글을 문단 단위로 넘긴다
        const dir = +btn.dataset.mv; const nb = st.blocks[i + dir];
        if (!nb) return;
        if (nb.type !== 'text') { [st.blocks[i], st.blocks[i + dir]] = [st.blocks[i + dir], st.blocks[i]]; }
        else {
          const paras = nb.text.split(/\n{2,}/).filter((x) => x.trim());
          if (!paras.length) { st.blocks.splice(i + dir, 1); }
          else {
            const moved = dir < 0 ? paras.pop() : paras.shift(); nb.text = paras.join('\n\n');
            const other = st.blocks[i - dir];
            if (other && other.type === 'text') other.text = dir < 0 ? [moved, other.text].filter((x) => x.trim()).join('\n\n') : [other.text, moved].filter((x) => x.trim()).join('\n\n');
            else st.blocks.splice(dir < 0 ? i + 1 : i, 0, { type: 'text', text: moved });
          }
        }
      } else if (btn.dataset.rm !== undefined) { if (b.type === 'photo' && st.photo === b.photo) st.photo = null; st.blocks.splice(i, 1); drawMain(); }
      markDirty(); drawBlocks();
    });
    blocksEl.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); blocksEl.classList.add('drop'); } });
    blocksEl.addEventListener('dragleave', (e) => { if (!blocksEl.contains(e.relatedTarget)) blocksEl.classList.remove('drop'); });
    blocksEl.addEventListener('drop', (e) => {
      e.preventDefault(); blocksEl.classList.remove('drop');
      const t = e.target.closest('.wr-text'), fig = e.target.closest('.wr-photo');
      const at = t ? { i: +t.dataset.i, pos: t.value.length && document.caretPositionFromPoint ? (document.caretPositionFromPoint(e.clientX, e.clientY)?.offset ?? t.value.length) : (t.selectionStart ?? t.value.length) }
        : fig ? { after: +fig.dataset.i } : null;
      insertPhotos([...e.dataTransfer.files], at);
    });
    blocksEl.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); rememberCaret(e); insertPhotos(files); }
    });
    YT.$('#addPhoto').onclick = () => { pending = 'body'; YT.$('#fileIn').click(); };
    // 목소리·소리 넣기 — 바로 녹음하거나 휴대폰의 녹음 파일을 고른다
    const insertAudio = (id, duration, at = caret) => {
      const blk = { type: 'audio', audio: id, caption: '', duration };
      if (at && st.blocks[at.i] && st.blocks[at.i].type === 'text') {
        const t = st.blocks[at.i].text; const before = t.slice(0, at.pos).replace(/\s+$/, ''), after = t.slice(at.pos).replace(/^\s+/, '');
        st.blocks.splice(at.i, 1, ...(before ? [{ type: 'text', text: before }] : []), blk, { type: 'text', text: after });
      } else st.blocks.splice(st.blocks.length - 1, 0, blk);
      markDirty(); drawBlocks();
      const cap = [...blocksEl.querySelectorAll('.wr-audio .wp-cap')].pop(); if (cap) cap.focus();
    };
    YT.$('#addAudio').onclick = () => {
      if (audioCount() >= 5) return YT.toast('소리는 기사 한 편에 5개까지 넣을 수 있어요.', 'error');
      const at = caret;
      YT.recordAudio((id, dur) => { insertAudio(id, dur, at); YT.toast('소리를 넣었어요. 무엇을 담았는지 적어 주세요.'); });
    };
    let pending = 'body';
    YT.$('#fileIn').onchange = async (e) => {
      const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
      if (pending === 'main') {
        YT.toast('사진을 올리는 중…');
        try { st.photo = await YT.uploadImage(files[0]); markDirty(); drawMain(); drawBlocks(); YT.toast('대표 사진을 정했어요.'); } catch (err) { YT.err(err); }
        noteGps(files);
      } else await insertPhotos(files);
      pending = 'body';
    };
    YT.$('#quoteBtn').onclick = () => {
      const at = caret && st.blocks[caret.i]?.type === 'text' ? caret : { i: st.blocks.length - 1, pos: st.blocks[st.blocks.length - 1].text.length };
      const b = st.blocks[at.i]; b.text = b.text.slice(0, at.pos) + '“”' + b.text.slice(at.pos); markDirty(); drawBlocks({ i: at.i, pos: at.pos + 1 });
    };
    // 말로 쓰기 — 브라우저 음성 인식(한국어). 말한 문장을 커서 자리에 넣는다
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const mic = YT.$('#micBtn'); mic.hidden = false; let rec = null;
      const status = YT.$('#micStatus');
      const stop = () => { if (rec) { try { rec.stop(); } catch {} } };
      mic.onclick = () => {
        if (rec) return stop();
        rec = new SR(); rec.lang = 'ko-KR'; rec.continuous = true; rec.interimResults = true;
        mic.classList.add('on'); mic.querySelector('span').textContent = '받아 적는 중… (누르면 멈춤)'; status.hidden = false; status.textContent = '천천히 또박또박 말해 보세요. “마침표”라고 하면 문장을 끝내요.';
        rec.onresult = (ev) => {
          let fin = '', mid = '';
          for (let k = ev.resultIndex; k < ev.results.length; k++) { const t = ev.results[k][0].transcript; if (ev.results[k].isFinal) fin += t; else mid += t; }
          status.textContent = mid ? '' + mid : status.textContent;
          if (!fin) return;
          fin = fin.replace(/\s*(마침표|온점)\s*/g, '. ').replace(/\s*쉼표\s*/g, ', ').replace(/\s*물음표\s*/g, '? ').replace(/\s*(줄 바꿈|줄바꿈|다음 줄)\s*/g, '\n').trim();
          const at = caret && st.blocks[caret.i]?.type === 'text' ? caret : { i: st.blocks.length - 1, pos: (st.blocks[st.blocks.length - 1].text || '').length };
          if (st.blocks[at.i]?.type !== 'text') { st.blocks.push({ type: 'text', text: '' }); at.i = st.blocks.length - 1; at.pos = 0; }
          const b = st.blocks[at.i]; const before = b.text.slice(0, at.pos); const glue = before && !/[\s\n]$/.test(before) ? ' ' : '';
          b.text = before + glue + fin + ' ' + b.text.slice(at.pos); const pos = at.pos + glue.length + fin.length + 1;
          caret = { i: at.i, pos }; markDirty(); drawBlocks({ i: at.i, pos }); status.textContent = '받아 적었어요. 계속 말해 보세요.';
        };
        rec.onerror = (ev) => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') YT.toast('마이크 사용을 허용해 주세요 (주소창 옆 자물쇠).', 'error'); else if (ev.error !== 'no-speech' && ev.error !== 'aborted') YT.toast('음성 인식이 멈췄어요: ' + ev.error, 'error'); };
        rec.onend = () => { rec = null; mic.classList.remove('on'); mic.querySelector('span').textContent = '말로 쓰기'; status.hidden = true; };
        try { rec.start(); } catch { rec = null; }
      };
      window.addEventListener('hashchange', stop, { once: true });
    }
    // 장소 (여행 지도) — 여러 곳을 다녀온 순서대로, 사진에 찍힌 위치도 제안
    if (!Array.isArray(st.places)) st.places = st.place ? [st.place] : [];
    let gpsSug = []; // 사진에서 찾은 위치 [{lat,lng,name}]
    const syncPlace = () => { st.place = st.places[0] || null; };
    const drawPlace = () => {
      syncPlace(); const box = YT.$('#placeBox'); if (!box) return;
      const n = st.places.length;
      box.innerHTML = `${gpsSug.length ? `<div class="pl-sug"><b>📷 사진 찍은 곳을 찾았어요</b>${gpsSug.map((g, i) => `<div class="pl-sug-row"><span>${esc(g.name || '사진 찍은 곳')}</span><button type="button" class="btn tiny primary" data-sadd="${i}">넣기</button><button type="button" class="btn tiny ghost" data-sno="${i}">아니요</button></div>`).join('')}</div>` : ''}
        ${n ? `<ol class="pl-stops">${st.places.map((p, i) => `<li><button type="button" class="linklike pl-name" data-pedit="${i}" title="바꾸기"><b>${n > 1 ? `<i>${i + 1}</i>` : ''}${esc(p.name)}</b></button>
          <span class="pl-acts">${i ? `<button type="button" class="btn tiny ghost" data-pup="${i}" aria-label="앞으로">↑</button>` : ''}<button type="button" class="btn tiny ghost" data-pdel="${i}" aria-label="빼기">✕</button></span></li>`).join('')}</ol>` : ''}
        ${n < 10 ? `<button type="button" class="btn small wide" id="plAdd">${n ? '+ 다녀온 곳 더하기' : '지도에서 장소 고르기'}</button>` : ''}
        <p class="muted small">${n > 1 ? '다녀온 순서대로 기사 안 지도에 번호와 선으로 그려져요.' : '여행·나들이 기사라면 장소를 넣어 보세요. 기사 안에 작은 지도가 생기고 ‘여행 지도’에도 핀이 꽂혀요.'}</p>`;
    };
    drawPlace();
    YT.$('#placeBox').addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'plAdd') { const r = await YT.pickPlace(null); if (r) { st.places.push(r); markDirty(); drawPlace(); } }
      else if (b.dataset.pedit) { const i = +b.dataset.pedit; const r = await YT.pickPlace(st.places[i]); if (r) { st.places[i] = r; markDirty(); drawPlace(); } }
      else if (b.dataset.pdel) { st.places.splice(+b.dataset.pdel, 1); markDirty(); drawPlace(); }
      else if (b.dataset.pup) { const i = +b.dataset.pup; [st.places[i - 1], st.places[i]] = [st.places[i], st.places[i - 1]]; markDirty(); drawPlace(); }
      else if (b.dataset.sadd) { const g = gpsSug.splice(+b.dataset.sadd, 1)[0]; const r = await YT.pickPlace({ lat: g.lat, lng: g.lng, name: g.name || '' }); if (r) { st.places.push(r); markDirty(); } drawPlace(); }
      else if (b.dataset.sno) { gpsSug.splice(+b.dataset.sno, 1); drawPlace(); }
    });
    // 사진을 넣을 때 찍은 위치가 있으면 장소로 제안 (이미 넣은 곳과 300m 안이면 건너뛰기)
    const noteGps = async (files) => {
      if (!YT.gpsFromFile) return; const found = [];
      for (const f of files.slice(0, 10)) { const g = await YT.gpsFromFile(f); if (g) found.push(g); }
      const near = (g) => [...st.places, ...gpsSug, ...found.filter((x) => x !== g && x._keep)].some((p) => YT.distM(p, g) < 300);
      const fresh = []; for (const g of found) { if (!near(g)) { g._keep = true; fresh.push(g); } }
      if (!fresh.length) return;
      for (const g of fresh.slice(0, 3)) { g.name = await YT.reverseName(g.lat, g.lng); delete g._keep; gpsSug.push(g); }
      drawPlace(); YT.toast('사진 찍은 곳을 찾았어요. 오른쪽 ‘장소’에서 넣을 수 있어요.');
    };
    YT.$('#helpBtn').onclick = (e) => { const h = YT.$('#wrHelp'); h.hidden = !h.hidden; e.currentTarget.setAttribute('aria-expanded', !h.hidden); };
    YT.$('#tplBtn').onclick = async () => {
      let tpl = TEMPLATES[st.section] ? TEMPLATES[st.section][2] : '';
      if (st.section === '인(人)터뷰') tpl = interviewTpl(); // 누를 때마다 다른 질문
      if (st.section === '우리 집 날씨') { // 사랑방의 기분 날씨를 불러와 채운다
        try {
          const { notes } = await YT.api('/api/notes?month=' + st.issue_month); const W = YT.MOOD_W || {};
          const ns = notes.filter((n) => W[n.mood]); const cnt = {}; ns.forEach((n) => { cnt[n.mood] = (cnt[n.mood] || 0) + 1; });
          const top = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
          const by = {}; ns.forEach((n) => { (by[n.name] = by[n.name] || []).push(n.mood); });
          if (top) tpl = `이달 우리 집 마음 날씨: ${top[0]} ${W[top[0]][0]} (한마디 ${ns.length}개 중 ${top[1]}번)\n\n가족의 기분 한 줄씩\n${Object.entries(by).map(([nm, ms]) => { const c = {}; ms.forEach((m) => { c[m] = (c[m] || 0) + 1; }); const b = Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; return `- ${nm}: ${W[b][0]}(${W[b][1]})`; }).join('\n')}\n\n맑았던 순간\n\n잠깐 흐렸던 순간\n\n다음 달 마음 예보\n\n함께 해볼 작은 약속`;
        } catch {}
      }
      const empty = !st.blocks.some((b) => b.type !== 'text' || b.text.trim());
      if (!empty && !YT.confirm(`‘${st.section}’ 작성 틀을 본문 맨 끝에 붙일까요?`)) return;
      if (empty) st.blocks = [{ type: 'text', text: tpl }]; else st.blocks.push({ type: 'text', text: tpl });
      markDirty(); drawBlocks({ i: st.blocks.length - 1, pos: 0 }); YT.toast('작성 틀을 넣었어요. 빈칸을 채워보세요.');
    };

    // ── 옆 칸: 코너·분류·발행월
    YT.$('#secPick').onchange = async (e) => {
      st.section = e.target.value; YT.$$('#secPick label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked)); kicker(); markDirty();
      if (st.section === '헤드라인') headlineCheck();
    };
    // 한 달에 헤드라인은 한 편 — 이미 있으면 알려 준다 (1면·지면 맨 위에는 하나만 실려요)
    const headlineCheck = async () => {
      try { const list = await YT.getArticles(true, true); const other = list.find((x) => x.section === '헤드라인' && x.issue_month === st.issue_month && (!a || x.id !== a.id) && x.status !== 'draft');
        const box = YT.$('#hlWarn'); if (box) box.innerHTML = other && st.section === '헤드라인' ? `<p class="ws-warn">${YT.monthLabel(st.issue_month)}호 헤드라인은 이미 ‘${esc(other.title)}’이 있어요. 1면에는 한 편만 크게 실려요.</p>` : '';
      } catch {}
    };
    if (st.section === '헤드라인') headlineCheck();
    YT.$('#wCat').onchange = (e) => {
      st.category = e.target.value; catTouched = true; kicker(); markDirty(); catDesc();
      if (st.category === '요리' && !st.blocks.some((b) => b.type !== 'text' || b.text.trim())) { st.blocks = [{ type: 'text', text: RECIPE_TPL }]; drawBlocks({ i: 0, pos: 0 }); YT.toast('레시피 틀을 넣었어요. 레시피북에 모여요.'); }
    };
    YT.$('#wMonth').onchange = (e) => { st.issue_month = e.target.value; kicker(); markDirty(); if (st.section === '헤드라인') headlineCheck(); };
    const catDesc = () => { const el = YT.$('#catDesc'); if (el) el.textContent = CAT_DESC[st.category] || ''; };
    catDesc();

    // ── 등장 인물 칩
    const tagInput = YT.$('#tagInput');
    const drawTags = () => { YT.$('#tagChips').innerHTML = YT.tags(st.hashtags).map((t) => `<span class="tchip">#${esc(t)}<button type="button" data-rmtag="${esc(t)}" aria-label="${esc(t)} 빼기">×</button></span>`).join(''); };
    const addTag = (v) => { const t = String(v || '').replace(/^#+/, '').trim().replace(/\s+/g, ''); if (!t) return; const list = YT.tags(st.hashtags); if (list.length >= 10) return YT.toast('인물 태그는 10개까지 넣을 수 있어요.', 'error'); if (!list.includes(t)) { list.push(t); st.hashtags = list.map((x) => '#' + x).join(' '); drawTags(); markDirty(); } };
    tagInput.onkeydown = (e) => {
      if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && !e.isComposing) { if (tagInput.value.trim()) { e.preventDefault(); addTag(tagInput.value); tagInput.value = ''; } else if (e.key === 'Enter') e.preventDefault(); }
      else if (e.key === 'Backspace' && !tagInput.value) { const list = YT.tags(st.hashtags); list.pop(); st.hashtags = list.map((x) => '#' + x).join(' '); drawTags(); markDirty(); }
    };
    tagInput.onchange = () => { if (peopleNames.includes(tagInput.value.trim())) { addTag(tagInput.value); tagInput.value = ''; } };
    tagInput.onblur = () => { if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ''; } };
    const coBox = YT.$('#coPick'); if (coBox) coBox.onclick = (e) => { const b = e.target.closest('[data-co]'); if (!b) return; const id = b.dataset.co; const on = !st.coauthors.includes(id);
      if (on && st.coauthors.length >= 4) return YT.toast('함께 쓴 기자는 4명까지 넣을 수 있어요.', 'error');
      st.coauthors = on ? [...st.coauthors, id] : st.coauthors.filter((x) => x !== id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); markDirty(); };
    YT.$('#tagBox').onclick = (e) => { const r = e.target.closest('[data-rmtag]'); if (r) { st.hashtags = YT.tags(st.hashtags).filter((t) => t !== r.dataset.rmtag).map((x) => '#' + x).join(' '); drawTags(); markDirty(); } else tagInput.focus(); };

    // ── 대표 사진
    const drawMain = () => {
      const inBody = st.blocks.some((b) => b.type === 'photo' && b.photo === st.photo);
      YT.$('#mainPhoto').innerHTML = st.photo
        ? `<div class="ws-main"><img src="${YT.thumbUrl(st.photo)}" alt=""><input class="input" id="mpCap" value="${esc(st.photo_caption)}" placeholder="대표 사진 설명">
            <div class="row gap"><button type="button" class="btn small" id="mpChange">다른 사진</button><button type="button" class="btn small ghost danger" id="mpRemove">대표 사진 빼기</button></div>
            ${inBody ? '<p class="muted small">본문 사진 중 하나를 대표로 쓰고 있어요.</p>' : ''}</div>`
        : `<button type="button" class="dropzone sm" id="mpPick">대표 사진 고르기<br><small>본문 사진의 ‘☆ 대표로’를 눌러도 돼요</small></button>`;
      const pick = () => { pending = 'main'; YT.$('#fileIn').click(); };
      YT.$('#mpPick') && (YT.$('#mpPick').onclick = pick);
      YT.$('#mpChange') && (YT.$('#mpChange').onclick = pick);
      YT.$('#mpRemove') && (YT.$('#mpRemove').onclick = () => { st.photo = null; st.photo_caption = ''; markDirty(); drawMain(); drawBlocks(); });
      YT.$('#mpCap') && (YT.$('#mpCap').oninput = (e) => { st.photo_caption = e.target.value; markDirty(); });
      checks();
    };

    // ── 저장 전 확인 (저절로 체크)
    const checks = () => {
      const el = YT.$('#wrChecks'); if (!el) return;
      const texts = st.blocks.filter((b) => b.type === 'text' && b.text.trim());
      const first = texts[0]?.text.split(/\n{2,}/)[0] || '';
      const photos = st.blocks.filter((b) => b.type === 'photo');
      const items = [
        [!!st.title.trim(), '제목을 붙였어요', true],
        [first.replace(/\s/g, '').length >= 20, '첫 문단에 핵심 소식이 있어요', false],
        [photos.every((p) => (p.caption || '').trim()), photos.length ? `본문 사진 ${photos.length}장에 모두 설명이 있어요` : '본문 사진 (없어도 괜찮아요)', false],
        [YT.tags(st.hashtags).length > 0, '등장 인물을 태그했어요', false],
        [!!st.photo, '대표 사진을 정했어요 (선택)', false],
      ];
      el.innerHTML = items.map(([ok, t, need]) => `<li class="${ok ? 'ok' : need ? 'need' : ''}"><i aria-hidden="true">${ok ? '✓' : need ? '!' : '○'}</i>${t}</li>`).join('');
    };

    // ── 저장
    const payload = () => ({ ...st, place: st.places[0] || null, places: st.places, blocks: st.blocks.filter((b) => b.type !== 'text' || b.text.trim()) });
    const save = async () => {
      if (!st.title.trim()) { titleEl.focus(); throw new Error('제목을 입력해주세요.'); }
      const r = a ? await YT.put('/api/articles/' + a.id, payload()) : await YT.post('/api/articles', payload());
      const wasNew = !a; a = r.article;
      dirty = false; clearTimeout(autoTimer); try { localStorage.removeItem(draftKey); } catch {}
      draftKey = 'yt_draft_' + a.id; YT.clearCache();
      if (wasNew) history.replaceState(null, '', '#/write/' + a.id);
      YT.$('#wrState').textContent = statusLabel(); setAuto('서버에 저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      const sb = YT.$('#submitBtn'); const l = submitLabel(); sb.textContent = l; sb.hidden = !l;
      return a;
    };
    const busy = async (btn, fn) => { if (btn.disabled) return; btn.disabled = true; try { await fn(); } catch (err) { YT.err(err); } finally { btn.disabled = false; } };
    YT.$('#saveBtn').onclick = (e) => busy(e.currentTarget, async () => { await save(); YT.toast('저장했어요. 계속 쓰셔도 돼요.'); });
    YT.$('#submitBtn').onclick = (e) => busy(e.currentTarget, async () => {
      const pub = canPublish();
      if (pub && !YT.confirm('이 기사를 신문에 발행할까요? 모든 독자에게 공개됩니다.')) return;
      const art = await save();
      if (pub) { await YT.post(`/api/articles/${art.id}/action`, { action: 'publish' }); YT.toast('신문에 발행했어요.'); YT.clearCache(); YT.go('#/article/' + art.id); }
      else { if (['draft', 'changes'].includes(art.status)) await YT.post(`/api/articles/${art.id}/action`, { action: 'request' }); YT.toast('승인 요청을 보냈어요.'); YT.clearCache(); YT.go('#/newsroom'); }
    });
    YT.$('#previewBtn').onclick = () => {
      const p = payload();
      YT.modal(`<div class="sec-kicker">미리보기 · 아직 공개되지 않았어요</div><article class="article in-modal">
        <div class="art-kicker">${esc(p.section)} · ${esc(p.category)}</div><h1 class="art-title">${esc(p.title || '제목을 입력해주세요')}</h1>
        <div class="art-meta muted small">${esc(me.display_name)} · ${esc(YT.monthLabel(p.issue_month))}호</div>
        ${p.photo && !p.blocks.some((b) => b.photo === p.photo) ? `<figure class="art-main-photo"><img src="${YT.photoUrl(p.photo)}">${p.photo_caption ? `<figcaption>${esc(p.photo_caption)}</figcaption>` : ''}</figure>` : ''}
        <div class="art-body">${YT.renderBlocks(p.blocks)}</div></article>`, { wide: true });
    };
    // Ctrl/⌘+S 저장
    if (YT._wrKey) document.removeEventListener('keydown', YT._wrKey);
    YT._wrKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && document.getElementById('wTitle')) { e.preventDefault(); YT.$('#saveBtn').click(); } };
    document.addEventListener('keydown', YT._wrKey);

    // ── 이어 쓰기 안내
    if (restore) {
      YT.$('#rsYes').onclick = () => { const r = { ...restore }; delete r.saved; Object.assign(st, r); if (!Array.isArray(st.coauthors)) st.coauthors = []; YT.$$('#coPick [data-co]').forEach((b) => { const on = st.coauthors.includes(b.dataset.co); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); titleEl.value = st.title; grow(titleEl); YT.$$('#secPick input').forEach((x) => { x.checked = x.value === st.section; x.parentElement.classList.toggle('on', x.checked); });
        YT.$('#wCat').value = st.category; YT.$('#wMonth').value = st.issue_month; if (!Array.isArray(st.places)) st.places = st.place ? [st.place] : []; kicker(); drawTags(); drawBlocks(); drawMain(); drawPlace(); markDirty(); YT.$('#wrRestore').remove(); YT.toast('이어서 쓸 수 있어요.'); };
      YT.$('#rsNo').onclick = () => { try { localStorage.removeItem(draftKey); } catch {} YT.$('#wrRestore').remove(); };
    }

    kicker(); drawTags(); drawBlocks(); drawMain(); grow(titleEl);
    if (!a) titleEl.focus();
  }
  YT.addRoute('/write', writer);
  YT.addRoute('/write/:id', writer);
})();
