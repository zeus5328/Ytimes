/* 착한 일 — 한 일을 올리면 부모님(시니어기자 이상)이 확인하고 포인트를 준다 */
(function () {
  'use strict';
  const { esc } = YT;
  const P = (n) => Number(n || 0).toLocaleString('ko-KR');
  const when = (s) => (s ? String(s).slice(5, 16).replace('T', ' ').replace('-', '.') : '');
  const STATUS = { pending: ['확인 기다리는 중', 'wait'], approved: ['확인 완료', 'ok'], rejected: ['다시 확인', 'no'] };

  async function page(box) {
    const d = await YT.api('/api/deeds');
    const waiting = d.mine.filter((x) => x.status === 'pending');
    const card = (x, approve) => `<div class="dd-card ${STATUS[x.status][1]}">
        ${x.photo ? `<img class="dd-ph" src="${YT.thumbUrl(x.photo)}" alt="" loading="lazy">` : `<span class="dd-ic" aria-hidden="true">${esc((d.menu.find((m) => m.id === x.menu_id) || {}).icon || '🌟')}</span>`}
        <div class="dd-body"><div class="dd-top">${approve ? `<b class="dd-who">${esc(x.user_name)}</b>` : ''}<b>${esc(x.title)}</b><span class="dd-badge">${STATUS[x.status][0]}</span></div>
          ${x.note ? `<p>${esc(x.note)}</p>` : ''}
          <small class="muted">${when(x.created)}${x.reviewer_name ? ` · ${esc(x.reviewer_name)} 확인` : ''}${x.review_note ? ` · “${esc(x.review_note)}”` : ''}</small></div>
        <div class="dd-side">${approve ? `<label class="dd-pts"><input class="input sm" inputmode="numeric" value="${x.points || 300}" data-pts="${x.id}" aria-label="줄 포인트"><span>P</span></label>
            <button class="btn small primary" data-ok="${x.id}">확인하고 주기</button><button class="btn small ghost" data-no="${x.id}">아직이에요</button>`
          : x.status === 'approved' ? `<b class="dd-plus">+${P(x.points)}P</b>` : x.status === 'pending' ? `<span class="muted small">${x.points ? `+${P(x.points)}P 예정` : '포인트는 확인할 때'}</span><button class="linklike small" data-del="${x.id}">취소</button>` : ''}</div></div>`;
    box.innerHTML = `<section class="g-hero dd-hero"><div class="g-hero-main"><span class="g-eyebrow">GOOD DEEDS</span><h2 class="g-title">오늘 <b>착한 일</b> 했나요?</h2>
        <p class="g-sub">한 일을 올리면 부모님이 확인하고 포인트를 줘요. 하루 ${d.daily}개까지 · 오늘 ${d.today}개 올렸어요</p></div>
        <div class="g-wallet"><span>착한 일로 받은 포인트</span><b>${P(d.earned)}<small>P</small></b><a href="#/points">내 포인트 · 쿠폰 →</a></div></section>
      ${d.approver && d.pending.length ? `<section class="g-panel dd-review"><div class="g-ph"><h3>확인해 줄 착한 일 <span class="dd-count">${d.pending.length}</span></h3><span class="muted small">포인트를 바꿔서 줄 수도 있어요</span></div>
        <div class="dd-list">${d.pending.map((x) => card(x, true)).join('')}</div></section>` : ''}
      <section class="g-panel"><div class="g-ph"><h3>어떤 착한 일을 했나요?</h3><span class="muted small">눌러서 올려요</span></div>
        <div class="dd-menu">${d.menu.filter((m) => m.active).map((m) => `<button class="dd-item" data-menu="${m.id}"><span class="dd-ic" aria-hidden="true">${esc(m.icon || '🌟')}</span><b>${esc(m.title)}</b><small>+${P(m.points)}P</small></button>`).join('')}
          <button class="dd-item free" data-free="1"><span class="dd-ic" aria-hidden="true">✏️</span><b>직접 적기</b><small>포인트는 확인할 때</small></button></div></section>
      ${waiting.length ? `<section class="g-panel"><div class="g-ph"><h3>확인 기다리는 중</h3><span class="muted small">${waiting.length}개</span></div><div class="dd-list">${waiting.map((x) => card(x)).join('')}</div></section>` : ''}
      <section class="g-panel"><div class="g-ph"><h3>내 착한 일 기록</h3></div>
        ${d.mine.filter((x) => x.status !== 'pending').length ? `<div class="dd-list">${d.mine.filter((x) => x.status !== 'pending').map((x) => card(x)).join('')}</div>` : '<p class="muted">아직 기록이 없어요. 오늘 첫 착한 일을 올려 보세요!</p>'}</section>
      ${d.approver && d.recent.length ? `<details class="g-panel g-more"><summary>최근 확인한 착한 일</summary><div class="dd-list">${d.recent.map((x) => card({ ...x }, false).replace('<div class="dd-body"><div class="dd-top">', `<div class="dd-body"><div class="dd-top"><b class="dd-who">${esc(x.user_name)}</b>`)).join('')}</div></details>` : ''}
      ${d.admin ? `<details class="g-panel g-more"><summary>관리자 · 착한 일 목록 고치기</summary>
        <div class="dd-edit">${d.menu.map((m) => `<form class="form-row dd-row" data-row="${m.id}"><label style="max-width:4.5rem">그림<input class="input sm" name="icon" value="${esc(m.icon || '')}" maxlength="8"></label><label class="grow">이름<input class="input sm" name="title" value="${esc(m.title)}" maxlength="30"></label>
          <label style="max-width:7rem">포인트<input class="input sm" name="points" inputmode="numeric" value="${m.points}"></label><label class="check"><input type="checkbox" name="active" ${m.active ? 'checked' : ''}> 보이기</label>
          <button class="btn small">저장</button><button type="button" class="btn small danger ghost" data-rm="${m.id}">지우기</button></form>`).join('')}
          <form class="form-row dd-row" data-row=""><label style="max-width:4.5rem">그림<input class="input sm" name="icon" value="🌟" maxlength="8"></label><label class="grow">새 착한 일<input class="input sm" name="title" maxlength="30" placeholder="예: 신발 정리"></label>
          <label style="max-width:7rem">포인트<input class="input sm" name="points" inputmode="numeric" value="300"></label><button class="btn small primary">추가</button></form></div></details>` : ''}`;

    const submit = (m) => {
      const md = YT.modal(`<h2 class="modal-title">${m ? `${esc(m.icon || '🌟')} ${esc(m.title)}` : '✏️ 착한 일 직접 적기'}</h2>
        <form class="form" id="ddForm">${m ? '' : '<label>무엇을 했나요?<input class="input" name="title" maxlength="40" required placeholder="예: 할머니께 안부 전화"></label>'}
          <label>${m ? '어떻게 했는지 한 줄로 (선택)' : '조금 더 자세히 (선택)'}<textarea class="input" name="note" rows="3" maxlength="300" placeholder="예: 저녁 먹고 그릇을 모두 씻었어요"></textarea></label>
          <div class="block"><span>사진 (선택)</span><div class="row gap"><label class="btn small" for="ddPh">사진 넣기</label><input type="file" id="ddPh" accept="image/*" hidden><span class="muted small" id="ddPhInfo">한 일을 찍어 올리면 확인이 빨라요</span></div></div>
          <p class="muted small">${m ? `부모님이 확인하면 <b>+${P(m.points)}P</b>가 들어와요.` : '포인트는 부모님이 확인하면서 정해 줘요.'}</p>
          <div class="row gap end"><button class="btn primary">올리기</button></div></form>`);
      let photo = '';
      md.el.querySelector('#ddPh').onchange = async (e) => { const info = md.el.querySelector('#ddPhInfo'); info.textContent = '사진 올리는 중…'; try { photo = await YT.uploadImage(e.target.files[0]); info.textContent = '사진을 넣었어요 ✓'; } catch (err) { info.textContent = ''; YT.err(err); } };
      md.el.querySelector('#ddForm').onsubmit = async (e) => {
        e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
        try { await YT.post('/api/deeds', { menu_id: m ? m.id : '', title: f.title, note: f.note, photo }); md.close(); YT.toast('착한 일을 올렸어요! 부모님이 확인해 줄 거예요.'); page(box); } catch (err) { YT.err(err); }
      };
    };
    box.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.menu) submit(d.menu.find((m) => m.id === b.dataset.menu));
        else if (b.dataset.free) submit(null);
        else if (b.dataset.del) { if (!YT.confirm('올린 착한 일을 취소할까요?')) return; await YT.del('/api/deeds/' + b.dataset.del); page(box); }
        else if (b.dataset.ok) { const pts = box.querySelector(`[data-pts="${b.dataset.ok}"]`).value; b.disabled = true; await YT.post(`/api/deeds/${b.dataset.ok}/review`, { action: 'approve', points: pts }); YT.toast(`확인했어요. ${P(pts)}포인트를 줬어요.`); page(box); }
        else if (b.dataset.no) { const note = window.prompt('어떤 점을 다시 확인할까요? (아이에게 보여요)', ''); if (note === null) return; await YT.post(`/api/deeds/${b.dataset.no}/review`, { action: 'reject', note }); YT.toast('다시 확인하도록 알려 줬어요.'); page(box); }
        else if (b.dataset.rm) { if (!YT.confirm('이 착한 일을 목록에서 지울까요?')) return; await YT.del('/api/deed-menu/' + b.dataset.rm); page(box); }
      } catch (err) { YT.err(err); b.disabled = false; }
    };
    box.querySelectorAll('[data-row]').forEach((f) => f.onsubmit = async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(f)); v.active = f.active ? f.active.checked : true;
      try { if (f.dataset.row) await YT.put('/api/deed-menu/' + f.dataset.row, v); else await YT.post('/api/deed-menu', v); YT.toast('저장했어요.'); page(box); } catch (err) { YT.err(err); }
    });
  }

  YT.addRoute('/deeds', async (view) => {
    view.className = 'container';
    if (!YT.state.user) return YT.needLogin(view, '가족 계정으로 로그인하면 착한 일을 올릴 수 있어요.');
    if (!YT.can('reporter')) { view.innerHTML = YT.pageHead('', '착한 일', '착한 일을 하고 포인트를 받아요.') + '<div class="empty-state"><h2>기자 계정에서 할 수 있어요</h2><p class="muted">관리자에게 기자 권한을 부탁해 보세요.</p></div>'; return; }
    view.innerHTML = YT.subTabs('desk') + YT.pageHead('', '착한 일', '집안일을 돕거나 착한 일을 했다면 올려 주세요. 부모님이 확인하면 포인트가 들어와요.') + '<div id="ddBox" class="g-box"><p class="muted">불러오는 중…</p></div>';
    try { await page(view.querySelector('#ddBox')); } catch (err) { view.querySelector('#ddBox').innerHTML = `<div class="empty-state"><p>${esc(err.message || '불러오지 못했어요.')}</p></div>`; }
  });
})();
