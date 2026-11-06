// Vercel 서버 함수 입구 — 모든 요청을 server.js의 handle로 넘긴다 (vercel.json의 rewrites 참고)
'use strict';
// 데이터베이스가 아직 연결되지 않았으면 서버를 켜지 않고 안내 화면만 보여 준다
const ready = !!process.env.DATABASE_URL;
const { handle } = ready ? require('../server.js') : {};

module.exports = (req, res) => {
  if (!ready) {
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>유니 타임즈 준비 중</title>
<body style="font-family:sans-serif;background:#F4F1E8;color:#252D28;max-width:36rem;margin:4rem auto;padding:0 1.25rem;line-height:1.7">
<h1>유니 타임즈를 준비하고 있어요</h1><p>아직 데이터베이스가 연결되지 않았어요. Vercel 프로젝트 → <b>Storage</b>에서 <b>Neon</b>(데이터베이스)과 <b>Blob</b>(사진 저장소)을 만들어 연결한 뒤 <b>Redeploy</b> 해 주세요.</p>
<p style="color:#7B8077;font-size:.9rem">자세한 방법은 저장소의 VERCEL.md에 있어요.</p></body></html>`);
  }
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
