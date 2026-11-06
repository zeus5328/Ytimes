/* 시간표 */
(function () {
  'use strict';
  const { esc } = YT;
  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const TYPES = { school: '학교 수업', afterschool: '방과후', academy: '학원', activity: '자습·활동' };
  const PALETTE = ['#e9d7c3', '#cfe0d3', '#d6dcef', '#f1d3d3', '#e6e0c4', '#d3e7e8', '#e5d4ea', '#f0dcc8', '#d8e6c6', '#dcd6cf',
    '#f3e3b8', '#c9dfe9', '#ead1dc', '#d1e3dd', '#e2d9f0', '#f2d6c2', '#d7e2c9', '#cfd8e3', '#ecdcd0', '#dfe8d5'];
  const colorOf = (subject, map) => { if (!map.has(subject)) map.set(subject, PALETTE[map.size % PALETTE.length]); return map.get(subject); };

  function ttForm(t) {
    const y = new Date().getFullYear();
    return `<h2 class="modal-title">${t?.id ? '학생·교시 설정' : '새 시간표'}</h2><form id="ttForm" class="form">
      <div class="form-row"><label>학생 이름<input class="input" name="student" required maxlength="30" value="${esc(t?.student || '')}" placeholder="김도윤"></label>
      <label>학년도<select class="select" name="school_year">${[y - 1, y, y + 1].map((v) => `<option ${v === (t?.school_year || y) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>학기<select class="select" name="term">${['1학기', '2학기', '여름방학', '겨울방학'].map((v) => `<option ${v === t?.term ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="form-row"><label>학교급<select class="select" name="level">${['초등', '중등', '고등'].map((v) => `<option ${v === t?.level ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>학년<input class="input" name="grade" maxlength="10" value="${esc(t?.grade || '')}" placeholder="3"></label>
      <label>반<input class="input" name="class_no" maxlength="10" value="${esc(t?.class_no || '')}" placeholder="2"></label></div>
      <div class="form-row"><label>하루 교시 수<input type="number" class="input" name="periods" min="4" max="10" value="${t?.periods || 7}"></label>
      <label>1교시 시작<input type="time" class="input" name="start_time" value="${esc(t?.start_time || '09:00')}"></label></div>
      <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`;
  }
  function itemForm(it, t) {
    return `<h2 class="modal-title">${it?.id ? '수업 수정' : '수업 추가'}</h2><form id="itForm" class="form">
      <fieldset class="seg"><legend>종류</legend>${Object.entries(TYPES).map(([v, l]) => `<label><input type="radio" name="type" value="${v}" ${(it?.type || 'school') === v ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
      <div class="form-row"><label>요일<select class="select" name="day">${DAYS.map((d, i) => `<option value="${i}" ${(it?.day ?? 0) === i ? 'selected' : ''}>${d}요일</option>`).join('')}</select></label>
      <label data-school>교시<select class="select" name="period">${Array.from({ length: t.periods }, (_, i) => `<option value="${i + 1}" ${it?.period === i + 1 ? 'selected' : ''}>${i + 1}교시</option>`).join('')}</select></label>
      <label data-other>시작<input type="time" class="input" name="start" value="${esc(it?.start || '16:00')}"></label>
      <label data-other>종료<input type="time" class="input" name="end" value="${esc(it?.end || '17:00')}"></label></div>
      <div class="form-row"><label>과목·활동<input class="input" name="subject" required maxlength="30" value="${esc(it?.subject || '')}" placeholder="국어 / 피아노"></label>
      <label>장소<input class="input" name="place" maxlength="40" value="${esc(it?.place || '')}" placeholder="교실 / OO학원"></label>
      <label>선생님<input class="input" name="teacher" maxlength="30" value="${esc(it?.teacher || '')}"></label></div>
      <label class="block">메모<input class="input" name="memo" maxlength="200" value="${esc(it?.memo || '')}" placeholder="준비물 등"></label>
      <div class="row gap end">${it?.id ? '<button type="button" class="btn danger ghost" id="itDel">삭제</button>' : ''}<button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`;
  }

  YT.addRoute('/timetable', async (view) => {
    const r = await YT.api('/api/timetables');
    if (!r.allowed) {
      view.innerHTML = YT.pageHead('', '시간표', '학교 수업과 학원 일정을 한 주에 모아보는 공간입니다.')
        + '<div class="empty-state"><h2>보호된 공간이에요</h2><p>학생의 시간표는 관리자와 지정된 가족 기자만 확인할 수 있습니다. 권한이 있는 계정으로 로그인해주세요.</p>'
        + (YT.state.user ? '' : `<a class="btn primary" href="#/login?next=${encodeURIComponent('#/timetable')}">로그인</a>`) + '</div>';
      return;
    }
    const list = r.timetables;
    let curId = YT.query().id || list[0]?.id;
    let dayView = (new Date().getDay() + 6) % 7;
    const save = async (t) => { await YT.put('/api/timetables/' + t.id, t); };

    const draw = () => {
      const t = list.find((x) => x.id === curId);
      view.innerHTML = YT.pageHead('', '나의 일주일, 시간표', '학교에서 학원까지. 하루의 흐름을 한눈에 확인해요.',
        `<button class="btn primary" id="newTt">+ 새 시간표</button>`)
        + `<div class="chips">${list.map((x) => `<button class="chip ${x.id === curId ? 'on' : ''}" data-tt="${x.id}">${esc(x.student)} · ${x.school_year} ${esc(x.term || '')}</button>`).join('')}</div>`
        + (t ? body(t) : '<div class="empty-state"><h2>첫 시간표를 만들어보세요</h2><p>학생 이름과 교시를 정하면 요일별 수업을 넣을 수 있어요.</p></div>');
      YT.$('#newTt').onclick = () => openTt(null);
      YT.$$('[data-tt]').forEach((b) => (b.onclick = () => { curId = b.dataset.tt; draw(); }));
      if (!t) return;
      YT.$('#ttEdit').onclick = () => openTt(t);
      YT.$('#ttAdd').onclick = () => openItem(t, null);
      YT.$('#ttDel').onclick = async () => { if (!YT.confirm(`${t.student} 시간표를 삭제할까요?`)) return; await YT.del('/api/timetables/' + t.id); list.splice(list.indexOf(t), 1); curId = list[0]?.id; draw(); YT.toast('시간표를 삭제했습니다.'); };
      YT.$('#ttImport').onclick = () => YT.$('#ttFile').click();
      YT.$('#ttFile').onchange = (e) => importCsv(t, e.target.files[0]);
      YT.$('#ttPrint').onclick = () => window.print();
      YT.$$('[data-item]').forEach((b) => (b.onclick = () => openItem(t, t.items.find((i) => i.id === b.dataset.item))));
      YT.$$('[data-slot]').forEach((b) => (b.onclick = () => { const [d, p] = b.dataset.slot.split(':').map(Number); openItem(t, { day: d, period: p, type: 'school' }); }));
      YT.$$('[data-after]').forEach((b) => (b.onclick = () => openItem(t, { day: +b.dataset.after, type: 'afterschool', start: '13:30', end: '14:50' })));
      YT.$$('[data-dv]').forEach((b) => (b.onclick = () => { dayView = +b.dataset.dv; draw(); }));
    };
    const body = (t) => {
      const cmap = new Map();
      t.items.slice().sort((a, b) => a.subject.localeCompare(b.subject, 'ko')).forEach((i) => colorOf(i.subject, cmap));
      const weekend = t.items.some((i) => i.day >= 5);
      const days = weekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
      const periodTime = (p) => { const [h, m] = t.start_time.split(':').map(Number); const s = h * 60 + m + (p - 1) * 50 + (p > 4 ? 50 : 0); return `${YT.pad(Math.floor(s / 60))}:${YT.pad(s % 60)}`; };
      const school = (d, p) => t.items.filter((i) => i.type === 'school' && i.day === d && i.period === p);
      const byTime = (a, b) => a.start.localeCompare(b.start);
      const after = t.items.filter((i) => i.type === 'afterschool').sort(byTime);
      const others = t.items.filter((i) => i.type === 'academy' || i.type === 'activity').sort(byTime);
      const cell = (i) => `<button class="tt-item t-${i.type}" style="--c:${colorOf(i.subject, cmap)}" data-item="${i.id}"><b>${esc(i.subject)}</b>${i.place ? `<small>${esc(i.place)}</small>` : ''}${i.start ? `<small>${esc(i.start)}–${esc(i.end)}</small>` : ''}</button>`;
      // 오늘 요일 칸과 지금 교시를 눈에 띄게
      const nowD = (new Date().getDay() + 6) % 7; const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const isNow = (p) => { const [h, m] = periodTime(p).split(':').map(Number); const st = h * 60 + m; return nowD < 5 && nowMin >= st && nowMin < st + 45; };
      const td = (d) => (d === nowD ? ' class="today"' : '');
      const counts = { school: 0, afterschool: 0, academy: 0, activity: 0 }; t.items.forEach((i) => { if (i.type in counts) counts[i.type]++; });
      return `<div class="tt-meta"><div><b>${esc(t.student)}</b> · ${t.school_year}학년도 ${esc(t.term || '')} · ${esc(t.level || '')} ${esc(t.grade || '')}${t.grade ? '학년' : ''} ${esc(t.class_no || '')}${t.class_no ? '반' : ''}
        <span class="muted small"> · 학교 ${counts.school}교시 · 방과후 ${counts.afterschool}회 · 학원·활동 ${counts.academy + counts.activity}회</span></div>
        <div class="row gap"><button class="btn small primary" id="ttAdd">+ 수업 추가</button><button class="btn small" id="ttEdit">학생·교시 설정</button>
        <button class="btn small" id="ttImport">파일 가져오기</button><button class="btn small" id="ttPrint">인쇄</button><button class="btn small danger ghost" id="ttDel">시간표 삭제</button>
        <input type="file" id="ttFile" accept=".csv,.txt" hidden></div></div>
        <div class="tt-dayview"><span class="muted small">요일 하루 보기</span>${days.map((d) => `<button class="chip ${dayView === d ? 'on' : ''}" data-dv="${d}">${DAYS[d]}</button>`).join('')}</div>
        <div class="tt-wrap"><table class="tt" data-dayview="${dayView}"><thead><tr><th>교시</th>${days.map((d) => `<th data-d="${d}"${td(d)}>${DAYS[d]}${d === nowD ? '<small class="tt-today">오늘</small>' : ''}</th>`).join('')}</tr></thead><tbody>
        ${Array.from({ length: t.periods }, (_, k) => k + 1).map((p) => `<tr${isNow(p) ? ' class="now"' : ''}><th><b>${p}</b><small>${periodTime(p)}${isNow(p) ? ' · 지금' : ''}</small></th>${days.map((d) => { const its = school(d, p); return `<td data-d="${d}"${td(d)}>${its.length ? its.map(cell).join('') : `<button class="tt-empty" data-slot="${d}:${p}" aria-label="${DAYS[d]} ${p}교시 수업 추가">+</button>`}</td>`; }).join('')}</tr>`).join('')}
        <tr class="tt-sep tt-after"><th>방과후</th>${days.map((d) => `<td data-d="${d}">${after.filter((i) => i.day === d).map(cell).join('') || `<button class="tt-empty" data-after="${d}" aria-label="${DAYS[d]} 방과후 추가">+</button>`}</td>`).join('')}</tr>
        <tr class="tt-sep"><th>학원·활동</th>${days.map((d) => `<td data-d="${d}">${others.filter((i) => i.day === d).map(cell).join('') || ''}</td>`).join('')}</tr>
        </tbody></table></div>
        <div class="tt-legend"><span class="muted small">과목별 자동 색상 · 같은 과목은 같은 색 · 20과목까지 다른 색, 초과 시 재사용</span>
        ${[...cmap.entries()].map(([s, c]) => `<span class="lg" style="--c:${c}">${esc(s)}</span>`).join('')}</div>
        <p class="muted small">매주 반복하는 기본 시간표입니다. 휴강·방학·일회성 변경은 캘린더에서 따로 관리하세요. 저장한 시간표는 관리자와 작성자에게만 보입니다.<br>
        파일 가져오기: 한 줄에 <code>요일,교시 또는 시작-종료,과목,장소</code> 형식의 CSV (예: <code>월,1,국어,3-2교실</code> / <code>화,16:00-17:30,피아노,OO음악학원</code> / 장소에 ‘방과후’가 들어가면 방과후로 분류: <code>수,14:00-15:20,로봇과학,방과후교실</code>)</p>`;
    };
    const openTt = (t) => {
      const m = YT.modal(ttForm(t));
      m.el.querySelector('#ttForm').onsubmit = async (e) => {
        e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
        try {
          if (t) { Object.assign(t, b, { periods: +b.periods, school_year: +b.school_year }); await save(t); }
          else { const r = await YT.post('/api/timetables', { ...b, items: [] }); const fresh = (await YT.api('/api/timetables')).timetables; list.splice(0, list.length, ...fresh); curId = r.id; }
          m.close(); draw(); YT.toast('시간표를 저장했습니다.');
        } catch (err) { YT.err(err); }
      };
    };
    const openItem = (t, it) => {
      const m = YT.modal(itemForm(it, t)); const f = m.el.querySelector('#itForm');
      const sync = () => { const sc = f.type.value === 'school'; m.el.querySelectorAll('[data-school]').forEach((x) => (x.hidden = !sc)); m.el.querySelectorAll('[data-other]').forEach((x) => (x.hidden = sc)); };
      f.addEventListener('change', sync); sync();
      f.onsubmit = async (e) => {
        e.preventDefault(); const b = Object.fromEntries(new FormData(f).entries());
        const item = { id: it?.id || crypto.randomUUID(), type: b.type, day: +b.day, period: b.type === 'school' ? +b.period : 0, start: b.type === 'school' ? '' : b.start, end: b.type === 'school' ? '' : b.end, subject: b.subject, place: b.place, teacher: b.teacher, memo: b.memo };
        if (item.type === 'school') {
          const clash = t.items.filter((i) => i.id !== item.id && i.type === 'school' && i.day === item.day && i.period === item.period);
          if (clash.length && !YT.confirm(`${DAYS[item.day]}요일 ${item.period}교시에 이미 ‘${clash[0].subject}’ 수업이 있어요. 바꿀까요?`)) return;
          t.items = t.items.filter((i) => !clash.includes(i));
        }
        const idx = t.items.findIndex((i) => i.id === item.id); if (idx >= 0) t.items[idx] = item; else t.items.push(item);
        try { await save(t); m.close(); draw(); YT.toast('수업을 저장했습니다.'); } catch (err) { YT.err(err); }
      };
      const del = m.el.querySelector('#itDel');
      if (del) del.onclick = async () => { t.items = t.items.filter((i) => i.id !== it.id); try { await save(t); m.close(); draw(); YT.toast('수업을 삭제했습니다.'); } catch (err) { YT.err(err); } };
    };
    const importCsv = async (t, file) => {
      if (!file) return;
      const text = await file.text(); let n = 0;
      for (const line of text.split(/\r?\n/)) {
        const [d, slot, subject, place] = line.split(',').map((s) => (s || '').trim());
        const day = DAYS.indexOf(d.replace('요일', '')); if (day < 0 || !subject) continue;
        if (/^\d+$/.test(slot)) { t.items = t.items.filter((i) => !(i.type === 'school' && i.day === day && i.period === +slot)); t.items.push({ id: crypto.randomUUID(), type: 'school', day, period: +slot, subject, place: place || '', start: '', end: '' }); n++; }
        else { const m = /(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/.exec(slot); if (!m) continue; t.items.push({ id: crypto.randomUUID(), type: /방과후/.test(place || '') || /방과후/.test(subject) ? 'afterschool' : 'academy', day, period: 0, start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0'), subject, place: place || '' }); n++; }
      }
      if (!n) return YT.toast('가져올 수 있는 줄이 없어요. 형식을 확인해주세요.', 'error');
      try { await save(t); draw(); YT.toast(`${n}개 수업을 가져왔습니다.`); } catch (err) { YT.err(err); }
    };
    draw();
  });
})();
