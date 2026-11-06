/* 우체국 — 편지·카드 */
(function () {
  'use strict';
  const { esc } = YT;
  const TYPES = YT.CARD_TYPES;
  const COLORS = YT.CARD_COLORS;

  YT.addRoute('/post', async (view) => {
    const { cards } = await YT.api('/api/cards');
    let tab = '전체';
    const draw = () => {
      const list = cards.filter((c) => tab === '전체' || (tab === 'capsule' ? c.open_on : c.type === tab));
      const env = (c) => `<div class="capsule-env ${c.locked ? '' : 'open'}"><span class="ce-seal" aria-hidden="true"></span><b>타임캡슐</b><small>${c.to_name ? esc(c.to_name) + '에게 · ' : ''}${esc(c.open_on.replace(/-/g, '.'))} 열림</small>${c.locked ? `<em>D-${c.days_left.toLocaleString()}</em>` : ''}<small>${esc(c.from_name || '')} · ${esc(YT.shortDate(c.created))} 봉인</small></div>`;
      view.innerHTML = YT.pageHead('', '마음을 전하는 우체국', '생일과 기념일, 크리스마스와 새해 인사부터 마음을 담은 편지까지.',
        YT.can('reporter') ? '<a class="btn primary" href="#/post/write">편지·카드 쓰기</a>' : '')
        + `<div class="post-types">${Object.entries(TYPES).map(([k, t]) => `<a class="pt" href="${YT.can('reporter') ? `#/post/write?type=${k}` : '#/login'}"><b>${t.name}</b><small>디자인 고르고 작성하기 →</small></a>`).join('')}
          <a class="pt capsule" href="${YT.can('reporter') ? '#/post/write?type=letter&capsule=1' : '#/login'}"><b>타임캡슐</b><small>정한 날에 열리는 편지 →</small></a></div>
        <div class="chips">${['전체', ...Object.keys(TYPES), 'capsule'].map((k) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${k === '전체' ? '전체' : k === 'capsule' ? '타임캡슐' : TYPES[k].name}</button>`).join('')}</div>
        ${list.length ? `<div class="card-wall">${list.map((c) => `<div class="cw-item">
          <button class="cw-open" data-view="${c.id}" aria-label="카드 크게 보기">${c.locked ? env(c) : YT.renderCard(c, { small: true })}</button>
          <div class="cw-meta"><span class="status ${c.is_public ? 's-published' : 's-draft'}">${c.is_public ? '공개됨' : '비공개 초안'}</span>${c.open_on && !c.locked ? '<span class="status s-approved">열린 타임캡슐</span>' : ''}
          ${c.is_own || YT.can('admin') ? `${c.locked ? '' : `<a class="linklike" href="#/post/write/${c.id}">수정</a>`}<button class="linklike" data-pub="${c.id}">${c.is_public ? '공개 취소' : '공개하기'}</button><button class="linklike danger" data-delc="${c.id}">삭제</button>` : ''}</div></div>`).join('')}</div>`
          : `<div class="empty-state small">아직 ${YT.state.user ? '저장된' : '공개된'} 카드가 없습니다.</div>`}`;
    };
    // 카드 크게 보기 — 공개 카드는 링크로 보내면 바로 이 카드가 열린다
    const openCard = (c) => {
      if (!c) return;
      if (c.locked) { YT.modal(`<div class="capsule-big"><span class="ce-seal"></span><h2>아직 열 수 없는 타임캡슐이에요</h2><p>${c.to_name ? `<b>${esc(c.to_name)}</b>에게 ` : ''}${esc(c.from_name || '')}이(가) ${esc(YT.shortDate(c.created))}에 봉인했어요.</p><p class="ce-d">${esc(c.open_on.replace(/-/g, '.'))}에 열려요 · D-${c.days_left.toLocaleString()}</p><p class="muted small">그날이 되면 가족에게 알림으로 알려 드려요. 쓴 사람도 그때까지는 내용을 볼 수 없어요.</p></div><div class="row gap end"><button class="btn primary" data-close>닫기</button></div>`); return; }
      YT.modal(`<div class="card-big">${YT.renderCard(c)}</div><div class="row gap end">${c.is_public ? '<button class="btn" id="cardShare">링크 보내기</button>' : '<span class="muted small grow">비공개 카드는 링크로 보낼 수 없어요. 공개하면 보낼 수 있어요.</span>'}<button class="btn" id="cardPrint">인쇄 · PDF</button><button class="btn primary" data-close>닫기</button></div>`, { wide: true });
      YT.$('#cardPrint').onclick = () => { document.body.classList.add('print-card'); window.print(); setTimeout(() => document.body.classList.remove('print-card'), 500); };
      const sh = YT.$('#cardShare'); if (sh) sh.onclick = () => YT.share(`${c.to_name ? c.to_name + '에게 ' : ''}카드가 도착했어요`, location.href.split('#')[0] + '#/post?card=' + c.id);
    };
    draw();
    const want = YT.query().card; if (want) { const c = cards.find((x) => x.id === want); if (c) openCard(c); else YT.toast('카드를 찾을 수 없어요. 비공개이거나 삭제된 카드예요.', 'error'); }
    view.onclick = async (e) => {
      const t = e.target.closest('[data-tab],[data-view],[data-pub],[data-delc]'); if (!t) return;
      try {
        if (t.dataset.tab) { tab = t.dataset.tab; draw(); }
        else if (t.dataset.view) openCard(cards.find((x) => x.id === t.dataset.view));
        else if (t.dataset.pub) { const c = cards.find((x) => x.id === t.dataset.pub); if (!c.is_public && !YT.confirm('이 카드를 모든 방문자에게 공개할까요?')) return; await YT.post(`/api/cards/${c.id}/publish`, { public: !c.is_public }); c.is_public = !c.is_public; draw(); }
        else if (t.dataset.delc) { if (!YT.confirm('이 카드를 목록에서 삭제할까요?')) return; await YT.del('/api/cards/' + t.dataset.delc); cards.splice(cards.findIndex((x) => x.id === t.dataset.delc), 1); draw(); }
      } catch (err) { YT.err(err); }
    };
  });

  async function writer(view, params, q) {
    if (!YT.can('reporter')) return YT.needLogin(view, '카드는 가족 기자 계정으로 쓸 수 있어요.');
    let c;
    if (params.id) { c = (await YT.api('/api/cards')).cards.find((x) => x.id === params.id); if (!c) throw new Error('카드를 찾을 수 없습니다.');
      if (c.locked) { view.innerHTML = YT.pageHead('', '봉인된 타임캡슐', '') + `<div class="empty-state"><h2>${esc(c.open_on)}에 열려요</h2><p>봉인한 타임캡슐은 여는 날까지 고칠 수 없어요.</p><a class="btn" href="#/post">우체국으로</a></div>`; return; } }
    else {
      const type = TYPES[q.type] ? q.type : 'letter';
      c = { type, design: 0, color: 'ivory', to_name: q.to || '', from_name: YT.state.user.display_name, card_date: YT.today(), title: TYPES[type].title, message: TYPES[type].msg, photo: null, open_on: '' };
      if (q.capsule) { c.title = '미래의 너에게'; c.message = '안녕, 미래의 너에게.\n\n이 편지를 쓰는 오늘은 '; c.open_on = YT.addDays(YT.today(), 365); }
    }
    const st = { ...c };
    view.innerHTML = YT.pageHead('', '마음을 담아 카드를 써보세요', '', '<a class="btn" href="#/post">우체국 목록</a>')
      + `<div class="post-editor"><form class="form" id="cardForm">
        <label class="block">카드 종류<div class="seg-btns" id="typeBtns">${Object.entries(TYPES).map(([k, t]) => `<button type="button" class="chip ${st.type === k ? 'on' : ''}" data-type="${k}">${t.name}</button>`).join('')}</div></label>
        <label class="block">디자인 선택<div class="seg-btns" id="designBtns"></div></label>
        <label class="block">색상 선택<div class="seg-btns" id="colorBtns">${Object.entries(COLORS).map(([k, l]) => `<button type="button" class="chip sw sw-${k} ${st.color === k ? 'on' : ''}" data-color="${k}">${l}</button>`).join('')}</div></label>
        <div class="form-row"><label>받는 사람<input class="input" name="to_name" maxlength="30" value="${esc(st.to_name)}" placeholder="엄마"></label>
          <label>보내는 사람<input class="input" name="from_name" maxlength="30" value="${esc(st.from_name)}"></label>
          <label>카드 날짜<input type="date" class="input" name="card_date" value="${esc(st.card_date)}"></label></div>
        <label class="block">제목<input class="input" name="title" maxlength="60" value="${esc(st.title)}"></label>
        <label class="block"><span id="msgLabel"></span><textarea class="input" name="message" rows="7">${esc(st.message)}</textarea><small class="muted" id="msgCount"></small></label>
        <div class="block"><span>나만의 사진 추가 (선택 · 5MB 이하)</span>
          <div class="row gap"><button type="button" class="btn small" id="cPhoto">사진 선택</button><button type="button" class="btn small danger ghost" id="cPhotoRm" ${st.photo ? '' : 'hidden'}>사진 빼기</button><input type="file" id="cFile" accept="image/*" hidden></div>
          <small class="muted">기본 그림에 사진을 더할 수 있어요. 저장만 하면 비공개 초안으로 보관됩니다. 기존 공개 카드를 수정하면 공개 내용도 바뀝니다.</small></div>
        <fieldset class="capsule-set"><label class="check"><input type="checkbox" id="capOn" ${st.open_on ? 'checked' : ''}> <b>타임캡슐로 봉인하기</b></label>
          <div id="capBox" ${st.open_on ? '' : 'hidden'}><div class="row gap"><label>여는 날<input type="date" class="input" name="open_on" min="${YT.addDays(YT.today(), 1)}" value="${esc(st.open_on || '')}"></label>
            <div class="chips">${[['1년 뒤', 365], ['3년 뒤', 365 * 3 + 1], ['5년 뒤', 365 * 5 + 1], ['10년 뒤', 365 * 10 + 2], ['20년 뒤', 365 * 20 + 5]].map(([l, d]) => `<button type="button" class="chip" data-cap="${d}">${l}</button>`).join('')}</div></div>
            <p class="muted small">저장하는 순간 봉인돼요. 여는 날까지는 <b>쓴 사람도</b> 내용을 볼 수 없고 고칠 수도 없어요. 그날 가족에게 알림으로 알려 줘요. 공개로 바꿔 두면 가족 모두가 함께 열어볼 수 있어요.</p></div></fieldset>
        <div class="row gap end"><button class="btn primary">${st.open_on ? '봉인하고 저장' : '카드 저장'}</button></div>
      </form>
      <div class="post-preview"><div class="sec-kicker">실시간 미리보기</div><div id="cPrev"></div></div></div>`;
    const f = YT.$('#cardForm');
    const paint = () => {
      const T = TYPES[st.type];
      YT.$('#designBtns').innerHTML = T.designs.map((d, i) => `<button type="button" class="design-pick ${st.design === i ? 'on' : ''}" data-design="${i}" aria-pressed="${st.design === i}"><span class="dp-thumb">${YT.renderCard({ ...st, design: i, message: '', photo: null, title: '' }, { small: true })}</span><span>${d}</span></button>`).join('');
      YT.$('#msgLabel').textContent = st.type === 'letter' ? '편지 내용 · 최대 5,000자' : '메시지 · 최대 1,500자';
      YT.$('#msgCount').textContent = `${st.message.length.toLocaleString()} / ${T.max.toLocaleString()}자`;
      YT.$('#msgCount').classList.toggle('danger', st.message.length > T.max);
      YT.$('#cPrev').innerHTML = YT.renderCard(st);
      YT.$('#cPhotoRm').hidden = !st.photo;
    };
    paint();
    f.oninput = (e) => { if (e.target.name) { st[e.target.name] = e.target.value; paint(); } };
    f.onclick = (e) => {
      const b = e.target.closest('button[data-type],button[data-design],button[data-color]'); if (!b) return;
      if (b.dataset.type) {
        const prev = TYPES[st.type]; st.type = b.dataset.type; const T = TYPES[st.type];
        if (!st.title || st.title === prev.title) { st.title = T.title; f.title.value = T.title; }
        if (!st.message || st.message === prev.msg) { st.message = T.msg; f.message.value = T.msg; }
        YT.$$('#typeBtns .chip').forEach((x) => x.classList.toggle('on', x === b));
      }
      if (b.dataset.design) st.design = +b.dataset.design;
      if (b.dataset.color) { st.color = b.dataset.color; YT.$$('#colorBtns .chip').forEach((x) => x.classList.toggle('on', x === b)); }
      paint();
    };
    const capSync = () => { const on = YT.$('#capOn').checked; YT.$('#capBox').hidden = !on; if (!on) { st.open_on = ''; f.open_on.value = ''; } else if (!f.open_on.value) { st.open_on = f.open_on.value = YT.addDays(YT.today(), 365); } f.querySelector('button.primary').textContent = on ? '봉인하고 저장' : '카드 저장'; };
    YT.$('#capOn').onchange = capSync;
    YT.$('#capBox').addEventListener('click', (e) => { const b = e.target.closest('[data-cap]'); if (b) { st.open_on = f.open_on.value = YT.addDays(YT.today(), +b.dataset.cap); } });
    YT.$('#cPhoto').onclick = () => YT.$('#cFile').click();
    YT.$('#cFile').onchange = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024 * 3) return YT.toast('5MB 이하 사진을 선택해주세요.', 'error'); try { YT.toast('사진을 올리는 중…'); st.photo = await YT.uploadImage(file, 'card'); paint(); } catch (err) { YT.err(err); } };
    YT.$('#cPhotoRm').onclick = () => { st.photo = null; paint(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (st.message.length > TYPES[st.type].max) return YT.toast(st.type === 'letter' ? '편지는 5,000자까지 저장할 수 있어요.' : '카드는 1,500자까지 저장할 수 있어요. 내용을 줄여주세요.', 'error');
      if (YT.$('#capOn').checked) {
        if (!st.open_on || st.open_on <= YT.today()) return YT.toast('타임캡슐을 여는 날을 내일 이후로 골라 주세요.', 'error');
        if (!YT.confirm(`${st.open_on}까지 봉인할까요? 그날까지는 쓴 사람도 내용을 볼 수 없어요.`)) return;
      } else st.open_on = '';
      try { if (c.id) await YT.put('/api/cards/' + c.id, st); else await YT.post('/api/cards', st); YT.toast(st.open_on ? '타임캡슐을 봉인했어요.' : '카드를 저장했습니다.'); YT.go('#/post'); } catch (err) { YT.err(err); }
    };
  }
  YT.addRoute('/post/write', writer);
  YT.addRoute('/post/write/:id', writer);
})();
