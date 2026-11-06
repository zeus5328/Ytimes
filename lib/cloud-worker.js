/* 유니 타임즈 — 클라우드(Neon Postgres · Vercel Blob) 작업 스레드
   서버 본문은 지금처럼 '동기' 코드로 두고, 실제 네트워크 작업은 이 스레드가 대신 한다.
   (본문 스레드는 Atomics.wait로 결과를 기다리고, 이 스레드가 끝나면 깨운다) */
'use strict';
const { workerData } = require('node:worker_threads');
const { port, shared, dbUrl, pgPath, blobToken } = workerData;  // blobPath: @vercel/blob 위치
const flag = new Int32Array(shared);
const pg = require(pgPath);

// bigint(COUNT 등)·numeric을 숫자로 — SQLite처럼 쓰도록
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

let client = null, lastUsed = 0;
const STALE_MS = 4 * 60e3; // 오래 쉬던 연결은 Neon이 먼저 끊어 둘 수 있어서 새로 연다
const dropClient = () => { const c = client; client = null; if (c) c.end().catch(() => {}); };
async function db() {
  if (client && Date.now() - lastUsed > STALE_MS) dropClient();
  if (client) return client;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
  const c = new pg.Client({ connectionString: dbUrl, ssl: local ? false : { rejectUnauthorized: true }, statement_timeout: 25000, keepAlive: true });
  c.on('error', () => { client = null; });
  await c.connect();
  client = c; return c;
}

let blobSdk = null;
async function blob(m) {
  if (!blobToken) throw new Error('사진 저장소(BLOB_READ_WRITE_TOKEN)가 설정되지 않았어요.');
  if (!blobSdk) blobSdk = require(workerData.blobPath);
  if (m.action === 'put') {
    const r = await blobSdk.put(m.name, Buffer.from(m.data), { access: 'public', token: blobToken, addRandomSuffix: false, allowOverwrite: true,
      contentType: m.type || 'application/octet-stream', cacheControlMaxAge: 31536000 });
    return { url: r.url };
  }
  if (m.action === 'get') {
    const r = await fetch(m.url); if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  }
  if (m.action === 'del') { await blobSdk.del(m.urls, { token: blobToken }); return { ok: true }; }
  throw new Error('알 수 없는 저장소 작업');
}

async function handle(m) {
  if (m.op === 'sql') {
    const idle = Date.now() - lastUsed;
    const run = async () => {
      let c;
      try { c = await db(); } catch (e) { throw new Error('데이터베이스에 연결하지 못했어요: ' + e.message); }
      const r = await c.query(m.sql, m.params); lastUsed = Date.now();
      const res = Array.isArray(r) ? r[r.length - 1] : r; // 여러 문장이면 마지막 결과
      return { rows: res.rows || [], rowCount: res.rowCount || 0 };
    };
    try { return await run(); }
    catch (e) {
      if (!/terminat|ECONNRESET|Connection|closed|EPIPE/i.test(e.message)) throw e;
      dropClient();
      // 끊긴 연결: 읽기는 늘, 쓰기는 한동안 쉬던 연결(보내기 전에 이미 끊긴 경우)일 때만 새 연결로 한 번 더
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(m.sql) || idle > 30e3) return run();
      throw e;
    }
  }
  if (m.op === 'blob') return blob(m);
  if (m.op === 'ping') return { ok: true };
  throw new Error('알 수 없는 작업');
}

port.on('message', async (m) => {
  let out;
  try { out = { result: await handle(m) }; }
  catch (e) { out = { error: e.message || String(e), code: e.code }; }
  port.postMessage(out);
  Atomics.store(flag, 0, 1); Atomics.notify(flag, 0);
});
