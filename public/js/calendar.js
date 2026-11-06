/* 캘린더 */
(function () {
  'use strict';
  const { esc } = YT;

  // 고칠 수 있는지: 서버가 알려준 값을 쓰고, 없으면(예전 서버) 같은 규칙으로 판단
  const canEditEv = (o) => (typeof o.can_edit === 'boolean' ? o.can_edit : YT.can('editor') || (YT.can('staff') && (o.is_own || o.kind !== 'event' || !o.author_id)));
  YT.canEditEvent = canEditEv;
  const RELS = ['친구', '동료', '선생님', '이웃', '지인', '선배', '후배'];
  // "황윤수 생일 (김신중의 친구)" · "최서우 생일(서아친구)" → { name, of, rel }
  const parseFriend = (title) => {
    const t = String(title || '');
    let m = /^(.+?)\s*생일\s*\(\s*(.+?)\s*의?\s*(친구|동료|선생님|이웃|지인|선배|후배)\s*\)$/.exec(t);
    if (m) return { name: m[1].trim(), of: m[2].replace(/의$/, '').trim(), rel: m[3] };
    m = /^(.+?)의\s*(친구|동료|선생님|이웃|지인|선배|후배)\s+(.+?)(?:의)?\s*생일$/.exec(t);
    if (m) return { name: m[3].trim(), of: m[1].trim(), rel: m[2] };
    return null;
  };
  YT.parseFriendBirthday = parseFriend;

  // ───────── 새 일정 입력 (빠른 입력 한 줄 + 종류별 맞춤 칸)
  const KINDS = [['event', '', '일정', '약속·모임·병원'], ['birthday', '', '생일', '매년 · 양력/음력'], ['anniversary', '', '기념일', '매년 · 주년 표시']];
  const TITLES = { event: ['가족 식사', '외식', '병원', '학교 행사', '여행', '학원', '모임'], anniversary: ['결혼기념일', '처음 만난 날', '입학', '졸업', '이사한 날'] };
  const DOW = '일월화수목금토';
  const nextDow = (from, dow, weekOffset = 0) => { const cur = new Date(from + 'T00:00:00Z').getUTCDay(); let add = (dow - cur + 7) % 7; if (weekOffset) { const monday = YT.addDays(from, -((cur + 6) % 7)); return YT.addDays(monday, 7 * weekOffset + ((dow + 6) % 7)); } return YT.addDays(from, add); };
  const hhmm = (h, m = 0) => `${YT.pad(h)}:${YT.pad(m)}`;
  const timeLabel = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`; };
  const dateLabel = (d) => `${+d.slice(5, 7)}월 ${+d.slice(8)}일 (${YT.weekday(d)})`;

  // "토요일 오후 6시 가족 외식 @소담촌" → { date, time, end_time, end_date, title, location }
  YT.parseQuickEvent = (text, today = YT.today()) => {
    let s = ' ' + String(text || '') + ' '; const out = {};
    const take = (re, fn) => { const m = re.exec(s); if (m) { fn(m); s = s.replace(m[0], ' '); } return !!m; };
    take(/@([^#@]+?)\s*(?=#|$)/, (m) => { out.location = m[1].trim(); });
    s = s.replace(/#/g, ' ');
    const y = +today.slice(0, 4);
    const md = (mo, d) => { let v = YT.ymd(y, mo, d); if (v < today && !/\d{4}/.test(text)) v = YT.ymd(y + 1, mo, d); return v; };
    // 날짜
    take(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/, (m) => { out.date = YT.ymd(+m[1], +m[2], +m[3]); }) ||
    take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?(?:\s*[~\-]\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일)?/, (m) => { out.date = md(+m[1], +m[2]); if (m[4]) out.end_date = md(+(m[3] || m[1]), +m[4]); }) ||
    take(/(?<![\d:])(\d{1,2})\/(\d{1,2})(?![\d:])/, (m) => { out.date = md(+m[1], +m[2]); }) ||
    take(/오늘/, () => { out.date = today; }) || take(/내일/, () => { out.date = YT.addDays(today, 1); }) || take(/모레/, () => { out.date = YT.addDays(today, 2); }) || take(/글피/, () => { out.date = YT.addDays(today, 3); }) ||
    take(/(이번|다음|다다음)\s*주\s*말/, (m) => { out.date = nextDow(today, 6, { 이번: 0, 다음: 1, 다다음: 2 }[m[1]]); if (m[1] === '이번' && out.date < today) out.date = today; }) ||
    take(/(이번|다음|다다음)\s*주\s*([월화수목금토일])(?:요일)?/, (m) => { out.date = nextDow(today, DOW.indexOf(m[2]), { 이번: 0, 다음: 1, 다다음: 2 }[m[1]]); }) ||
    take(/주말/, () => { out.date = nextDow(today, 6); }) ||
    take(/([월화수목금토일])요일/, (m) => { out.date = nextDow(today, DOW.indexOf(m[1])); }) ||
    take(/(?<!\d)(\d{1,2})\s*일(?!\s*[~\-])/, (m) => { let v = YT.ymd(y, +today.slice(5, 7), +m[1]); if (v < today) { const n = new Date(today + 'T00:00:00Z'); n.setUTCMonth(n.getUTCMonth() + 1); v = YT.ymd(n.getUTCFullYear(), n.getUTCMonth() + 1, +m[1]); } out.date = v; });
    // 시간 (끝 시간까지)
    const T = /(오전|오후|아침|낮|저녁|밤|새벽)?\s*(\d{1,2})(?:\s*시\s*(?:(\d{1,2})\s*분|(반))?|:(\d{2}))/;
    const toTime = (m, ref) => { let h = +m[2]; const mi = m[5] ? +m[5] : m[4] ? 30 : m[3] ? +m[3] : 0; const ap = m[1];
      if ((ap === '오후' || ap === '저녁' || ap === '밤') && h < 12) h += 12; else if (ap === '낮' && h < 7) h += 12; else if (ap === '오전' || ap === '아침' || ap === '새벽') { if (h === 12) h = 0; }
      else if (!ap && !m[5] && h >= 1 && h <= 7) h += 12; // "6시" → 오후 6시로 짐작
      if (ref && h * 60 + mi <= +ref.slice(0, 2) * 60 + +ref.slice(3)) h += 12;
      return h < 24 && mi < 60 ? hhmm(h, mi) : ''; };
    const ms = [...s.matchAll(new RegExp(T.source, 'g'))];
    if (ms.length) {
      out.time = toTime(ms[0]);
      const gap = ms[1] ? s.slice(ms[0].index + ms[0][0].length, ms[1].index) : '';
      if (ms[1] && /^\s*(~|-|–|부터|에서)\s*$/.test(gap)) {
        const b2 = [...ms[1]]; if (!b2[1] && ms[0][1]) b2[1] = ms[0][1];
        out.end_time = toTime(b2, out.time);
        s = s.slice(0, ms[0].index) + ' ' + s.slice(ms[1].index + ms[1][0].length);
      } else s = s.replace(ms[0][0], ' ');
      s = s.replace(/까지/, ' ');
    }
    if (/종일|하루\s*종일/.test(s)) { out.time = ''; s = s.replace(/하루\s*종일|종일/, ' '); }
    const title = s.replace(/\s+(에|에서|부터|까지)\s+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(에|에서)\s+/, '');
    if (title) out.title = title;
    return out;
  };

  function eventForm(ev, mode, ctx) {
    const k = ev?.kind || 'event';
    const today = YT.today();
    const editing = ev?.id && mode !== 'dup';
    const d = ev?.date || today;
    const people = ctx.people.filter((p) => !p.is_group).slice(0, 14);
    return `<h2 class="modal-title">${mode === 'dup' ? '일정 복제' : editing ? '일정 고치기' : '새 일정'}</h2>
      <form id="evForm" class="form evf" autocomplete="off">
        <div class="evf-kinds" role="radiogroup" aria-label="일정 종류">${KINDS.map(([v, ic, l, sub]) => `<label class="${k === v ? 'on' : ''}"><input type="radio" name="kind" value="${v}" ${k === v ? 'checked' : ''}><span class="ic">${ic}</span><b>${l}</b><small>${sub}</small></label>`).join('')}</div>

        ${editing ? '' : `<div class="evf-quick" data-for="event anniversary">
          <label class="vh" for="evQuick">빠르게 입력</label>
          <input class="input" id="evQuick" placeholder="한 줄로 쓰고 Enter — 예) 토요일 오후 6시 가족 외식 @소담촌">
          <div class="evf-parsed" id="evParsed"><span class="muted small">날짜(내일·토요일·11월 20일), 시간(오후 6시·18:30~20:00), 장소(@)를 알아서 나눠 넣어요.</span></div>
        </div>`}

        <div data-for="birthday" class="evf-bdwho">
          <div class="evf-who" role="radiogroup" aria-label="누구의 생일"><label><input type="radio" name="bd_who" value="family" ${ctx.friend ? '' : 'checked'}> 가족 생일</label><label><input type="radio" name="bd_who" value="friend" ${ctx.friend ? 'checked' : ''}> 가족의 친구·지인 생일</label></div>
          <div class="evf-people" data-who="family">${people.length ? `<span class="evf-lbl">누구 생일인가요?</span><div class="chips">${people.map((p) => `<button type="button" class="chip" data-person="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div>` : ''}</div>
          <div class="evf-friend" data-who="friend">
            <div class="evf-row">
              <label class="grow">누구의<input class="input" name="friend_of" list="famList" value="${esc(ctx.friend?.of || '')}" placeholder="김신중"></label>
              <label>관계<select class="select" name="friend_rel">${RELS.map((r) => `<option ${(ctx.friend?.rel || '친구') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
              <label class="grow">생일인 사람<input class="input" name="friend_name" value="${esc(ctx.friend?.name || '')}" placeholder="황윤수"></label>
            </div>
            <datalist id="famList">${ctx.people.filter((p) => !p.is_group).map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>
            ${people.length ? `<div class="chips"><span class="muted small">누구의 →</span>${people.slice(0, 10).map((p) => `<button type="button" class="chip" data-of="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div>` : ''}
            <p class="muted small" id="friendHint">저장하면 ‘황윤수 생일 (김신중의 친구)’로 달력에 표시되고, 인물 사전에 ‘김신중의 친구’로 연결돼요.</p>
          </div>
        </div>

        <label class="block"><span id="lblTitle">제목</span><input class="input big" name="title" maxlength="80" required value="${esc(mode === 'dup' ? (ev.title + ' (복사)') : ev?.title || '')}" placeholder="가족 저녁 모임"></label>
        <div class="chips evf-sugg" id="titleSugg"></div>

        <div data-for="event anniversary" class="evf-when">
          <div class="evf-row"><label class="grow"><span id="lblDate">날짜</span><input type="date" class="input" name="date" value="${esc(d)}"></label>
            <label data-for="event" class="grow" id="endWrap" ${ev?.end_date ? '' : 'hidden'}>끝나는 날<input type="date" class="input" name="end_date" value="${esc(ev?.end_date || '')}"></label></div>
          <div class="chips evf-q" data-for="event" id="dateChips">
            ${[['오늘', today], ['내일', YT.addDays(today, 1)], ['이번 토요일', nextDow(today, 6)], ['이번 일요일', nextDow(today, 0)], ['다음 주 월요일', nextDow(today, 1, 1)]].map(([l, v]) => `<button type="button" class="chip" data-date="${v}">${l}</button>`).join('')}
            <button type="button" class="chip ${ev?.end_date ? 'on' : ''}" id="multiDay">여러 날</button></div>
          <p class="muted small" data-for="anniversary" id="annHint">처음 기념한 날짜(시작 연도 포함)를 넣으면 매년 같은 날 주년과 함께 표시돼요.</p>
          <div class="evf-row">
            <label class="grow">시작 시간<input type="time" class="input" name="time" value="${esc(ev?.time || '')}"></label>
            <label class="grow" data-for="event">끝 시간<input type="time" class="input" name="end_time" value="${esc(ev?.end_time || '')}"></label></div>
          <div class="chips evf-q" id="timeChips"><button type="button" class="chip" data-time="">종일</button>${['10:00', '12:00', '15:00', '18:00', '19:00'].map((t) => `<button type="button" class="chip" data-time="${t}">${timeLabel(t)}</button>`).join('')}
            <span data-for="event" class="evf-dur"><button type="button" class="chip" data-dur="60">+1시간</button><button type="button" class="chip" data-dur="120">+2시간</button></span></div>
          <div class="evf-row evf-rep" data-for="event">
            <label class="grow">반복<select class="select" name="repeat" id="repSel"></select></label>
            <label class="grow" id="repUntilWrap" ${ev?.repeat ? '' : 'hidden'}>반복 끝 (비우면 계속)<input type="date" class="input" name="repeat_until" value="${esc(ev?.repeat_until || '')}"></label>
          </div>
          <label class="check small evf-remind" data-for="event"><input type="checkbox" name="remind" id="evRemind" ${(ev?.remind ?? (ev?.repeat ? 0 : 1)) ? 'checked' : ''}> 하루 전에 가족에게 알림</label>
        </div>

        <div data-for="birthday" class="evf-bd">
          <div class="seg evf-cal" role="radiogroup"><label><input type="radio" name="calendar" value="solar" ${ev?.calendar !== 'lunar' ? 'checked' : ''}> 양력</label><label><input type="radio" name="calendar" value="lunar" ${ev?.calendar === 'lunar' ? 'checked' : ''}> 음력</label></div>
          <div class="evf-row">
            <label><span>태어난 해 <small class="muted">(선택)</small></span><input type="number" class="input" name="birth_year" min="1900" max="2100" value="${ev?.birth_year || ''}" placeholder="1980"></label>
            <label>월<select class="select" name="birth_month">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${(ev?.birth_month || +d.slice(5, 7)) === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select></label>
            <label>일<select class="select" name="birth_day">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${(ev?.birth_day || +d.slice(8)) === i + 1 ? 'selected' : ''}>${i + 1}일</option>`).join('')}</select></label>
            <label data-lunar>평달/윤달<select class="select" name="is_leap"><option value="0">평달</option><option value="1" ${ev?.is_leap ? 'selected' : ''}>윤달</option></select></label>
          </div>
          <p class="lunar-preview" id="lunarPrev"></p>
        </div>

        <details class="evf-more" ${ev?.location || ev?.notes ? 'open' : ''}><summary>장소 · 메모</summary>
          <label class="block" data-for="event anniversary">장소<input class="input" name="location" maxlength="120" list="locList" value="${esc(ev?.location || '')}" placeholder="함께할 장소"></label>
          <datalist id="locList">${ctx.locations.map((l) => `<option value="${esc(l)}">`).join('')}</datalist>
          <label class="block">메모<textarea class="input" name="notes" rows="2" maxlength="1000" placeholder="준비할 것, 함께할 사람 등">${esc(ev?.notes || '')}</textarea></label>
          <input type="hidden" name="hashtags" value="${esc(ev?.hashtags || '')}">
        </details>

        <div class="evf-sum" id="evSum" aria-live="polite"></div>
        <div class="row gap end evf-acts">${editing ? '' : '<label class="check small evf-again"><input type="checkbox" id="evAgain"> 저장 후 하나 더 입력</label>'}<button type="button" class="btn" data-close>취소</button><button class="btn primary">${mode === 'dup' ? '복제 저장' : editing ? '고친 내용 저장' : '저장'}</button></div>
      </form>`;
  }

  YT.openEventForm = async (ev, mode, onSaved) => {
    const today = YT.today();
    const [pr, er] = await Promise.all([YT.api('/api/people').catch(() => ({ people: [] })), YT.getYearEvents(+today.slice(0, 4)).catch(() => ({ events: [] }))]);
    const locations = [...new Set(er.events.map((e) => e.location).filter(Boolean))].slice(0, 30);
    const ctx0 = { people: pr.people || [], locations, friend: ev?.kind === 'birthday' ? parseFriend(ev.title) : null };
    const m = YT.modal(eventForm(ev, mode, ctx0));
    const f = m.el.querySelector('#evForm');
    const editing = ev?.id && mode !== 'dup';
    let titleTouched = !!(ev && ev.title);
    const tagsOf = () => YT.tags(f.hashtags.value);
    const setTags = (list) => { f.hashtags.value = list.map((t) => '#' + t).join(' '); paintTags(); };
    const paintTags = () => { const t = tagsOf(); m.el.querySelectorAll('[data-tag]').forEach((b) => b.classList.toggle('on', t.includes(b.dataset.tag))); m.el.querySelectorAll('[data-person]').forEach((b) => b.classList.toggle('on', t.includes(b.dataset.person) && f.kind.value === 'birthday')); };
    const sum = () => {
      const k = f.kind.value; const el = m.el.querySelector('#evSum'); const t = f.title.value.trim() || '(제목)';
      if (k === 'birthday') el.innerHTML = `${f.bd_who.value === 'friend' ? '' : ''} <b>${esc(t)}</b> · 매년 ${f.calendar.value === 'lunar' ? '음력' : '양력'} ${f.birth_month.value}월 ${f.birth_day.value}일${f.birth_year.value ? ` · ${new Date().getFullYear() - +f.birth_year.value + 1}세(한국식)` : ''}`;
      else if (k === 'anniversary') el.innerHTML = f.date.value ? `<b>${esc(t)}</b> · 매년 ${+f.date.value.slice(5, 7)}월 ${+f.date.value.slice(8)}일 · 올해 ${Math.max(0, new Date().getFullYear() - +f.date.value.slice(0, 4))}주년` : '';
      else el.innerHTML = f.date.value ? `${repVal ? '' : ''} <b>${esc(t)}</b> · ${repVal ? esc((repOpts().find((o) => o[0] === repVal) || [])[1] || '') + ' · 처음 ' : ''}${dateLabel(f.date.value)}${f.end_date.value && f.end_date.value > f.date.value ? ` ~ ${dateLabel(f.end_date.value)}` : ''} · ${f.time.value ? timeLabel(f.time.value) + (f.end_time.value ? ` ~ ${timeLabel(f.end_time.value)}` : '') : '종일'}${f.location.value ? ` · ${esc(f.location.value)}` : ''}` : '';
    };
    // 반복 — 고른 날짜에 맞춰 '매주 화요일', '매월 첫째 일요일'처럼 보여 준다
    let repVal = ev?.repeat || '';
    const repOpts = () => {
      const dt = f.date.value || today; const dw = DOW[new Date(dt + 'T00:00:00Z').getUTCDay()]; const dd = +dt.slice(8); const nth = Math.ceil(dd / 7);
      return [['', '반복 안 함'], ['weekly', `매주 ${dw}요일`], ['biweekly', `격주 ${dw}요일`], ['monthly', `매월 ${dd}일`],
        ['monthly_nth', `매월 ${nth >= 5 ? '마지막' : ['첫째', '둘째', '셋째', '넷째'][nth - 1]} ${dw}요일`], ['yearly', `매년 ${+dt.slice(5, 7)}월 ${dd}일`]];
    };
    const paintRep = () => { const sel = m.el.querySelector('#repSel'); if (!sel) return; sel.innerHTML = repOpts().map(([v, l]) => `<option value="${v}" ${v === repVal ? 'selected' : ''}>${l}</option>`).join(''); m.el.querySelector('#repUntilWrap').hidden = !repVal; };
    const sync = () => {
      paintRep();
      const k = f.kind.value;
      m.el.querySelectorAll('.evf-kinds label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      m.el.querySelectorAll('[data-for]').forEach((el) => (el.hidden = !el.dataset.for.split(' ').includes(k)));
      m.el.querySelector('#endWrap').hidden = k !== 'event' || !m.el.querySelector('#multiDay').classList.contains('on');
      m.el.querySelector('[data-lunar]').hidden = f.calendar.value !== 'lunar';
      const who = f.bd_who.value; m.el.querySelectorAll('[data-who]').forEach((el) => (el.hidden = k !== 'birthday' || el.dataset.who !== who));
      m.el.querySelectorAll('[data-of]').forEach((b) => b.classList.toggle('on', b.dataset.of === f.friend_of.value.trim()));
      m.el.querySelector('#lblTitle').textContent = k === 'birthday' ? '제목 (누구 생일)' : k === 'anniversary' ? '기념일 이름' : '무엇을 하나요?';
      f.title.placeholder = k === 'birthday' ? '예) 이수민 엄마 생일' : k === 'anniversary' ? '예) 결혼기념일' : '예) 가족 저녁 모임';
      m.el.querySelector('#lblDate').textContent = k === 'anniversary' ? '처음 기념한 날' : '날짜';
      m.el.querySelector('#titleSugg').innerHTML = (TITLES[k] || []).map((t) => `<button type="button" class="chip" data-title="${t}">${t}</button>`).join('');
      m.el.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === f.time.value));
      m.el.querySelectorAll('[data-date]').forEach((b) => b.classList.toggle('on', b.dataset.date === f.date.value));
      if (k === 'birthday') lunarPreview();
      paintTags(); sum();
    };
    const lunarPreview = YT.debounce(async () => {
      const el = m.el.querySelector('#lunarPrev');
      if (f.calendar.value !== 'lunar') { el.textContent = ''; return; }
      try {
        const r = await YT.api(`/api/lunar?y=${new Date().getFullYear()}&m=${f.birth_month.value}&d=${f.birth_day.value}&leap=${f.is_leap.value}`);
        el.textContent = r.solar ? `올해 양력으로는 ${dateLabel(r.solar.date)}${r.solar.adjusted ? ' · 대체일' : ''}이에요.` : '';
      } catch { el.textContent = ''; }
    }, 200);

    // 빠른 입력
    const quick = m.el.querySelector('#evQuick');
    const applyQuick = (commit) => {
      const p = YT.parseQuickEvent(quick.value, today); const out = m.el.querySelector('#evParsed');
      const bits = [];
      if (p.date) bits.push(`${dateLabel(p.date)}${p.end_date ? ' ~ ' + dateLabel(p.end_date) : ''}`);
      if (p.time) bits.push(`${timeLabel(p.time)}${p.end_time ? ' ~ ' + timeLabel(p.end_time) : ''}`);
      if (p.location) bits.push(`${esc(p.location)}`);
      if (p.title) bits.push(`${esc(p.title)}`);
      out.innerHTML = quick.value.trim() ? (bits.length ? bits.map((b) => `<span class="pchip">${b}</span>`).join('') + (commit ? '' : '<span class="muted small">Enter로 채우기</span>') : '<span class="muted small">알아본 내용이 없어요. 아래 칸에 직접 넣어도 돼요.</span>') : '';
      if (!commit) return;
      if (p.title) { f.title.value = p.title; titleTouched = true; }
      if (p.date) f.date.value = p.date;
      if (p.end_date) { f.end_date.value = p.end_date; m.el.querySelector('#multiDay').classList.add('on'); }
      if (p.time !== undefined) f.time.value = p.time || '';
      if (p.end_time) f.end_time.value = p.end_time;
      if (p.location) { f.location.value = p.location; m.el.querySelector('.evf-more').open = true; }
      sync();
    };
    if (quick) {
      quick.oninput = YT.debounce(() => applyQuick(false), 120);
      quick.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); applyQuick(true); YT.toast('채워 넣었어요. 확인하고 저장하세요.'); f.querySelector('button.primary').focus(); } };
    }

    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !f.contains(b)) return; const ds = b.dataset;
      if (ds.date) f.date.value = ds.date;
      else if (ds.time !== undefined) { f.time.value = ds.time; if (!ds.time) f.end_time.value = ''; }
      else if (ds.dur) { const st = f.time.value || '18:00'; f.time.value = st; const mins = +st.slice(0, 2) * 60 + +st.slice(3) + +ds.dur; f.end_time.value = hhmm(Math.min(23, Math.floor(mins / 60)), mins >= 1440 ? 59 : mins % 60); }
      else if (b.id === 'multiDay') { b.classList.toggle('on'); if (!b.classList.contains('on')) f.end_date.value = ''; else if (!f.end_date.value) f.end_date.value = YT.addDays(f.date.value || today, 1); }
      else if (ds.title) { f.title.value = ds.title; titleTouched = true; }
      else if (ds.person) { const n = ds.person; if (!titleTouched || /생일$/.test(f.title.value)) { f.title.value = `${n} 생일`; } setTags([...new Set([...tagsOf(), n])]); }
      else if (ds.of) { f.friend_of.value = ds.of; friendTitle(); }
      else return;
      sync();
    });
    const friendTitle = () => {
      if (f.kind.value !== 'birthday' || f.bd_who.value !== 'friend') return;
      const n = f.friend_name.value.trim().replace(/^#/, ''), of = f.friend_of.value.trim().replace(/^#/, ''), rel = f.friend_rel.value;
      if (n) f.title.value = of ? `${n} 생일 (${of}의 ${rel})` : `${n} 생일`;
      setTags([...new Set([...tagsOf().filter((t) => t !== prevFriend.n && t !== prevFriend.of), n, of].filter(Boolean))]);
      prevFriend = { n, of };
      m.el.querySelector('#friendHint').textContent = n && of ? `‘${n} 생일 (${of}의 ${rel})’로 표시되고, 인물 사전에 ‘${of}의 ${rel}’로 연결돼요.` : '생일인 사람과 누구의 친구인지 적어주세요.';
      sum();
    };
    let prevFriend = { n: ctx0.friend?.name || '', of: ctx0.friend?.of || '' };
    ['friend_name', 'friend_of'].forEach((n) => f[n].addEventListener('input', friendTitle)); f.friend_rel.addEventListener('change', friendTitle);
    // 제목에 "김신중의 친구 황윤수 생일"처럼 쓰면 친구 생일로 알아서 바꾼다
    f.title.addEventListener('blur', () => {
      if (f.kind.value !== 'birthday') return; const fr = parseFriend(f.title.value); if (!fr) return;
      f.bd_who.value = 'friend'; m.el.querySelector('[name=bd_who][value=friend]').checked = true;
      f.friend_name.value = fr.name; f.friend_of.value = fr.of; f.friend_rel.value = fr.rel; sync(); friendTitle();
    });
    f.title.oninput = () => { titleTouched = true; sum(); };
    f.repeat.addEventListener('change', () => { const was = repVal; repVal = f.repeat.value; if (!was && repVal && !editing) f.remind.checked = false; paintRep(); sum(); });
    f.addEventListener('input', sum);
    f.addEventListener('change', (e) => { if (e.target.name === 'bd_who' && e.target.value === 'friend') { if (/생일$/.test(f.title.value) && !parseFriend(f.title.value)) f.title.value = ''; friendTitle(); setTimeout(() => f.friend_of.focus(), 0); } sync(); }); sync();
    setTimeout(() => (quick && !editing ? quick : f.title).focus(), 60);

    f.onsubmit = async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(f).entries());
      body.is_leap = body.is_leap === '1';
      body.remind = f.remind.checked ? 1 : 0;
      if (body.kind !== 'event') { body.repeat = ''; body.repeat_until = ''; }
      if (body.repeat && m.el.querySelector('#multiDay').classList.contains('on') && body.end_date && body.end_date > body.date && body.repeat === 'weekly' && (Date.parse(body.end_date) - Date.parse(body.date)) >= 7 * 864e5) return YT.toast('매주 반복하는 일정은 7일보다 짧아야 해요.', 'error');
      if (body.kind === 'event' && !m.el.querySelector('#multiDay').classList.contains('on')) body.end_date = '';
      if (body.end_time && body.time && body.end_time <= body.time && !body.end_date) return YT.toast('끝 시간이 시작 시간보다 늦어야 해요.', 'error');
      if (body.kind === 'birthday' && body.bd_who === 'friend' && !body.friend_name.trim()) { f.friend_name.focus(); return YT.toast('생일인 사람 이름을 적어주세요.', 'error'); }
      if (body.bd_who !== 'friend') { delete body.friend_name; delete body.friend_of; }
            // 같은 생일 중복 확인
      if (!editing && body.kind === 'birthday') {
        const dup = er.events.find((x) => x.kind === 'birthday' && +x.birth_month === +body.birth_month && +x.birth_day === +body.birth_day && x.calendar === body.calendar && (x.title === body.title || YT.tags(x.hashtags).some((t) => YT.tags(body.hashtags).includes(t))));
        if (dup && !YT.confirm(`비슷한 생일이 이미 있어요: ‘${dup.title}’. 그래도 저장할까요?`)) return;
      }
      try {
        if (editing) await YT.put('/api/events/' + ev.id, body); else await YT.post('/api/events', body);
        YT.clearCache();
        YT.toast(editing ? '고친 내용을 저장했어요.' : body.kind === 'birthday' ? '생일을 저장했어요. 매년 자동으로 표시돼요.' : body.kind === 'anniversary' ? '기념일을 저장했어요. 매년 주년과 함께 표시돼요.' : '일정을 저장했어요.');
        const again = m.el.querySelector('#evAgain')?.checked;
        m.close(); onSaved && onSaved();
        if (again) YT.openEventForm({ kind: body.kind, date: body.date || today }, 'new', onSaved).then(() => { const a = document.querySelector('#evAgain'); if (a) a.checked = true; });
      } catch (err) { YT.err(err); }
    };
  };

  // ───────── 일정 화면 (보장설계 도우미의 업무 › 일정처럼)
  // 오늘(#/agenda) · 달력(#/calendar, 월간/주간) · 생일·기념일(#/anniversaries) — 위쪽 둥근 탭으로 오간다
  const KIND_LABEL = { event: '일정', birthday: '생일', anniversary: '기념일' };
  let calViewNow = ''; // 이번에 고른 달력 보기 (없으면 설정 → 화면 설정의 기본 보기)
  const evTime = (o) => (o.time ? `${o.time}${o.end_time ? '~' + o.end_time : ''}` : '종일');
  const row = (o, opts = {}) => {
    const extra = [o.location, o.repeat_label && '↻ ' + o.repeat_label, o.age && o.age + '세', o.anniversary_years && o.anniversary_years + '주년', o.end_date && o.end_date > o.date && `~${+o.end_date.slice(5, 7)}.${+o.end_date.slice(8)}`].filter(Boolean).join(' · ');
    return `<li class="ag-row">
      <span class="ag-when">${opts.date ? `<b>${+o.date.slice(5, 7)}.${+o.date.slice(8)}</b><small>${YT.weekday(o.date)}${opts.dday ? ' · ' + opts.dday : ''}</small>` : ''}<span class="ag-time">${evTime(o)}</span></span>
      <span class="kchip k-${o.kind}">${KIND_LABEL[o.kind] || '일정'}</span>
      <button class="ag-title" data-open="${o.id}" data-od="${o.date}">${esc(o.title)}${extra ? `<small>${esc(extra)}</small>` : ''}</button>
      <span class="ag-act">${YT.can('staff') && canEditEv(o) ? `<button class="linklike" data-edit="${o.id}">수정</button><button class="linklike danger" data-delev="${o.id}">삭제</button>` : ''}</span></li>`;
  };
  const rows = (list, opts) => (list.length ? `<ul class="ag-list">${list.map((o) => row(o, opts)).join('')}</ul>` : '');
  const dday = (today, d) => (d === today ? '오늘' : d === YT.addDays(today, 1) ? '내일' : 'D-' + YT.dayDiff(today, d));

  // 일정 자세히 · 수정 · 복제 · 삭제 (세 화면이 함께 씀)
  const findEv = async (id) => { for (const y of [+YT.today().slice(0, 4), +YT.today().slice(0, 4) + 1, +YT.today().slice(0, 4) - 1]) { const e = (await YT.getYearEvents(y)).events.find((x) => x.id === id); if (e) return e; } return null; };
  const openDetail = (o, redraw) => {
    const mm = YT.modal(`<div class="ev-detail"><div class="sec-kicker">${o.kind === 'birthday' ? '생일 · 매년 반복' : o.kind === 'anniversary' ? '기념일 · 매년 반복' : o.repeat_label ? '반복 일정 · ' + esc(o.repeat_label) : '일정'}</div>
      <h2 class="modal-title">${YT.eventIcon(o)} ${esc(o.title)}</h2>
      <ul class="ev-list">${YT.eventItem(o)}</ul>
      ${o.repeat_label ? `<p class="muted small">${esc(o.repeat_label)} · 고치면 반복되는 모든 날짜가 함께 바뀌어요.</p>` : ''}
      ${o.kind === 'birthday' ? `<p class="muted small">${o.calendar === 'lunar' ? '음력' : '양력'} ${o.birth_month}월 ${o.birth_day}일${o.is_leap ? ' (윤달)' : ''}${o.birth_year ? ` · ${o.birth_year}년생` : ''}</p>` : ''}
      <div class="row gap end mt">${canEditEv(o) ? `<button class="btn danger ghost" data-delev="${o.id}">삭제</button>` : ''}${YT.can('staff') ? `<button class="btn" data-dup="${o.id}">복제</button>` : ''}${canEditEv(o) ? `<button class="btn primary" data-edit="${o.id}">수정</button>` : ''}<button class="btn" data-close>닫기</button></div></div>`);
    mm.el.addEventListener('click', (e) => { const t = e.target.closest('[data-edit],[data-dup],[data-delev]'); if (t) { mm.close(); handle(t, redraw); } });
  };
  const handle = async (t, redraw) => {
    try {
      if (t.dataset.edit) { const ev = await findEv(t.dataset.edit); if (!ev) return YT.toast('일정을 찾을 수 없습니다.', 'error'); YT.openEventForm(ev, 'edit', redraw); }
      else if (t.dataset.dup) { const ev = await findEv(t.dataset.dup); if (!ev) return YT.toast('복제할 일정을 찾을 수 없습니다.', 'error'); YT.openEventForm({ ...ev, id: null }, 'dup', redraw); }
      else if (t.dataset.delev) { if (!YT.confirm('이 일정을 삭제할까요? 삭제한 일정에서 복원할 수 있습니다.')) return; const r = await YT.del('/api/events/' + t.dataset.delev); YT.toast(r.message); YT.clearCache(); redraw(); }
      else if (t.dataset.restoreEv) { const r = await YT.post(`/api/events/${t.dataset.restoreEv}/restore`); YT.toast(r.message); YT.clearCache(); redraw(); }
      else if (t.dataset.purgeEv) { if (!YT.confirm('이 일정을 영구 삭제할까요? 생일·기념일 등 매년 반복 일정은 모든 해의 표시가 사라지며 복원할 수 없습니다.')) return; const r = await YT.del(`/api/events/${t.dataset.purgeEv}?permanent=1`); YT.toast(r.message); redraw(); }
    } catch (err) { YT.err(err); }
  };
  // 화면 공통: 클릭 연결 (자세히 · 수정 · 삭제)
  const bindRows = (view, getOcc, redraw) => {
    view.onclick = async (e) => {
      const t = e.target.closest('[data-edit],[data-dup],[data-delev],[data-restore-ev],[data-purge-ev]');
      if (t && !t.closest('.modal')) return handle(t, redraw);
      const op = e.target.closest('[data-open]');
      if (op) { const list = await getOcc(); const o = list.find((x) => x.id === op.dataset.open && x.date === op.dataset.od) || list.find((x) => x.id === op.dataset.open); if (o) openDetail(o, redraw); }
    };
  };
  const icsDownload = async () => {
    try {
      const { ics } = await YT.api('/api/calendar-ics');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'unitimes-calendar.ics';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      YT.modal(`<h2 class="modal-title">내 캘린더로 가져가기</h2><p>‘unitimes-calendar.ics’ 파일을 내려받았어요. 올해와 내년의 일정·생일·기념일이 들어 있어요.</p>
        <ul class="set-list"><li><b>아이폰</b> — 내려받은 파일을 열고 ‘모두 추가’를 누르세요.</li><li><b>갤럭시·구글 캘린더</b> — 컴퓨터에서 calendar.google.com → 설정 → 가져오기에서 파일을 올리세요.</li><li><b>맥</b> — 파일을 두 번 누르면 캘린더 앱에 추가돼요.</li></ul>
        <p class="muted small">한 번 가져온 뒤 바뀐 일정은 자동으로 따라오지 않아요. 바뀌면 다시 가져오세요.</p><div class="row end"><button class="btn primary" data-close>확인</button></div>`);
    } catch (err) { YT.err(err); }
  };
  // 머리: 가로 줄 메뉴 + 제목 한 줄 (설명·큰 버튼 없이 깔끔하게)
  const head = (title) => YT.subTabs('schedule', 'bar') + `<h1 class="page-title sch-title">${title}</h1>`;
  const icsLink = '<button class="linklike sch-ics" id="icsBtn" title="휴대폰·구글 캘린더로 가져가기">휴대폰 캘린더로 내보내기</button>';
  const bindHead = (getDate, redraw) => { const i = YT.$('#icsBtn'); if (i) i.onclick = icsDownload; view0().querySelectorAll('[data-add]').forEach((a) => (a.onclick = () => YT.openEventForm({ date: a.dataset.add || getDate(), kind: a.dataset.kind || undefined }, 'new', redraw))); };
  const view0 = () => document.getElementById('view');

  // ── 오늘
  YT.addRoute('/agenda', async (view) => {
    const today = YT.today();
    const draw = async () => {
      const P = YT.prefs(); const upN = [7, 14, 30].includes(+P.upDays) ? +P.upDays : 7;
      const [occ, todo] = await Promise.all([YT.occurrencesBetween(today, YT.addDays(today, 40)), YT.can('subscriber') ? YT.api('/api/items?kind=chore,meeting').catch(() => ({ items: [], assign: {} })) : { items: [], assign: {} }]);
      const todays = occ.filter((o) => o.date <= today && (o.end_date || o.date) >= today);
      const soon = occ.filter((o) => o.date > today && o.date <= YT.addDays(today, upN));
      const ym = today.slice(0, 7); const monthOcc = await YT.occurrencesBetween(ym + '-01', YT.addDays(YT.ymd(+ym.slice(0, 4) + (+ym.slice(5) === 12 ? 1 : 0), +ym.slice(5) === 12 ? 1 : +ym.slice(5) + 1, 1), -1));
      const bd = monthOcc.filter((o) => o.kind === 'birthday').length, an = monthOcc.filter((o) => o.kind === 'anniversary').length;
      const chores = todo.items.filter((i) => i.kind === 'chore');
      const decs = todo.items.filter((i) => i.kind === 'meeting').flatMap((m) => (m.data.decisions || []).filter((d) => !d.done).map((d) => ({ ...d, mt: m.data.title }))).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      const dueNow = decs.filter((d) => d.due && d.due <= today).length;
      const kpi = (k, v, unit, href, warn) => `<a class="gl ${warn ? 'warn' : ''}" href="${href}"><span>${k}</span><b>${v}<small>${unit}</small></b></a>`;
      const fold = (id, html, n) => (n > 5 ? `<div class="fold" id="${id}" data-open="0">${html}<button class="btn small more-btn" data-fold="${id}">더보기 (${n - 5}건 더) ▼</button></div>` : html);
      const wd = YT.weekday(today);
      view.innerHTML = head(`오늘 · ${+today.slice(5, 7)}월 ${+today.slice(8)}일 (${wd})`)
        + `<nav class="glance ag-kpis">${kpi('오늘 일정', todays.length, '건', `#/calendar?date=${today}`, todays.length)}${kpi(upN + '일 안 일정', soon.length, '건', '#/calendar')}${kpi('이번 달 생일', bd, '명', '#/anniversaries?k=birthday')}${kpi('이번 달 기념일', an, '번', '#/anniversaries?k=anniversary')}${YT.can('subscriber') ? kpi('할 일 (오늘까지)', dueNow + ' / ' + decs.length, '건', '#/todo/meeting', dueNow) : ''}</nav>
        <div class="ag-cols">
          <section class="panel ag-panel"><div class="side-head"><h2><i class="kdot ev"></i>오늘 일정 ${todays.length}</h2><span class="row gap">${YT.can('staff') ? `<button class="btn small primary" data-add="${today}">+ 추가</button>` : ''}<a class="btn small" href="#/calendar?date=${today}">달력 보기</a></span></div>
            ${todays.length ? fold('fToday', rows(todays), todays.length) : '<p class="muted">오늘 일정이 없어요.</p>'}</section>
          <section class="panel ag-panel"><div class="side-head"><h2><i class="kdot tk"></i>할 일 ${decs.length}</h2><a class="btn small" href="#/todo">전체 보기</a></div>
            ${chores.length ? `<ul class="ag-chores">${chores.map((c) => `<li><span>${esc(c.data.name)}</span><b>${esc((todo.assign[c.id] || [])[0] || '')}</b></li>`).join('')}</ul>` : ''}
            ${decs.length ? `<ul class="ag-list">${decs.slice(0, 6).map((d) => `<li class="ag-row todo ${d.due && d.due < today ? 'late' : ''}"><span class="ag-when"><span class="ag-time">${d.due ? `${+d.due.slice(5, 7)}.${+d.due.slice(8)}까지` : '기한 없음'}</span></span><span class="kchip k-todo">할 일</span><span class="ag-title as-text">${esc(d.text)}<small>${esc([d.owner, d.mt].filter(Boolean).join(' · '))}</small></span><span></span></li>`).join('')}</ul>` : `<p class="muted">${YT.can('subscriber') ? '남은 할 일이 없어요.' : '할 일은 가족 계정으로 로그인하면 보여요.'}</p>`}</section>
        </div>
        <section class="panel ag-panel"><div class="side-head"><h2>다가오는 ${upN}일 일정 ${soon.length}</h2>
          <span class="pv-seg sm" role="group" aria-label="기간">${[7, 14, 30].map((n) => `<button class="pv-btn" data-up="${n}" aria-pressed="${n === upN}">${n}일</button>`).join('')}</span></div>
          ${soon.length ? fold('fSoon', `<ul class="ag-list">${soon.map((o) => row(o, { date: true, dday: dday(today, o.date) })).join('')}</ul>`, soon.length) : '<p class="muted">다가오는 일정이 없어요.</p>'}</section>`;
      view.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { YT.setPref('upDays', +b.dataset.up); draw(); }));
      view.querySelectorAll('[data-fold]').forEach((b) => { const more = b.textContent; b.onclick = () => { const f = YT.$('#' + b.dataset.fold); const open = f.dataset.open !== '1'; f.dataset.open = open ? '1' : '0'; b.textContent = open ? '접기 ▲' : more; }; });
      bindHead(() => today, draw);
      bindRows(view, () => YT.occurrencesBetween(today, YT.addDays(today, 40)), draw);
    };
    await draw();
  });

  // ── 달력 (월간 · 주간)
  YT.addRoute('/calendar', async (view, _p, q) => {
    const today = YT.today();
    let sel = q.date || today; let cur = sel.slice(0, 7);
    let wk = (q.view || calViewNow || YT.prefs().calView) === 'week';
    let occ = [];
    const draw = async () => {
      const mon = YT.prefs().week === 'mon';
      const offs = (d) => (new Date(d + 'T00:00:00Z').getUTCDay() + (mon ? 6 : 0)) % 7;
      let start, n;
      if (wk) { start = YT.addDays(sel, -offs(sel)); n = 7; } else { const first = cur + '-01'; start = YT.addDays(first, -offs(first)); n = 42; }
      const end = YT.addDays(start, n - 1);
      occ = await YT.occurrencesBetween(start, end);
      const byDay = {};
      for (const o of occ) { const last = o.end_date && o.end_date > o.date ? o.end_date : o.date; for (let d = o.date; d <= last && d <= end; d = YT.addDays(d, 1)) (byDay[d] = byDay[d] || []).push(o); }
      const [y, m] = cur.split('-').map(Number);
      const ttl = wk ? `${+start.slice(5, 7)}.${+start.slice(8)} ~ ${+end.slice(5, 7)}.${+end.slice(8)}` : `${y}년 ${m}월`;
      const names = (mon ? '월화수목금토일' : '일월화수목금토').split('');
      let cells = '';
      for (let i = 0; i < n; i++) {
        const d = YT.addDays(start, i); const list = byDay[d] || []; const dw = new Date(d + 'T00:00:00Z').getUTCDay();
        const cls = [!wk && d.slice(0, 7) !== cur ? 'out' : '', d === today ? 'today' : '', d === sel ? 'sel' : '', dw === 0 ? 'sun' : '', dw === 6 ? 'sat' : '', wk ? 'wk' : ''].join(' ');
        const lim = wk ? 99 : 3;
        cells += `<button class="cal-cell ${cls}" data-day="${d}" aria-label="${d} 일정 ${list.length}개"><span class="cd">${wk ? `${+d.slice(5, 7)}.${+d.slice(8)} <small>${names[(i) % 7]}</small>` : +d.slice(8)}</span>
          ${list.slice(0, lim).map((o) => `<span class="cal-ev k-${o.kind}" data-ev="${o.id}" data-evd="${o.date}" title="${esc(o.title)} — 눌러서 자세히">${o.time ? `<i class="ct">${o.time}</i> ` : ''}${o.repeat_label ? '<i class="rep" aria-label="반복">↻</i>' : ''}${esc(o.title)}</span>`).join('')}${list.length > lim ? `<span class="more">외 ${list.length - lim}건</span>` : ''}${wk && !list.length ? '<span class="cal-none">일정 없음</span>' : ''}</button>`;
      }
      const dayList = byDay[sel] || [];
      view.innerHTML = head('일정')
        + `<section class="panel cal-panel">
          <div class="cal-bar"><div class="row gap">
              <span class="pv-seg" role="tablist" aria-label="달력 보기"><button class="pv-btn" data-cv="month" aria-pressed="${!wk}">월간</button><button class="pv-btn" data-cv="week" aria-pressed="${wk}">주간</button></span>
              <button class="btn small" id="prevM" aria-label="이전 ${wk ? '주' : '달'}">‹</button><h2 class="cal-ttl">${ttl}</h2><button class="btn small" id="nextM" aria-label="다음 ${wk ? '주' : '달'}">›</button><button class="btn small" id="todayBtn">오늘</button></div>
            <div class="legend"><span class="kchip k-birthday">생일</span><span class="kchip k-anniversary">기념일</span><span class="kchip k-event">일정</span></div></div>
          <div class="cal-grid ${wk ? 'week' : 'month'}" id="calGrid"><div class="cal-head">${names.map((d) => `<div class="${d === '일' ? 'sun' : d === '토' ? 'sat' : ''}">${d}</div>`).join('')}</div><div class="cal-body">${cells}</div></div>
        </section>
        <section class="panel ag-panel" id="dayPanel"><div class="side-head"><h2>${+sel.slice(5, 7)}월 ${+sel.slice(8)}일 일정 ${dayList.length}건</h2>${YT.can('staff') ? `<button class="btn small primary" data-add="${sel}">+ 추가</button>` : ''}</div>
          ${dayList.length ? rows(dayList) : `<p class="muted">이 날은 일정이 없어요.</p>`}
          <p class="muted small sch-foot">달력 칸을 두 번 누르면 그 날짜로 바로 추가돼요. 생일·기념일은 <a href="#/anniversaries">생일·기념일</a>에 모여 있어요. ${icsLink}</p></section>
        ${YT.can('editor') ? '<details class="trash" id="delBox"><summary>삭제한 일정</summary><div id="delList" class="muted">불러오는 중…</div></details>' : ''}`;
      const move = (k) => { if (wk) { sel = YT.addDays(sel, 7 * k); cur = sel.slice(0, 7); } else { const d = new Date(Date.UTC(y, m - 1 + k, 1)); cur = d.toISOString().slice(0, 7); if (sel.slice(0, 7) !== cur) sel = cur === today.slice(0, 7) ? today : cur + '-01'; } draw(); };
      YT.$('#prevM').onclick = () => move(-1); YT.$('#nextM').onclick = () => move(1);
      YT.$('#todayBtn').onclick = () => { sel = today; cur = today.slice(0, 7); draw(); };
      view.querySelectorAll('[data-cv]').forEach((b) => (b.onclick = () => { wk = b.dataset.cv === 'week'; calViewNow = b.dataset.cv; draw(); }));
      bindHead(() => sel, redraw);
      YT.$('#calGrid').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-ev]');
        if (chip) { e.stopPropagation(); const o = occ.find((x) => x.id === chip.dataset.ev && x.date === chip.dataset.evd) || occ.find((x) => x.id === chip.dataset.ev); if (o) openDetail(o, redraw); return; }
        const c = e.target.closest('[data-day]'); if (!c) return; sel = c.dataset.day; if (!wk && sel.slice(0, 7) !== cur) cur = sel.slice(0, 7); draw().then(() => { if (innerWidth < 760) YT.$('#dayPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      });
      YT.$('#calGrid').ondblclick = (e) => { const c = e.target.closest('[data-day]'); if (c && !e.target.closest('[data-ev]') && YT.can('staff')) YT.openEventForm({ date: c.dataset.day }, 'new', redraw); };
      loadDeleted();
    };
    const redraw = () => { YT.clearCache(); draw(); };
    const loadDeleted = async () => {
      if (!YT.can('editor') || !YT.$('#delBox')) return;
      const { events } = await YT.api('/api/events/deleted');
      YT.$('#delBox summary').textContent = `삭제한 일정 (${events.length})`;
      YT.$('#delList').innerHTML = events.length ? events.map((e) => `<div class="nr-row"><div>${YT.eventIcon(e)} ${esc(e.title)}</div><div class="nr-actions"><button class="btn small" data-restore-ev="${e.id}">복원</button>${YT.can('admin') ? `<button class="btn small danger" data-purge-ev="${e.id}">영구 삭제</button>` : ''}</div></div>`).join('') : '<p class="muted">비어 있어요.</p>';
    };
    bindRows(view, async () => occ, redraw);
    await draw();
    if (q.edit) handle({ dataset: { edit: q.edit } }, redraw);
  });

  // ── 생일·기념일 모아 보기
  YT.addRoute('/anniversaries', async (view, _p, q) => {
    const today = YT.today();
    let kind = ['birthday', 'anniversary'].includes(q.k) ? q.k : ''; let term = '';
    const draw = async () => {
      const { events } = await YT.getYearEvents(+today.slice(0, 4));
      const occ = await YT.occurrencesBetween(today, YT.addDays(today, 366));
      const nextOf = (id) => occ.find((o) => o.id === id);
      const all = events.filter((e) => e.kind !== 'event');
      const list = all.filter((e) => (!kind || e.kind === kind) && (!term || e.title.includes(term)))
        .map((e) => ({ e, n: nextOf(e.id) })).sort((a, b) => (a.n?.date || '9999').localeCompare(b.n?.date || '9999'));
      const soon = list.filter((x) => x.n && YT.dayDiff(today, x.n.date) <= 30);
      const cnt = (k) => all.filter((e) => e.kind === k).length;
      view.innerHTML = head('생일·기념일')
        + `<div class="hs-bar"><div class="chips" id="akF">${[['', `전체 ${all.length}`], ['birthday', `생일 ${cnt('birthday')}`], ['anniversary', `기념일 ${cnt('anniversary')}`]].map(([v, l]) => `<button class="chip ${kind === v ? 'on' : ''}" data-k="${v}">${l}</button>`).join('')}</div>
          <input type="search" class="input sm" id="akQ" placeholder="이름 찾기" aria-label="이름 찾기" value="${esc(term)}" style="max-width:14rem"></div>
        ${soon.length ? `<section class="panel ag-panel"><div class="side-head"><h2>30일 안에 돌아와요 ${soon.length}</h2></div><ul class="ag-list">${soon.map(({ n }) => row(n, { date: true, dday: dday(today, n.date) })).join('')}</ul></section>` : ''}
        <section class="panel ag-panel"><div class="side-head"><h2>${kind ? KIND_LABEL[kind] : '생일·기념일'} 전체 ${list.length}</h2>${YT.can('staff') ? `<button class="btn small primary" data-add="${today}" data-kind="${kind === 'anniversary' ? 'anniversary' : 'birthday'}">+ ${kind === 'anniversary' ? '기념일' : '생일'} 추가</button>` : ''}</div>
        ${list.length ? `<div class="table-wrap"><table class="table yearly"><thead><tr><th>이름</th><th>날짜</th><th>다음</th><th></th></tr></thead><tbody>${list.map(({ e, n }) => `<tr>
          <td><button class="linklike strong" data-open="${e.id}" data-od="${n ? n.date : ''}">${YT.eventIcon(e)}${esc(e.title)}</button></td>
          <td class="nowrap">${e.kind === 'birthday' ? `${e.calendar === 'lunar' ? '음력' : '양력'} ${e.birth_month}.${e.birth_day}${e.is_leap ? ' 윤' : ''}${e.birth_year ? ` <span class="muted">· ${e.birth_year}</span>` : ''}` : esc(e.date)}</td>
          <td class="nowrap">${n ? `${esc(n.date.slice(5).replace('-', '/'))} <span class="muted">${dday(today, n.date)}${n.age ? ` · ${n.age}세` : ''}${n.anniversary_years ? ` · ${n.anniversary_years}주년` : ''}</span>` : '-'}</td>
          <td class="nowrap r">${canEditEv(e) ? `<button class="linklike" data-edit="${e.id}">수정</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">조건에 맞는 생일·기념일이 없어요.</p>'}</section>`;
      YT.$('#akF').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { kind = b.dataset.k; draw(); } };
      YT.$('#akQ').oninput = YT.debounce((e) => { term = e.target.value.trim(); draw().then(() => { const i = YT.$('#akQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 250);
      bindHead(() => today, redraw);
      bindRows(view, async () => [...occ, ...events.map((e) => ({ ...e, date: nextOf(e.id)?.date || e.date }))], redraw);
    };
    const redraw = () => { YT.clearCache(); draw(); };
    await draw();
  });
})();
