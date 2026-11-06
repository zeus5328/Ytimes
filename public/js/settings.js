/* 설정 — 보장설계 매니저처럼 위쪽 하위 탭(내 정보 · 화면 설정 · 신문 정보 · 가족 계정 · 자료 관리)으로 나눈 한 화면 */
(function () {
  'use strict';
  const { esc } = YT;

  // [키, 이름, 필요한 권한(null=누구나), 한 줄 설명]
  const SUBS = [
    ['me', '내 정보', null, '이름·비밀번호·내 권한'],
    ['display', '화면 설정', null, '밝기·글자 크기·1면 구성 — 이 기기에만 저장'],
    ['paper', '신문 정보', 'admin', '제호·표어·편집자의 말·로고'],
    ['family', '가족 계정', 'admin', '계정 만들기·권한·시간표 열람'],
    ['data', '자료 관리', 'admin', '자료 현황·백업·휴지통'],
  ];
  const visible = () => SUBS.filter((s) => !s[2] || YT.can(s[2]));

  const panel = (title, body, opts = {}) => `<section class="set-panel ${opts.cls || ''}"${opts.id ? ` id="${opts.id}"` : ''}>
    <div class="set-ph"><h2>${title}</h2>${opts.right || ''}</div>${opts.desc ? `<p class="set-desc">${opts.desc}</p>` : ''}${body}</section>`;
  const radios = (name, cur, options) => `<div class="set-seg" role="radiogroup">${options.map(([v, l]) =>
    `<label class="${String(cur) === String(v) ? 'on' : ''}"><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  const row = (label, hint, control) => `<div class="set-row"><div class="set-lbl"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="set-ctl">${control}</div></div>`;
  const toggle = (name, on, label) => `<label class="set-switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''} aria-label="${label}"><i aria-hidden="true"></i></label>`;
  const kpi = (k, v, unit, href) => `<${href ? `a href="${href}"` : 'div'} class="gl"><span>${k}</span><b>${v}<small>${unit}</small></b></${href ? 'a' : 'div'}>`;

  // ── 내 정보
  function meView() {
    const u = YT.state.user;
    if (!u) return panel('로그인하면 내 정보를 볼 수 있어요', `<p class="set-desc">가족 계정으로 로그인하면 이름과 비밀번호를 바꿀 수 있어요. 화면 설정은 로그인하지 않아도 쓸 수 있습니다.</p>
      <div class="row gap"><a class="btn primary" href="#/login?next=${encodeURIComponent('#/settings/me')}">로그인</a><a class="btn" href="#/settings/display">화면 설정으로</a></div>`);
    const roleLine = (YT.ROLES[u.role] || u.role_label || '').split(' · ');
    return `<div class="set-profile"><span class="set-avatar" aria-hidden="true">${esc(YT.initials(u.display_name))}</span>
        <div><b>${esc(u.display_name)}</b><span>${esc(roleLine[0] || '')} · ${esc(u.username)}</span></div>
        <button class="btn small" id="logoutMe">로그아웃</button></div>`
      + panel('이름', `<form class="set-inline" id="nameForm"><label class="grow"><span class="vh">표시 이름</span><input class="input" name="display_name" maxlength="30" value="${esc(u.display_name)}" required></label><button class="btn primary">저장</button></form>`,
        { desc: '기사·댓글·한마디에 이 이름으로 표시돼요. 로그인 이메일은 관리자가 ‘가족 계정’에서 바꿀 수 있어요.' })
      + panel('비밀번호 바꾸기', `<form class="form set-form" id="pwForm">
          <label>현재 비밀번호<input class="input" type="password" name="current" required autocomplete="current-password"></label>
          <label>새 비밀번호<input class="input" type="password" name="password" required minlength="6" autocomplete="new-password"></label>
          <label>새 비밀번호 확인<input class="input" type="password" name="password2" required minlength="6" autocomplete="new-password"></label>
          <div><button class="btn primary">비밀번호 변경</button></div></form>`, { desc: '6자 이상으로 정해주세요. 잊어버리면 관리자에게 초기화를 부탁하세요.' })
      + panel('알림', `<p class="set-desc">위쪽 알림에서 승인 요청·수정 요청·댓글·새 기사·새 투표·오늘/내일 생일을 알려드려요.</p>
          ${row('브라우저 알림', '유니 타임즈 창(탭)이 열려 있으면 휴대폰·컴퓨터 알림으로도 띄워요. 이 기기에만 저장돼요.', `<label class="set-switch"><input type="checkbox" id="pushToggle" ${YT.store.get('yt_push', '0') === '1' && 'Notification' in window && Notification.permission === 'granted' ? 'checked' : ''}><i aria-hidden="true"></i><span id="pushState">${!('Notification' in window) ? '이 브라우저는 지원하지 않아요' : Notification.permission === 'denied' ? '브라우저에서 막혀 있어요' : YT.store.get('yt_push', '0') === '1' ? '켜짐' : '꺼짐'}</span></label>`)}
          <p class="muted small">아이폰은 사파리에서 ‘홈 화면에 추가’한 뒤 그 아이콘으로 열어야 알림이 와요. 브라우저에서 막았다면 주소창 옆 자물쇠(사이트 설정)에서 알림을 허용해주세요.</p>`)
      + panel('내 권한', `<dl class="set-dl"><dt>권한</dt><dd>${esc(roleLine[0] || '')}</dd><dt>할 수 있는 일</dt><dd>${esc(roleLine[1] || '')}</dd>
          <dt>시간표</dt><dd>${u.role === 'admin' || u.timetable_access ? '볼 수 있음' : '볼 수 없음 (관리자가 켜줄 수 있어요)'}</dd></dl>`);
  }
  function meBind(view) {
    const lo = YT.$('#logoutMe'); if (lo) lo.onclick = () => YT.logout();
    const nf = YT.$('#nameForm'); if (nf) nf.onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await YT.put('/api/me', Object.fromEntries(new FormData(e.target))); YT.state.user = r.user; YT.renderChrome(); YT.toast('이름을 바꿨어요.'); draw(view, 'me'); } catch (err) { YT.err(err); }
    };
    const pt = YT.$('#pushToggle');
    if (pt) pt.onchange = async () => {
      if (!('Notification' in window)) { pt.checked = false; return YT.toast('이 브라우저는 알림을 지원하지 않아요.', 'error'); }
      if (pt.checked) {
        const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (perm !== 'granted') { pt.checked = false; YT.$('#pushState').textContent = '브라우저에서 막혀 있어요'; return YT.toast('브라우저에서 알림을 허용해야 해요.', 'error'); }
        YT.store.set('yt_push', '1'); YT.$('#pushState').textContent = '켜짐';
        try { new Notification('유니 타임즈 알림을 켰어요', { body: '새 소식이 오면 이렇게 알려드릴게요.', icon: '/icon-192.png' }); } catch {}
      } else { YT.store.set('yt_push', '0'); YT.$('#pushState').textContent = '꺼짐'; }
    };
    const pf = YT.$('#pwForm'); if (pf) pf.onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      if (f.password !== f.password2) return YT.toast('새 비밀번호가 서로 달라요.', 'error');
      try { await YT.post('/api/me/password', { current: f.current, password: f.password }); e.target.reset(); YT.toast('비밀번호를 바꿨어요.'); } catch (err) { YT.err(err); }
    };
  }

  // ── 화면 설정 (이 기기에만)
  function displayView() {
    const P = YT.prefs(); const scope = '<span class="set-scope">이 기기에만 적용</span>';
    const install = YT.isStandalone() ? '<span class="set-ok">앱으로 열려 있어요</span>'
      : '<button class="btn small install-only" id="installBtn">앱으로 설치</button><details class="set-how"><summary>설치 방법</summary><ul class="set-list"><li><b>아이폰·아이패드</b>: 사파리 공유 버튼 → ‘홈 화면에 추가’</li><li><b>안드로이드</b>: 크롬 메뉴(⋮) → ‘앱 설치’</li><li><b>컴퓨터</b>: 크롬·엣지 주소창 오른쪽 설치 아이콘</li></ul></details>';
    return panel('보기',
        row('화면 밝기', '자동은 휴대폰·컴퓨터 설정을 따라요', radios('theme', P.theme, [['auto', '자동'], ['light', '밝게'], ['dark', '어둡게']]))
      + row('글자 크기', '어르신은 ‘아주 크게’를 추천해요', radios('size', P.size, [['small', '작게'], ['normal', '보통'], ['big', '크게'], ['bigger', '아주 크게']]))
      + row('움직임 줄이기', '화면 전환·떠오르는 효과를 끕니다', toggle('motion', P.motion === 'reduce', '움직임 줄이기')), { right: scope })
      + panel('1면과 일정',
        row('한눈에 보기 칸', '1면 맨 위 오늘 일정·생일·기사 수', toggle('glance', P.glance, '한눈에 보기 칸'))
      + row('다가오는 날', '1면에 며칠 뒤까지 보여줄지', radios('dday', P.dday, [[14, '2주'], [30, '30일'], [45, '45일'], [90, '90일']]))
      + row('한 주의 시작', '달력 맨 왼쪽 요일', radios('week', P.week, [['sun', '일요일'], ['mon', '월요일']]))
      + row('달력 기본 보기', '일정 → 달력을 열 때', radios('calView', P.calView, [['month', '월간'], ['week', '주간']]))
      + row('다가오는 일정', '일정 → 오늘에 보일 기간', radios('upDays', P.upDays, [[7, '7일'], [14, '14일'], [30, '30일']])), { right: scope })
      + panel('앱', row('앱으로 설치', '홈 화면에 아이콘을 만들어 더 빨리 열고, 인터넷이 끊겨도 마지막 신문을 봐요', `<div class="set-inline">${install}</div>`))
      + `<div class="set-reset"><button class="btn small ghost" id="prefReset">화면 설정 되돌리기</button><span>이 기기의 화면 설정만 기본값으로 돌아가요. 글과 사진은 그대로예요.</span></div>`;
  }
  function displayBind(view) {
    const ib = YT.$('#installBtn'); if (ib) ib.onclick = async () => { if (!(await YT.installApp())) YT.toast('이 브라우저에서는 아래 방법으로 추가해 주세요.'); };
    view.querySelector('.set-body').onchange = (e) => {
      const t = e.target; if (!t.name) return;
      if (t.type === 'radio') YT.setPref(t.name, t.value);
      else if (t.name === 'glance') YT.setPref('glance', t.checked ? '1' : '0');
      else if (t.name === 'motion') YT.setPref('motion', t.checked ? 'reduce' : 'auto');
      YT.toast('이 기기에 저장했어요.'); draw(view, 'display', true);
    };
    YT.$('#prefReset').onclick = () => { if (!YT.confirm('이 기기의 화면 설정을 기본값으로 되돌릴까요?')) return; YT.resetPrefs(); YT.toast('화면 설정을 되돌렸어요.'); draw(view, 'display', true); };
  }

  // ── 신문 정보 (관리자)
  function paperView() {
    const S = YT.state.settings;
    return panel('제호와 표어', `<form class="form set-form" id="settingsForm">
        <div class="form-row"><label>신문 이름<input class="input" name="site_name" maxlength="30" value="${esc(S.site_name)}"></label><label>창간일<input type="date" class="input" name="founded" value="${esc(S.founded)}"></label></div>
        <div class="form-row"><label>머리 문구<input class="input" name="kicker" maxlength="40" value="${esc(S.kicker)}"></label><label class="grow">표어<input class="input" name="tagline" maxlength="60" value="${esc(S.tagline)}"></label></div>
        <label>편집자의 말 (1면 EDITOR’S NOTE)<textarea class="input" name="editor_note" rows="5">${esc(S.editor_note)}</textarea></label>
        <div class="block"><span>제호 로고 (선택)</span><div class="row gap" id="logoRow">${S.logo ? `<img src="${YT.photoUrl(S.logo)}" class="thumb-sm logo-prev" alt="현재 로고">` : '<span class="muted small">로고가 없으면 신문 이름 글자만 표시돼요.</span>'}
          <label class="btn small" for="logoFile">로고 올리기</label><input type="file" accept="image/*" id="logoFile" hidden>${S.logo ? '<button type="button" class="btn small" data-round="logo">원형으로 투명하게</button><button type="button" class="btn small" data-knock="logo">검은 배경 투명하게</button><button type="button" class="btn small danger ghost" id="logoRm">로고 빼기</button>' : ''}</div></div>
        <div class="block"><span>하단 로고 (선택)</span><div class="row gap">${S.mascot ? `<img src="${YT.photoUrl(S.mascot)}" class="thumb-sm logo-prev" alt="현재 하단 로고">` : '<span class="muted small">화면 맨 아래 신문 이름 왼쪽에 보여요. 배경이 투명한 PNG가 가장 깔끔해요.</span>'}
          <label class="btn small" for="mascotFile">로고 올리기</label><input type="file" accept="image/*" id="mascotFile" hidden>${S.mascot ? '<button type="button" class="btn small" data-round="mascot">원형으로 투명하게</button><button type="button" class="btn small" data-knock="mascot">검은 배경 투명하게</button><button type="button" class="btn small danger ghost" id="mascotRm">로고 빼기</button>' : ''}</div></div>
        <div class="set-actions"><button class="btn primary">신문 정보 저장</button></div></form>`, { desc: '1면 제호, 머리·바닥 문구, 이달의 지면에 함께 쓰여요.' })
      + panel('누가 볼 수 있나요', row('가족만 보기', S.members_only === '1' ? '켜짐 — 가족 계정으로 로그인해야 신문을 볼 수 있어요. 계정 없는 친척은 지면의 ‘친척에게 링크 보내기’로 보내 주세요.' : '꺼짐 — 사이트 주소를 아는 사람은 누구나 발행된 기사를 읽을 수 있어요.', toggle('members_only', S.members_only === '1', '가족만 보기')))
      + panel('미리보기', `<div class="set-mast"><small>${esc(S.kicker)}</small><b>${esc(S.site_name)}</b><span>${esc(S.tagline)} · 창간 ${esc(S.founded)}</span></div>`);
  }
  function paperBind(view) {
    let logo = YT.state.settings.logo;
    YT.$('#logoFile').onchange = async (e) => { try { logo = await YT.uploadImage(e.target.files[0], 'logo'); YT.toast('로고를 올렸어요. 저장을 눌러주세요.'); } catch (err) { YT.err(err); } };
    const rm = YT.$('#logoRm'); if (rm) rm.onclick = () => { logo = ''; YT.toast('저장을 누르면 로고가 빠져요.'); };
    let mascot = YT.state.settings.mascot || '';
    YT.$('#mascotFile').onchange = async (e) => { try { mascot = await YT.uploadImage(e.target.files[0], 'logo'); YT.toast('하단 로고를 올렸어요. 저장을 눌러주세요.'); } catch (err) { YT.err(err); } };
    const mrm = YT.$('#mascotRm'); if (mrm) mrm.onclick = () => { mascot = ''; YT.toast('저장을 누르면 하단 로고가 빠져요.'); };
    // 검은 배경 투명하게: 지금 로고를 받아 가장자리의 검은 부분을 지운 PNG로 다시 올리고 바로 저장
    view.querySelectorAll('[data-knock],[data-round]').forEach((b) => b.onclick = async () => {
      const round = !!b.dataset.round; const label = b.textContent;
      const key = b.dataset.knock || b.dataset.round; const id = YT.state.settings[key]; if (!id) return;
      b.disabled = true; b.textContent = '바꾸는 중…';
      try {
        const src = YT.photoUrl(id); const blob = await (await fetch(src.startsWith('data:') ? src : src + (src.includes('?') ? '&' : '?') + 'raw=1', { credentials: 'same-origin' })).blob();
        const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('로고를 읽지 못했어요.')); im.src = URL.createObjectURL(blob); });
        const out = round ? YT.roundCrop(img) : { data: YT.knockoutBlack(img), size: 0 };
        const r = await YT.post('/api/upload', { data: out.data, kind: 'logo', width: out.size || img.naturalWidth, height: out.size || img.naturalHeight });
        const s2 = await YT.put('/api/settings', { [key]: r.id }); YT.state.settings = s2.settings; YT.renderChrome();
        YT.toast(round ? '원형으로 다듬고 바깥을 투명하게 바꿨어요.' : '검은 배경을 투명하게 바꿨어요.'); draw(view, 'paper', true);
      } catch (err) { YT.err(err); b.disabled = false; b.textContent = label; }
    });
    const mo = view.querySelector('input[name=members_only]');
    if (mo) mo.onchange = async () => {
      if (mo.checked && !YT.confirm('가족만 보기를 켤까요? 로그인하지 않은 사람은 기사·사진·일정을 볼 수 없게 돼요.')) { mo.checked = false; return; }
      try { const r = await YT.put('/api/settings', { members_only: mo.checked ? '1' : '0' }); YT.state.settings = r.settings; YT.toast(mo.checked ? '이제 가족 계정으로만 볼 수 있어요.' : '누구나 볼 수 있게 바꿨어요.'); draw(view, 'paper', true); } catch (err) { YT.err(err); mo.checked = !mo.checked; }
    };
    YT.$('#settingsForm').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await YT.put('/api/settings', { ...Object.fromEntries(new FormData(e.target)), logo, mascot }); YT.state.settings = r.settings; YT.renderChrome(); YT.toast('신문 정보를 저장했어요.'); draw(view, 'paper'); } catch (err) { YT.err(err); }
    };
  }

  // ── 가족 계정 (관리자)
  async function familyView() {
    const { users } = await YT.api('/api/users'); const R = YT.ROLES;
    const count = (r) => users.filter((u) => u.role === r).length;
    return `<div class="glance set-kpis">${kpi('가족 계정', users.length, '명')}${kpi('관리자 · 편집장', count('admin') + ' · ' + count('editor'), '')}${kpi('시니어 · 평 · 수습기자', count('senior') + ' · ' + count('staff') + ' · ' + count('reporter'), '')}${kpi('구독자', count('subscriber'), '명')}</div>`
      + panel('가족 계정', `<ul class="set-users">${users.map((u) => `<li data-u="${u.id}">
          <span class="set-avatar sm" aria-hidden="true">${esc(YT.initials(u.display_name))}</span>
          <label class="su-name"><span class="vh">이름</span><input class="input sm" data-f="display_name" value="${esc(u.display_name)}"><input class="input sm su-email" type="email" data-f="username" value="${esc(u.username)}" aria-label="로그인 이메일" autocapitalize="off" spellcheck="false">${u.id === YT.state.user.id ? '<small>나</small>' : (u.username.includes('@') ? '' : '<small class="warn-text">이메일로 바꿔 주세요</small>')}</label>
          <label class="su-role"><span class="vh">권한</span><select class="select sm" data-f="role">${Object.entries(R).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l.split(' · ')[0]}</option>`).join('')}</select></label>
          <label class="su-tt"><input type="checkbox" data-f="timetable_access" ${u.timetable_access || u.role === 'admin' ? 'checked' : ''} ${u.role === 'admin' ? 'disabled' : ''}> 시간표</label>
          <span class="su-btns"><button class="btn small" data-save>저장</button><button class="btn small" data-pw>비밀번호 초기화</button>${u.id !== YT.state.user.id ? '<button class="btn small danger ghost" data-rm>삭제</button>' : ''}</span></li>`).join('')}</ul>`,
        { desc: '이름·권한·시간표 열람을 바꾼 뒤 그 줄의 ‘저장’을 누르세요. 권한은 관리자 → 편집장 → 시니어기자 → 평기자 → 수습기자 → 구독자 순서이고, 위 단계는 아래 단계의 일을 모두 할 수 있어요.' })
      + panel('새 가족 계정 만들기', `<form class="form-row" id="newUser"><label>이름<input class="input" name="display_name" required placeholder="서아"></label><label>이메일 (로그인 아이디)<input class="input" type="email" name="username" required placeholder="seoa@gmail.com" autocapitalize="off" spellcheck="false"></label>
          <label>임시 비밀번호<input class="input" name="password" required minlength="6"></label>
          <label>권한<select class="select" name="role">${Object.entries(R).map(([k, l]) => `<option value="${k}" ${k === 'reporter' ? 'selected' : ''}>${l.split(' · ')[0]}</option>`).join('')}</select></label>
          <button class="btn primary">추가</button></form>`, { desc: '로그인 아이디는 가족 각자의 이메일 주소예요. 만든 뒤 이메일과 임시 비밀번호를 가족에게 알려주세요.' })
      + panel('권한 안내 (7단계)', `<table class="table set-roles"><tbody>${Object.values(R).map((l, i) => `<tr><th><span class="set-rank">${7 - i}</span>${l.split(' · ')[0]}</th><td>${l.split(' · ')[1]}</td></tr>`).join('')}<tr><th><span class="set-rank">1</span>방문자</th><td>로그인하지 않은 사람 — 발행된 기사와 공개 카드 읽기·응원 반응 (‘가족만 보기’를 켜면 볼 수 없어요)</td></tr></tbody></table>`);
  }
  function familyBind(view) {
    view.querySelector('.set-users').onclick = async (e) => {
      const li = e.target.closest('li[data-u]'); const b = e.target.closest('button'); if (!li || !b) return;
      const id = li.dataset.u; const val = (f) => li.querySelector(`[data-f="${f}"]`);
      const body = () => ({ display_name: val('display_name').value, username: val('username').value, role: val('role').value, timetable_access: val('timetable_access').checked });
      try {
        if (b.hasAttribute('data-save')) { await YT.put('/api/users/' + id, body()); YT.toast('저장했어요.'); if (id === YT.state.user.id) { const me = await YT.api('/api/me'); YT.state.user = me.user; YT.renderChrome(); } draw(view, 'family'); }
        if (b.hasAttribute('data-pw')) { const pw = prompt('새 비밀번호 (6자 이상)'); if (!pw) return; await YT.put('/api/users/' + id, { ...body(), password: pw }); YT.toast('비밀번호를 바꿨어요.'); }
        if (b.hasAttribute('data-rm')) { if (!YT.confirm('이 계정을 삭제할까요? 쓴 기사는 그대로 남아요.')) return; await YT.del('/api/users/' + id); YT.toast('계정을 삭제했어요.'); draw(view, 'family'); }
      } catch (err) { YT.err(err); }
    };
    YT.$('#newUser').onsubmit = async (e) => {
      e.preventDefault();
      try { await YT.post('/api/users', Object.fromEntries(new FormData(e.target))); YT.toast('계정을 만들었어요. 이메일과 임시 비밀번호를 가족에게 알려주세요.'); draw(view, 'family'); } catch (err) { YT.err(err); }
    };
  }

  // ── 자료 관리 (관리자)
  const kb = (n) => (n >= 1024 ? (n / 1024).toFixed(1) + '<small>MB</small>' : n + '<small>KB</small>');
  async function dataView() {
    const [s, bk] = await Promise.all([YT.api('/api/stats'), YT.api('/api/backups').catch(() => ({ backups: [], keep: 14 }))]);
    const lb = YT.store.get('yt_last_backup', ''); const days = lb ? YT.dayDiff(lb, YT.today()) : null;
    const lastAuto = bk.backups[0];
    return `<div class="glance set-kpis wide">${kpi('발행 기사', s.articles, '편', '#/')}${kpi('초안·검토', s.drafts, '편', '#/newsroom')}${kpi('일정·기념일', s.events, '개', '#/calendar')}${kpi('카드·편지', s.cards, '장', '#/post')}
        ${kpi('댓글 · 한마디', s.comments + ' · ' + s.notes, '')}${kpi('사진 · 앨범', s.photos + ' · ' + s.albums, '', '#/studio')}${kpi('인물 · 시간표', s.people + ' · ' + s.timetables, '')}${kpi('자료 크기', kb(s.db_kb + s.upload_kb), '')}</div>`
      + (s.cloud ? `<div class="set-note">클라우드(Vercel + Neon)에서 운영 중이에요. 글·일정 자료는 <b>Neon 데이터베이스</b>가, 사진·소리는 <b>Vercel Blob</b>이 보관해요.${lb ? ` · 내 컴퓨터로 받은 백업: ${esc(lb)}` : ''}</div>`
        + panel('자동 백업 (클라우드)', `<p class="set-desc">Neon은 데이터베이스를 지난 시점으로 되돌리는 기능을 스스로 갖고 있어요 (무료 요금제는 되돌릴 수 있는 기간이 짧아요). Neon 관리 화면 › <b>Restore</b>에서 시점을 고르면 돼요. 그래도 한 달에 한 번은 아래 <b>전체 백업</b>을 내 컴퓨터에 받아 두는 게 가장 안전해요.</p>`)
        + panel('백업 (내 컴퓨터로)', `<p class="set-desc">기사·일정·카드·댓글·투표·앨범 구성 등 모든 글 자료를 JSON 파일 하나로 내려받아요. 비밀번호와 사진 파일은 들어가지 않아요. (자료 크기: 데이터베이스 ${kb(s.db_kb).replace(/<\/?small>/g, '')} · 사진·소리 ${s.upload_files}개)</p>
          <div class="set-actions"><button class="btn primary" id="backupBtn">백업 파일 내려받기</button></div>`)
        : `<div class="set-note ${lastAuto && YT.dayDiff(lastAuto.date, YT.today()) <= 1 ? '' : 'warn'}">${lastAuto ? `서버 자동 백업: <b>${esc(lastAuto.date)}</b> (${YT.dayDiff(lastAuto.date, YT.today()) === 0 ? '오늘' : YT.dayDiff(lastAuto.date, YT.today()) + '일 전'}) · 최근 ${bk.backups.length}일치 보관 중` : '서버 자동 백업이 아직 없어요. 아래 ‘지금 백업’을 한 번 눌러 보세요.'}${lb ? ` · 내 컴퓨터로 받은 백업: ${esc(lb)}` : ''}</div>`
      + panel('자동 백업 (서버에)', `<p class="set-desc">서버가 켜져 있으면 <b>매일 새벽 3시 무렵</b> 글·일정 자료를 <code>${esc(bk.dir || 'data/backups')}</code> 폴더에 하루 한 개씩 복사해요. 최근 <b>${bk.keep}일치</b>만 남기고 오래된 것은 지워요. 사진은 새로 올라온 것만 함께 복사하고, 기사에서 사진을 지워도 백업에는 남아요.</p>
          ${bk.backups.length ? `<ul class="bk-list">${bk.backups.slice(0, 7).map((b) => `<li><span>${esc(b.date)}</span><small>${b.kb >= 1024 ? (b.kb / 1024).toFixed(1) + 'MB' : b.kb + 'KB'}</small></li>`).join('')}${bk.backups.length > 7 ? `<li class="muted">외 ${bk.backups.length - 7}개</li>` : ''}</ul>` : ''}
          <details class="set-more"><summary>자동 백업으로 되돌리는 방법</summary><ol class="set-list"><li>서버를 끕니다 (터미널에서 Ctrl+C, NAS는 컨테이너 중지).</li><li><code>data/ytimes.db</code>를 다른 이름으로 옮겨 두고, <code>data/backups/ytimes-날짜.db</code>를 <code>data/ytimes.db</code>로 복사합니다.</li><li>사진이 사라졌다면 <code>data/backups/uploads</code>의 파일을 <code>data/uploads</code>로 복사합니다.</li><li>서버를 다시 켭니다.</li></ol></details>
          <div class="set-actions"><button class="btn" id="autoBackupBtn">지금 백업</button></div>`)
      + panel('백업 (내 컴퓨터로)', `<p class="set-desc">기사·일정·카드·댓글·투표·앨범 구성 등 모든 글 자료를 JSON 파일 하나로 내려받아요. 비밀번호는 들어가지 않아요.</p>
          <ul class="set-list"><li>사진 원본 ${s.upload_files}개(${kb(s.upload_kb).replace(/<\/?small>/g, '')})는 서버의 <code>data/uploads</code> 폴더에 있어요. 폴더째 함께 복사해두세요.</li>
          <li>데이터베이스 파일은 <code>data/ytimes.db</code>(${kb(s.db_kb).replace(/<\/?small>/g, '')})예요. 서버를 끈 상태에서 <code>data</code> 폴더를 통째로 복사하면 가장 확실한 백업이에요.</li></ul>
          <div class="set-actions"><button class="btn primary" id="backupBtn">백업 파일 내려받기</button></div>`))
      + panel('서버로 옮기기용 전체 백업', `<p class="set-desc">기사·일정·할 일·주소록 같은 글 자료에 <b>사진과 목소리 파일까지 모두</b> 담은 백업 파일 하나를 만들어요. 다른 서버(NAS)로 옮길 때, 새 서버의 <b>설정 › 자료 관리 › 백업 되돌리기</b>에 이 파일을 올리면 그대로 옮겨져요. 가족 계정(이메일·비밀번호)은 옮겨지지 않으니 새 서버에서 다시 만들어 주세요.</p>
          <div class="set-actions"><button class="btn primary" id="fullBackupBtn">전체 백업 내려받기 (사진 포함)</button><span class="muted small" id="fullBackupMsg"></span></div>`)
      + panel('백업 되돌리기', `<p class="set-desc">내려받아 둔 백업 파일(JSON)로 기사·일정·카드·투표 등 자료를 그때 상태로 되돌려요. <b>지금 자료는 모두 백업 파일 내용으로 바뀌어요.</b> 가족 계정과 비밀번호는 그대로예요.</p>
          <div class="row gap"><label class="btn" for="restoreFile">백업 파일 고르기</label><input type="file" id="restoreFile" accept=".json,application/json" hidden><span class="muted small" id="restoreInfo">먼저 지금 상태를 ‘백업 파일 내려받기’로 받아두면 안전해요.</span></div>
          <div id="restoreBox" hidden class="restore-box"></div>`, { cls: 'danger-zone' })
      + (s.no_thumb ? panel('사진 미리보기 만들기', `<p class="set-desc">예전에 올린 사진 ${s.no_thumb}장에는 작은 미리보기가 없어 목록이 느릴 수 있어요. 이 브라우저에서 한 번에 만들어 둘게요. (사진이 많으면 몇 분 걸려요)</p>
          <div class="row gap"><button class="btn" id="thumbBtn">미리보기 ${s.no_thumb}장 만들기</button><span class="muted small" id="thumbInfo"></span></div>`) : '')
      + panel('휴지통', `<p class="set-desc">지운 기사와 일정은 바로 사라지지 않고 휴지통에 남아요. 지금 ${s.trashed}개가 있어요.</p>
          <div class="row gap"><a class="btn" href="#/newsroom">편집실 휴지통 (기사)</a><a class="btn" href="#/calendar">캘린더 휴지통 (일정)</a></div>`)
      + panel('이 기기 정리', `<p class="set-desc">이 브라우저에 남은 기사 자동 임시 저장본 <b id="draftN">${draftKeys().length}</b>개를 지웁니다. 서버에 저장한 글은 지워지지 않아요.</p>
          <div class="row gap"><button class="btn danger ghost" id="clearDrafts" ${draftKeys().length ? '' : 'disabled'}>임시 저장본 지우기</button></div>`, { cls: 'danger-zone' });
  }
  // 서버로 옮기기용 전체 백업 (사진·소리 파일 포함) — 설정 화면과 미리보기 막대에서 쓴다
  YT.fullBackup = async (btn, msg) => {
    if (btn) btn.disabled = true; if (msg) msg.textContent = '사진까지 모으는 중…';
    try {
      let data;
      if (YT.state.settings && YT.state.settings.cloud) {
        // 클라우드는 한 번에 4.5MB까지라 사진·소리를 여러 번에 나눠 받는다
        data = await YT.api('/api/backup?files=list'); const names = data.file_names || []; delete data.file_names; data.files = {};
        let left = names.slice();
        while (left.length) {
          const batch = left.slice(0, 40);
          const r = await YT.api('/api/backup/files?names=' + encodeURIComponent(batch.join(',')));
          Object.assign(data.files, r.files || {});
          const done = new Set(r.done && r.done.length ? r.done : batch); left = left.filter((x) => !done.has(x));
          if (msg) msg.textContent = `사진·소리 모으는 중… ${names.length - left.length} / ${names.length}`;
        }
      } else data = await YT.api('/api/backup?files=1');
      const n = Object.keys(data.files || {}).length; const text = JSON.stringify(data);
      if (msg) msg.textContent = `사진·소리 파일 ${n}개 · ${(text.length / 1048576).toFixed(1)}MB`;
      if (await YT.saveFile(`unitimes-full-backup-${YT.today()}.json`, text)) { YT.store.set('yt_last_backup', YT.today()); YT.toast('전체 백업 파일을 내려받았어요. 새 서버의 ‘백업 되돌리기’에 올리면 돼요.'); }
    } catch (err) { YT.err(err); if (msg) msg.textContent = ''; }
    if (btn) btn.disabled = false;
  };
  const draftKeys = () => { try { return Object.keys(localStorage).filter((k) => /draft/i.test(k)); } catch { return []; } };
  function dataBind(view) {
    const ab = YT.$('#autoBackupBtn'); if (ab) ab.onclick = async () => { ab.disabled = true; try { const r = await YT.post('/api/backups', {}); YT.toast(r.message); draw(view, 'data'); } catch (err) { YT.err(err); ab.disabled = false; } };
    YT.$('#backupBtn').onclick = async () => {
      try {
        const data = await YT.api('/api/backup');
        if (!(await YT.saveFile(`unitimes-backup-${YT.today()}.json`, JSON.stringify(data, null, 2)))) return;
        YT.store.set('yt_last_backup', YT.today()); YT.toast('백업 파일을 내려받았어요.'); draw(view, 'data');
      } catch (err) { YT.err(err); }
    };
    YT.$('#fullBackupBtn').onclick = () => YT.fullBackup(YT.$('#fullBackupBtn'), YT.$('#fullBackupMsg'));
    const tb = YT.$('#thumbBtn');
    if (tb) tb.onclick = async () => {
      tb.disabled = true; const info = YT.$('#thumbInfo');
      const { ids } = await YT.api('/api/photos/no-thumb'); let ok = 0, bad = 0;
      for (let i = 0; i < ids.length; i++) {
        info.textContent = `${i + 1} / ${ids.length} 만드는 중…`;
        try {
          const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = YT.photoUrl(ids[i]); });
          await YT.post(`/api/photos/${ids[i]}/thumb`, { thumb: YT.makeThumb(img) }); ok++;
        } catch { bad++; }
      }
      YT.toast(`미리보기 ${ok}장을 만들었어요.${bad ? ` (${bad}장은 원본이 없어 건너뛰었어요)` : ''}`); draw(view, 'data');
    };
    YT.$('#restoreFile').onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      let data; try { data = JSON.parse(await file.text()); } catch { return YT.toast('JSON 파일을 읽지 못했어요.', 'error'); }
      if (!data || !data.exported || !Array.isArray(data.articles)) return YT.toast('유니 타임즈 백업 파일이 아니에요.', 'error');
      const box = YT.$('#restoreBox'); box.hidden = false;
      const n = (k) => (Array.isArray(data[k]) ? data[k].length : 0);
      box.innerHTML = `<p><b>${esc(file.name)}</b> · ${esc(YT.shortDate(data.exported))}에 만든 백업</p>
        <p class="muted small">기사 ${n('articles')} · 일정 ${n('events')} · 카드 ${n('cards')} · 댓글 ${n('comments')} · 투표 ${n('polls')} · 한마디 ${n('notes')} · 인물 ${n('people')} · 할 일 ${n('items')} · 앨범 ${n('albums')} · 사진 정보 ${n('photos')}</p>
        ${data.files ? `<p class="muted small">사진·소리 파일 <b>${Object.keys(data.files).length}개</b>가 들어 있는 전체 백업이에요. 사진도 함께 옮겨져요.</p>` : '<p class="muted small">사진 원본은 이 백업 파일에 들어 있지 않아요. 서버의 <code>data/uploads</code> 폴더가 그대로 있어야 사진이 보여요. (사진까지 옮기려면 ‘전체 백업’ 파일을 쓰세요)</p>'}
        <form class="row gap" id="restoreForm"><input class="input sm" name="c" placeholder="되돌리기" aria-label="확인 문구" style="max-width:9rem"><button class="btn danger">이 백업으로 되돌리기</button></form>
        <p class="muted small">계속하려면 칸에 <b>되돌리기</b>라고 적어주세요.</p>`;
      YT.$('#restoreForm').onsubmit = async (ev) => {
        ev.preventDefault(); const c = ev.target.c.value.trim();
        if (c !== '되돌리기') return YT.toast('칸에 ‘되돌리기’라고 적어주세요.', 'error');
        try {
          let r;
          if (YT.state.settings && YT.state.settings.cloud && data.files) {
            // 클라우드: 글·일정 먼저, 사진·소리는 3MB씩 나눠 올린다
            const { files, ...rest } = data; const info = YT.$('#restoreInfo');
            r = await YT.post('/api/restore', { data: rest, confirm: c });
            const names = Object.keys(files); let batch = {}, size = 0, sent = 0;
            const flush = async () => { if (!size) return; await YT.post('/api/restore/files', { files: batch }); sent += Object.keys(batch).length; batch = {}; size = 0; if (info) info.textContent = `사진·소리 올리는 중… ${sent} / ${names.length}`; };
            for (const k of names) { if (size && size + files[k].length > 3 * 1024 * 1024) await flush(); batch[k] = files[k]; size += files[k].length; }
            await flush();
          } else r = await YT.post('/api/restore', { data, confirm: c });
          YT.state.settings = r.settings; YT.clearCache(); YT.renderChrome(); YT.toast('백업으로 되돌렸어요.'); draw(view, 'data'); }
        catch (err) { YT.err(err); }
      };
    };
    YT.$('#clearDrafts').onclick = () => {
      const ks = draftKeys(); if (!ks.length || !YT.confirm(`임시 저장본 ${ks.length}개를 지울까요? 되돌릴 수 없어요.`)) return;
      ks.forEach((k) => { try { localStorage.removeItem(k); } catch {} }); YT.toast('임시 저장본을 지웠어요.'); draw(view, 'data');
    };
  }

  const VIEWS = { me: [meView, meBind], display: [displayView, displayBind], paper: [paperView, paperBind], family: [familyView, familyBind], data: [dataView, dataBind] };

  async function draw(view, sub, keepScroll) {
    const subs = visible(); const cur = subs.find((s) => s[0] === sub) || subs[0];
    const y = window.scrollY;
    const [render, bind] = VIEWS[cur[0]];
    let body;
    try { body = await render(); } catch (err) { body = `<div class="empty-state"><h2>불러오지 못했어요</h2><p>${esc(err.message)}</p></div>`; }
    view.innerHTML = `<nav class="sub-bar set-tabs no-print" aria-label="설정 메뉴"><div class="sub-bar-in">${subs.map(([k, l, role]) => `<a href="#/settings/${k}" class="${k === cur[0] ? 'on' : ''}" ${k === cur[0] ? 'aria-current="page"' : ''}>${l}${role ? '<i class="set-lock" title="관리자 전용">관리자</i>' : ''}</a>`).join('')}</div></nav>
      <div class="set-page"><div class="set-head"><h1 class="page-title">${esc(cur[1])}</h1><p class="page-desc">${esc(cur[3])}</p></div>
      <div class="set-body">${body}</div></div>`;
    try { bind(view); } catch (err) { console.error(err); }
    const on = view.querySelector('.sub-bar a.on'); const nav = view.querySelector('.sub-bar-in');
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
    if (keepScroll) window.scrollTo({ top: y });
  }

  YT.addRoute('/settings', async (view) => draw(view, YT.state.user ? 'me' : 'display'));
  YT.addRoute('/settings/:sub', async (view, p) => {
    const need = SUBS.find((s) => s[0] === p.sub);
    if (need && need[2] && !YT.can(need[2])) {
      if (!YT.state.user) return YT.needLogin(view, '관리자만 볼 수 있는 설정이에요.');
      view.innerHTML = `<div class="empty-state"><h2>관리자만 볼 수 있는 설정이에요</h2><p class="muted">신문 정보·가족 계정·자료 관리는 관리자 계정에서 바꿀 수 있어요.</p><a class="btn" href="#/settings/me">내 정보로</a></div>`;
      return;
    }
    return draw(view, p.sub);
  });
})();
