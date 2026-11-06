// Vercel 서버 함수 입구 — 모든 요청을 server.js의 handle로 넘긴다 (vercel.json의 rewrites 참고)
'use strict';
const { handle } = require('../server.js');

module.exports = (req, res) => {
  // rewrites가 원래 주소를 __path로 넘겨 준다 → server.js가 보던 주소 그대로 되돌림
  const u = new URL(req.url, 'http://local');
  const orig = u.searchParams.get('__path');
  if (orig !== null) {
    u.searchParams.delete('__path');
    const qs = u.searchParams.toString();
    req.url = (orig.startsWith('/') ? orig : '/' + orig) + (qs ? '?' + qs : '');
  }
  return handle(req, res);
};

// Vercel이 함께 올릴 패키지를 알아보도록 적어 둔 것 (실제로는 lib/cloud.js가 작업 스레드에서 불러 씀)
// eslint-disable-next-line no-unused-vars
function packagesForVercel() { require('pg'); require('@vercel/blob'); }
