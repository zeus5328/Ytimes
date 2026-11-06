/* 유니 타임즈 — 클라우드 모드 (Vercel + Neon Postgres + Vercel Blob)
   DATABASE_URL이 있으면 이 파일이 SQLite 대신 쓰인다.
   · 서버 본문의 db.exec / db.prepare(...).all/get/run 을 그대로 쓸 수 있게 같은 모양으로 만든다 (동기)
   · SQLite 문법을 Postgres 문법으로 바꿔 준다 (? → $1, INSERT OR IGNORE/REPLACE, LIKE, PRAGMA, INTEGER → BIGINT …)
   · 사진·소리 파일은 Vercel Blob에 저장한다 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { Worker, MessageChannel, receiveMessageOnPort } = require('node:worker_threads');

let bridge = null;
function startBridge() {
  if (bridge) return bridge;
  const shared = new SharedArrayBuffer(4); const flag = new Int32Array(shared);
  const { port1, port2 } = new MessageChannel();
  let blobPath = ''; try { blobPath = require.resolve('@vercel/blob'); } catch { /* 사진 저장소를 안 쓰는 경우 */ }
  const worker = new Worker(path.join(__dirname, 'cloud-worker.js'), {
    workerData: { port: port2, shared, dbUrl: process.env.DATABASE_URL, pgPath: require.resolve('pg'), blobPath, blobToken: process.env.BLOB_READ_WRITE_TOKEN || '' },
    transferList: [port2],
  });
  worker.unref(); port1.unref && port1.unref();
  worker.on('error', (e) => { console.error('클라우드 작업 스레드 오류:', e); bridge = null; });
  const call = (msg) => {
    Atomics.store(flag, 0, 0);
    port1.postMessage(msg);
    if (Atomics.wait(flag, 0, 0, 30000) === 'timed-out') throw new Error('데이터베이스 응답이 너무 늦어요. 잠시 뒤 다시 해 주세요.');
    const m = receiveMessageOnPort(port1);
    if (!m) throw new Error('데이터베이스 응답을 받지 못했어요.');
    if (m.message.error) { const e = new Error(m.message.error); e.code = m.message.code; throw e; }
    return m.message.result;
  };
  bridge = { call };
  return bridge;
}

// ───────── SQLite → Postgres 문법 바꾸기
const pkCache = new Map();
function placeholders(sql) {
  let out = '', n = 0, q = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (q) { out += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; out += ch; continue; }
    if (ch === '?') { out += '$' + (++n); continue; }
    out += ch;
  }
  return out;
}
function ddl(sql) {
  return sql
    .replace(/\bINTEGER PRIMARY KEY AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bINTEGER\b/g, 'BIGINT')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION')
    .replace(/\bBLOB\b/g, 'BYTEA')
    .replace(/ADD COLUMN (?!IF NOT EXISTS)/gi, 'ADD COLUMN IF NOT EXISTS ');
}
function primaryKey(table, call) {
  if (pkCache.has(table)) return pkCache.get(table);
  const r = call({ op: 'sql', sql: `SELECT a.attname AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary`, params: [table] });
  const pk = r.rows.map((x) => x.name); pkCache.set(table, pk); return pk;
}
const translated = new Map();
function translate(sql, call) {
  if (translated.has(sql)) return translated.get(sql);
  let s = sql.trim();
  const pragma = /^PRAGMA\s+table_info\((\w+)\)$/i.exec(s);
  if (pragma) s = `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${pragma[1].toLowerCase()}' ORDER BY ordinal_position`;
  else {
    let m;
    if ((m = /^INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)/i.exec(s))) s = s.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
    else if ((m = /^INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]*)\)/i.exec(s))) {
      const table = m[1]; const cols = m[2].split(',').map((c) => c.trim());
      const pk = primaryKey(table, call); const rest = cols.filter((c) => !pk.includes(c));
      s = s.replace(/^INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO') + (pk.length ? ` ON CONFLICT (${pk.join(',')}) ` + (rest.length ? `DO UPDATE SET ${rest.map((c) => `${c}=EXCLUDED.${c}`).join(', ')}` : 'DO NOTHING') : '');
    }
    s = s.replace(/\bLIKE\b/g, 'ILIKE');
    s = placeholders(s);
  }
  translated.set(sql, s); return s;
}
const norm = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

