/* 사진관 앨범 디자인 — 템플릿마다 표지와 속지 배치가 다릅니다 */
(function () {
  'use strict';
  const { esc } = YT;

  const T = {
    classic:   { name: '클래식', desc: '한 장을 넓은 여백과 함께', per: 1, cover: 'frame' },
    magazine:  { name: '매거진', desc: '꽉 찬 사진 위에 큰 제목', per: 1, cover: 'bleed' },
    story:     { name: '스토리북', desc: '두 장을 엇갈려 이야기처럼', per: 2, cover: 'frame' },
    collage:   { name: '콜라주', desc: '큰 사진 하나와 작은 두 장', per: 3, cover: 'split' },
    grid:      { name: '갤러리 그리드', desc: '네 장을 반듯한 격자로', per: 4, cover: 'mosaic' },
    polaroid:  { name: '폴라로이드', desc: '흩어 놓은 즉석사진 네 장', per: 4, cover: 'pola' },
    scrapbook: { name: '스크랩북', desc: '크라프트지에 테이프로 붙인 세 장', per: 3, cover: 'pola' },
    film:      { name: '필름', desc: '여섯 컷 필름 스트립', per: 6, cover: 'film' },
  };
  const LEGACY = { portrait: 'classic', storybook: 'story' };
  const PAPERS = { ivory: '아이보리', white: '화이트', sage: '세이지', charcoal: '차콜' };
  YT.ALBUM_TEMPLATES = T; YT.ALBUM_PAPERS = PAPERS;
  YT.albumKey = (k) => (T[k] ? k : LEGACY[k] || 'classic');

  const rot = (i, seed = 0) => [-4, 3, -2, 5, -3, 2][(i + seed) % 6];

  function slot(it, i, key, url) {
    const img = it && it.photo ? `<img src="${url(it.photo)}" alt="" style="object-fit:${it.fit === 'contain' ? 'contain' : 'cover'}">` : '';
    const cap = it && it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : '';
    const ph = `<div class="ph ${img ? '' : 'empty'}">${img}</div>`;
    if (key === 'polaroid' || key === 'scrapbook') return `<figure class="sl s${i}" style="--r:${rot(i, key === 'scrapbook' ? 2 : 0)}deg"><i class="tp-tape" aria-hidden="true"></i>${ph}${cap || (key === 'polaroid' ? '<figcaption>&nbsp;</figcaption>' : '')}</figure>`;
    if (key === 'film') return `<figure class="sl s${i}">${ph}<span class="fn">${String(i + 1).padStart(2, '0')}A</span>${cap}</figure>`;
    return `<figure class="sl s${i}">${ph}${cap}</figure>`;
  }

  function cover(album, key, url) {
    const t = T[key]; const first = album.items[0];
    const img = first && first.photo ? `<img src="${url(first.photo)}" alt="">` : '';
    const site = esc(YT.state.settings?.site_name || '유니 타임즈');
    const title = esc(album.title || '우리 가족의 순간들'); const sub = esc(album.subtitle || '');
    const ph = `<div class="ph ${img ? '' : 'empty'}">${img}</div>`;
    const count = `${album.items.length}장의 기록`;
    switch (t.cover) {
      case 'bleed': return `<div class="cv cv-bleed">${ph}<div class="cv-shade"></div><div class="cv-txt"><span class="cv-kick">${site} · Photo Album</span><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<span class="cv-count">${count}</span></div></div>`;
      case 'split': return `<div class="cv cv-split">${ph}<div class="cv-txt"><span class="cv-kick">Photo Album</span><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<span class="cv-count">${site} · ${count}</span></div></div>`;
      case 'mosaic': {
        const tiles = [0, 1, 2, 3].map((i) => { const it = album.items[i]; return `<div class="ph ${it ? '' : 'empty'}">${it ? `<img src="${url(it.photo)}" alt="">` : ''}</div>`; }).join('');
        return `<div class="cv cv-mosaic"><div class="cv-tiles">${tiles}</div><div class="cv-txt"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<span class="cv-count">${site} · ${count}</span></div></div>`;
      }
      case 'pola': return `<div class="cv cv-pola"><figure class="sl"><i class="tp-tape" aria-hidden="true"></i>${ph}<figcaption>${sub || title}</figcaption></figure><div class="cv-txt"><h2>${title}</h2><span class="cv-count">${site} · ${count}</span></div></div>`;
      case 'film': return `<div class="cv cv-film"><div class="cv-strip">${ph}</div><div class="cv-txt"><span class="cv-kick">Roll 01 · ${count}</span><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
      default: return `<div class="cv cv-frame"><span class="cv-kick">${site} · Photo Album</span><div class="cv-photo">${ph}</div><h2>${title}</h2><i class="cv-rule"></i>${sub ? `<p>${sub}</p>` : ''}<span class="cv-count">${count}</span></div>`;
    }
  }

  // album: { title, subtitle, template, paper, items }  →  [페이지 HTML]
  YT.renderAlbumPages = (album, opts = {}) => {
    const key = YT.albumKey(album.template); const t = T[key];
    const paper = PAPERS[album.paper] ? album.paper : 'ivory';
    const url = opts.photoUrl || YT.photoUrl;
    const page = (inner, n, extra = '') => `<div class="al-page a-${key} p-${paper} ${extra}"><div class="al-in">${inner}</div>${n ? `<div class="al-num">${n}</div>` : ''}</div>`;
    const pages = [];
    if (!opts.noCover) pages.push(page(cover(album, key, url), 0, 'is-cover'));
    const items = album.items.length ? album.items : (opts.sample ? Array.from({ length: t.per }, () => null) : []);
    for (let i = 0, n = 1; i < Math.max(items.length, opts.sample ? t.per : 0); i += t.per, n++) {
      const chunk = items.slice(i, i + t.per); while (chunk.length < t.per && opts.sample) chunk.push(null);
      pages.push(page(`<div class="sls n${chunk.length}">${chunk.map((it, j) => slot(it, j, key, url)).join('')}</div>`, n));
      if (opts.limit && pages.length >= opts.limit) break;
    }
    return pages;
  };
})();
