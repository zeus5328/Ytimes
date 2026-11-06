/* 원고료 포인트 · 쿠폰 — 기사가 신문에 실리면 원고료(포인트)가 들어오고, 모은 포인트로 가족 쿠폰을 산다 */
(function () {
  'use strict';
  const { esc } = YT;
  const P = (n) => Number(n || 0).toLocaleString('ko-KR');
  const dt = (s) => (s ? String(s).slice(0, 10).replace(/-/g, '.') : '');
  const STATUS = { issued: ['사용 전', 'on'], used: ['사용 완료', 'done'], cancelled: ['취소·환불', 'off'] };

  const ticket = (c, opts = {}) => `<div class="cp-ticket ${opts.cls || ''}">
      <div class="cp-main"><span class="cp-icon" aria-hidden="true">${esc(c.icon || '🎟️')}</span>
        <div class="cp-text"><b>${esc(c.title)}</b>${c.description ? `<small>${esc(c.description)}</small>` : ''}${opts.meta ? `<small class="cp-meta">${opts.meta}</small>` : ''}</div></div>
      <div class="cp-side"><span class="cp-price">${P(c.price)}<small>P</small></span>${opts.action || ''}</div></div>`;

  async function myPage(box) {
    const d = await YT.api('/api/points');
    const issued = d.issues.filter((x) => x.status === 'issued');
    const draw = (data) => {
      const bal = data.balance;
      box.innerHTML = `<div class="pt-hero">
          <div><span class="pt-k">내 포인트</span><b class="pt-bal">${P(bal)}<small>P</small></b>
            <span class="pt-sub">지금까지 받은 포인트 ${P(data.earned)}P · 기사 한 편이 신문에 실리면 <b>${P(data.rate.lead)}P</b>${data.rate.co ? `, 함께 쓴 기자는 <b>${P(data.rate.co)}P</b>` : ''}${data.rate.bonus ? ` (인(人)터뷰·포토제닉은 <b>+${P(data.rate.bonus)}P</b>)` : ''}${data.rate.bday ? ` · 생일에는 <b>${P(data.rate.bday)}P</b> 선물` : ''}${data.rate.card ? ` · 우체국에서 편지·카드를 보내면 <b>${P(data.rate.card)}P</b>` : ''}${data.rate.talk ? ` · 댓글·오늘의 한마디는 <b>${P(data.rate.talk)}P</b>` : ''}</span></div>
          <a class="btn primary" href="#/write">기사 쓰고 원고료 받기</a></div>
        ${issued.length ? `<section class="pt-sec"><div class="side-head"><h2>내 쿠폰</h2><span class="muted small">부모님께 보여 주고 쓰면, 부모님이 ‘사용 완료’를 눌러 줘요</span></div>
          <div class="cp-list">${issued.map((x) => ticket(x, { cls: 'mine', meta: `쿠폰 번호 <code>${esc(x.code)}</code> · ${dt(x.created)} 구입`,
            action: `<button class="btn small ghost" data-cancel="${x.id}">취소하고 환불</button>` })).join('')}</div></section>` : ''}
        <section class="pt-sec"><div class="side-head"><h2>쿠폰 가게</h2><span class="muted small">포인트로 살 수 있는 우리 가족 쿠폰</span></div>
          ${data.coupons.length ? `<div class="cp-list">${data.coupons.map((c) => {
            const soldOut = c.stock >= 0 && c.issued >= c.stock; const limit = c.per_user > 0 && c.mine >= c.per_user; const short = bal < c.price;
            const why = soldOut ? '다 팔렸어요' : limit ? `한 사람 ${c.per_user}장까지` : short ? `${P(c.price - bal)}P 부족` : '';
            const meta = [c.stock >= 0 ? `남은 수량 ${Math.max(0, c.stock - c.issued)}장` : '', c.per_user > 0 ? `1인 ${c.per_user}장` : ''].filter(Boolean).join(' · ');
            return ticket(c, { cls: soldOut || limit || short ? 'dim' : '', meta, action: `<button class="btn small ${why ? '' : 'primary'}" data-buy="${c.id}" ${why ? 'disabled' : ''}>${why || '사기'}</button>` });
          }).join('')}</div>` : '<div class="empty-state small">아직 쿠폰이 없어요. 관리자가 ‘쿠폰 관리’에서 만들 수 있어요.</div>'}</section>
        <section class="pt-sec"><div class="side-head"><h2>포인트 기록</h2></div>
          ${data.history.length ? `<ul class="pt-hist">${data.history.map((h) => `<li><span class="pt-when">${dt(h.created)}</span><span class="pt-why">${h.kind === 'article' ? `<a href="#/article/${esc(h.ref)}">${esc(h.reason)}</a>` : esc(h.reason)}</span><b class="${h.amount > 0 ? 'plus' : 'minus'}">${h.amount > 0 ? '+' : ''}${P(h.amount)}</b></li>`).join('')}</ul>`
            : '<div class="empty-state small">아직 기록이 없어요. 첫 기사가 실리면 원고료가 들어와요!</div>'}</section>
        ${data.issues.some((x) => x.status !== 'issued') ? `<details class="pt-sec help"><summary>지난 쿠폰 보기</summary><div class="cp-list">${data.issues.filter((x) => x.status !== 'issued').map((x) => ticket(x, { cls: 'past', meta: `${STATUS[x.status][0]} · ${dt(x.used_at || x.created)}` })).join('')}</div></details>` : ''}`;
    };
    draw(d);
    box.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.buy) {
          const c = d.coupons.find((x) => x.id === b.dataset.buy);
          if (!YT.confirm(`‘${c.title}’ 쿠폰을 ${P(c.price)}포인트로 살까요?`)) return;
          b.disabled = true; const r = await YT.post(`/api/coupons/${c.id}/buy`, {});
          YT.toast(`쿠폰을 샀어요! 쿠폰 번호 ${r.issue.code}`); myPage(box);
        } else if (b.dataset.cancel) {
          if (!YT.confirm('이 쿠폰을 취소하고 포인트를 돌려받을까요?')) return;
          await YT.post(`/api/coupon-issues/${b.dataset.cancel}`, { action: 'cancel' }); YT.toast('쿠폰을 취소하고 포인트를 돌려받았어요.'); myPage(box);
        }
      } catch (err) { YT.err(err); b.disabled = false; }
    };
  }

  async function managePage(box) {
    if (!YT.can('admin')) { box.innerHTML = '<div class="empty-state"><h2>관리자만 볼 수 있어요</h2></div>'; return; }
    const d = await YT.api('/api/points');
    const memberOpts = d.members.map((m) => `<option value="${m.id}">${esc(m.display_name)} (${P(m.balance)}P)</option>`).join('');
    box.innerHTML = `${d.unpaid ? `<div class="pt-backpay"><div><b>원고료를 아직 못 받은 기사가 ${d.unpaid}편 있어요</b><small>원고료 기능이 생기기 전에 신문에 실린 기사들이에요.</small></div><button class="btn primary" id="backpay">지난 기사 원고료 한꺼번에 주기</button></div>` : ''}
      <section class="pt-sec"><div class="side-head"><h2>사용할 쿠폰</h2><span class="muted small">가족이 쿠폰을 보여 주면 확인하고 ‘사용 완료’를 눌러 주세요</span></div>
        ${d.pending.length ? `<div class="cp-list">${d.pending.map((x) => ticket(x, { cls: 'mine', meta: `<b>${esc(x.user_name)}</b> · 번호 <code>${esc(x.code)}</code> · ${dt(x.created)} 구입`,
          action: `<div class="row gap"><button class="btn small primary" data-use="${x.id}">사용 완료</button><button class="btn small ghost" data-cancel="${x.id}">취소·환불</button></div>` })).join('')}</div>`
          : '<p class="muted">지금 사용 기다리는 쿠폰이 없어요.</p>'}</section>
      <section class="pt-sec"><div class="side-head"><h2>가족 기자 포인트</h2></div>
        <table class="table pt-members"><thead><tr><th>기자</th><th>원고료 받은 기사</th><th>포인트</th></tr></thead><tbody>${d.members.map((m) => `<tr><th>${esc(m.display_name)} <small class="muted">${esc(YT.ROLES[m.role] ? YT.ROLES[m.role].split(' · ')[0] : '')}</small></th><td>${m.articles}편</td><td><b>${P(m.balance)}P</b></td></tr>`).join('')}</tbody></table>
        <form class="form-row mt" id="grantForm"><label>누구에게<select class="select" name="user_id">${memberOpts}</select></label>
          <label>포인트<input class="input" name="amount" inputmode="numeric" placeholder="500 또는 -500" required></label>
          <label class="grow">까닭<input class="input" name="reason" maxlength="80" placeholder="예: 가족회의 기록 보너스"></label>
          <button class="btn">주기 · 빼기</button></form></section>
      <section class="pt-sec"><div class="side-head"><h2>원고료</h2></div>
        <form class="form-row" id="rateForm"><label>기사 한 편 (대표 기자)<input class="input" name="lead" inputmode="numeric" value="${d.rate.lead}"></label>
          <label>함께 쓴 기자 (한 사람당)<input class="input" name="co" inputmode="numeric" value="${d.rate.co}"></label>
          <label>생일 축하 포인트<input class="input" name="bday" inputmode="numeric" value="${d.rate.bday}"></label>
          <label>편지·카드 한 장<input class="input" name="card" inputmode="numeric" value="${d.rate.card}"></label>
          <label>댓글 · 오늘의 한마디<input class="input" name="talk" inputmode="numeric" value="${d.rate.talk}"></label>
          <label>인(人)터뷰·포토제닉 더 주기<input class="input" name="bonus" inputmode="numeric" value="${d.rate.bonus}"></label><button class="btn">저장</button></form>
        <p class="muted small">원고료는 기사가 <b>처음 신문에 실릴 때</b> 한 번만 들어가요. 내렸다가 다시 실어도 또 주지 않아요.</p>
      </section>
      <section class="pt-sec"><div class="side-head"><h2>생일 축하 포인트</h2><span class="muted small">생일날 사이트에 들어오면 ${P(d.rate.bday)}P가 한 번 들어가요 (생일 뒤 30일 안에 들어와도 받아요)</span></div>
        <table class="table pt-members"><thead><tr><th>가족 계정</th><th>찾은 생일 일정</th><th>다음 생일</th></tr></thead><tbody>${(d.birthdays || []).map((b) => `<tr><th>${esc(b.display_name)}</th><td>${b.title ? esc(b.title) : '<span class="muted">못 찾았어요</span>'}</td><td>${b.next ? dt(b.next) : '—'}</td></tr>`).join('')}</tbody></table>
        <p class="muted small">일정 › 생일·기념일에 있는 생일 제목에 <b>계정 이름</b>(예: ‘엄마 생일(김은지)’)이 들어 있으면 그 생일로 줘요. ‘못 찾았어요’라면 생일 제목에 이름을 넣어 주세요. 0으로 저장하면 생일 포인트를 주지 않아요.</p>
      </section>
      <section class="pt-sec"><div class="side-head"><h2>매달 포인트</h2><span class="muted small">정한 가족에게 달마다 한 번 — 그 달에 처음 사이트에 들어오면 들어가요</span></div>
        <table class="table pt-members"><thead><tr><th>가족 계정</th><th>매달 주는 포인트</th><th></th></tr></thead><tbody>${(d.birthdays || []).map((b) => `<tr><th>${esc(b.display_name)}</th><td><input class="input sm" style="max-width:8rem;text-align:right" inputmode="numeric" data-mon="${b.id}" value="${b.monthly || ''}" placeholder="0"> P</td><td><button class="btn small" data-monsave="${b.id}">저장</button></td></tr>`).join('')}</tbody></table>
        <p class="muted small">비우거나 0으로 저장하면 매달 포인트를 주지 않아요.</p>
</section>
      <section class="pt-sec"><div class="side-head"><h2>쿠폰 만들기 · 고치기</h2><button class="btn small" data-new>새 쿠폰</button></div>
        <div class="cp-list">${d.coupons.map((c) => ticket(c, { cls: c.active ? '' : 'dim', meta: `${c.active ? '판매 중' : '판매 멈춤'} · 판 수량 ${c.issued}장${c.stock >= 0 ? ` / ${c.stock}장` : ''}${c.per_user ? ` · 1인 ${c.per_user}장` : ''}`,
          action: `<button class="btn small" data-edit="${c.id}">고치기</button>` })).join('') || '<p class="muted">쿠폰이 없어요.</p>'}</div></section>
      ${d.recent.length ? `<details class="pt-sec help"><summary>최근 사용·취소한 쿠폰</summary><ul class="pt-hist">${d.recent.map((x) => `<li><span class="pt-when">${dt(x.used_at || x.created)}</span><span class="pt-why">${esc(x.user_name)} · ${esc(x.title)}</span><b class="${x.status === 'used' ? '' : 'minus'}">${STATUS[x.status][0]}</b></li>`).join('')}</ul></details>` : ''}`;

    const editor = (c) => {
      c = c || { title: '', description: '', price: 1000, stock: -1, per_user: 0, icon: '🎟️', active: 1 };
      const m = YT.modal(`<h2 class="modal-title">${c.id ? '쿠폰 고치기' : '새 쿠폰'}</h2>
        <form class="form" id="cpForm"><div class="form-row"><label style="max-width:5rem">그림<input class="input" name="icon" maxlength="8" value="${esc(c.icon || '')}"></label><label class="grow">쿠폰 이름<input class="input" name="title" required maxlength="40" value="${esc(c.title)}"></label></div>
          <label>설명<input class="input" name="description" maxlength="200" value="${esc(c.description || '')}" placeholder="어떻게 쓰는 쿠폰인지"></label>
          <div class="form-row"><label>가격 (포인트)<input class="input" name="price" inputmode="numeric" required value="${c.price}"></label>
            <label>전체 수량<input class="input" name="stock" inputmode="numeric" value="${c.stock >= 0 ? c.stock : ''}" placeholder="비우면 무제한"></label>
            <label>1인 최대<input class="input" name="per_user" inputmode="numeric" value="${c.per_user || ''}" placeholder="비우면 무제한"></label></div>
          <label class="check"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> 판매하기</label>
          <div class="row gap end">${c.id ? '<button type="button" class="btn danger ghost" id="cpDel">지우기</button>' : ''}<button class="btn primary">저장</button></div></form>`);
      m.el.querySelector('#cpForm').onsubmit = async (e) => {
        e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); f.active = !!e.target.active.checked;
        try { if (c.id) await YT.put('/api/coupons/' + c.id, f); else await YT.post('/api/coupons', f); m.close(); YT.toast('쿠폰을 저장했어요.'); managePage(box); } catch (err) { YT.err(err); }
      };
      const del = m.el.querySelector('#cpDel');
      if (del) del.onclick = async () => { if (!YT.confirm('이 쿠폰을 지울까요?')) return; try { const r = await YT.del('/api/coupons/' + c.id); m.close(); YT.toast(r.message); managePage(box); } catch (err) { YT.err(err); } };
    };
    box.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.use) { await YT.post(`/api/coupon-issues/${b.dataset.use}`, { action: 'use' }); YT.toast('사용 완료로 표시했어요.'); managePage(box); }
        else if (b.dataset.cancel) { if (!YT.confirm('이 쿠폰을 취소하고 포인트를 돌려줄까요?')) return; await YT.post(`/api/coupon-issues/${b.dataset.cancel}`, { action: 'cancel' }); YT.toast('취소하고 포인트를 돌려줬어요.'); managePage(box); }
        else if (b.dataset.edit) editor(d.coupons.find((c) => c.id === b.dataset.edit));
        else if (b.hasAttribute('data-new')) editor(null);
        else if (b.dataset.monsave) { const v = box.querySelector(`[data-mon="${b.dataset.monsave}"]`).value; await YT.put('/api/points/monthly', { user_id: b.dataset.monsave, amount: v }); YT.toast('매달 포인트를 저장했어요.'); managePage(box); }
        else if (b.id === 'backpay') { b.disabled = true; const r = await YT.post('/api/points/backpay', {}); YT.toast(r.message); managePage(box); }
      } catch (err) { YT.err(err); b.disabled = false; }
    };
    box.querySelector('#grantForm').onsubmit = async (e) => {
      e.preventDefault(); try { await YT.post('/api/points/grant', Object.fromEntries(new FormData(e.target))); YT.toast('포인트를 바꿨어요.'); managePage(box); } catch (err) { YT.err(err); }
    };
    box.querySelector('#rateForm').onsubmit = async (e) => {
      e.preventDefault(); try { await YT.put('/api/points/rate', Object.fromEntries(new FormData(e.target))); YT.toast('원고료를 저장했어요.'); managePage(box); } catch (err) { YT.err(err); }
    };
  }

  const mount = (fn) => async (view) => {
    if (!YT.can('reporter')) return YT.state.user ? (view.innerHTML = '<div class="empty-state"><h2>기자만 원고료를 받을 수 있어요</h2><p class="muted">관리자에게 기자 권한을 부탁해 보세요.</p></div>') : YT.needLogin(view, '기자 계정으로 로그인하면 원고료와 쿠폰을 볼 수 있어요.');
    view.className = 'container';
    view.innerHTML = YT.subTabs('desk') + YT.pageHead('', '원고료 · 쿠폰', '기사가 신문에 실리면 원고료(포인트)가 들어와요. 모은 포인트로 우리 가족 쿠폰을 살 수 있어요.') + '<div id="ptBox"><p class="muted">불러오는 중…</p></div>';
    try { await fn(view.querySelector('#ptBox')); } catch (err) { view.querySelector('#ptBox').innerHTML = `<div class="empty-state"><p>${esc(err.message || '불러오지 못했어요.')}</p></div>`; }
  };
  YT.addRoute('/points', mount(myPage));
  YT.addRoute('/points/manage', mount(managePage));
})();
