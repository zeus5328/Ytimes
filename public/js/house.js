/* 가족 기록과 살림 화면들 — 메뉴 자리:
   신문 › 기사: 레시피북(#/recipes) · 여행 지도(#/map)
   일정 › 할 일: 한눈에(#/todo) · 집안일 당번 · 가족회의 · 버킷리스트
   가족 › 가족 앨범: 성장 기록(#/growth) · 가족 연표(#/timeline)
   편집국 › 기자단(#/reporters) */
(function () {
  'use strict';
  const { esc } = YT;
  const ymdOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const fmtD = (d) => (ymdOk(d) ? `${d.slice(0, 4)}.${+d.slice(5, 7)}.${+d.slice(8)}` : '');
  const items = (kinds) => YT.api('/api/items?kind=' + kinds).catch(() => ({ items: [], assign: {} }));
  const family = async () => {
    const [pp, rp] = await Promise.all([YT.api('/api/people').catch(() => ({ people: [] })), YT.api('/api/reporters').catch(() => ({ reporters: [] }))]);
    return [...new Set([...(rp.reporters || []).map((r) => r.name), ...(pp.people || []).filter((p) => !p.is_group).map((p) => p.name)])].slice(0, 40);
  };
  const save = async (id, kind, data, date) => (id ? YT.put('/api/items/' + id, { data, date }) : YT.post('/api/items', { kind, data, date }));
  const delBtn = (it) => (it.can_edit ? `<button class="linklike danger" data-del="${it.id}">지우기</button>` : '');

  // ───────── 지도 (Leaflet + OpenStreetMap)
  let leafletP = null;
  YT.loadLeaflet = () => leafletP || (leafletP = new Promise((res, rej) => {
    if (window.L && window.L.map) return res(window.L);
    // 사이트에 함께 들어 있는 Leaflet(vendor/leaflet)을 먼저 쓰고, 없으면 인터넷(unpkg)에서
    const bases = ['vendor/leaflet/', 'https://unpkg.com/leaflet@1.9.4/dist/'];
    const tryBase = (i) => {
      if (i >= bases.length) { leafletP = null; return rej(new Error('지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); }
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = bases[i] + 'leaflet.css'; document.head.appendChild(css);
      const js = document.createElement('script'); js.src = bases[i] + 'leaflet.js';
      js.onload = () => (window.L && window.L.map ? res(window.L) : tryBase(i + 1)); js.onerror = () => { css.remove(); js.remove(); tryBase(i + 1); };
      document.head.appendChild(js);
    };
    tryBase(0);
  }));
  const tiles = (L, map) => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
  YT.mapTiles = tiles;
  // 두 점 사이 거리(m)
  YT.distM = (a, b) => { const R = 6371e3, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  // 위치 → 알아보기 쉬운 이름 (예: 신림동 · 보라매공원). 못 찾으면 빈 글자
  YT.reverseName = async (lat, lng) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&accept-language=ko&lat=${lat}&lon=${lng}`).then((x) => x.json());
      const a = r.address || {}; const poi = r.name || a.amenity || a.tourism || a.leisure || a.shop || a.building || '';
      const area = a.neighbourhood || a.quarter || a.suburb || a.village || a.town || a.city_district || a.city || '';
      return [area, poi].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(' · ').slice(0, 60);
    } catch { return ''; }
  };
  // 사진 파일(JPEG)에 들어 있는 찍은 위치 읽기 — 없으면 null
  YT.gpsFromFile = async (file) => {
    try {
      if (!file || !/jpe?g/i.test(file.type || file.name || '')) return null;
      const buf = await file.slice(0, 256 * 1024).arrayBuffer(); const v = new DataView(buf);
      if (v.getUint16(0) !== 0xFFD8) return null;
      let o = 2;
      while (o + 4 < v.byteLength) {
        const mk = v.getUint16(o), len = v.getUint16(o + 2);
        if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) { // "Exif"
          const t = o + 10; const le = v.getUint16(t) === 0x4949; const u16 = (p) => v.getUint16(p, le), u32 = (p) => v.getUint32(p, le);
          const ifd = (p) => { const n = u16(p); const tags = {}; for (let i = 0; i < n; i++) { const e = p + 2 + i * 12; tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), val: e + 8 }; } return tags; };
          const ifd0 = ifd(t + u32(t + 4)); if (!ifd0[0x8825]) return null;
          const g = ifd(t + u32(ifd0[0x8825].val));
          const rat = (tag) => { if (!tag) return null; const p = t + u32(tag.val); const r = (k) => u32(p + k * 8) / (u32(p + k * 8 + 4) || 1); return r(0) + r(1) / 60 + r(2) / 3600; };
          const ref = (tag) => (tag ? String.fromCharCode(v.getUint8(tag.val)) : '');
          let lat = rat(g[2]), lng = rat(g[4]); if (lat == null || lng == null || (!lat && !lng)) return null;
          if (ref(g[1]) === 'S') lat = -lat; if (ref(g[3]) === 'W') lng = -lng;
          return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 } : null;
        }
        if ((mk & 0xFF00) !== 0xFF00) return null; o += 2 + len;
      }
    } catch { /* 위치 없음 */ }
    return null;
  };
  // 지난 기사에 넣었던 장소 (최근 것부터, 이름이 같으면 하나로)
  YT.recentPlaces = async () => {
    const arts = await YT.getArticles(false, true).catch(() => []); const seen = new Set(); const out = [];
    for (const a of arts.slice().sort((x, y) => (y.updated || '').localeCompare(x.updated || ''))) for (const p of a.places || (a.place ? [a.place] : [])) { if (!p || seen.has(p.name)) continue; seen.add(p.name); out.push(p); }
    return out.slice(0, 10);
  };
  // 기사 안의 작은 지도 — 다녀온 곳에 번호 핀, 여러 곳이면 순서대로 선
  YT.drawStopsMap = async (el, stops) => {
    if (!el || !stops || !stops.length) return;
    try {
      const L = await YT.loadLeaflet(); el.innerHTML = '';
      const m = L.map(el, { scrollWheelZoom: false }); tiles(L, m);
      const pts = stops.map((p) => [p.lat, p.lng]);
      stops.forEach((p, i) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'stop-pin', html: `<span>${stops.length > 1 ? i + 1 : '●'}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(m).bindPopup(esc(p.name)));
      if (pts.length > 1) { L.polyline(pts, { color: '#3B4C7A', weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(m); m.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 }); } else m.setView(pts[0], 15);
      setTimeout(() => m.invalidateSize(), 150);
    } catch (err) { el.innerHTML = `<p class="muted small">${esc(err.message)}</p>`; }
  };
  // 기사 쓰기에서 장소 고르기 — 이름 검색 또는 지도를 눌러 핀 꽂기
  YT.pickPlace = (cur) => new Promise(async (resolve) => {
    let picked = cur ? { ...cur } : null; let done = false;
    const m = YT.modal(`<h2 class="modal-title">장소 고르기</h2>
      <form class="pl-search" id="plSearch"><input class="input" name="q" placeholder="장소 이름 검색 (예: 강릉 경포대)" value="${esc(cur?.name || '')}"><button class="btn">찾기</button><button type="button" class="btn" id="plHere" title="지금 내가 있는 곳">📍 지금 여기</button></form>
      <div class="pl-recent" id="plRecent"></div>
      <ul class="pl-results" id="plResults"></ul>
      <div class="pl-map" id="plMap"><p class="muted small">지도를 불러오는 중…</p></div>
      <label class="block">지도에 보일 이름<input class="input" id="plName" maxlength="60" value="${esc(cur?.name || '')}" placeholder="예) 강릉 경포대"></label>
      <p class="muted small">검색하거나 지도를 눌러 핀을 꽂으세요. 지도 © OpenStreetMap</p>
      <div class="row gap end"><button class="btn" data-close>취소</button><button class="btn primary" id="plOk">이 장소로</button></div>`, { wide: true, onClose: () => { if (!done) resolve(null); } });
    let L, map, marker;
    // 자주 가는 곳: 지난 기사 장소(누르면 바로) + 일정에 적은 장소(누르면 검색)
    const recent = await YT.recentPlaces().catch(() => []);
    const evLocs = await YT.getYearEvents(new Date().getFullYear()).then((r) => [...new Set((r.events || []).map((e) => (e.location || '').trim()).filter(Boolean))].filter((n) => !recent.some((p) => p.name === n)).slice(0, 6)).catch(() => []);
    const rbox = m.el.querySelector('#plRecent');
    rbox.innerHTML = recent.length || evLocs.length ? `<span class="muted small">자주 가는 곳</span>${recent.map((p, i) => `<button type="button" class="chip" data-rp="${i}">${esc(p.name)}</button>`).join('')}${evLocs.map((n) => `<button type="button" class="chip ghost" data-q="${esc(n)}" title="일정에 적은 장소 — 눌러서 찾기">🔎 ${esc(n)}</button>`).join('')}` : '';
    rbox.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rp) { const p = recent[+b.dataset.rp]; setPin(p.lat, p.lng, p.name); if (map) map.setView([p.lat, p.lng], 15); }
      else if (b.dataset.q) { const f = m.el.querySelector('#plSearch'); f.q.value = b.dataset.q; f.requestSubmit ? f.requestSubmit() : f.onsubmit(new Event('submit')); }
    };
    m.el.querySelector('#plHere').onclick = (e) => {
      if (!navigator.geolocation) return YT.toast('이 기기에서는 위치를 알 수 없어요.', 'error');
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = '찾는 중…';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5, lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        const nm = m.el.querySelector('#plName').value.trim() || (await YT.reverseName(lat, lng)) || '지금 있는 곳';
        setPin(lat, lng, nm); if (map) map.setView([lat, lng], 16); btn.disabled = false; btn.textContent = '📍 지금 여기';
      }, () => { btn.disabled = false; btn.textContent = '📍 지금 여기'; YT.toast('위치를 알 수 없어요. 브라우저에서 위치 사용을 허락해 주세요.', 'error'); }, { enableHighAccuracy: true, timeout: 10000 });
    };
    const setPin = (lat, lng, name) => { picked = { lat, lng, name: name || m.el.querySelector('#plName').value.trim() }; if (name) m.el.querySelector('#plName').value = name; if (!map) return; if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map); map.setView([lat, lng], Math.max(map.getZoom(), 13)); };
    try {
      L = await YT.loadLeaflet(); const box = m.el.querySelector('#plMap'); box.innerHTML = '';
      const rec0 = !cur && recent[0]; map = L.map(box).setView(cur ? [cur.lat, cur.lng] : rec0 ? [rec0.lat, rec0.lng] : [36.4, 127.8], cur ? 15 : rec0 ? 12 : 7); tiles(L, map);
      if (cur) marker = L.marker([cur.lat, cur.lng]).addTo(map);
      map.on('click', async (e) => { setPin(e.latlng.lat, e.latlng.lng); const nmEl = m.el.querySelector('#plName'); if (!nmEl.value.trim()) { const nm = await YT.reverseName(e.latlng.lat, e.latlng.lng); if (nm && !nmEl.value.trim()) { nmEl.value = nm; picked.name = nm; } } });
      setTimeout(() => map.invalidateSize(), 150);
    } catch (err) { m.el.querySelector('#plMap').innerHTML = `<p class="muted small">${esc(err.message)} 이름만 넣어도 돼요.</p>`; }
    m.el.querySelector('#plSearch').onsubmit = async (e) => {
      e.preventDefault(); const q = e.target.q.value.trim(); if (!q) return; const ul = m.el.querySelector('#plResults'); ul.innerHTML = '<li class="muted">찾는 중…</li>';
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ko&countrycodes=&q=' + encodeURIComponent(q)).then((x) => x.json());
        ul.innerHTML = r.length ? r.map((x, i) => `<li><button type="button" data-i="${i}">${esc(x.display_name.split(',').slice(0, 3).join(','))}</button></li>`).join('') : '<li class="muted">찾지 못했어요. 지도를 직접 눌러 보세요.</li>';
        ul.onclick = (ev) => { const b = ev.target.closest('[data-i]'); if (!b) return; const x = r[+b.dataset.i]; setPin(+x.lat, +x.lon, q); ul.innerHTML = ''; };
      } catch { ul.innerHTML = '<li class="muted">검색을 할 수 없어요. 지도를 직접 눌러 핀을 꽂아 주세요.</li>'; }
    };
    m.el.querySelector('#plOk').onclick = () => {
      const name = m.el.querySelector('#plName').value.trim();
      if (!picked || !isFinite(picked.lat)) return YT.toast('지도를 눌러 위치를 골라 주세요.', 'error');
      if (!name) return YT.toast('지도에 보일 이름을 적어 주세요.', 'error');
      done = true; m.close(); resolve({ ...picked, name });
    };
  });

  // ───────── 한눈에
  async function overview(box) {
    const r = await items('chore,bucket,meeting,prep');
    const today = YT.today(); const preps = r.items.filter((i) => i.kind === 'prep' && i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const chores = r.items.filter((i) => i.kind === 'chore'); const bucket = r.items.filter((i) => i.kind === 'bucket');
    const todos = r.items.filter((i) => i.kind === 'meeting').flatMap((mt) => (mt.data.decisions || []).map((d, idx) => ({ ...d, mt, idx }))).filter((d) => !d.done);
    box.innerHTML = `<div class="hs-grid">
      <section class="hs-card"><h3>다가오는 행사 준비 <a href="#/todo/prep">준비함</a></h3>${preps.length ? `<ul class="hs-list">${preps.slice(0, 3).map((p) => { const c = p.data.checklist || []; const d = c.filter((x) => x.done).length;
        return `<li><span>${esc(p.data.title)} <small class="muted">${p.date === today ? '오늘' : 'D-' + YT.dayDiff(today, p.date)}</small></span><b>${c.length ? `${d}/${c.length}` : ''}</b></li>`; }).join('')}</ul>` : '<p class="muted small">준비할 행사가 없어요.</p>'}</section>
      <section class="hs-card"><h3>이번 주 당번 <a href="#/todo/chores">당번표</a></h3>${chores.length ? `<ul class="hs-list">${chores.map((c) => `<li><span>${esc(c.data.name)}</span><b>${esc((r.assign[c.id] || [])[0] || '')}</b></li>`).join('')}</ul>` : '<p class="muted">당번표를 만들면 매주 돌아가며 알려줘요.</p>'}</section>
      <section class="hs-card"><h3>가족회의에서 정한 일 <a href="#/todo/meeting">회의록</a></h3>${todos.length ? `<ul class="hs-list">${todos.slice(0, 6).map((d) => `<li><span>${esc(d.text)}</span><small>${esc(d.owner || '')}${d.due ? ' · ' + fmtD(d.due) + '까지' : ''}</small></li>`).join('')}</ul>` : '<p class="muted">남은 할 일이 없어요.</p>'}</section>
      <section class="hs-card"><h3>버킷리스트 <a href="#/todo/bucket">전체</a></h3><p class="hs-big"><b>${bucket.filter((b) => b.data.done).length}</b> / ${bucket.length} 이룸</p>${bucket.filter((b) => !b.data.done).slice(0, 3).map((b) => `<p class="hs-line">${esc(b.data.title)}</p>`).join('')}</section>
    </div>`;
  }

  // ───────── 가족 연표 (직접 기록 + 기사·생일·기념일 자동)
  async function timeline(box) {
    const [r, arts, ev] = await Promise.all([items('milestone'), YT.getArticles().catch(() => []), YT.getYearEvents(+YT.today().slice(0, 4)).catch(() => ({ events: [] }))]);
    const rows = [
      ...r.items.map((it) => ({ src: 'mine', date: it.date, title: it.data.title, emoji: it.data.emoji || (it.data.type === 'first' ? '' : ''), note: it.data.note, person: it.data.person, it })),
      ...arts.filter((a) => a.section === '헤드라인' || ['여행', '기념일', '학교', '성장'].includes(a.category)).map((a) => ({ src: 'article', date: (a.published_at || a.updated || '').slice(0, 10), title: a.title, emoji: '', note: `${a.section} · ${a.category}`, href: `#/article/${a.id}` })),
      ...(ev.events || []).filter((e) => e.kind === 'birthday' && e.birth_year && e.calendar === 'solar').map((e) => ({ src: 'family', date: `${e.birth_year}-${YT.pad(e.birth_month)}-${YT.pad(e.birth_day)}`, title: e.title.replace(/\s*생일.*$/, '') + ' 태어난 날', emoji: '' })),
      ...(ev.events || []).filter((e) => e.kind === 'anniversary' && e.date).map((e) => ({ src: 'family', date: e.date, title: e.title, emoji: '' })),
    ].filter((x) => ymdOk(x.date)).sort((a, b) => b.date.localeCompare(a.date));
    const f = YT.store.get('yt_tl_filter', 'all');
    const shown = rows.filter((x) => f === 'all' || x.src === f);
    const years = [...new Set(shown.map((x) => x.date.slice(0, 4)))];
    box.innerHTML = `<div class="hs-bar"><div class="chips" id="tlF">${[['all', '전체'], ['mine', '직접 남긴 일'], ['article', '신문 기사'], ['family', '생일·기념일']].map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-f="${v}">${l}</button>`).join('')}</div>
        <button class="btn primary small" id="tlAdd">+ 연표에 더하기</button></div>
      ${years.length ? years.map((y) => `<section class="tl-year"><h3>${y}</h3><ol class="tl">${shown.filter((x) => x.date.startsWith(y)).map((x) => `<li class="tl-i src-${x.src}">
          <span class="tl-dot"></span><div><small>${fmtD(x.date)}${x.person ? ' · ' + esc(x.person) : ''}</small>
          ${x.href ? `<a href="${x.href}"><b>${esc(x.title)}</b></a>` : `<b>${esc(x.title)}</b>`}${x.note ? `<p>${esc(x.note)}</p>` : ''}
          ${x.it && x.it.can_edit ? `<span class="tl-act"><button class="linklike" data-edit="${x.it.id}">고치기</button>${delBtn(x.it)}</span>` : ''}</div></li>`).join('')}</ol></section>`).join('')
        : '<div class="empty-state"><h2>아직 연표가 비어 있어요</h2><p>이사, 입학, 첫걸음, 가족 여행처럼 오래 기억하고 싶은 일을 한 줄씩 남겨 보세요.</p></div>'}`;
    box.querySelector('#tlF').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { YT.store.set('yt_tl_filter', b.dataset.f); timeline(box); } };
    const form = async (it, preset = {}) => {
      const fam = await family(); const d = it ? it.data : preset;
      const m = YT.modal(`<h2 class="modal-title">${it ? '연표 고치기' : '연표에 더하기'}</h2><form class="form" id="tlForm">
        <div class="evf-row"><label class="grow">날짜<input type="date" class="input" name="date" required value="${esc(it?.date || YT.today())}"></label>
          <label>종류<select class="select" name="type"><option value="">우리 가족 일</option><option value="first" ${d.type === 'first' ? 'selected' : ''}>처음 한 일</option></select></label></div>
        <label class="block">무슨 일<input class="input" name="title" required maxlength="80" value="${esc(d.title || '')}" placeholder="예) 새 집으로 이사, 윤서 초등학교 입학"></label>
        <div class="evf-row"><label class="grow">누구 <small class="muted">(선택)</small><input class="input" name="person" list="famL" maxlength="30" value="${esc(d.person || '')}"></label>
          <input type="hidden" name="emoji" value="${esc(d.emoji || '')}"></div>
        <datalist id="famL">${fam.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <label class="block">메모<textarea class="input" name="note" rows="2" maxlength="400">${esc(d.note || '')}</textarea></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`);
      const fm = m.el.querySelector('form');
      fm.onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(fm)); try { await save(it?.id, 'milestone', { title: v.title, person: v.person, emoji: v.emoji, note: v.note, type: v.type }, v.date); m.close(); YT.toast('연표에 남겼어요.'); const aft = YT.house.after; YT.house.after = null; if (aft) aft(); else timeline(box); } catch (err) { YT.err(err); } };
    };
    YT.house.milestoneForm = form;
    box.querySelector('#tlAdd').onclick = () => form(null);
    box.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); if (ed) return form(r.items.find((x) => x.id === ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl && YT.confirm('이 기록을 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); timeline(box); } catch (err) { YT.err(err); } }
    };
  }

  // ───────── 성장 기록 (키·몸무게 그래프 + 처음 한 일)
  const chart = (pts, key, unit, color) => {
    const ps = pts.filter((p) => p.data[key] != null); if (ps.length < 1) return `<div class="gr-empty muted small">${key === 'height' ? '키' : '몸무게'} 기록이 아직 없어요.</div>`;
    const W = 440, H = 190, P = 34; const t = (d) => Date.parse(d); const xs = ps.map((p) => t(p.date)), ys = ps.map((p) => p.data[key]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1, y0 = Math.floor(Math.min(...ys) - 2), y1 = Math.ceil(Math.max(...ys) + 2);
    const X = (v) => P + (x1 === x0 ? (W - 2 * P) / 2 : ((v - x0) / (x1 - x0)) * (W - 2 * P)), Y = (v) => H - P + 8 - ((v - y0) / (y1 - y0 || 1)) * (H - P - 8);
    const path = ps.map((p, i) => `${i ? 'L' : 'M'}${X(t(p.date)).toFixed(1)},${Y(p.data[key]).toFixed(1)}`).join(' ');
    return `<svg class="gr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${key === 'height' ? '키' : '몸무게'} 변화">
      <line x1="${P}" y1="${H - P + 8}" x2="${W - P}" y2="${H - P + 8}" class="gr-axis"/>
      <text x="${P - 4}" y="${Y(y1) + 4}" class="gr-t" text-anchor="end">${y1}</text><text x="${P - 4}" y="${Y(y0) + 4}" class="gr-t" text-anchor="end">${y0}</text>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${ps.map((p) => `<circle cx="${X(t(p.date)).toFixed(1)}" cy="${Y(p.data[key]).toFixed(1)}" r="3.5" fill="${color}"><title>${fmtD(p.date)} · ${p.data[key]}${unit}</title></circle>`).join('')}
      <text x="${P}" y="${H - 4}" class="gr-t">${fmtD(ps[0].date)}</text><text x="${W - P}" y="${H - 4}" class="gr-t" text-anchor="end">${fmtD(ps[ps.length - 1].date)}</text>
      <text x="${X(t(ps[ps.length - 1].date)).toFixed(1)}" y="${(Y(ps[ps.length - 1].data[key]) - 9).toFixed(1)}" class="gr-v" text-anchor="end">${ps[ps.length - 1].data[key]}${unit}</text></svg>`;
  };
  async function growth(box) {
    const r = await items('growth,milestone');
    const recs = r.items.filter((i) => i.kind === 'growth').sort((a, b) => a.date.localeCompare(b.date));
    const firsts = r.items.filter((i) => i.kind === 'milestone' && i.data.type === 'first');
    const people = [...new Set([...recs.map((x) => x.data.person), ...firsts.map((x) => x.data.person).filter(Boolean)])];
    let who = YT.store.get('yt_growth_who', '') ; if (!people.includes(who)) who = people[0] || '';
    const mine = recs.filter((x) => x.data.person === who); const myFirsts = firsts.filter((x) => x.data.person === who).sort((a, b) => b.date.localeCompare(a.date));
    const last = mine[mine.length - 1], prev = mine[mine.length - 2];
    const diff = (k) => (last && prev && last.data[k] != null && prev.data[k] != null ? (Math.round((last.data[k] - prev.data[k]) * 10) / 10) : null);
    box.innerHTML = `<div class="hs-bar"><div class="chips" id="grWho">${people.map((p) => `<button class="chip ${p === who ? 'on' : ''}" data-who="${esc(p)}">${esc(p)}</button>`).join('') || '<span class="muted small">처음 기록을 남겨 보세요.</span>'}</div>
        <div class="row gap"><button class="btn small" id="grFirst">처음 한 일</button><button class="btn primary small" id="grAdd">+ 키·몸무게 기록</button></div></div>
      ${who ? `<div class="gr-head"><h3>${esc(who)}</h3>${last ? `<p>최근 ${fmtD(last.date)} · ${last.data.height != null ? `키 <b>${last.data.height}cm</b>${diff('height') != null ? ` <small>(${diff('height') >= 0 ? '+' : ''}${diff('height')})</small>` : ''}` : ''} ${last.data.weight != null ? `· 몸무게 <b>${last.data.weight}kg</b>${diff('weight') != null ? ` <small>(${diff('weight') >= 0 ? '+' : ''}${diff('weight')})</small>` : ''}` : ''}</p>` : ''}</div>
        <div class="gr-charts"><figure><figcaption>키 (cm)</figcaption>${chart(mine, 'height', 'cm', 'var(--indigo)')}</figure><figure><figcaption>몸무게 (kg)</figcaption>${chart(mine, 'weight', 'kg', 'var(--seal)')}</figure></div>
        <div class="gr-cols"><section><h4>기록</h4>${mine.length ? `<table class="table gr-table"><thead><tr><th>날짜</th><th>키</th><th>몸무게</th><th>메모</th><th></th></tr></thead><tbody>${mine.slice().reverse().map((x) => `<tr><td>${fmtD(x.date)}</td><td>${x.data.height ?? '–'}</td><td>${x.data.weight ?? '–'}</td><td>${esc(x.data.note || '')}</td><td>${x.can_edit ? `<button class="linklike" data-edit="${x.id}">고치기</button>${delBtn(x)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">키·몸무게 기록이 없어요.</p>'}</section>
          <section><h4>처음 한 일</h4>${myFirsts.length ? `<ol class="tl small">${myFirsts.map((x) => `<li class="tl-i"><span class="tl-dot"></span><div><small>${fmtD(x.date)}</small><b>${esc(x.data.title)}</b>${x.data.note ? `<p>${esc(x.data.note)}</p>` : ''}</div></li>`).join('')}</ol>` : '<p class="muted">첫 자전거, 첫 영어 단어, 처음 혼자 한 심부름… 작은 ‘처음’을 모아 보세요.</p>'}</section></div>` : ''}`;
    box.querySelector('#grWho').onclick = (e) => { const b = e.target.closest('[data-who]'); if (b) { YT.store.set('yt_growth_who', b.dataset.who); growth(box); } };
    const form = async (it) => {
      const fam = await family(); const d = it ? it.data : { person: who };
      const m = YT.modal(`<h2 class="modal-title">${it ? '기록 고치기' : '키·몸무게 기록'}</h2><form class="form" id="grForm">
        <div class="evf-row"><label class="grow">누구<input class="input" name="person" list="famG" required maxlength="30" value="${esc(d.person || '')}"></label><label class="grow">잰 날<input type="date" class="input" name="date" value="${esc(it?.date || YT.today())}"></label></div>
        <datalist id="famG">${fam.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="evf-row"><label class="grow">키 (cm)<input type="number" step="0.1" min="20" max="230" class="input" name="height" value="${d.height ?? ''}"></label><label class="grow">몸무게 (kg)<input type="number" step="0.1" min="1" max="200" class="input" name="weight" value="${d.weight ?? ''}"></label></div>
        <label class="block">메모<input class="input" name="note" maxlength="200" value="${esc(d.note || '')}" placeholder="예) 학교 신체검사"></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`);
      const fm = m.el.querySelector('form');
      fm.onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(fm)); try { await save(it?.id, 'growth', { person: v.person.trim(), height: v.height, weight: v.weight, note: v.note }, v.date); YT.store.set('yt_growth_who', v.person.trim()); m.close(); YT.toast('성장 기록을 남겼어요.'); growth(box); } catch (err) { YT.err(err); } };
    };
    box.querySelector('#grAdd').onclick = () => form(null);
    box.querySelector('#grFirst').onclick = async () => { if (!YT.house.milestoneForm) await timeline(document.createElement('div')); YT.house.after = () => growth(box); YT.house.milestoneForm(null, { type: 'first', person: who, emoji: '' }); };
    box.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); if (ed) return form(recs.find((x) => x.id === ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl && YT.confirm('이 기록을 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); growth(box); } catch (err) { YT.err(err); } }
    };
  }

  // ───────── 레시피북 ('요리' 분류 기사)
  // ───────── 장보기 목록: 고른 레시피의 ‘■ 재료’를 모아 같은 재료끼리 합친다
  const ingredientsOf = (a) => {
    const text = (a.blocks || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('\n\n');
    const out = []; let on = false;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (/^■/.test(line)) { on = /재료/.test(line); continue; }
      if (!on) continue;
      if (!line) { if (out.length) on = false; continue; }
      const t = line.replace(/^[-·•*▪︎]\s*/, '').trim(); if (!t) continue;
      for (const part of t.split(/\s*[,，]\s*/)) {
        const m = /^(.+?)\s+((?:[\d½¼¾⅓.\/~-]|약간|조금|적당|한\s|두\s|세\s|반\s|한\S|두\S|세\S).*)$/.exec(part);
        out.push(m ? { name: m[1].trim(), amt: m[2].trim() } : { name: part.trim(), amt: '' });
      }
    }
    return out.filter((x) => x.name);
  };
  function shopping(arts) {
    const key = 'yt_shop'; const load = () => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } };
    const st = { pick: [], got: [], extra: [], ...load() }; const save2 = () => { try { localStorage.setItem(key, JSON.stringify(st)); } catch {} };
    st.pick = st.pick.filter((id) => arts.some((a) => a.id === id));
    const m = YT.modal(`<h2 class="modal-title">장보기 목록</h2>
      <p class="muted small">요리를 고르면 레시피의 <b>‘■ 재료’</b>를 모아 같은 재료끼리 합쳐 줘요. 장 보면서 하나씩 체크하세요. (이 기기에 저장)</p>
      <div class="chips sh-pick" id="shPick">${arts.map((a) => `<button type="button" class="chip" data-id="${a.id}">${esc(a.title)}</button>`).join('')}</div>
      <div id="shList" class="sh-list"></div>
      <form class="evf-row sh-add" id="shAdd"><input class="input grow" name="t" maxlength="40" placeholder="더 살 것 (예: 우유)"><button class="btn small">더하기</button></form>
      <div class="row gap end"><button type="button" class="btn" id="shClear">체크 모두 지우기</button><button type="button" class="btn" id="shCopy">글로 복사</button><button type="button" class="btn primary" id="shPrint">인쇄</button></div>`, { wide: true });
    const merged = () => {
      const map = new Map();
      for (const id of st.pick) { const a = arts.find((x) => x.id === id); if (!a) continue;
        for (const g of ingredientsOf(a)) { const k = g.name.replace(/\s+/g, ''); const cur = map.get(k) || { name: g.name, parts: [] }; cur.parts.push({ amt: g.amt, from: a.title }); map.set(k, cur); } }
      for (const t of st.extra) { const k = t.replace(/\s+/g, ''); if (!map.has(k)) map.set(k, { name: t, parts: [], extra: true }); }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    };
    const draw = () => {
      m.el.querySelectorAll('#shPick .chip').forEach((c) => c.classList.toggle('on', st.pick.includes(c.dataset.id)));
      const list = merged(); const none = st.pick.filter((id) => !ingredientsOf(arts.find((a) => a.id === id)).length).map((id) => arts.find((a) => a.id === id).title);
      m.el.querySelector('#shList').innerHTML = (list.length ? `<ul>${list.map((g) => { const k = g.name.replace(/\s+/g, ''); const got = st.got.includes(k);
          return `<li class="${got ? 'done' : ''}"><label><input type="checkbox" data-k="${esc(k)}" ${got ? 'checked' : ''}><b>${esc(g.name)}</b></label><small>${g.parts.map((p) => `${p.amt ? esc(p.amt) + ' ' : ''}<i>${esc(p.from)}</i>`).join(' + ')}${g.extra ? '<button type="button" class="linklike danger" data-x="' + esc(g.name) + '">빼기</button>' : ''}</small></li>`; }).join('')}</ul>
          <p class="muted small">${list.length}가지 · 산 것 ${list.filter((g) => st.got.includes(g.name.replace(/\s+/g, ''))).length}가지</p>` : '<p class="muted small">위에서 요리를 골라 주세요.</p>')
        + (none.length ? `<p class="muted small">‘${none.map(esc).join('’, ‘')}’에는 ‘■ 재료’ 칸이 없어 목록에 넣지 못했어요.</p>` : '');
    };
    m.el.querySelector('#shPick').onclick = (e) => { const c = e.target.closest('[data-id]'); if (!c) return; const id = c.dataset.id; st.pick = st.pick.includes(id) ? st.pick.filter((x) => x !== id) : [...st.pick, id]; save2(); draw(); };
    m.el.querySelector('#shList').onchange = (e) => { const c = e.target.closest('[data-k]'); if (!c) return; st.got = c.checked ? [...new Set([...st.got, c.dataset.k])] : st.got.filter((x) => x !== c.dataset.k); save2(); draw(); };
    m.el.querySelector('#shList').onclick = (e) => { const x = e.target.closest('[data-x]'); if (x) { st.extra = st.extra.filter((t) => t !== x.dataset.x); save2(); draw(); } };
    m.el.querySelector('#shAdd').onsubmit = (e) => { e.preventDefault(); const t = e.target.t.value.trim(); if (t) { st.extra = [...new Set([...st.extra, t])]; e.target.t.value = ''; save2(); draw(); } };
    m.el.querySelector('#shClear').onclick = () => { st.got = []; save2(); draw(); };
    const asText = () => merged().map((g) => `□ ${g.name}${g.parts.length ? ' — ' + g.parts.map((p) => p.amt || p.from).filter(Boolean).join(' + ') : ''}`).join('\n');
    m.el.querySelector('#shCopy').onclick = async () => { try { await navigator.clipboard.writeText('장보기 목록\n' + asText()); YT.toast('복사했어요. 카카오톡·메모에 붙여 넣으세요.'); } catch { YT.toast('복사하지 못했어요.', 'error'); } };
    m.el.querySelector('#shPrint').onclick = () => {
      const w = document.createElement('div'); w.className = 'sh-printout'; w.innerHTML = `<h1>장보기 목록</h1><p>${st.pick.map((id) => esc(arts.find((a) => a.id === id)?.title || '')).join(' · ')}</p><ul>${merged().map((g) => `<li>□ <b>${esc(g.name)}</b> ${g.parts.map((p) => esc(p.amt)).filter(Boolean).join(' + ')}</li>`).join('')}</ul>`;
      document.body.appendChild(w); document.body.classList.add('print-shop');
      const done = () => { document.body.classList.remove('print-shop'); w.remove(); removeEventListener('afterprint', done); };
      addEventListener('afterprint', done); window.print(); setTimeout(() => { if (document.body.classList.contains('print-shop')) done(); }, 1500);
    };
    draw();
  }
  async function recipes(box) {
    const arts = (await YT.getArticles(false, true).catch(() => [])).filter((a) => a.category === '요리');
    const S = YT.state.settings;
    const body = (a) => (a.blocks || []).filter((b) => b.type !== 'audio').map((b) => (b.type === 'photo' ? (b.photo ? `<figure class="bk-fig"><img src="${YT.photoUrl(b.photo)}" alt="" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : '')
      : (b.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => /^■/.test(p) ? `<h4 class="rc-h">${esc(p.split('\n')[0].replace(/^■\s*/, ''))}</h4>${p.split('\n').slice(1).length ? `<p>${YT.nl2br(p.split('\n').slice(1).join('\n'))}</p>` : ''}` : `<p>${YT.nl2br(p)}</p>`).join(''))).join('');
    box.innerHTML = `<div class="hs-bar"><p class="muted small">기사를 쓸 때 분류를 <b>‘요리’</b>로 고르면 레시피 틀이 들어가고 여기에 모여요.</p>
        <div class="row gap">${YT.can('reporter') ? '<a class="btn small primary" href="#/write?category=%EC%9A%94%EB%A6%AC">+ 레시피 쓰기</a>' : ''}<button class="btn small" id="rcShop" ${arts.length ? '' : 'disabled'}>장보기 목록</button><button class="btn small" id="rcPrint" ${arts.length ? '' : 'disabled'}>레시피북 인쇄 · PDF</button></div></div>
      ${arts.length ? `<div class="rc-grid">${arts.map((a) => `<a class="rc-card" href="#/article/${a.id}">${a.photo ? `<img src="${YT.thumbUrl(a.photo)}" alt="" loading="lazy">` : '<span class="rc-ph"></span>'}<b>${esc(a.title)}</b><small>${esc(a.author_name)} · ${esc(YT.shortDate(a.published_at || a.updated))}</small></a>`).join('')}</div>`
        : '<div class="empty-state"><h2>첫 레시피를 기다려요</h2><p>할머니의 김치찌개, 아빠의 주말 볶음밥… 우리 집 손맛을 기사로 남겨 보세요.</p></div>'}
      <div class="book-wrap rc-book" id="rcBook" hidden><div class="book"><section class="bk-cover"><div class="bk-ear"><span>${esc(S.site_name)}</span><span>우리 집 레시피북</span></div><h1 class="bk-name" style="font-size:72px">우리 집<br>레시피북</h1><div class="bk-cover-ph empty"></div><div class="bk-stats"><div><b>${arts.length}</b><span>가지 요리</span></div></div></section>
        <section class="bk-toc"><h2>차례</h2><ol>${arts.map((a) => `<li><span>${esc(a.title)}</span><small>${esc(a.author_name)}</small></li>`).join('')}</ol></section>
        ${arts.map((a) => `<section class="bk-month"><article class="bk-art"><div class="np-kicker">레시피</div><h3>${esc(a.title)}</h3><div class="np-byline">${esc(a.author_name)}</div>${a.photo ? `<figure class="bk-fig lead"><img src="${YT.photoUrl(a.photo)}" alt="" loading="lazy"></figure>` : ''}<div class="bk-body">${body(a)}</div></article></section>`).join('')}
        <footer class="bk-end"><b>${esc(S.site_name)}</b><span>우리 집 레시피북</span></footer></div></div>`;
    const sb = box.querySelector('#rcShop'); if (sb) sb.onclick = () => shopping(arts);
    const pb = box.querySelector('#rcPrint'); if (pb) pb.onclick = () => {
      const bk = box.querySelector('#rcBook'); bk.hidden = false; const sz = document.getElementById('pageSize') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pageSize' }));
      sz.textContent = '@page { size: A4 portrait; margin: 14mm 14mm 16mm; }'; document.body.classList.add('print-book');
      const imgs = [...bk.querySelectorAll('img')]; imgs.forEach((i) => { i.loading = 'eager'; });
      Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => {
        const done = () => { document.body.classList.remove('print-book'); bk.hidden = true; removeEventListener('afterprint', done); };
        addEventListener('afterprint', done); window.print(); setTimeout(() => { if (document.body.classList.contains('print-book')) done(); }, 1500);
      });
    };
  }

  // ───────── 여행 지도
  async function map(box) {
    const arts = (await YT.getArticles().catch(() => [])).filter((a) => a.place);
    const stopsOf = (a) => (a.places && a.places.length ? a.places : [a.place]);
    const focus = YT.query().focus;
    box.innerHTML = `<div class="hs-bar"><p class="muted small">기사를 쓸 때 오른쪽 ‘장소’에서 고르면 여기에 핀이 꽂혀요. ${arts.length}곳</p></div>
      <div class="mp-wrap"><div class="mp-map" id="mpMap"><p class="muted small">지도를 불러오는 중…</p></div>
      <ol class="mp-list">${arts.map((a) => `<li><button data-go="${a.id}"><b>${esc(a.place.name)}</b><small>${esc(a.title)} · ${esc(YT.shortDate(a.published_at || a.updated))}</small></button></li>`).join('') || '<li class="muted">아직 장소가 들어간 기사가 없어요.</li>'}</ol></div>`;
    try {
      const L = await YT.loadLeaflet(); const el = box.querySelector('#mpMap'); el.innerHTML = '';
      const mp = L.map(el).setView([36.4, 127.8], 7); tiles(L, mp); const marks = {};
      for (const a of arts) { const st = stopsOf(a); if (st.length > 1) { L.polyline(st.map((p) => [p.lat, p.lng]), { color: '#3B4C7A', weight: 2.5, opacity: 0.6, dashArray: '6 6' }).addTo(mp); st.slice(1).forEach((p) => L.circleMarker([p.lat, p.lng], { radius: 6, color: '#3B4C7A', weight: 2, fillOpacity: 0.85, fillColor: '#fff' }).addTo(mp).bindTooltip(esc(p.name))); } }
      for (const a of arts) marks[a.id] = L.marker([a.place.lat, a.place.lng]).addTo(mp).bindPopup(`<div class="mp-pop">${a.photo ? `<img src="${YT.thumbUrl(a.photo)}" alt="">` : ''}<b>${esc(a.place.name)}</b><a href="#/article/${a.id}">${esc(a.title)}</a><small>${esc(YT.shortDate(a.published_at || a.updated))}</small></div>`);
      if (arts.length) mp.fitBounds(L.latLngBounds(arts.flatMap((a) => stopsOf(a).map((p) => [p.lat, p.lng]))).pad(0.3), { maxZoom: 12 });
      const go = (id) => { const a = arts.find((x) => x.id === id); if (!a) return; mp.setView([a.place.lat, a.place.lng], 13); marks[id].openPopup(); };
      if (focus) setTimeout(() => go(focus), 300);
      box.querySelector('.mp-list').onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
      setTimeout(() => mp.invalidateSize(), 200);
    } catch (err) { box.querySelector('#mpMap').innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  }

  // ───────── 버킷리스트
  async function bucket(box) {
    const r = await items('bucket'); const f = YT.store.get('yt_bk_filter', 'todo');
    const list = r.items.filter((b) => (f === 'all' ? true : f === 'done' ? b.data.done : !b.data.done));
    const done = r.items.filter((b) => b.data.done).length;
    box.innerHTML = `<div class="hs-bar"><div class="chips" id="bkF">${[['todo', `해 볼 것 ${r.items.length - done}`], ['done', `이룬 것 ${done}`], ['all', '전체']].map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-f="${v}">${l}</button>`).join('')}</div><button class="btn primary small" id="bkAdd">+ 하고 싶은 일</button></div>
      ${r.items.length ? `<div class="bk-progress" aria-label="달성률"><i style="width:${Math.round(done / r.items.length * 100)}%"></i><span>${done} / ${r.items.length} 이룸</span></div>` : ''}
      <ul class="bucket">${list.map((b) => `<li class="${b.data.done ? 'done' : ''}"><label class="bk-check"><input type="checkbox" data-done="${b.id}" ${b.data.done ? 'checked' : ''}></label>
        <div class="grow"><b>${esc(b.data.title)}</b><small>${esc(b.data.who || '')}${b.data.note ? ' · ' + esc(b.data.note) : ''}${b.data.done ? ` · ${fmtD(b.updated.slice(0, 10))} 이룸` : ''}</small></div>
        <span class="bk-act">${b.data.done && YT.can('reporter') ? `<a class="btn tiny" href="#/write?title=${encodeURIComponent('버킷리스트 달성! ' + b.data.title)}&category=${encodeURIComponent('일상')}">기사로 쓰기</a>` : ''}${b.can_edit ? `<button class="linklike" data-edit="${b.id}">고치기</button>${delBtn(b)}` : ''}</span></li>`).join('') || `<li class="muted">${f === 'done' ? '아직 이룬 일이 없어요. 하나씩 해 봐요!' : '가족이 함께 해 보고 싶은 일을 적어 보세요.'}</li>`}</ul>`;
    box.querySelector('#bkF').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { YT.store.set('yt_bk_filter', b.dataset.f); bucket(box); } };
    const form = (it) => {
      const d = it ? it.data : {};
      const m = YT.modal(`<h2 class="modal-title">${it ? '버킷리스트 고치기' : '하고 싶은 일 더하기'}</h2><form class="form"><label class="block">무엇을<input class="input" name="title" required maxlength="80" value="${esc(d.title || '')}" placeholder="예) 온 가족 한라산 오르기"></label>
        <div class="evf-row"><label class="grow">누가<input class="input" name="who" maxlength="60" value="${esc(d.who || '온 가족')}"></label><input type="hidden" name="emoji" value="${esc(d.emoji || '')}"></div>
        <label class="block">메모<input class="input" name="note" maxlength="300" value="${esc(d.note || '')}"></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`);
      const fm = m.el.querySelector('form');
      fm.onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(fm)); try { await save(it?.id, 'bucket', { ...v, done: !!d.done }); m.close(); bucket(box); } catch (err) { YT.err(err); } };
    };
    box.querySelector('#bkAdd').onclick = () => form(null);
    box.onchange = async (e) => {
      const c = e.target.closest('[data-done]'); if (!c) return;
      try { await YT.put('/api/items/' + c.dataset.done, { quick: true, data: { done: c.checked } }); if (c.checked) YT.toast('축하해요! ‘기사로 쓰기’로 이야기를 남겨 보세요.'); bucket(box); } catch (err) { YT.err(err); c.checked = !c.checked; }
    };
    box.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); if (ed) return form(r.items.find((x) => x.id === ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl && YT.confirm('이 항목을 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); bucket(box); } catch (err) { YT.err(err); } }
    };
  }

  // ───────── 집안일 당번 (매주 월요일에 다음 사람으로)
  async function chores(box) {
    const r = await items('chore'); const today = r.today || YT.today();
    const mon = (w) => { const d = new Date(today + 'T00:00:00Z'); const dow = d.getUTCDay(); return YT.addDays(today, -((dow + 6) % 7) + 7 * w); };
    box.innerHTML = `<div class="hs-bar"><p class="muted small">매주 월요일마다 다음 사람에게 넘어가요. 월요일에 알림으로 알려줘요.</p><button class="btn primary small" id="chAdd">+ 집안일 더하기</button></div>
      ${r.items.length ? `<div class="table-wrap ch-wrap"><table class="table ch-table"><thead><tr><th>집안일</th>${[0, 1, 2, 3].map((w) => `<th class="${w ? '' : 'now'}">${w ? fmtD(mon(w)).slice(5) + ' 주' : '이번 주'}</th>`).join('')}<th></th></tr></thead>
        <tbody>${r.items.map((c) => `<tr><th>${esc(c.data.name)}<small>${c.data.members.map(esc).join(' → ')}</small></th>${(r.assign[c.id] || []).map((n, w) => `<td class="${w ? '' : 'now'}">${n === YT.state.user?.display_name ? `<b class="me">${esc(n)}</b>` : esc(n)}</td>`).join('')}<td>${c.can_edit ? `<button class="linklike" data-edit="${c.id}">고치기</button>${delBtn(c)}` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state"><h2>당번표가 아직 없어요</h2><p>설거지, 분리수거, 화분 물 주기처럼 돌아가며 할 일을 정해 보세요.</p></div>'}`;
    const form = async (it) => {
      const fam = await family(); const d = it ? it.data : { members: [], start: mon(0), emoji: '' };
      let mem = [...d.members];
      const m = YT.modal(`<h2 class="modal-title">${it ? '당번 고치기' : '집안일 더하기'}</h2><form class="form"><div class="evf-row"><label class="grow">집안일<input class="input" name="name" required maxlength="40" value="${esc(d.name || '')}" placeholder="예) 설거지"></label><input type="hidden" name="emoji" value="${esc(d.emoji || '')}"></div>
        <div class="block"><span class="evf-lbl">돌아가며 맡을 사람 (순서대로 눌러요)</span><div class="chips" id="chMem">${fam.map((n) => `<button type="button" class="chip" data-m="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          <div class="evf-row"><input class="input grow" id="chOther" placeholder="다른 이름" maxlength="30"><button type="button" class="btn small" id="chOtherAdd">더하기</button></div><p class="ch-order" id="chOrder"></p></div>
        <label class="block">시작하는 주(월요일)<input type="date" class="input" name="start" value="${esc(d.start || mon(0))}"></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`);
      const paint = () => { m.el.querySelector('#chOrder').innerHTML = mem.length ? mem.map((n, i) => `<span>${i + 1}. ${esc(n)} <button type="button" class="linklike" data-rm="${i}">×</button></span>`).join(' → ') : '<span class="muted small">아직 아무도 없어요.</span>'; m.el.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', mem.includes(b.dataset.m))); };
      paint();
      m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { const n = b.dataset.m; mem = mem.includes(n) ? mem.filter((x) => x !== n) : [...mem, n]; paint(); } const rm = e.target.closest('[data-rm]'); if (rm) { mem.splice(+rm.dataset.rm, 1); paint(); } });
      m.el.querySelector('#chOtherAdd').onclick = () => { const v = m.el.querySelector('#chOther').value.trim(); if (v && !mem.includes(v)) mem.push(v); m.el.querySelector('#chOther').value = ''; paint(); };
      const fm = m.el.querySelector('form');
      fm.onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(fm)); try { await save(it?.id, 'chore', { name: v.name, emoji: v.emoji, start: v.start, members: mem }); m.close(); chores(box); } catch (err) { YT.err(err); } };
    };
    box.querySelector('#chAdd').onclick = () => form(null);
    box.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); if (ed) return form(r.items.find((x) => x.id === ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl && YT.confirm('이 집안일을 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); chores(box); } catch (err) { YT.err(err); } }
    };
  }

  // ───────── 가족회의
  // ───────── 행사 준비함: 준비물 체크 + 비용 나누기
  const PREP_TPL = {
    '생신 잔치': ['식당 예약', '케이크', '선물', '꽃다발', '사진 찍을 사람', '모시러 갈 차'],
    '가족 여행': ['숙소 예약', '교통편', '여행자 보험', '상비약', '충전기', '여행 일정표'],
    '명절·차례': ['장보기', '전 부치기', '차례상 준비', '세뱃돈 봉투', '선물 세트'],
    '이사': ['이삿짐 업체', '전입 신고', '인터넷 이전', '청소', '도시가스 연결'],
  };
  const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR') + '원';
  // 누가 누구에게 얼마를 보내면 되는지 (같은 몫으로 나눌 때)
  const settle = (members, costs) => {
    const names = [...new Set([...(members || []), ...costs.map((c) => c.who)])].filter(Boolean);
    const total = costs.reduce((a, c) => a + c.amount, 0); if (!names.length || !total) return { total, share: 0, rows: [], moves: [] };
    const share = total / names.length;
    const rows = names.map((n) => { const paid = costs.filter((c) => c.who === n).reduce((a, c) => a + c.amount, 0); return { n, paid, bal: paid - share }; });
    const cred = rows.filter((r) => r.bal > 0.5).map((r) => ({ ...r })), debt = rows.filter((r) => r.bal < -0.5).map((r) => ({ ...r, bal: -r.bal }));
    const moves = [];
    for (const d of debt) for (const c of cred) { if (d.bal < 0.5) break; const x = Math.min(d.bal, c.bal); if (x < 0.5) continue; moves.push({ from: d.n, to: c.n, amt: Math.round(x / 10) * 10 }); d.bal -= x; c.bal -= x; }
    return { total, share, rows, moves };
  };
  async function prep(box) {
    const r = await items('prep'); const today = YT.today();
    const list = r.items.sort((a, b) => ((a.date < today) - (b.date < today)) || (a.date < today ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    const card = (it) => {
      const d = it.data; const ck = d.checklist || []; const done = ck.filter((x) => x.done).length; const st = settle(d.members, d.costs || []);
      return `<article class="pp-card ${it.date < today ? 'past' : ''}"><header><div><small>${fmtD(it.date)} · ${it.date === today ? '오늘' : it.date > today ? 'D-' + YT.dayDiff(today, it.date) : '지난 행사'}${d.place ? ' · ' + esc(d.place) : ''}</small><h3>${esc(d.title)}</h3>
          ${(d.members || []).length ? `<p class="muted small">함께: ${d.members.map(esc).join(', ')}</p>` : ''}</div>${it.can_edit ? `<span><button class="linklike" data-edit="${it.id}">고치기</button> ${delBtn(it)}</span>` : ''}</header>
        <div class="pp-cols">
          <section><h4>준비물·할 일 <small>${done}/${ck.length}</small></h4>${ck.length ? `<div class="pp-bar"><i style="width:${ck.length ? Math.round(done / ck.length * 100) : 0}%"></i></div><ul class="pp-ck">${ck.map((x, i) => `<li class="${x.done ? 'done' : ''}"><label><input type="checkbox" data-ck="${it.id}:${i}" ${x.done ? 'checked' : ''}><span>${esc(x.text)}</span></label>${x.who ? `<small>${esc(x.who)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">아직 없어요.</p>'}</section>
          <section><h4>비용 나누기 <small>${won(st.total)}</small></h4>${(d.costs || []).length ? `<table class="pp-cost"><tbody>${d.costs.map((c) => `<tr><td>${esc(c.who)}</td><td>${esc(c.what)}</td><td class="num">${won(c.amount)}</td></tr>`).join('')}</tbody></table>
            <p class="pp-share">${st.rows.length}명이 똑같이 나누면 1인당 <b>${won(st.share)}</b></p>
            ${st.moves.length ? `<ul class="pp-moves">${st.moves.map((m) => `<li><b>${esc(m.from)}</b> → <b>${esc(m.to)}</b> <span>${won(m.amt)}</span></li>`).join('')}</ul>` : '<p class="muted small">정산할 돈이 없어요.</p>'}` : '<p class="muted small">낸 돈을 적으면 누가 누구에게 얼마를 보내면 되는지 계산해 줘요.</p>'}</section>
        </div>${d.note ? `<p class="pp-note">${YT.nl2br(esc(d.note))}</p>` : ''}</article>`;
    };
    box.innerHTML = `<div class="hs-bar"><p class="muted small">생신·여행·명절처럼 준비할 게 많은 행사를 함께 챙겨요. 체크는 가족 누구나 할 수 있어요.</p><button class="btn primary small" id="ppAdd">+ 행사 준비 시작</button></div>
      ${list.length ? list.map(card).join('') : '<div class="empty-state"><h2>다가오는 행사가 있나요?</h2><p>할머니 생신, 가족 여행, 명절 준비… 준비물과 비용을 한곳에서 나눠요.</p></div>'}`;
    const form = async (it, preset = {}) => {
      const d = it ? it.data : { members: [], checklist: [], costs: [], ...preset };
      let ck = (d.checklist || []).map((x) => ({ ...x })), cs = (d.costs || []).map((x) => ({ ...x }));
      const fam = await family();
      const m = YT.modal(`<h2 class="modal-title">${it ? '행사 준비 고치기' : '행사 준비 시작'}</h2><form class="form" id="ppForm">
        ${it ? '' : `<div class="chips pp-tpl">${Object.keys(PREP_TPL).map((k) => `<button type="button" class="chip" data-tpl="${esc(k)}">${esc(k)}</button>`).join('')}</div>`}
        <div class="evf-row"><label class="grow">행사 이름<input class="input" name="title" required maxlength="80" value="${esc(d.title || '')}" placeholder="예) 할머니 팔순 잔치"></label><label>날짜<input class="input" type="date" name="date" required value="${esc(it ? it.date : d.date || '')}"></label></div>
        <div class="evf-row"><label class="grow">장소<input class="input" name="place" maxlength="80" value="${esc(d.place || '')}"></label><label class="grow">함께 나눌 사람 <small class="muted">(쉼표로)</small><input class="input" name="members" maxlength="300" value="${esc((d.members || []).join(', '))}" placeholder="아빠, 엄마, 큰삼촌"></label></div>
        <div class="block"><span class="evf-lbl">준비물·할 일</span><div id="ckRows"></div><button type="button" class="btn small" id="ckAdd">+ 더하기</button></div>
        <div class="block"><span class="evf-lbl">낸 돈</span><div id="csRows"></div><button type="button" class="btn small" id="csAdd">+ 낸 돈 적기</button></div>
        <datalist id="famP">${fam.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <label class="block">메모<textarea class="input" name="note" rows="2" maxlength="600">${esc(d.note || '')}</textarea></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`, { wide: true });
      const ckR = m.el.querySelector('#ckRows'), csR = m.el.querySelector('#csRows'), fm = m.el.querySelector('#ppForm');
      const sync = () => {
        ckR.querySelectorAll('.ck-row').forEach((row, i) => { ck[i] = { ...ck[i], text: row.querySelector('[data-k=text]').value, who: row.querySelector('[data-k=who]').value }; });
        csR.querySelectorAll('.cs-row').forEach((row, i) => { cs[i] = { who: row.querySelector('[data-k=who]').value, what: row.querySelector('[data-k=what]').value, amount: Number(String(row.querySelector('[data-k=amount]').value).replace(/[^\d]/g, '')) || 0 }; });
      };
      const paint = () => {
        ckR.innerHTML = ck.map((x, i) => `<div class="ck-row evf-row"><input class="input grow" data-k="text" maxlength="100" value="${esc(x.text || '')}" placeholder="준비할 것"><input class="input" data-k="who" list="famP" maxlength="30" value="${esc(x.who || '')}" placeholder="맡을 사람" style="max-width:8rem"><button type="button" class="btn small ghost" data-rmc="${i}" aria-label="빼기">빼기</button></div>`).join('');
        csR.innerHTML = cs.map((x, i) => `<div class="cs-row evf-row"><input class="input" data-k="who" list="famP" maxlength="30" value="${esc(x.who || '')}" placeholder="낸 사람" style="max-width:8rem"><input class="input grow" data-k="what" maxlength="80" value="${esc(x.what || '')}" placeholder="어디에"><input class="input" data-k="amount" inputmode="numeric" value="${x.amount || ''}" placeholder="금액(원)" style="max-width:8rem"><button type="button" class="btn small ghost" data-rms="${i}" aria-label="빼기">빼기</button></div>`).join('');
      };
      paint();
      m.el.querySelector('#ckAdd').onclick = () => { sync(); ck.push({ text: '', who: '', done: false }); paint(); ckR.querySelector('.ck-row:last-child input').focus(); };
      m.el.querySelector('#csAdd').onclick = () => { sync(); cs.push({ who: '', what: '', amount: 0 }); paint(); csR.querySelector('.cs-row:last-child input').focus(); };
      ckR.onclick = (e) => { const b = e.target.closest('[data-rmc]'); if (b) { sync(); ck.splice(+b.dataset.rmc, 1); paint(); } };
      csR.onclick = (e) => { const b = e.target.closest('[data-rms]'); if (b) { sync(); cs.splice(+b.dataset.rms, 1); paint(); } };
      const tp = m.el.querySelector('.pp-tpl'); if (tp) tp.onclick = (e) => { const b = e.target.closest('[data-tpl]'); if (!b) return; sync(); const have = new Set(ck.map((x) => x.text)); PREP_TPL[b.dataset.tpl].forEach((t) => { if (!have.has(t)) ck.push({ text: t, who: '', done: false }); }); if (!fm.title.value) fm.title.value = b.dataset.tpl; paint(); };
      fm.onsubmit = async (e) => {
        e.preventDefault(); sync(); const v = Object.fromEntries(new FormData(fm));
        const data = { title: v.title, place: v.place, note: v.note, members: v.members.split(/[,，]/).map((x) => x.trim()).filter(Boolean), checklist: ck.filter((x) => (x.text || '').trim()), costs: cs.filter((x) => x.who && x.amount) };
        try { await save(it?.id, 'prep', data, v.date); m.close(); prep(box); } catch (err) { YT.err(err); }
      };
    };
    box.querySelector('#ppAdd').onclick = () => form(null);
    box.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); if (ed) return form(r.items.find((x) => x.id === ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl && YT.confirm('이 행사 준비를 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); prep(box); } catch (err) { YT.err(err); } }
    };
    box.onchange = async (e) => {
      const c = e.target.closest('[data-ck]'); if (!c) return; const [id, idx] = c.dataset.ck.split(':'); const it = r.items.find((x) => x.id === id);
      const checklist = it.data.checklist.map((x, i) => ({ ...x, done: i === +idx ? c.checked : x.done }));
      try { await YT.put('/api/items/' + id, { quick: true, data: { checklist } }); it.data.checklist = checklist; prep(box); } catch (err) { YT.err(err); c.checked = !c.checked; }
    };
  }

  async function meeting(box) {
    const r = await items('meeting');
    box.innerHTML = `<div class="hs-bar"><p class="muted small">안건과 정한 일을 남기면, 정한 일은 ‘한눈에’의 할 일로 이어져요.</p><button class="btn primary small" id="mtAdd">+ 회의록 쓰기</button></div>
      ${r.items.map((mt) => `<article class="mt-card"><header><small>${fmtD(mt.date)}${mt.data.attendees ? ' · ' + esc(mt.data.attendees) : ''}</small><h3>${esc(mt.data.title)}</h3>${mt.can_edit ? `<span><button class="linklike" data-edit="${mt.id}">고치기</button>${delBtn(mt)}</span>` : ''}</header>
        ${mt.data.agenda ? `<div class="mt-sec"><h4>안건</h4><p>${YT.nl2br(esc(mt.data.agenda))}</p></div>` : ''}
        ${(mt.data.decisions || []).length ? `<div class="mt-sec"><h4>정한 일</h4><ul class="mt-dec">${mt.data.decisions.map((d, i) => `<li class="${d.done ? 'done' : ''}"><label><input type="checkbox" data-dec="${mt.id}:${i}" ${d.done ? 'checked' : ''}> ${esc(d.text)}</label><small>${esc(d.owner || '')}${d.due ? ' · ' + fmtD(d.due) + '까지' : ''}</small></li>`).join('')}</ul></div>` : ''}
        ${mt.data.notes ? `<div class="mt-sec"><h4>메모</h4><p>${YT.nl2br(esc(mt.data.notes))}</p></div>` : ''}</article>`).join('') || '<div class="empty-state"><h2>첫 가족회의를 열어 볼까요?</h2><p>겨울방학 계획, 용돈 규칙, 여행지 정하기… 함께 정한 일을 기록해 두면 잊지 않아요.</p></div>'}`;
    const form = async (it) => {
      const d = it ? it.data : { decisions: [] }; let decs = (d.decisions || []).map((x) => ({ ...x }));
      const fam = await family();
      const m = YT.modal(`<h2 class="modal-title">${it ? '회의록 고치기' : '가족회의 회의록'}</h2><form class="form"><div class="evf-row"><label class="grow">회의 이름<input class="input" name="title" required maxlength="80" value="${esc(d.title || '')}" placeholder="예) 겨울방학 계획 회의"></label><label>날짜<input type="date" class="input" name="date" value="${esc(it?.date || YT.today())}"></label></div>
        <label class="block">참석<input class="input" name="attendees" maxlength="120" value="${esc(d.attendees || '')}" placeholder="아빠, 엄마, 윤서"></label>
        <label class="block">안건<textarea class="input" name="agenda" rows="3" maxlength="2000">${esc(d.agenda || '')}</textarea></label>
        <div class="block"><span class="evf-lbl">정한 일</span><div id="decRows"></div><button type="button" class="btn small" id="decAdd">+ 정한 일 더하기</button></div>
        <datalist id="famM">${fam.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <label class="block">메모<textarea class="input" name="notes" rows="2" maxlength="2000">${esc(d.notes || '')}</textarea></label>
        <div class="row gap end"><button type="button" class="btn" data-close>취소</button><button class="btn primary">저장</button></div></form>`, { wide: true });
      const rows = m.el.querySelector('#decRows');
      const sync = () => { rows.querySelectorAll('.dec-row').forEach((row, i) => { decs[i] = { ...decs[i], text: row.querySelector('[data-k=text]').value, owner: row.querySelector('[data-k=owner]').value, due: row.querySelector('[data-k=due]').value }; }); };
      const paint = () => { rows.innerHTML = decs.map((x, i) => `<div class="dec-row evf-row"><input class="input grow" data-k="text" maxlength="200" value="${esc(x.text || '')}" placeholder="정한 일"><input class="input" data-k="owner" list="famM" maxlength="30" value="${esc(x.owner || '')}" placeholder="맡은 사람" style="max-width:8rem"><input type="date" class="input" data-k="due" value="${esc(x.due || '')}" style="max-width:10rem"><button type="button" class="btn tiny ghost" data-rmd="${i}" aria-label="빼기">×</button></div>`).join(''); };
      paint();
      m.el.querySelector('#decAdd').onclick = () => { sync(); decs.push({ text: '', owner: '', due: '', done: false }); paint(); rows.querySelector('.dec-row:last-child input').focus(); };
      rows.onclick = (e) => { const b = e.target.closest('[data-rmd]'); if (b) { sync(); decs.splice(+b.dataset.rmd, 1); paint(); } };
      const fm = m.el.querySelector('form');
      fm.onsubmit = async (e) => { e.preventDefault(); sync(); const v = Object.fromEntries(new FormData(fm)); try { await save(it?.id, 'meeting', { title: v.title, attendees: v.attendees, agenda: v.agenda, notes: v.notes, decisions: decs.filter((x) => (x.text || '').trim()) }, v.date); m.close(); meeting(box); } catch (err) { YT.err(err); } };
    };
    box.querySelector('#mtAdd').onclick = () => form(null);
    box.onchange = async (e) => {
      const c = e.target.closest('[data-dec]'); if (!c) return; const [id, idx] = c.dataset.dec.split(':'); const mt = r.items.find((x) => x.id === id);
      const decisions = mt.data.decisions.map((d, i) => ({ ...d, done: i === +idx ? c.checked : d.done }));
      try { await YT.put('/api/items/' + id, { quick: true, data: { title: mt.data.title, decisions } }); mt.data.decisions = decisions; c.closest('li').classList.toggle('done', c.checked); } catch (err) { YT.err(err); c.checked = !c.checked; }
    };
    box.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); if (ed) return form(r.items.find((x) => x.id === ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl && YT.confirm('이 회의록을 지울까요?')) { try { await YT.del('/api/items/' + dl.dataset.del); meeting(box); } catch (err) { YT.err(err); } }
    };
  }

  // ───────── 기자단 · 배지
  const BADGES = [
    ['first', '', '첫 기사', '기사 1편 발행', (s) => s.articles, 1], ['ten', '', '열 번째 기사', '기사 10편', (s) => s.articles, 10], ['thirty', '', '베테랑 기자', '기사 30편', (s) => s.articles, 30],
    ['photo', '', '사진 기자', '기사 사진 10장', (s) => s.photos, 10], ['corner', '', '코너 탐험가', '코너 4곳에 기사', (s) => s.sections.length, 4], ['hot', '', '인기 기자', '반응 20개 받기', (s) => s.reactions, 20],
    ['talk', '', '댓글 요정', '댓글 10개', (s) => s.comments, 10], ['note', '', '한마디꾼', '오늘의 한마디 10번', (s) => s.notes, 10], ['post', '', '우체부', '카드·편지 3장', (s) => s.cards, 3],
  ];
  YT.BADGES = BADGES;
  YT.badgesOf = (s) => BADGES.map(([id, ic, name, desc, f, goal]) => ({ id, ic, name, desc, goal, have: Math.min(f(s), goal), got: f(s) >= goal }));
  async function reporters(box) {
    const y = YT.store.get('yt_rep_year', '');
    const r = await YT.api('/api/reporter-stats' + (y ? '?year=' + y : ''));
    const thisY = YT.today().slice(0, 4);
    const ranked = r.stats.slice().sort((a, b) => b.articles - a.articles || b.photos - a.photos);
    box.innerHTML = `<div class="hs-bar"><div class="chips" id="rpY">${[['', '전체 기간'], [thisY, thisY + '년']].map(([v, l]) => `<button class="chip ${y === v ? 'on' : ''}" data-y="${v}">${l}</button>`).join('')}</div><a class="btn small" href="#/print-year/${thisY}">${thisY} 시상식 보기 (합본호)</a></div>
      <div class="rp-grid">${ranked.map((s) => { const bs = YT.badgesOf(s); const got = bs.filter((b) => b.got); return `<article class="rp-card"><header><b>${esc(s.name)}</b><small>${esc(s.role_label || '')}</small><span class="rp-n">${got.length}<small>/${bs.length}</small></span></header>
        <div class="rp-stats"><span><b>${s.articles}</b>기사</span><span><b>${s.photos}</b>사진</span><span><b>${s.comments}</b>댓글</span><span><b>${s.reactions}</b>반응</span></div>
        <ul class="badges">${bs.map((b) => `<li class="${b.got ? 'got' : ''}" title="${esc(b.desc)}${b.got ? ' · 받음' : ` · ${b.have}/${b.goal}`}"><b class="bd-ic">${b.got ? '받음' : `${b.have}/${b.goal}`}</b><small>${esc(b.name)}</small>${b.got ? '' : `<i style="--p:${Math.round(b.have / b.goal * 100)}%"></i>`}</li>`).join('')}</ul></article>`; }).join('') || '<p class="muted">아직 기록이 없어요.</p>'}</div>`;
    box.querySelector('#rpY').onclick = (e) => { const b = e.target.closest('[data-y]'); if (b) { YT.store.set('yt_rep_year', b.dataset.y); reporters(box); } };
  }

  YT.house = {};
  // 화면 틀: 제목 + 같은 메뉴 탭 + 내용
  const mount = (title, desc, group, fn, needReader = true) => async (view) => {
    if (needReader && !YT.can('subscriber')) return YT.needLogin(view, '가족 계정으로 로그인하면 볼 수 있어요.');
    view.className = 'container';
    view.innerHTML = YT.subTabs(group) + YT.pageHead('', title, desc) + '<div id="houseBox" class="house-box"><p class="muted">불러오는 중…</p></div>';
    const on = view.querySelector('.sub-tabs a.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    try { await fn(view.querySelector('#houseBox')); } catch (err) { view.querySelector('#houseBox').innerHTML = `<div class="empty-state"><p>${esc(err.message || '불러오지 못했어요.')}</p></div>`; }
  };
  const TODO = { chores, meeting, bucket, prep };
  YT.addRoute('/todo', mount('할 일', '집안일 당번, 가족회의에서 정한 일, 함께 해 보고 싶은 일을 한곳에서 챙겨요.', 'todo', overview));
  YT.addRoute('/todo/:tab', async (view, params) => (TODO[params.tab] ? mount('할 일', '집안일 당번, 가족회의에서 정한 일, 함께 해 보고 싶은 일을 한곳에서 챙겨요.', 'todo', TODO[params.tab])(view) : YT.go('#/todo')));
  YT.addRoute('/growth', mount('가족 앨범', '가족 한 사람 한 사람의 이야기 — 인물, 자라는 모습, 우리 가족의 큰일을 모았어요.', 'album', growth));
  YT.addRoute('/timeline', mount('가족 앨범', '가족 한 사람 한 사람의 이야기 — 인물, 자라는 모습, 우리 가족의 큰일을 모았어요.', 'album', timeline));
  YT.addRoute('/recipes', mount('기사', '우리 가족 신문에 실린 기사를 모아 보는 곳이에요.', 'articles', recipes, false));
  YT.addRoute('/map', mount('기사', '우리 가족 신문에 실린 기사를 모아 보는 곳이에요.', 'articles', map, false));
  YT.addRoute('/reporters', mount('기자단', '가족 기자들의 기록과 배지. 연말 합본호에는 시상식이 실려요.', 'desk', reporters, false));
  // 예전 주소(우리 집)로 들어오면 새 자리로
  const OLD = { overview: '#/todo', chores: '#/todo/chores', meeting: '#/todo/meeting', bucket: '#/todo/bucket', growth: '#/growth', timeline: '#/timeline', recipes: '#/recipes', map: '#/map', reporters: '#/reporters' };
  YT.addRoute('/house', () => location.replace('#/todo'));
  YT.addRoute('/house/:tab', (view, params) => { const q = location.hash.split('?')[1]; location.replace((OLD[params.tab] || '#/todo') + (q ? '?' + q : '')); });
})();
