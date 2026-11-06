/* 유니 타임즈 — 공통 모듈 */
(function () {
  'use strict';
  const YT = (window.YT = { pages: {}, state: { user: null, settings: {}, sections: [], categories: [], emojis: [] } });

  // ── 유틸
  // 이름 동그라미: 세 글자 이상 한글 이름은 성을 빼고 두 글자(김신중 → 신중), 그 밖은 앞 두 글자
  const initials = (n) => { n = String(n || '').trim(); return /^[가-힣]{3,4}$/.test(n) ? n.slice(-2) : n.slice(0, 2); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  YT.initials = initials;
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  YT.esc = esc; YT.nl2br = nl2br; YT.$ = $; YT.$$ = $$;

  // 한국 시간 기준 날짜
  const kstParts = (d = new Date()) => {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
    return f.format(d); // YYYY-MM-DD
  };
  YT.today = () => kstParts();
  YT.pad = (n) => String(n).padStart(2, '0');
  YT.ymd = (y, m, d) => `${y}-${YT.pad(m)}-${YT.pad(d)}`;
  YT.addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  YT.dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
  YT.weekday = (s) => '일월화수목금토'[new Date(s + 'T00:00:00Z').getUTCDay()];
  YT.longDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}년 ${m}월 ${d}일 ${YT.weekday(s)}요일`; };
  YT.shortDate = (iso) => { const s = String(iso || ''); return s.length > 10 && !isNaN(new Date(s)) ? kstParts(new Date(s)) : s.slice(0, 10); };
  YT.monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${y}년 ${Number(m)}월`; };
  YT.relTime = (iso) => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전'; if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    return YT.shortDate(iso);
  };
  // size 't' = 작은 미리보기 (없으면 서버가 원본을 줌)
  YT.photoUrl = (id, size) => (id ? `/api/photo/${encodeURIComponent(id)}${size === 't' ? '?s=t' : ''}` : '');
  YT.thumbUrl = (id) => YT.photoUrl(id, 't');
  YT.tags = (s) => [...new Set(String(s || '').split(/[\s,]+/).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean))];
  YT.debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ── API
  YT.api = async (path, opts = {}) => {
    const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    const res = await fetch(path, init);
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) { const e = new Error(data.error || '요청 실패'); e.status = res.status; throw e; }
    return data;
  };
  YT.post = (p, body) => YT.api(p, { method: 'POST', body: body || {} });
  YT.put = (p, body) => YT.api(p, { method: 'PUT', body: body || {} });
  YT.del = (p) => YT.api(p, { method: 'DELETE' });

  // ── 권한
  const RANK = { subscriber: 2, reporter: 3, staff: 4, senior: 5, editor: 6, admin: 7 };
  YT.can = (role) => !!YT.state.user && RANK[YT.state.user.role] >= RANK[role];

  // ── 토스트·모달
  let toastTimer;
  YT.toast = (msg, kind = '') => {
    const el = $('#toast'); el.textContent = msg; el.className = 'show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = ''), 2800);
  };
  YT.err = (e) => YT.toast(e?.message || String(e), 'error');
  YT.modal = (html, { wide = false, onClose } = {}) => {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <button class="modal-x" data-close aria-label="닫기">×</button>${html}</div></div>`;
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); onClose && onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.modal-back').addEventListener('click', (e) => { if (e.target.classList.contains('modal-back') || e.target.closest('[data-close]')) close(); });
    return { el: root.querySelector('.modal'), close };
  };
  YT.confirm = (msg) => window.confirm(msg);

  // ── 이미지: 브라우저에서 줄인 뒤 업로드
  YT.readImage = (file, maxSide = 2000, quality = 0.86) => new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('이미지 파일을 선택해주세요.'));
    if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return reject(new Error('HEIC 사진은 JPG로 변환해주세요.'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL('image/jpeg', quality), thumb: YT.makeThumb(img), width: c.width, height: c.height, name: file.name,
        taken: file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : '' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다.')); };
    img.src = url;
  });
  // 목록·카드용 작은 사진 (긴 변 640px)
  YT.makeThumb = (img, side = 640) => {
    const s = Math.min(1, side / Math.max(img.width || img.naturalWidth, img.height || img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round((img.width || img.naturalWidth) * s)); c.height = Math.max(1, Math.round((img.height || img.naturalHeight) * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8);
  };
  YT.uploadImage = async (file, kind = 'article') => {
    const img = await YT.readImage(file);
    const r = await YT.post('/api/upload', { data: img.data, thumb: img.thumb, kind, width: img.width, height: img.height });
    return r.id;
  };

  // ── 공통 데이터 캐시
  const cache = {};
  // 기사 목록: 보통은 가벼운 목록(제목·요약), 본문이 필요한 화면(지면·레시피북·검색)만 full로
  YT.getArticles = async (force, full) => {
    const fresh = (c) => !force && c && Date.now() - c.t < 15000;
    if (fresh(cache.articlesFull)) return cache.articlesFull.v;
    if (!full && fresh(cache.articles)) return cache.articles.v;
    const r = await YT.api('/api/articles' + (full ? '?full=1' : ''));
    cache[full ? 'articlesFull' : 'articles'] = { v: r.articles, t: Date.now() }; return r.articles;
  };
  YT.getYearEvents = async (year, force) => {
    const k = 'ev' + year;
    if (!force && cache[k] && Date.now() - cache[k].t < 15000) return cache[k].v;
    const r = await YT.api(`/api/events?year=${year}`); cache[k] = { v: r, t: Date.now() }; return r;
  };
  YT.clearCache = () => { for (const k in cache) delete cache[k]; };
  // 기간 내 일정(여러 날 일정 포함)
  YT.occurrencesBetween = async (from, to) => {
    const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
    const res = await Promise.all(years.map((y) => YT.getYearEvents(y)));
    const seen = new Set(); const out = [];
    for (const r of res) for (const o of r.occurrences) {
      const end = o.end_date && o.end_date > o.date ? o.end_date : o.date;
      if (end < from || o.date > to) continue;
      const key = o.id + o.date; if (seen.has(key)) continue; seen.add(key); out.push(o);
    }
    return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  };
  YT.eventIcon = (o) => `<i class="k-dot k-${o.kind}" aria-hidden="true"></i>`;
  YT.eventMeta = (o) => {
    const bits = [];
    if (o.kind === 'birthday') { bits.push(`${o.calendar === 'lunar' ? '음력' : '양력'} ${o.birth_month}월 ${o.birth_day}일`); if (o.age) bits.push(o.age + '세'); if (o.adjusted) bits.push('올해는 대체일로 표시'); }
    if (o.kind === 'anniversary') bits.push(o.anniversary_years ? o.anniversary_years + '주년' : '시작일');
    if (o.repeat_label) bits.push('↻ ' + o.repeat_label);
    return bits.join(' · ');
  };
  YT.eventItem = (o) => `
    <li class="ev-item">
      <div class="ev-date">${esc(o.date)}${o.end_date && o.end_date > o.date ? ' ~ ' + esc(o.end_date) : ''} · ${o.time ? esc(o.time) + (o.end_time ? '–' + esc(o.end_time) : '') : '종일'}${o.kind !== 'event' ? ' · 매년 반복' : ''}</div>
      <div class="ev-title">${YT.eventIcon(o)} ${esc(o.title)}</div>
      ${YT.eventMeta(o) ? `<div class="ev-meta">${esc(YT.eventMeta(o))}</div>` : ''}
      ${o.location ? `<div class="ev-meta">장소 · ${esc(o.location)}</div>` : ''}
      ${o.notes ? `<div class="ev-meta">${esc(o.notes)}</div>` : ''}
    </li>`;

  // ── 기사 카드
  // 새 글 표시: 마지막 방문 이후 발행된 기사
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  YT.store = store;
  YT.lastVisit = store.get('yt_last_visit', '');
  YT.isNew = (a) => !!YT.lastVisit && (a.published_at || a.updated) > YT.lastVisit;
  YT.readMinutes = (a) => Math.max(1, Math.round(((a.blocks || []).reduce((n, b) => n + (b.text || '').length, 0) || a.chars || (a.excerpt || '').length) / 500));
  YT.rxTotal = (a) => Object.values(a.reactions || {}).reduce((x, y) => x + y, 0);
  YT.issueNo = (ym) => {
    const f = YT.state.settings.founded || ym; const [y, m] = ym.split('-').map(Number); const [fy, fm] = f.split('-').map(Number);
    return Math.max(1, (y - fy) * 12 + (m - fm) + 1);
  };

  // ── 기사 카드
  YT.articleCard = (a, opts = {}) => `
    <article class="a-card ${opts.big ? 'big' : ''} ${a.photo ? '' : 'no-photo'}">
      <a href="#/article/${a.id}" class="a-link">
        ${a.photo ? `<div class="a-thumb"><img src="${YT.thumbUrl(a.photo)}" alt="${esc(a.photo_caption || a.title)}" loading="lazy"></div>` : ''}
        <div class="a-text">
          <div class="a-kicker"><span>${esc(a.section)}</span>${YT.isNew(a) ? '<b class="new-dot">새 글</b>' : ''}</div>
          <h3 class="a-title">${esc(a.title)}</h3>
          ${opts.excerpt !== false ? `<p class="a-excerpt">${esc(a.excerpt || '')}</p>` : ''}
          <div class="a-byline"><span>${esc(YT.shortDate(a.published_at || a.updated))}</span><span>${esc(a.author_name)}</span>
            ${a.comment_count ? `<span>댓글 ${a.comment_count}</span>` : ''}${YT.rxTotal(a) ? `<span>공감 ${YT.rxTotal(a)}</span>` : ''}</div>
        </div>
      </a>
    </article>`;

  // ── 보기 설정: 다크 모드·큰 글씨
  // 화면 설정 (이 기기에만 저장) — 설정 → 화면 설정에서 바꿉니다
  YT.prefs = () => {
    const theme = ['auto', 'light', 'dark', 'time'].includes(store.get('yt_theme', 'auto')) ? store.get('yt_theme', 'auto') : 'auto';
    let size = store.get('yt_size', ''); if (!['small', 'normal', 'big', 'bigger'].includes(size)) size = store.get('yt_big', '0') === '1' ? 'big' : 'normal';
    const dday = [14, 30, 45, 90].includes(+store.get('yt_dday', '45')) ? +store.get('yt_dday', '45') : 45;
    return { theme, size, dday, motion: store.get('yt_motion', 'auto') === 'reduce' ? 'reduce' : 'auto', glance: store.get('yt_glance', '1') !== '0', week: store.get('yt_week', 'sun') === 'mon' ? 'mon' : 'sun',
      calView: store.get('yt_calView', 'month') === 'week' ? 'week' : 'month', upDays: [7, 14, 30].includes(+store.get('yt_upDays', '7')) ? +store.get('yt_upDays', '7') : 7 };
  };
  YT.setPref = (k, v) => { store.set('yt_' + k, String(v)); if (k === 'size') store.set('yt_big', v === 'normal' ? '0' : '1'); YT.applyPrefs(); };
  YT.resetPrefs = () => { for (const k of ['theme', 'size', 'big', 'dday', 'motion', 'glance', 'week', 'calView', 'upDays', 'cal_view']) { try { localStorage.removeItem('yt_' + k); } catch {} } YT.applyPrefs(); };
  YT.isDayTime = () => { const h = new Date().getHours(); return h >= 7 && h < 19; };
  YT.applyPrefs = () => {
    const P = YT.prefs(); const root = document.documentElement;
    const dark = P.theme === 'dark' || (P.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches) || (P.theme === 'time' && !YT.isDayTime());
    root.dataset.theme = dark ? 'dark' : 'light';
    root.classList.toggle('small-text', P.size === 'small'); root.classList.toggle('big-text', P.size === 'big'); root.classList.toggle('bigger-text', P.size === 'bigger');
    root.classList.toggle('reduce-motion', P.motion === 'reduce');
    const tb = $('#themeBtn'); if (tb) { tb.setAttribute('aria-pressed', dark); tb.title = dark ? '밝은 화면으로' : '어두운 화면으로'; }
    const bb = $('#bigBtn'); if (bb) bb.setAttribute('aria-pressed', P.size !== 'normal');
    if (YT.fitNav) YT.fitNav();
  };
  setInterval(() => { if (YT.prefs().theme === 'time') YT.applyPrefs(); }, 5 * 60 * 1000);

  // ── 헤더·푸터
  // 메뉴 구성 — 네 묶음(신문 · 일정 · 가족 · 편집국). 메뉴는 한 단계, 각 화면 안의 탭은 2~4개
  // 권한이 없는 메뉴는 아예 보이지 않게. [주소, 이름, 함께 켜질 주소들, 짧은 설명]
  YT.navGroups = () => {
    const u = YT.state.user; const tt = !!u && (YT.can('admin') || u.timetable_access);
    return [
      { name: '신문', items: [['#/', '1면', ['#/'], '오늘의 신문'], ['#/articles', '기사', ['#/articles', '#/article/', '#/section/', '#/recipes', '#/map', '#/read'], '코너별 기사 · 크게 읽기 · 레시피북 · 여행 지도'], ['#/print', '지면', ['#/print'], '이달의 지면 · 합본호']] },
      { name: '일정', items: [['#/agenda', '일정', ['#/agenda', '#/calendar', '#/anniversaries'], '오늘 · 달력 · 생일·기념일'], tt && ['#/timetable', '시간표', ['#/timetable'], '학교·학원 시간표'], YT.can('subscriber') && ['#/todo', '할 일', ['#/todo'], '당번 · 가족회의 · 버킷리스트']].filter(Boolean) },
      { name: '가족', items: [['#/board', '가족 광장', ['#/board'], '투표 · 오늘의 한마디'], ['#/people', '가족 앨범', ['#/people', '#/family-tree', '#/growth', '#/timeline'], '인물 · 가계도 · 성장 기록 · 가족 연표'], ['#/post', '우체국', ['#/post'], '편지·카드 · 타임캡슐'], YT.can('admin') && ['#/studio', '사진관', ['#/studio'], '사진 보관·앨범']].filter(Boolean) },
      YT.can('reporter') && { name: '편집국', items: [['#/newsroom', '편집실', ['#/newsroom', '#/write'], '기사 쓰기 · 검토 · 발행'], ['#/reporters', '기자단', ['#/reporters'], '배지 · 시상식']] },
    ].filter(Boolean);
  };
  // 화면 안의 작은 탭 — 같은 메뉴에 속한 화면끼리 오가기
  YT.SUBTABS = {
    articles: [['#/articles', '기사 목록'], ['#/read', '크게 읽기'], ['#/recipes', '레시피북'], ['#/map', '여행 지도']],
    paper: [['#/print', '이달의 지면'], ['#/print-year', '합본호'], ['#/print-mail', '우편 발송', 'editor']],
    album: [['#/people', '인물'], ['#/family-tree', '가계도'], ['#/growth', '성장 기록'], ['#/timeline', '가족 연표']],
    todo: [['#/todo', '한눈에'], ['#/todo/prep', '행사 준비'], ['#/todo/chores', '집안일 당번'], ['#/todo/meeting', '가족회의'], ['#/todo/bucket', '버킷리스트']],
    desk: [['#/newsroom', '편집실'], ['#/write', '기사 쓰기'], ['#/reporters', '기자단']],
    schedule: [['#/agenda', '오늘'], ['#/calendar', '달력'], ['#/anniversaries', '생일·기념일']],
  };
  YT.subTabs = (group, variant) => {
    const h = (location.hash || '#/').replace(/\?.*/, '');
    const list = (YT.SUBTABS[group] || []).filter((t) => !t[2] || YT.can(t[2]));
    const act = list.map(([href]) => href).filter((href) => h === href || h.startsWith(href + '/') || (href === '#/print-year' && h.startsWith('#/print-year'))).sort((a, b) => b.length - a.length)[0];
    if (variant !== 'pill') // 보장설계 도우미처럼: 위쪽 메뉴 바로 아래 가로 줄 메뉴 (화면 폭 가득)
      return `<nav class="sub-bar no-print" aria-label="같은 메뉴의 화면"><div class="sub-bar-in">${list.map(([href, l]) => `<a href="${href}" class="${href === act ? 'on' : ''}" ${href === act ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</div></nav>`;
    return `<nav class="sub-tabs no-print" aria-label="같은 메뉴의 화면">${list.map(([href, l]) => `<a href="${href}" class="${href === act ? 'on' : ''}" ${href === act ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  };
  const TAB_ICON = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 16h5"/></svg>',
    news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    fam: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14.5 15.2c.8-.5 1.7-.7 2.5-.7 2 0 3.5 1.2 4 3.5"/></svg>',
    all: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>',
  };
  // 휴대폰 '전체 메뉴' — 묶음별로 한눈에
  YT.openMenu = () => {
    const u = YT.state.user;
    const m = YT.modal(`<h2 class="modal-title">전체 메뉴</h2><div class="menu-sheet">
      ${YT.navGroups().map((g) => `<section><h3>${g.name}</h3><div class="ms-grid">${g.items.map(([h, l, , d]) => `<a href="${h}" class="ms-item"><b>${l}</b><small>${d}</small></a>`).join('')}</div></section>`).join('')}
      <section><h3>나</h3><div class="ms-grid">
        ${YT.can('reporter') ? `<a href="#/newsroom" class="ms-item"><b>편집실${YT.state.todo ? ` <i class="nbadge-in">${YT.state.todo}</i>` : ''}</b><small>기사 쓰기·승인·발행</small></a>` : ''}
        <a href="#/settings" class="ms-item"><b>설정</b><small>내 정보·화면 설정</small></a>
        <a href="#/guide" class="ms-item"><b>이용 안내</b><small>처음이라면 여기부터</small></a>
        ${u ? '<button class="ms-item" id="msLogout"><b>로그아웃</b><small>' + esc(u.display_name) + ' · ' + esc(u.role_label) + '</small></button>' : '<a href="#/login" class="ms-item"><b>로그인</b><small>가족 계정으로</small></a>'}
      </div></section></div>`);
    m.el.addEventListener('click', (e) => { if (e.target.closest('a')) m.close(); });
    const lo = m.el.querySelector('#msLogout'); if (lo) lo.onclick = () => { m.close(); YT.logout(); };
  };
  const ICON = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M15.8 16h4.4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  };
  YT.ICON = ICON;
  // ── 빠른 화면 설정 (팝업): 화면 밝기 · 글자 크기 · 움직임 줄이기 — 이 기기에만 저장
  const QS = {
    theme: [['auto', '기기 따라'], ['light', '밝게'], ['dark', '어둡게'], ['time', '시간대 따라']],
    size: [['small', '작게'], ['normal', '보통'], ['big', '크게'], ['bigger', '아주 크게']],
  };
  const qsHtml = () => {
    const P = YT.prefs();
    const seg = (k) => `<div class="qs-seg" role="radiogroup">${QS[k].map(([v, l]) => `<button type="button" role="radio" aria-checked="${P[k] === v}" data-qs="${k}" data-v="${v}" class="${P[k] === v ? 'on' : ''}${k === 'size' ? ' qs-' + v : ''}">${k === 'size' ? `<span>가</span>${l}` : l}</button>`).join('')}</div>`;
    return `<div class="qs-head"><b>화면 설정</b><small>이 기기에만 저장돼요</small></div>
      <div class="qs-row"><span class="qs-lbl">화면 밝기</span>${seg('theme')}</div>
      <div class="qs-row"><span class="qs-lbl">글자 크기</span>${seg('size')}</div>
      <label class="qs-row qs-toggle"><span class="qs-lbl">움직임 줄이기<small>화면 전환·떠오르는 효과를 꺼요</small></span><input type="checkbox" id="qsMotion" role="switch" ${P.motion === 'reduce' ? 'checked' : ''}><i aria-hidden="true"></i></label>
      <div class="qs-foot"><a href="#/read">크게 읽기 화면</a><a href="#/settings/display">화면 설정 더 보기</a><a href="#/settings">전체 설정</a></div>`;
  };
  const qsClose = () => { const p = $('#qsPop'), b = $('#setBtn'); if (!p || p.hidden) return; p.hidden = true; b && b.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', qsOutside, true); document.removeEventListener('keydown', qsKey); };
  const qsOutside = (e) => { if (!e.target.closest('.qs-wrap')) qsClose(); };
  const qsKey = (e) => { if (e.key === 'Escape') { qsClose(); $('#setBtn')?.focus(); } };
  YT.toggleQuickSet = () => {
    const p = $('#qsPop'), b = $('#setBtn'); if (!p) return;
    if (!p.hidden) return qsClose();
    p.innerHTML = qsHtml(); p.hidden = false; b.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', qsOutside, true); document.addEventListener('keydown', qsKey);
    p.onclick = (e) => { const t = e.target.closest('[data-qs]'); if (t) { YT.setPref(t.dataset.qs, t.dataset.v); p.innerHTML = qsHtml(); } if (e.target.closest('.qs-foot a')) qsClose(); };
    p.onchange = (e) => { if (e.target.id === 'qsMotion') { YT.setPref('motion', e.target.checked ? 'reduce' : 'auto'); } };
    p.querySelector('[aria-checked="true"]')?.focus();
  };
  addEventListener('hashchange', () => qsClose());

  YT.renderChrome = () => {
    const s = YT.state.settings; const u = YT.state.user;
    const today = YT.today(); const isHome = (location.hash || '#/').replace(/\?.*/, '') === '#/' || location.hash === '';
    const logo = s.logo ? `<img src="${YT.thumbUrl(s.logo)}" alt="" class="brand-logo">` : '';
    $('#siteHeader').className = 'site-header' + (isHome ? ' is-home' : '');
    $('#siteHeader').innerHTML = `
      ${isHome ? `<div class="masthead container">
        <div class="mast-ear left"><span>${YT.longDate(today)}</span><span>제${YT.issueNo(today.slice(0, 7))}호</span></div>
        <a href="#/" class="mast-brand">${logo}<span class="mast-name">${esc(s.site_name)}</span></a>
        <div class="mast-ear right"><span>${esc(s.tagline)}</span><span>창간 ${esc(s.founded)}</span></div>
      </div>` : ''}
      <div class="navbar"><div class="container navbar-in">
        <a href="#/" class="nav-brand" aria-label="1면으로">${logo || ``}<span>${esc(s.site_name)}</span></a>
        <ul class="nav-links">${YT.navGroups().map((g, gi) => (gi ? '<li class="nav-sep" aria-hidden="true"></li>' : '') + g.items.map(([h, l, match]) => `<li><a href="${h}" data-nav="${(match || [h]).join(' ')}">${l}${h === '#/newsroom' ? `<i class="nbadge" id="todoBadge" ${YT.state.todo ? '' : 'hidden'} title="지금 처리할 기사">${YT.state.todo || ''}</i>` : ''}</a></li>`).join('')).join('')}</ul>
        <div class="nav-tools">
          <button class="icon-btn" id="searchBtn" aria-label="검색 (Ctrl+K)" title="검색 (Ctrl+K)">${ICON.search}</button>
          ${u ? `<button class="icon-btn bell" id="bellBtn" aria-label="알림" title="알림">${ICON.bell}<i class="nbadge" id="bellBadge" ${YT.state.unread ? '' : 'hidden'}>${YT.state.unread || ''}</i></button>` : ''}
          <div class="qs-wrap"><button class="icon-btn" id="setBtn" aria-label="화면 설정" title="화면 설정" aria-haspopup="dialog" aria-expanded="false" data-nav="#/settings">${ICON.gear}</button><div class="qs-pop" id="qsPop" role="dialog" aria-label="화면 설정" hidden></div></div>
          ${YT.can('reporter') ? `<a href="#/write" class="btn small primary nav-write" title="새 기사 쓰기">기사 쓰기</a>` : ''}
          ${u ? `<details class="user-menu"><summary aria-label="내 계정" title="${esc(u.display_name)} · ${esc(u.role_label)}"><span class="um-name">${esc(u.display_name)}</span></summary><div class="um-pop">
              <div class="um-head"><b>${esc(u.display_name)}</b><span>${esc(u.role_label)}</span></div>
              ${YT.can('reporter') ? `<a href="#/newsroom">편집실${YT.state.todo ? ` <i class="nbadge-in">${YT.state.todo}</i>` : ''}</a><a href="#/write">새 기사 쓰기</a><hr>` : ''}<a href="#/settings/me">내 정보</a><a href="#/settings/display">화면 설정</a>${YT.can('admin') ? '<a href="#/settings/family">가족 계정</a><a href="#/settings/data">자료 관리</a>' : ''}<a href="#/guide">이용 안내</a><hr>
              <button id="logoutBtn">로그아웃</button></div></details>`
            : `<a href="#/login" class="btn small">로그인</a>`}
        </div>
      </div></div>`;
    // 휴대폰 아래 탭 (1면 · 기사 · 캘린더 · 가족 · 전체)
    let tb = $('#tabBar'); if (!tb) { tb = document.createElement('nav'); tb.id = 'tabBar'; tb.className = 'tab-bar'; tb.setAttribute('aria-label', '아래 메뉴'); document.body.appendChild(tb); }
    tb.innerHTML = [['#/', '1면', 'home', '#/'], ['#/articles', '기사', 'news', '#/articles #/article/ #/section/ #/recipes #/map #/print #/newsroom #/write #/reporters'], ['#/agenda', '일정', 'cal', '#/agenda #/calendar #/anniversaries #/timetable #/todo'], ['#/board', '가족', 'fam', '#/board #/people #/growth #/timeline #/post #/studio']]
      .map(([h, l, ic, m]) => `<a href="${h}" data-nav="${m}">${TAB_ICON[ic]}<span>${l}</span></a>`).join('')
      + `<button type="button" id="tabAll">${TAB_ICON.all}<span>전체</span>${YT.state.todo ? '<i class="tab-dot" aria-label="처리할 기사 있음"></i>' : ''}</button>`;
    $('#tabAll').onclick = () => YT.openMenu();
    $('#searchBtn').onclick = () => YT.openSearch();
    $('#setBtn').onclick = (e) => { e.stopPropagation(); YT.toggleQuickSet(); };
    const bb2 = $('#bellBtn'); if (bb2) bb2.onclick = () => YT.openNotices();
    const lo = $('#logoutBtn');
    if (lo) lo.onclick = () => YT.logout();
    $('#siteFooter').innerHTML = `<div class="container foot">
      <div class="foot-brand"><b>${esc(s.site_name)}</b><span>${esc(s.kicker)} · 창간 ${esc(s.founded)}</span></div>
      <nav class="foot-links" aria-label="아래 메뉴">${YT.can('reporter') ? '<a href="#/newsroom">편집실</a>' : ''}<a href="#/reporters">기자단</a><a href="#/settings">설정</a><a href="#/guide">이용 안내</a></nav></div>`;
    YT.applyPrefs();
    markNav();
    YT.fitNav();
  };
  // 메뉴가 한 줄에 다 들어가지 않으면(창 폭·큰 글씨) 아이콘과 겹치지 않게 메뉴를 아래 줄로 내린다
  YT.fitNav = () => {
    const nb = $('.navbar'), ul = $('.nav-links'); if (!nb || !ul) return;
    if (innerWidth <= 980) { nb.classList.remove('nav-wrap'); return; } // 태블릿·휴대폰은 원래 두 줄
    nb.classList.remove('nav-wrap');
    const tools = $('.nav-tools'); const last = ul.lastElementChild;
    const tight = ul.scrollWidth > ul.clientWidth + 1 || (last && tools && last.getBoundingClientRect().right > tools.getBoundingClientRect().left - 12);
    nb.classList.toggle('nav-wrap', !!tight);
  };
  addEventListener('resize', YT.debounce(() => YT.fitNav(), 80));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => YT.fitNav());

  // 편집실 버튼의 '처리할 기사' 숫자 — 기사 상태가 바뀔 때마다 새로 센다
  YT.refreshTodo = async () => {
    if (!YT.state.user) return;
    try { const r = await YT.api('/api/notices/count'); YT.state.todo = r.todo; YT.setUnread(r.unread); YT.browserNotify(r.latest); const b = $('#todoBadge'); if (b) { b.textContent = r.todo; b.hidden = !r.todo; } const td = $('#tabAll'); if (td && !!td.querySelector('.tab-dot') !== !!r.todo) YT.renderChrome(); } catch {}
  };
  // ── 알림
  YT.setUnread = (n) => { YT.state.unread = n; const b = $('#bellBadge'); if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; } };
  const NOTICE_ICON = { capsule: '', chore: '', event: '', deadline: '', coauthor: '', review: '', changes: '', approved: '', published: '', news: '', comment: '', poll: '', birthday: '', anniversary: '' };
  YT.openNotices = async () => {
    let list = [];
    try { list = (await YT.api('/api/notices')).notices; } catch (e) { return YT.err(e); }
    const today = YT.today();
    const day = (n) => (n.created.slice(0, 10) === today ? '오늘' : YT.relTime(n.created));
    const m = YT.modal(`<div class="nt-head"><h2 class="modal-title">알림</h2>${list.some((n) => !n.read) ? '<button class="btn tiny" id="ntAll">모두 읽음</button>' : ''}</div>
      ${list.length ? `<ul class="nt-list">${list.map((n) => `<li><a href="${esc(n.link || '#/')}" class="nt ${n.read ? '' : 'unread'}" data-nt="${n.id}">
        <span class="nt-ic" aria-hidden="true">${NOTICE_ICON[n.kind] || ''}</span><span class="nt-txt"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<i>${esc(day(n))}</i></span></a></li>`).join('')}</ul>`
        : '<div class="empty-state small">새 알림이 없어요.<br><span class="muted small">승인 요청, 댓글, 새 기사·투표, 내일 생일을 여기서 알려드려요.</span></div>'}
      <p class="muted small mt">휴대폰이나 컴퓨터 알림으로도 받으려면 <a href="#/settings/me">설정 → 내 정보 → 알림</a>에서 켜세요.</p>`, { wide: false });
    m.el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-nt]'); if (a) { YT.post('/api/notices/read', { ids: [a.dataset.nt] }).then(YT.refreshTodo).catch(() => {}); m.close(); return; }
      if (e.target.id === 'ntAll') { await YT.post('/api/notices/read', { all: true }); m.el.querySelectorAll('.nt.unread').forEach((x) => x.classList.remove('unread')); e.target.remove(); YT.setUnread(0); }
      if (e.target.closest('a[href^="#/settings"]')) m.close();
    });
  };
  // 사이트가 열려 있을 때 새 알림을 브라우저 알림으로 (설정에서 켠 경우)
  YT.browserNotify = (latest) => {
    try {
      if (!latest || store.get('yt_push', '0') !== '1' || !('Notification' in window) || Notification.permission !== 'granted') return;
      if (store.get('yt_last_notice', '') === latest.id) return; store.set('yt_last_notice', latest.id);
      if (Date.now() - new Date(latest.created).getTime() > 30 * 60e3) return;
      const n = new Notification(latest.title, { body: latest.body || '', tag: latest.id, icon: '/icon-192.png' });
      n.onclick = () => { window.focus(); if (latest.link) location.hash = latest.link.replace(/^#/, ''); n.close(); };
    } catch {}
  };
  setInterval(() => { if (YT.state.user) YT.refreshTodo(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && YT.state.user) YT.refreshTodo(); });
  YT.logout = async () => { await YT.post('/api/logout'); try { navigator.serviceWorker?.controller?.postMessage('logout'); } catch {} YT.state.user = null; YT.clearCache(); YT.renderChrome(); YT.toast('로그아웃했습니다.'); YT.route(); };

  // ── 통합 검색 (신규)
  YT.openSearch = async () => {
    const m = YT.modal(`<div class="search-box"><input class="input big" id="sq" type="search" placeholder="기사, 일정, 가족 이름, 카드 검색" aria-label="검색어" autocomplete="off">
      <div id="sres" class="search-res"><p class="muted">검색어를 입력하세요. 예: 생신, 서아, 가족식사</p></div></div>`, { wide: true });
    m.el.classList.add('search-modal');
    const q = m.el.querySelector('#sq'); q.focus();
    const y = new Date().getFullYear();
    const [articles, ev, people, cards] = await Promise.all([YT.getArticles(false, true), YT.getYearEvents(y), YT.api('/api/people').then((r) => r.people).catch(() => []), YT.api('/api/cards').then((r) => r.cards).catch(() => [])]);
    const draw = () => {
      const t = q.value.trim().toLowerCase(); const box = m.el.querySelector('#sres');
      if (!t) { box.innerHTML = '<p class="muted">검색어를 입력하세요. 예: 생신, 서아, 가족식사</p>'; return; }
      const hit = (x) => String(x || '').toLowerCase().includes(t);
      const A = articles.filter((a) => hit(a.title) || hit(a.hashtags) || (a.blocks || []).some((b) => hit(b.text) || hit(b.caption))).slice(0, 8);
      const seen = new Set(); const E = ev.occurrences.filter((o) => (hit(o.title) || hit(o.hashtags) || hit(o.location) || hit(o.notes)) && !seen.has(o.id) && seen.add(o.id)).slice(0, 8);
      const P = people.filter((p) => hit(p.name) || hit(p.relation)).slice(0, 8);
      const C = cards.filter((c) => hit(c.title) || hit(c.to_name) || hit(c.message)).slice(0, 5);
      const sec = (title, items) => items ? `<section><h3>${title}</h3>${items}</section>` : '';
      box.innerHTML = (A.length + E.length + P.length + C.length) ? [
        sec('기사', A.map((a) => `<a class="sr" href="#/article/${a.id}"><b>${esc(a.title)}</b><span>${esc(a.section)} · ${esc(YT.shortDate(a.published_at || a.updated))}</span></a>`).join('')),
        sec('가족', P.length ? `<div class="chips">${P.map((p) => `<a class="chip" href="#/people/${encodeURIComponent(p.name)}">${esc(p.name)}</a>`).join('')}</div>` : ''),
        sec('일정', E.map((o) => `<a class="sr" href="#/calendar?date=${o.date}"><b>${YT.eventIcon(o)} ${esc(o.title)}</b><span>${esc(o.date)}</span></a>`).join('')),
        sec('우체국', C.map((c) => `<a class="sr" href="#/post"><b>${esc(c.title)}</b><span>${esc(c.to_name)} 님께</span></a>`).join('')),
      ].join('') : `<p class="muted">‘${esc(q.value)}’와 일치하는 내용이 없어요.</p>`;
    };
    q.oninput = YT.debounce(draw, 120);
    m.el.addEventListener('click', (e) => { if (e.target.closest('a')) m.close(); });
  };
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); YT.openSearch(); } });

  // ── 공유
  YT.share = async (title, url = location.href) => {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); YT.toast('링크를 복사했어요. 가족 단톡방에 붙여 넣어 보세요.'); } catch { YT.toast('주소창의 링크를 직접 복사해주세요.'); }
  };

  function markNav() {
    const h = (location.hash || '#/').replace(/\?.*/, '') || '#/';
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav.split(' ').some((n) => (n === '#/' ? h === '#/' : h.startsWith(n)))));
  }

  // ── 라우터
  const ROUTES = [];
  YT.addRoute = (pattern, fn) => {
    const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/?]+)'; }) + '/?(?:\\?.*)?$');
    ROUTES.push({ re, keys, fn });
  };
  YT.go = (hash) => { if (location.hash === hash) YT.route(); else location.hash = hash; };
  YT.query = () => Object.fromEntries(new URLSearchParams((location.hash.split('?')[1] || '')));
  let leaveGuard = null;
  YT.setLeaveGuard = (fn) => { leaveGuard = fn; };
  let lastHash = location.hash;
  YT.route = async () => {
    const h = (location.hash || '#/').slice(1) || '/';
    if (leaveGuard && !leaveGuard()) { history.replaceState(null, '', lastHash || '#/'); return; }
    leaveGuard = null; lastHash = location.hash;
    window.onbeforeunload = null;
    markNav(); $('.user-menu')?.removeAttribute('open'); YT.refreshTodo();
    const act = $('.nav-links a.active'); const ul = $('.nav-links');
    if (act && ul && ul.scrollWidth > ul.clientWidth) ul.scrollTo({ left: act.offsetLeft - (ul.clientWidth - act.offsetWidth) / 2 });
    const view = $('#view'); view.className = 'container';
    // 가족만 보기: 로그인하지 않은 사람에게는 로그인 안내만
    if (YT.state.settings.members_only === '1' && !YT.state.user && !/^\/(login|setup|guide)\b/.test(h)) {
      view.innerHTML = `<div class="empty-state members-only"><h2>가족만 보는 신문이에요</h2><p>${esc(YT.state.settings.site_name || '')}는 가족 계정으로 로그인해야 읽을 수 있어요.<br>계정이 없다면 신문을 만드는 가족에게 부탁해 주세요.</p><a class="btn primary" href="#/login?next=${encodeURIComponent(location.hash || '#/')}">로그인</a></div>`;
      return;
    }
    for (const r of ROUTES) {
      const m = r.re.exec(h);
      if (m) {
        const params = {}; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        view.innerHTML = '<div class="loading">불러오는 중입니다…</div>';
        try { await r.fn(view, params, YT.query()); YT.hoistSubBar(view); } catch (e) { console.error(e); view.innerHTML = `<div class="empty-state"><h2>문제가 생겼어요</h2><p>${esc(e.message)}</p><a class="btn" href="#/">1면으로</a></div>`; }
        if (!h.includes('?keep')) window.scrollTo({ top: 0 });
        return;
      }
    }
    view.innerHTML = '<div class="empty-state"><h2>페이지를 찾을 수 없어요</h2><a class="btn" href="#/">1면으로</a></div>';
  };
  YT.needLogin = (view, msg = '로그인이 필요한 화면입니다.') => {
    view.innerHTML = `<div class="empty-state"><h2>${esc(msg)}</h2><p>가족 계정으로 로그인해주세요.</p><a class="btn primary" href="#/login?next=${encodeURIComponent(location.hash)}">로그인</a></div>`;
  };

  // 같은 메뉴의 가로 줄 메뉴는 늘 화면 맨 위(메뉴 바로 아래)에 둔다 — 보장설계 도우미와 같은 자리
  YT.hoistSubBar = (view) => {
    const sb = view.querySelector(':scope .sub-bar'); if (!sb) return;
    if (view.firstElementChild !== sb) view.prepend(sb);
    // 옆으로 더 밀 수 있으면 그쪽 끝을 흐리게 — 메뉴가 더 있다는 표시
    const inn = sb.querySelector('.sub-bar-in'); if (!inn) return;
    const on = inn.querySelector('a.on'); if (on && inn.scrollWidth > inn.clientWidth) inn.scrollLeft = on.offsetLeft - (inn.clientWidth - on.offsetWidth) / 2;
    const mark = () => { sb.classList.toggle('more-l', inn.scrollLeft > 4); sb.classList.toggle('more-r', inn.scrollLeft + inn.clientWidth < inn.scrollWidth - 4); };
    inn.onscroll = mark; mark();
  };
  addEventListener('resize', YT.debounce(() => { const v = document.getElementById('view'); if (v) YT.hoistSubBar(v); }, 150));
  // 필요할 때만 불러오는 스크립트 (QR 코드 등)
  const scriptP = {};
  YT.loadScript = (src, test) => scriptP[src] || (scriptP[src] = new Promise((res, rej) => {
    if (test && test()) return res();
    const js = document.createElement('script'); js.src = src; js.onload = () => res(); js.onerror = () => { delete scriptP[src]; rej(new Error('필요한 파일을 불러오지 못했어요.')); };
    document.head.appendChild(js);
  }));
  // 주소를 QR 코드(SVG)로 — 인쇄 지면에서 휴대폰으로 찍어 바로 듣기
  YT.qrSvg = async (text, size = 84) => {
    await YT.loadScript('vendor/qrcode/qrcode.js', () => typeof window.qrcode === 'function');
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" width="${size}" height="${size}" role="img" aria-label="QR 코드"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  };
  // 파일 내려받기 (미리보기에서는 미리보기 엔진이 바꿔 끼움)
  YT.saveFile = async (filename, data, type = 'application/json') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  };
  YT.audioUrl = (id) => `/api/audio/${encodeURIComponent(id)}`;
  YT.mmss = (sec) => { sec = Math.round(Number(sec) || 0); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  // 목소리 녹음 · 소리 파일 고르기 → 서버에 올리고 onDone(id, 길이)
  YT.recordAudio = (onDone) => {
    const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    const m = YT.modal(`<h2 class="modal-title">목소리·소리 넣기</h2>
      <div class="rec">
        ${canRec ? `<div class="rec-box"><button type="button" class="btn primary" id="recGo">녹음 시작</button><span class="rec-time" id="recTime" aria-live="polite">0:00</span><span class="muted small">최대 10분</span></div>` : '<p class="muted small">이 브라우저에서는 바로 녹음할 수 없어요. 휴대폰 녹음 앱으로 녹음한 파일을 골라 주세요.</p>'}
        <div class="rec-or"><span>또는</span></div>
        <label class="btn">녹음 파일 고르기<input type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" id="recFile" hidden></label>
        <div id="recPrev" class="rec-prev" hidden><audio controls id="recAudio"></audio></div>
        <p class="muted small">할머니의 덕담, 아이의 노래, 여행지의 바닷소리… 기사에서 바로 들을 수 있고, 인쇄한 지면에는 QR 코드로 실려요.</p>
      </div>
      <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button type="button" class="btn primary" id="recUse" disabled>기사에 넣기</button></div>`,
      { onClose: () => { try { if (rec && rec.state === 'recording') { rec.onstop = null; rec.stop(); } } catch {} stopAll(); } });
    let blob = null, dur = 0, rec = null, stream = null, timer = null, t0 = 0;
    const el = (s) => m.el.querySelector(s);
    const stopAll = () => { clearInterval(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    const show = (b, d) => { blob = b; dur = d; el('#recPrev').hidden = false; el('#recAudio').src = URL.createObjectURL(b); el('#recUse').disabled = false; };
    const go = el('#recGo');
    if (go) go.onclick = async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return YT.toast('마이크를 쓸 수 없어요. 브라우저에서 마이크를 허용해 주세요.', 'error'); }
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      const parts = []; rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = () => { stopAll(); go.textContent = '다시 녹음'; go.classList.add('primary'); show(new Blob(parts, { type: (rec.mimeType || type || 'audio/webm').split(';')[0] }), (Date.now() - t0) / 1000); };
      rec.start(); t0 = Date.now(); go.textContent = '녹음 멈추기'; go.classList.remove('primary'); el('#recPrev').hidden = true; el('#recUse').disabled = true;
      timer = setInterval(() => { const s = (Date.now() - t0) / 1000; el('#recTime').textContent = YT.mmss(s); if (s >= 600) rec.stop(); }, 250);
    };
    el('#recFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      { const mb = YT.state.settings && YT.state.settings.cloud ? 3 : 25; if (f.size > mb * 1024 * 1024) return YT.toast(`소리 파일은 ${mb}MB 이하로 골라 주세요.`, 'error'); }
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const type = f.type && f.type.startsWith('audio/') ? f.type : ({ m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', aac: 'audio/aac' }[ext] || '');
      if (!type) return YT.toast('m4a·mp3·wav·ogg·webm 소리 파일을 골라 주세요.', 'error');
      const b = f.type === type ? f : new Blob([f], { type });
      const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => show(b, isFinite(a.duration) ? a.duration : 0); a.onerror = () => show(b, 0); a.src = URL.createObjectURL(b);
    };
    el('#recUse').onclick = async () => {
      if (!blob) return; const btn = el('#recUse'); btn.disabled = true; btn.textContent = '올리는 중…';
      try {
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
        const { id } = await YT.post('/api/audio', { data, duration: Math.round(dur) });
        m.close(); onDone(id, Math.round(dur));
      } catch (err) { YT.err(err); btn.disabled = false; btn.textContent = '기사에 넣기'; }
    };
  };
  YT.pageHead = (kicker, title, desc, actions = '') => `
    <div class="page-head"><div>${kicker && !/^[A-Z\s’'·.-]+$/.test(kicker) ? `<div class="sec-kicker">${kicker}</div>` : ''}<h1 class="page-title">${title}</h1>${desc ? `<p class="page-desc">${desc}</p>` : ''}</div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;

  // ── 앱처럼 쓰기: 서비스 워커 등록 · 설치 버튼 · 인터넷 끊김 안내
  YT.pwa = { prompt: null };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); YT.pwa.prompt = e; document.documentElement.classList.add('can-install'); });
  addEventListener('appinstalled', () => { YT.pwa.prompt = null; document.documentElement.classList.remove('can-install'); YT.toast('앱으로 설치했어요. 홈 화면에서 열어 보세요.'); });
  YT.isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  YT.installApp = async () => { const p = YT.pwa.prompt; if (!p) return false; p.prompt(); const r = await p.userChoice.catch(() => null); YT.pwa.prompt = null; document.documentElement.classList.remove('can-install'); return r && r.outcome === 'accepted'; };
  addEventListener('load', () => {
    if (window.YTPreview || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return; // 서비스 워커는 HTTPS(또는 이 컴퓨터)에서만
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  addEventListener('offline', () => YT.toast('인터넷이 끊겼어요. 마지막으로 본 신문을 보여드려요.', 'error'));
  addEventListener('online', () => YT.toast('다시 연결됐어요.'));
  YT.start = async () => {
    try {
      const me = await YT.api('/api/me');
      Object.assign(YT.state, { user: me.user, todo: me.todo || 0, settings: me.settings, sections: me.sections, categories: me.categories, emojis: me.emojis, needsSetup: me.needsSetup });
    } catch (e) { YT.state.settings = { site_name: '유니 타임즈' }; }
    document.title = `${YT.state.settings.site_name} — 함께 쓰는 가족의 이야기`;
    YT.renderChrome();
    // 다음 방문 때 '새 글' 표시 기준
    window.addEventListener('pagehide', () => store.set('yt_last_visit', new Date().toISOString()));
    if (!YT.lastVisit) store.set('yt_last_visit', new Date().toISOString());
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', YT.applyPrefs);
    window.addEventListener('hashchange', () => { const home = ['', '#/'].includes(location.hash.replace(/\?.*/, '')); if (home !== $('#siteHeader').classList.contains('is-home')) YT.renderChrome(); });
    window.addEventListener('hashchange', YT.route);
    if (YT.state.needsSetup && !location.hash.startsWith('#/setup')) location.hash = '#/setup';
    YT.route();
  };
})();