class CloudDatabase {
  constructor() { this.call = startBridge().call; }
  exec(sql) {
    // 여러 문장을 하나씩 (작은따옴표 안의 ;는 건너뜀)
    const parts = []; let cur = '', q = false;
    for (const ch of sql) { if (ch === "'") q = !q; if (ch === ';' && !q) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    for (let st of parts) {
      st = st.trim(); if (!st) continue;
      if (/^PRAGMA\b/i.test(st)) continue;                         // SQLite 전용 설정
      if (/^VACUUM\b/i.test(st)) throw new Error('클라우드 데이터베이스는 Neon이 자동으로 백업해요.');
      if (/^(CREATE|ALTER|DROP)\b/i.test(st)) st = ddl(st);
      this.call({ op: 'sql', sql: st, params: [] });
    }
  }
  prepare(sql) {
    const call = this.call;
    const q = (params) => call({ op: 'sql', sql: translate(sql, call), params: norm(params) });
    return {
      all: (...p) => q(p).rows,
      get: (...p) => q(p).rows[0],
      run: (...p) => ({ changes: q(p).rowCount }),
    };
  }
}

// ───────── 사진·소리 파일 저장소 (Vercel Blob)
// 파일 이름(예: 1234-abcd.jpg) → Blob 주소. 주소의 앞부분은 처음 올릴 때 알아내 settings에 적어 둔다.
function makeUploads(db) {
  const fake = process.env.YT_FAKE_BLOB_DIR; // 시험용: Blob 대신 폴더 (주소는 /__blob/이름)
  // 처음 올리기 전에는 토큰(vercel_blob_rw_<저장소ID>_…)에서 주소를 짐작하고, 올린 뒤에는 실제 주소를 적어 둔 것을 쓴다
  const guess = () => { const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(process.env.BLOB_READ_WRITE_TOKEN || ''); return m ? `https://${m[1].toLowerCase()}.public.blob.vercel-storage.com/` : ''; };
  const getBase = () => { const r = db.prepare("SELECT value FROM settings WHERE key='blob_base'").get(); return r ? r.value : guess(); };
  let base = null;
  const prefix = 'uploads/';
  return {
    cloud: true,
    put(name, buf, type) {
      if (fake) { fs.mkdirSync(fake, { recursive: true }); fs.writeFileSync(path.join(fake, name), buf); return; }
      const { url } = bridge.call({ op: 'blob', action: 'put', name: prefix + name, data: new Uint8Array(buf), type });
      const b = url.slice(0, url.length - (prefix + name).length);
      if (b !== base) { base = b; db.prepare("INSERT INTO settings(key,value) VALUES('blob_base',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(b); }
    },
    url(name) {
      if (fake) return '/__blob/' + encodeURIComponent(name);
      if (base == null) base = getBase();
      return base ? base + prefix + name : '';
    },
    read(name) {
      if (fake) { try { return fs.readFileSync(path.join(fake, name)); } catch { return null; } }
      const u = this.url(name); if (!u) return null;
      const r = bridge.call({ op: 'blob', action: 'get', url: u });
      return r ? Buffer.from(r) : null;
    },
    del(names) {
      if (fake) { for (const n of names) { try { fs.unlinkSync(path.join(fake, n)); } catch {} } return; }
      const urls = names.map((n) => this.url(n)).filter(Boolean); if (!urls.length) return;
      try { bridge.call({ op: 'blob', action: 'del', urls }); } catch { /* 이미 없는 파일 */ }
    },
  };
}

module.exports = { CloudDatabase, makeUploads, enabled: () => !!process.env.DATABASE_URL };
