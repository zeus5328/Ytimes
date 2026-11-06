/* 사진관 › 증명·여권사진 — 사진을 규격에 맞게 자르고, 한 장(제출용)이나 4×6 인화지(여러 장)로 내려받기
   · 모든 작업은 이 기기(브라우저) 안에서만 해요. 사진이 서버로 올라가지 않아요.
   · 여권사진은 배경 지우기·합성·보정이 금지라 그런 기능은 일부러 넣지 않았어요. */
(function () {
  'use strict';
  const { esc } = YT;
  const DPI = 300; const mm = (v) => Math.round((v / 25.4) * DPI);
  // 크기(mm)와 얼굴 안내(정수리 위치·머리 길이, mm)
  const KINDS = {
    passport: { name: '여권사진', w: 35, h: 45, top: 4, head: 34, headMin: 32, headMax: 36, note: '가로 3.5 × 세로 4.5cm · 머리 길이(정수리~턱) 3.2~3.6cm · 흰 배경 · 6개월 안에 찍은 사진' },
    id: { name: '증명사진 (반명함)', w: 30, h: 40, top: 4, head: 27, note: '가로 3 × 세로 4cm · 이력서·학생증·자격증 등에 많이 써요' },
    card: { name: '명함판', w: 50, h: 70, top: 7, head: 40, note: '가로 5 × 세로 7cm' },
  };
  const SHEET = { w: 152, h: 102, gap: 2, margin: 1.5 }; // 4×6인치(10×15cm) 인화지, 가로로 눕혀서

  YT.addRoute('/studio/id-photo', async (view) => {
    view.className = 'container';
    if (!YT.can('admin')) {
      view.innerHTML = YT.subTabs('studio') + YT.pageHead('', '증명·여권사진', '사진을 규격에 맞게 잘라 인화용으로 만들어요.') + '<div class="empty-state"><h2>관리자 전용 공간이에요</h2><p>사진관은 관리자만 쓸 수 있어요.</p></div>';
      return;
    }
    let kind = 'passport'; let img = null; let st = { s: 1, ox: 0, oy: 0, rot: 0 }; let guide = true;
    view.innerHTML = YT.subTabs('studio') + YT.pageHead('', '증명·여권사진', '사진을 고르고 얼굴을 점선에 맞추면, 제출용 한 장이나 인화지 한 장에 여러 장으로 만들어 줘요. 사진은 이 기기 안에서만 다루고 서버에 올리지 않아요.')
      + `<div class="idp">
        <div class="idp-kinds" role="group" aria-label="사진 종류">${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="chip ${k === kind ? 'on' : ''}" data-kind="${k}" aria-pressed="${k === kind}">${v.name} <small>${v.w / 10}×${v.h / 10}cm</small></button>`).join('')}</div>
        <p class="muted small" id="idpNote"></p>
        <div class="idp-grid">
          <section class="g-panel idp-stage">
            <div class="idp-frame" id="idpFrame"><canvas id="idpCv"></canvas><svg id="idpGuide" class="idp-guide" aria-hidden="true"></svg>
              <label class="idp-empty" for="idpFile" id="idpEmpty"><b>📷 사진 고르기</b><small>정면을 보고, 밝고 고른 빛에서 흰 벽 앞에서 찍은 사진이 좋아요</small></label></div>
            <input type="file" id="idpFile" accept="image/*" hidden>
            <div class="idp-ctl" id="idpCtl" hidden>
              <label>크기<input type="range" id="idpZoom" min="0.2" max="4" step="0.01"></label>
              <label>기울기<input type="range" id="idpRot" min="-15" max="15" step="0.5" value="0"></label>
              <div class="row gap"><button type="button" class="btn small" id="idpFit">처음 크기로</button><label class="btn small" for="idpFile">다른 사진</label>
                <label class="check small"><input type="checkbox" id="idpGuideOn" checked> 얼굴 안내선</label></div>
              <p class="muted small">사진을 끌어서 옮기고, 크기를 맞춰 <b>정수리와 턱이 점선 타원</b>에 닿게 해 주세요. 휴대폰은 두 손가락으로 키울 수 있어요.</p>
            </div>
          </section>
          <section class="g-panel idp-out">
            <div class="g-ph"><h3>내려받기 · 인화</h3></div>
            <div class="idp-acts">
              <button class="btn primary" id="idpOne" disabled>📄 한 장 저장 (JPG)</button>
              <p class="muted small">온라인 신청·제출용 파일이에요 (실제 크기, 300dpi).</p>
              <button class="btn" id="idpSheet" disabled>🖨️ 4×6 인화지용 저장</button>
              <p class="muted small" id="idpSheetInfo">사진관·편의점 인화기나 집 프린터에서 <b>4×6(10×15cm) 실제 크기</b>로 뽑은 뒤 선을 따라 잘라요.</p>
              <button class="btn ghost" id="idpPrint" disabled>바로 인쇄</button>
            </div>
            <div class="idp-sheet" id="idpSheetPrev"></div>
            <details class="help" id="idpRules"><summary>여권사진 확인할 점 (외교부 기준)</summary><ul class="set-list">
              <li>흰 배경, 6개월 안에 찍은 사진 · <b>배경 지우기·합성·보정(필터, AI 편집) 금지</b></li>
              <li>정면을 보고 입은 다물고, 눈썹과 얼굴 윤곽(귀·턱)이 머리카락에 가리지 않게</li>
              <li>색 렌즈·색안경 안 돼요. 안경은 빛 반사나 테가 눈을 가리면 안 돼요</li>
              <li>모자·머리띠 안 돼요. 그림자·빛 번짐 없이 고르게</li>
              <li>36개월 미만 아기도 같은 기준 (장난감·보호자가 보이면 안 돼요)</li>
              <li>인화는 꼭 <b>사진 인화지</b>에 · 최신 기준은 외교부 여권안내 누리집에서 확인하세요</li></ul></details>
          </section>
        </div></div>`;
    const cv = YT.$('#idpCv'), ctx = cv.getContext('2d'), gsvg = YT.$('#idpGuide'), frame = YT.$('#idpFrame');
    const K = () => KINDS[kind];
    const size = () => ({ w: mm(K().w), h: mm(K().h) });
    const cover = () => { const { w, h } = size(); return Math.max(w / img.naturalWidth, h / img.naturalHeight); };
    const draw = () => {
      const { w, h } = size(); cv.width = w; cv.height = h; frame.style.aspectRatio = `${K().w} / ${K().h}`;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      if (img) { ctx.save(); ctx.translate(w / 2 + st.ox, h / 2 + st.oy); ctx.rotate((st.rot * Math.PI) / 180); ctx.scale(st.s, st.s); ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2); ctx.restore(); }
      // 얼굴 안내선 (내려받는 사진에는 들어가지 않아요)
      const k = K(); gsvg.setAttribute('viewBox', `0 0 ${k.w} ${k.h}`);
      const cy = k.top + k.head / 2, rx = k.head * 0.36;
      gsvg.innerHTML = guide && img ? `<line x1="${k.w / 2}" y1="0" x2="${k.w / 2}" y2="${k.h}" class="g-c"/>
        ${k.headMin ? `<rect x="0" y="${k.top + k.headMin}" width="${k.w}" height="${k.headMax - k.headMin}" class="g-zone"/>` : ''}
        <ellipse cx="${k.w / 2}" cy="${cy}" rx="${rx}" ry="${k.head / 2}" class="g-o"/>
        <line x1="${k.w / 2 - rx - 2}" y1="${k.top}" x2="${k.w / 2 + rx + 2}" y2="${k.top}" class="g-l"/><text x="0.8" y="${k.top - 0.7}" class="g-t">정수리</text>
        <line x1="${k.w / 2 - rx - 2}" y1="${k.top + k.head}" x2="${k.w / 2 + rx + 2}" y2="${k.top + k.head}" class="g-l"/><text x="0.8" y="${k.top + k.head - 0.7}" class="g-t">턱</text>` : '';
      YT.$('#idpNote').textContent = k.note;
      YT.$('#idpRules').hidden = kind !== 'passport';
      ['#idpOne', '#idpSheet', '#idpPrint'].forEach((s) => (YT.$(s).disabled = !img));
      YT.$('#idpCtl').hidden = !img; YT.$('#idpEmpty').hidden = !!img;
      clearTimeout(sheetTimer); sheetTimer = setTimeout(drawSheetPrev, 350); // 인화지 미리보기는 손을 멈춘 뒤에
    };
    let sheetTimer = null;
    // 4×6 인화지에 몇 장 들어가는지
    const sheetLayout = () => {
      const k = K(); const S = SHEET; const fit = (W, H) => ({ cols: Math.floor((W - 2 * S.margin + S.gap) / (k.w + S.gap)), rows: Math.floor((H - 2 * S.margin - 6 + S.gap) / (k.h + S.gap)) });
      const a = fit(S.w, S.h), b = fit(S.h, S.w); // 가로 눕힘 / 세로 세움 중 더 많이 들어가는 쪽
      return a.cols * a.rows >= b.cols * b.rows ? { W: S.w, H: S.h, ...a } : { W: S.h, H: S.w, ...b };
    };
    const makeSheet = () => {
      const k = K(); const L = sheetLayout(); const S = SHEET;
      const c = document.createElement('canvas'); c.width = mm(L.W); c.height = mm(L.H); const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      const totalW = L.cols * k.w + (L.cols - 1) * S.gap, totalH = L.rows * k.h + (L.rows - 1) * S.gap;
      const x0 = (L.W - totalW) / 2, y0 = (L.H - 6 - totalH) / 2;
      x.strokeStyle = '#c8c8c8'; x.lineWidth = 1;
      for (let r = 0; r < L.rows; r++) for (let col = 0; col < L.cols; col++) {
        const px = mm(x0 + col * (k.w + S.gap)), py = mm(y0 + r * (k.h + S.gap));
        x.drawImage(cv, px, py, mm(k.w), mm(k.h)); x.strokeRect(px - 0.5, py - 0.5, mm(k.w) + 1, mm(k.h) + 1);
      }
      x.fillStyle = '#888'; x.font = `${mm(2.6)}px sans-serif`; x.textAlign = 'center';
      x.fillText(`${k.name} ${k.w / 10}×${k.h / 10}cm · ${L.cols * L.rows}장 · 4×6(10×15cm) 실제 크기로 인화`, c.width / 2, c.height - mm(2.2));
      return { canvas: c, n: L.cols * L.rows };
    };
    const drawSheetPrev = () => {
      const box = YT.$('#idpSheetPrev'); if (!img) { box.innerHTML = ''; return; }
      const { canvas, n } = makeSheet(); box.innerHTML = ''; canvas.className = 'idp-sheet-cv'; box.appendChild(canvas);
      YT.$('#idpSheetInfo').innerHTML = `한 장에 <b>${n}장</b>이 들어가요. 사진관·편의점 인화기나 집 프린터에서 <b>4×6(10×15cm) 실제 크기</b>로 뽑은 뒤 선을 따라 잘라요.`;
    };
    const redraw = () => { draw(); };
    // 사진 고르기
    YT.$('#idpFile').onchange = (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) return YT.toast('사진 파일을 골라 주세요.', 'error');
      const url = URL.createObjectURL(f); const im = new Image();
      im.onload = () => { img = im; st = { s: cover(), ox: 0, oy: 0, rot: 0 }; YT.$('#idpZoom').value = 1; YT.$('#idpRot').value = 0; redraw(); };
      im.onerror = () => YT.toast('이 사진을 열 수 없어요. (HEIC라면 아이폰 설정 › 카메라 › 포맷 › 호환성 우선, 또는 JPG로 저장해서 골라 주세요)', 'error');
      im.src = url;
    };
    // 크기·기울기 — 크기는 ‘딱 맞는 크기’를 1로 보고 곱해요
    YT.$('#idpZoom').oninput = (e) => { if (!img) return; st.s = cover() * +e.target.value; redraw(); };
    YT.$('#idpRot').oninput = (e) => { st.rot = +e.target.value; redraw(); };
    YT.$('#idpFit').onclick = () => { if (!img) return; st = { s: cover(), ox: 0, oy: 0, rot: 0 }; YT.$('#idpZoom').value = 1; YT.$('#idpRot').value = 0; redraw(); };
    YT.$('#idpGuideOn').onchange = (e) => { guide = e.target.checked; redraw(); };
    // 끌어서 옮기기 · 두 손가락 확대
    const pts = new Map(); let pinch = null;
    const toCv = () => cv.width / frame.clientWidth;
    frame.addEventListener('pointerdown', (e) => { if (!img) return; frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: st.s }; } });
    frame.addEventListener('pointermove', (e) => {
      if (!img || !pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; st.s = Math.max(cover() * 0.2, Math.min(cover() * 4, pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d))); YT.$('#idpZoom').value = st.s / cover(); }
      else if (pts.size === 1) { const r = toCv(); st.ox += (e.clientX - prev.x) * r; st.oy += (e.clientY - prev.y) * r; }
      draw();
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
    frame.addEventListener('wheel', (e) => { if (!img) return; e.preventDefault(); st.s = Math.max(cover() * 0.2, Math.min(cover() * 4, st.s * (e.deltaY < 0 ? 1.04 : 0.96))); YT.$('#idpZoom').value = st.s / cover(); draw(); }, { passive: false });
    // 종류 바꾸기 — 지금 위치 비율은 유지
    YT.$('.idp-kinds').onclick = (e) => {
      const b = e.target.closest('[data-kind]'); if (!b) return; const before = img ? st.s / cover() : 1;
      kind = b.dataset.kind; YT.$$('.idp-kinds .chip').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      if (img) { st.s = cover() * before; st.ox = 0; st.oy = 0; } redraw();
    };
    // 내려받기
    const stamp = () => YT.today().replace(/-/g, '');
    const toBlob = (c) => new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
    YT.$('#idpOne').onclick = async () => { const g = guide; guide = false; draw(); const blob = await toBlob(cv); guide = g; draw(); await YT.saveFile(`${K().name.replace(/\s.*$/, '')}_${K().w}x${K().h}mm_${stamp()}.jpg`, blob, 'image/jpeg'); };
    YT.$('#idpSheet').onclick = async () => { const { canvas } = makeSheet(); await YT.saveFile(`${K().name.replace(/\s.*$/, '')}_4x6인화_${stamp()}.jpg`, await toBlob(canvas), 'image/jpeg'); };
    YT.$('#idpPrint').onclick = () => {
      const { canvas } = makeSheet(); const L = sheetLayout(); const src = canvas.toDataURL('image/jpeg', 0.95);
      const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
      fr.srcdoc = `<!doctype html><html><head><style>@page{size:${L.W}mm ${L.H}mm;margin:0}html,body{margin:0}img{width:${L.W}mm;height:${L.H}mm;display:block}</style></head><body><img src="${src}"></body></html>`;
      fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { YT.toast('이 화면에서는 바로 인쇄할 수 없어요. ‘4×6 인화지용 저장’ 뒤 인쇄해 주세요.', 'error'); } setTimeout(() => fr.remove(), 60000); };
      YT.toast('인쇄 창에서 용지를 4×6(10×15cm), 배율을 ‘실제 크기(100%)’로 골라 주세요.');
    };
    draw();
  });
})();
