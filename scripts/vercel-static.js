// Vercel 빌드: 글꼴·지도·아이콘처럼 바뀌지 않는 파일만 정적 파일로 내보낸다.
// 나머지(첫 화면, 화면 코드 묶음, API)는 api/index.js가 server.js로 보낸다.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'vercel-static');
fs.rmSync(out, { recursive: true, force: true });
for (const p of ['fonts', 'vendor', 'icon-192.png', 'icon-512.png', 'favicon.svg']) {
  fs.cpSync(path.join(root, 'public', p), path.join(out, p), { recursive: true });
}
console.log('정적 파일 준비 완료 →', path.relative(root, out));
