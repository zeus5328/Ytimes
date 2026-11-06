/* 사진관 — 앨범 만들기 (관리자 전용) */
(function () {
  'use strict';
  const { esc } = YT;
  const TEMPLATES = YT.ALBUM_TEMPLATES, PAPERS = YT.ALBUM_PAPERS;
  const blank = () => ({ id: null, title: '우리 가족의 순간들', subtitle: '', template: 'classic', paper: 'ivory', items: [] });

  YT.addRoute('/studio', async (view) => {
    if (!YT.can('admin')) {
      view.innerHTML = YT.subTabs('studio') + YT.pageHead('', '사진관', '가족 사진을 고르고 나만의 앨범으로 엮는 공간입니다. 사진 보관·앨범 제작은 관리자 전용입니다.')
        + `<div class="empty-state"><h2>관리자 전용 공간이에요</h2><p>원본 사진과 앨범은 관리자만 볼 수 있습니다.</p>${YT.state.user ? '' : `<a class="btn primary" href="#/login?next=${encodeURIComponent('#/studio')}">로그인</a>`}</div>`;
      return;
    }
    let data = await YT.api('/api/studio');
    let album = blank();
    const reload = async () => { data = await YT.api('/api/studio'); draw(); };

    const draw = () => {
      const sel = new Set(album.items.map((i) => i.photo));
      const tkey = YT.albumKey(album.template); album.template = tkey;
      const pages = YT.renderAlbumPages(album, { sample: !album.items.length });
      view.innerHTML = YT.subTabs('studio') + YT.pageHead('', '가족의 순간을 한 권으로', '사진을 선택하고 템플릿을 고른 뒤, 설명과 순서를 다듬어 앨범을 출력해보세요. 원본과 앨범은 관리자만 볼 수 있습니다.',
        `<button class="btn primary" id="importBtn">사진 가져오기</button><input type="file" id="stFile" accept="image/*" multiple hidden>`)
        + `<ol class="flow small"><li><b>1</b>사진 선택</li><li><b>2</b>디자인·종이 고르기</li><li><b>3</b>설명·순서 조정</li><li><b>4</b>저장·출력</li></ol>
        <details class="help"><summary>클라우드·외부 폴더에서 가져오기</summary>
          <p>기기의 파일 선택기에 iCloud·Google 포토·네이버 MYBOX 등이 연결되어 있다면 ‘사진 가져오기’에서 해당 위치를 고르세요. 웹하드 등은 사진을 내려받은 뒤 선택할 수 있습니다. 계정 자동 연동이나 동기화 기능은 포함되지 않습니다.</p>
          <p class="muted small">자주 쓰는 폴더 링크를 저장해두세요. 저장한 링크는 관리자에게만 표시됩니다. (최대 8개)</p>
          <div class="links">${data.links.map((l) => `<span class="link-chip"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a><button class="linklike danger" data-rmlink="${l.id}" aria-label="제거">제거</button></span>`).join('')}</div>
          <form class="form-row" id="linkForm"><label>폴더 이름<input class="input" name="name" placeholder="가족 공유 폴더"></label><label class="grow">폴더 주소<input class="input" name="url" placeholder="https://"></label><button class="btn small">링크 저장</button></form>
        </details>
        <section class="st-sec"><div class="side-head"><h2>사진 보관함</h2><span class="muted small">${data.photos.length}장 · ${sel.size}장 선택 · 한 장당 10MB, 한 번에 최대 30장. HEIC는 JPG로 변환해주세요.</span></div>
          ${data.photos.length ? `<div class="st-grid">${data.photos.map((p) => `<div class="st-ph ${sel.has(p.id) ? 'on' : ''}"><button class="st-pick" data-pick="${p.id}" aria-pressed="${sel.has(p.id)}"><img src="${YT.thumbUrl(p.id)}" loading="lazy" alt=""><span class="st-check">${sel.has(p.id) ? album.items.findIndex((i) => i.photo === p.id) + 1 : ''}</span></button>
            <button class="st-del" data-delph="${p.id}" aria-label="삭제">삭제</button></div>`).join('')}</div>`
            : '<div class="empty-state small">첫 사진을 가져와보세요<br><span class="muted">기기의 사진 또는 클라우드에서 내려받은 파일을 선택할 수 있어요.</span></div>'}
        </section>
        <section class="st-sec"><div class="side-head"><h2>앨범 디자인</h2><span class="muted small">표지 + 속지 배치가 템플릿마다 달라요</span></div>
          <div class="al-pick">${Object.entries(TEMPLATES).map(([k, v]) => `<button class="al-tp ${tkey === k ? 'on' : ''}" data-tpl="${k}" aria-pressed="${tkey === k}">
            <span class="al-tp-pages">${YT.renderAlbumPages({ ...album, template: k, items: album.items.slice(0, v.per) }, { sample: true, limit: 2, photoUrl: YT.thumbUrl }).join('')}</span>
            <b>${v.name}</b><small>${v.desc}</small></button>`).join('')}</div>
          <div class="block mt"><span>종이 색</span><div class="seg-btns">${Object.entries(PAPERS).map(([k, l]) => `<button class="chip sw pp-${k} ${album.paper === k ? 'on' : ''}" data-paper="${k}">${l}</button>`).join('')}</div></div>
          <div class="form-row mt"><label class="grow">앨범 제목<input class="input" id="alTitle" maxlength="60" value="${esc(album.title)}"></label>
            <label class="grow">부제 · 날짜<input class="input" id="alSub" maxlength="80" value="${esc(album.subtitle || '')}" placeholder="2026년 가을, 할머니 생신"></label>
            <button class="btn small" id="autoSub" type="button">사진 날짜로 채우기</button></div>
        </section>
        <section class="st-sec"><div class="side-head"><h2>선택한 사진 · 설명과 순서</h2><button class="btn small" id="newAlbum">새 앨범</button></div>
          ${album.items.length ? `<ol class="sel-list">${album.items.map((it, i) => `<li><img src="${YT.thumbUrl(it.photo)}" alt=""><div class="grow"><div class="muted small">${i + 1}번째 사진</div>
            <input class="input" data-cap="${i}" value="${esc(it.caption)}" placeholder="이 순간의 이야기를 적어주세요"></div>
            <div class="sel-btns"><select class="select sm" data-fit="${i}" aria-label="사진 채우기"><option value="cover" ${it.fit !== 'contain' ? 'selected' : ''}>틀에 꽉 채우기</option><option value="contain" ${it.fit === 'contain' ? 'selected' : ''}>원본 전체 보기</option></select>
            <button class="btn small" data-up="${i}">위로</button><button class="btn small" data-down="${i}">아래로</button><button class="btn small danger ghost" data-out="${i}">빼기</button></div></li>`).join('')}</ol>`
            : '<p class="muted">보관함에서 사진을 선택해보세요.</p>'}
        </section>
        <section class="st-sec"><div class="side-head"><h2>앨범 미리보기</h2><span class="muted small">A4 세로 · 표지 + ${Math.ceil(album.items.length / TEMPLATES[tkey].per)}쪽</span></div>
          <div class="album-preview" id="albumPrint">${pages.join('')}</div>
          <div class="row gap end"><button class="btn" id="printAlbum">인쇄 · PDF 저장</button><button class="btn primary" id="saveAlbum">앨범 저장</button></div>
          <p class="muted small">출력 창에서 용지 A4 · 세로, 배율 100%, ‘배경 그래픽’ 켜기, 머리글·바닥글 끄기를 선택하세요.</p>
        </section>
        ${(data.months || []).length ? `<section class="st-sec"><div class="side-head"><h2>달마다 모인 기사 사진</h2><span class="muted small">발행된 기사의 사진이 저절로 모여요</span></div>
          <div class="auto-albums">${data.months.map((m) => `<div class="aa-item"><div class="aa-strip">${m.photos.slice(0, 5).map((p) => `<img src="${YT.thumbUrl(p.photo)}" alt="" loading="lazy">`).join('')}</div>
            <div class="aa-meta"><b>${esc(YT.monthLabel(m.month))}호</b><small class="muted">${m.photos.length}장</small><button class="btn small" data-auto="${m.month}">이 달 사진으로 앨범 만들기</button></div></div>`).join('')}</div>
        </section>` : ''}
        <section class="st-sec"><div class="side-head"><h2>저장한 앨범</h2><span class="muted small">${data.albums.length}권</span></div>
          ${data.albums.length ? `<div class="album-shelf">${data.albums.map((a) => `<div class="al-book">
            <button class="al-book-cover" data-open="${a.id}" aria-label="${esc(a.title)} 열기">${YT.renderAlbumPages(a, { limit: 1, photoUrl: YT.thumbUrl })[0]}</button>
            <b>${esc(a.title)}</b><small class="muted">${a.items.length}장 · ${esc(TEMPLATES[YT.albumKey(a.template)].name)} · ${esc(YT.shortDate(a.updated))}</small>
            <div class="row gap"><button class="btn small" data-open="${a.id}">열기</button><button class="btn small danger ghost" data-delal="${a.id}">삭제</button></div></div>`).join('')}</div>`
            : '<p class="muted">완성한 앨범을 저장하면 책장처럼 여기에 꽂혀요. 다시 열어 고치거나 출력할 수 있어요.</p>'}
        </section>`;
      bind();
    };
    const bind = () => {
      YT.$('#importBtn').onclick = () => YT.$('#stFile').click();
      YT.$('#stFile').onchange = async (e) => {
        const files = [...e.target.files]; e.target.value = '';
        if (files.length > 30) return YT.toast('한 번에 최대 30장까지 가져올 수 있어요.', 'error');
        const photos = [];
        for (let i = 0; i < files.length; i++) {
          YT.toast(`사진 가져오는 중 ${i + 1}/${files.length}`);
          try { const img = await YT.readImage(files[i], 2400, 0.88); photos.push(img); } catch (err) { YT.toast(`${files[i].name}: ${err.message}`, 'error'); }
        }
        if (!photos.length) return;
        try {
          { const step = YT.state.settings && YT.state.settings.cloud ? 1 : 3; for (let i = 0; i < photos.length; i += step) await YT.post('/api/studio/photos', { photos: photos.slice(i, i + step) }); }
          YT.toast(`${photos.length}장의 사진을 가져왔습니다.`); reload();
        } catch (err) { YT.err(err); }
      };
      YT.$('#linkForm').onsubmit = async (e) => { e.preventDefault(); try { await YT.post('/api/folder-links', Object.fromEntries(new FormData(e.target))); reload(); } catch (err) { YT.err(err); } };
      const refreshPreview = YT.debounce(() => { YT.$('#albumPrint').innerHTML = YT.renderAlbumPages(album, { sample: !album.items.length }).join(''); }, 200);
      YT.$('#alTitle').oninput = (e) => { album.title = e.target.value; refreshPreview(); };
      YT.$('#alSub').oninput = (e) => { album.subtitle = e.target.value; refreshPreview(); };
      YT.$('#autoSub').onclick = () => {
        const ds = album.items.map((it) => data.photos.find((p) => p.id === it.photo)?.taken).filter(Boolean).sort();
        if (!ds.length) return YT.toast('사진 날짜 정보가 없어요. 직접 적어주세요.', 'error');
        const f = (d) => d.replace(/-/g, '. ') + '.';
        album.subtitle = ds[0] === ds[ds.length - 1] ? f(ds[0]) : `${f(ds[0])} – ${f(ds[ds.length - 1])}`; draw();
      };
      view.onclick = async (e) => {
        const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
        try {
          if (d.pick) { const i = album.items.findIndex((x) => x.photo === d.pick); if (i >= 0) album.items.splice(i, 1); else { if (album.items.length >= 60) return YT.toast('앨범은 최대 60장까지 선택할 수 있어요.', 'error'); album.items.push({ photo: d.pick, caption: '', fit: 'cover' }); } draw(); }
          else if (d.delph) { if (!YT.confirm('사진 보관함에서 이 사진을 삭제할까요?')) return; await YT.del('/api/studio/photos/' + d.delph); album.items = album.items.filter((x) => x.photo !== d.delph); reload(); }
          else if (d.tpl) { album.template = d.tpl; draw(); }
          else if (d.paper) { album.paper = d.paper; draw(); }
          else if (d.up !== undefined) { const i = +d.up; if (i > 0) [album.items[i - 1], album.items[i]] = [album.items[i], album.items[i - 1]]; draw(); }
          else if (d.down !== undefined) { const i = +d.down; if (i < album.items.length - 1) [album.items[i + 1], album.items[i]] = [album.items[i], album.items[i + 1]]; draw(); }
          else if (d.out !== undefined) { album.items.splice(+d.out, 1); draw(); }
          else if (d.rmlink) { if (!YT.confirm('이 폴더 바로가기를 제거할까요? 원본 폴더는 삭제되지 않습니다.')) return; await YT.del('/api/folder-links/' + d.rmlink); reload(); }
          else if (d.open) { const a = data.albums.find((x) => x.id === d.open); album = { ...blank(), ...JSON.parse(JSON.stringify(a)) }; draw(); YT.$('#albumPrint').scrollIntoView({ behavior: 'smooth' }); YT.toast(`‘${album.title}’ 앨범을 열었어요.`); }
          else if (d.delal) { if (!YT.confirm('이 앨범을 삭제할까요? 사진 원본은 보관함에 남습니다.')) return; await YT.del('/api/albums/' + d.delal); if (album.id === d.delal) album.id = null; reload(); }
          else if (d.auto) {
            const m = (data.months || []).find((x) => x.month === d.auto); if (!m) return;
            if (album.items.length && !YT.confirm('지금 고른 사진을 비우고 이 달 사진으로 새 앨범을 만들까요?')) return;
            album = { ...blank(), title: `${YT.monthLabel(m.month)}의 우리 가족`, subtitle: `${YT.state.settings.site_name} ${YT.monthLabel(m.month)}호에서`, items: m.photos.slice(0, 60).map((p) => ({ photo: p.photo, caption: p.caption || '', fit: 'cover' })) };
            draw(); YT.toast(`${m.photos.length}장으로 앨범을 채웠어요. 디자인을 고르고 저장하세요.`); YT.$('#albumPrint')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          else if (t.id === 'newAlbum') { if (album.items.length && !YT.confirm('현재 선택을 비우고 새 앨범을 만들까요? 저장하지 않은 변경은 사라집니다.')) return; album = blank(); draw(); }
          else if (t.id === 'saveAlbum') { if (!album.items.length) return YT.toast('사진을 먼저 선택해주세요.', 'error'); const r = await YT.post('/api/albums', album); album.id = r.id; YT.toast('앨범을 저장했습니다.'); reload(); }
          else if (t.id === 'printAlbum') { document.body.classList.add('print-album'); window.print(); setTimeout(() => document.body.classList.remove('print-album'), 500); }
        } catch (err) { YT.err(err); }
      };
      view.oninput = (e) => { if (e.target.dataset.cap !== undefined) { album.items[+e.target.dataset.cap].caption = e.target.value; } };
      view.onchange = (e) => { if (e.target.dataset.fit !== undefined) { album.items[+e.target.dataset.fit].fit = e.target.value; draw(); } else if (e.target.dataset.cap !== undefined) YT.$('#albumPrint').innerHTML = YT.renderAlbumPages(album).join(''); };
    };
    draw();
  });
})();
